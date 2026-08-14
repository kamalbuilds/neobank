# STRK20 Privacy Integration Plan: neobank

Generated 2026-08-14 by the strk20-privacy-integration skill. Statuses below were current at generation time. Freshness check (`scripts/check_freshness.py`) run the same day: get-starknet `next` is 6.0.4 (skill used to pin 6.0.3); `packages/sub_account_anonymizer` renamed to `packages/shadow_account_anonymizer`; Wallet API latest stable is v0.10.3 with v0.10.4-rc.1 in flight.

Product judgment (not executed by this skill): `docs/PRODUCTION_BUILD_PLAN.md`. Org scan: `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md`.

## 1. Project snapshot

- Stack: greenfield. No `package.json`, no Cairo, no wallet connect. After scaffold: Next.js + exact pins in section 4 + Ready. Seed from https://github.com/Akashneelesh/strk20-starter-kit at commit `187fe78`, then delete DEMO amounts and the echo helper. File-level copy/delete list: `docs/research/claude-starter-kit.md`.
- Relevant code (does not exist yet; these are the files the starter kit will create and we will change):
  - wallet connect: `src/app` wallet picker / `SelectWallet.tsx` (starter names)
  - transaction layer: wherever `WalletAccountV6` is constructed (starter `WalletAccountV6Tag.tsx`)
  - constants / pool / token: `src/utils/constants.ts`
  - no production Cairo in-repo until a later payroll/card helper; do not ship `cairo/src/lib.cairo` echo helper
- Privacy goal (from prior session): hide who pays whom and the size of the book (balances + private transfers). Yield via first-party Vesu anonymizer. Swaps via first-party AVNU (no Cairo). Card spend and unlinkable wallet↔app link are later. Do not hide screening or claim the merchant cannot see a card.
- Environment: **mainnet required for the Private Sprint** (user confirmed the RFP/sprint). Test against Ready first. Users today: Ready (privacy Wallet API live). Xverse in-wallet live, dapp-facing API in progress. Braavos / Privy are unsupported for STRK20.

Confirmed: this is a normal dapp (user wallet) plus later team-owned helpers. Not a wallet we ship. Not a backend that holds viewing keys for consumers.

## 2. Chosen route: Wallet API now + first-party DeFi + team anonymizers later

Mixed, and that is the correct split.

- **User flows (Phase 1):** Privacy Wallet API via starknet.js. The dapp asks Ready to shield, transfer, unshield. Never touches a viewing key. https://strk20-by-example.org/starknet-wallet-api/overview
- **Private swap (Phase 2):** AVNU first-party. No anonymizer of our own. https://strk20-by-example.org/starknet-wallet-api/avnu-private-swaps
- **Private yield (Phase 2):** Vesu reference helper. Monorepo README lists class hash `0x3751128dc3ebd36215f982766f14aaca8f78793e4b0f42a73e49372a8e24aae` at tag `PRIVACY-0.14.3-RC.0`. That is a class, not a callable instance. Instance address is UNVERIFIED. Sprint DeFi leg is AVNU, not Vesu, until an instance is verified. https://strk20-by-example.org/helpers/vesu-lending-helper
- **Payroll / card settlement (Phase 3):** our own `privacy_invoke` helpers. This skill never generates that Cairo. Team writes, reviews, audits, deploys. https://strk20-by-example.org/helpers/privacy-invoke
- **EVM funding (not an EVM app):** Privacy Bridge as a reference to read, not a pinned dependency. https://github.com/starkware-libs/privacy-bridge
- **Shadow accounts:** SDK path exists. Wallet API methods exist in spec v0.10.4-rc.1 and `@starknet-io/types-js@0.10.4-beta.2`. Stable types-js is 0.10.3. Ready support unverified. Tracked, not Phase 1.

**The rule this follows:** this app never touches viewing keys. The user's wallet acts on its behalf via starknet.js.

Do not use Tongo (`starknet-edu/starknet-privacy-toolkit`). Different pool.

## 3. What this delivers: hidden vs visible

| Private | Public |
|---|---|
| Sender and receiver of a private transfer | Deposit and withdrawal amounts (the ERC-20 legs) |
| Transfer amounts and token type inside the pool | That an address interacted with the pool, and when |
| Which notes were spent | Relayer as `tx.sender` (never treat this as the user) |
| Owner of a Vesu/AVNU open note | Filled amount of that open note; the fact a swap/lend happened |
| Viewing-key ledger (user + selective disclosure) | Screening decision on deposit |

Anonymizers hide the user's address. Amounts and app activity at Vesu/AVNU may stay public. Shadow accounts (when wallets ship 0.10.4) hide the wallet↔app link; the dapp action and amounts may still be public.

History, analytics, and any later rewards read the pool `Deposit` event first indexed key, never `tx.sender`.

A deposit is two wallet prompts (public `approve`, then private deposit). Notes mature ~10 blocks. Do not bundle a public deposit with a later spend unless the plan states the unlinkability cost. Live demo: shield well before the stage, then show private send (and optional AVNU) against already-mature notes. https://strk20-by-example.org/what-is-strk20 https://strk20-by-example.org/compliance

Recipient of a private transfer must already be registered in the pool. The dapp cannot register them and 0.10.3 has no registration-read. Invite and payroll wait until the recipient has used Ready on the pool once.

## 4. Prerequisites & versions

Pins after 2026-08-14 freshness check:

- `starknet@10.4.0` exact until we re-run the import check on a newer `next` build. Do not leave a floating range against `next`.
- `@starknet-io/get-starknet-discovery@6.0.4`, `@starknet-io/get-starknet-wallet-standard@6.0.4` (npm `next`; 6.0.3 pin is stale). Compare Wallet API versions with a real semver helper, not string order.
- `@starknet-io/types-js@0.10.3` for Phase 1 (stable). Do not pin `0.10.4-beta.2` until Ready advertises Wallet API >= 0.10.4
- `@avnu/avnu-sdk@4.2.0` when Phase 2 starts
- Test wallet: Ready extension
- Capability detect: `walletV6.supportedWalletApi` / `supportedSpecs`, treat `>= 0.10.3` as STRK20-capable. Never probe `strk20Balances` to feature-detect
- Canonical pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- Cairo later (Phase 3 only): Scarb + Starknet Foundry. Not in Phase 1

## 5. Phase 1: first shielded flow (buildable now)

Status: pending approval. Testnet-first locally; mainnet txs only after you confirm (sprint requires mainnet).

Sprint floor (must work by Aug 31): Ready connect, shield, private send to a second registered Ready wallet, honest labels. Stretch: AVNU private swap from an already-shielded balance. Cut from the floor: statement PDF, Vesu, payroll, card, shadow accounts.

1. Scaffold from the starter kit into this repo. Delete DEMO token amounts and do not ship the echo `privacy_invoke` helper as a product surface.
2. Pin the versions in section 4 in the new `package.json`.
3. Connect via get-starknet v6. Construct `WalletAccountV6`. Fetch the current API before coding: https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6 and https://strk20-by-example.org/starknet-wallet-api/starknet-js (React: https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook)
4. Wire shield / private transfer / unshield. Label the two-step deposit (`approve` then deposit). Show the ~10 block maturity wait before a follow-up spend. Subtract the pool fee (`get_fee_amount`) from MAX.
5. Graceful degradation: if `supportedWalletApi` is missing or `< 0.10.3`, hide private actions and tell the user to use Ready. Braavos/Privy are unsupported.
6. Verify against Ready and https://starknet-wallet-account.vercel.app/

## 6. Phase 2: feature integration

- Receive: payment link / QR that is a registered pool address, not a new stealth scheme. https://strk20-by-example.org/viewing-keys
- AVNU private swap from an already-shielded balance. Paymaster API key server-side only. https://docs.avnu.fi/docs/privacy
- Vesu deposit/withdraw through the official helper via Wallet API invoke + open notes. https://strk20-by-example.org/starknet-wallet-api/private-defi
- Honest private vs public labels on every screen.
- Statement view only via consented `strk20Balances` when we actually show balances.
- Re-check fee / paymaster UX at build time (gas may be sponsored; pool fee is not).

## 7. Phase 3: team anonymizers + shadow accounts (tracked)

- **Payroll / card settlement helpers**
  - Entry criterion: Phase 1 live on mainnet and we have a named protocol action with no first-party private path.
  - Design on paper first (withdraw → act → open note). Study `packages/vesu_lending_anonymizer` and Privacy Bridge inbound `privacy_compute` if we bind an attestation.
  - This skill does not write the Cairo. Team owns review, audit (before mainnet), deploy, maintenance.
- **Shadow accounts / unlinkable spend identities**
  - Entry criterion: Ready (or Xverse dapp API) advertises Wallet API `>= 0.10.4` **and** `wallet_strk20ShadowAccountCommitment` works on a real wallet. Spec: https://github.com/starkware-libs/starknet-specs/releases/tag/v0.10.4-rc.1
  - Until then, do not call shadow methods from the dapp.
- **EVM funding**
  - Entry criterion: we have read `privacy-bridge` README + `CLAUDE.md` and accept 0.1.x churn. Not a pin.
- **EVM-signed Starknet account (Earn path)**
  - Entry criterion: we need MetaMask users without Ready. Then `earn-contracts` Eth712Account + factory. Still a Starknet app.

## 8. Testing

- Local: starter kit + Ready against Sepolia first (`0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` for the v2 pool on Sepolia per by-example SDK page).
- Pure local devnet does not exercise the wallet/proving path.
- Ready extension + wallet test dapp before any mainnet click.
- Mainnet: only after explicit confirmation. Sprint wants three real txs and `strk20.json`.
- Phase 3: snforge + atomic rollback tests on any helper we own.
- Give `waitForTransaction` a ceiling; treat timeout as submitted with an explorer link.
- Normalize addresses with `BigInt(a) === BigInt(b)` before comparing tokens.

## 9. Compliance & security notes

- Deposit screening is enforced onchain by the protocol; it applies on every route, including self-hosted proving. Surface a declined deposit as a screening state, not a bug.
- Selective disclosure exists for a legitimate regulatory request. It is not automatic compliance and is not a regulator endorsement. The team owns legal/compliance decisions and any use-case KYC.
- Never frame any route as a screening workaround.
- Phase 3: the team owns review, audit, deployment, and maintenance of any anonymizer we ship.
- No viewing keys, private keys, or paymaster secrets in the repo. Env placeholders only.

## 10. Open items to re-verify at build time

- get-starknet `next` is 6.0.4 today; confirm that pin before `npm install`.
- Does Ready implement Wallet API 0.10.4-rc.1 shadow methods? If yes, unlock Phase 3 shadow.
- Xverse dapp-facing Wallet API status.
- Pool fee amount via `get_fee_amount` (was 4 STRK; do not hardcode).
- `starknet` `next` vs `latest` dist-tags.
- Privacy Bridge 0.1.x and privacy-client 0.1.0 APIs before we depend on them.
- earn-contracts Eth712Account mainnet class hash if we take that path.

## 11. Links

- Pool (mainnet): https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
- Whitepaper: https://eprint.iacr.org/2026/474
- Concepts: https://strk20-by-example.org/what-is-strk20
- Wallet API overview: https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js: https://strk20-by-example.org/starknet-wallet-api/starknet-js
- React hooks: https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook
- Private DeFi invoke: https://strk20-by-example.org/starknet-wallet-api/private-defi
- AVNU private swaps: https://strk20-by-example.org/starknet-wallet-api/avnu-private-swaps
- `privacy_invoke`: https://strk20-by-example.org/helpers/privacy-invoke
- Vesu helper: https://strk20-by-example.org/helpers/vesu-lending-helper
- Compliance: https://strk20-by-example.org/compliance
- WalletAccount guide: https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6
- SDK monorepo: https://github.com/starkware-libs/starknet-privacy
- Privacy Bridge (read, don't pin): https://github.com/starkware-libs/privacy-bridge
- Wallet test dapp: https://starknet-wallet-account.vercel.app/
- Starter kit: https://github.com/Akashneelesh/strk20-starter-kit
- Support: Cairo CoreStars Telegram `@sncorestars`
