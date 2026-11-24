// Submit any CIS-8004 contract call as a signed Update transaction.
// Usage: node scripts/submit-call.mjs <role> <receive_name> <parameter_hex> <energy> <label>
// Signs with the derived testnet key and submits via the wallet-proxy.
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

const WALLET_PROXY = 'https://wallet-proxy.testnet.concordium.com';
const PROBE_URL = 'https://concordium-agent-commerce.vercel.app/api/probe';

const [role, receiveName, parameterHex, energyStr, label] = process.argv.slice(2);
if (!role || !receiveName || !/^[0-9a-f]*$/i.test(parameterHex || '') || !energyStr || !label) {
  console.error('Usage: node scripts/submit-call.mjs <role> <receive_name> <parameter_hex> <energy> <label>');
  process.exit(1);
}

const keys = JSON.parse(readFileSync(new URL('../../concordium-hackathon/wallet-tools/account-keys.json', import.meta.url), 'utf8'));
const acct = keys.accounts.find((a) => a.role === role);
if (!acct) {
  console.error(`No account with role ${role}`);
  process.exit(1);
}

const probe = await (await fetch(PROBE_URL)).json();
if (!probe.grpcOk) throw new Error('probe: gRPC not reachable from Vercel');
const nonce = BigInt(probe.nonces[role]);
console.log(`Submitting ${receiveName} for ${role} (${acct.address}), nonce ${nonce}`);

const nowSeconds = Math.floor(Date.now() / 1000);
const tx = Transaction.updateContract({
  amount: CcdAmount.fromMicroCcd(0n),
  address: ContractAddress.create(12802, 0),
  receiveName: ReceiveName.fromString(receiveName),
  message: Parameter.fromHexString(parameterHex),
}, Energy.create(BigInt(energyStr)))
  .addMetadata({
    sender: AccountAddress.fromBase58(acct.address),
    nonce: SequenceNumber.create(nonce),
    expiry: TransactionExpiry.fromEpochSeconds(nowSeconds + 600),
  })
  .build();

const signer = buildBasicAccountSigner(acct.signingKeyHex);
const signed = await Transaction.sign(tx, signer);
const finalized = Transaction.finalize(signed);
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
const out = {
  role, receiveName, parameterHex, nonce: nonce.toString(),
  txHash: submissionId,
  submittedAt: new Date().toISOString(),
  explorerUrl: `https://ccdexplorer.io/testnet/transaction/${submissionId}`,
};
writeFileSync(new URL(`./${label}.json`, import.meta.url), JSON.stringify(out, null, 2));
console.log(`Saved scripts/${label}.json`);
