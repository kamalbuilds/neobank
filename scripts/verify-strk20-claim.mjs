#!/usr/bin/env node
/* verify-strk20-claim.mjs
 *
 * Checks a STRK20 Private Sprint submission the way the judging panel will.
 *
 * The sprint requires at least three mainnet transaction hashes in strk20.json,
 * and each one has to exist, have succeeded, and have touched the STRK20 pool.
 * That last clause is the one that bites: a DEPLOY_ACCOUNT transaction exists
 * and succeeds, so it looks fine in a block explorer, but it emits no pool
 * event and does not count. This repo shipped exactly that mistake, which is
 * why the tool exists.
 *
 *   node scripts/verify-strk20-claim.mjs                  # ./strk20.json
 *   node scripts/verify-strk20-claim.mjs path/to/file     # a local file
 *   node scripts/verify-strk20-claim.mjs --repo owner/name # any sprint entry
 *   node scripts/verify-strk20-claim.mjs --json           # machine readable
 *
 * Exit code is 0 only when the submission would actually be scoreable.
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const NETWORKS = {
  mainnet: {
    pool: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
    rpc: process.env.STARKNET_RPC || "https://rpc.starknet.lava.build",
  },
  sepolia: {
    pool: "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91",
    rpc: "https://starknet-sepolia-rpc.publicnode.com",
  },
};
const MIN_QUALIFYING = 3;
const TIMEOUT_MS = 20_000;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
    network: { type: "string", default: "mainnet" },
    repo: { type: "string" },
  },
  allowPositionals: true,
});
if (!(values.network in NETWORKS)) {
  throw new Error(`--network must be mainnet or sepolia, got "${values.network}"`);
}
const network = values.network;
const { pool: POOL, rpc: RPC } = NETWORKS[network];
const asJson = values.json;
const repo = values.repo ?? null;
const filePath = positionals[0] || "strk20.json";
const deploymentCheck = network === "sepolia";

/** Addresses come back with inconsistent zero padding, so compare as numbers. */
const sameAddress = (a, b) => {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
};

const short = (h) => (typeof h === "string" && h.length > 16 ? `${h.slice(0, 10)}...${h.slice(-4)}` : String(h));

async function fetchWithTimeout(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const headers = { "Content-Type": "application/json" };
  let lastErr;
  // One retry: public RPCs drop connections often enough that a single
  // transient failure should not be reported as a failed transaction.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(RPC, { method: "POST", headers, body });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) return { error: json.error.message || JSON.stringify(json.error) };
      return { result: json.result };
    } catch (err) {
      lastErr = err;
    }
  }
  return { error: `RPC unreachable: ${lastErr?.message || lastErr}` };
}

async function loadClaim() {
  if (repo) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`--repo expects owner/name, got "${repo}"`);
    const url = `https://api.github.com/repos/${repo}/contents/strk20.json`;
    const headers = {
      Accept: "application/vnd.github.raw",
      "User-Agent": "verify-strk20-claim",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };
    const res = await fetchWithTimeout(url, { headers });
    if (res.status === 404) throw new Error(`${repo} has no strk20.json at its repository root`);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${repo}`);
    return { source: repo, raw: await res.text() };
  }
  try {
    return { source: filePath, raw: await readFile(filePath, "utf8") };
  } catch (err) {
    if (err.code === "ENOENT") throw new Error(`No such file: ${filePath}`);
    throw err;
  }
}

export async function checkTransaction(hash, expectedAddress, ownContracts = []) {
  const row = {
    hash,
    type: null,
    execution: null,
    finality: null,
    events: 0,
    poolEvents: 0,
    addressEvents: 0,
    /* null means the question does not apply because the submission declares no
       contracts. false is the failing case the hub calls "touched the pool, but
       not through this project's contracts". */
    mine: null,
    pass: false,
    reason: "",
  };

  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]+$/.test(hash)) {
    row.reason = "not a hex transaction hash";
    return row;
  }

  const { result, error } = await rpc("starknet_getTransactionReceipt", [hash]);
  if (error) {
    row.reason = /not found|TXN_HASH_NOT_FOUND/i.test(error) ? `transaction not found on ${network}` : error;
    return row;
  }

  row.type = result.type ?? null;
  row.execution = result.execution_status ?? null;
  row.finality = result.finality_status ?? null;

  const events = Array.isArray(result.events) ? result.events : [];
  row.events = events.length;
  row.poolEvents = events.filter((e) => sameAddress(e.from_address ?? "0x0", POOL)).length;
  row.addressEvents = expectedAddress
    ? events.filter((event) => event.data?.some((value) => sameAddress(value, expectedAddress))).length
    : 0;

  if (row.execution !== "SUCCEEDED") {
    row.reason = `execution_status is ${row.execution ?? "unknown"}`;
    return row;
  }
  if (expectedAddress) {
    if (row.addressEvents === 0) {
      row.reason = "succeeded but did not emit the claimed contract address";
      return row;
    }
    row.pass = true;
    return row;
  }
  if (row.poolEvents === 0) {
    row.reason = `succeeded but emitted no STRK20 pool event${row.type ? ` (${row.type})` : ""}`;
    return row;
  }

  /* The clause this tool used to miss entirely, and the reason it reported
     SCOREABLE while the hub recorded verified_txs: 0.
     CONTRIBUTING.md: "If you listed anything in `contracts`, the transaction
     must also carry an event from one of them - touching the pool through
     someone else's contract is not your project running on mainnet."
     Projects that declare no contracts are judged on the pool alone, which is
     why this is skipped rather than failed when the list is empty.

     Matched against events first and calldata second, exactly as the hub's
     build-projects.mjs does: a helper that only forwards a call to the pool may
     emit nothing of its own. */
  if (ownContracts.length > 0) {
    row.mine = events.some((event) => ownContracts.some((a) => sameAddress(event.from_address, a)));
    if (!row.mine) {
      const { result: tx } = await rpc("starknet_getTransactionByHash", [hash]);
      const calldata = Array.isArray(tx?.calldata) ? tx.calldata : [];
      row.mine = calldata.some((felt) => ownContracts.some((a) => sameAddress(felt, a)));
    }
    if (!row.mine) {
      row.reason = "touched the pool, but not through this project's contracts";
      return row;
    }
  }

  row.pass = true;
  return row;
}

async function main() {
  const { source, raw } = await loadClaim();

  let claim;
  try {
    claim = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${source} is not valid JSON: ${err.message}`);
  }

  // The sprint schema is a flat array of hash STRINGS. The official scanner does
  // `typeof raw === "string" ? raw.trim() : ""` and skips anything else, so a
  // {hash, note} object silently scores zero however real the transaction is.
  // This repo shipped that mistake, so the tool reports it loudly rather than
  // quietly reading the hash out and pretending the submission is fine.
  const entries = Array.isArray(claim.transactions) ? claim.transactions : [];
  const objectForm = entries.filter((t) => t && typeof t !== "string").length;
  const deployments = Array.isArray(claim.contracts)
    ? claim.contracts.filter((contract) => contract?.network === network && contract?.tx)
    : [];
  const checks = deploymentCheck
    ? deployments.map((contract) => ({ hash: contract.tx, expectedAddress: contract.address }))
    : entries
        .map((entry) => ({ hash: typeof entry === "string" ? entry : entry?.hash }))
        .filter(({ hash }) => Boolean(hash));

  /* EVERY declared contract, not just those on the network being verified.
     Filtering by network here is the tempting mistake: it makes this tool
     lenient in precisely the case that is failing us, since our contracts are
     Sepolia and the transactions are mainnet.

     The hub's resolveContracts() passes the whole declared list into
     verifyTransactions() and works out each address's network separately, for
     display only. So declaring a Sepolia address arms the rule against a
     mainnet transaction that can never satisfy it. That is the real gate, and
     this tool has to reproduce it rather than a kinder version. */
  const ownContracts = deploymentCheck
    ? []
    : (Array.isArray(claim.contracts) ? claim.contracts : [])
        .map((c) => (typeof c === "string" ? c : c?.address))
        .filter(Boolean);

  const rows = [];
  for (const check of checks) {
    rows.push(await checkTransaction(check.hash, check.expectedAddress, ownContracts));
  }

  const qualifying = rows.filter((r) => r.pass).length;
  const hasVideo = typeof claim.demo_video === "string" && claim.demo_video.trim() !== "";
  const hasDemoUrl = typeof claim.demo_url === "string" && claim.demo_url.trim() !== "";
  const scoreable = deploymentCheck
    ? rows.length > 0 && qualifying === rows.length
    : qualifying >= MIN_QUALIFYING && hasVideo && objectForm === 0;

  const report = {
    source,
    network,
    mode: deploymentCheck ? "contract-deployments" : "pool-transactions",
    pool: POOL,
    rpc: RPC,
    transactions: rows,
    qualifying,
    required: deploymentCheck ? rows.length : MIN_QUALIFYING,
    demo_video: hasVideo,
    demo_url: hasDemoUrl,
    object_form_entries: objectForm,
    scoreable,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return scoreable ? 0 : 1;
  }

  console.log(`\nSTRK20 ${deploymentCheck ? "deployment" : "claim"} check: ${source} (${network})`);
  console.log(`pool ${POOL}`);
  console.log(`rpc  ${RPC}\n`);

  if (!rows.length) {
    console.log(`  no ${deploymentCheck ? `${network} contract deployments` : "transactions"} listed\n`);
  }

  for (const r of rows) {
    const mark = r.pass ? "PASS" : "FAIL";
    const detail = r.type ? `${r.type} ${r.execution}/${r.finality}` : "unresolved";
    console.log(`  ${mark}  ${short(r.hash)}  ${detail}`);
    const evidence = deploymentCheck
      ? `events ${r.events}, claimed address ${r.addressEvents}`
      : `events ${r.events}, from pool ${r.poolEvents}`;
    console.log(`        ${evidence}${r.pass ? "" : `  <- ${r.reason}`}`);
  }

  if (!deploymentCheck && objectForm > 0) {
    console.log(
      `\n  SCHEMA: ${objectForm} entr${objectForm === 1 ? "y is" : "ies are"} an object, not a hash string.`,
    );
    console.log(`          The official scanner skips these, so they score ZERO however real they are.`);
    console.log(`          Use "transactions": ["0x...", "0x..."] and keep notes under another key.`);
  }

  console.log(
    `\n  ${deploymentCheck ? "verified deployments" : "qualifying transactions"} : ${qualifying} of ${
      deploymentCheck ? rows.length : MIN_QUALIFYING
    } required`,
  );
  if (!deploymentCheck) {
    console.log(`  demo_video              : ${hasVideo ? "present" : "MISSING (required to be scored)"}`);
    console.log(`  demo_url                : ${hasDemoUrl ? "present" : "absent (optional, auto-detected)"}`);
  }
  console.log(
    scoreable
      ? deploymentCheck
        ? `\n  VERIFIED: all listed ${network} contract deployments succeeded.\n`
        : "\n  SCOREABLE: this submission meets the transaction and video gates.\n"
      : deploymentCheck
        ? `\n  NOT VERIFIED: fix the ${network} deployment items marked above.\n`
        : "\n  NOT SCOREABLE: fix the items marked above before the deadline.\n",
  );

  return scoreable ? 0 : 1;
}

/* Run main() only when this module is being used AS the command.
 *
 * Two callers have to keep working, and the obvious guard breaks one of them:
 *
 *   - tests/strk20-claim-ownership.test.ts imports checkTransaction to test it
 *     directly. A module that calls process.exit on import takes the runner
 *     down with it.
 *   - tests/verify-claim.test.ts drives the WHOLE script by setting
 *     process.argv and importing it, so for that caller main() must still run.
 *
 * Comparing import.meta.url to argv[1] satisfies the first and silently breaks
 * the second, because that test sets a RELATIVE argv path which never resolves
 * to this module's URL. So match on the basename instead: it is true for the
 * real CLI and for the argv-driven test, and false for a bare import. */
const entry = process.argv[1] ?? "";
const invokedAsCommand = entry.endsWith("verify-strk20-claim.mjs");

if (invokedAsCommand) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      if (asJson) console.log(JSON.stringify({ error: err.message }, null, 2));
      else console.error(`\n  error: ${err.message}\n`);
      process.exit(1);
    });
}
