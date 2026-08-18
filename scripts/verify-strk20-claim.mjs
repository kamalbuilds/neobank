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
import { pathToFileURL } from "node:url";

const POOL = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
const RPC = process.env.STARKNET_RPC || "https://rpc.starknet.lava.build";
const MIN_QUALIFYING = 3;
const TIMEOUT_MS = 20_000;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const repoIdx = args.indexOf("--repo");
const repo = repoIdx === -1 ? null : args[repoIdx + 1];
// Guard the -1 case: without --repo, repoIdx + 1 is 0 and would eat the path.
const repoValueIdx = repoIdx === -1 ? -1 : repoIdx + 1;
const filePath = args.filter((a, i) => !a.startsWith("--") && i !== repoValueIdx)[0] || "strk20.json";

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

export async function checkTransaction(hash) {
  const row = { hash, type: null, execution: null, finality: null, events: 0, poolEvents: 0, pass: false, reason: "" };

  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]+$/.test(hash)) {
    row.reason = "not a hex transaction hash";
    return row;
  }

  const { result, error } = await rpc("starknet_getTransactionReceipt", [hash]);
  if (error) {
    row.reason = /not found|TXN_HASH_NOT_FOUND/i.test(error) ? "transaction not found on mainnet" : error;
    return row;
  }

  row.type = result.type ?? null;
  row.execution = result.execution_status ?? null;
  row.finality = result.finality_status ?? null;

  const events = Array.isArray(result.events) ? result.events : [];
  row.events = events.length;
  row.poolEvents = events.filter((e) => sameAddress(e.from_address ?? "0x0", POOL)).length;

  if (row.execution !== "SUCCEEDED") {
    row.reason = `execution_status is ${row.execution ?? "unknown"}`;
    return row;
  }
  if (row.poolEvents === 0) {
    row.reason = `succeeded but emitted no STRK20 pool event${row.type ? ` (${row.type})` : ""}`;
    return row;
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
  const hashes = entries.map((t) => (typeof t === "string" ? t : t?.hash)).filter(Boolean);

  const rows = [];
  for (const hash of hashes) rows.push(await checkTransaction(hash));

  const qualifying = rows.filter((r) => r.pass).length;
  const hasVideo = typeof claim.demo_video === "string" && claim.demo_video.trim() !== "";
  const hasDemoUrl = typeof claim.demo_url === "string" && claim.demo_url.trim() !== "";
  const scoreable = qualifying >= MIN_QUALIFYING && hasVideo && objectForm === 0;

  const report = {
    source,
    pool: POOL,
    rpc: RPC,
    transactions: rows,
    qualifying,
    required: MIN_QUALIFYING,
    demo_video: hasVideo,
    demo_url: hasDemoUrl,
    object_form_entries: objectForm,
    scoreable,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return scoreable ? 0 : 1;
  }

  console.log(`\nSTRK20 claim check: ${source}`);
  console.log(`pool ${POOL}`);
  console.log(`rpc  ${RPC}\n`);

  if (!rows.length) console.log("  no transactions listed\n");

  for (const r of rows) {
    const mark = r.pass ? "PASS" : "FAIL";
    const detail = r.type ? `${r.type} ${r.execution}/${r.finality}` : "unresolved";
    console.log(`  ${mark}  ${short(r.hash)}  ${detail}`);
    console.log(`        events ${r.events}, from pool ${r.poolEvents}${r.pass ? "" : `  <- ${r.reason}`}`);
  }

  if (objectForm > 0) {
    console.log(
      `\n  SCHEMA: ${objectForm} entr${objectForm === 1 ? "y is" : "ies are"} an object, not a hash string.`,
    );
    console.log(`          The official scanner skips these, so they score ZERO however real they are.`);
    console.log(`          Use "transactions": ["0x...", "0x..."] and keep notes under another key.`);
  }

  console.log(`\n  qualifying transactions : ${qualifying} of ${MIN_QUALIFYING} required`);
  console.log(`  demo_video              : ${hasVideo ? "present" : "MISSING (required to be scored)"}`);
  console.log(`  demo_url                : ${hasDemoUrl ? "present" : "absent (optional, auto-detected)"}`);
  console.log(
    scoreable
      ? "\n  SCOREABLE: this submission meets the transaction and video gates.\n"
      : "\n  NOT SCOREABLE: fix the items marked above before the deadline.\n",
  );

  return scoreable ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (asJson) console.log(JSON.stringify({ error: err.message }, null, 2));
    else console.error(`\n  error: ${err.message}\n`);
    process.exit(1);
  });
