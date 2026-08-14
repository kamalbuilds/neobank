# Resolving the three open questions that decide the sprint

Date: 2026-08-14. Author: Claude Opus, high judgment research pass.
Scope: the three questions left open by `docs/research/claude-challenge-plan.md` (findings 4, 7 and 11, plus the "What I could not verify from this repo" list).

Method: official sources only. Cairo and TypeScript read from `starkware-libs/starknet-privacy` at `main` via the GitHub API, package typings read from npm tarballs, and live mainnet reads against two independent public RPC nodes. Every address and class hash below was either read from an official artifact or returned by a mainnet node. Nothing is inferred and nothing is invented.

Mainnet reads were taken at block **13275490** through `https://api.cartridge.gg/x/starknet/mainnet` and independently repeated against `https://rpc.starknet.lava.build:443`. Both nodes agreed on every result.

| Question | Verdict |
| --- | --- |
| 1. Vesu anonymizer mainnet instance | **RESOLVED. No instance, and no mainnet class either.** AVNU stays the sprint DeFi leg. |
| 2. Pool fee provenance | **RESOLVED. The fee is a public STRK payment from the transaction caller, never from a note.** Whether that leaks depends entirely on the route. |
| 3. Ready `supportedWalletApi` string | **UNVERIFIED.** Requires a browser extension, which cannot be driven from this session. Exact human procedure below. |

---

## 1. Vesu lending anonymizer: class hash only, and not even on mainnet

**Verdict: there is no verified mainnet instance address. There is a published class hash, and that class is not declared on Starknet mainnet at all. AVNU stays the sprint DeFi leg.**

### What the official source actually publishes

The root `README.md` of `starkware-libs/starknet-privacy` carries a table headed **"Contracts"** whose only identifier column is **"Class Hash"**. There is no address column. Verbatim row:

| Contract | Tag | Class Hash |
| --- | --- | --- |
| Vesu Anonymizer | `PRIVACY-0.14.3-RC.0` | `0x3751128dc3ebd36215f982766f14aaca8f78793e4b0f42a73e49372a8e24aae` |

Source: https://github.com/starkware-libs/starknet-privacy/blob/main/README.md, section "Contracts". This confirms the value already cited at `STRK20_INTEGRATION_PLAN.md:26` is quoted correctly. It is a class hash, and a class hash is not callable.

### The stronger finding: that class is not declared on mainnet

A class hash is at least a deployment prerequisite, so the natural next question is whether anyone has declared and deployed it. They have not. `starknet_getClass` at `latest` for that class hash returns error code **28, "Class hash not found"** on both mainnet nodes.

| Class | Mainnet | Sepolia |
| --- | --- | --- |
| Vesu Anonymizer `0x3751128d...` | **NOT DECLARED** (error 28) | DECLARED |
| Ekubo Anonymizer `0x2a4ac595...` | DECLARED | DECLARED |
| Privacy Pool, README value `0x52107fad...` | **NOT DECLARED** (error 28) | not checked |

An undeclared class cannot have been deployed, so no mainnet instance of the Vesu anonymizer exists to be found. This is a stronger negative than "we could not locate the address": the address cannot exist yet. The Sepolia declaration is consistent with the source docs describing the Vesu route as "integration in progress".

### Two corrections this forces on the plan

**The README "Contracts" table is a source release artifact, not a mainnet deployment registry.** The pool class hash it lists (`0x52107fad...`) is also not declared on mainnet. The pool that is actually live at the canonical address runs class hash `0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d`, read with `starknet_getClassHashAt`. Do not treat any entry in that table as evidence that something is deployed. Both plans should stop reading it that way.

**The canonical pool address is confirmed by a second independent source.** `@avnu/avnu-sdk@4.2.0` exports, verbatim from `package/dist/index.d.ts`:

```
declare const PRIVACY_POOL_ADDRESS = "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";
declare const SEPOLIA_PRIVACY_POOL_ADDRESS = "0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
```

That mainnet value matches the address pinned at `STRK20_INTEGRATION_PLAN.md:60`, and it answers calls (see question 2). It is now confirmed by a first-party SDK export and by a live chain read, not by a single document.

### What the demo app does, which settles the question of intent

StarkWare's own demo does not hardcode a Vesu address. It reads one from an environment variable and hides the entire feature when it is absent (`demo/src/config.ts`, `parseVesuConfig`), and `demo/.env.mainnet.example` leaves it commented out with the note that the DeFi vars should be set "only if the helpers are deployed on mainnet". The reference implementation itself treats mainnet Vesu as not deployed.

### Consequence for the sprint

Finding 4 of the challenge stands and hardens. **AVNU is the sprint DeFi leg.** It is first-party, its executor address is returned at runtime by `quoteToCalls({ private: true })` rather than hardcoded, and it requires no address that does not exist. Vesu is not a Phase 0 or Phase 1 option on mainnet under any schedule the team controls, because the blocking step belongs to somebody else.

One lead worth recording rather than acting on: the **Ekubo** anonymizer class is declared on mainnet, and its ABI contains exactly one function, `privacy_invoke`, confirming it is the real anonymizer rather than a lookalike. Declared is still not deployed. Locating a live instance needs an indexer with an API key, which the explorer APIs refused unauthenticated. Do not spend sprint days on it while AVNU already works.

---

## 2. Pool fee: paid publicly in STRK by the transaction caller, never deducted from a note

**Verdict: the pool contract charges the fee as an ordinary public STRK ERC-20 transfer pulled from whoever called `apply_actions`. It is never taken out of the shielded note. Whether this leaks depends on who the caller is, and the plan's current assumption is right only on the relayed route.**

This is the most consequential of the three answers, because the challenge document (finding 11) correctly guessed that one of the two possible answers is a leak, and the true answer is "both, depending on route".

### The contract, verbatim

`packages/privacy/src/privacy.cairo`, the private helper called at the top of `apply_actions`:

```cairo
fn collect_fee(ref self: ContractState) {
    let fee_amount = self.fee_amount.read();
    if fee_amount.is_non_zero() {
        let fee_collector = self.fee_collector.read();
        checked_transfer_from(
            token_address: STRK_TOKEN_ADDRESS,
            sender: get_caller_address(),
            recipient: fee_collector,
            amount: fee_amount.into(),
        );
    }
}
```

Call site, same file, inside `apply_actions`:

```cairo
self.validate_proof(:actions);
self.collect_fee();
```

Three facts follow directly and are not open to interpretation. The token is hardcoded to `STRK_TOKEN_ADDRESS`, so the fee is always STRK regardless of which asset is being shielded. The payer is `get_caller_address()`, an ordinary public account, so this is a plain public ERC-20 transfer visible on chain. And it is charged per `apply_actions` call, before any action is applied, entirely outside the proven note arithmetic.

`packages/privacy/src/interface.cairo` documents the same thing in the preconditions for `apply_actions`:

> "The caller must have sufficient STRK balance and allowance to pay the fee (see `get_fee_amount`)."

and in its notes:

> "A fee (in STRK) is collected from the caller before applying actions when `get_fee_amount` is non-zero."

### Who the caller is, which is the whole answer

StarkWare's demo spells out the consequence in a comment on `initFeeConfig` in `demo/src/config.ts`:

> "The pool's `apply_actions` calls `collect_fee()` which pulls `fee_amount` STRK from the tx caller to `fee_collector`. When the paymaster is disabled the user account is the caller, so the demo must approve STRK to the pool for this amount on top of any per-token allowance."

So there are two routes with opposite privacy properties:

**Route A, self submitted, no paymaster. This is the leak.** The user's own public account is the caller. Every private operation therefore emits a public STRK transfer from the user's address to the fee collector at that exact moment, and it needs a public STRK `approve` to the pool beforehand. That is precisely the timing correlation channel the challenge document feared, and it also means the user's public address must hold public STRK forever, which defeats the point.

**Route B, relayed under the `sponsored_private` paymaster. This is clean.** The caller is the paymaster forwarder, a shared address used by everyone, so the public STRK payment carries no per-user signal. The user reimburses the forwarder inside the proven private transaction. The reimbursement action's type is declared in `demo/src/paymaster.ts`:

```ts
export type FeeMode = {
  mode: "sponsored_private";
  pool_fee_token: string;
  tip?: "low" | "normal" | "high";
};

export type FeeAction = {
  type: "withdraw";
  recipient: string;
  token: string;
  amount: string;
};
```

A `withdraw` action is a spend from the shielded balance. The `recipient` is the forwarder address, which the demo learns by calling the paymaster and reading `fee_action.recipient`. AVNU's docs describe the identical arrangement from the other side: "the user pays only the pool fee, from their private balance, in the token of their choice (`poolFeeToken`)" (https://docs.avnu.fi/docs/privacy).

Both statements are true at once and are not in conflict. The pool always receives a public STRK payment from its caller. On the relayed route the caller is the relayer, and the user's share is drawn from the shielded balance in the token of their choice.

### Live mainnet values, and a correction to both plans

Read from the canonical pool at block 13275490:

| View | Raw | Meaning |
| --- | --- | --- |
| `get_fee_amount()` | `0x53444835ec580000` | `6000000000000000000` FRI, that is **6 STRK** |
| `get_fee_collector()` | `0xd79041634625e5288296fbc648088788710ba44903a3a49468a66567749e77` | fee recipient |
| `get_version()` | `0x322e30` | the short string `2.0` |

**The fee is 6 STRK, not 4.** The 4 STRK figure appears in the skill reference, in the challenge document at finding 11, and across the secondary press coverage. It is stale. This is exactly why the skill says to read `get_fee_amount` rather than assume, and it is a live argument for never hardcoding it: the value is settable by an admin through `set_fee_amount`, so it can change again mid sprint.

At 6 STRK per operation the economics in finding 11 get worse, not better. The "shield as a separate earlier transaction for unlinkability" guidance costs two operations, so 12 STRK, before the user has moved any money privately.

### Consequences for the plan

1. **The Phase 1 build must be paymaster relayed, and that is now a privacy requirement rather than a UX nicety.** Self submitted private transactions publish a STRK payment from the user's own address on every single operation. Any plan step that says "submit it ourselves" needs to say why the leak is acceptable, and it will not be.
2. **`STRK20_INTEGRATION_PLAN.md:71`, "subtract the pool fee from MAX", is correct only on the relayed route,** and it must subtract in the `pool_fee_token` from the shielded balance, not in public STRK. On the self submitted route the fee does not come out of MAX at all, it comes out of a public balance the UI is not even showing. Write down which route the number belongs to.
3. **A user whose public account holds zero STRK cannot transact at all on the self submitted route.** The relayed route is the only one where a user can operate from a shielded balance alone.
4. **Read the fee at runtime and cache it, exactly as the reference demo does,** using `get_fee_amount` and `get_fee_collector`. Do not ship a constant.

---

## 3. Ready wallet API version string: UNVERIFIED, and the current gate is provably unsafe

**Verdict: UNVERIFIED. The string Ready advertises today cannot be determined from this session, because `wallet_supportedWalletApi` is answered by a browser extension and there is no remote endpoint that reports it. What can be settled, and was, is that the plan's comparison is broken in a way that would hide the entire product from a compliant wallet.**

### What is verified

**The return shape.** From `@starknet-io/types-js@0.10.3`, `dist/types/wallet-api/methods.d.ts`:

```ts
wallet_supportedWalletApi: {
    params?: never;
    result: API_VERSION[];
};
```

and from `dist/types/wallet-api/components.d.ts`:

```ts
export type API_VERSION = `${number}.${number}` | `${number}.${number}.${number}`;
```

So the method returns an **array**, and each entry is legally **either two part or three part**. A wallet advertising `"0.10"` is fully spec compliant. This kills the secondary claim, seen in circulation, that the method returns only two digit versions: the 0.10.3 spec permits both forms.

**The comparison is broken at the stated threshold.** Executed locally against `starknet@10.4.0`, the exact pin in the plan:

| Comparison | `compareVersions` result |
| --- | --- |
| `"0.10"` vs `"0.10.3"` | **-1** |
| `"0.10.0"` vs `"0.10.3"` | **-1** |
| `"0.10.3"` vs `"0.10.3"` | 0 |
| `"0.10.4"` vs `"0.10.3"` | 1 |
| `"0.10.10"` vs `"0.10.3"` | 1 |
| `"0.9"` vs `"0.10.3"` | -1 |
| `"0.8"` vs `"0.10.3"` | -1 |

Two things fall out. The good news is that `compareVersions` from starknet.js is a real semver comparator, so it orders `0.10.10` above `0.10.3` and `0.9` below `0.10.0`, and the naive string ordering worry in finding 7 does not apply as long as this helper is used. The bad news is decisive: **a wallet that advertises `"0.10"` fails a `>= 0.10.3` gate.** Both plans specify that gate (`STRK20_INTEGRATION_PLAN.md:60`, `PRODUCTION_BUILD_PLAN.md:101`), and the skill's own reference says to treat `>= 0.10` as capable. If Ready advertises the two part form, the app ships with every private action hidden and the demo is an empty page. Nobody would find this until a wallet is in front of a browser.

**There is a real error code for the failure case,** so the gate does not have to carry all the weight. `API_VERSION_NOT_SUPPORTED` is declared on every STRK20 method in the same typings, alongside `NOT_REGISTERED`, `INSUFFICIENT_PRIVATE_BALANCE` and `PRIVACY_LEAK`.

### What a human must run, and exactly how

No published Ready artifact states this. `docs.ready.co` documents no wallet API version, no `supportedWalletApi`, and no STRK20 or privacy surface at all, checked including its `llms.txt` index. The value has to be read off a live extension.

Procedure, about two minutes:

1. Install the Ready extension and open it on **mainnet**. Let it complete first use so the account is live.
2. Open **https://starknet-wallet-account.vercel.app/** and connect Ready.
3. In the wallet RPC command selector, choose **`wallet_supportedWalletApi`** and run it. That dapp calls `walletV6.supportedWalletApi(wallet)` directly and prints the raw JSON response, confirmed by reading its source at `src/app/components/client/WalletHandle/RpcWalletCommand.tsx` in `PhilippeR26/Starknet-WalletAccount`.
4. Record the **entire array verbatim**, not just the entry that looks newest. Record whether entries are two part or three part.
5. While connected, also run **`wallet_supportedSpecs`** and record that array, since the plan names it as the secondary signal.

Equivalent for anyone who prefers their own page, in a browser with the extension present and using the pinned versions:

```ts
import { walletV6 } from 'starknet';
const versions = await walletV6.supportedWalletApi(selectedWallet);
console.log(JSON.stringify(versions));
```

This cannot be run from Node. `WalletAccountV6` is dapp only, and there is no remote endpoint that reports a given wallet's advertised versions, so no amount of further research resolves this without a browser.

Two things to record at the same visit, since the wallet is already open and both are on the challenge document's open list: whether the shadow account methods appear at all, which tells you if Ready is on 0.10.4, and whether `strk20Balances` triggers a consent prompt, which decides whether shielded balance UX is viable without one. Do not call `strk20Balances` as a capability probe in shipped code.

---

## The one highest leverage plan change

Question 3 stays UNVERIFIED, so this is the change to make.

**Gate the private UI at `>= 0.10` using `compareVersions`, and let the wallet reject the call, rather than gating at `>= 0.10.3` and hiding the product from a compliant wallet.**

Concretely: compare with `compareVersions` from starknet.js against `"0.10"`, offer the private actions to any wallet at or above it, and treat `API_VERSION_NOT_SUPPORTED` returned from an actual STRK20 call as the authoritative "this wallet cannot do it" signal, surfacing it as a clear state. Never feature detect with `strk20Balances`. This aligns with the skill's own `>= 0.10` threshold, it is safe whether Ready advertises `"0.10"` or `"0.10.3"`, and it converts an unverifiable build time assumption into a runtime error the app already has to handle.

The reason this is the highest leverage change is asymmetry of failure. Gating too high fails silently and totally: the app renders, nothing is offered, and the failure looks like the product simply has no features. Gating one notch low fails loudly and locally: one call returns a typed error on a wallet that was never going to work anyway. Given that the exact string is unknown until somebody opens a browser, choose the failure mode that is visible.

Two smaller changes follow from the resolved questions and should land in the same edit:

- **Make the relayed paymaster route mandatory for every private operation**, and record in the plan that self submission publishes a STRK payment from the user's own address each time. This upgrades a Phase 0 architecture line into a privacy invariant.
- **Delete Vesu from every phase that has a date on it**, and replace the 4 STRK figure with a runtime read of `get_fee_amount`, noting that the live value is 6 STRK and is admin settable.

---

## Reproducing this

```bash
# Contract source and README, official repo
gh api repos/starkware-libs/starknet-privacy/contents/README.md --jq '.content' | base64 -d
gh api repos/starkware-libs/starknet-privacy/contents/packages/privacy/src/privacy.cairo --jq '.content' | base64 -d
gh api repos/starkware-libs/starknet-privacy/contents/demo/src/config.ts --jq '.content' | base64 -d
gh api repos/starkware-libs/starknet-privacy/contents/demo/src/paymaster.ts --jq '.content' | base64 -d

# Live pool reads, canonical mainnet pool address
POOL=0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
curl -s -X POST https://api.cartridge.gg/x/starknet/mainnet -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"starknet_call\",\"params\":{\"request\":{\"contract_address\":\"$POOL\",\"entry_point_selector\":\"<selector of get_fee_amount>\",\"calldata\":[]},\"block_id\":\"latest\"}}"

# Class declaration check, expect error 28 for the Vesu anonymizer on mainnet
curl -s -X POST https://api.cartridge.gg/x/starknet/mainnet -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_getClass","params":{"block_id":"latest","class_hash":"0x3751128dc3ebd36215f982766f14aaca8f78793e4b0f42a73e49372a8e24aae"}}'

# Version comparator behaviour, against the pinned starknet.js
npm install starknet@10.4.0
node -e "const{compareVersions}=require('starknet');console.log(compareVersions('0.10','0.10.3'))"  # -1

# Wallet API return type, from the pinned types package
npm pack @starknet-io/types-js@0.10.3 && tar xzf starknet-io-types-js-0.10.3.tgz
grep -n "API_VERSION" package/dist/types/wallet-api/components.d.ts
```

### Sources

- Contract source, README contracts table, demo and paymaster client: https://github.com/starkware-libs/starknet-privacy
- AVNU privacy docs, pool fee and fee modes: https://docs.avnu.fi/docs/privacy
- AVNU pool address exports: `@avnu/avnu-sdk@4.2.0` on npm, `package/dist/index.d.ts`
- Wallet API types: `@starknet-io/types-js@0.10.3` on npm
- Version comparator: `starknet@10.4.0` on npm
- Wallet test dapp and its source: https://starknet-wallet-account.vercel.app/ and https://github.com/PhilippeR26/Starknet-WalletAccount
- Vesu helper reference page: https://strk20-by-example.org/helpers/vesu-lending-helper.md
- Mainnet RPC nodes used: `https://api.cartridge.gg/x/starknet/mainnet` and `https://rpc.starknet.lava.build:443`

CLAUDE_SESSION_DONE opus-open-questions
