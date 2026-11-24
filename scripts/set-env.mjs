// Set Vercel production env vars for the Concordium project from account-keys.json.
// Values are read from the 0600 file and POSTed to the Vercel API. NOTHING is printed.
// Usage: node scripts/set-env.mjs
import { readFileSync } from 'node:fs';

const TOKEN = readFileSync('/tmp/vercel_token.txt', 'utf8').trim();
const PROJECT_ID = 'prj_XuoFUe1dXqwDZNtohMNJjjWt8Lab';
const TEAM_ID = 'bambang9';

const keys = JSON.parse(readFileSync(new URL('../../concordium-hackathon/wallet-tools/account-keys.json', import.meta.url), 'utf8'));
const byRole = Object.fromEntries(keys.accounts.map((a) => [a.role, a]));

const vars = {
  CCD_BUYER_KEY: byRole.buyer.signingKeyHex,
  CCD_BUYER_ADDRESS: byRole.buyer.address,
  CCD_SELLER_ADDRESS: byRole.seller.address,
  CCD_FACILITATOR_KEY: byRole.facilitator.signingKeyHex,
  CCD_FACILITATOR_ADDRESS: byRole.facilitator.address,
};

for (const [key, value] of Object.entries(vars)) {
  // Delete any existing var with this key first (Vercel API: DELETE then POST).
  const list = await (await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })).json();
  for (const e of (list.envs || []).filter((x) => x.key === key)) {
    await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${e.id}?teamId=${TEAM_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  }
  const r = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production'] }),
  });
  const j = await r.json();
  console.log(key, '->', r.status, j.error ? JSON.stringify(j.error) : 'ok');
}
console.log('ENV_SET_DONE');
