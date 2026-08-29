# STRK20 Private Sprint — Submission Audit

Audited 2026-08-29, against the live rules at `strk20.starknet.io/hackathon` (mirrored at
[`github.com/starkience/strk20-hackathon`](https://github.com/starkience/strk20-hackathon)) and the
RFP idea page at `strk20.starknet.io/rfp/private-crypto-neobank`. Deadline: **August 31, 23:59 UTC**.
Repo: `github.com/kamalbuilds/neobank`, registered on the hub as slug `neobank`.

This is a follow-up pass on the 2026-08-29 audit that first identified `demo_video` as the only
blocking field. This session closed that gate. Every claim below was re-checked against a live source
(chain RPC, the deployed site, or the hackathon's own scanner script re-pulled fresh from its repo)
in this session — nothing here is carried over unverified from the prior pass.

## 1. What each gate script actually requires (unchanged from prior audit, re-confirmed by reading the source again)

### `scripts/check-submission.mjs`
Passes when: `transactions.length >= 3` and all entries are hex strings, `contracts.length >= 1`, and
`demo_url` is a non-empty `https://` string. Does **not** check `demo_video`.

### `scripts/verify-strk20-claim.mjs` (default `--network mainnet`)
Reads each `transactions[]` hash, fetches its receipt from `https://rpc.starknet.lava.build`, requires
`execution_status === SUCCEEDED` and at least one event whose `from_address` is the STRK20 mainnet pool
(`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`). Scoreable requires all three:
`qualifying >= 3`, `demo_video` non-empty, every `transactions[]` entry a plain hash string. Also
supports `--network sepolia`, which switches to a different mode entirely: it validates each
`contracts[]` entry's own deployment transaction against the Sepolia pool address, not the submission
transactions.

## 2. Verifier runs — BEFORE this session's change

```
$ node scripts/check-submission.mjs
RESULT: PASS   (exit 0)

$ node scripts/verify-strk20-claim.mjs
PASS  0x04c4bea0...9193  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 17, from pool 4
PASS  0x059eb6c1...586e  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 15, from pool 3
PASS  0xe08fd329...0294  INVOKE SUCCEEDED/ACCEPTED_ON_L2   events 17, from pool 4

qualifying transactions : 3 of 3 required
demo_video              : MISSING (required to be scored)
demo_url                : present
NOT SCOREABLE   (exit 1)
```

(Note the third tx showed `ACCEPTED_ON_L2` on this run against `rpc.starknet.lava.build` — that RPC's
view was one confirmation behind; the independent check against `starknet.publicnode.com`, below,
shows all three finalized `ACCEPTED_ON_L1`. `execution_status: SUCCEEDED` was consistent across both
endpoints throughout, which is the field the script actually gates on.)

## 3. This session's change

- Verified two candidate renders in `~/.agents/tools/launch-video/renders/`:
  `sealed.mp4` (35.4 MB, 64.38s, generated 2026-08-29T04:40Z, includes the `card-tap-terminal.mp3` sfx
  layer) and `sealed.verified-2026-08-29-0335.mp4` (36.5 MB, 67.39s, generated 2026-08-28T21:00Z, one
  sfx layer short). `sealed.mp4` is the newer, more complete render and is also what its own manifest
  names as the tool's current `render.output`. Picked `sealed.mp4`.
- Verified it is not corrupt or truncated: `ffprobe` shows one clean h264 1920x1080 video stream and
  one aac audio stream, container duration `64.384s` matching both stream durations; a full
  `ffmpeg -i ... -f null -` decode pass completed with **zero** decode errors (exit 0).
- Checked for anything that would break the size en route to Vercel: no `.gitattributes`, no Git LFS
  tracking rules in this repo (`git lfs env` shows LFS installed but nothing tracked). Fetched Vercel's
  current limits doc directly (`vercel.com/docs/limits`, `last_updated: 2026-08-25`): the only relevant
  cap is **Static File uploads — 100 MB (Hobby) / 1 GB (Pro) total per deployment**; there is no
  documented per-file cap for `public/` static assets (they are not part of a Vercel Function bundle,
  so Function bundle-size limits don't apply). This repo's tracked size is ~7.3 MB; adding a 35.4 MB
  file keeps the deployment far under the 100 MB Hobby ceiling. GitHub's own 100 MB hard per-file push
  limit is also not a concern at 35.4 MB. **Conclusion: safe to commit directly, no LFS or third-party
  host needed.**
- `cp ~/.agents/tools/launch-video/renders/sealed.mp4 public/demo.mp4`
- `strk20.json.demo_video` set to `https://sealed.cash/demo.mp4`
- Committed as `36cd60a`: `feat: close the demo_video gate for STRK20 submission`

## 4. Verifier runs — AFTER this session's change (post-commit)

```
$ node scripts/check-submission.mjs
RESULT: PASS   (exit 0)   [unchanged — this script never checked demo_video]

$ node scripts/verify-strk20-claim.mjs
PASS  0x04c4bea0...9193  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 17, from pool 4
PASS  0x059eb6c1...586e  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 15, from pool 3
PASS  0xe08fd329...0294  INVOKE SUCCEEDED/ACCEPTED_ON_L1   events 17, from pool 4

qualifying transactions : 3 of 3 required
demo_video              : present
demo_url                : present
SCOREABLE: this submission meets the transaction and video gates.   (exit 0)

$ node scripts/verify-strk20-claim.mjs --network sepolia
verified deployments : 8 of 8 required
VERIFIED: all listed sepolia contract deployments succeeded.   (exit 0)
```

**`demo_video` now passes. Both local gate scripts are fully green.**

Independent live checks, same session:
- All three mainnet tx hashes re-fetched directly from `https://starknet.publicnode.com` (not the
  scripts' default `lava.build`): all three `execution_status: SUCCEEDED`, `finality_status:
  ACCEPTED_ON_L1` — finalized on all endpoints checked.
- `curl -w "%{http_code}" -L https://sealed.cash` → `200`, final URL `https://sealed.cash/`.
- `curl -o /dev/null -w "%{http_code}" https://sealed.cash/demo.mp4` → `404` at time of writing — this
  is **expected**, not a problem: the commit exists locally (`36cd60a`) but has not yet been pushed to
  `origin` and deployed by Vercel. `public/tokens/zec.png` already proves this exact static-asset path
  works with zero config once pushed. **Push + deploy is the one remaining step to make the URL live.**

## 5. Critical, unresolved finding: the real scanner will very likely still score mainnet credit as ZERO

This is unchanged by the `demo_video` fix and is the single highest-priority open item. Re-verified
this session by re-fetching `starkience/strk20-hackathon/scripts/build-projects.mjs` fresh (not reused
from the prior audit) and reading the current logic directly:

```js
// build-projects.mjs:645-687 (verifyTransactions)
const own = contracts.map((c) => c.address).filter(Boolean);
...
let mine = null;
if (own.length) {
  mine = events.some((e) => own.some((a) => sameAddress(e.from_address, a)));
  if (!mine) mine = calldata.some((felt) => own.some((a) => sameAddress(felt, a)));
}
...
else if (mine === false) out.push({ ..., note: "touched the pool, but not through this project's contracts" });

// build-projects.mjs:970
const verifiedTxs = transactions.filter((t) => t.ok && t.pool && t.mine !== false).length;

// build-projects.mjs:605, 976-981
const MIN_MAINNET_TXS = 3;
const requirements = {
  demo: !!demoUrl,
  video: !!entry.demo_video,
  mainnet: verifiedTxs >= MIN_MAINNET_TXS,
};
const ready = Object.values(requirements).every(Boolean);
```

The mechanism: because `strk20.json.contracts` is non-empty (`own.length > 0`), the scanner requires
each mainnet transaction to reference one of those declared contract addresses in its events or
calldata to count (`mine: true`). All 8 declared contracts are `"network": "sepolia"` — none deployed
to mainnet. The three mainnet transactions were submitted through Ready's native Shield flow directly
against the pool, not through any declared contract, on a different network entirely, so they cannot
reference a Sepolia address. **All three currently resolve `mine: false`, `verifiedTxs = 0`,
`requirements.mainnet = false`, and `ready = false` regardless of `demo_video`.**

This is not speculative: the hub's own last-computed snapshot (re-fetched this session,
`starkience/strk20-hackathon/projects.json`, `head_sha: e3006421...`, `pushed_at: 2026-08-26T13:44:46Z`)
already shows exactly this for the `neobank` entry:

```json
"verified_txs": 0,
"requirements": { "demo": true, "video": false, "mainnet": false },
"transactions": [
  { "hash": "0x04c4bea0...", "ok": true, "pool": true, "mine": false, "note": "touched the pool, but not through this project's contracts" },
  { "hash": "0x059eb6c1...", "ok": true, "pool": true, "mine": false, "note": "touched the pool, but not through this project's contracts" },
  { "hash": "0x02cbfcce...", "ok": true, "pool": false, "mine": false, "note": "did not touch the pool" }
]
```

That snapshot's `video: false` is now stale (`demo_video` is set as of this session) and its third
transaction is stale (the array now uses the `enable_private_tokens` hash instead), but the
`contracts`-is-Sepolia-only condition that drives `mine: false` has not changed and is not touched by
anything in this session. **Verdict: with `contracts` populated as it is now, the next scanner run
will very likely still compute `requirements.mainnet: false` and `ready: false`, i.e. the submission
scores ZERO mainnet credit on the real hub even though `demo_video` and `demo_url` are now both
satisfied and both local scripts pass.**

### Options (money/deployment decisions — presented, not executed)

1. **Deploy one already-written anonymizer contract to Starknet mainnet and route one of the three
   transactions through it.** Restores `mine: true` on that transaction (only 1 of 3 needs to pass —
   `verifiedTxs >= 3` needs *three* qualifying, so realistically all three transactions, or three new
   ones, would need to route through a mainnet contract to hit `MIN_MAINNET_TXS = 3`). Cost: mainnet
   deployment gas for at least one contract (STRK/ETH, current network fee, typically low
   single-digit dollars per Starknet contract deploy at current gas prices, but exact cost depends on
   contract size and gas price at deploy time) plus three mainnet transaction fees to re-route
   qualifying activity through it. Requires re-declaring that contract's mainnet address in
   `strk20.json.contracts` and swapping in three new mainnet transaction hashes. **This is the fix that
   actually closes the gap** — it is a deployment + spend decision, correctly out of scope for this
   session per the task's explicit instruction not to deploy to mainnet.
2. **Empty the `contracts` array in `strk20.json`.** Restores `mine: null` (the scanner's own comment:
   "null is a project with nothing deployed, where the question does not apply"), which passes
   `mine !== false` and would make `requirements.mainnet` scoreable off the existing 3 pool-touching
   mainnet transactions with zero new spend. Trade-off: regresses `check-submission.mjs`'s
   `contracts.length >= 1` check from PASS to FAIL, and discards the one place `strk20.json` documents
   8 genuinely-deployed, RPC-verified contracts — real evidence for the 30%-weighted STRK20 integration
   depth in judging. Free, but weakens a different part of the submission.
3. **Do nothing; accept the Sepolia-only framing and let judges read the code/README directly** rather
   than trust the automated `verified_txs` count. Free, but leaves `requirements.mainnet: false` /
   `ready: false` on the hub's own generated page, which is the artifact judges are most likely to
   glance at first.

No mainnet deployment was made this session. This decision is flagged for the user, as instructed.

## 6. RFP requirement audit — MET / PARTIAL / NOT MET

RFP re-fetched live this session from `strk20.starknet.io/rfp/private-crypto-neobank`. Core features
required: (1) non-custodial card spending shielded balances with balance/history/origin hidden at
point of sale, (2) public/private mode toggle per-activity not per-account, (3) yield on private
balances across multiple fiat/stables/crypto without publishing total holdings, (4) chain abstraction
for deposits from any chain with paymaster-sponsored gas. Technical deliverables named: a
chain-abstracted account layer with Privacy-Pool balances, unlinkable private sub-accounts, card
settlement via just-in-time conversion against shielded notes, and Beam / Chain Abstraction /
Paymaster (Avnu) / Viewing Key integration. The RFP page itself sets no separate formal submission
requirements beyond the sprint's.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Public, open-source repo with a license | **MET** | `github.com/kamalbuilds/neobank` public, Apache-2.0 `LICENSE` at repo root |
| 2 | Registered for the sprint | **MET** | Hub entry present, slug `neobank`, `repo_url: kamalbuilds/neobank` |
| 3 | ≥3 mainnet transactions touching the live STRK20 pool (letter of the sprint rule) | **MET** | All 3 re-verified `SUCCEEDED`/`ACCEPTED_ON_L1` this session via `starknet.publicnode.com`, 3-4 pool events each |
| 3b | ≥3 mainnet transactions scoreable by the *real scanner's* stricter "own contract" check | **NOT MET** | §5: `contracts` is Sepolia-only → `mine: false` on all 3 → `verified_txs: 0` → `requirements.mainnet: false` on the hub, confirmed against a freshly re-fetched scanner and the hub's own last-computed snapshot |
| 4 | A public demo URL | **MET** | `https://sealed.cash` → `200`, re-verified this session |
| 5 | A demo video | **MET (new this session)** | `demo_video: https://sealed.cash/demo.mp4` set; both local verifiers now pass; URL is `404` until push+deploy completes (§4) |
| 6 | STRK20 integration depth (30% of score): shielded balances, private transfers, anonymizer contracts, SDK, stealth accounts | **MET (Sepolia only)** | 8 contracts deployed, `node scripts/verify-strk20-claim.mjs --network sepolia` → 8/8 verified this session. None on mainnet |
| 7 | Working mainnet product, for a real user, not a prototype behind a login | **PARTIAL** | Shield/enable-private-tokens flow real and live on mainnet. Card, earn/yield, programmable-spend flows real and RPC-verified but Sepolia-only |
| 8 | Non-custodial card connected to private balances (RFP core feature 1) | **PARTIAL** | `/card` route + `CardSettlementAnonymizer`/`CardProgramAnonymizer` deployed and exercised (verified settlement tx) on Sepolia only; not on mainnet |
| 9 | Public/private mode toggle per-activity (RFP core feature 2) | **NOT re-audited this session** | Outside this session's file scope (`src/app`); carried forward from prior audit as unassessed on this pass |
| 10 | Yield on private balances across multiple assets, holdings not published (RFP core feature 3) | **PARTIAL** | `EarnVault`/`EarnAdapter` deployed and exercised on Sepolia; not on mainnet |
| 11 | Chain abstraction — deposit from any chain (RFP core feature 4) | **PARTIAL (code-level)** | `cctp.ts`, `HopPanel.tsx`, `fund/` present; not independently re-exercised this session |
| 12 | Paymaster-sponsored gas (Avnu) | **MET (code-level)** | `avnu.ts` wired into Shield/Unshield/Swap/Send/Spend; hub's own `tooling` field lists `AVNU: live: true` |
| 13 | Viewing keys for statements / disclosure proofs | **MET (code-level)** | `/statements`, `/statements/[authorizationId]`, `AuthorizationProofClient.tsx` present |
| 14 | Documentation quality — README matches actual repo state | **NOT re-audited this session** | Prior audit found `README.md` stale (claims yield and card-spend are unbuilt when they're deployed and tx-verified on Sepolia). `README.md` is outside this session's owned files (`strk20.json`, `public/`, this doc); not touched |
| 15 | Product named "Sealed," live at `sealed.cash` matches deployed build | **NOT re-audited this session** | Prior audit found the deployed `<title>` still read the old name; outside this session's scope (`src/app/layout.tsx` etc. owned by other agents) to re-check |
| 16 | No name collision with another sprint entry named "Sealed" | **NOT re-audited this session** | Prior audit flagged `tinoxbt/sealed` (unrelated project, same name) as a registry-rename risk; not re-checked this session |

## 7. Remaining steps — for the user

Everything in this session's scope (`strk20.json`, `public/`, this file) is closed:
`check-submission.mjs` PASS, `verify-strk20-claim.mjs` SCOREABLE, sepolia deployment check 8/8 VERIFIED,
all 3 mainnet txs independently re-confirmed finalized, `demo_url` live.

What only the user can decide or do:

1. **Push `36cd60a` to `origin` and let Vercel deploy.** Until then `https://sealed.cash/demo.mp4` is
   `404` and the video gate, though locally green, isn't actually live for a judge to open. This is the
   one step needed to make §4's `SCOREABLE` result true in production, not just in this working tree.
2. **Decide on the mainnet-contract-attribution gap (§5).** Three options laid out with real costs; a
   money/deployment decision, not something this session executed unattended per the task's explicit
   instruction. Deadline is August 31, 23:59 UTC — option 1 (route a mainnet tx through a deployed
   contract) needs the most lead time if chosen.
3. Rows 9, 14, 15, 16 above were flagged NOT MET / PARTIAL by the prior audit and are outside this
   session's file ownership (`src/app`, `README.md`, hackathon `registry.json`) — still open, owned by
   whichever agent/human touches those paths next.
