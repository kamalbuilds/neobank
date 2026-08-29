# STRK20 Private Sprint — Submission Audit

Audited 2026-08-29, against the live rules at `strk20.starknet.io/hackathon` (mirrored at
[`github.com/starkience/strk20-hackathon`](https://github.com/starkience/strk20-hackathon)) and the
RFP idea page at `strk20.starknet.io/rfp/private-crypto-neobank`. Deadline: **August 31, 23:59 UTC**
(two days out at time of writing). Repo: `github.com/kamalbuilds/neobank`, registered on the hub as
slug `neobank`.

Every claim below was checked against a live source (chain RPC, the deployed site, or the hackathon's
own scanner script pulled from its repo) — not inferred from strk20.json or from memory.

## 1. What each gate script actually requires

### `scripts/check-submission.mjs`
Reads `strk20.json` and passes when: `transactions.length >= 3` and all entries are hex strings,
`contracts.length >= 1`, and `demo_url` is a non-empty `https://` string. It does **not** check
`demo_video` at all.

Run after this session's edit:

```
Qualifying pool txs : 3 / 3
RESULT: PASS   (exit 0)
```

Already closed before this session (transactions and contracts were already valid); the `demo_url`
edit below didn't change its pass/fail, only its value.

### `scripts/verify-strk20-claim.mjs` (default: `--network mainnet`)
Reads each `transactions[]` hash, fetches its receipt from `https://rpc.starknet.lava.build`, and
requires `execution_status === SUCCEEDED` and at least one event whose `from_address` is the STRK20
mainnet pool (`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`). Scoreable requires
**all three**: `qualifying >= 3`, `demo_video` non-empty, and every `transactions[]` entry a plain hash
string (not `{hash, note}`).

Run after this session's edit:

```
PASS  0x04c4bea0...9193  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 17, from pool 4
PASS  0x059eb6c1...586e  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 15, from pool 3
PASS  0xe08fd329...0294  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 17, from pool 4

qualifying transactions : 3 of 3 required
demo_video              : MISSING (required to be scored)
demo_url                : present
NOT SCOREABLE   (exit 1)
```

Independently re-verified all three receipts directly against `https://starknet.publicnode.com` (the
RPC named in this task's constraints, not the script's default lava.build endpoint): all three are
`execution_status: SUCCEEDED`, `finality_status: ACCEPTED_ON_L1` — finalized, not pending.

**The only thing keeping this gate closed is `demo_video`.**

### The real scanner (`starkience/strk20-hackathon/scripts/build-projects.mjs`)
This is the script that actually generates the hub and what judges score from — neither local script
models it exactly. Fetched and read directly. Three findings from it are load-bearing for this audit
and are covered in full in §3.

## 2. strk20.json changes made this session

- `demo_url`: `https://neobank-six.vercel.app` → `https://sealed.cash`. Verified live (`curl -w
  "%{http_code}"` → `200`, final URL `https://sealed.cash/`) before and after the edit.
- No `name` or `description` field exists in `strk20.json` — the schema doesn't carry one (confirmed
  against the hackathon repo's own README: `strk20.json` only ever has `transactions`, `contracts`,
  `demo_video`, `demo_url`). Nothing else to rename here.
- `transactions` array: untouched, as instructed.

Branding is **not** carried by `strk20.json` at all — see §3.3 for where it actually lives and why the
"Sealed" rename hasn't reached the hub or the live site yet.

## 3. demo_video

### 3.1 What the field requires
Read directly from `build-projects.mjs` (the code that scores it), not assumed:

```js
video: !!entry.demo_video,
```

That's the entire check. No URL-shape validation, no YouTube requirement, no reachability probe — any
non-empty string passes. The hackathon README's own example (`"https://youtu.be/..."`) is illustrative,
not enforced. `scripts/verify-strk20-claim.mjs` in this repo checks the same thing: `typeof
claim.demo_video === "string" && claim.demo_video.trim() !== ""`.

### 3.2 The self-serve path — verified, not assumed
This repo is a Next.js app; anything under `public/` is served at the site root with zero config. Proved
this is genuinely live end-to-end, not just true in theory: `public/tokens/zec.png` is already committed
and resolves at `https://sealed.cash/tokens/zec.png` → `200`. That means push-to-deploy already works
for static assets on this exact domain, right now, with no human step.

**So the moment `marketing/sealed-launch.mp4` exists** (another agent is rendering it; it does not exist
yet — confirmed, `marketing/` currently contains only `brief.yaml` and a `footage` directory, no `.mp4`):

```
cp marketing/sealed-launch.mp4 public/demo.mp4
# edit strk20.json: "demo_video": "https://sealed.cash/demo.mp4"
git add public/demo.mp4 strk20.json
git commit -m "..." && git push
```

That's the entire remaining step. No config, no third-party upload, no manual dashboard action. I did
not create a placeholder or stub video file — that would be exactly the "fake data" this repo's own
rules forbid, and would fail the honesty bar even though the checker itself wouldn't catch a broken
link.

### 3.3 What I did NOT do, and why
I did not pre-set `demo_video` to a URL that 404s right now. A judge — or the scanner, which reads
`strk20.json` live off the repo every 30 minutes right up to the deadline — could hit it before the
video lands and see a dead link, which is worse than "missing."

## 4. Critical finding: the mainnet gate may score as FAILED on the real hub despite local PASS

This is the single highest-risk item in this submission and would not have surfaced without reading
the actual scanner, `starkience/strk20-hackathon/scripts/build-projects.mjs`. It is not caught by
either local script.

**The scanner does not just check "pool event present."** For any project that declares a
non-empty `contracts` array in `strk20.json`, it additionally requires that at least one *mainnet*
qualifying transaction's events or calldata reference one of those declared contract addresses
(`mine`). If a project declares contracts at all, `mine === false` disqualifies the transaction
regardless of whether it touched the pool:

```js
// build-projects.mjs:674-687
let mine = null;
if (own.length) {
  mine = events.some((e) => own.some((a) => sameAddress(e.from_address, a)));
  ...
}
...
else if (mine === false) out.push({ ..., note: "touched the pool, but not through this project's contracts" });

// build-projects.mjs:970
const verifiedTxs = transactions.filter((t) => t.ok && t.pool && t.mine !== false).length;
```

`strk20.json`'s `contracts` array currently lists **8 addresses, all on Sepolia** (`"network":
"sepolia"` on every entry — none deployed to mainnet). The three mainnet transactions were submitted
through Ready's native Shield flow directly against the pool, not through any of these contracts.
Because `contracts` is non-empty, `own.length > 0`, and none of the mainnet receipts' events or
calldata reference a Sepolia address (they can't — different network), so **every mainnet transaction
currently resolves `mine: false`**.

I confirmed this is not a hypothetical: I pulled the hub's own last-computed snapshot
(`starkience/strk20-hackathon/projects.json`, built from commit `e300642` on 2026-08-26 — three days
before this audit) and the `neobank` entry already shows exactly this:

```json
"verified_txs": 0,
"requirements": { "demo": true, "video": false, "mainnet": false },
"transactions": [
  { "hash": "0x04c4bea0...", "ok": true, "pool": true, "mine": false, "note": "touched the pool, but not through this project's contracts" },
  { "hash": "0x059eb6c1...", "ok": true, "pool": true, "mine": false, "note": "touched the pool, but not through this project's contracts" },
  { "hash": "0x02cbfcce...", "ok": true, "pool": false, "mine": false, "note": "did not touch the pool" }
]
```

That snapshot is stale (it still has the old third transaction, before it was swapped for the
`enable_private_tokens` hash) but the `contracts` array that causes the `mine: false` penalty was
already Sepolia-only at that commit and still is now — **so the next scanner run, after the deadline,
will very likely reproduce `mine: false` on all three current transactions and score `verified_txs: 0`
/ `requirements.mainnet: false`**, even after `demo_video` is filled in.

**I did not fix this myself.** The scanner's own comment explains the intended escape hatch: "a project
that deploys nothing is judged on the pool alone." Emptying `contracts` in `strk20.json` would restore
`mine: null` (passes) instead of `false`, and I confirmed removing it wouldn't touch the `transactions`
array. But it would also directly regress `check-submission.mjs`'s `contracts.length >= 1` PASS (which
this task named as a gate to keep closed), and it throws away the one place in `strk20.json` that
documents eight genuinely-deployed, RPC-verified anonymizer/vault contracts — real evidence for the
30%-weighted "STRK20 integration depth" criterion. Trading a real scoring risk for a real evidence loss
is a product call, not a data-entry fix, and money/contract-deployment is the actual correct remedy
(deploy one contract to mainnet and route a transaction through it, or accept the Sepolia-only framing
and let judges read the code directly) — both are outside what I'll do unattended. Flagging it here is
the responsible move; a human needs to pick the fix.

## 5. RFP requirement audit — MET / PARTIAL / NOT MET

Requirements pulled from two sources: the sprint rules (`hackathon.md`, judged criteria) and the RFP
idea brief (`rfp/private-crypto-neobank`, "Idea 18" — this is a *vision brief*, not a checklist; it has
no separate deliverables of its own beyond the sprint's).

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Public, open-source repo with a license | **MET** | `github.com/kamalbuilds/neobank`, public (`private: false` via GitHub API), Apache-2.0 `LICENSE` file at repo root |
| 2 | Registered for the sprint (PR merged into `strk20-hackathon/registry.json`) | **MET** | Entry present: `repo_url: kamalbuilds/neobank`, `telegram: kamalthedev`, `slug: neobank` |
| 3 | ≥3 mainnet transactions touching the live STRK20 pool | **PARTIAL** | Pool-touch confirmed independently on `starknet.publicnode.com`: all 3 `SUCCEEDED` / `ACCEPTED_ON_L1`, 3-4 pool events each. But see §4 — the official scanner's additional "your own contract" check currently fails all three because `contracts` is Sepolia-only. Passes the letter of the rule ("three mainnet transactions... that touched the pool"), at risk on the scanner's stricter implementation |
| 4 | A public demo URL | **MET** | `https://sealed.cash` → `200`, confirmed live this session; set as `strk20.json.demo_url`, which the scanner's `resolveDemo()` reads before falling back to the repo's GitHub "Website" field (still the old Vercel URL — now moot since `demo_url` takes priority) |
| 5 | A 3-minute demo video | **NOT MET** | `demo_video` absent from `strk20.json`; `marketing/sealed-launch.mp4` does not exist yet. Path to close it is prepared and verified (§3.2) but the file itself is a human/other-agent deliverable |
| 6 | STRK20 integration depth (30% of score): shielded balances, private transfers, anonymizer contracts, SDK, stealth accounts | **MET (Sepolia), PARTIAL (mainnet)** | 8 contracts deployed and RPC-verified this session on Sepolia: `PrivatePayoutAnonymizer`, `PrivateSpendAnonymizer`, `ProgrammableSpendAnonymizer`, `CardSettlementAnonymizer`, `CardProgramAnonymizer`, `EarnVault`, `EarnVaultRetired`, `EarnAdapter` — all 8 deployment txs `SUCCEEDED`/`ACCEPTED_ON_L1` (`node scripts/verify-strk20-claim.mjs --network sepolia` → 8/8). None of these are deployed to mainnet |
| 7 | Working mainnet product, for a real user, not a prototype behind a login | **PARTIAL** | Shield/enable-private-tokens flow is real and live on mainnet (item 3). Card spend, earn/yield, and programmable-spend flows are real and RPC-verified but only on Sepolia — e.g. `CardSettlementAnonymizer`'s "Osteria dinner" settlement tx (`0x18d874...`) and `EarnVault`'s first deposit (`0x4d94fa...`) both independently confirmed `SUCCEEDED`/`ACCEPTED_ON_L1` on **Sepolia**, not mainnet |
| 8 | Non-custodial card connected to private balances (RFP brief) | **PARTIAL** | `/card` route and `CardSettlementAnonymizer`/`CardProgramAnonymizer` contracts exist and have a verified settlement transaction on Sepolia. The repo's own `README.md` explicitly states "A Visa that spends a shielded note is not in v0. No issuer does that" — the README contradicts what `strk20.json` and the deployed contracts actually show. See §6.1 |
| 9 | Hold multiple fiat/stables/crypto, earn yield without publishing holdings (RFP brief) | **PARTIAL** | `EarnVault`/`EarnAdapter` deployed and exercised on Sepolia (verified). `README.md` says "Yield is planned, not in this repo" — again contradicted by the current repo state. See §6.1 |
| 10 | Chain abstraction — deposit from Ethereum, Solana, any chain (RFP brief) | **PARTIAL** | `src/app/components/lib/cctp.ts`, `src/app/components/Panels/HopPanel.tsx`, `src/app/fund/` reference cross-chain funding (CCTP/Hop). Not independently re-verified against a live cross-chain deposit transaction in this audit — read as code presence, not exercised |
| 11 | Paymaster-sponsored gas (RFP brief, Avnu) | **MET (code-level)** | `src/app/components/lib/avnu.ts` and AVNU wired into Shield/Unshield/Swap/Send/Spend panels; hub's own `tooling` field for this project independently lists `AVNU: live: true` |
| 12 | Viewing keys for statements / source-of-funds proofs (RFP brief) | **MET (code-level)** | `/statements` and `/statements/[authorizationId]` routes exist with an `AuthorizationProofClient.tsx`; `viewing key` referenced across `layout.tsx`, `history.ts`, `strk20.ts`, `InboundPanel.tsx` |
| 13 | Documentation & open-source quality (15% of score) — "a README someone can follow" | **NOT MET** | `README.md` is materially stale: it's still titled "Fully Programmable Private money account" (pre-rebrand name) and asserts two features are *absent* ("Yield is planned, not in this repo," "A Visa that spends a shielded note is not in v0") that the current `strk20.json` and deployed contracts show are actually built and transaction-verified. A judge reading the README first would materially undersell — or actively distrust — the project |
| 14 | Product is named "Sealed," live at sealed.cash | **PARTIAL** | Domain is live and serving the app (`200`). But the *deployed* build still serves the old identity: `curl https://sealed.cash` returns `<title>Private money account</title>` and the old description. The "Sealed" rebrand exists locally (`src/app/layout.tsx` already has `title: 'Sealed: private money account'`) but is uncommitted/undeployed — confirmed via `git status` (`M src/app/layout.tsx` among ~20 other modified, uncommitted files) and a live fetch of the production `<title>` tag not matching. The hackathon registry entry also still shows the pre-rebrand name, `"Private money account"` |
| 15 | No name collision with another sprint entry | **NOT MET** | A different, unrelated registered project — `tinoxbt/sealed`, a sealed-bid second-price auction protocol — is already registered on this same hackathon under the literal name **"Sealed"**. If this project's registry entry is ever updated to "Sealed" to match the new branding, it will collide by name with an already-registered, unrelated project on the same hub. Worth resolving before any rename PR is opened against `registry.json` |

## 6. Supporting findings

### 6.1 README staleness (detail for row 8/9/13)
`README.md` currently reads, verbatim:

> Yield is planned, not in this repo.
>
> A Visa that spends a shielded note is not in v0. No issuer does that.

Both are false against the current repo state: `strk20.json` documents a working `EarnVault` with a
verified first deposit and a retirement/migration history (`EarnVaultRetired` → `EarnAdapter`), and a
`CardSettlementAnonymizer` with a verified real-world settlement ("Osteria dinner," `0.24` of the
settlement token) plus a `CardProgramAnonymizer` with a verified lend/settle cycle. I did not edit
`README.md` — it's outside this task's file scope (only `strk20.json` and this audit file were to be
committed) — but a judge reading the README before the code will land on a false negative about scope,
which actively hurts the 15%-weighted documentation criterion and general credibility. This is a fast
fix for whichever agent owns `README.md` next.

### 6.2 Branding / rebrand-in-flight (detail for row 14)
Everything checked here reflects the **currently deployed** state of `sealed.cash`, not the working
tree. The working tree already carries the "Sealed" rename in `layout.tsx` and ~20 other files per
`git status` at the start of this session — consistent with the brief's note that a landing-page
rebuild is in flight in a worktree. Once that lands and deploys, row 14 should be re-checked; as of this
audit it is not yet true in production.

## 7. Remaining human steps

Everything gateable by data-entry is done: `check-submission.mjs` passes, `verify-strk20-claim.mjs`
passes on the transaction and demo-URL checks and is blocked on exactly one field.

1. **Demo video.** Once `marketing/sealed-launch.mp4` exists: `cp` it to `public/demo.mp4`, set
   `strk20.json.demo_video` to `https://sealed.cash/demo.mp4`, commit, push. No other step — the
   static-asset path is already live and verified (§3.2). This closes `verify-strk20-claim.mjs`
   completely.
2. **Mainnet-contract attribution risk (§4).** Decide and act: either deploy one already-written
   anonymizer contract to mainnet and route a transaction through it (restores `mine: true` on a
   qualifying tx), or consciously accept the Sepolia-only framing and let the panel read the code
   directly rather than trust the automated `verified_txs` count. This is a money/deployment decision,
   not something to automate unattended.
3. **Optional but recommended before the deadline:** refresh `README.md` to match current scope (§6.1),
   and decide whether to open a PR against `starkience/strk20-hackathon` to rename the registry entry
   from "Private money account" to "Sealed" — only after resolving the name collision with
   `tinoxbt/sealed` (§5, row 15).
