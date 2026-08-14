# Privacy SDK vs Wallet API for this consumer app

Date: 2026-08-14. Written after the Kimi Code process failed (tokenrouter 503, `moonshotai/kimi-k3-free` channel missing). Sources: official monorepo, by-example, local skill, live org scan.

This product is a consumer private money account. The dapp must never hold a viewing key.

## Two routes, two key holders

| Route | Who holds the viewing key | Who proves | Who this product is |
|---|---|---|---|
| **Wallet API** (`WalletAccountV6`, starknet.js >= 10.4.0) | The user's wallet (Ready today) | The wallet | **Default. Phase 0/1.** |
| **Privacy SDK** (`@starkware-libs/starknet-privacy-sdk`) | The operator / wallet we build | Our backend or our wallet | Only if we own the account |
| **Privacy client** (`@starkware-libs/starknet-privacy-client` 0.1.0) | Whoever we pass to `deriveViewingKey` / `viewingKeyProvider` | Client + optional Avnu paymaster | Do not pin. 0.1.x |

Official Wallet API overview: https://strk20-by-example.org/starknet-wallet-api/overview

Official SDK quickstart: https://github.com/starkware-libs/starknet-privacy/blob/main/sdk/README.md

## What the SDK actually is

Live 2026-08-14:

- Package: `@starkware-libs/starknet-privacy-sdk@0.14.3-rc.5` on GitHub Packages (not npmjs). Node >= 24.
- It is the operator/wallet path. `createPrivateTransfers` requires a `viewingKeyProvider`.
- Signers are **not** on the SDK anymore. They moved to the client: `@starkware-libs/starknet-privacy-client/signers` (`Snip12CallSetSigner`, `Eip712CallSetSigner`). The local skill `links.md` still points at `@starkware-libs/starknet-privacy-sdk/signers`. That path is stale.
- SDK also exposes shadow-account builders for teams that hold keys. That does not unlock Wallet API 0.10.4 for a Ready user.

If we import the SDK in a browser dapp, we have chosen to handle notes, proofs, and a viewing key. That is the wrong product.

## What must never live in the browser

- Viewing keys (including ones derived from a signature)
- Note secrets / nullifiers we computed ourselves
- AVNU paymaster API key
- Any GitHub Packages token used to install the private SDK
- A `viewingKeyProvider` that returns the user's key to our JS

Privacy Bridge 0.1.x derives viewing keys from a wallet signature. That is another reason it is not a Phase 1 pin.

## When a team would use the SDK

Only these cases:

1. We are building a **wallet**, not a dapp, and we will implement Wallet API 0.10.3+ for other dapps.
2. We operate a **custodial/ops** account we own (treasury, demo operator, later org session key) and we can store that account's viewing key in a real secret store, not in the Next.js bundle.
3. We need SDK-only surfaces (shadow builder, discovery as a key holder) and we accept RC churn.

None of those are the consumer payday loop.

## Default for this repo

Phase 0/1: Ready + Wallet API. Methods in `docs/research/claude-wallet-api.md`. Detect `supportedWalletApi >= 0.10.3`. Never probe `strk20Balances` to feature-detect.

Do not npm-pin the SDK or the client. Do not generate Cairo. Do not mix Tongo.

CLAUDE_SESSION_DONE privacy-sdk
