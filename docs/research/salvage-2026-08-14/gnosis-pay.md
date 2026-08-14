# Salvage: Gnosis Pay issuer

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc6-7b01-b56e-d02e55004953`.
Status: cancelled after 3040s on turn 1, 23 tool results, no dossier. Mid-flight only.

Canonical Phase 2 summary is `docs/research/issuer-options.md` (Gnosis Pay section).

## What the agent concluded before death

1. Start live research vs STRK20 constraints. No repo writes.
2. Project already treats card as Phase 2.
3. Official site names Monavate as the Visa EMI.
4. Docs index live. Pulling Safe, KYC, funding, country pages.
5. "Safe ownership is more constrained than the marketing copy." Settlement / country / competitor pages were next. Kill landed here.

## Sourced from pages it fetched

### Eligible countries

https://help.gnosispay.com/hc/en-us/articles/39401751918612-Eligible-Countries-for-Gnosis-Pay
Updated 2026-05-28.

Card is for legal residents of selected countries in Europe and Latin America. Waitlist for other countries. Help page lists Czech Republic, France (footnote), United Kingdom among current supported residencies. Restricted countries exist for usage (sanctions). Full country table was not copied into a final table before cancel. Treat the help article as the live source, not this note.

### Where the card works

https://help.gnosispay.com/hc/en-us/articles/39532057383188-Where-Can-I-Use-My-Gnosis-Pay-Card
Updated 2026-05-27.

Visa debit, online / in-store / in-app. Some countries and merchant categories restricted. Details not extracted.

### Docs index

https://docs.gnosispay.com/llms.txt fetched. Official docs exist and are public, unlike Rain.

### Comparison pages queued, not synthesized

Agent also opened Bridge noncustodial wallet docs and The Defiant Ready/Kulipa piece for contrast. No written comparison.

## What "more constrained than marketing" likely means

Not a finished finding. Issuer-options.md already records the June 2026 Safe replacement: only the Safe address from `GET /api/v1/safe-config` is valid. Do not invent a stronger claim from the cancelled agent's one sentence.

## Not finished

- Monavate FRN / footer disclosure was asserted from the site, not pasted with a quote in the last turn.
- EURe / GBPe / USDCe funding rules were not re-extracted in this pass (already in issuer-options.md from the completed plan agent).
- CCTP-has-no-Gnosis-domain was not re-verified here.
- No Starknet path was found. None expected.

## Fit for this repo

Unchanged: self-custodial Safe on Gnosis Chain, extra bridge hop from Starknet, Phase 2 only.
