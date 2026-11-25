# Agent Commerce on Concordium

Two AI agents — Web3 Data Buyer and Web3 Data Seller — trade datasets for 1 CCD over x402 on Concordium testnet, with badges from the Agent Registry and a public audit log.

Built for the Encode Club × Concordium hackathon, challenge "Make your Agents Accountable with Concordium".

**Live demo:** https://concordium-agent-commerce.vercel.app

**Agent cards:** https://concordium-agent-commerce.vercel.app/cards

**Audit log:** https://concordium-agent-commerce.vercel.app/api/audit

## What is real, what is not

Real, on-chain, and checkable:

- Payments. Each trade moves exactly 1.000000 CCD from the buyer account to the seller account. The tx hash, block number, and outcome are on the Concordium testnet.
- Badges. Both agents are registered in the CIS-8004 Agent Registry (testnet). Their badge IDs and registry tokens are listed below.
- Card hashes. Each agent card's SHA-256 is pinned on-chain through `setAgentURI`. The served card can be re-hashed and compared (see [Verifying a card](#verifying-a-card)).

Not real:

- Datasets are synthetic. Every row comes from a seeded random generator. No row is real chain data, real weather, real tide, or real air data.
- Badges are testnet-grade. Testnet identities are issued without verification, so a badge proves the registry and badge machinery works end to end. It is not a real identity check.

## How a trade works

1. The buyer requests a dataset. The seller answers `402` with payment requirements: 1 CCD, `exact` scheme, Concordium testnet (`ccd:4221332d34e1694168c2a0c0b3fd0f27`).
2. The buyer checks the seller's badge before paying. The seller checks the buyer's badge before settling. An unverified payer is refused.
3. The buyer builds and signs the V1 sponsored payment (`@x402/concordium`).
4. The self-hosted facilitator verifies the payment, settles it, and pays the transaction fee (about 5 CCD per trade; 5.05–5.22 CCD observed). The buyer pays only the 1 CCD for the data.
5. The seller releases the dataset.
6. An audit entry is appended: timestamp, both badges, dataset, amount, tx hash, block height, badge verdict, CCDExplorer URL, badge-check URL.

## Agents

| Agent | Registry token | Badge ID | Account |
|---|---|---|---|
| Web3 Data Buyer | 1483 | `JyP9XicC3TrEGEkFeSqtZ` | `3ofDMxgCe2jRH3jcxJ3ZAzWLJqJck6WoXgUcZqcx8Tj5QU2epf` |
| Web3 Data Seller | 1482 | `JyP9XhWi7SMJS7WQfCw7V` | `3TL4w5QnoRFYqyQYPDZ7CxiyqAxRH2Bj2sR69S9t2ehVzpsM9M` |

Facilitator (pays the transaction fee): `3wsSF2qEN3TjfPHeGwLDE5LGXCkrgg4kibMGuaVYJWEDy5jCxE`.

Registration transactions (testnet): seller `e00b24c9d3965defde8373ae09891d91169a7b986eaf4df07a52ad9f704b896f` (block 51241421), buyer `2b508750b8b7e85b6581f6b93df4a9c77e52e5ead7d3285b33b33b9c8977975e` (block 51241449).

## Datasets in the catalog

| Dataset ID | Title | Rows | Source |
|---|---|---|---|
| `ds-onchain-activity-24h` | 24h On-Chain Activity (synthetic) | 24 | Seeded RNG (mulberry32, seed 20261124). Fake sender, receiver, amount, and type, shaped like testnet transactions. Not real chain data. |
| `ds-belinyu-tide` | Tide Table (synthetic) | 4 | Seeded RNG (mulberry32, seed 20261125). Fake tide times and heights. |
| `ds-belinyu-air` | Air Quality Readings (synthetic) | 12 | Seeded RNG (mulberry32, seed 20261126). Fake PM2.5 / PM10 readings. |

The dataset IDs `ds-belinyu-tide` and `ds-belinyu-air` keep their original IDs. The IDs are internal keys used by the API and the audit log. Their visible titles carry no place name.

### The retired weather dataset

The "24h Weather Readings" dataset (`ds-belinyu-weather-24h`) was retired in Nov 2026 and replaced by a different dataset, `ds-onchain-activity-24h`. It was retired, not renamed: the data is different, and the two older trades bought weather data, not on-chain data. Those two entries stay in the audit log with the old dataset ID because the log is append-only and must not be rewritten. The log shows what was actually bought at the time of each trade. The display title for those entries reads "24h Weather Readings (dataset lama)".

## Verified trades (testnet)

| Dataset | Tx hash | Block | Explorer |
|---|---|---|---|
| 24h Weather Readings (synthetic) | `39249bd6cf93de87d63d50296b96412a3f7a0d5ddeec13d9d76078f4819659ec` | 51241702 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/39249bd6cf93de87d63d50296b96412a3f7a0d5ddeec13d9d76078f4819659ec) |
| Tide Table (synthetic) | `7a491de3652db42cfecb83fa19762cfb7ac455cae1b2bcdff4f4612cd50c68a3` | 51241723 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/7a491de3652db42cfecb83fa19762cfb7ac455cae1b2bcdff4f4612cd50c68a3) |
| Air Quality Readings (synthetic) | `51de01b950781c19529f99d8eed4e8d481383494bc0c9c9784e8dab83f77e772` | 51241876 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/51de01b950781c19529f99d8eed4e8d481383494bc0c9c9784e8dab83f77e772) |
| 24h Weather Readings (synthetic) | `b186154e7214204ab67830a9f4ed06cabed5848fc071e84a1df294ac2d97bc47` | 51242054 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/b186154e7214204ab67830a9f4ed06cabed5848fc071e84a1df294ac2d97bc47) |
| 24h On-Chain Activity (synthetic) | `ae8c61874ebafa63f93880adcd24e705534ae5ab689b5429385a41fd17a45854` | 51242654 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/ae8c61874ebafa63f93880adcd24e705534ae5ab689b5429385a41fd17a45854) |
| 24h On-Chain Activity (synthetic) | `60f58f7888a4005f6d669d7e3781eaa38387d7159636fa07a451fb845bd1ee52` | 51244479 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/60f58f7888a4005f6d669d7e3781eaa38387d7159636fa07a451fb845bd1ee52) |
| 24h On-Chain Activity (synthetic) | `b041d701607258934b1c23097cbebdb34fac3666ed1b7b7447706a5d7fd4fd1e` | 51258849 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/b041d701607258934b1c23097cbebdb34fac3666ed1b7b7447706a5d7fd4fd1e) |

Each is a `transfer` of exactly 1.000000 CCD from the buyer account to the seller account, outcome `success`.

## Verifying a card

1. Fetch the card JSON: `/cards/buyer-agent-card.json` or `/cards/seller-agent-card.json`.
2. Compute SHA-256 over the exact bytes:
   ```bash
   curl -s https://concordium-agent-commerce.vercel.app/cards/buyer-agent-card.json | sha256sum
   ```
3. Compare with the on-chain `metadata_hash` through the "Verify card hash" link on the site (or on `/cards`). It calls `https://agent-registry-mcp.concordium.com/v1/verify-agent-card/<badge-id>?network=testnet` and reports whether the served card matches the hash pinned on-chain. A match means the card is the registered one.

Current hashes (recomputed from the served files on 2026-11-25):

- Buyer card: `dbeff9a3131199512776e6f7144e92103c77e91a8307ed7c9baed7b287fa9ded`
- Seller card: `aff3dee1fa154884ab195fb2e149dc0dadb265f7c3a6a6e6f21b4d3afce5cb14`

The card JSON files are never edited after their hash is pinned. Any change to a card changes its hash and breaks the on-chain match.

## Negative tests

`GET /api/test/failures` runs four cases live against the seller and facilitator:

| Case | Result |
|---|---|
| Wrong amount (0.5 CCD instead of 1) | `402` — `amount_mismatch: required 1000000, got 500000` |
| Unknown buyer badge | `403` — buyer badge not verified |
| Payment signed by an unregistered account | `403` — buyer badge not verified |
| Expired payment | `402` — `transaction_expired` |

## Abuse limits

The Buy button is public (no login), so `/api/buy` is rate-limited in KV:

- 4 buys per hour per IP.
- 50 buys per day across all callers.

Both limits fail open when KV is unavailable, so a KV outage never bricks the demo. The settle-side pinning still blocks arbitrary payments: the facilitator only settles this seller's own 1 CCD payments.

Trigger notes are not in the public log. For each trade, the HMAC'd IP hash and user agent are stored under a separate private KV key (`ccd-audit:trigger:<txHash>`). They are never served by `/api/audit`. The public entry carries no IP data.

## Architecture

```
concordium-agent-commerce/
├── public/
│   ├── index.html            # Demo frontend (agent cards, buy flow, audit log)
│   ├── logo.png              # Project logo
│   └── cards/                # Agent Cards (A2A agent-card.json)
│       ├── seller-agent-card.json   # token 1482, badge JyP9XhWi7SMJS7WQfCw7V
│       └── buyer-agent-card.json    # token 1483, badge JyP9XicC3TrEGEkFeSqtZ
├── api/
│   ├── _lib.js               # Datasets, payment requirements, badge checks, audit log (KV)
│   ├── catalog.js            # GET /api/catalog
│   ├── data/[id].js          # GET /api/data/:id — seller: 402 + badge-gated release + audit
│   ├── facilitator/
│   │   ├── verify.js         # POST /api/facilitator/verify
│   │   ├── settle.js         # POST /api/facilitator/settle
│   │   └── supported.js      # GET /api/facilitator/supported
│   ├── buy.js                # POST /api/buy — full buyer flow (402 → sign → pay → data)
│   ├── audit.js              # GET /api/audit — public audit log
│   ├── badge.js              # GET /api/badge — live registry badge proxy
│   ├── probe.js              # GET /api/probe — gRPC/MCP reachability
│   └── test/failures.js      # GET /api/test/failures — negative-case proof
├── scripts/
│   ├── register-agent.mjs    # Registry registration (MCP build_register → wallet-proxy submit)
│   ├── submit-call.mjs       # Generic contract-call submitter (setAgentURI)
│   ├── set-env.mjs           # Vercel env-var helper
│   ├── test-rate-limits.mjs  # Rate-limit + trigger tests against real KV (test prefix only)
│   ├── registration-buyer.json / registration-seller.json  # Registration records
│   ├── seturi-buyer.json / seturi-seller.json (+ -v2, -v3) # setAgentURI records
│   ├── card-update-2026-11-25/  # Card content fix: new cards + manifest
│   ├── phase2-results.json   # Phase 2: token IDs, badges, tx hashes
│   └── phase3-results.json   # Phase 3/3.5: trades, failure tests, verification
└── vercel.json               # maxDuration 60 for API functions
```

Registry: CIS-8004 `<12802,0>`, CIS-8 `<12801,0>` (testnet).

## Run locally

Prerequisites: Node.js 18+, Vercel CLI, a Concordium testnet identity with three accounts (buyer, seller, facilitator), and an Upstash KV store.

```bash
npm install
# Set env vars (see .env.example — testnet keys only, never commit values).
vercel dev
```

### Environment variables

| Variable | Function |
|---|---|
| `CCD_BUYER_KEY` | Buyer account signing key (testnet only). |
| `CCD_BUYER_ADDRESS` | Buyer Concordium account address. |
| `CCD_SELLER_ADDRESS` | Seller Concordium account address. |
| `CCD_FACILITATOR_KEY` | Facilitator signing key (pays transaction fees). |
| `CCD_FACILITATOR_ADDRESS` | Facilitator Concordium account address. |
| `KV_REST_API_URL` | Upstash KV REST URL. |
| `KV_REST_API_TOKEN` | Upstash KV REST token. |
| `KV_URL` | Upstash KV URL (Vercel integration). |
| `REDIS_URL` | Upstash Redis URL (Vercel integration). |
| `CCD_TRIGGER_HMAC_SECRET` | Secret for the HMAC of trigger IP hashes. Without it, trigger hashes fall back to plain SHA-256 (local dev only). |

No seller signing key is stored on the server. The demo never signs as the seller; the seller key was only used once, for registration and `setAgentURI`.

Deploy:

```bash
vercel deploy --prod --yes
```

## Limitations

- Testnet only. No mainnet code path.
- Datasets are synthetic. Nothing here is real data.
- Block heights for the five oldest trades are filled from a static map in `api/audit.js` (`BLOCK_HEIGHTS`), read from CCDExplorer on 2026-11-25. They are not a live lookup. Newer trades capture the height at settle time through the gRPC node.
- The testnet gRPC node is unreachable from some networks. All chain access runs server-side on Vercel, which reaches it.
- `@concordium/web-sdk/nodejs` is ESM-only. Vercel functions are CommonJS, so the SDK loads with dynamic `import()`.

## License and credits

MIT License — see [LICENSE](LICENSE).

Built for the Encode Club × Concordium hackathon, challenge "Make your Agents Accountable with Concordium".

Uses [`@x402/concordium`](https://www.npmjs.com/package/@x402/concordium) and [`@concordium/web-sdk`](https://www.npmjs.com/package/@concordium/web-sdk). Agent Registry: Concordium CIS-8004 / CIS-8. Explorer: [CCDExplorer](https://ccdexplorer.io/testnet).
