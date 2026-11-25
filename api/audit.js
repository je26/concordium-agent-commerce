// GET /api/audit — the public append-only audit log of every trade.
// Entries: timestamp, buyerBadge, sellerBadge, datasetId, datasetTitle,
// displayTitle, amountMicroCCD, txHash, blockHeight, badgeCheckVerdict,
// ccdexplorerUrl, badgeCheckUrl.
//
// APPEND-ONLY RULE (2026-11-25, owner order): stored entries are never
// rewritten. datasetId and datasetTitle are served as they were at the time
// of the trade. A newer display name, if any, goes in the separate
// displayTitle field; it never overwrites datasetTitle. Tx hashes,
// timestamps, badges, amounts and block heights are served exactly as stored
// or as read from the chain (see BLOCK_HEIGHTS).
const lib = require('./_lib');

// Nov 2026: the hometown name was removed from all visible titles. This
// mapping only strips that prefix; it does NOT rename the dataset itself.
// The weather dataset kept the name "24h Weather Readings" at the time of
// its trades.
const TITLE_MAP = {
  'Belinyu 24h Weather Readings (synthetic)': '24h Weather Readings (synthetic)',
  'Belinyu Tide Table (synthetic)': 'Tide Table (synthetic)',
  'Belinyu Air Quality Readings (synthetic)': 'Air Quality Readings (synthetic)',
};

// displayTitle shows what was actually bought. The "24h Weather Readings"
// dataset is DIFFERENT data from the current "24h On-Chain Activity"
// dataset — it was retired, not renamed — so its entries must not display
// as on-chain activity. The "(dataset lama)" tag marks the old dataset.
const DISPLAY_TITLE_MAP = {
  '24h Weather Readings (synthetic)': '24h Weather Readings (dataset lama)',
};

// Block heights for the trades recorded before the seller started capturing
// them at settle time. Each height was read from the transaction receipt on
// CCDExplorer (ccdexplorer.io/testnet/transaction/<hash>) on 2026-11-25 —
// NOT calculated from the timestamp. Re-verified 2026-11-25 against the
// explorer: tx 39249bd6… = block 51241702, tx 60f58f78… = block 51244479.
// Concordium testnet has a fixed 2-second block time, so block height tracks
// time closely — that is a property of the chain, not a calculation in this
// code. Stored entries keep blockHeight: null; only the served value is
// filled in here.
const BLOCK_HEIGHTS = {
  '39249bd6cf93de87d63d50296b96412a3f7a0d5ddeec13d9d76078f4819659ec': 51241702,
  '7a491de3652db42cfecb83fa19762cfb7ac455cae1b2bcdff4f4612cd50c68a3': 51241723,
  '51de01b950781c19529f99d8eed4e8d481383494bc0c9c9784e8dab83f77e772': 51241876,
  'b186154e7214204ab67830a9f4ed06cabed5848fc071e84a1df294ac2d97bc47': 51242054,
  'ae8c61874ebafa63f93880adcd24e705534ae5ab689b5429385a41fd17a45854': 51242654,
};

// Entries are stored as UTC ISO timestamps. The site shows them in WIB with
// the zone named, so "01:12" always means 01:12 WIB, never the viewer's zone.
const fmtWIB = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
  timeZone: 'Asia/Jakarta',
});
function displayTime(iso) {
  try { return fmtWIB.format(new Date(iso)) + ' WIB'; } catch { return iso; }
}

module.exports = async (req, res) => {
  const entries = await lib.readAudit();
  const mapped = entries.map((e) => {
    if (!e) return e;
    const out = { ...e };
    if (TITLE_MAP[out.datasetTitle]) out.datasetTitle = TITLE_MAP[out.datasetTitle];
    // datasetId is served exactly as stored (append-only). The two oldest
    // trades keep ds-belinyu-weather-24h; that dataset was retired and
    // replaced by a different one (ds-onchain-activity-24h) — displayTitle
    // shows what was actually bought for those entries.
    out.displayTitle = DISPLAY_TITLE_MAP[out.datasetTitle] || out.datasetTitle;
    // Trigger data (IP hash, user agent) lives in a separate private KV key
    // and is NEVER served here. Strip it defensively in case any stored
    // entry ever carries it.
    delete out.triggerIpHash;
    delete out.triggerUserAgent;
    if (out.blockHeight == null && BLOCK_HEIGHTS[out.txHash] != null) {
      out.blockHeight = BLOCK_HEIGHTS[out.txHash];
    }
    out.timestampDisplay = displayTime(out.timestamp);
    return out;
  });
  res.status(200).json({ count: mapped.length, entries: mapped.slice().reverse() });
};
