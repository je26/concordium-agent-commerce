// GET /api/audit — the public append-only audit log of every trade.
// Entries: timestamp, buyerBadge, sellerBadge, datasetId, amountMicroCCD,
// txHash, blockHeight, badgeCheckVerdict, ccdexplorerUrl, badgeCheckUrl.
const lib = require('./_lib');

module.exports = async (req, res) => {
  const entries = await lib.readAudit();
  res.status(200).json({ count: entries.length, entries: entries.slice().reverse() });
};
