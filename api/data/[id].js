// GET /api/data/:id — the seller endpoint (x402 "exact" scheme, Concordium testnet).
// No PAYMENT-SIGNATURE header  -> 402 + PaymentRequirements (after an optional
//   X-Buyer-Badge pre-check; an unverified buyer never gets a 402).
// With PAYMENT-SIGNATURE header -> verify the buyer's badge from the payload
//   sender, settle via the facilitator, then release the dataset + audit entry.
const lib = require('../_lib');

module.exports = async (req, res) => {
  const id = req.query.id;
  const ds = lib.DATASETS[id];
  if (!ds) return res.status(404).json({ error: 'unknown dataset', id });

  const sigHeader = req.headers['payment-signature'] || req.headers['x-payment-signature'];

  // --- Step 1: no payment yet -> offer the 402 (badge pre-check first) -------
  if (!sigHeader) {
    const badgeHeader = req.headers['x-buyer-badge'];
    if (badgeHeader) {
      const chk = await lib.checkBadgeByToken(badgeHeader);
      if (!chk.valid) {
        return res.status(403).json({ error: 'buyer badge not verified', badge: badgeHeader, issues: chk.issues || [] });
      }
    }
    const requirements = lib.paymentRequirements(id);
    return res.status(402).json({
      x402Version: 2,
      error: 'Payment Required',
      accepts: [requirements],
    });
  }

  // --- Step 2: payment presented -> decode, badge-check, settle, release ----
  let payment;
  try {
    payment = lib.b64urlDecode(sigHeader);
  } catch (e) {
    return res.status(400).json({ error: 'invalid PAYMENT-SIGNATURE header', detail: String(e.message || e) });
  }
  const requirements = lib.paymentRequirements(id);
  // The @x402/concordium client puts the sender inside the signed transaction
  // header (signedTransaction.header.sender); there is no top-level sender.
  const sender = payment?.payload?.sender
    || payment?.payload?.signedTransaction?.header?.sender;
  if (!sender) return res.status(400).json({ error: 'payment payload has no sender' });

  // Badge check BEFORE settling: the seller only deals with verified agents.
  const badgeChk = await lib.checkBadgeByAccount(sender);
  if (!badgeChk.valid) {
    return res.status(403).json({ error: 'buyer badge not verified', sender, detail: badgeChk });
  }

  let scheme;
  try {
    scheme = await lib.getFacilitatorScheme();
  } catch (e) {
    return res.status(500).json({ error: 'facilitator unavailable', detail: String(e.message || e) });
  }

  const verify = await scheme.verify(payment, requirements);
  if (!verify.isValid) {
    return res.status(402).json({ error: 'payment verification failed', invalidReason: verify.invalidReason, invalidMessage: verify.invalidMessage });
  }

  const settle = await scheme.settle(payment, requirements);
  if (!settle.success) {
    return res.status(402).json({ error: 'payment settlement failed', reason: settle.errorReason, message: settle.errorMessage, transaction: settle.transaction || '' });
  }

  const txHash = settle.transaction;
  // The audit entry carries the real block height, looked up from the node
  // after finalization. A lookup failure never fails the trade — the height
  // stays null and can be filled in later from the explorer.
  let blockHeight = null;
  for (let attempt = 0; attempt < 3 && blockHeight == null; attempt++) {
    try {
      blockHeight = await lib.getTxBlockHeight(txHash);
    } catch (e) { /* node unreachable — retry below */ }
    if (blockHeight == null && attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }
  // Trigger record: who/what initiated this buy. The Buy button path
  // (/api/buy) forwards the original caller's IP hash + user agent; a direct
  // x402 call to this endpoint has no forwarded headers, so the trigger is
  // computed from this request itself. The raw IP is never stored.
  const fwdIpHash = req.headers['x-trigger-ip-hash'];
  const fwdUa = req.headers['x-trigger-user-agent'];
  const trigger = (fwdIpHash || fwdUa)
    ? { ipHash: fwdIpHash || null, userAgent: fwdUa || null }
    : lib.triggerInfo(req);
  const entry = {
    timestamp: new Date().toISOString(),
    buyerBadge: badgeChk.badges[0] || null,
    buyerAccount: sender,
    sellerBadge: lib.SELLER_BADGE,
    sellerAccount: process.env.CCD_SELLER_ADDRESS,
    datasetId: id,
    datasetTitle: ds.title,
    amountMicroCCD: lib.PRICE_MICROCCD,
    amountCCD: '1',
    txHash,
    blockHeight,
    triggerIpHash: trigger.ipHash,
    triggerUserAgent: trigger.userAgent,
    badgeCheckVerdict: 'verified',
    ccdexplorerUrl: `https://ccdexplorer.io/testnet/transaction/${txHash}`,
    badgeCheckUrl: `https://agent-registry-mcp.concordium.com/v1/check-badge/${badgeChk.badges[0] || sender}?network=testnet`,
  };
  // The audit entry is the public proof of the trade. If the append fails
  // (KV down/misconfigured) the payment has still settled, so the trade
  // succeeds — but the response must say so honestly instead of silently
  // leaving the log incomplete.
  const auditResult = await lib.appendAudit(entry);
  const auditRecorded = !!(auditResult && auditResult.ok);
  if (!auditRecorded) console.error('audit append failed', auditResult);

  return res.status(200).json({
    dataset: ds,
    payment: { txHash, explorerUrl: entry.ccdexplorerUrl, amountMicroCCD: lib.PRICE_MICROCCD, payer: sender },
    audit: entry,
    auditRecorded,
  });
};
