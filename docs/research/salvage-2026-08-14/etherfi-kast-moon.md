# Salvage: ether.fi Cash, Kast, Moon

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc6-7b01-b56e-d07da1b00163`.
Status: cancelled after 3040s on turn 1, 19 tool results, no dossier. Mid-flight only.

Project kill-list already says do not copy ether.fi / Kast / Ready as the v0 product. This pass was supposed to name the issuer and custody behind each.

## What the agent concluded before death

1. Research against private-money constraints.
2. Kill-list already names these as public-wallet cards.
3. Verify issuer, custody, privacy from official sources.
4. Empty turn.
5. Pull official product and issuer pages.
6. "Searching official product, issuer, and legal pages." Kill during search_tool / Exa.

## Sourced from pages it fetched

### Kast

https://www.kast.xyz/legal/business-ra-card-terms-us

US business spend card terms. Agreement is between the cardholder and "the Issuer," with access enabled by KAST's platform. Issued under license from Visa. Terms become binding only after KAST approves the business account. Cost table date on the page: 7 May 2026. Servicer contact: support@kast.xyz.

The legal name of the Issuer was not captured in the truncated fetch. UNVERIFIED. This is a business spend card, not a consumer private-money card.

### ether.fi (from the sibling demand transcript, same day)

The ether.fi agent itself did not land a clean official issuer page before cancel. The earlier demand/competitor agent did fetch Paymentscan:

https://paymentscan.xyz/cards/etherfi

Paymentscan describes EtherFi Cash as powered primarily by Rain infrastructure, spend from a self-custodial wallet, plus a Borrow Mode against deposited assets. That is public-wallet spend on a Rain-issued card, not a note debit.

Treat Paymentscan as secondary analytics. Rain-as-issuer for ether.fi is UNVERIFIED against ether.fi legal pages (not fetched here).

### Moon

No Moon official page in the last results. UNVERIFIED. Do not invent an issuer.

### MetaMask Card

Named in Baanx's own story page (see lithic-marqeta-baanx.md) as a Baanx program. Not researched as a product in this agent.

## Not finished

- Issuer legal name for Kast (US) and Kast consumer if any.
- ether.fi official card terms / Rain confirmation.
- Moon issuer, custody, geography.
- Privacy: none of these claim shielded balances. Expected, not closed.

## Fit for this repo

Unchanged kill: these are public-wallet spend products. Even if we later use Rain as our issuer, we are not copying ether.fi Cash as the product. Private balance stays in STRK20 notes; card is a later unshield last mile.
