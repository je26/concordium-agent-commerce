// GET /api/audit — the public append-only audit log of every trade.
// Entries: timestamp, buyerBadge, sellerBadge, datasetId, amountMicroCCD,
// txHash, blockHeight, badgeCheckVerdict, ccdexplorerUrl, badgeCheckUrl.
const lib = require('./_lib');

// Rename (2026-11-25): the project no longer uses the old hometown name in
// any visible text. Stored entries keep their original datasetTitle (history
// is not rewritten); only the displayed label is mapped here. Tx hashes,
// timestamps, badges and amounts are served exactly as stored.
// The weather dataset was renamed to on-chain activity, so its old titles
// map to the current dataset title (2026-11-25 fix: uniform titles in log).
const TITLE_MAP = {
  'Belinyu 24h Weather Readings (synthetic)': '24h On-Chain Activity (synthetic)',
  '24h Weather Readings (synthetic)': '24h On-Chain Activity (synthetic)',
  'Belinyu Tide Table (synthetic)': 'Tide Table (synthetic)',
  'Belinyu Air Quality Readings (synthetic)': 'Air Quality Readings (synthetic)',
};

// Block heights for the trades that were recorded before the seller started
// capturing them at settle time. Each height was read from CCDExplorer
// (ccdexplorer.io/testnet/transaction/<hash>) on 2026-11-25. Stored entries
// keep blockHeight: null; only the served value is filled in here.
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
    if (out.blockHeight == null && BLOCK_HEIGHTS[out.txHash] != null) {
      out.blockHeight = BLOCK_HEIGHTS[out.txHash];
    }
    out.timestampDisplay = displayTime(out.timestamp);
    return out;
  });
  res.status(200).json({ count: mapped.length, entries: mapped.slice().reverse() });
};
