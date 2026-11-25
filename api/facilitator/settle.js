// POST /api/facilitator/settle — x402 facilitator settle endpoint.
// Body: { payload, requirements } -> { success, transaction, network, errorReason, ... }
// The facilitator re-verifies, adds the sponsor signature, submits to the
// Concordium testnet node and waits for finalization (~10s).
const lib = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { payload, requirements } = req.body || {};
  if (!payload || !requirements) return res.status(400).json({ error: 'payload and requirements required' });
  // This facilitator only settles the seller's own 1 CCD payments. Pin the
  // requirements server-side so a caller cannot redirect the payment or the
  // fee sponsorship to another address or amount.
  const bad = lib.validateFacilitatorRequirements(requirements);
  if (bad) return res.status(400).json({ error: 'requirements rejected', detail: bad });
  try {
    const scheme = await lib.getFacilitatorScheme();
    const result = await scheme.settle(payload, requirements);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'settle failed', detail: String(e.message || e) });
  }
};
