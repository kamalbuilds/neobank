/**
 * Checks every transaction and contract on the evidence page against a live
 * RPC. Run with: node scripts/verify-evidence.mjs
 *
 * The evidence page is the one surface where a wrong value is not a typo but
 * a false claim, so it gets checked against the chain rather than reviewed by
 * eye.
 */
import { readFileSync, writeFileSync } from 'node:fs';

// rpc.starknet.lava.build answers every call with "This endpoint has been
// discontinued.", which reads as a failed claim rather than a dead endpoint.
// verify-strk20-claim.mjs already moved to this host; this script was missed.
const RPC = {
  mainnet: process.env.STARKNET_RPC || 'https://mainnet.nodes.starknet.org/rpc/v0_10',
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

// The evidence page used to say it was verified against a live RPC without
// saying when, which is the shape a claim takes after it stops being true.
// The run writes its own result, including the block each chain was at, and
// the page renders that instead of an assertion. A failed run overwrites the
// attestation too: a stale green stamp is worse than a red one.
const attestation = {
  ranAt: new Date().toISOString(),
  checked: rows.length,
  passed: rows.length - failures,
  failed: failures,
  blocks: {
    mainnet: (await rpc('mainnet', 'starknet_blockNumber', [])).result ?? null,
    sepolia: (await rpc('sepolia', 'starknet_blockNumber', [])).result ?? null,
  },
  rpc: { mainnet: RPC.mainnet, sepolia: RPC.sepolia },
};

const out = new URL('../src/lib/evidence-verification.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(attestation, null, 2)}\n`);
console.log(
  `wrote src/lib/evidence-verification.json  block ${attestation.blocks.mainnet} mainnet / ${attestation.blocks.sepolia} sepolia`,
);

process.exit(failures === 0 ? 0 : 1);
