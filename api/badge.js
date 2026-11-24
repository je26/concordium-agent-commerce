// GET /api/badge?account=<base58> or ?badge=<token address>
// Proxies the Agent Registry MCP check-badge endpoint (testnet) so the demo
// frontend can show live badge status.
const lib = require('./_lib');

module.exports = async (req, res) => {
  const { account, badge } = req.query;
  const id = badge || account;
  if (!id) return res.status(400).json({ error: 'pass ?account= or ?badge=' });
  try {
    const r = await fetch(`${lib.MCP_BASE}/v1/check-badge/${id}?network=testnet`);
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e) {
    return res.status(502).json({ error: 'badge check failed', detail: String(e.message || e) });
  }
};
