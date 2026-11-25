// POST /api/facilitator/verify — x402 facilitator verify endpoint.
// Body: { payload, requirements } -> { isValid, payer, invalidReason, invalidMessage }
const lib = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { payload, requirements } = req.body || {};
  if (!payload || !requirements) return res.status(400).json({ error: 'payload and requirements required' });
  // Same pinning as settle: only the seller's own 1 CCD requirements are
  // verifiable here, so the endpoint cannot be used as a free oracle to tune
  // a payload for another payee or amount.
  const bad = lib.validateFacilitatorRequirements(requirements);
  if (bad) return res.status(400).json({ error: 'requirements rejected', detail: bad });
  try {
    const scheme = await lib.getFacilitatorScheme();
    const result = await scheme.verify(payload, requirements);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'verify failed', detail: String(e.message || e) });
  }
};
