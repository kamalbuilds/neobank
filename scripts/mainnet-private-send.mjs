#!/usr/bin/env node
// One STRK20 apply_actions on mainnet from the sncast `sealed-ops` account:
// register its viewing key, shield, send privately to a registered recipient,
// and unshield part of it back to itself. Proofs go through Starkscan's relay.
//
//   node scripts/mainnet-private-send.mjs --simulate
//   node scripts/mainnet-private-send.mjs
//
// Keys are read from .env and the sncast accounts file and never printed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Account, RpcProvider, constants, uint256 } from "starknet";
import {
  IndexerDiscoveryProvider,
  ProvingServiceProofProvider,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";
import { submitProof, waitForProof, newIdempotencyKey } from "../src/server/prover/starkscan.ts";
import { deriveHostedViewingKey } from "../src/server/card/runtime.ts";

const POOL = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
const INDEXER = "https://discovery-service.alpha-mainnet.sw-dev.io";
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const RECIPIENT = "0x071c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d";
const ONE = 10n ** 18n;
const DEPOSIT = 3n * ONE;
const SEND = 1n * ONE;
const UNSHIELD = 1n * ONE;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const accounts = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), ".starknet_accounts/starknet_open_zeppelin_accounts.json"), "utf8"),
);
const ops = accounts["alpha-mainnet"]?.["sealed-ops"];
if (!ops?.deployed) throw new Error("sncast account sealed-ops is missing or not deployed on mainnet");

const simulate = process.argv.includes("--simulate");
const provider = new RpcProvider({ nodeUrl: process.env.MAINNET_RPC });
const account = new Account({ provider, address: ops.address, signer: ops.private_key, cairoVersion: "1" });
const viewingKey = deriveHostedViewingKey(ops.private_key, constants.StarknetChainId.SN_MAIN, POOL);

const proofDir = path.join(root, ".progress/proofs");
fs.mkdirSync(proofDir, { recursive: true });
const prover = new ProvingServiceProofProvider("https://starkscan-relay.invalid", constants.StarknetChainId.SN_MAIN, {
  nodeUrl: process.env.MAINNET_RPC,
  poolAddress: POOL,
});
prover.provingService = {
  async proveTransaction(blockId, transaction) {
    const blockNumber =
      typeof blockId === "number" ? blockId
      : typeof blockId?.block_number === "number" ? blockId.block_number
      : await provider.getBlockNumber();
    const idempotencyKey = newIdempotencyKey();
    const job = await submitProof({ blockNumber, transaction, idempotencyKey });
    console.log(`proof job ${job.jobId} submitted at block ${blockNumber} (${job.status})`);
    const done = await waitForProof(job.jobId, (j) =>
      fs.promises.writeFile(path.join(proofDir, `${j.jobId}.json`), JSON.stringify({ idempotencyKey, ...j })),
    );
    console.log(`proof job ${done.jobId} ${done.status} after ${done.attemptCount} attempt(s)`);
    return done.result;
  },
};

const transfers = createPrivateTransfers({
  account,
  viewingKeyProvider: { getViewingKey: async () => viewingKey },
  provingProvider: prover,
  discoveryProvider: new IndexerDiscoveryProvider(INDEXER, POOL),
  poolContractAddress: POOL,
});

async function strkBalance(address) {
  const r = await provider.callContract({ contractAddress: STRK, entrypoint: "balance_of", calldata: [address] });
  return BigInt(r[0]);
}

async function waitFinal(hash) {
  for (let i = 0; i < 120; i++) {
    const s = await provider.getTransactionStatus(hash).catch(() => null);
    if (s?.finality_status === "ACCEPTED_ON_L2" || s?.finality_status === "ACCEPTED_ON_L1") return s;
    if (s?.finality_status === "REJECTED") throw new Error(`${hash} rejected`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${hash} not final after 10 minutes`);
}

const fee = BigInt((await provider.callContract({ contractAddress: POOL, entrypoint: "get_fee_amount", calldata: [] }))[0]);
const head = await provider.getBlockNumber();
const before = await strkBalance(ops.address);
console.log(`block ${head}, pool fee ${Number(fee) / 1e18} STRK, sealed-ops public ${Number(before) / 1e18} STRK`);

const builder = transfers
  .build({
    autoRegister: true,
    autoSetup: true,
    autoDiscover: { notes: "refresh", channels: "refresh" },
    autoSelectNotes: "all",
    provingBlockId: Math.max(0, head - 10),
  })
  .with(STRK, (t) =>
    t
      .deposit({ amount: DEPOSIT })
      .transfer({ recipient: RECIPIENT, amount: SEND })
      .withdraw({ recipient: ops.address, amount: UNSHIELD }),
  );

if (simulate) {
  const { callAndProof, warnings } = await builder.simulate({ node: provider });
  console.log("simulated call:", callAndProof.call.contractAddress, callAndProof.call.entrypoint);
  console.log("warnings:", warnings.map((w) => String(w.code)).join(", ") || "none");
  process.exit(0);
}

const allowance = BigInt(
  (await provider.callContract({ contractAddress: STRK, entrypoint: "allowance", calldata: [ops.address, POOL] }))[0],
);
if (allowance < fee + DEPOSIT) {
  const amount = uint256.bnToUint256(fee + DEPOSIT);
  const approval = await account.execute({
    contractAddress: STRK,
    entrypoint: "approve",
    calldata: [POOL, amount.low, amount.high],
  });
  await waitFinal(approval.transaction_hash);
  console.log(`approved pool for ${Number(fee + DEPOSIT) / 1e18} STRK: ${approval.transaction_hash}`);
}

const { callAndProof, warnings } = await builder.execute();
console.log("warnings:", warnings.map((w) => String(w.code)).join(", ") || "none");
const submitted = await account.execute(callAndProof.call, {
  tip: 0n,
  ...(callAndProof.proof.proofFacts.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {}),
});
console.log(`apply_actions submitted: ${submitted.transaction_hash}`);
await waitFinal(submitted.transaction_hash);
const receipt = await provider.getTransactionReceipt(submitted.transaction_hash);
if (!receipt.isSuccess()) throw new Error(`apply_actions reverted: ${submitted.transaction_hash}`);

const poolEvents = receipt.events.filter((e) => BigInt(e.from_address) === BigInt(POOL)).length;
const after = await strkBalance(ops.address);
console.log(
  JSON.stringify({
    tx: submitted.transaction_hash,
    block: receipt.block_number,
    execution: receipt.execution_status,
    poolEvents,
    publicDelta: Number(after - before) / 1e18,
  }),
);
