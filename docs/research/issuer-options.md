# Card issuer options: Phase 2 note, not sprint

Date: 2026-08-14.
Status: research only. No card code this sprint. Phase 0/1 stay on Ready + STRK20 pool, no BIN, no issuer integration.

This doc answers one question for Phase 2: once a user unshields to public USDC, who turns that into a Visa/Mastercard swipe. It does not pick a winner. It re-verifies claims against primary docs where we had time, marks the rest UNVERIFIED, and corrects one line in `docs/PRODUCTION_BUILD_PLAN.md`.

## Why this note exists

`docs/PRODUCTION_BUILD_PLAN.md` Phase 2 names three candidates (Bridge+Stripe JIT, Gnosis Pay Safe, Rain) plus Reap, and says "unshield to a fresh issuer funding address per auth when possible." That line needs a correction: no candidate documents fresh-address-per-auth. See "Plan correction" below.

Locked product rule, unchanged: a Visa cannot debit a STRK20 note. Path is unshield / CardSettle -> public USDC on an EVM chain or Solana -> issuer -> Visa. Card stays Phase 2.

## What died: Ready Card / Kulipa

Ready's own card ran on Kulipa, a Paris-based EMI. Kulipa wind-down: EEA-only cutoff in June 2026 with one-hour notice, then late July 2026 full stop of the Metal/Lite card tiers. The same wind-down paused Solflare Card, a second Kulipa-issued product. Do not rebuild card issuance on Kulipa. This is why Ready's own card is currently unavailable, and it is the direct reason Phase 2 needs a different issuer.

### What they did next

Sourced 2026-08-14.

Solflare, official https://www.solflare.com/blog/cards-service-pause/: cards stopped 28 July 2026, moving to a "new card issuing partner" expected August. Existing cards do not carry over. Partner name, network, and fees not stated. Live product page still shows paused. SpendNode agrees the partner is not yet named. Any specific BIN guess (Rain, Bridge, Reap, Gnosis, Monavate) is UNVERIFIED.

Ready, official https://www.ready.co/blog/community-finance (6 Aug 2026, Itamar Lesuisse): announces Community Cards launching soon, where spend sends a share of card program revenue to a chosen community. The new Ready runs on Base, with a later August app update; existing users get a new self-custodial Base account and old accounts do not auto-migrate. Ready's help center separately says they are transitioning to a new card partner, no launch date, partner not named. Ready's app ToS states the card is issued by a third-party issuer with the legal name left blank.

Do not treat Community Cards or Base as our issuer, and do not copy Ready's new product as the STRK20 last mile: it answers a different question (Ready's own migration) than the one this note is scoping (who issues our card in Phase 2).

## Rejected: BlankCard is not an issuer

Local path `/Users/kamal/Desktop/BlankCard`, upstream `github.com/altaga/BlankCard`. This is a 2024 hackathon zero-knowledge anti-cloning demo on Base, not a card issuer. The Noir circuit hardcodes a single PAN (`6268857032070713`). The NFC flow accepts a fixed UID (`01020304`) and injects a pre-built canned proof rather than proving against live card state. There is no BIN, no Visa settlement rail, and no Starknet integration anywhere in the repo (graph scan: 203 nodes, zero issuer node). Reject this code outright; it does not belong in any issuer evaluation.

## Candidate: Stripe Issuing + Bridge stablecoin cards

Best structural analogue to what Ready Card was trying to do. Live docs, re-read 2026-08-14:
- https://docs.stripe.com/issuing/stablecoin-cards
- https://docs.stripe.com/issuing/bridge-stablecoin-cards

Facts:
- Private preview. Requires a sales conversation and a signed addendum before any sandbox access. Sandbox onboarding after the addendum: roughly 2 weeks for up to 10 internal users, 6-8 weeks before external users are allowed.
- Non-custodial path exists: `crypto_wallet[type]=standard`. At authorization time, Stripe does a just-in-time (JIT) pull of funds from a user wallet that has already granted Bridge an on-chain approval. Funds are not pre-custodied by Stripe/Bridge between top-ups; the pull happens at swipe time.
- Documented JIT-funding chains, per the docs above: Tempo, Solana (contract `cardWArqhdV5jeRXXjUti7cHAa4mj41Nj3Apc6RPZH2`), Base (contract `0x65bf8b55EEDef53C094E40003a03390De744DF33`), World Chain, Linea. **Starknet is not in this table.** This is the load-bearing constraint: our funds must land on one of the listed chains before Bridge can pull them at auth.
- The Visa authorization window is roughly 2 seconds end to end. There is no way to run a STRK20 unshield proof inside that window; unshielding must happen well before the swipe, into a prefunded public USDC buffer on Base or Solana, and the JIT pull taps that buffer.
- One wallet maps to one card. There is no per-authorization fresh-address feature documented anywhere in this integration. See "Plan correction."
- KYC: a Stripe Bridge Customer plus the "cards" endorsement, verified via Persona. The merchant sees the card like any other Visa/Mastercard transaction; Stripe/Bridge see the KYC profile. Nothing about this path hides cardholder identity from the issuer or the merchant.

## Candidate: Gnosis Pay

Self-custodial Safe on Gnosis Chain, re-read from Gnosis Pay's own site and docs 2026-08-14:
- Issuer of record, per the public footer disclosure: Monavate Limited, card scheme Visa Europe, Monavate's authorization is an FCA Electronic Money Institution, FRN 901097.
- KYC via Sumsub.
- Supported settlement currencies: EURe by default, GBPe for UK users, USDCe for Brazil. All three must already be present as balance in the user's Gnosis Chain Safe; Gnosis Pay does not accept arbitrary tokens or bridge on your behalf at spend time.
- Circle's CCTP has no Gnosis Chain domain. Our pool lives on Starknet, which is CCTP domain 25, so CCTP cannot deliver funds directly to a Gnosis Safe. The last hop into Gnosis Chain has to be the native Gnosis Bridge or a third-party aggregator bridge, which is an extra hop and an extra trust assumption beyond CCTP. Note also that routing through "Privacy Bridge" outbound lands funds on a derived Polygon EOA, not on the Gnosis Safe directly, per our own Privacy Bridge inventory, so that path needs an additional Polygon-to-Gnosis hop too.
- A June 2026 Safe implementation replacement is in effect: only the Safe address returned by `GET /api/v1/safe-config` at integration time is valid. Do not hardcode an old Safe factory/singleton address.
- Official TypeScript SDK is `gnosispay/account-kit`. It covers on-chain Safe setup and management only, not PAN issuance or card lifecycle; card operations go through Gnosis Pay's REST API, which is a separate integration surface.

## Candidate: Rain

Visa principal member, full-stack issuer/processor. Re-read from Rain's public marketing site and rain.xyz materials 2026-08-14; `docs.rain.xyz` itself is access-gated so full API detail is UNVERIFIED beyond what public marketing states.
- Publicly marketed onboarding timeline: 8-12 weeks, with daily stablecoin settlement to Visa.
- Public chain support named in Rain's own materials: Base, Polygon, Optimism, Avalanche, Arbitrum, ZKsync, Solana, Ethereum, Stellar. Starknet is not listed.
- Two program shapes, both documented in Rain's public materials:
  - Rain-Managed: a per-user collateral contract where Rain holds signing authority over withdrawals and can liquidate the user's collateral. This is program custody at the moment of authorization, not non-custodial in the Bridge JIT sense.
  - Partner-Managed: we hold the reserve ourselves and approve spend via webhook. This avoids Rain holding funds, but it does not solve the 2-second authorization window problem either; we still cannot run a STRK20 unshield inside that window, so a prefunded public buffer is required same as the Stripe path.
- There is no official Rain JavaScript/TypeScript SDK as of this research. Any integration client has to be reconstructed from Crossmint's public Rain-based demos, since Rain's own API docs are behind an NDA gate. Treat any such client as unverified against Rain's real production contract until we have NDA access.

## Candidate: Reap

Same full-stack issuer/processor class as Rain, oriented more toward corporate/B2B card programs. Public API reference lives at reap.readme.io. There is no official GitHub SDK. Whether Reap fits a consumer neobank card (vs. corporate expense cards) is **UNVERIFIED** pending a dedicated research pass; do not assume consumer fit from the marketing site alone.

## GitHub reality check

Re-checked 2026-08-14: the only production-grade, officially maintained Next.js-adjacent issuing client on GitHub is Stripe's own `stripe/stripe-node`, plus StarkWare-unrelated reference app `stripe-samples/issuing-treasury`. Rain, Bridge (outside the Stripe partnership docs), and Reap have no official GitHub SDK; any client for those three has to be written in-house against their REST APIs.

## Comparison

| Candidate | Custody at auth | Chains that matter to us | Starknet support | KYC surface | Integration effort |
|---|---|---|---|---|---|
| Stripe Issuing + Bridge | Non-custodial (JIT pull from user-approved wallet) | Tempo, Solana, Base, World Chain, Linea | Not listed | Stripe Bridge Customer + Persona | Sales-gated preview, weeks of sandbox lead time |
| Gnosis Pay | Self-custodial Safe | Gnosis Chain only | Not listed; needs bridge hop from Starknet, no direct CCTP domain | Sumsub | Public REST + `account-kit`, but multi-hop bridging required |
| Rain | Program custody (Rain-Managed) or partner-held (Partner-Managed) | Base, Polygon, Optimism, Avalanche, Arbitrum, ZKsync, Solana, Ethereum, Stellar | Not listed | Rain-run, detail UNVERIFIED without NDA docs | No official SDK, NDA-gated docs |
| Reap | UNVERIFIED | UNVERIFIED | Not listed | UNVERIFIED | No official SDK, consumer fit UNVERIFIED |

Common thread across every candidate: none support Starknet natively. Every path requires unshielding to public USDC on an already-supported EVM chain or Solana before the issuer can touch it. None of them can debit a STRK20 note directly, confirming the locked product rule.

## Funding topology: two ways to land public USDC at the issuer

Paper topology only, UNVERIFIED against any live integration. Two candidate routes from the STRK20 pool to an issuer funding address.

**Path A: Wallet API unshield, then a second hop.** Unshield via the Wallet API (this app today) lands public USDC on Starknet. A second hop (CCTP or an aggregator) then moves it to Base, Solana, or Gnosis Chain. Public SN USDC sits in the app's own address between the two hops.

**Path B: Privacy Bridge outbound.** `cashOut` / `bridgeOutToWallet`, one proven pool tx: withdraw to OutboundAnonymizer then CCTP burn, with `mint_recipient` set to the issuer EOA or Safe. No public SN USDC sits around at any point. Note the inbound side of Privacy Bridge funds the POOL (payday in), not the card; `fundAccountFromPool` lands a derived Polygon trading EOA, wrong destination for a BIN.

Constraints on Path B: the consumer dapp still must not hold a viewing key, so this stays a later CardSettle helper or a wallet-mediated outbound, not `@starkware-libs/starknet-privacy-bridge` pulled into the Next app directly. That package is 0.1.x and not pinned. Amounts stay public on both paths, only the source address differs. Prefer Path B only if the signed issuer accepts Circle USDC arriving on a Privacy Bridge destination domain. A Solana-first Bridge JIT integration stays Path A plus a hop, since Privacy Bridge does not name Solana as a destination.

## Plan correction

`docs/PRODUCTION_BUILD_PLAN.md` Phase 2 currently reads: "unshield to a fresh issuer funding address per auth when possible." Re-reading Stripe's Bridge stablecoin card docs, no such per-authorization fresh-address feature is documented; the model is one wallet approval mapped to one card, with JIT pulls against that same standing wallet at each authorization. Gnosis Pay is a single standing Safe. Rain's two program shapes are both a standing collateral contract or a standing partner-held reserve, not a fresh address per swipe. This line should be corrected to: unshield to a prefunded standing issuer funding address (wallet, Safe, or reserve contract, depending on issuer), topped up ahead of expected spend, not rotated per authorization. Applied below.

## What Phase 2 requires before any card code

All of the following, not a subset, per the locked product rules and this note:
1. A signed issuer agreement (Stripe addendum, Gnosis Pay integration terms, or Rain program agreement). None of these are self-serve.
2. A concrete bridging design from the STRK20 pool to whichever chain that issuer requires (Base/Solana for Stripe, Gnosis Chain for Gnosis Pay, issuer-specific chain for Rain), accounting for CCTP domain 25 and the lack of a direct Gnosis CCTP domain.
3. Explicit product copy that does not imply the merchant cannot see the card or that the issuer cannot see KYC; every candidate here surfaces both to the issuer.
4. No fake BIN, no mock issuer response, no simulated authorization. If sandbox access is not yet granted, the card feature does not ship, full stop.

Nothing in this note authorizes writing card UI or Cairo. That stays out of scope until a Phase 2 kickoff with a signed issuer agreement in hand.

## See also: cancelled-wave salvage

Nine issuer researchers plus one demand/competitor researcher ran ~51 minutes on 2026-08-14 and were cancelled on turn 1 with no dossier. Their fetched pages and mid-flight notes are extracted in `docs/research/salvage-2026-08-14/`. That folder is not a decision doc. Use it when re-opening Rain Visa membership, Reap/Payward, Kulipa dates, Crossmint-as-Rain-wrapper, or Visa/Mastercard settlement pilots.
