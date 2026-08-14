# Salvage: Rain card issuer

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc6-7b01-b56e-d01340b2f045`.
Status: cancelled after 3040s on turn 1, 16 tool results, no dossier. Mid-flight only.

Canonical Phase 2 summary is still `docs/research/issuer-options.md` (Rain section). This file keeps the extra pages the cancelled agent actually opened.

## What the agent concluded before death

Four assistant turns, all progress notes:

1. Start from official product and project context.
2. Existing repo notes mention Rain; verify against live pages.
3. Public site live; `docs.rain.xyz` is login-gated.
4. Mastercard Principal Membership confirmed. Next was Visa membership, chain support, custody at authorization, Ready/Kulipa alternatives. That next pass never ran.

## Sourced from pages it fetched

### Mastercard Principal

https://www.rain.xyz/ (company news, "Rain is now a Mastercard Principal Member")

Rain announced Mastercard Principal Membership. Copy says Rain can now offer credit and prepaid cards on the Mastercard network for partners building stablecoin-powered programs.

### Visa APAC expansion

https://www.prnewswire.com/news-releases/rain-expands-visa-membership-into-asia-pacific-advancing-the-reach-of-its-global-stablecoin-payment-infrastructure-302722723.html
Published 2026-03-24, attributed to Rain.

Rain expanded Visa Membership into Asia-Pacific. Initial launches expected Q2 2026. Visa Crypto Lead APAC named in the release: Nischint Sanghavi. This is a membership / footprint claim, not a Starknet integration claim.

### Wallets product

https://www.rain.xyz/product/wallets

Marketing: embedded stablecoin wallets with compliance controls and card connectivity. Claims KYC, AML screening, sanctions checks, transaction monitoring, multi-chain, role-based access. No Starknet named on the fetched page. Chain list UNVERIFIED from this fetch (issuer-options.md already lists Base, Polygon, Optimism, Avalanche, Arbitrum, ZKsync, Solana, Ethereum, Stellar from earlier completed research).

### Docs gate

https://docs.rain.xyz/login?redirect=%2F

Agent confirmed docs are access-gated. Full API, custody-at-auth, Partner-Managed vs Rain-Managed contract detail remain UNVERIFIED without NDA access.

### Secondary directory

https://banklist.co/rain (2025-12-05)

Third-party directory: Visa Principal, cards at 150+ million merchants, settle card volume in stablecoins on Visa. Treat as secondary. Do not prefer this over rain.xyz.

## Not finished

- Custody at swipe (Rain-Managed collateral vs Partner-Managed webhook) was not re-derived from these pages.
- Starknet support was not closed.
- Ready/Kulipa replacement path was queued, not written.
- No official TypeScript SDK found in this pass.

## Fit for this repo

Unchanged from issuer-options.md: Rain is a full-stack issuer, not a drop-in for a STRK20 note. Card still requires unshield to public USDC on a Rain-listed chain. Do not start Rain code this sprint.
