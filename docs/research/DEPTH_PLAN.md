# Depth plan: maximising "STRK20 integration depth" by Aug 31

Date: 2026-08-22. Nine days left. Criterion under attack: **30% STRK20 integration depth,
shielded balances, private transfers, anonymizer contracts, the SDK, using stealth accounts**
(quoted verbatim from `starkience/strk20-hackathon` README).

Where we stand against the five named sub-items today:

| Named in the rubric | Us today |
|---|---|
| Shielded balances | Done. Consented `strk20Balances` read, live. |
| Private transfers | Coded, never exercised on mainnet. |
| Anonymizer contracts | **Zero.** |
| The SDK | **Zero.** |
| Stealth accounts | **Zero.** |

Two of five are at zero and one is unproven. This document says which of those are worth
closing in nine days and which are not.

---

## 1. Ground truth established for this plan

Everything below was verified directly today, not read from a blog. Commands are reproducible.

### 1.1 The live mainnet pool lets ANY contract be an anonymizer, permissionlessly

This is the finding the whole plan turns on.

The pool's `InvokeExternal` client action validates exactly one thing:

```cairo
// starknet-privacy packages/privacy/src/actions.cairo
pub(crate) impl InvokeExternalInputValid of InputValidation<InvokeExternalInput> {
    fn assert_valid(self: InvokeExternalInput) {
        let InvokeExternalInput { contract_address, calldata: _ } = self;
        assert(contract_address.is_non_zero(), errors::ZERO_CONTRACT_ADDRESS);
    }
}
```

No registry. No allowlist. No whitelist. The pool calls `privacy_invoke` on whatever address
you name, once per transaction, atomically inside the user's proven pool transaction.

The only gate that could apply is on an anonymizer that returns funds *into* the pool as an
open note. On the **deployed mainnet pool** that gate is a blocklist, and the blocklist is
empty:

```
$ pool.get_version()                                  -> 0x322e30  ("2.0")
$ pool.is_paused()                                    -> 0x0
$ pool.get_fee_amount()                               -> 0x53444835ec580000 (6 STRK)
$ pool.is_open_note_depositor_blocked(<any address>)  -> 0x0
$ OpenNoteDepositorBlockSet events, all history       -> 0
```

The deployed ABI carries `is_open_note_depositor_blocked` / `set_open_note_depositor_blocked`
and the event `OpenNoteDepositorBlockSet`. Nobody has ever been blocked.

**GitHub `main` has already moved past what is deployed.** The unreleased branch replaces the
blocklist with a per-depositor `OpenNoteScreeningPolicy` whose default is `Required`, settable
only by the app governor. The SDK changelog states it plainly:

> **Breaking** ... The pool's boolean depositor block list is retired: `is_open_note_depositor_blocked` /
> `set_open_note_depositor_blocked` are gone from the ABI ... No policy rejects a depositor; one the
> screener refuses simply gets no attestation.

Consequence for us, and it drives the design choice in section 3:

- An anonymizer that returns an **empty** span (money leaves the pool and does not come back)
  never becomes a screening subject under either the deployed model or the unreleased one. It
  is immune to a mid-sprint pool upgrade.
- An anonymizer that **returns open notes** works permissionlessly on mainnet *today*, but
  would need a governor grant if StarkWare upgrades the pool before Aug 31.

We build the immune one.

### 1.2 The invoke action is in STABLE Wallet API 0.10.3, already in our lockfile

`@starknet-io/types-js@0.10.3`, the version already pinned in `package.json`:

```ts
export type STRK20_INVOKE_ACTION = {
    type: 'invoke';
    contract: ADDRESS;
    calldata: STRK20_CALLDATA_ITEM[];
};
export type STRK20_ACTION = STRK20_DEPOSIT_ACTION | STRK20_WITHDRAW_ACTION
                          | STRK20_TRANSFER_ACTION | STRK20_INVOKE_ACTION;
```

And `starknet@10.4.0`, also already installed, re-exports `STRK20_INVOKE_ACTION` and accepts it
through `WalletAccountV6.strk20InvokeTransaction(actions)`.

So calling our own anonymizer needs **zero new dependencies, zero version bumps, and zero
viewing-key exposure**. The wallet proves it. Our existing `submitStrk20()` in
`src/app/components/lib/strk20.ts` already takes `WALLET_API.STRK20_ACTION[]` and needs no change.

There is also a wallet-resolved placeholder we get for free:

```
${openNoteIds[N]}   expands to the ID of the Nth open note in the same transaction
${poolAddress}      expands to the privacy pool contract address
```

Meaning even a round-trip anonymizer is expressible through the stable Wallet API. We are not
using that in this sprint, but it is worth knowing the ceiling is not the API.

### 1.3 The anonymizer route is already load-bearing on mainnet

Scanning the pool's own `ExternalContractInvoked` event across all history:

| Metric | Value |
|---|---|
| `ExternalContractInvoked` events | 263 |
| Distinct anonymizer contracts invoked | 30+ |
| `OpenNoteDeposited` events | 167 |
| Block range | 12901585 to 13690582 |

Two representative live anonymizers, probed directly:

| Address | Entrypoints | Invokes | Open-note deposits | Shape |
|---|---|---|---|---|
| `0x9067f35d...49092` | `privacy_invoke` | 68 | **0** | one-way, empty return |
| `0x426dcd1a...2dbe5e` | `privacy_invoke` | 92 | 92 | round-trip |
| `0x3a7e7f34...b56c86cb` | `privacy_compute`, `privacy_invoke_with_computation` | 26 | 26 | compute-and-invoke |

The exact shape we intend to ship, a single `privacy_invoke` entrypoint returning an empty
span, has already been exercised 68 times on mainnet by somebody else. This is not a research
project, it is a paved road.

### 1.4 The mainnet anonymity set, measured

Nobody in this sprint will have this number because it takes a paged scan to get it. Full
history of the pool's `Deposit` event:

| Metric | Value |
|---|---|
| Total `Deposit` events | **307** |
| Distinct depositor addresses | **153** |
| Distinct tokens deposited | **10** |
| First deposit | block 12901368 |
| Most recent deposit | block 13691240 |
| `Withdrawal` events | 1194 |

This also **retires a claim in our own docs**. `docs/PRODUCTION_BUILD_PLAN.md` carries a
community-sourced "~$890K / ~34 assets" figure flagged UNVERIFIED. It is 10 assets, not 34.
Delete the claim, publish the measured number.

### 1.5 The Activity panel still returns nothing, for a second reason

Two defects were present in `src/app/components/lib/history.ts` when this investigation started.
One has since been fixed by concurrent work in the tree. The other has not, and on its own it is
still enough to make the panel empty.

**Fixed while this was being written.** The file used to filter on
`0x01321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf`, which is not the `Deposit`
event and matches nothing on mainnet. The real selector is `starknet_keccak("Deposit")` =
`0x09149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2`, and the working tree now
uses it. Confirmed against our own mainnet shield `0x059eb6c1...5586e`, whose pool event is:

```
keys[0]=0x9149d21...  keys[1]=0x101ab74c... (depositor)  keys[2]=0x33068f65... (USDC)  data[0]=0x30d40 (0.2 USDC)
```

Note that `keys[1]` is the depositor and `keys[2]` is the token on the **same** event, so the
second selector constant and the whole per-transaction receipt-refetch loop are dead weight and
can go.

**Still live.** `from_block: { block_number: 0 }` combined with `MAX_PAGES = 50`. Public Starknet
RPCs page by block range and hand back empty chunks with a continuation token, so the scan
exhausts its page budget long before reaching the pool's first deposit at block 12901368.

This is measured, not theorised. Running the corrected selector against mainnet with
`from_block: 0` and a budget of **80** pages, more generous than the code's 50, returned:

```
real keccak(Deposit) => events: 0 | distinct depositors: 0 | pages 80
```

The same query, chunked into bounded windows of about 20000 blocks, returned 307 events and 153
depositors. The window is the whole difference.

Net: `getPoolActivity()` still returns `[]` for every user. A judge clicking Activity still sees
an empty panel. `tests/history.test.ts` cannot catch this because it asserts on synthetic events
handed to a stubbed provider, so the paging path it depends on is never exercised and the test
cannot fail on it.

### 1.6 The Cairo toolchain works here, right now

Not a guess. Installed `scarb 2.19.1` and `starknet-foundry 0.62.1` via asdf, then built and
tested the public Apache-2.0 reference anonymizer from `starkware-libs/privacy-bridge`:

```
$ scarb build
   Compiling bridge_anonymizers v0.1.0
    Finished `dev` profile target(s) in 10 seconds

$ snforge test
Tests: 17 passed, 0 failed, 0 ignored, 0 filtered out
```

Total setup time was about ten minutes. Build is two seconds, the suite is four. The "write
Cairo, test it, deploy it" loop is not a nine-day risk. It is available today.

### 1.7 Stealth / shadow accounts: still not reachable, verified fresh

| Claim | Status |
|---|---|
| `wallet_rpc.json` v0.10.4-rc.1 specs `wallet_strk20ShadowAccountCommitment` and `shadow_account_invoke` | TRUE. Release cut 2026-08-13 in `starkware-libs/starknet-specs` (not `starknet-io`). Landed via PR 406. |
| Stable `@starknet-io/types-js` is 0.10.3 with no shadow support | TRUE. Published 2026-07-01. Grep of the packed tarball finds no shadow terms. |
| Shadow support exists on a prerelease | TRUE. `0.10.4-beta.2`, published 2026-08-13, has `wallet_strk20ShadowAccountCommitment` and `STRK20_SHADOW_ACCOUNT_INVOKE_ACTION`. |
| starknet.js has it | TRUE on `next` (10.7.1) and `beta` (11.0.0-beta.4), via a vendored `@starknet-io/starknet-types-0104`. |
| Ready ships Wallet API 0.10.4 | **NO PUBLIC EVIDENCE.** No Ready changelog, blog, release note or X post names it. `gh search code` over `argentlabs` and `myBraavos` returns zero hits for `wallet_strk20` or `STRK20_SHADOW_ACCOUNT`. |

The hackathon's own onboarding doc settles it:

> It does need the user's wallet to implement the STRK20 methods, and not every Starknet wallet
> does yet. **There is no published list of which ones do**; until there is, probe rather than assume.

And independently, the client path is closed to us at the protocol level: shadow accounts run
through the pool's `ComputeAndInvoke` client action (`privacy_compute` then
`privacy_invoke_with_computation`). That action is **not a member of the `STRK20_ACTION` union in
0.10.3**. The union has exactly four members: deposit, withdraw, transfer, invoke. So even with a
deployed shadow anonymizer, a 0.10.3 wallet cannot be asked to drive it.

Reaching shadow accounts therefore requires either a wallet advertising 0.10.4 (no evidence any
exists) or the SDK holding a viewing key (forbidden by our own hard constraint). Both doors are
shut. This is a SKIP, with a one-hour probe as the only spend.

---

## 2. Ranked table

Score value is expressed as points out of the 30 available on this criterion. Ratio is
points per day, which is what the brief asked to rank on.

| # | Item | Score value | Days | Ratio | Risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | AVNU private swap, live on mainnet | +3 | 0.5 | 6.0 | Low. Code is written. Needs a server-side key and a funded wallet. | **BUILD** |
| 2 | Private send + unshield, live on mainnet | +4 | 0.75 | 5.3 | Low. Needs a second registered Ready wallet and public STRK for the 6 STRK fee. | **BUILD** |
| 3 | Pool-event depth layer: fix the indexer, publish the measured anonymity set | +2 | 0.5 | 4.0 | Low. Pure client work against public RPC. | **BUILD** |
| 4 | **Our own anonymizer contract, deployed to mainnet and invoked** | **+9** | **2.5** | **3.6** | Medium. Cairo we own. Reference implementation is Apache-2.0 and already passes its suite here. | **BUILD** |
| 5 | Privacy SDK used server-side, read-only, no viewing key | +2 | 1.0 | 2.0 | Medium. GitHub Packages auth, Node 24, and it duplicates what plain RPC already gives us. | **SKIP** |
| 6 | Round-trip anonymizer (swap or lend back into the pool) | +3 | 4.0 | 0.75 | High. More Cairo, open-note plumbing, and exposed to the pending screening-policy upgrade. | **SKIP** |
| 7 | Stealth / shadow accounts | +6 if it worked | unbounded | ~0 | Fatal. No wallet advertises 0.10.4; the only other route needs a viewing key. | **SKIP** (1h probe only) |
| 8 | Selective disclosure / statement artifact | +2 | 3.0 | 0.7 | High. 0.10.3 exposes no disclosure artifact, only a consented balance number. | **SKIP** |
| 9 | Privacy Bridge as a pinned dependency | +2 | 3.0 | 0.7 | High. 0.1.x, churning, drags in its own SDK and starknet pins. | **SKIP** (vendor the contract, section 3) |

**Read the ratio column with care.** Items 1 to 3 have the best ratio because they are cheap,
not because they are valuable. Each is capped: they finish work already written and they close
gaps every other serious team will also close. Item 4 is the only line that moves us from a
scored zero to a scored one on a sub-item the rubric names explicitly, and the only line another
team cannot replicate in the time remaining. Ratio ranks item 4 fourth. Judgement ranks it first.

Do items 1 to 3 in the first two days because they are nearly free and they de-risk the demo.
Spend the rest on item 4.

---

## 3. Build spec, item 4: our own anonymizer on mainnet

### 3.1 What it is and why it is the right one

Name: **PrivatePayoutAnonymizer**. It moves USDC directly from a shielded note to a burn on
Circle CCTP, so the recipient is paid on Base or Solana and **the payer's Starknet address never
appears anywhere in the flow**.

This is the correct anonymizer for this product for four reasons.

1. **It fixes a real hole we already shipped.** `src/app/components/lib/cctp.ts` today does
   `approve` then `deposit_for_burn` as a plain public `walletAccount.execute()`. The file even
   says so: *"deliberately not `strk20InvokeTransaction`: `deposit_for_burn` burns a public
   balance, it never touches a shielded note."* So our cross-chain payout is the one leg of the
   product that publishes the payer. The anonymizer closes it. That is a genuine privacy upgrade,
   not a rubric-shaped bolt-on.
2. **It is the payments-app-shaped anonymizer.** Ekubo swap and Vesu lending anonymizers are DeFi
   helpers. A payroll or payouts product needs "pay this person on another chain without
   publishing who paid". That is exactly outbound.
3. **It returns an empty span**, so it is never a screening subject, so it needs no governor
   grant and survives the pending pool upgrade described in 1.1.
4. **A working Apache-2.0 reference exists and passes its own suite on this machine.**
   `starkware-libs/privacy-bridge`, `packages/bridge-anonymizers/src/outbound_anonymizer.cairo`.
   We are adapting a tested contract, not authoring a novel one.

The shipped behaviour, end to end: user holds shielded USDC, enters a Base or Solana address,
approves one wallet prompt. In a single proven pool transaction the pool withdraws USDC to our
anonymizer and calls `privacy_invoke`, which approves the CCTP TokenMessenger and burns toward
the destination. Circle's forwarding hook completes the mint on the far side. If any step
reverts the whole thing rolls back and the USDC stays shielded.

### 3.2 Exact versions

| Thing | Pin | Note |
|---|---|---|
| `scarb` | `2.19.1` | installed via asdf, verified building |
| `starknet-foundry` (`snforge`, `sncast`) | `0.62.1` | installed via asdf, 17/17 reference tests pass |
| Cairo `starknet` crate | `2.19.1` | workspace dependency |
| `snforge_std` | `0.62.1` | dev dependency |
| `assert_macros` | `2.19.1` | dev dependency |
| Scarb edition | `2024_07` | |
| `starknet` (npm) | `10.4.0` | already installed, no change |
| `@starknet-io/types-js` | `0.10.3` | already installed and overridden, no change |
| `@starknet-io/get-starknet-*` | `6.0.4` | no change |

Put `$HOME/.asdf/shims` **ahead of** `$HOME/.local/bin` on PATH. There is a stale
`snforge 0.53.0` in `~/.local/bin` and if it wins the race every test fails with
`set_next_syscall_from_cheatcode is not supported in this runtime`. That is a false alarm, not a
real failure. This cost time today; do not pay it twice.

### 3.3 Files, in our repo

New Cairo workspace, deliberately isolated from the Next.js build:

```
cairo/
  Scarb.toml                                  workspace: members = ["packages/private_payout_anonymizer"]
  .tool-versions                              scarb 2.19.1 / starknet-foundry 0.62.1
  packages/private_payout_anonymizer/
    Scarb.toml
    src/lib.cairo
    src/private_payout_anonymizer.cairo       the contract
    src/private_payout_anonymizer/errors.cairo
    src/types.cairo                           OpenNoteDeposit mirror + minimal IERC20
    src/test_mocks.cairo                      mock ERC20 + mock TokenMessengerMinterV2
    src/tests.cairo
    src/tests/test_private_payout_anonymizer.cairo
  deploy/
    deploy-common.sh                          adapted from the reference, no secrets
    deploy-mainnet.sh                         constructor constants below
```

Seed `types.cairo`, `test_mocks.cairo` and both deploy scripts from
`starkware-libs/privacy-bridge` `packages/bridge-anonymizers` (Apache-2.0, keep the SPDX headers
and add our own copyright line). Do **not** vendor `inbound_anonymizer.cairo`; we are not doing
the return leg.

TypeScript changes, all in files that already exist:

| File | Change |
|---|---|
| `src/utils/constants.ts` | add `PRIVATE_PAYOUT_ANONYMIZER` (filled in after deploy) next to the existing `CCTP` block |
| `src/app/components/lib/cctp.ts` | add `buildPrivatePayoutActions()` returning `STRK20_ACTION[]`; keep the existing public `buildDepositForBurnCalls` path and label it plainly as the public one |
| `src/app/components/Panels/HopPanel.tsx` | add the private route as the default, with the public route still selectable and both honestly labelled |
| `src/app/components/lib/strk20.ts` | no change, `submitStrk20()` already accepts the action array |
| `strk20.json` | log the declare, the deploy and the invoke |
| `tests/` | add a unit test for the eight-felt calldata layout in 3.5 |

### 3.4 Contract shape

Constructor takes and stores three addresses, all public mainnet constants:

| Arg | Value |
|---|---|
| `usdc` | `0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb` |
| `token_messenger` | `0x07d421B9cA8aA32DF259965cDA8ACb93F7599F69209A41872AE84638B2A20F2a` |
| `pool` | `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` |

Note these match `CCTP.tokenMessengerMinter` and `TOKENS.USDC.address` already in
`src/utils/constants.ts`, so there is one source of truth to cross-check against.

Single entrypoint:

```cairo
#[starknet::interface]
pub trait IPrivatePayoutAnonymizer<TContractState> {
    fn privacy_invoke(ref self: TContractState, params: PayoutParams) -> Span<OpenNoteDeposit>;
}

#[derive(Serde, Drop)]
pub struct PayoutParams {
    pub mint_recipient: u256,
    pub amount: u256,
    pub max_fee: u256,
    pub min_finality_threshold: u32,
    pub destination_domain: u32,
}
```

Body, in order: assert `get_caller_address() == pool` or revert `CALLER_NOT_POOL`; assert
`amount` non-zero; assert `amount > max_fee` (otherwise the fee eats the burn and zero USDC
mints on the far side); `approve` the messenger for exactly `amount`; call
`deposit_for_burn_with_hook` with `destination_caller = 0` and the twelve ASCII bytes
`cctp-forward` followed by twenty zero bytes as `hook_data`; emit `PayoutBurnInitiated`;
`return array![].span()`.

The empty return is load-bearing, not laziness. It is what keeps us out of the screening path
in 1.1.

Deliberate divergences from the reference, each of which needs its own test:

- Keep our existing hard rule that only native USDC is ever burned. `assertNativeUsdc()` in
  `cctp.ts` refuses bridged USDC.e; the contract enforces the same thing by baking the token
  into the constructor rather than accepting it as a parameter.
- Constrain `destination_domain` to the two we actually support, Base (6) and Solana (5), and
  revert on anything else. The reference accepts any domain. A typo'd domain is an
  unrecoverable burn.

### 3.5 The wallet call, exact wire format

Actions must be ordered by pool phase: `Withdraw` is phase 6, `InvokeExternal` is phase 7, and
out-of-order actions revert with `ACTIONS_OUT_OF_ORDER`. The pool runs the withdraw first, so
the anonymizer already holds the USDC when `privacy_invoke` runs.

```ts
const actions: WALLET_API.STRK20_ACTION[] = [
  { type: "withdraw",
    token: TOKENS.USDC.address,
    amount: `0x${amount.toString(16)}`,
    recipient: PRIVATE_PAYOUT_ANONYMIZER },
  { type: "invoke",
    contract: PRIVATE_PAYOUT_ANONYMIZER,
    calldata: [
      ...u256Felts(mintRecipient),          // 2 felts, low then high
      ...u256Felts(amount),                 // 2 felts
      ...u256Felts(maxFee),                 // 2 felts
      `0x${minFinalityThreshold.toString(16)}`,  // u32, 1 felt
      `0x${destinationDomain.toString(16)}`,     // u32, 1 felt
    ] },
];
await submitStrk20(walletAccount, actions);   // existing helper, unchanged
```

Eight felts, flat, no leading enum discriminant. The `privacy_invoke` selector
(`0x402925cce9218828b3ac9a72ac249103f8448a1e1d73c3efaf5da992625043`) is supplied by the pool, so
the calldata carries entrypoint arguments only. Reuse `encodeMintRecipient()` already in
`cctp.ts` for the Base and Solana address encoding; it is tested and correct.

Two operational facts to surface in the UI rather than discover on stage:

- The pool charges its fee per private operation, read live from `get_fee_amount()`, currently
  **6 STRK**, admin-settable. `getPoolFeeAmount()` already reads it.
- Self-submitting publishes that STRK fee from the user's own address on every private
  operation, which is itself a correlation leak. Either route it through the AVNU paymaster
  (`sponsored_private`, same server-side key as item 1) or state the leak plainly in the UI.
  Do not quietly self-submit and call the result private.

### 3.6 Tests that can actually fail

Mirror the reference suite, which is already proven green here, and add ours:

| Test | Broken-state proof |
|---|---|
| burns with the exact CCTP args | change one arg, assert red, restore |
| reverts when caller is not the pool | call from a random address |
| reverts on zero amount | |
| reverts when `amount <= max_fee` | |
| reverts on an unsupported destination domain | pass domain 7, expect revert |
| returns an empty span | assert `len == 0`, then deliberately return one deposit and confirm the test goes red |
| emits `PayoutBurnInitiated` with the public recipient | |
| TS: the eight-felt calldata layout | flip low/high on one u256, confirm red |

Run every one of them broken first, record the red, then fix and record the green. A suite that
has never been red proves nothing.

### 3.7 The mainnet transaction that proves it

Three on-chain artifacts, all logged in `strk20.json` and linked from the README:

1. **DECLARE** of `PrivatePayoutAnonymizer`, giving a class hash on mainnet.
2. **DEPLOY** with the three constructor args from 3.4, giving the instance address.
3. **The proof transaction.** A single `wallet_strk20InvokeTransaction` from a Ready wallet
   holding shielded USDC, carrying the withdraw plus invoke pair from 3.5, paying out a small
   USDC amount to a Base address.

The proof transaction is only accepted as passing when **all** of these hold. This is the
post-condition, not the 200-response:

- The receipt is `SUCCEEDED`, not merely accepted.
- The pool at `0x040337b1...812a` emitted `ExternalContractInvoked`
  (`0x0a8fb36d0894f5e87797c38533a55c4486a1f35e9e9eced10f995b9639a8955`) with our anonymizer as
  the target and `privacy_invoke` as the selector.
- The pool emitted `Withdrawal`
  (`0x02eed7e29b3502a726faf503ac4316b7101f3da813654e8df02c13449e03da8`) to our anonymizer.
- The CCTP `TokenMessengerMinterV2` emitted its burn event in the same transaction.
- Our anonymizer emitted `PayoutBurnInitiated` with the expected recipient and amount.
- Circle's Iris API returns `status: "complete"` for that transaction hash via the existing
  `pollCctpAttestation()`, and **USDC actually lands at the Base recipient**. A burn with no
  mint is a stranded payment, not a completed one.
- The payer's Starknet address appears in **no** event of the transaction. Grep the full receipt
  for it. This is the entire point of the contract; assert it explicitly.

Extend `scripts/verify-strk20-claim.mjs` to check all of the above from a transaction hash, so
the claim in the README is re-verifiable by a judge and by us.

### 3.8 Schedule and cost

| Day | Work |
|---|---|
| 0.5 | Scaffold `cairo/`, vendor `types.cairo` and mocks, get `scarb build` green |
| 1.0 | Write the contract and the full suite, red then green on each |
| 0.5 | Declare and deploy to mainnet, wire `constants.ts` and `HopPanel.tsx` |
| 0.5 | Run the real payout, verify all seven post-conditions, log and document |

Funding needed before day one: public STRK in the demo wallet for declare and deploy fees plus
6 STRK for the invoke, and shielded USDC in the pool to pay out. Fund early. The single most
likely way this slips is discovering on day eight that the wallet is short on public STRK, which
is exactly what already blocked unshield.

Fallback if mainnet declare fails: the same declare and deploy on Sepolia against the Sepolia
pool `0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` is a partial result
worth reporting honestly. It is not a substitute and must not be presented as one.

---

## 4. Build spec, item 2 combined with 1 and 3: the mainnet proof sweep

Three unproven or broken things, all cheap, best done in the first two days so the anonymizer
has clear air behind it.

### 4.1 Private send and unshield, on mainnet

Both are coded. Neither has ever run. `private transfers` is named in the rubric and we cannot
claim it.

- Blocker for private send: a second Ready wallet already registered in the pool. Registration
  happens on that wallet's own first shield; we cannot register it for them. So: install a second
  Ready profile, fund it, shield once, wait roughly ten blocks for maturity, then send from
  wallet one.
- Blocker for unshield: public STRK past the 6 STRK pool fee plus the wallet's buffer. Fund it.

Files: `src/app/components/Panels/SendPanel.tsx` and `UnshieldPanel.tsx` need no logic change.
This is funding and execution, not engineering.

Proof: two transaction hashes in `strk20.json`, each with a `SUCCEEDED` receipt. For the private
send, additionally assert that the pool emitted `NoteUsed` and `EncNoteCreated` and that the
recipient address appears in **no** event. That is what makes it a private transfer rather than a
transfer.

### 4.2 AVNU private swap, on mainnet

`src/app/api/avnu/*` and `SwapPanel.tsx` are written and degrade honestly today, with
`/api/avnu/status` answering `configured: false`. The only blocker is `AVNU_PAYMASTER_API_KEY`,
which is user-placed in `.env` and must never be in the repo or in a prompt.

Worth more than it looks for this criterion: AVNU's private executor **is** an anonymizer, so a
successful swap exercises the pool's `InvokeExternal` path through a first-party contract. It is
the cheapest possible evidence that we understand the anonymizer model, and it lands days before
our own contract does.

Proof: transaction hash with `ExternalContractInvoked` naming AVNU's executor, plus
`OpenNoteDeposited` for the bought token.

Second benefit: it supplies the `sponsored_private` paymaster route that section 3.5 wants, so
our anonymizer invoke does not have to publish a public STRK fee from the user.

### 4.3 Fix the indexer and publish the measured anonymity set

Finish `src/app/components/lib/history.ts`. The selector is already correct in the working tree;
these four are what remain:

1. **The one that actually unblocks the panel.** Replace `from_block: 0` plus a single global
   `MAX_PAGES` with bounded windows of about 20000 blocks starting at the pool's first deposit,
   block 12901368, paging the continuation token inside each window and guarding per window
   rather than once globally. Section 1.5 shows the global-budget version returning zero events
   at 80 pages while the windowed version returns 307.
2. Delete the now-redundant second selector constant and the per-transaction receipt refetch.
   `keys[1]`, `keys[2]` and `data[0]` of the single `Deposit` event carry depositor, token and
   amount.
3. Add `Withdrawal` (`0x02eed7e2...`) so Activity shows both legs, which is honest: both are
   public.
4. Give `tests/history.test.ts` a case that exercises the paging path against a stub returning
   several empty chunks with continuation tokens followed by a populated one. The current test
   hands the provider a single populated chunk, so it can never fail on the defect that is
   actually breaking the panel.

Then add the depth surface. A small panel, fed by the same scan, showing the measured numbers
from 1.4: total deposits, distinct depositors, distinct tokens, block range, and the user's own
share. Cache it server-side; do not re-scan on every page load.

This is the item that turns "we read an event" into "we index the pool", and it lets the README
replace an unverified community number with one we measured and can reproduce.

Proof: the Activity panel renders our three existing mainnet transactions. Verify the check can
fail by pointing it at a wallet with no pool history and confirming it renders an explicit empty
state, and by reverting the selector and confirming the panel goes blank again. Fix
`tests/history.test.ts`, which currently asserts against the wrong constant and therefore cannot
fail. Never validate this against an empty account: with 153 depositors on mainnet there is
plenty of real data to test against.

---

## 5. What we are explicitly NOT building, and why

**Stealth / shadow accounts.** The rubric names them and we are still saying no. Two independent
blockers, either one fatal. First, no wallet publicly advertises Wallet API 0.10.4; the
hackathon's own docs say no support list exists. Second, and this is the one that does not
depend on any announcement, shadow accounts run through the pool's `ComputeAndInvoke` action,
which is not a member of the `STRK20_ACTION` union in 0.10.3, so a 0.10.3 wallet cannot be asked
to drive one at all. The remaining route is the SDK holding a viewing key, which breaks our hard
constraint and is the thing this product exists to avoid. Spend one hour, no more: call
`supportedWalletApi` on a current Ready build and try
`wallet_strk20ShadowAccountCommitment` once. If it answers, this document is wrong and shadow
accounts become the top item instantly. If it throws `API_VERSION_NOT_SUPPORTED`, write down the
Ready version and the date, publish that as a finding, and move on. A dated negative result from
a real wallet is worth more to a judge than a paragraph of aspiration.

**The Privacy SDK.** There is a legitimate viewing-key-free use: server-side indexing of the
pool's public `Deposit` events, anonymity-set analytics, note-maturity estimation. But we already
do all of that with plain `RpcProvider.getEvents` in item 4.3, with no GitHub Packages
authentication, no Node 24 floor, and no `0.14.3-rc.x` churn. Pulling in the SDK to re-derive
numbers we already have would be integration theatre, and the SDK's genuinely interesting
surface is exactly the part that needs a viewing key. If a judge asks why we did not use the
SDK, the answer is a good one: the consumer path never should, and we proved that by indexing
the pool without it.

**A round-trip anonymizer** (swap or lend that returns funds to the pool). Technically legal on
mainnet today, because the deployed pool's blocklist is empty. But it needs open-note plumbing
and the `${openNoteIds[0]}` placeholder dance, roughly doubling the Cairo and the test surface,
and it takes on a risk the one-way version does not: the unreleased pool makes the returning
depositor a screening subject by default, settable only by the app governor. If StarkWare
upgrades mainnet during the sprint, a round-trip anonymizer stops working and a one-way one does
not. Wrong risk to carry into a deadline.

**Selective disclosure or a statement artifact.** Wallet API 0.10.3 exposes no disclosure
artifact. All it gives is a consented balance number from `strk20Balances`. Anything we built on
top would be a document we generated ourselves, not a protocol-backed attestation, and calling it
selective disclosure would be dishonest. Already cut in `PRODUCTION_BUILD_PLAN.md`. Stays cut.

**Vesu lending anonymizer.** Not on mainnet. The published class hash is undeclared there.
Confirmed previously and unchanged. Do not put it on a dated plan.

**Privacy Bridge as a pinned dependency.** We are vendoring one Apache-2.0 Cairo file from it
and keeping the licence header. We are not taking `bridge-core` as a dependency: it is 0.1.x, it
carries its own SDK and starknet pins that conflict with ours, and, decisively, its client
derives viewing keys locally (`packages/bridge-core/src/derivation/viewing-key.ts`) because it
owns the account. Our dapp does not and must not. Read it, take the contract, leave the client.

**Anything requiring StarkWare to grant us something.** No governor calls, no allowlist entries,
no screening exemptions, no private RPC favours. Everything in sections 3 and 4 is permissionless
against the pool as deployed today. That property was checked on-chain, not assumed, and it is
the reason this plan fits in nine days.

---

## 6. Corrections this investigation forces on our existing docs

| Doc | Correction |
|---|---|
| `src/app/components/lib/history.ts` | selector now fixed in-tree, but `from_block: 0` with a single global page budget still returns nothing for every user (measured, section 1.5) |
| `tests/history.test.ts` | never exercises the paging path, so it cannot fail on the defect that is actually breaking the panel |
| `docs/PRODUCTION_BUILD_PLAN.md` | the "~34 assets" community figure is wrong; measured value is 10 tokens, 307 deposits, 153 depositors |
| `STRK20_INTEGRATION_PLAN.md` s.7 | "this skill does not write the Cairo ... team owns it" framed anonymizers as out of reach; the toolchain works here and the reference suite passes, so it is in scope |
| `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md` | `starknet-specs` is under `starkware-libs`, not `starknet-io` |
| README | once item 4 lands, the "How it talks to STRK20" section gains an anonymizer row |

---

## 7. Sources

All verified 2026-08-22 unless dated otherwise.

- Pool source: `github.com/starkware-libs/starknet-privacy`, `packages/privacy/src/{actions,privacy,interface,objects,utils}.cairo`, HEAD `36eac4ea` (2026-08-20)
- Reference anonymizer: `github.com/starkware-libs/privacy-bridge`, `packages/bridge-anonymizers/`, Apache-2.0, built and tested locally
- Deployed pool, read live over mainnet RPC: `get_version`, `get_fee_amount`, `is_paused`, `is_open_note_depositor_blocked`, full ABI, and paged `getEvents` over `Deposit`, `Withdrawal`, `ExternalContractInvoked`, `OpenNoteDeposited`, `OpenNoteDepositorBlockSet`
- Wallet API types: `node_modules/@starknet-io/types-js@0.10.3` and `starknet@10.4.0`, read from our own lockfile
- Spec: `starkware-libs/starknet-specs` release `v0.10.4-rc.1` (2026-08-13), PR 406
- npm: `@starknet-io/types-js` dist-tags and packed tarballs for 0.10.3, 0.10.4-beta.1, 0.10.4-beta.2; `starknet` 10.7.1 and 11.0.0-beta.4; `get-starknet` 4.0.0
- Rubric and onboarding: `github.com/starkience/strk20-hackathon` README and `docs/MAINNET-DAY-0.md`
- SDK changelog: `starknet-privacy` `sdk/CHANGELOG.md`, Unreleased section
