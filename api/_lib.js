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

function weatherRows() {
  const rnd = mulberry32(20261124);
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const temp = +(26 + Math.sin((h - 6) / 24 * Math.PI * 2) * 3 + rnd() * 0.8).toFixed(1);
    rows.push({
      hour: String(h).padStart(2, '0') + ':00',
      temperature_c: temp,
      humidity_pct: Math.round(72 + Math.cos(h / 24 * Math.PI * 2) * 10 + rnd() * 4),
      wind_kmh: Math.round(8 + rnd() * 14),
      condition: temp > 28 ? 'sunny' : (h % 5 === 0 ? 'light rain' : 'partly cloudy'),
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
  'ds-belinyu-weather-24h': {
    id: 'ds-belinyu-weather-24h',
    title: 'Belinyu 24h Weather Readings (synthetic)',
    description: 'Hourly synthetic temperature, humidity, wind and conditions for Belinyu, Bangka. Clearly fake demo data.',
    rows: weatherRows(),
  },
  'ds-belinyu-tide': {
    id: 'ds-belinyu-tide',
    title: 'Belinyu Tide Table (synthetic)',
    description: 'Synthetic high/low tide times and heights for Belinyu. Clearly fake demo data.',
    rows: tideRows(),
  },
  'ds-belinyu-air': {
    id: 'ds-belinyu-air',
    title: 'Belinyu Air Quality Readings (synthetic)',
    description: 'Synthetic PM2.5 / PM10 readings for Belinyu. Clearly fake demo data.',
    rows: airRows(),
  },
};

function paymentRequirements(datasetId) {
  const ds = DATASETS[datasetId];
  return {
    scheme: 'exact',
    network: NETWORK,
    amount: PRICE_MICROCCD,
    asset: 'CCD',
    payTo: process.env.CCD_SELLER_ADDRESS,
    maxTimeoutSeconds: 300,
    description: `Dataset: ${ds.title} — 1 CCD`,
    mimeType: 'application/json',
    extra: { feePayer: process.env.CCD_FACILITATOR_ADDRESS },
  };
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

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function b64urlDecode(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

module.exports = {
  NETWORK, PRICE_MICROCCD, SELLER_BADGE, BUYER_BADGE, SELLER_TOKEN_ID, BUYER_TOKEN_ID,
  MCP_BASE, SITE_URL, DATASETS, paymentRequirements,
  checkBadgeByAccount, checkBadgeByToken,
  appendAudit, readAudit,
  getFacilitatorScheme, getBuyerScheme,
  b64urlEncode, b64urlDecode,
};
