/**
 * Checks every transaction and contract on the evidence page against a live
 * RPC. Run with: node scripts/verify-evidence.mjs
 *
 * The evidence page is the one surface where a wrong value is not a typo but
 * a false claim, so it gets checked against the chain rather than reviewed by
 * eye.
 */
import { readFileSync } from 'node:fs';

const RPC = {
  mainnet: 'https://rpc.starknet.lava.build',
  sepolia: 'https://starknet-sepolia-rpc.publicnode.com',
};

async function rpc(network, method, params) {
  const res = await fetch(RPC[network], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) return { error: json.error.message ?? JSON.stringify(json.error) };
  return { result: json.result };
}

/** Pull the literals out of the evidence module without importing TypeScript. */
const src = readFileSync(new URL('../src/lib/evidence.ts', import.meta.url), 'utf8');
const hashes = [...new Set(src.match(/'0x[0-9a-fA-F]{50,}'/g) ?? [])].map((s) => s.slice(1, -1));

// Which network each hash belongs to: read the network argument that follows it.
const rows = [];
for (const hash of hashes) {
  const at = src.indexOf(`'${hash}'`);
  const after = src.slice(at, at + 200);
  const network = /'mainnet'/.test(after.split('\n').slice(0, 3).join('\n')) ? 'mainnet' : 'sepolia';
  rows.push({ hash, network });
}

let failures = 0;

console.log(`Checking ${rows.length} values from src/lib/evidence.ts\n`);

for (const { hash, network } of rows) {
  const asTx = await rpc(network, 'starknet_getTransactionReceipt', [hash]);
  if (asTx.result) {
    const status = asTx.result.execution_status;
    const finality = asTx.result.finality_status;
    const ok = status === 'SUCCEEDED';
    if (!ok) failures++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  tx    ${network.padEnd(7)} ${hash.slice(0, 12)}…  ${status}/${finality}`,
    );
    continue;
  }

  const asClass = await rpc(network, 'starknet_getClassHashAt', ['latest', hash]);
  if (asClass.result) {
    console.log(`PASS  addr  ${network.padEnd(7)} ${hash.slice(0, 12)}…  deployed`);
    continue;
  }

  failures++;
  console.log(
    `FAIL  ?     ${network.padEnd(7)} ${hash.slice(0, 12)}…  not a tx (${asTx.error}) and not a contract (${asClass.error})`,
  );
}

console.log(`\n${failures === 0 ? 'ALL EVIDENCE VERIFIED' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
