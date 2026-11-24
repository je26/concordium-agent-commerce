// GET /api/test/failures — proves the checks are real, not theatre.
// Runs three negative cases against the live seller + facilitator:
//  1. wrong-amount: payment of 0.5 CCD instead of 1 CCD -> facilitator rejects.
//  2. unknown-badge: fake X-Buyer-Badge header -> seller refuses before any 402.
//  3. unregistered-sender: payment signed by the facilitator account (a valid
//     signer with NO agent registration) -> seller refuses before settling.
//  4. expired: payment whose expiry passed before submission -> rejected.
// None of these settles a transaction, so no gas is burned.
const lib = require('../_lib');

async function buildPayment(requirements, signerAddress, signerKey) {
  const { ExactConcordiumScheme } = await import('@x402/concordium/exact/client');
  const { buildBasicAccountSigner, AccountAddress } = await import('@concordium/web-sdk');
  const scheme = new ExactConcordiumScheme({
    accountAddress: AccountAddress.fromBase58(signerAddress),
    signer: buildBasicAccountSigner(signerKey),
  });
  const built = await scheme.createPaymentPayload(2, requirements);
  return {
    x402Version: 2,
    accepted: { scheme: 'exact', network: requirements.network },
    payload: built.payload,
  };
}

module.exports = async (req, res) => {
  const base = lib.SITE_URL;
  const results = {};

  // 1. Wrong amount ------------------------------------------------------------
  try {
    const first = await fetch(`${base}/api/data/ds-belinyu-air`, { headers: { 'X-Buyer-Badge': lib.BUYER_BADGE } });
    const offered = await first.json();
    const reqs = (offered.accepts || [])[0];
    const tampered = { ...reqs, amount: '500000' };
    const payment = await buildPayment(tampered, process.env.CCD_BUYER_ADDRESS, process.env.CCD_BUYER_KEY);
    const r = await fetch(`${base}/api/data/ds-belinyu-air`, {
      headers: { 'PAYMENT-SIGNATURE': lib.b64urlEncode(payment), 'X-Buyer-Badge': lib.BUYER_BADGE },
    });
    const body = await r.json().catch(() => ({}));
    results.wrongAmount = { httpStatus: r.status, expected: '402 amount_mismatch, no settlement', got: body.invalidReason || body.error || body, pass: r.status === 402 && /amount/i.test(String(body.invalidReason || body.error || '')) };
  } catch (e) {
    results.wrongAmount = { pass: false, error: String(e.message || e) };
  }

  // 2. Unknown badge (pre-check) ----------------------------------------------
  try {
    const r = await fetch(`${base}/api/data/ds-belinyu-air`, { headers: { 'X-Buyer-Badge': 'JyP9XhWi7SMJS7WQfCw7V'.replace('W', 'X') } });
    const body = await r.json().catch(() => ({}));
    results.unknownBadge = { httpStatus: r.status, expected: '403 buyer badge not verified', got: body.error || body, pass: r.status === 403 };
  } catch (e) {
    results.unknownBadge = { pass: false, error: String(e.message || e) };
  }

  // 3. Unregistered sender ------------------------------------------------------
  try {
    const first = await fetch(`${base}/api/data/ds-belinyu-air`, { headers: { 'X-Buyer-Badge': lib.BUYER_BADGE } });
    const offered = await first.json();
    const reqs = (offered.accepts || [])[0];
    const payment = await buildPayment(reqs, process.env.CCD_FACILITATOR_ADDRESS, process.env.CCD_FACILITATOR_KEY);
    const r = await fetch(`${base}/api/data/ds-belinyu-air`, {
      headers: { 'PAYMENT-SIGNATURE': lib.b64urlEncode(payment), 'X-Buyer-Badge': lib.BUYER_BADGE },
    });
    const body = await r.json().catch(() => ({}));
    results.unregisteredSender = { httpStatus: r.status, expected: '403 buyer badge not verified', got: body.error || body, pass: r.status === 403 && /badge/i.test(String(body.error || '')) };
  } catch (e) {
    results.unregisteredSender = { pass: false, error: String(e.message || e) };
  }

  // 4. Expired payload ----------------------------------------------------------
  try {
    const first = await fetch(`${base}/api/data/ds-belinyu-air`, { headers: { 'X-Buyer-Badge': lib.BUYER_BADGE } });
    const offered = await first.json();
    const reqs = { ...(offered.accepts || [])[0], maxTimeoutSeconds: 6 };
    const payment = await buildPayment(reqs, process.env.CCD_BUYER_ADDRESS, process.env.CCD_BUYER_KEY);
    await new Promise((r) => setTimeout(r, 3000)); // let the 1s expiry pass
    const r = await fetch(`${base}/api/data/ds-belinyu-air`, {
      headers: { 'PAYMENT-SIGNATURE': lib.b64urlEncode(payment), 'X-Buyer-Badge': lib.BUYER_BADGE },
    });
    const body = await r.json().catch(() => ({}));
    results.expired = { httpStatus: r.status, expected: '402 transaction_expired', got: body.invalidReason || body.error || body, pass: r.status === 402 && /expir/i.test(String(body.invalidReason || body.error || '')) };
  } catch (e) {
    results.expired = { pass: false, error: String(e.message || e) };
  }

  const allPass = Object.values(results).every((x) => x.pass === true);
  res.status(200).json({ allPass, results });
};
