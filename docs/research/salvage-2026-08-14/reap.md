# Salvage: Reap issuer

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc6-7b01-b56e-d043e7b50abb`.
Status: cancelled after 3040s on turn 1, 23 tool results, no dossier. Mid-flight only.

issuer-options.md currently marks Reap consumer fit UNVERIFIED. This salvage does not close that.

## What the agent concluded before death

1. Research Reap vs Rain from official sources.
2. Project is a Starknet consumer money app.
3. Official site is `reap.global`. Visa principal in Hong Kong and Mexico. Corporate-first. Now under Payward.
4. Docs Cloudflare-gated. Next: public product pages, Rain counterpart, licenses, custody, chains.
5. Last assistant text was empty. Kill during more fetches.

## Sourced from pages it fetched

### Domain

`reap.cx` DNS failed (`web_fetch` nodename). Live domain is https://reap.global/.

Public surfaces opened:

- https://reap.global/products/card-issuing
- https://reap.global/products/cards
- https://reap.global/products/corporate-cards
- https://reap.global/products/payments
- https://reap.readme.io/docs/getting-started
- https://reap.readme.io/reference/test-environment
- https://dashboard.reap.global/login

### Payward acquisition

- https://www.payward.com/press-release/payward-acquires-reap
- https://www.payward.com/press-release/payward-reap-close
- https://reap.global/newsroom/payward-to-acquire-reap
- https://services.payward.com/card-issuance-payments

Payward Services page highlight: Reap holds Visa Principal Issuing status and settles stablecoin-to-fiat payouts across 220+ countries and territories. Fund and authorize spend in real time against fiat or stablecoin balances on Reap's own ledger.

"Own ledger" is a custody signal. Treat as program / ledger custody at auth unless later docs show a non-custodial JIT path. UNVERIFIED against Reap API docs (gated).

### Mexico Visa Principal

https://reap.global/newsroom/reap-visa-principal-member-in-mexico-global-stablecoin-card-issuing
Published 2026-05-26.

Reap became Visa Principal Member in Mexico and says this expands stablecoin card issuing globally. Regional pages: `/en-mx/products/card-issuing`, `/hk/products/card-issuing`.

### Docs gate

`reap.readme.io` exists. Agent said docs were Cloudflare-gated in the live fetch. Full API, consumer vs corporate program types, chain list, and Starknet support remain UNVERIFIED.

## Not finished

- Consumer neobank fit vs corporate expense cards.
- Chain list.
- Whether a Ready (Argent) Starknet wallet can be the funding address.
- Time-to-launch for a small team.
- Comparison table vs Rain.

## Fit for this repo

Do not pick Reap this sprint. Corporate-first + Payward ledger + gated docs + no Starknet evidence. Keep as a Phase 2 alternative to Rain only after a sales conversation.
