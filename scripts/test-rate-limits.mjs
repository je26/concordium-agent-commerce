// Tests the /api/buy rate limits + trigger helpers against the real Upstash KV.
// SAFETY: every counter uses the TEST prefix 'ccd-test:' — production keys
// (ccd-ratelimit:*) are never touched. Test keys are deleted at the end.
// Usage: KV_REST_API_URL + KV_REST_API_TOKEN must be set (e.g. via
// `vercel env pull .env.local` then `node --env-file=.env.local
// scripts/test-rate-limits.mjs`). NEVER prints secrets or raw IPs.
import crypto from 'crypto';

const lib = await import('../api/_lib.js');
const TEST_PREFIX = 'ccd-test:';
const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
if (!url || !token) { console.error('KV_REST_API_URL / KV_REST_API_TOKEN not set'); process.exit(1); }
const headers = { Authorization: `Bearer ${token}` };
const day = new Date().toISOString().slice(0, 10);
let failures = 0;
function check(name, ok) { console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`); if (!ok) failures++; }

async function kvDel(key) {
  await fetch(`${url}/del/${encodeURIComponent(key)}`, { headers });
}

// 1. triggerInfo with a dummy secret -> must equal an independently computed HMAC.
process.env.CCD_TRIGGER_HMAC_SECRET = 'dummy-test-secret-do-not-use-in-prod';
const ip = '203.0.113.99';
const t = lib.triggerInfo({ headers: { 'x-forwarded-for': ip, 'user-agent': 'TestAgent/1.0' } });
const expectedHmac = crypto.createHmac('sha256', 'dummy-test-secret-do-not-use-in-prod').update(ip).digest('hex').slice(0, 16);
check('HMAC trigger hash matches independent HMAC', t.ipHash === expectedHmac);
check('raw IP not in trigger record', !JSON.stringify(t).includes(ip));

// 2. Fallback without a secret -> plain SHA-256.
delete process.env.CCD_TRIGGER_HMAC_SECRET;
const t2 = lib.triggerInfo({ headers: { 'x-forwarded-for': ip, 'user-agent': 'TestAgent/1.0' } });
const expectedPlain = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
check('fallback (no secret) matches plain SHA-256', t2.ipHash === expectedPlain);

// 3. Per-IP limit, default 4/hour, TEST prefix: 5 calls -> allow x4, deny 5th.
const testIp = '203.0.113.100';
await kvDel(`${TEST_PREFIX}buy:${testIp}`);
const perIp = [];
for (let i = 0; i < 5; i++) perIp.push(await lib.rateLimitBuy({ headers: { 'x-forwarded-for': testIp, 'user-agent': 'TestAgent/1.0' } }, 4, 3600, TEST_PREFIX));
check('per-IP allows first 4', perIp.slice(0, 4).every((r) => r.allowed));
check('per-IP denies 5th (limit 4)', perIp[4].allowed === false && perIp[4].count === 5 && perIp[4].limit === 4);

// 4. Global daily limit, TEST prefix, limit 2: 3 calls -> allow, allow, deny.
await kvDel(`${TEST_PREFIX}buy:global:${day}`);
const glob = [];
for (let i = 0; i < 3; i++) glob.push(await lib.rateLimitBuyGlobal({ headers: {} }, 2, TEST_PREFIX));
check('global allows first 2', glob.slice(0, 2).every((r) => r.allowed));
check('global denies 3rd (limit 2)', glob[2].allowed === false && glob[2].count === 3);

// 5. storeTriggerRecord writes to the private KV key and reads back.
const st = await lib.storeTriggerRecord('test-tx-hash-0001', { ipHash: 'aabbccddeeff0011', userAgent: 'TestAgent/1.0' });
check('storeTriggerRecord ok', st.ok === true);
const gr = await fetch(`${url}/get/${encodeURIComponent('ccd-audit:trigger:test-tx-hash-0001')}`, { headers });
const gj = await gr.json();
check('private trigger record reads back', gj.result && JSON.parse(gj.result).ipHash === 'aabbccddeeff0011');

// 6. Confirm production keys were NOT touched by this test.
const prodGlobal = await (await fetch(`${url}/get/${encodeURIComponent(`ccd-ratelimit:buy:global:${day}`)}`, { headers })).json();
console.log(`production global counter today (${day}):`, prodGlobal.result, '(untouched by this test — test used ccd-test: prefix)');

// Cleanup all test keys.
await kvDel(`${TEST_PREFIX}buy:${testIp}`);
await kvDel(`${TEST_PREFIX}buy:global:${day}`);
await fetch(`${url}/del/${encodeURIComponent('ccd-audit:trigger:test-tx-hash-0001')}`, { headers });
console.log(failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
