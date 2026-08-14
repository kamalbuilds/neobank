# First-Party Private DeFi Without Writing Cairo

What we can wire today using deployed, first-party contracts and SDKs only. Two routes exist:

| Route | Cairo needed | Status |
| --- | --- | --- |
| AVNU private swap (`@avnu/avnu-sdk`) | **None**: AVNU deployed its own executor | Preview, mainnet + Sepolia pools exported by SDK |
| Vesu lending helper | Cairo exists but is **already written by StarkWare** as the official reference anonymizer | Reference example, integration in progress |

Everything else (staking, app-specific flows) still requires an app-owned anonymizer contract, which is out of scope here. **No new anonymizer contract is generated in this document.**

Sources: [AVNU privacy overview](https://docs.avnu.fi/docs/privacy), [AVNU private swap](https://docs.avnu.fi/docs/privacy/private-swap), [STRK20 by Example: AVNU private swaps](https://strk20-by-example.org/starknet-wallet-api/avnu-private-swaps.md), [Vesu lending helper](https://strk20-by-example.org/helpers/vesu-lending-helper.md), [Private DeFi end to end](https://strk20-by-example.org/starknet-wallet-api/private-defi.md).

---

## 1. How AVNU privacy works

A private transaction never moves tokens from a public account. Three steps:

1. **Private balance.** Tokens deposited into Starknet's privacy pool are held as shielded *notes*, so balances and amounts stay off the public ledger.
2. **Proof.** Each action (withdraw, transfer, swap) becomes a zk-proof built client-side: by the Starknet privacy SDK or by a STRK20-capable wallet: against a recent `provingBlockId`.
3. **Execution.** AVNU's paymaster bundles the proof into a single on-chain transaction through its forwarder contract and pays the gas.

Because the paymaster relays, **the submitting address is not the user's**: no public account is exposed to pay gas and link back to the private balance.

### Fee model

Two costs per private transaction: the **gas fee** to the network, and the **pool fee** to the privacy pool. Private transactions run in the `sponsored_private` fee mode: the relayer pays gas, the user pays only the pool fee, from their private balance, in `feeMode.poolFeeToken` (STRK, ETH, USDC), converted from the base STRK amount by the paymaster's price oracle.

### Transaction types

| Type | When | Example |
| --- | --- | --- |
| `apply_action` | No user call needed | Withdraw, **private swap** |
| `invoke_and_apply_action` | A user call required (e.g. `approve`), wrapped in `execute_from_outside` and signed by the user | Deposit |

---

## 2. AVNU private swap: the no-Cairo route

> "AVNU has deployed its own executor, so a dapp can offer private swaps with **no Cairo to write, review, or audit**."

### Prerequisites

- `@avnu/avnu-sdk >= 4.2.0` (ships the privacy service: `executePrivateSwap`, `createStrk20WalletProver`, `buildPrivateSwapFee`, `submitPrivateSwap`) and `starknet@^10.4.0`.
- A proving backend: a **STRK20-capable wallet** (starknet.js >= 10.4, `WalletAccountV6`: Ready and Xverse today) or the Starknet privacy SDK.
- Wallet API **>= 0.10.3** for the STRK20 methods (`wallet_strk20PrepareInvoke`, `wallet_strk20Balances`, ...).
- **The sell token must already be shielded.** "The swap moves value inside the pool, so it cannot shield for you": the user deposits into the pool first. This is a hard product constraint: our UX needs a deposit step before any private swap is offerable.

```shell
npm install @avnu/avnu-sdk@^4.2.0 starknet@^10.4.0
```

### Capability probe

Wallets predating `wallet_supportedWalletApi` throw on the probe: catch and treat as not capable.

```typescript
import { compareVersions, walletV6 } from 'starknet';

const versions = await walletV6.supportedWalletApi(walletProvider);
const supportsPrivateSwaps = versions.some((v) => compareVersions(v, '0.10.3') >= 0);
```

### `executePrivateSwap`

The sell token is withdrawn from the privacy pool to AVNU's executor, the swap runs through AVNU's solver-optimized routing, and the bought token lands back in the private balance as a new note. It is an `apply_action` transaction: no user signature, since everything settles on-chain straight from the proof.

`executePrivateSwap` orchestrates four steps:

1. **Pool fee.** The paymaster returns the pool fee to withdraw (`token`, `recipient`, `amount`).
2. **Private calls.** `quoteToCalls({ private: true })`: the backend sets `takerAddress = executor` and returns the inner swap `calls` plus the `executorAddress`.
3. **Proof.** The injected `PrivateSwapProver` builds and proves: withdraw the sell amount to the executor, withdraw the pool fee, open a note for the bought token, invoke the executor with the serialized swap calls.
4. **Submit.** The paymaster relays the proof on-chain; the relayer pays gas, the pool fee reimburses it.

```typescript
import {
  getQuotes,
  executePrivateSwap,
  createStrk20WalletProver,
  PRIVACY_POOL_ADDRESS,
} from '@avnu/avnu-sdk';

const STRK = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ETH  = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

const [quote] = await getQuotes({
  sellTokenAddress: STRK,
  buyTokenAddress: ETH,
  sellAmount,
  takerAddress: account.address,
  size: 1,
});

const { transactionHash } = await executePrivateSwap({
  quote,
  slippage: 0.05, // 5%
  takerAddress: account.address,
  poolAddress: PRIVACY_POOL_ADDRESS, // SEPOLIA_PRIVACY_POOL_ADDRESS on testnet
  feeMode: { poolFeeToken: STRK, tip: 'normal' },
  prover: createStrk20WalletProver(account),
  paymasterApiKey: PAYMASTER_API_KEY, // Portal key: SERVER-SIDE ONLY
});
```

### Parameters

| Parameter | Notes |
| --- | --- |
| `poolAddress` | Required. SDK exports the pools whitelisted by the paymaster: `PRIVACY_POOL_ADDRESS` (mainnet), `SEPOLIA_PRIVACY_POOL_ADDRESS` (testnet). |
| `feeMode.poolFeeToken` | Required. Token for the pool fee (STRK, ETH, USDC); paymaster converts the base STRK amount via price oracle. |
| `feeMode.tip` | `'slow' \| 'normal' \| 'fast'`, defaults to `'normal'`. |
| `prover` | Required. `buildAndProve(plan)` returns the proven `{ call, proof }`. The SDK never handles private keys, notes, or proof generation. |
| `chainId` | Optional fail-fast check, compared to `quote.chainId` before any paymaster or proving round-trip. |
| `paymasterApiKey` | Required. Portal key, same one as gasfree. **Server-side only.** |

### `createStrk20WalletProver`

```typescript
import { createStrk20WalletProver } from '@avnu/avnu-sdk';

const prover = createStrk20WalletProver(account); // any account exposing strk20PrepareInvoke
```

The wallet keeps the keys and notes and generates the proof; the dapp only describes actions. To drive `wallet_strk20PrepareInvoke` directly instead, `buildStrk20Actions(plan)` returns the four STRK20 actions to prove; map the wallet's `{ call, proof }` artifact to `PrivateSwapCallAndProof`.

Alternative prover, when we manage keys and notes ourselves via the Starknet privacy SDK:

```typescript
import { transaction } from 'starknet';
import type { PrivateSwapProver } from '@avnu/avnu-sdk';

const prover: PrivateSwapProver = {
  buildAndProve: (plan) =>
    transfers
      .build()
      .with(plan.sellTokenAddress, (t) => {
        t.withdraw({ recipient: plan.executorAddress, amount: plan.sellAmount });
        t.surplusTo(plan.takerAddress);
      })
      .with(plan.fee.token, (t) =>
        t.withdraw({ recipient: plan.fee.recipient, amount: plan.fee.amount }),
      )
      .with(plan.buyTokenAddress, (t) =>
        t.transfer({ recipient: plan.takerAddress, amount: Open }),
      )
      .invoke(({ openNotes }) => ({
        contractAddress: plan.executorAddress,
        calldata: [
          plan.buyTokenAddress,
          ...transaction.fromCallsToExecuteCalldata_cairo1(plan.executorCalls),
          openNotes[0].noteId,
        ],
      }))
      .execute({ provingBlockId }),
};
```

`Open` is a privacy SDK sentinel that opens a note for the swap output, whose amount is only known after execution. The executor expects `[buyToken, ...serializedCalls, openNoteId]`. Both proving backends produce the same `{ call, proof }` artifact.

### Paymaster key: server-side only, mandatory split

The docs are explicit: **"Server-side only: do not ship it in client code."** And: "passing the key from a browser leaks it."

Our architecture must therefore split the flow:

- **Server endpoints:** `buildPrivateSwapFee` and `submitPrivateSwap`: these are the two calls that carry `paymasterApiKey`.
- **Client, with the user's wallet:** the `prover` step only. Keys and notes never leave the wallet.

`executePrivateSwap` is the convenience wrapper over three separately callable functions, which is exactly what makes the split possible:

```typescript
import { buildPrivateSwapFee, quoteToCalls, submitPrivateSwap, PRIVACY_POOL_ADDRESS } from '@avnu/avnu-sdk';

// 1. SERVER: pool fee from the paymaster
const fee = await buildPrivateSwapFee({
  poolAddress: PRIVACY_POOL_ADDRESS,
  feeMode: { poolFeeToken: STRK, tip: 'normal' },
  paymasterApiKey: PAYMASTER_API_KEY,
});
// { token, recipient, amount }: withdraw this inside the private transaction

// 2. Private swap calls (backend sets takerAddress = executor)
const { calls, executorAddress } = await quoteToCalls({
  quoteId: quote.quoteId,
  slippage: 0.05,
  private: true,
});

// 3. CLIENT proves, then SERVER submits
const callAndProof = await prover.buildAndProve({ /* plan */ });
const { transactionHash } = await submitPrivateSwap({
  callAndProof,
  feeMode: { poolFeeToken: STRK, tip: 'normal' },
  paymasterApiKey: PAYMASTER_API_KEY,
});
```

The paymaster client is built into the SDK, targeting `starknet.paymaster.avnu.fi` by default; override with `AvnuOptions.paymasterBaseUrl` (e.g. `sepolia.paymaster.avnu.fi` for testing). Key comes from the [AVNU Portal](https://portal.avnu.fi), same one as gasfree, and lives in `.env` on the server.

### Limits

- Preview status; AVNU states "the API surface may still change."
- **Swap only.** For lending, staking, or any app-specific flow, AVNU's executor does not apply: that needs the anonymizer-contract pattern.
- Cannot shield: the sell token must be pre-deposited.

---

## 3. Vesu lending helper: official reference anonymizer

For lending, the Cairo is not ours to write either: StarkWare ships `vesu_lending_anonymizer` in the `starknet-privacy` repo (`packages/vesu_lending_anonymizer/src/vesu_lending_anonymizer.cairo`, Apache-2.0) as the reference anonymizer used in the official Starknet Privacy docs. Caveat stated at source: **it is a reference example: review and adoption of the Vesu route remain with the app team, and the integration is in progress.**

Vesu is a permissionless lending protocol whose pools are ERC-4626 / SNIP-22 tokenized vaults: deposit underlying assets, receive vToken shares; withdraw by burning shares.

### Operations

One entry point, `privacy_invoke`, called by the privacy contract via `INVOKE_SELECTOR`:

| Operation | Direction | Vault position | Result |
| --- | --- | --- | --- |
| `Deposit` | underlying → vToken shares | vault at `out_token` | helper approves the vault, calls `deposit`, minted shares land in an open note |
| `Withdraw` | vToken shares → underlying | vault at `in_token` | helper calls `withdraw`, returned assets land in an open note |

Signature:

```cairo
fn privacy_invoke(
    ref self: T,
    operation: LendingOperation,   // Deposit | Withdraw
    in_token: ContractAddress,     // input funds (on withdraw: the vToken)
    out_token: ContractAddress,    // output funds (on deposit: the vToken)
    assets: u256,
    note_id: felt252,              // the open note to credit the output to
) -> Span<OpenNoteDeposit>;
```

The position in the vault is itself a private note holding vTokens: yield accrues to a position nobody can attribute to the user.

### Design properties worth carrying into our integration

- **Same skeleton as the swap helper:** validate inputs, snapshot the output balance, do the external call, credit the delta.
- **Stateless and permissionless:** no storage, no pinned pool address. It trusts only the measured balance delta and approves whoever called it. Anything it holds mid-transaction is pulled by the pool in the same transaction.
- **Directionality via token roles:** deposit puts the vault at `out_token`, withdraw at `in_token`. One signature covers both directions.
- **ERC-4626 return value ignored** in favor of the measured balance delta.
- **`u256` assets, `u128` note amounts:** vault math is `u256`; the credited delta must fit a note's 128-bit amount or the call reverts (`RECEIVED_AMOUNT_OVERFLOW`).
- Error codes: `ZERO_IN_TOKEN`, `ZERO_OUT_TOKEN`, `ZERO_ASSETS`, `TOKENS_EQUAL`, `RECEIVED_AMOUNT_OVERFLOW`, `ZERO_OUT_AMOUNT`.

---

## 4. Wiring any helper from the dapp: open notes and placeholders

The pattern applies to Vesu and to any deployed helper. Requires `starknet@^10.4.0` and a wallet supporting Wallet API `0.10.3`. No viewing key ever touches our app.

A private DeFi call is **one** STRK20 transaction carrying two actions:

1. A `transfer` with the literal amount `"OPEN"`: creates the **open note**, the slot the helper's output gets credited into. Its amount is only known after the helper runs on-chain.
2. An `invoke` naming the helper contract and its calldata.

The wallet resolves two placeholders inside the invoke calldata:

| Placeholder | Resolves to |
| --- | --- |
| `${openNoteIds[N]}` | The id of the Nth open note in this transaction |
| `${poolAddress}` | The privacy pool contract address |

That indirection is what lets us reference a note that does not exist yet at the time we build the calldata.

```ts
import type { STRK20_ACTION } from "@starknet-io/types-js"

const actions: STRK20_ACTION[] = [
  // 1. Open the note the output will be credited into.
  { type: "transfer", token: tokenOut, amount: "OPEN", recipient: userAddress },

  // 2. Call the helper. ${openNoteIds[0]} is the note opened above.
  {
    type: "invoke",
    contract: helperAddress,
    calldata: [tokenIn, tokenOut, amountIn, "${openNoteIds[0]}"],
  },
]

const { transaction_hash } = await account.strk20InvokeTransaction(actions)
```

The pool withdraws the input to the helper, calls its `privacy_invoke` entry point, and credits the returned `OpenNoteDeposit` into the open note: atomically. Calldata order must match the helper's `privacy_invoke` signature; the pool deserializes it directly into that function's parameters.

Dry-run to catch calldata-shape mistakes cheaply: builds and proves without submitting:

```ts
const prepared = await account.strk20PrepareInvoke(actions, true) // simulate
```

Shielded balances are a wallet call too, so no viewing key in our app:

```ts
const balances = await account.strk20Balances([tokenIn, tokenOut])
// [{ token, balance }, ...]
```

---

## 5. Privacy boundary: what stays public

State this in the UI, not just in code comments.

- The helper's on-chain action and the amounts it moves are **visible**. Observers see pool → helper → AMM/vault → helper. What they do not see is who initiated it.
- **Open-note amounts are plaintext by design**: they are measured at execution time, so the amount credited into an open note is public. Privacy here is unlinkability of the actor, not confidentiality of the traded amount.
- **Deposits and withdrawals remain public legs.** Entering and exiting the pool is observable; only activity inside the pool is shielded.
- For the AVNU route, the paymaster relays, so the submitting address is not the user's.

---

## 6. Class hashes

**None of the five sources state an official class hash** for the AVNU executor, the privacy pool, or the Vesu lending helper. What they do give:

- Pool addresses come from SDK exports, not hardcoded literals: `PRIVACY_POOL_ADDRESS` (mainnet) and `SEPOLIA_PRIVACY_POOL_ADDRESS` (testnet), described as "the pools whitelisted by the paymaster."
- The AVNU executor address is returned at runtime as `executorAddress` from `quoteToCalls({ private: true })`: do not hardcode it.
- Vesu helper source lives at `starknet-privacy` `packages/vesu_lending_anonymizer/`; its deployed class hash is not published in these pages.

Any class hash we need must be pulled from the `starknet-privacy` deployment artifacts or a block explorer and verified against a declared class before use. Do not invent one.

---

## 7. What we can build now

1. **Private swap, today, zero Cairo.** AVNU SDK + STRK20 wallet prover, paymaster calls behind server endpoints, deposit step in the UX to shield the sell token first.
2. **Private lending, using StarkWare's helper.** No Cairo authored by us, but the Vesu route is an in-progress reference: needs a deployed helper address, our own review, and Sepolia end-to-end verification before it is product.
3. **Balance display and dry-run** via `strk20Balances` and `strk20PrepareInvoke`, no viewing key handling on our side.

Blocked without new Cairo: staking and any app-specific private flow.

CLAUDE_SESSION_DONE first-party-defi
