// GET /api/audit — the public append-only audit log of every trade.
// Entries: timestamp, buyerBadge, sellerBadge, datasetId, amountMicroCCD,
// txHash, blockHeight, badgeCheckVerdict, ccdexplorerUrl, badgeCheckUrl.
const lib = require('./_lib');

// Rename (2026-11-25): the project no longer uses the old hometown name in
// any visible text. Stored entries keep their original datasetTitle (history
// is not rewritten); only the displayed label is mapped here. Tx hashes,
// timestamps, badges and amounts are served exactly as stored.
const TITLE_MAP = {
  'Belinyu 24h Weather Readings (synthetic)': '24h Weather Readings (synthetic)',
  'Belinyu Tide Table (synthetic)': 'Tide Table (synthetic)',
  'Belinyu Air Quality Readings (synthetic)': 'Air Quality Readings (synthetic)',
};

module.exports = async (req, res) => {
  const entries = await lib.readAudit();
  const mapped = entries.map((e) => (e && TITLE_MAP[e.datasetTitle]
    ? { ...e, datasetTitle: TITLE_MAP[e.datasetTitle] }
    : e));
  res.status(200).json({ count: mapped.length, entries: mapped.slice().reverse() });
};
