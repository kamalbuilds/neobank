# starkware-libs + starknet-edu inventory

Date: 2026-08-14. Source: `gh api orgs/.../repos` plus README/spec reads. Not every archived 2022 tutorial.

## What this changes in the plan

1. Wallet API **shadow accounts are specified** as of `v0.10.4-rc.1` (released 2026-08-13). types-js stable `0.10.3` does not have them. `0.10.4-beta.2` does. Do not build Phase 0 on shadow until Ready advertises `>= 0.10.4`.
2. `earn-contracts` is the real MetaMask onboarding path (Eth712Account + factory). RFP idea 06 named this.
3. `starknet-privacy/client` is a new dapp layer (`@starkware-libs/starknet-privacy-client` 0.1.0): shadow resolve, SNIP-12 / EIP-712 signers, Avnu paymaster adapter.
4. `starknet-edu/starknet-privacy-toolkit` is **Tongo**, not STRK20. Do not mix.
5. Native Starknet perps live in `starknet-perpetual` (WIP). That is the honest "private perps" venue on this stack, not Hyperliquid, if we ever do it.
6. `starknet-payments` is **Madu**: signed two-sided orders (RFQ/OTC), audited, WIP. Not Beam phone/email.

## starkware-libs: use for the neobank

| Repo | Last push | What it is | Use |
|---|---|---|---|
| [starknet-privacy](https://github.com/starkware-libs/starknet-privacy) | 2026-08-13 | Pool, SDK rc.5, Vesu/Ekubo/shadow anonymizers, `client/` 0.1.0 | Core |
| [privacy-bridge](https://github.com/starkware-libs/privacy-bridge) | 2026-08-13 | EVM USDC ↔ pool over CCTP | Phase 1 funding |
| [starknet-specs](https://github.com/starkware-libs/starknet-specs) | 2026-08-13 | Wallet API 0.10.4-rc.1, proving API | Pin against this, not memory |
| [earn-contracts](https://github.com/starkware-libs/earn-contracts) | 2026-06-28 | Eth712Account, AccountFactory, AVNU strategy, Earn reporter | EVM-user onboarding |
| [sequencer](https://github.com/starkware-libs/sequencer) `crates/starknet_transaction_prover` | 2026-08-13 | Hosted/self-hosted proving | Infra only |
| [strkBTC](https://github.com/starkware-libs/strkBTC) | 2026-05-17 | BTC wrap; **LP-gated deposits** (k-of-n signers) | Hold/earn if user already has strkBTC. Not a permissionless BTC on-ramp. |
| [usdc-migration](https://github.com/starkware-libs/usdc-migration) | 2026-07-23 | USDC.e → native USDC 1:1 | One-time helper if we see legacy USDC |
| [starknet-payments](https://github.com/starkware-libs/starknet-payments) | 2026-07-23 | Madu signed-order matching (`trade(order_a, order_b, sigs)`) | Later private OTC anonymizer |
| [starknet-perpetual](https://github.com/starkware-libs/starknet-perpetual) | 2026-05-05 | Native perps (positions, vaults, liquidations). WIP | Later private perps on Starknet |
| [starknet-staking](https://github.com/starkware-libs/starknet-staking) | 2026-04-06 | SNIP-18 staking | Later private stake via anonymizer |
| [starkware-starknet-utils](https://github.com/starkware-libs/starkware-starknet-utils) | 2026-08-13 | Shared Cairo roles/replaceability | Depend if we write Cairo |
| [sn-governed-token](https://github.com/starkware-libs/sn-governed-token) | 2026-07-23 | Upgradeable ERC20 + blocklist | Not our token |

## starkware-libs: do not treat as product

| Repo | Why |
|---|---|
| Seamless-2FA-Wallet | Design phase. Account contract not implemented. |
| proving | Empty README. Stwo verifier workspace. Not an app SDK. |
| starknet-connect | README is one line. |
| cairo, cairo-lang, cairo-vm, stwo, stwo-cairo | Language/prover. We consume, we do not fork. |
| papyrus, blockifier | Archived. Sequencer replaced them. |
| starkex-*, dydx-config, okx-config, davion-config, x10-config | Old StarkEx / venue configs. Historical. |
| starknet.js / starknet-rs / starknet-devnet **forks under this org** | Forks. Use upstream `starknet-io` / 0xSpaceShard. |

## Wallet API methods (from `wallet_rpc.json`)

**0.10.3 (Ready today, types-js latest stable):**
- `wallet_strk20InvokeTransaction`
- `wallet_strk20PrepareInvoke`
- `wallet_strk20Balances`
- Actions: deposit, withdraw, transfer, invoke

**0.10.4-rc.1 / types-js 0.10.4-beta.2 (spec yes, wallet unknown):**
- `wallet_strk20ShadowAccountCommitment`
- Action: `shadow_account_invoke` (`dapp_name`, `nonce`, calls, collect policy `all` or `diff`)

## starknet-privacy internals we had not opened

| Path | Role |
|---|---|
| `packages/privacy` | Pool |
| `packages/ekubo_swap_anonymizer` | Private swap helper |
| `packages/vesu_lending_anonymizer` | Private lend helper |
| `packages/shadow_account_anonymizer` | Commitment → dedicated account that calls dapps, settles to open notes |
| `sdk/` | `@starkware-libs/starknet-privacy-sdk` 0.14.3-rc.5 |
| `client/` | `@starkware-libs/starknet-privacy-client` 0.1.0: `createPrivacyClient`, `resolveShadowAccounts`, `Eip712CallSetSigner`, `AvnuPaymaster`, `deriveViewingKey` |
| `client/src/signers/eip712-call-set-signer.ts` | Lets an Eth712Account / MetaMask authorize pool invocations |
| `docs/audit` | OZ Privacy V1, 2026-05-29 |

## earn-contracts (the missing onboarding primitive)

| Package | Role |
|---|---|
| `eth_712_account` | Starknet account owned by an Ethereum address. Validates EIP-712 + secp256k1. SRC6 + SRC9 execute-from-outside. |
| `account_factory` | `deploy_account(eth_address, signature)` and `get_expected_account_address` (deterministic). |
| `contracts/primer` | Upgrade primer class → real account class. |
| `strategy_implementation` | Earn strategies: AVNU multi-route swap + ERC-4626 deposit (Midas/Re7 BTC named). |
| `earn_reporter` | Position reporting for the Earn portal. |

This is how a user signs with MetaMask and gets a Starknet account without Ready. Combine with Privacy Bridge + EIP-712 CallSet signer for "one-click privacy from any chain."

## starknet-edu

Almost all archived 2022–2024 workshops. Two living things:

| Repo | What | Verdict |
|---|---|---|
| [starknet-privacy-toolkit](https://github.com/starknet-edu/starknet-privacy-toolkit) | **Tongo** private transfers + Noir/Garaga donation badges. Mainnet Tongo USDC `0x026f79...`. Last push 2026-01-19. | Different protocol. Do not integrate. |
| [starknet-privy-demo](https://github.com/starknet-edu/starknet-privy-demo) | Privy + Ready account deploy + optional AVNU paymaster. Sepolia demo, 2025-09. | Pattern for email/social login later. Not STRK20. |
| starknet-remote-controlled-account | Empty README, 2025-02. | Ignore. |

## Private perps implication

RFP "private Hyperliquid" is still not a 17-day build. If we ever do private perps **on this stack**, the composable venue is `starknet-perpetual` (positions keyed by `PositionId`, operator `multi_trade`), invoked through a shadow account + anonymizer. Hyperliquid remains a TEE/API-wallet problem on another chain.

## Gaps still unverified

- Does Ready implement Wallet API 0.10.4-rc.1?
- Is earn-contracts Eth712Account deployed on mainnet, and at what class hash?
- Is Madu payments deployed?
- `proving` crate purpose (README empty).
