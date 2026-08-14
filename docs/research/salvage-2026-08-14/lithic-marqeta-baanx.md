# Salvage: Lithic, Marqeta, Baanx

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc6-7b01-b56e-d063cf250211`.
Status: cancelled after 3040s on turn 1, 17 tool results, no dossier. Mid-flight only.

This pass never produced a comparison table. Do not pick any of these as the Phase 2 issuer from this file.

## What the agent concluded before death

1. Start with project context and official sources.
2. Project is a Starknet neobank.
3. Empty turn (reads).
4. No repo writes. Pull official issuer pages.
5. "Starting independent discovery plus official-doc pulls." Kill during those pulls.

GitHub search via `github__search_repositories` failed MCP validation. No GitHub SDK inventory from this agent.

## Sourced from pages it fetched

### Baanx

https://docs.baanx.com/guides/card/overview

Public Card API: lifecycle from order and activation through management and transaction monitoring. Tokenized access, PCI without exposing PAN to the app. Docs index: https://docs.baanx.com/llms.txt.

https://www.baanx.com/newsroom/baanx-our-story-and-vision

Baanx positions as a crypto card program manager. Named program partners: Ledger Crypto Life Card, MetaMask Card, 1inch Card. Partnerships with Mastercard and Visa. This is "cards for public-wallet crypto spend," not private notes.

Custody model, who the licensed issuer is per program, and whether a third-party Starknet app can contract Baanx: UNVERIFIED.

### Marqeta

https://www.marqeta.com/docs/developer-guides/upcoming-release-announcements

Effective 17 April 2026 Marqeta expands crypto transaction support to Mastercard TTI `P76` for fiat-backed stablecoins and CBDCs, plus existing `P70` for floating cryptocurrencies. Mapped to `CRYPTOCURRENCY_PURCHASE`. This is merchant-category / network classification, not "Marqeta issues a stablecoin card that pulls USDC from a user wallet."

https://www.marqeta.com/docs/developer-guides/card-network-certifications

Marqeta certified for July 2026 Mastercard Release 26.Q3, effective 24 July 2026 (GLB 12451.1, crypto purchase indicators).

Marqeta is a processor / program-manager platform. Licensed issuer behind a given program is a bank partner, not Marqeta itself. Crypto funding path for a STRK20 app: UNVERIFIED. No Starknet.

### Lithic

No Lithic product or docs page landed in the last tool results. Treat Lithic as unresearched in this wave.

### Bridge + Stripe (contrast fetch)

https://apidocs.bridge.xyz/platform/cards/overview/stripe-issuing

Same stack already documented in issuer-options.md. April 2026: Bridge stablecoin cards via Stripe Issuing. Bridge Customer (KYC + cards endorsement) maps 1:1 to a Stripe Cardholder. JIT spend from noncustodial or custodial stablecoin wallets. This is the completed-path analogue, not a Lithic/Marqeta/Baanx finding.

## Not finished

- Lithic official docs, issuer bank, crypto funding.
- Whether Marqeta or Lithic can JIT-pull USDC the way Bridge does.
- Baanx contractability for a small team that is not MetaMask/Ledger.
- Starknet: none of these pages mention it.

## Fit for this repo

Processors (Lithic, Marqeta) still need a licensed issuer and a public USDC buffer. Baanx is the public-wallet crypto-card mold this product already rejected. Do not start any of these this sprint.
