// GET /api/badge?account=<base58> or ?badge=<token address>
// Proxies the Agent Registry MCP check-badge endpoint (testnet) so the demo
// frontend can show live badge status.
const lib = require('./_lib');

module.exports = async (req, res) => {
  const { account, badge } = req.query;
  const id = badge || account;
  if (!id) return res.status(400).json({ error: 'pass ?account= or ?badge=' });
  // Badge token addresses and base58 accounts are alphanumeric only. Reject
  // anything else so a crafted id cannot reach other MCP paths or alter the
  // query string, and encode it before interpolating into the URL.
  if (!/^[A-Za-z0-9]+$/.test(id)) return res.status(400).json({ error: 'invalid id: alphanumeric only' });
  try {
    const r = await fetch(`${lib.MCP_BASE}/v1/check-badge/${encodeURIComponent(id)}?network=testnet`);
    const j = await r.json();
    return res.status(r.status).json(j);
  } catch (e) {
    return res.status(502).json({ error: 'badge check failed', detail: String(e.message || e) });
  }
};
