// POST /api/buy — runs the buyer agent end to end.
// Body: { datasetId }
// 1. GET the dataset (expect 402) with the buyer badge header.
// 2. Check the seller's badge before paying.
// 3. Build + sender-sign the V1 sponsored payment via @x402/concordium.
// 4. Retry with the PAYMENT-SIGNATURE header; return the dataset + tx hash.
const lib = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const datasetId = (req.body && req.body.datasetId) || 'ds-onchain-activity-24h';
  if (!lib.DATASETS[datasetId]) return res.status(400).json({ error: 'unknown dataset', datasetId });

  // The Buy button must stay public (judges click it), so there is no auth —
  // but an uncapped public spend is a drain vector. Cap it per IP (20/hour)
  // AND site-wide (50/day, KV-backed); both are generous for a human and far
  // too slow to drain testnet funds.
  const rl = await lib.rateLimitBuy(req);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'too many buy requests from this address — try again later', rateLimit: { count: rl.count, limit: rl.limit } });
  }
  const rg = await lib.rateLimitBuyGlobal(req);
  if (!rg.allowed) {
    return res.status(429).json({ error: 'daily buy limit for this site reached — try again tomorrow', rateLimit: { count: rg.count, limit: rg.limit, day: rg.day } });
  }

  // Trigger info for the audit log (who/what clicked Buy). Passed to the
  // seller endpoint so the audit entry records it; the raw IP is never
  // stored, only its hash.
  const trigger = lib.triggerInfo(req);

  const steps = [];
  const base = lib.baseUrl(req);
  try {
    // 1. Ask for the dataset -> expect 402.
    const first = await fetch(`${base}/api/data/${datasetId}`, {
      headers: { 'X-Buyer-Badge': lib.BUYER_BADGE },
    });
    steps.push({ step: 'request dataset', status: first.status });
    if (first.status !== 402) {
      const body = await first.text();
      return res.status(502).json({ error: 'expected 402 from seller', status: first.status, body: body.slice(0, 500), steps });
    }
    const offered = await first.json();
    const requirements = (offered.accepts || [])[0];
    if (!requirements) return res.status(502).json({ error: 'no payment requirements in 402', steps });
    steps.push({ step: '402 received', amount: requirements.amount, asset: requirements.asset, payTo: requirements.payTo, feePayer: requirements.extra && requirements.extra.feePayer });

    // 2. Check the seller's badge BEFORE paying.
    const sellerChk = await lib.checkBadgeByToken(lib.SELLER_BADGE);
    steps.push({ step: 'seller badge check', valid: sellerChk.valid, tokenId: sellerChk.tokenId });
    if (!sellerChk.valid) {
      return res.status(403).json({ error: 'seller badge not verified — refusing to pay', issues: sellerChk.issues, steps });
    }

    // 3. Build + sender-sign the V1 sponsored payment.
    const scheme = await lib.getBuyerScheme();
    const built = await scheme.createPaymentPayload(2, requirements);
    const paymentPayload = {
      x402Version: 2,
      accepted: { scheme: 'exact', network: requirements.network },
      payload: built.payload,
    };
    steps.push({ step: 'payment built + signed', sender: built.payload.sender });

    // 4. Retry with PAYMENT-SIGNATURE.
    const paid = await fetch(`${base}/api/data/${datasetId}`, {
      headers: {
        'PAYMENT-SIGNATURE': lib.b64urlEncode(paymentPayload),
        'X-Buyer-Badge': lib.BUYER_BADGE,
        'X-Trigger-Ip-Hash': trigger.ipHash,
        'X-Trigger-User-Agent': trigger.userAgent,
      },
    });
    const paidBody = await paid.json().catch(() => ({}));
    steps.push({ step: 'retry with payment', status: paid.status });
    if (paid.status !== 200) {
      return res.status(paid.status).json({ error: 'seller refused the payment', detail: paidBody, steps });
    }
    return res.status(200).json({
      ok: true,
      datasetId,
      dataset: paidBody.dataset,
      payment: paidBody.payment,
      audit: paidBody.audit,
      auditRecorded: paidBody.auditRecorded,
      steps,
    });
  } catch (e) {
    return res.status(500).json({ error: 'buyer flow failed', detail: String(e.message || e), steps });
  }
};
