// Shared helpers for the Concordium Agent Commerce demo (testnet only).
// No signing keys here — keys live in Vercel env vars (CCD_BUYER_KEY, CCD_FACILITATOR_KEY).
const NETWORK = 'ccd:4221332d34e1694168c2a0c0b3fd0f27';
const PRICE_MICROCCD = '1000000'; // 1 CCD per dataset
const SELLER_BADGE = 'JyP9XhWi7SMJS7WQfCw7V';
const BUYER_BADGE = 'JyP9XicC3TrEGEkFeSqtZ';
const SELLER_TOKEN_ID = 1482;
const BUYER_TOKEN_ID = 1483;
const MCP_BASE = 'https://agent-registry-mcp.concordium.com';
const SITE_URL = 'https://concordium-agent-commerce.vercel.app';

// --- Synthetic datasets (clearly fake data) ---------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onchainRows() {
  const rnd = mulberry32(20261124);
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  // Real Concordium account addresses are 50 base58 chars; generate the same
  // shape (leading '3' + 49 chars) so the synthetic rows look structurally
  // valid. The data is still clearly fake (see the dataset description).
  const addr = () => {
    let s = '3';
    for (let i = 0; i < 49; i++) s += B58[Math.floor(rnd() * B58.length)];
    return s;
  };
  const types = ['transfer', 'contract call', 'token mint'];
  const rows = [];
  const base = Date.UTC(2026, 10, 25, 0, 0, 0);
  for (let h = 0; h < 24; h++) {
    rows.push({
      timestamp: new Date(base + h * 3600 * 1000).toISOString(),
      sender: addr(),
      receiver: addr(),
      amount_ccd: +(0.1 + rnd() * 49.9).toFixed(2),
      type: types[h % 3],
    });
  }
  return rows;
}

function tideRows() {
  const rnd = mulberry32(20261125);
  const rows = [];
  for (let i = 0; i < 4; i++) {
    rows.push({
      event: i % 2 === 0 ? 'high tide' : 'low tide',
      time: `${String(2 + i * 6).padStart(2, '0')}:${i % 2 === 0 ? '14' : '47'}`,
      height_m: +(i % 2 === 0 ? 1.8 + rnd() * 0.3 : 0.4 + rnd() * 0.2).toFixed(2),
    });
  }
  return rows;
}

function airRows() {
  const rnd = mulberry32(20261126);
  const rows = [];
  for (let h = 0; h < 12; h++) {
    rows.push({
      hour: String(h * 2).padStart(2, '0') + ':00',
      pm25_ug_m3: Math.round(12 + rnd() * 18),
      pm10_ug_m3: Math.round(22 + rnd() * 25),
      aqi_category: 'good',
    });
  }
  return rows;
}

const DATASETS = {
  'ds-onchain-activity-24h': {
    id: 'ds-onchain-activity-24h',
    title: '24h On-Chain Activity (synthetic)',
    description: 'Synthetic Concordium testnet transaction records — sender, receiver, amount and type. Clearly fake demo data.',
    rows: onchainRows(),
  },
  'ds-belinyu-tide': {
    id: 'ds-belinyu-tide',
    title: 'Tide Table (synthetic)',
    description: 'Synthetic high/low tide times and heights. Clearly fake demo data.',
    rows: tideRows(),
  },
  'ds-belinyu-air': {
    id: 'ds-belinyu-air',
    title: 'Air Quality Readings (synthetic)',
    description: 'Synthetic PM2.5 / PM10 readings. Clearly fake demo data.',
    rows: airRows(),
  },
};

function paymentRequirements(datasetId) {
  const ds = DATASETS[datasetId];
  const seller = process.env.CCD_SELLER_ADDRESS;
  const facilitator = process.env.CCD_FACILITATOR_ADDRESS;
  if (!seller) throw new Error('missing env var: CCD_SELLER_ADDRESS is not set');
  if (!facilitator) throw new Error('missing env var: CCD_FACILITATOR_ADDRESS is not set');
  return {
    scheme: 'exact',
    network: NETWORK,
    amount: PRICE_MICROCCD,
    asset: 'CCD',
    payTo: seller,
    maxTimeoutSeconds: 300,
    description: `Dataset: ${ds.title} — 1 CCD`,
    mimeType: 'application/json',
    extra: { feePayer: facilitator },
  };
}

// --- Facilitator requirements guard (H1) -------------------------------------
// The public /api/facilitator/settle and /api/facilitator/verify endpoints
// take caller-supplied `requirements`. This demo's facilitator only ever
// settles the seller's own 1 CCD payments, so pin the requirements to the
// server's values and reject anything else. A legitimate x402 client sends
// exactly the requirements from the 402, so this does not break real flows.
function validateFacilitatorRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object') return 'requirements must be an object';
  if (requirements.scheme !== 'exact') return `scheme must be 'exact', got '${requirements.scheme}'`;
  if (requirements.network !== NETWORK) return `network must be '${NETWORK}', got '${requirements.network}'`;
  if (String(requirements.amount) !== PRICE_MICROCCD) return `amount must be '${PRICE_MICROCCD}' (1 CCD), got '${requirements.amount}'`;
  const seller = process.env.CCD_SELLER_ADDRESS;
  if (!seller) return 'server misconfigured: CCD_SELLER_ADDRESS is not set';
  if (requirements.payTo !== seller) return `payTo must be the seller '${seller}', got '${requirements.payTo}'`;
  return null; // valid
}

// --- Base URL for self-calls (L8) -------------------------------------------
// Derive from the incoming request host so `vercel dev` hits the local server
// instead of production. Falls back to the production SITE_URL.
function baseUrl(req) {
  const host = req && req.headers && req.headers.host;
  if (!host) return SITE_URL;
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    || (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

// --- Per-IP rate limit for /api/buy (H2) -------------------------------------
// The demo Buy button must stay public (judges click it), so the endpoint has
// no auth — but an uncapped public spend is a drain vector. Cap it per IP via
// KV: 20 buys per hour. Generous for a human judge, far too slow to drain the
// testnet wallets (20,000 CCD would need 1,000 IPs or 1,000 hours from one IP).
// Fails OPEN when KV is unavailable so a KV outage never bricks the demo;
// the settle-side pinning (H1) still blocks arbitrary payments.
async function rateLimitBuy(req, limit = 20, windowSeconds = 3600) {
  const { url, token } = kv();
  if (!url || !token) return { allowed: true, reason: 'kv not configured (fail open)' };
  const ip = ((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim()
    || (req.headers && req.headers['x-real-ip']) || 'unknown';
  const key = `ccd-ratelimit:buy:${ip}`;
  try {
    const r = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { allowed: true, reason: 'kv incr failed (fail open)' };
    const j = await r.json();
    const count = j.result;
    if (count === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    return { allowed: count <= limit, count, limit };
  } catch (e) {
    return { allowed: true, reason: `kv error (fail open): ${e.message || e}` };
  }
}

// --- Badge checks (via the hosted Agent Registry MCP REST API) ---------------
async function checkBadgeByAccount(account) {
  const r = await fetch(`${MCP_BASE}/v1/check-badge/${account}?network=testnet`);
  if (!r.ok) return { valid: false, error: `mcp http ${r.status}` };
  const j = await r.json();
  const agents = j.agents || [];
  // Account-lookup entries carry validity as badge_valid and status nested
  // under on_chain.status (there is no top-level `status` field).
  const valid = agents.filter((a) => a && (a.badge_valid === true || (a.on_chain && a.on_chain.status === 'Active')));
  return { valid: valid.length > 0, agentCount: j.agent_count || agents.length, badges: valid.map((a) => a.token_address || null).filter(Boolean), raw: j };
}

async function checkBadgeByToken(badge) {
  const r = await fetch(`${MCP_BASE}/v1/check-badge/${badge}?network=testnet`);
  if (!r.ok) return { valid: false, error: `mcp http ${r.status}` };
  const j = await r.json();
  return { valid: j.badge_valid === true, tokenId: j.token_id, checks: j.checks, issues: j.issues || [], raw: j };
}

// --- Upstash KV (audit log) --------------------------------------------------
function kv() {
  const url = process.env.KV_REST_API_URL || '';
  const token = process.env.KV_REST_API_TOKEN || '';
  return { url, token };
}

async function kvRpush(key, value) {
  const { url, token } = kv();
  if (!url || !token) return { ok: false, error: 'kv not configured' };
  const r = await fetch(`${url}/rpush/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: r.ok, status: r.status };
}

async function kvLrange(key, start, stop) {
  const { url, token } = kv();
  if (!url || !token) return [];
  const r = await fetch(`${url}/lrange/${encodeURIComponent(key)}/${start}/${stop}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.result || [];
}

async function appendAudit(entry) {
  return kvRpush('ccd-audit:trades', JSON.stringify(entry));
}

async function readAudit() {
  const rows = await kvLrange('ccd-audit:trades', 0, -1);
  return rows.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

// --- Facilitator + buyer schemes (lazy, ESM dynamic import) ------------------
async function getFacilitatorScheme() {
  const { ExactConcordiumScheme } = await import('@x402/concordium/exact/facilitator');
  const { toConcordiumFacilitatorSigner, getConcordiumGrpcUrl, parseGrpcUrl, CONCORDIUM_TESTNET_CAIP2 } = await import('@x402/concordium');
  const [host, port] = parseGrpcUrl(getConcordiumGrpcUrl(CONCORDIUM_TESTNET_CAIP2));
  const signer = toConcordiumFacilitatorSigner(
    process.env.CCD_FACILITATOR_ADDRESS,
    process.env.CCD_FACILITATOR_KEY,
    { host, port, useTls: true },
  );
  return new ExactConcordiumScheme({ signer, requireFinalization: true, finalizationTimeoutMs: 60000, maxExpiryOffsetSeconds: 600 });
}

async function getBuyerScheme() {
  const { ExactConcordiumScheme } = await import('@x402/concordium/exact/client');
  const { buildBasicAccountSigner, AccountAddress } = await import('@concordium/web-sdk');
  const signer = {
    accountAddress: AccountAddress.fromBase58(process.env.CCD_BUYER_ADDRESS),
    signer: buildBasicAccountSigner(process.env.CCD_BUYER_KEY),
  };
  return new ExactConcordiumScheme(signer);
}

// --- Transaction -> block height (via the testnet gRPC node) ------------------
// Used after a trade settles so the audit entry carries the real block height
// instead of null. Returns null when the node cannot answer (caller keeps the
// trade and records null rather than failing a completed payment).
async function getTxBlockHeight(txHash) {
  const { ConcordiumGRPCNodeClient, credentials } = await import('@concordium/web-sdk/nodejs');
  const { TransactionHash } = await import('@concordium/web-sdk');
  // The SDK exposes no close/shutdown method on the client, and Vercel
  // functions are short-lived, so the client is intentionally left to be
  // reclaimed with the function instance.
  const client = new ConcordiumGRPCNodeClient('grpc.testnet.concordium.com', 20000, credentials.createSsl());
  const status = await client.getBlockItemStatus(TransactionHash.fromHexString(txHash));
  const blockHash = status.status === 'finalized'
    ? (status.outcome && status.outcome.blockHash)
    : (status.outcomes && status.outcomes[0] ? status.outcomes[0].blockHash : null);
  if (!blockHash) return null;
  const info = await client.getBlockInfo(blockHash);
  return info && info.blockHeight != null ? Number(info.blockHeight) : null;
}

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function b64urlDecode(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

module.exports = {
  NETWORK, PRICE_MICROCCD, SELLER_BADGE, BUYER_BADGE, SELLER_TOKEN_ID, BUYER_TOKEN_ID,
  MCP_BASE, SITE_URL, DATASETS, paymentRequirements,
  validateFacilitatorRequirements, baseUrl, rateLimitBuy,
  checkBadgeByAccount, checkBadgeByToken,
  appendAudit, readAudit,
  getFacilitatorScheme, getBuyerScheme,
  getTxBlockHeight,
  b64urlEncode, b64urlDecode,
};
