// GET /api/catalog — list the seller's datasets and prices.
const { DATASETS, PRICE_MICROCCD, NETWORK } = require('./_lib');

module.exports = (req, res) => {
  const datasets = Object.values(DATASETS).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    priceMicroCCD: PRICE_MICROCCD,
    priceCCD: '1',
    network: NETWORK,
    rows: d.rows.length,
  }));
  res.status(200).json({ seller: 'Web3 Data Seller', network: NETWORK, datasets });
};
