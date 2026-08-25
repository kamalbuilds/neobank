#!/usr/bin/env node
/* check-submission.mjs
 *
 * Validates strk20.json against hackathon requirements.
 *
 * The sprint requires at least 3 qualifying pool transactions.
 * One transaction (tx #3, 0x02cbf...) does NOT emit a STRK20 pool event,
 * so it does not count toward the qualifying total.
 * qualifying = total - known_nonpool_hashes count.
 *
 * Exit 1 if qualifying pool txs < 3 OR contracts empty OR demo_url missing.
 * Exit 0 otherwise.
 */

import { readFile } from "node:fs/promises";

const STRK20_PATH = new URL("../strk20.json", import.meta.url);

const KNOWN_NONPOOL_HASHES = [
  "0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735",
];

async function main() {
  let raw;
  try {
    raw = await readFile(STRK20_PATH, "utf8");
  } catch (err) {
    console.error(`ERROR: cannot read ${STRK20_PATH}`);
    process.exit(1);
  }

  let strk20;
  try {
    strk20 = JSON.parse(raw);
  } catch (err) {
    console.error("ERROR: strk20.json is not valid JSON");
    process.exit(1);
  }

  const transactions = Array.isArray(strk20.transactions) ? strk20.transactions : [];
  const contracts = Array.isArray(strk20.contracts) ? strk20.contracts : [];
  const demoUrl = strk20.demo_url || "";

  // --- Validate transactions ---
  let txPass = true;
  let txCount = 0;
  if (!Array.isArray(transactions) || transactions.length < 3) {
    txPass = false;
    txCount = transactions.length;
  } else {
    txCount = transactions.length;
    const allValidHex = transactions.every(
      (t) => typeof t === "string" && /^0x[0-9a-fA-F]+$/.test(t),
    );
    if (!allValidHex) {
      txPass = false;
    }
  }

  // --- Validate contracts ---
    const contractsPass = contracts.length >= 1;

  // --- Validate demo_url ---
    const demoUrlPass =
      typeof demoUrl === "string" &&
      demoUrl.trim() !== "" &&
      demoUrl.startsWith("https://");

  // --- Count qualifying pool transactions ---
  const nonpoolCount = KNOWN_NONPOOL_HASHES.filter((h) =>
    transactions.includes(h),
  ).length;
  const qualifyingPoolTxs = transactions.length - nonpoolCount;

  // --- Print table ---
  console.log("STRK20 Hackathon Submission Check");
  console.log("==================================\n");

  console.log("Transactions:");
  console.log(`  PASS  : transactions array has >= 3 valid 0x hashes`);
  console.log(`  FAIL  : transactions array missing or < 3 invalid hashes`);
  console.log(`  Value : ${txCount} valid 0x transaction${txCount !== 1 ? "s" : ""}`);
  console.log("");

  console.log("Contracts:");
  console.log(`  ${contractsPass ? "PASS" : "FAIL"}  : contracts array has at least 1 entry`);
  console.log(`  Value : ${contracts.length} contract${contracts.length !== 1 ? "s" : ""}`);
  console.log("");

  console.log("Demo URL:");
  console.log(`  PASS  : demo_url is a non-empty https URL`);
  console.log(`  FAIL  : demo_url is missing or not a valid https URL`);
  console.log(`  Value : "${demoUrl}"`);
  console.log("");

  console.log("Qualifying Pool Transactions:");
  console.log(`  Total transactions  : ${txCount}`);
  console.log(`  Known non-pool hashes: ${nonpoolCount}`);
  console.log(`  Qualifying pool txs : ${qualifyingPoolTxs} / ${3}`);
  console.log("");

  // --- Exit logic ---
  const exitCondition =
    qualifyingPoolTxs < 3 || !contractsPass || !demoUrlPass;

  if (exitCondition) {
    console.log("RESULT: FAIL");
    if (qualifyingPoolTxs < 3) {
      console.log(
        `  ${qualifyingPoolTxs} qualifying pool txs: 2/3 - tx ` +
        `${KNOWN_NONPOOL_HASHES.find((h) => transactions.includes(h)) ||
        "0x02cbf..."} emitted NO pool event so the real qualifying count is 2`,
      );
    }
    if (!contractsPass) {
      console.log("  contracts array is empty");
    }
    if (!demoUrlPass) {
      console.log("  demo_url is missing or not a valid https URL");
    }
    process.exit(1);
  } else {
    console.log("RESULT: PASS");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
