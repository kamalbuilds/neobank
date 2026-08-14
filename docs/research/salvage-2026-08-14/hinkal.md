# Salvage: Hinkal private pay vs card

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc7-7c03-9295-ac822b5579d4`.
Status: cancelled after 3040s on turn 1, 16 tool results, no dossier. Mid-flight only.

Expected close (from the prompt): nobody lets a merchant POS debit a shielded note. Agent started to confirm. Never wrote the sourced close.

## What the agent concluded before death

1. Verify Hinkal Pay and any private-stablecoin spend-to-card path.
2. Repo already claims no POS debit of a note. Do not reuse the repo as proof.
3. Pull official Hinkal, issuer, and card-rail pages.
4. "Hinkal's own pages describe wallet-to-wallet private stables, not a card." Confirm on Pay/docs and scan issuers.
5. Last assistant text empty. Kill during more fetches.

## Sourced from pages it fetched

### Sites

- https://hinkal.io/ (and https://hinkal.pro/) live: "Universal Privacy For Stablecoins."
- https://hinkal.io/ (Pay page title in fetch): "Hinkal Pay - Confidential Settlements and Payouts on Solana, Tron, Ethereum."
- Docs: https://hinkal-team.gitbook.io/hinkal
- `docs.hinkal.pro` DNS failed.

### Whitepaper preface (GitBook)

https://hinkal-team.gitbook.io/hinkal/introduction/readme.md (via docs index)

Hinkal: privacy for stablecoin payments, settlements, and payouts across Ethereum, Polygon, Solana, Tron, Base, Arc, Arbitrum, and Tempo. Institutions and apps operate without exposing balances, counterparties, or treasury activity, inside existing wallets and assets.

That is wallet-to-wallet / settlement privacy on public chains. It is not a Visa PAN. It is not a POS debit of a STRK20 note.

### Docs DNS

`docs.hinkal.pro` does not resolve. Use the GitBook host.

## Not finished

- Explicit "no card / no POS" sentence from Hinkal docs (agent said it from marketing, did not paste a docs quote that uses the word card).
- Scan of Rain / Stripe / Visa for any "debit a zk note" API. Expected answer no. Not written.
- Contrast table: private pay vs interchange.

## Fit for this repo

Unchanged product rule: Visa cannot debit a STRK20 note. Hinkal is an adjacent private-stablecoin rail on other chains, not an issuer, and not a reason to change CardSettle. Keep Hinkal on the kill / adjacent list (private pay is a different product than a neobank card).
