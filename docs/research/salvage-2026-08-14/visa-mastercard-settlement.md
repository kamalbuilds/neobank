# Salvage: Visa and Mastercard stablecoin settlement

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019ffffa-5dc7-7c03-9295-ac9c1bccdc9c`.
Status: cancelled after 3040s on turn 1, 17 tool results, no dossier. Mid-flight only.

Prompt question: do 2026 settlement pilots change whether a card can debit a STRK20 note? Expected answer: no. It only changes the issuer's settlement asset (can stay USDC). Agent never wrote that close.

## What the agent concluded before death

1. Research pilots vs CardSettle assumptions.
2. Repo already treats CardSettle as unshield to issuer USDC.
3. Empty turn (reads).
4. Verify 2026 Visa / Mastercard / Rain / Reap claims from official pages.
5. Empty last turn. Kill on Exa searches that had already returned titles.

## Sourced from pages it fetched

### Mastercard settlement expansion

https://www.mastercard.com/us/en/news-and-trends/press/2026/june/mastercard-expands-settlement-capabilities-to-include-stablecoin.html
3 June 2026, Purchase NY.

Mastercard announced plans to expand settlement capabilities to include stablecoin, plus intraday, holiday, and weekend options. This is network settlement between members, not a merchant POS that talks to a shielded pool.

Related fetches (titles only, body not fully extracted):

- https://www.mastercard.com/global/en/news-and-trends/press/2026/march/sofi-and-mastercard-partner-to-enable-sofiusd-settlement-across-.html
- https://www.globenewswire.com/news-release/2026/08/05/3339352/0/en/Borderless-xyz-Teams-Up-with-Mastercard-to-Advance-Trusted-Cross-Border-Stablecoin-Payment-Flows.html
- https://thedefiant.io/converge/tradfi-and-fintech/mastercard-extends-crypto-credential-to-stablecoin-payments-in-borderless-pilot

Crypto Credential + Borderless is an identity / transfer check, not a note debit.

### Visa settlement chains

https://investor.visa.com/news/news-details/2026/Visa-Accelerates-Stablecoin-Momentum-Adding-Five-Blockchains-for-Settlement/default.aspx
29 April 2026.

Visa adding five blockchains for settlement. The fetch highlight stops at the headline. Which five chains, and whether Starknet is among them: UNVERIFIED from this salvage. Do not claim Starknet.

Also opened:

- https://investor.visa.com/news/news-details/2026/Visa-Introduces-Platform-for-Stablecoin-Minting-Movement-and-Management/default.aspx
- https://investor.visa.com/news/news-details/2026/Visa-and-Bridge-Expand-Collaboration-with-Plans-to-Bring-Stablecoin-Linked-Cards-to-Over-100-Countries/

Visa + Bridge card expansion is consistent with the Stripe/Bridge Phase 2 path. It is still public-wallet / issuer-wallet USDC, not a STRK20 note.

### Rain as a Visa principal talking about settlement

https://www.rain.xyz/product/card-issuing

Rain: cards accepted at more than 175 million locations, stablecoin-native settlement. Partner posts opened (not fully extracted): Rain + Visa onchain credit cards, "behind dollar cards" settlement rebuild.

## Implication that was never written

Network-level USDC settlement does not give Visa a viewing key, a note nullifier, or a way to run a STARK proof inside a 2-second auth. CardSettle stays: unshield (or Privacy Bridge cashOut) to public USDC, then issuer. Merchant still sees a normal card.

## Not finished

- Named list of Visa's five settlement chains.
- Whether Mastercard Crypto Credential changes KYC at our issuer (it should not remove Persona / Sumsub).
- Rain/Reap "principal member settles USDC to Visa" vs "Visa settles USDC between banks." Those are different layers.

## Fit for this repo

No change to CardSettle. No card code this sprint.
