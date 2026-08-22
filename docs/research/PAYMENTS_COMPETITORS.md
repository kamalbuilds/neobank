# Payroll and payouts competitors on STRK20

Adversarial audit, 22 August 2026. Every claim below was checked against cloned source
and against Starknet mainnet over RPC. READMEs were treated as marketing, not evidence.

## Method

- `gh repo clone OWNER/REPO --depth 50`, then `git fetch --unshallow` where the depth capped out.
- Source-only greps for the real API surface: `strk20InvokeTransaction`, `strk20Balances`,
  `STRK20_ACTION`, `WalletAccountV6`, `walletV6`, `privacy_invoke`, and the pool address
  `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`. Docs, `.agents/`
  skill copies and `.env.example` were excluded, because the sprint's skill pack ships the
  pool address to everyone and matching on it proves nothing.
- Every claimed contract address hit `starknet_getClassHashAt` on mainnet
  (`https://rpc.starknet.lava.build`) and on Sepolia (`publicnode`, `cartridge`).
- Every claimed transaction hash hit `starknet_getTransactionReceipt` on mainnet, and the
  receipt was searched for a pool event.
- Four forks were diffed file by file against the STRK20 starter kit, extracted from
  `0xrlawrence`-unrelated `joeerit0/envelope` at commit `187fe78` (the last upstream
  starter-kit commit before it was rebranded). That diff is what separates a product from
  a rename.

Two important structural findings came out of the method itself and colour everything below.

**Finding A: the shared starter kit fakes a deployed contract.** `cairo/src/lib.cairo` in
shadowpay, veilpay, veilpayouts and joeerit0/envelope is byte-identical
(`sha1 f3beffff1bb07e09bc8f4c1d43e822a374faf0b1`), and all four carry the same
`cairo/address.md`:

```
contract class hash : 0x2a4482a13cb7f70dce6f7ba99c4ee6ce404379abeddd9b831b6bf24eb71e137
contract address (mainnet) : 0x78ae662e0cc6d1ab2cfeaf2a51ba8783d88e31886f88a794d142f95a6f8735b
```

That contract **is** live on mainnet, and its `get_invoke_count()` currently returns `0x11`
(17). But the commit history of `cairo/address.md` in joeerit0/envelope shows it was authored by
PhilippeR26 on 2026-06-29 as part of the starter kit. In shadowpay, veilpay and veilpayouts
it arrives in the *initial scaffold commit* and `cairo/` is never touched again, one commit
each. None of those three deployed anything. If a judge counts that address as their
"deployed anonymizer", they are crediting the starter kit's author.

**Finding B: the payroll lane is not eight projects, it is at least eighteen.** Searching
`registry.json` (122 entries) for payroll, payout, salary, invoice, disbursement, bounty and
claim vocabulary returns: paybook, veilpay, shadowledger, sable, veilpayouts, CloakPay,
BlindPay, Cistern, shadowpay, almoner, kese, Claim-Links, stealth-checkout, redpocket,
sevrin, ghostbounty, crosslink, 0xrlawrence/envelope. Two registry one-liners are *literally
identical strings*: Ololadestephen/paybook and OpenDagri/veilpay both read "Private payroll
with scoped disclosure. Public can verify a run; only the payee or auditor can open a slice."
Both are copied verbatim from RFP-11.

**Baseline for comparison, where we actually stand.** `kamalbuilds/neobank`: 44 commits,
1 author, 14–22 Aug, 3 active days. `strk20.json` carries 3 mainnet hashes, all SUCCEEDED,
but `0x02cbfcce…a735` is a `deploy_account` with **zero pool events**, so our eligible
count is **2**, not 3. Zero Cairo, zero deployed contracts. Our STRK20 surface is
`src/app/components/lib/strk20.ts` (`strk20InvokeTransaction`, `strk20Balances`, error
classification for all six spec error names, `ensureAccountDeployed` folding DEPLOY_ACCOUNT
into the first shield). We do not batch: `SendPanel.tsx` sends one recipient.

A sweep of all 122 registry repos for a root `strk20.json` returned 100 manifests. 27 carry
at least one real hash; 25 declare at least one contract. The leaders are
`kshitij-hash/nightshift` (10 tx, 4 contracts), `OoJae/aperture-strk20` (7 tx, 4 contracts),
`justbiar/aegis` (7 tx, 1 contract), `bongbongcrypto/stealth-checkout` (7 tx, 0). We sit
around 18th of 27 on transactions and last-equal on contracts.

---

## OpenDagri/veilpay: REAL

Registered as "Private payroll with scoped disclosure". Not one of the eight the brief named,
but it is the strongest *payroll* competitor in the sprint and it beats us on the one number
judges can verify without reading code.

**Pool integration: real, and it is the only payroll project with a batched run proven on
mainnet.** `src/lib/payroll/actions.ts:21` builds one `WALLET_API.STRK20_ACTION[]` containing
every recipient's transfer. `src/lib/payroll/executor.ts` submits that array in a *single*
`strk20InvokeTransaction`, derives per-recipient status from the one shared receipt, and
asserts mainnet chain ID and the mainnet STRK token address before submitting
(`assertMainnetChain`, `assertStrkMainnetToken` from `src/lib/starknet/networks.ts`).
`src/app/components/client/Payroll/PayrollTab.tsx` is 859 lines.

**Transactions: 6, all verified.** Every hash in `strk20.json` returns SUCCEEDED on mainnet
and every receipt contains the pool address:

| hash | block | pool events |
|---|---|---|
| `0x2099783…0b072` | n/a | yes |
| `0x647a43d…b29de` | n/a | yes |
| `0x80020f3…54a` | n/a | yes |
| `0x73eb51f…7da15` | 13480700 | 3 events with key `0x23c20207be8b1e…` |
| `0xa5fae06…9e551` | n/a | yes |
| `0x5e8793a…dcb78` | 13542881 | 2 events with key `0x23c20207be8b1e…` |

The multiple same-key pool events in a single INVOKE are the fingerprint of a real
multi-recipient batch landing in one transaction. That is the exact claim we would have to
make, already proven.

**Contracts: none of their own.** `cairo/` is the starter kit verbatim, see Finding A.

**Activity: 17 commits, 3 authors, 15–19 Aug, 5 active days. Nothing since 19 August.**
Their own README still says "Status: Milestone 0, bootstrap", which understates the repo.

**What is genuinely good.** Three things. (1) The single-transaction batch, which is the
right reading of the pool's flat per-`apply_actions` fee. (2) `src/lib/demo/generator.ts`
opens with a comment stating in plain language that display names and salary figures are
FICTIONAL while `executionAmount` is a real `SAFE_EXECUTION_AMOUNT = 1e15` (0.001 STRK) that
actually moves. A demo that is safe on mainnet and honest about it. (3) The executor's
chain-ID and token-address assertions run as a backstop *inside* the executor, not only in
the UI.

---

## A-Raphie/shadowpay: PARTIAL

**Pool integration: real but naive.** `src/app/components/ShadowPayPayroll.tsx:67` calls
`myWalletAccount.strk20InvokeTransaction(actions)` inside a `for` loop over roster rows:
one action array of length one per employee. Paying 5 people is 5 wallet approvals, 5 STARK
proofs and 5 pool fees (6 STRK each, so 30 STRK instead of 6). The README calls this "Org ·
batch pay (private)". It is not a batch. Their own README table showing "50 recipients,
batched" economics is contradicted by their code.

**Transactions: 0.** `strk20.json` is `{"transactions": [], "contracts": [], "demo_video":
"", "demo_url": "https://shadowpay-green.vercel.app"}`. No mainnet evidence at all.

**Contracts: none of their own.** Starter-kit `cairo/address.md`, see Finding A. One commit
ever touched `cairo/`.

**Activity: 7 commits, 1 author, 20–22 Aug, 2 active days.** Pushed this morning, so it is
live work, but it is three days old.

**Diff against the starter kit:** one new file (`ShadowPayPayroll.tsx`), 68 changed lines in
`WalletAccountV6Tag.tsx`, plus CSS and copy. Real work, small work.

**What is genuinely good.** The README's "What is private, what is not" table is the most
disciplined honesty framing in this cohort. It names the relayer as the visible sender,
concedes deposits and withdrawals are public and screened, and concedes shared-anonymizer
DeFi leaks amount and timing. It also correctly documents that the wallet substitutes the
`"OPEN"`, `"${poolAddress}"` and `"${openNoteIds[0]}"` placeholders and that they must never
be hex-normalized. Their compliance-screening error handling (`/screen|compliance|denied|
blocked/i` on the thrown message, with a "try smaller amount" hint) is a UX detail we do not
have.

---

## 0xrlawrence/envelope: REAL (and this is the envelope in the registry)

The brief named `joeerit0/envelope`. The registry entry under `IDEA-09` is
**`0xrlawrence/envelope`**. They are different repos by different people with the same name,
and the registered one is far more dangerous.

**Pool integration: deep.** `strk20InvokeTransaction` at `web/app/page.tsx:354` and `:622`,
`web/app/refund/page.tsx:191`, `web/app/claim/page.tsx:261`, plus an SDK at
`packages/envelope-sdk/src/index.ts` that exports the action lists as a library surface.
`web/app/page.tsx:749` shows a dual route: `strk20InvokeTransaction` when the source is
shielded, `execute` when it is a normal wallet, so a normal-wallet envelope can still pay a
bare Starknet address with no registration.

**Contracts: a genuine original anonymizer, Sepolia only.**
`cairo/src/envelope.cairo` is 519 lines, `cairo/src/tests/envelope_test.cairo` is 652,
plus `types.cairo` (91), `mocks.cairo` (78), `erc20.cairo` (16). Deployed on **Sepolia** at
`0x04ff4f083a4667930efe14963645f9bda00bb10d44e4c13a9ee808e66c076211`
(class `0x3e66d5a…f4d5`, confirmed live over Sepolia RPC). On **mainnet** the same address
returns "Contract not found", and `docs/MAINNET.md` says so itself: "Mainnet | | Not yet
deployed". They also verified `pool()` on the previous Sepolia deployment with `sncast`.

**Transactions: 0.** `strk20.json` transactions array is empty; contracts array holds the
Sepolia address, which is a mainnet-eligibility miss.

**Activity: 128 commits, 1 author, 14–21 Aug, 8 active days.** Repo is 59 MB. Published npm
package `strk20-envelope-cli@0.1.4` (last modified 19 Aug), live app on GitHub Pages, and a
dedicated `/agent/` surface.

**What is genuinely good, and what we should copy.** `docs/MAINNET.md` cross-checks the pool
address against two independent sources, the sprint Day-0 doc *and* `PRIVACY_POOL_ADDRESS`
in `@avnu/avnu-sdk@4.2.0`, and states the reason: "Guessing at a pool address produces
failures that look exactly like a bug in your own contract". It also records the Sepolia pool
address from the same SDK, and records that Scarb 2.15.1 declared fine so the starter kit's
newer pin is not a requirement. That file is a better artifact than most of these repos'
entire codebases. The npm CLI plus an agent-facing web surface is a distribution move nobody
else in this lane made.

---

## joeerit0/envelope: PARTIAL

Not in the registry under this owner. Judge accordingly, but its idea is the one that
directly attacks our payroll story.

**Pool integration: real, and it is the correct batch.**
`src/app/components/client/WalletHandle/EnvelopePanel.tsx:224` maps every valid payee into
one `STRK20_ACTION[]` and line 189 submits that array in a single
`strk20InvokeTransaction`. The in-code comment is exact: "Every payee is one transfer action
inside a single pool transaction: one STARK proof, one fee, and no separate on-chain event
per person to correlate." Also calls `strk20Balances([])` at line 273. Roster persists to
`localStorage`.

**Transactions: 0.** Empty `strk20.json`.

**Contracts: none of their own.** Starter kit, Finding A.

**Activity: 4 commits of their own** (17–18 Aug) on top of a 67-commit starter-kit history
that dates to 2024-04-24 and is authored by PhilippeR26 (38 commits) and Akash (7). Total
`git rev-list --count` reads 71, which is misleading; the project is a two-day rebrand.
Nothing since 18 August.

**What is genuinely good.** The framing sentence, "Paying five people costs what paying one
costs, and looks like a single opaque operation from the outside", is the single best
one-line articulation of why private payroll on STRK20 is a product and not a feature. It is
also the exact argument shadowpay's implementation contradicts and ours does not yet make.

---

## HarishMelwani/veilpayouts: VAPOR

The README is a complete product spec: claim links, on-chain commitments, secret-proof
claims, expiry refunds, a company dashboard with pending/claimed/expired status, a
`docs/PRIVACY-MODEL.md`. None of it exists in the source.

**Evidence.** `grep -rn "claim\|Claim" --include='*.ts*' src` returns **zero matches**.
`src/` contains exactly nine files and every one is the starter kit. Full diff against the
starter kit:

- `src/app/components/client/WalletHandle/WalletAccountV6Tag.tsx`: **11 changed lines**, being
  one `strk20Capable` selector, one copy tweak on the shield label, and an eight-line
  "install Ready" warning banner.
- `src/utils/constants.ts`: RPC fallbacks so no Alchemy key is needed.
- `SelectWallet.tsx` and `walletContext.ts`: minor.

That is the entire delta. The one `strk20InvokeTransaction` call at
`WalletAccountV6Tag.tsx:220` is the starter kit's generic submit helper, unchanged. The
"echo-helper deploy" button visible in the code is the starter kit's, not theirs.

**Transactions: 0.** Empty `strk20.json`. **Contracts: none of their own**, starter-kit
`address.md`, Finding A. **Activity: 7 commits, 1 author, all on 16 August, 1 active day.
Nothing in six days.** The first commit message reads "Initial scaffold: VeilPoker for the
STRK20 Private Sprint" and the second is "Rebrand to VeilPayouts". This was a poker project
for about ninety minutes.

**What is genuinely good.** The README's problem statement is sharp and correct: "you cannot
privately transfer to someone who hasn't registered a viewing key yet." That constraint is
real and it is the one thing that makes payouts harder than payroll. They identified it and
built nothing for it.

---

## raizo07/BlindPay: VAPOR (on Starknet)

**Pool integration: two lines, bolted onto an Ethereum app.**
`frontend/src/hooks/useStrk20.ts:25` and `:51` are the only STRK20 calls in the repo. There
are **zero `.cairo` files**. The "privacy escrow" the README describes is Solidity:
`contracts/scripts/deploy.ts` opens `import { ethers } from "hardhat"` and proceeds to deploy
`MockUSDC`, `MockDAI` and `MockUSDT`. Mock tokens, on an EVM, in a Starknet privacy sprint.

**Transactions: 0.** No root `strk20.json` at all, a straight eligibility failure.

**Contracts: 0 on Starknet.**

**Activity: 1 commit, 1 author, 19 August.** A single squashed dump of a pre-existing
codebase.

**What is genuinely good.** The surface area is impressive and worth stealing the shape of:
an SDK (`packages/sdk` with `resources/invoices.ts`, `checkout.ts`, `webhooks.ts`), a CLI
(`packages/cli`), and an **MCP server** (`packages/mcp-server` with `create-invoice`,
`list-invoices`, `get-invoice`, `get-stats`, `create-checkout` tools). Nobody else in this
lane exposes an MCP surface. The Stripe-shaped merchant API framing is the right commercial
instinct even though the Starknet implementation is not there.

---

## mateojkk/Nomada: VAPOR

**Pool integration: three calls, in a repurposed FHE app.**
`src/lib/chat/commandFlow.ts:59`, `:81`, `:103` handle `deposit`, `withdraw` and `transfer`
as chat commands, one action each, no batching. That is the whole STRK20 integration.

The repo is an **Ethereum Sepolia confidential-token app** wearing a Starknet hat. It ships
`hardhat.config.ts` (`solidity: "0.8.35"`), `src/wagmi.ts`, `ignition/modules/
ConfidentialToken.ts`, and `src/lib/noxSdk.ts`, an iExec Nox / `@iexec-nox/handle` FHE
wrapper pointing at `gateway-testnets.noxprotocol.dev` and chain ID 11155111. Also
`requirements.txt` and `test_db.py`, i.e. a Python backend from a previous life.

**Transactions: 0.** Empty `strk20.json`. **Contracts: 0 Cairo.**
**Activity: 3 commits, 1 author, all on 15 August, 1 active day. Nothing in seven days.**

**What is genuinely good.** The conversational command surface (`shield 10`, `send 5 to
Alice`) is a legitimately nice consumer interaction, and their graceful-degradation copy
fires per-command rather than once at connect. That is better placement than a global banner.

---

## Gedion08/Nexora-Protocol: VAPOR

The most confident README in the set ("Target: first place") over an integration that cannot
work.

**Pool integration: none.** `grep -rn "strk20InvokeTransaction\|strk20Balances\|
WalletAccountV6"` across all TypeScript returns **zero matches**. The pool address appears 29
times, but in `.env.example`, docs, and, revealingly,
`packages/relayer/tests/inventory.test.ts:28-32`, where the same pool address is
simultaneously assigned to `poolAddress`, `privacyHubAddress`, `relayerStarknetAddress` and
`relayerInventoryAddress`. Four different roles, one copy-pasted constant. Those tests cannot
fail on anything meaningful.

**The Cairo invents a pool ABI that does not exist.**
`packages/contracts/src/nexora_privacy_hub.cairo:21` declares
`trait IStrt20Pool` (note the typo) with `register_viewing_key(public_key)`,
`shield(token, amount, user, viewing_key, proof)`, `unshield(...)` and
`transfer(to, token, amount, proof)`. The real pool has no such entrypoints. It exposes
`apply_actions`, driven through the Wallet API. The contract is tested against
`packages/contracts/tests/mock_strk20_pool.cairo` (259 lines), a mock of an interface that
was made up. 327 lines of Cairo compiled against a fiction.

**Transactions: 0 real.** `strk20.json` literally contains
`"hash": "REPLACE_WITH_REAL_MAINNET_TX_1"` with `"status": "pending"`, three times.

**Contracts: 0.** The declared `class_hash`
`0x07bdccfb596c90671b233ae045135a1caee9312c76122f92d99f36d95e1aa393` is **not declared on
mainnet** (`starknet_getClass` returns no result) and the address is not a contract.

**Activity: 16 commits, 2 GitHub identities that are the same person, 14–22 Aug, 7 active
days.** Actively worked on, which makes the hollowness more notable.

**What is genuinely good.** The multichain framing (deposit on Arbitrum/Base/Ethereum/Solana,
hold as STRK20 notes, withdraw to a fresh address on any chain) is a genuinely bigger story
than ours, and it is adjacent to the CCTP hop we already have working in
`src/app/components/lib/cctp.ts`. Their "privacy score per route" UI concept is a good idea
that CaptainDiv/crosslink is actually building.

---

## leojay-net/almoner: PARTIAL, and the most dangerous thinking in the sprint

`https://github.com/leojay-net/almoner`, registry name "Almoner", category **Infra** (chosen
deliberately to dodge the crowded Payments category, and they say so).

**Pool integration: real Wallet API calls plus the only correctly-specified original
anonymizer.** `apps/web/src/components/payer-panel.tsx:152` and `claim-panel.tsx:127` call
`strk20InvokeTransaction`. `contracts/src/escrow.cairo` is 370 lines with a `privacy_invoke`
entrypoint at line 77 returning `Span<OpenNoteDeposit>`, plus `fund(allocations)`,
`redeem(...)`, `refund`, `refund_batch`, `get_allocation`, `get_outstanding`, `privacy_pool`,
and `compute_commitment_hash`. Tests: `contracts/src/tests/test_escrow.cairo`, 432 lines.
`packages/strk20-capability/src/detect.ts` contains the sharpest detail in the cohort: an
explicit warning at line 73 **not** to feature-detect by calling `strk20Balances`, because
that reads the user's private balance and triggers a consent prompt. Their test at
`detect.test.ts:80` asserts `strk20Balances` was **not** called. That is a check that can
fail.

**They reverse-engineered the pool's fee economics from the deployed contract, not the
docs.** `README.md`: `collect_fee()` runs exactly once per `apply_actions` call, so 50
recipients batched costs 6 STRK total (0.12 each) versus 300 STRK sequentially. And the
asymmetry nobody else spotted: `__execute__` extracts exactly one
`(user_addr, user_private_key)` per transaction, so **cross-payer batching is structurally
impossible**. The pool is cheap for paying many and expensive for collecting from many.
Their `docs/STATE.md` also records the `ViewingKeySet` selector
(`0x1321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf`) and the pool deploy
block 8,978,970 as the floor for every event query.

**Transactions: 0. Contracts: 0 deployed.** `strk20.json` is entirely empty. The escrow is
written but not declared anywhere.

**Activity: 55 commits, 1 author, 21–22 Aug, 2 active days.** This project is **one day old**
and already has more correct protocol understanding than anything else here. That velocity
is the threat, not the current state.

**What is genuinely good.** `docs/STATE.md` keeps an explicit blockers table. B1 "Does any
wallet implement STRK20 on mainnet? Open, blocking", B6 "Escrow contract has had no human
security review. It holds real funds", B7 "Calldata layout for `privacy_invoke` is written to
spec, never exercised against the real pool". They also plan to settle B7 with
`strk20PrepareInvoke(actions, true)`, a dry run that proves without submitting. We are not
using `strk20PrepareInvoke` at all and we should be. Their decision log records *why* they
picked Infra over Payments: "Payments has 23 entries and DeFi 18."

---

## Leequidice/Claim-Links: PARTIAL

Registry lists `Leequidice/Claim-Links` (the brief's "ClaimLinks"). Same owner also has
`Leequidice/GhostLine` registered.

**Pool integration: real, and the design idea is excellent.**
`cairo/src/lib.cairo` is 157 lines, a *modified* starter-kit helper, not the verbatim copy
the other forks carry. It adds `claim(note_id, recipient)` and
`get_claim(note_id) -> (ContractAddress, u128, bool, ContractAddress)` alongside the standard
`privacy_invoke`. `src/utils/claimEscrowAbi.ts` is a new file; `src/app/claim/[noteId]/
page.tsx` is a new route; `WalletAccountV6Tag.tsx` has **165 changed lines** against the
starter kit, the second-largest delta of any fork.

**The key insight:** the pool generates a fresh `note_id` on every withdraw, so it doubles as
the claim code. No separate secret generation, no backend. That is a cleaner claim-link
design than veilpayouts described and never built, and cleaner than anything requiring a
commitment scheme.

**Transactions: 0. Contracts: 0 deployed.** `cairo/address.md` has the fields present and
**blank**: "contract class hash:", "contract address (sepolia):", "contract address
(mainnet):". Nothing declared. `strk20.json` empty.

**Activity: 1 commit, 1 author, 17 August, by "Claim Links Builder
<builder@claim-links.local>".** A single squashed dump from a synthetic git identity, and
nothing in five days. The code is real; the project may not be.

**What is genuinely good.** Recipients claim with **any** Starknet wallet, with no privacy-pool
support required on their side, and they can re-shield afterwards if they want. That
sidesteps the registration constraint veilpayouts identified and gave up on, and it is the
single most useful primitive for the payouts half of our Phase 1.

---

## Secondary payroll competitors (triaged, not deep-dived)

Included because the brief asked how crowded the lane is, and eight repos badly understates it.

| Project | State | Evidence |
|---|---|---|
| `ahmetenesdur/kese` | **REAL, blocked** | 73 commits in 1 day (21 Aug). `contracts/escrow-claim/src/escrow.cairo` 349 lines + 472 test lines. Escrow **deployed and live on mainnet** at `0x4b41a56…4999f3`, block 13640339, and I called `pool()` on it and it returns the exact mainnet pool address. Claim-link escrow for unregistered recipients, policy engine, Telegram approval, viewing-key audit. But `strk20.json` transactions are `TODO_MAINNET_TX_HASH_1_touching_pool` and `SUBMISSION.md` states plainly why: they took the **SDK route**, which needs a proving service that does not exist publicly (upstream issues #121, #124, #135, #147; six teams blocked). They have the best contract and zero transactions. We took the Wallet API route and have transactions. |
| `Ololadestephen/paybook` | PARTIAL, abandoned | 42 TS files, `cairo/src/book.cairo` 131 lines + 99 test lines, `strk20InvokeTransaction` at `web/app/lab/page.tsx:102`, `:118` and `web/app/company/page.tsx:164`. **9 commits, all on 14 August. Nothing in 8 days.** Empty `strk20.json`. |
| `Avinash1286/shadowledger` | PARTIAL | 63 TS files, `contracts/src/lib.cairo` 197 lines + 276 test lines, `strk20InvokeTransaction` at `apps/web/lib/strk20/client.ts:133`, `:162`, noting `[action]`, singular, so no batching. Contract is **devnet only**: `contracts/deployments/devnet.json`. Empty `strk20.json`. 9 commits, 15–21 Aug. |
| `ronkenx9/sable` | VAPOR | **Zero `.ts`/`.tsx` files.** README only. 2 commits, 15 August. |
| `Samuel1505/Cistern` | VAPOR | **Zero source files.** 1 commit, 20 August. Empty `strk20.json`. |
| `noisyboy08/CloakPay` | VAPOR | **Zero source files.** 2 commits, 19 August. Empty `strk20.json`. |
| `OpenDagri/veilpay` vs `Ololadestephen/paybook` | n/a | Byte-identical registry one-liners, both lifted from RFP-11. |

---

## Blind spots in this audit

Stated so nobody treats it as more complete than it is.

- **Snapshot, 22 August.** Nine days remain. Every VAPOR verdict here can be falsified by a
  competitor shipping this week. almoner (55 commits/2 days), kese (73/1 day) and
  0xrlawrence/envelope (128/8 days) are moving fast enough to invalidate their entries.
- **22 of 122 registry repos returned no root `strk20.json`** on `main`, `master` or
  `develop`. Those are either non-starters or use a non-standard branch; I did not resolve
  each default branch individually. The registry-wide ranking is over the 100 that responded.
- **I could not read the pool's event ABI.** "Pool event" means the receipt contains the pool
  contract address as an event emitter. I did not decode event names, so "3 pool events =
  3 recipients" for veilpay is a strong inference from event-key repetition, not a decode.
- **Frontends were read, not run.** No competitor demo was exercised in a browser with a Ready
  wallet. A repo can compile, contain correct calls, and still fail at the wallet boundary.
- **kese's mainnet escrow is deployed and answers `pool()` correctly, but I did not verify
  that anything has ever flowed through it.** shadowpay's inherited starter-kit helper is the
  only contract here whose usage counter I read (17 invocations, and they are the starter
  kit's, not shadowpay's).

## Ranked threat list

Ranked by damage to *our* Phase 1 payroll and payouts roadmap, not by overall project quality.

**1. `OpenDagri/veilpay`: highest immediate threat.**
The only project in the sprint that has proven a batched multi-recipient private payroll run
on mainnet, with 6 verifiable hashes to our 2. If a judge asks "who has actually done private
payroll", the receipts point here. Mitigating factor: stalled since 19 August, no original
contract, README undersells itself.

**2. `ahmetenesdur/kese`: highest threat on integration depth.**
The only project with an original, mainnet-deployed, pool-bound Cairo contract that I could
verify by calling it. Integration depth is 30% of scoring and kese wins that axis outright.
Its claim-link escrow directly occupies our payouts half. Mitigating factor: zero
transactions and structurally blocked on a proving service they do not control.

**3. `leojay-net/almoner`: highest trajectory threat.**
One day old, 55 commits, and the only team that derived the pool's fee asymmetry from the
deployed contract. If they deploy the escrow and land three transactions before the 31st,
they overtake almost everyone. They also correctly gamed the category (Infra, not Payments).

**4. `0xrlawrence/envelope`: highest craft threat.**
128 commits, a 519-line original anonymizer with 652 lines of tests, a published npm CLI, a
live app and an agent surface. Only weakness is Sepolia-only deployment and zero mainnet
transactions, which is a fixable weakness with nine days left.

**5. `joeerit0/envelope`: highest narrative threat.**
Low activity, no receipts, unregistered owner. But it owns the sentence that makes this
category a product, and it implements the batch correctly. If anyone repeats that line in a
demo, it lands.

**6. `Leequidice/Claim-Links`: highest idea threat.**
The `note_id`-as-claim-code trick is the cleanest solution to the unregistered-recipient
problem in the sprint. One commit from a synthetic identity, so it probably will not ship,
but the idea is free for anyone to take, including us.

**7. `A-Raphie/shadowpay`: active but shallow.**
Pushed today, so it is not dead. But it loops instead of batching, has zero transactions and
no contract of its own. Its honesty table is better than its code.

**8. `Avinash1286/shadowledger` / `Ololadestephen/paybook`: real code, no proof, stalling.**

**9. `Gedion08/Nexora-Protocol`: noisy, not dangerous.**
Zero Wallet API calls, an invented pool ABI, placeholder hashes. Only ranks this high because
it is actively pushed and its multichain narrative reads well to a judge who does not open
the source.

**10–12. `HarishMelwani/veilpayouts`, `raizo07/BlindPay`, `mateojkk/Nomada`: not threats.**
An 11-line diff over a starter kit, a Solidity app with mock tokens, and an FHE-on-Ethereum
chat app respectively. All three have a README describing a product that does not exist in
the repository.

**13+. `sable`, `Cistern`, `CloakPay`: zero source files.**

---

## Is private payroll still an open lane?

**The generic lane is taken. The specific lane is wide open, and it is narrower than
"payroll".**

Taken, concretely:

- "Private payroll on STRK20" as a *positioning* is claimed by at least seven registry
  entries and two of them use RFP-11's wording verbatim. Saying it earns nothing.
- The *batched multi-recipient run* is done and proven on mainnet by veilpay, and implemented
  correctly (unproven) by joeerit0/envelope. If our Phase 1 is "batch pay your team from a
  shielded balance", we would be the third team to build it and the second to prove it.
- The *claim-link payout to an unregistered recipient* is designed by Claim-Links, deployed
  on mainnet by kese, written but undeployed by almoner, and specced-not-built by
  veilpayouts. Four teams, one shipped contract.
- The *original anonymizer contract* axis, worth 30% of the score, is won by kese on mainnet
  and 0xrlawrence/envelope on Sepolia. We have zero Cairo. This is our worst gap and it is
  not a positioning problem, it is a missing artifact.

Open, concretely:

- **Nobody has a working payroll with mainnet receipts *and* an original deployed contract.**
  veilpay has receipts and no contract. kese has a contract and no receipts. That intersection
  is empty and it is the highest-scoring square on the board.
- **Nobody is blocked the way kese is blocked, except us in reverse.** Six teams filed
  upstream issues because the SDK route needs a proving service that does not exist. We took
  the Wallet API route and have two pool transactions to show for it. Every SDK-route team is
  stuck behind a maintainer reply; we are not.
- **Nobody has connected private payroll to getting money *out* to a human.** We have a
  working CCTP hop (`src/app/components/lib/cctp.ts`, Circle CCTP V2 Standard Transfer,
  Solana base58 decoding verified against three known mainnet addresses) and an AVNU swap
  path. Not one competitor in this lane has an off-ramp story. "Pay your team privately, and
  they can actually spend it" is a sentence only we can say.
- **Nobody uses `strk20PrepareInvoke`.** Only almoner even mentions it, as a plan. A dry-run
  preview that proves the payroll batch without submitting is both a better UX and a better
  demo than any competitor has.
- **Category arbitrage.** Counted from `registry.json` (122 entries): Payments 23, DeFi 18,
  Infra 13, **Consumer 9**, Tooling 6, Gaming 5, 39 uncategorised. We are registered under
  Consumer, the least crowded named category with real entries, and less than half the size
  of Payments. Almoner explicitly moved to Infra for exactly this reason. Repositioning our
  payroll work *into* the Consumer frame, a personal money account whose owner happens to
  run payroll, is a defensible lane no Payments entry can follow us into.

Recommendation in one line: **do not build "private payroll". Build the one thing that is
empty: a batched payroll that runs in a single `strk20InvokeTransaction` through our own
deployed Cairo anonymizer, with the resulting mainnet hashes in `strk20.json`, and an
off-ramp on the far side.** That intersection is unoccupied, it maps directly onto the 30%
integration-depth criterion where we currently score zero, and every piece except the Cairo
contract already exists in our repo.

Immediate corrections regardless of lane:

1. Our `strk20.json` claims 3 transactions but one is a `deploy_account` carrying **zero pool
   events**. Effective count is 2. Land more, and annotate the deploy honestly.
2. We have **zero Cairo**. Seven projects in this lane have original Cairo (almoner, kese,
   0xrlawrence/envelope, Nexora, shadowledger, paybook, Claim-Links) and four more carry the
   starter kit's. Across the whole registry, 25 of 100 manifests declare a contract. Exactly
   one of the payroll cohort, kese, has an original contract I could call on mainnet.
3. `SendPanel.tsx` sends one recipient per transaction. The pool charges 6 STRK per
   `apply_actions` regardless of action count. We are leaving the entire economic argument on
   the table.
