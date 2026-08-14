# Salvage: Crossmint, Relampago, BlindPay

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc7-7c03-9295-acd6b8adedde`.
Status: cancelled after 3040s on turn 1, 23 tool results, no dossier. Mid-flight only.

This is the most useful unfinished pass: it got far enough to classify two of the three names.

## What the agent concluded before death

1. Research APIs a small team could contract.
2. Existing docs mention stablecoin cards.
3. Pull official docs.
4. BlindPay docs live. relampago.com looks parked. Search other Relampago domains.
5. "Crossmint cards wrap Rain; BlindPay is on/off-ramp, not issuing." Next: read those docs and hunt Relampago plus peers. Kill on Exa + Crossmint doc fetches.

## Sourced from pages it fetched

### Crossmint is a Rain wrapper

https://docs.crossmint.com/wallets/guides/wallet-extensions/credit-cards

Official docs: "Build a complete Visa credit card application for your users using Rain cards and Crossmint wallets." Requires access to Rain's card issuance API and Crossmint wallet services. Sample `fetch` goes to `${RAIN_API_URL}/issuing/applications/user` with `Api-Key: process.env.RAIN_API_KEY`.

So Crossmint is not a fourth issuer. It is a wallet + UX layer on Rain. Demo: https://rain-wallets-demo.vercel.app/ and https://github.com/Crossmint/rain-wallets-demo. Also https://github.com/Crossmint/card-permissions-quickstart (agent cards: one-time PAN for an agent, still a Rain/Visa card).

Starknet: Crossmint supported-chains page was queued (`introduction/supported-chains.md`) but not extracted. UNVERIFIED. Do not assume Starknet.

Sales: https://www.crossmint.com/contact/sales. Sample "neobank" demo exists at https://www.crossmint.com/sample-apps/neobank-solution-demo. That is a Crossmint marketing sample, not our product.

### BlindPay is a ramp, not an issuer

Live:

- https://blindpay.com
- https://docs.blindpay.com
- https://blindpay.com/docs/introduction
- https://blindpay.com/llms.txt
- https://api.blindpay.com/reference
- https://github.com/blindpaylabs/blindpay-skills

iOS app store listing fetched. Docs include agent integrations (Cursor, Claude Code, etc.). Product is on/off-ramp and payouts, not Visa principal issuing. Do not treat BlindPay as a card issuer.

### Relampago

- https://relampago.com looked parked to the agent.
- https://www.relampago.io fetched as an alternate. No issuing-API conclusion written.

Relampago as a contractable card API: UNVERIFIED. Do not plan on it.

## Not finished

- Relampago identity (which company, if any, is live in 2026).
- Other LATAM card APIs.
- Whether Crossmint + Rain is faster to sandbox than talking to Rain directly (likely yes for wallets, no for issuer contract: you still need Rain access).

## Fit for this repo

If we ever want a hosted wallet+card demo, Crossmint's Rain quickstart is the public client that issuer-options.md already pointed at. It does not remove the Rain NDA or the unshield-to-USDC rule. BlindPay might matter later as a fiat off-ramp, not as a card.
