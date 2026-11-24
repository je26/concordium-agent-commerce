// GET /api/facilitator/supported — what this facilitator sponsors.
const lib = require('../_lib');

module.exports = (req, res) => {
  res.status(200).json({
    scheme: 'exact',
    network: lib.NETWORK,
    feePayer: process.env.CCD_FACILITATOR_ADDRESS,
    facilitator: 'concordium-agent-commerce facilitator (self-hosted, testnet)',
    note: 'The facilitator pays the transaction fee (sponsored V1 transaction) so the buyer never needs CCD for gas — only for the dataset itself.',
  });
};
