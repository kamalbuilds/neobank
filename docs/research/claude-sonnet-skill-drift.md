# Skill drift fix: sdk-route.md

Date: 2026-08-14. Source of truth: references/links.md, docs/research/claude-privacy-sdk.md, STRK20_INTEGRATION_PLAN.md.

Edited `.agents/skills/strk20-privacy-integration/references/sdk-route.md`, Sub-accounts (Branch D) status block only.

## Changes

1. SDK version `0.14.3-rc.4` to `0.14.3-rc.5` (matches links.md pin as of 2026-08-14).
2. Added note: signers (`Snip12CallSetSigner`, `Eip712CallSetSigner`) are not on `starknet-privacy-sdk` anymore, they live on `@starkware-libs/starknet-privacy-client/signers`. Old text implied signers still ship with the SDK.
3. Rewrote the Wallet API sub-account line. Old text said "still nothing" flatly. New text names spec v0.10.4-rc.1's `wallet_strk20ShadowAccountCommitment` / `shadow_account_invoke`, and states Ready support for them is unverified, so a dapp must not call shadow methods until a connected wallet actually advertises `supportedWalletApi >= 0.10.4`.

No other files touched. No Cairo, no scaffolding, no viewing-key example changes.

CLAUDE_SESSION_DONE sonnet-skill-drift
