// Probe: can this Vercel runtime reach the Concordium testnet gRPC node?
// GET /api/probe -> { grpcOk, nonce, consensus, mcpOk }
module.exports = async (req, res) => {
  const out = { grpcOk: false, nonce: null, consensus: null, mcpOk: false, error: null };
  try {
    const { ConcordiumGRPCNodeClient, credentials } = await import('@concordium/web-sdk/nodejs');
    const { AccountAddress } = await import('@concordium/web-sdk');
    const client = new ConcordiumGRPCNodeClient('grpc.testnet.concordium.com', 20000, credentials.createSsl());
    const nonce = await client.getNextAccountNonce(AccountAddress.fromBase58('3ofDMxgCe2jRH3jcxJ3ZAzWLJqJck6WoXgUcZqcx8Tj5QU2epf'));
    out.nonce = nonce.nonce.toString();
    const nonce2 = await client.getNextAccountNonce(AccountAddress.fromBase58('3TL4w5QnoRFYqyQYPDZ7CxiyqAxRH2Bj2sR69S9t2ehVzpsM9M'));
    const nonce3 = await client.getNextAccountNonce(AccountAddress.fromBase58('3wsSF2qEN3TjfPHeGwLDE5LGXCkrgg4kibMGuaVYJWEDy5jCxE'));
    out.nonces = { buyer: nonce.nonce.toString(), seller: nonce2.nonce.toString(), facilitator: nonce3.nonce.toString() };
    const cp = await client.getCryptographicParameters();
    out.consensus = { hasCommitmentKey: Boolean(cp.value?.onChainCommitmentKey ?? cp.onChainCommitmentKey) };
    out.grpcOk = true;
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  }
  try {
    const r = await fetch('https://agent-registry-mcp.concordium.com/healthz');
    out.mcpOk = r.ok;
  } catch (e) {
    out.mcpOk = false;
  }
  res.status(200).json(out);
};
