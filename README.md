# Agent Commerce on Concordium

Two AI agents buy and sell data from each other on the Concordium testnet, paying per dataset in CCD over **x402**. Both agents are registered in the Concordium Agent Registry with Verified badges, and every trade leaves an on-chain audit trail.

Built for the Encode Club × Concordium hackathon — challenge **“Make your Agents Accountable with Concordium”**.

**Live demo:** https://concordium-agent-commerce.vercel.app

## What it does

- **Buyer agent** (registry token **1483**, badge `JyP9XicC3TrEGEkFeSqtZ`) pays **1 CCD per dataset** to the **seller agent** (registry token **1482**, badge `JyP9XhWi7SMJS7WQfCw7V`) using the x402 `exact` scheme on Concordium testnet (CAIP-2 `ccd:4221332d34e1694168c2a0c0b3fd0f27`).
- A **self-hosted facilitator** (`@x402/concordium` `ExactConcordiumScheme`) verifies the payment against the x402 exact-scheme rules, sponsors the transaction fee (so the buyer pays only for the data), submits the V1 transaction and waits for finalization.
- The **seller checks the buyer's badge before releasing data** — a payment from an unregistered account is refused before settlement. (The badge pre-check runs when the buyer sends the `X-Buyer-Badge` header; without it the seller still refuses an unverified payer at settlement.)
- Every completed trade is appended to a **public audit log** (KV-backed) with timestamp, both badges, dataset, amount, tx hash, badge verdict, CCDExplorer URL and badge-check URL.

**Demo endpoints are intentionally public** (the Buy button needs no login, so judges can click it): `POST /api/buy` is rate-limited per IP (20 buys/hour) and the facilitator only ever settles this seller's own 1 CCD payments — caller-supplied requirements are pinned server-side. All wallets are testnet-only with capped balances.

## Honest note

This runs on the Concordium **testnet**. Testnet identities are issued without verification, so these badges are testnet-grade — they prove the registry and badge machinery works end to end, not a real-world identity check. All datasets are synthetic demo data (on-chain activity, tide, air quality).

## Verified trades (testnet)

| Dataset | Tx hash | Block | Explorer |
|---|---|---|---|
| 24h Weather Readings (synthetic) | `39249bd6cf93de87d63d50296b96412a3f7a0d5ddeec13d9d76078f4819659ec` | 51241702 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/39249bd6cf93de87d63d50296b96412a3f7a0d5ddeec13d9d76078f4819659ec) |
| Tide Table (synthetic) | `7a491de3652db42cfecb83fa19762cfb7ac455cae1b2bcdff4f4612cd50c68a3` | 51241723 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/7a491de3652db42cfecb83fa19762cfb7ac455cae1b2bcdff4f4612cd50c68a3) |
| Air Quality Readings (synthetic) | `51de01b950781c19529f99d8eed4e8d481383494bc0c9c9784e8dab83f77e772` | 51241876 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/51de01b950781c19529f99d8eed4e8d481383494bc0c9c9784e8dab83f77e772) |
| 24h Weather Readings (synthetic) | `b186154e7214204ab67830a9f4ed06cabed5848fc071e84a1df294ac2d97bc47` | 51242054 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/b186154e7214204ab67830a9f4ed06cabed5848fc071e84a1df294ac2d97bc47) |
| 24h On-Chain Activity (synthetic) | `ae8c61874ebafa63f93880adcd24e705534ae5ab689b5429385a41fd17a45854` | 51242654 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/ae8c61874ebafa63f93880adcd24e705534ae5ab689b5429385a41fd17a45854) |
| 24h On-Chain Activity (synthetic) | `60f58f7888a4005f6d669d7e3781eaa38387d7159636fa07a451fb845bd1ee52` | 51244479 | [ccdexplorer.io](https://ccdexplorer.io/testnet/transaction/60f58f7888a4005f6d669d7e3781eaa38387d7159636fa07a451fb845bd1ee52) |

The "24h Weather Readings" dataset was retired in Nov 2026 and replaced by a different dataset, "24h On-Chain Activity"; the two older entries show the dataset that was actually bought (append-only log).

Each is a `Transfer` of exactly **1.000000 CCD** from the buyer account `3ofDMxgCe2jRH3jcxJ3ZAzWLJqJck6WoXgUcZqcx8Tj5QU2epf` to the seller account `3TL4w5QnoRFYqyQYPDZ7CxiyqAxRH2Bj2sR69S9t2ehVzpsM9M`, outcome **success**.

## Negative tests (all pass)

`GET /api/test/failures` runs four cases live against the seller + facilitator:

| Case | Result |
|---|---|
| Wrong amount (0.5 CCD instead of 1) | `402` — `amount_mismatch: required 1000000, got 500000` |
| Unknown buyer badge | `403` — buyer badge not verified |
| Payment signed by an unregistered account | `403` — buyer badge not verified |
| Expired payment | `402` — `transaction_expired` |

## Architecture

```
concordium-agent-commerce/
├── public/
│   ├── index.html            # Elegant demo frontend (agent cards, buy flow, audit log)
│   ├── logo.png              # Project logo
│   └── cards/                # Agent Cards (A2A agent-card.json)
│       ├── seller-agent-card.json   # token 1482, badge JyP9XhWi7SMJS7WQfCw7V
│       └── buyer-agent-card.json    # token 1483, badge JyP9XicC3TrEGEkFeSqtZ
├── api/
│   ├── _lib.js               # Datasets, PaymentRequirements, badge checks, audit log (KV)
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
│   ├── registration-buyer.json / registration-seller.json  # Registration records
│   ├── seturi-buyer.json / seturi-seller.json (+ -v2, -v3) # setAgentURI records
│   ├── card-update-2026-11-25/  # Card content fix: new cards + manifest
│   ├── phase2-results.json   # Phase 2: token IDs, badges, tx hashes
│   └── phase3-results.json   # Phase 3/3.5: trades, failure tests, verification
└── vercel.json               # maxDuration 60 for API functions
```

## Key facts

- Registry: CIS-8004 `<12802,0>`, CIS-8 `<12801,0>` (testnet).
- Facilitator account (fee payer): `3wsSF2qEN3TjfPHeGwLDE5LGXCkrgg4kibMGuaVYJWEDy5jCxE`.
- Seller registration tx: `e00b24c9d3965defde8373ae09891d91169a7b986eaf4df07a52ad9f704b896f` (block 51241421). Buyer registration tx: `2b508750b8b7e85b6581f6b93df4a9c77e52e5ead7d3285b33b33b9c8977975e` (block 51241449).
- The testnet gRPC node is unreachable from some networks; the Vercel deployment reaches it fine, so all chain access runs server-side on Vercel. The `@concordium/web-sdk/nodejs` package is ESM-only — Vercel functions are CommonJS, so the SDK is loaded with dynamic `import()`.

## Run locally

```bash
npm install
# Set env vars (see .env.example — keys are testnet-only, never commit them):
# CCD_BUYER_KEY, CCD_BUYER_ADDRESS, CCD_SELLER_ADDRESS,
# CCD_FACILITATOR_KEY, CCD_FACILITATOR_ADDRESS, KV_REST_API_URL, KV_REST_API_TOKEN
vercel dev
```

## Deploy

```bash
vercel deploy --prod --yes
```
