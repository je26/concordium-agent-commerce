// Register an agent in the CIS-8004 testnet registry (<12802,0>).
// Usage: node scripts/register-agent.mjs <seller|buyer> <agent_uri> <metadata_hash_hex>
// Signs with the derived testnet key (account-keys.json, 0600) and submits the
// raw transaction via the wallet-proxy submitRawTransaction endpoint.
// NEVER prints signing keys.
import { readFileSync, writeFileSync } from 'node:fs';
import { Transaction } from '@concordium/web-sdk/transactions';
import {
  AccountAddress,
  CcdAmount,
  ContractAddress,
  Energy,
  Parameter,
  ReceiveName,
  SequenceNumber,
  TransactionExpiry,
  buildBasicAccountSigner,
} from '@concordium/web-sdk';

const MCP_URL = 'https://agent-registry-mcp.concordium.com/mcp';
const WALLET_PROXY = 'https://wallet-proxy.testnet.concordium.com';
const PROBE_URL = 'https://concordium-agent-commerce.vercel.app/api/probe';

const [role, agentUri, metadataHashHex] = process.argv.slice(2);
if (!role || !agentUri || !/^[0-9a-f]{64}$/i.test(metadataHashHex || '')) {
  console.error('Usage: node scripts/register-agent.mjs <seller|buyer> <agent_uri> <metadata_hash_hex>');
  process.exit(1);
}

const keys = JSON.parse(readFileSync(new URL('../../concordium-hackathon/wallet-tools/account-keys.json', import.meta.url), 'utf8'));
const acct = keys.accounts.find((a) => a.role === role);
if (!acct) {
  console.error(`No account with role ${role}`);
  process.exit(1);
}
const senderAddress = acct.address;
console.log(`Registering ${role} agent, sender ${senderAddress}`);

// 1. Current nonce from the Vercel probe (queries the testnet node).
const probe = await (await fetch(PROBE_URL)).json();
if (!probe.grpcOk) throw new Error('probe: gRPC not reachable from Vercel');
const nonce = BigInt(probe.nonces[role]);
console.log(`Current nonce for ${role}: ${nonce}`);

// 2. MCP build_register -> contract call parameters.
const mcpResp = await fetch(MCP_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'build_register', arguments: { network: 'testnet', sender: senderAddress, agent_uri: agentUri, metadata_hash_hex: metadataHashHex } },
  }),
});
const mcpJson = await mcpResp.json();
if (mcpJson.error) throw new Error('MCP error: ' + JSON.stringify(mcpJson.error));
const build = JSON.parse(mcpJson.result.content[0].text);
console.log('build_register:', JSON.stringify({ contract: build.contract_address, receive: build.receive_name, energy: build.suggested_energy, parameter_hex: build.parameter_hex }));

// 3. Build the V0 Update transaction.
const nowSeconds = Math.floor(Date.now() / 1000);
const tx = Transaction.updateContract({
  amount: CcdAmount.fromMicroCcd(0n),
  address: ContractAddress.create(build.contract_address.index, build.contract_address.subindex),
  receiveName: ReceiveName.fromString(build.receive_name),
  message: Parameter.fromHexString(build.parameter_hex),
}, Energy.create(BigInt(build.suggested_energy)))
  .addMetadata({
    sender: AccountAddress.fromBase58(senderAddress),
    nonce: SequenceNumber.create(nonce),
    expiry: TransactionExpiry.fromEpochSeconds(nowSeconds + 600),
  })
  .build();

// 4. Sign as sender, then finalize (computes total energy) before hashing.
const signer = buildBasicAccountSigner(acct.signingKeyHex);
const signed = await Transaction.sign(tx, signer);
const finalized = Transaction.finalize(signed);
const txHash = Transaction.getAccountTransactionHash(finalized);
console.log('Signed tx hash (local):', txHash);

// 5. Serialize + submit via wallet-proxy.
const bytes = Transaction.serializeBlockItem(finalized);
const sub = await fetch(`${WALLET_PROXY}/v0/submitRawTransaction/`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: Buffer.from(bytes),
});
const subText = await sub.text();
console.log('submit status:', sub.status, subText);
if (!sub.ok) {
  console.error('SUBMISSION REJECTED');
  process.exit(2);
}
const { submissionId } = JSON.parse(subText);
console.log('submissionId:', submissionId);

const out = {
  role,
  sender: senderAddress,
  agent_uri: agentUri,
  metadata_hash_hex: metadataHashHex,
  nonce: nonce.toString(),
  txHash: submissionId,
  localHash: txHash,
  submittedAt: new Date().toISOString(),
  explorerUrl: `https://ccdexplorer.io/testnet/transaction/${submissionId}`,
};
writeFileSync(new URL(`./registration-${role}.json`, import.meta.url), JSON.stringify(out, null, 2));
console.log(`Saved scripts/registration-${role}.json`);
