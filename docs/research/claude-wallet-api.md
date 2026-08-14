# starknet.js `WalletAccountV6`: current STRK20 API

Written 2026-08-14. Sources:

- https://starknet-js.com/docs/next/guides/account/walletAccount/ (Next / unreleased docs)
- https://strk20-by-example.org/starknet-wallet-api/starknet-js.md
- https://strk20-by-example.org/starknet-wallet-api/overview.md
- Ground truth: type declarations of `starknet@10.4.0` as published on npm (`node_modules/starknet/dist/index.d.ts`), installed and grepped on 2026-08-14.

Every method name below was read from one of those. Nothing here is inferred.

## Install and pin

```shell
npm install starknet@^10.4.0
```

STRK20 landed in starknet.js **10.4.0**, which ships on the npm `next` tag. A bare
`npm install starknet` resolves to `latest`, still 10.0.x, where `WalletAccountV6`,
`strk20InvokeTransaction`, and `STRK20_ACTION` do not exist. `WalletAccountV6` also
requires get-starknet **v6.0.2 min** (`next` tag is 6.0.4 as of 2026-08-14).

```shell
npm install @starknet-io/get-starknet-discovery@6.0.3 \
            @starknet-io/get-starknet-wallet-standard@6.0.3 \
            @starknet-io/types-js@0.10.3 \
            starknet@10.4.0
```

Import the wallet type from the subpath, not the package root (root declares it locally
but does not export it, TS2459):

```ts
import type { WalletWithStarknetFeatures } from '@starknet-io/get-starknet-wallet-standard/features';
```

`WalletAccountV6` is DAPP-only. It cannot run in a Node.js script.

## Connect

```ts
import { createStore, type Store } from '@starknet-io/get-starknet/discovery'; // v6.0.2 min
import { type WalletWithStarknetFeatures } from '@starknet-io/get-starknet-wallet-standard/features';
import { WalletAccountV6, walletV6 } from 'starknet';

const store: Store = createStore();
const walletsList: WalletWithStarknetFeatures[] = store.getWallets();
const selectedWallet: WalletWithStarknetFeatures = walletsList[1]; // your own picker UI

const myWalletAccount: WalletAccountV6 = await WalletAccountV6.connect(
  { nodeUrl: myFrontendProviderUrl },
  selectedWallet
);
```

Static signatures, verbatim from the 10.4.0 typings:

```ts
static connect(provider, walletProvider, cairoVersion?, paymaster?, silentMode?): Promise<WalletAccountV6>
static connectSilent(provider, walletProvider, cairoVersion?, paymaster?): Promise<WalletAccountV6>
```

The provider is required: reads go straight to the chain through it, writes go to the
wallet. Create a **new** `WalletAccountV6` whenever the network or account address
changes; a stale instance mixes reads and writes across networks.

`WalletAccountV6 extends WalletAccountV5`, so `execute`, `signMessage`, `declare`,
`deploy`, `switchStarknetChain`, `watchAsset`, and all `RpcProvider` read methods are
available on it.

## The exact STRK20 method surface in starknet.js 10.4.0

Copied from `WalletAccountV6` in `starknet@10.4.0`'s `index.d.ts`:

```ts
executeWithProof(calls: AllowArray<Call>, proof?: STRK20_PROOF): Promise<AddInvokeTransactionResult>;
strk20Balances(tokens: Address[]): Promise<STRK20_BALANCE_ENTRY[]>;
strk20PrepareInvoke(actions: STRK20_ACTION[], simulate?: boolean): Promise<STRK20_CALL_AND_PROOF>;
strk20InvokeTransaction(actions: STRK20_ACTION[]): Promise<{ transaction_hash: string }>;
```

That is **four** STRK20 methods in the shipped package. The same four exist as free
functions in the `walletV6` namespace, taking the wallet object as first argument:

```ts
walletV6.strk20Balances(walletWSF, tokens)
walletV6.strk20PrepareInvoke(walletWSF, actions, simulate?)
walletV6.strk20InvokeTransaction(walletWSF, actions)
walletV6.supportedWalletApi(walletWSF): Promise<API_VERSION[]>
walletV6.supportedSpecs(walletWSF): Promise<SpecVersion[]>
```

`strk20ShadowAccountCommitment()` is documented on the starknet-js **Next** docs page but
is **not present** in the published `starknet@10.4.0` typings (grep of the whole `dist/`
returns nothing). See the version section below before writing any code against it.

### Which submit method to use

| Method | Submits and pays | Use it |
| --- | --- | --- |
| `strk20InvokeTransaction(actions)` | The wallet, which adds the fee action itself | Almost always |
| `strk20PrepareInvoke(actions)` | Your DAPP, wallet adds no fee action | Sponsoring the user's fee, or estimating first |
| `executeWithProof(call, proof)` | The wallet | Submitting an already-prepared call through the wallet |

Default path:

```ts
const result = await myWalletAccount.strk20InvokeTransaction(actions);
console.log('transaction hash =', result.transaction_hash);
```

Proof generation makes this call far slower than an ordinary invoke and requires a user
approval. Show a pending state or the UI reads as frozen.

Fee sponsorship path:

```ts
import type { STRK20_CALL_AND_PROOF } from 'starknet';

const { call, proof }: STRK20_CALL_AND_PROOF = await myWalletAccount.strk20PrepareInvoke(actions);

// `call` is a standard starknet.js `Call`, submittable by any account:
const result = await mySponsorAccount.execute(call, {
  proof: proof.data,
  proofFacts: proof.proof_facts,
});

// ...or hand it back to the wallet instead of paying yourself:
const resp = await myWalletAccount.executeWithProof(call, proof);
```

Estimate-only path. `simulate: true` skips proof generation and returns an empty proof.
The result is **not submittable**:

```ts
const simulated = await myWalletAccount.strk20PrepareInvoke(actions, true);
const fee = await mySponsorAccount.estimateInvokeFee(simulated.call);
```

Balances:

```ts
import type { STRK20_BALANCE_ENTRY } from 'starknet';

const balances: STRK20_BALANCE_ENTRY[] = await myWalletAccount.strk20Balances([
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // STRK
]);
console.log('balance =', balances[0].balance);
```

## `STRK20_ACTION`

A DAPP describes what it wants as an array of `STRK20_ACTION`. Types exported by
starknet 10.4.0: `STRK20_DEPOSIT_ACTION`, `STRK20_WITHDRAW_ACTION`,
`STRK20_TRANSFER_ACTION`, `STRK20_INVOKE_ACTION`, plus `STRK20_CALLDATA_ITEM` and
`STRK20_CALLDATA_PLACEHOLDER`.

| `type` | Fields | Effect |
| --- | --- | --- |
| `"deposit"` | `token`, `amount` | Public funds → pool. Always to self |
| `"withdraw"` | `token`, `amount`, `recipient` | Pool → public recipient address |
| `"transfer"` | `token`, `amount` (FELT or `"OPEN"`), `recipient` | Private transfer inside the pool to another registered user |
| `"invoke"` | `contract`, `calldata` | Calls an invoke helper contract, executed by the pool |
| `"shadow_account_invoke"` | `dapp_name`, `nonce`, `calls`, `collect_policy` | Calls contracts through the user's shadow account. **Wallet API 0.10.4 only, see below** |

`amount` is always the token's smallest unit. `"OPEN"` is only meaningful inside a
multi-action transaction: it creates an empty open note whose value is unknown at build
time and is filled later in the same transaction by a paired `invoke` or
`shadow_account_invoke`. Never used alone.

```ts
import type { STRK20_ACTION } from 'starknet';

const actions: STRK20_ACTION[] = [
  {
    type: 'deposit',
    token: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // STRK
    amount: '0xde0b6b3a7640000', // 1e18, smallest unit
  },
];
```

`strk20InvokeTransaction` takes an **array**, so several private transfers batch into one
wallet request.

### Invoke helpers and calldata placeholders

An `invoke` action never calls a protocol directly. `contract` points at an invoke helper:
a small audited contract for one operation of one protocol. It exposes a `privacy_invoke`
entry point, the last felt of its calldata is always the id of the open note to fill, and
it measures its output as a balance delta before handing it back to the pool. It is shared
by every user, which is what makes the path anonymous.

The DAPP knows neither the pool address nor the open note id at build time, so calldata
takes placeholders that the wallet substitutes:

| Placeholder | Substituted with |
| --- | --- |
| `${poolAddress}` | The privacy pool contract address, also the caller the helper sees |
| `${openNoteIds[N]}` | The id of the Nth open note of the transaction, i.e. the Nth `transfer` with `amount: "OPEN"`, zero-based |

Pass placeholders as raw strings exactly as written. Do not compile or normalize them, or
the wallet will not recognize them.

```ts
const actions: STRK20_ACTION[] = [
  // 1. Send the input token from the shielded balance to the helper:
  { type: 'withdraw', token: strkAddress, amount: '0x2386f26fc10000', recipient: helperAddress },
  // 2. Create the open note that will receive the output token:
  { type: 'transfer', token: usdcAddress, amount: 'OPEN', recipient: myAddress },
  // 3. Run the operation:
  {
    type: 'invoke',
    contract: helperAddress,
    calldata: [usdcAddress, minAmountOut, '${poolAddress}', '${openNoteIds[0]}'],
  },
];
```

The number of open notes created by `transfer` actions must equal the number filled by the
invoke, or the wallet rejects the request with `INVALID_REQUEST_PAYLOAD` before generating
any proof. A transaction has a single invoke slot, so `invoke` and `shadow_account_invoke`
are mutually exclusive.

## Capability detection

Detect with a **version query**, never a data call.

```ts
import { walletV6 } from 'starknet';

const apiVersions = await walletV6.supportedWalletApi(selectedWallet); // API_VERSION[]
// treat wallet API >= 0.10.3 as STRK20-capable for deposit/withdraw/transfer/invoke
```

`walletV6.supportedSpecs(selectedWallet)` returns the RPC spec versions and is the
secondary signal.

Two rules that matter:

- The wallet-standard feature version (`starknet:walletApi` → `"1.0.0"`) does **not** flag
  STRK20 support. It is not a capability check.
- **Never probe `strk20Balances([])` to feature-detect.** It is a balance-reading method,
  so wallets gate it behind a user consent prompt for balance access the app does not
  need. Feature detection must read no user data.

If the connected wallet does not advertise a STRK20-capable version, hide the private
actions or prompt for a supported wallet. Wallet scope as of 2026-08 is **Ready and
Xverse**. Braavos, Privy, and embedded-wallet providers are not prepared for STRK20.

## Wallet API 0.10.3 vs 0.10.4-rc.1: shadow account methods

Current state, verified against npm on 2026-08-14 (`npm view @starknet-io/types-js dist-tags`):

| | Wallet API 0.10.3 | Wallet API 0.10.4-rc.1 |
| --- | --- | --- |
| Status | Latest **stable** spec | Release candidate, published 2026-08-13 |
| types-js | `0.10.3` (npm `latest`) | `0.10.4-beta.2` (npm `beta`) |
| starknet.js 10.4.0 binds to | `@starknet-io/starknet-types-0103` | not bound |
| Actions | `deposit`, `withdraw`, `transfer`, `invoke` | adds `shadow_account_invoke` |
| Methods | the four listed above | adds `wallet_strk20ShadowAccountCommitment` |

Consequences for a DAPP:

- `starknet@10.4.0` imports its STRK20 types from `@starknet-io/starknet-types-0103`, and
  its `WalletAccountV6` class declares no `strk20ShadowAccountCommitment`. The shadow
  surface described on the starknet-js Next docs page is **ahead of the published
  package**.
- **Do not call the shadow methods (`strk20ShadowAccountCommitment`,
  `shadow_account_invoke`) from a DAPP until the connected wallet advertises
  `supportedWalletApi >= 0.10.4`.** Ready and Xverse support for 0.10.4 is unverified as of
  2026-08-14. Gate on the version query, not on a try/catch.
- Build the first shipping phase on 0.10.3 actions only. Shadow accounts are reachable
  today through the STRK20 SDK route (wallet-side), not through the Wallet API route.

Reference documentation for the shadow surface, for when it does land: shadow accounts are
derived from `(user, dapp_name, nonce)`, deployed lazily at a deterministic address, and
driven only by the pool. `collect_policy` is `{ type: 'all' }`, `{ type: 'diff' }`, or
`{ type: 'exact', amount }`. `strk20ShadowAccountCommitment(dappName, nonce?)` returns the
full commitment with a nonce and the partial commitment without one; the commitment is the
deployment salt. Deriving the address also needs the anonymizer address and the SubAccount
class hash, which come from the chain, not from the wallet:

- Shadow account anonymizer, mainnet: `0x04f33230dc57855c6e7eabe66dfa0fde82c5458fd0e54827cdb7cb4c474888a7`
- Shadow account anonymizer, Sepolia: `0x010a2285310c107c731d997afc147afb7495daff6397c2d242133d9fe8d9b147`

Read the class hash from `get_shadow_account_class_hash()` on the anonymizer rather than
hardcoding it. A shadow account holds **public** ERC-20 funds: its balance and its
transactions are visible on-chain. Its privacy is the unlinkability of that address to the
user's main address, not shielding.

## Integration rules that bite

### A deposit is two transactions, never one

The ERC-20 `approve` must be visible on-chain before the private deposit can be proven, so
the wallet prompts twice. Users read the second prompt as a duplicate-transaction bug. Name
both steps in the UI up front rather than letting the second prompt surprise them.

### Notes mature about 10 blocks after creation

Freshly shielded funds are not immediately spendable. A flow that shields and then
transfers moments later fails. Two options: compose both into a single transaction (the
deposit is consumed in-transaction and skips the wait), or show the wait explicitly. They
are not privacy-equivalent: composing links the two legs: so pick deliberately.

### A flat pool fee applies per private operation

Read it from the pool with `get_fee_amount` rather than assuming a value; it was 4 STRK on
mainnet at time of writing. Large enough to drive UX: batching, minimum sensible amounts,
and what "MAX" means on an amount field. Subtract the fee when pre-filling a max amount, or
the operation fails after the user has already signed.

### Normalize addresses before comparing them

Felts have many valid spellings. APIs commonly return `0x4718f5a…` where config holds the
zero-padded `0x04718f5a…`. String equality then reports one token as two: duplicated list
entries, lookups that silently miss.

```ts
const sameToken = BigInt(a) === BigInt(b);
```

### Give `waitForTransaction` a ceiling

Paymaster-relayed transactions can take a while to become visible to your RPC, and an
unbounded await strands the UI in a pending state with no feedback. Race it against a
timeout and treat the timeout as "submitted", with the explorer link as the fallback.

```ts
const receipt = await Promise.race([
  myWalletAccount.waitForTransaction(result.transaction_hash),
  new Promise((_, reject) => setTimeout(() => reject(new Error('WAIT_TIMEOUT')), 120_000)),
]);
```

An accepted request is not a completed operation. Poll to a terminal state; a transaction
stuck pending forever is a failure, not a pass.

## What the DAPP never touches

The wallet holds the user's viewing key, discovers notes, builds the transaction, generates
the proof, and submits it. **The DAPP never sees, requests, stores, or passes a viewing
key.** Any API shape that would have your app handle one is the wrong route: that is the
SDK / wallet-builder route, not the Wallet API route.

## Honest privacy boundaries

- Deposits and withdrawals expose public ERC-20 legs and timing. In-pool movement is
  private; the edges are not. Do not write UX copy implying otherwise.
- The pool enforces deposit screening on-chain. A deposit can be declined by screening.
  Surface that as a state, not as an error bug.
- Wallet capabilities vary. Detect before offering an action.
- Verify wallet, starknet.js, and pool contract addresses for the target network before
  launch.

## Open items to re-verify before building

- Whether Ready implements Wallet API 0.10.4-rc.1 (unverified as of 2026-08-14).
- Ready's consent behavior around `strk20Balances`, which drives whether balance UX can be
  shown without a prompt.
- Fee UX: wallet flows currently sponsor gas but not pool fees; still being designed.
- Whether `strk20ShadowAccountCommitment` appears in a published starknet.js release
  (absent in 10.4.0).

Test against the Ready extension and sanity-check against the wallet test dapp:
https://starknet-wallet-account.vercel.app/

CLAUDE_SESSION_DONE wallet-api
