# Fin.com as a fiat leg for sealed.cash

Date: 2026-09-22. Trigger: an inbound order form from Fin.com quoting $5,000 onboarding and 0.35%
tier-one ramp pricing.

Verdict: **no, not for this product, and not on this order form.** Two independent blockers, either
of which is sufficient. A narrower yes exists and is stated at the end.

Every claim below is read from Fin's own live pages on 2026-09-22, not from the sales sheet.

## The screening question, and Fin's own answer

`docs/research/issuer-options.md` sets one question that any money-rail candidate must answer
before BIN, fees or geography are worth discussing:

> What does your risk engine do with a USDC deposit whose immediate on-chain ancestor is a
> withdrawal from a shielded privacy pool, and does a CCTP hop change that answer?

Fin answers it in writing, in their published prohibited-activities list, under Financial Services
Restrictions:

> **Mixing services**

Source: https://developer.fin.com/guides/customers-and-compliance/high-risk-activities

Listed alongside "will result in account termination". sealed.cash is not a mixer, it is a
non-custodial shielded-note pool with on-deposit screening, and that distinction is real. It is
also a distinction that has to survive a compliance analyst reading a chain-analytics label, which
is the same bet already lost in `docs/research/CARD_LEG_NOBODY_CARDS.md`. The failure mode is not a
declined transaction. It is a frozen balance plus a document demand, after integration work is
already sunk.

This does not have to be guessed at. It is one written question to compliance@fin.com, and the
answer should arrive before any money changes hands. See "What to send them" below.

## Blocker 1: wrong chain, with no roadmap signal

Fin does not support Starknet on any rail, anywhere in their documentation.

| Surface | Chains supported | Source |
|---|---|---|
| Payin (fiat to crypto) | USDC on Ethereum, Polygon | [supported-rails-and-currencies](https://developer.fin.com/guides/coverage/supported-rails-and-currencies) |
| Payout (crypto to fiat) | USDC on Ethereum, Polygon (SPEI adds Solana) | same |
| Crypto orchestration | USDC on Solana, Base, Ethereum, Polygon; USDT on Tron; ETH; BTC; PYUSD on Solana | [crypto-orchestration/introduction](https://developer.fin.com/guides/crypto-orchestration/introduction) |

USDT is marked "Coming soon" on every ramp row. Starknet appears in none of the three tables. A
search for any Fin plus Starknet announcement returns nothing from either side.

So the route would be: pool unshield to native USDC on Starknet, CCTP burn on domain 25 out to
Ethereum or Polygon, then hand to Fin. That extra hop is already designed and documented in
`docs/CARD_LAST_MILE.md` with the live contract addresses, so it is not novel work. But it means
every dollar is public on two chains before Fin ever sees it, and Fin is then charging 0.35% for a
leg that starts one full bridge away from where the product actually lives.

## Blocker 2: Fin KYCs every end user, with no exception

This is the one that ends it on principle rather than on engineering.

> **Each end customer must be onboarded individually.** Fin requires every customer (individual or
> business) to go through KYC or KYB via Fin's platform before they can receive a virtual account
> or transact. **There are no exceptions to this.**

Source: https://developer.fin.com/guides/customers-and-compliance/nested-payments-and-onboarding

The same page prohibits "nesting", defined as using a virtual account to serve your own customers
without those customers being onboarded as Fin customers in their own right. There is no
architecture in which sealed.cash holds one Fin account and ramps for its users. That is the
prohibited pattern, named explicitly.

What each user would hand over, per the individual onboarding spec
(https://developer.fin.com/guides/customers-and-compliance/onboarding-individuals):

- Legal name, date of birth, email, phone, country of residence, nationality
- Tax identification number, SSN for US persons, in `xxx-xx-xxxx` format
- Full residential address, validated against country of residence
- Employment status, occupation, purpose of use, source of funds, expected monthly volume
- Government photo ID front and back, or passport
- A selfie
- Proof of address issued within the last 90 days
- Acceptance of Fin's terms of service

The product's own README says the dapp never holds a viewing key, and the privacy table draws a
line at what stays inside the pool. Bolting on a rail that requires a selfie and an SSN from every
user, collected through our UI, is not an integration. It is a different product with the same
name.

Worth stating plainly: this is not Fin being unusually strict. Any licensed fiat rail requires
this. The conclusion is not "find a laxer vendor", it is "the fiat leg does not belong inside the
privacy product".

## The order form does not match the documentation

Three separate statements of coverage exist, and they disagree. Reading in order of authority:

| Source | What it says |
|---|---|
| Developer docs, dated August 2026 | Virtual accounts in **USD and MXN only**. Payouts live for USD (Fedwire, SWIFT), MXN (SPEI), BDT local, PKR local. That is four currencies. |
| fin.com/coverage, marketing | 59 live local payout rails, 36 "on-request", 31 USD SWIFT delivery only. Explicitly tiered. |
| The order form you were sent | ~110 currencies in one flat table with ACH and RTGS yes/no columns, no live/on-request distinction at all. |

The docs are the tightest and most recent, and they open with: "**As of August 2026, every flow has
a stablecoin on one side. There is no fiat to fiat corridor today.**"

Specific line items on the order form that contradict Fin's own published state:

- **"Fed Now (Instant 24/7): $1.00"** — the 2026-09-09 changelog records `FEDNOW` being **removed**
  from virtual account source rails, which now accept only ACH, SWIFT, FEDWIRE and SPEI. The order
  form prices a rail Fin deleted thirteen days before sending it.
  Source: https://developer.fin.com/changelogs/2026-09-09
- **"ACH (same day or standard): $1.00"** — the same changelog states "USD ACH payouts are not yet
  available". ACH payin works; ACH payout does not exist. Inbound off-ramp to a US bank account via
  ACH, which is the obvious consumer use case, cannot be done today.
- **The currency table** lists Kenya, Nigeria, UAE, South Africa and Mexico as available. Fin's own
  coverage page puts every one of those in "on-request", and Mexico does not appear in the live
  list at all despite MXN being the one non-USD currency the docs treat as live.
- **The header reads "Order form for: Shield.Cash"**, not sealed.cash. Either it is a template
  fill error or it was drafted for someone else. Get it corrected before signing anything.

None of this proves bad faith. A twelve-month-old company moving fast will have sales material
running ahead of shipped rails. It does mean the currency table is a roadmap, and should not be
relied on for any corridor you actually need.

## Counterparty read

- Founded by Nabeel Alamgir (Lunchbox) and Mustafa Dar (24/7 Jet), who "began working on Fin.com
  after reconnecting in late 2025". The company is roughly twelve months old.
- $20M seed closed August 2026, announced 2026-09-15, led by Expa and Garrett Camp, with Coinbase
  Ventures, Tenet, Figure founders and Gulf and Africa family offices participating. Well funded
  for its stage. The order form arrived one week after the announcement.
- Fin Inc. is a Delaware holding company. Regulated activity runs through separate entities.
- The marketing site claims "licenses and banking partnerships in 30+ countries" and lists UAE as
  "Payment services provider". Press reporting on their own legal disclosures says **Wind
  Technologies holds a DFSA Innovation Testing Licence, limited to approved testing conditions**,
  and that transactions under that entity cannot begin until an approved client-money account is in
  place. An Innovation Testing Licence is a regulatory sandbox permission, not a PSP authorisation.
  The gap between the marketing label and the disclosure is worth asking about directly.
  Source: https://crypto.news/fin-com-raises-20m-to-expand-stablecoin-payments/
- Named banking partners appear in the v3 virtual account API as `SSB` and `PORTAGE`. No public
  detail on either.
- Claimed customers "collectively serve more than 800 million end users", with no customer named.
  No independent case study found.

## The money math

The refund condition is the tell. $5,000 upfront, refundable in full only on $100,000 of volume
within 90 days of going live. At tier one, $100,000 of volume earns Fin $350. A vendor does not
return $5,000 to earn $350 unless it expects the threshold to be missed, or expects whoever clears
it to become a long-term account.

sealed.cash today has four mainnet `apply_actions` transactions, no completed unshield, no
completed private send, and no users. $100,000 in 90 days is not a stretch goal, it is not a goal.
Price the $5,000 as non-refundable and ask whether a pre-revenue product with zero fiat users
should spend it.

On the rate itself: 0.35% is genuinely competitive. Retail ramp providers sit meaningfully higher.
The rate is not the problem. Paying a five-figure entry fee to access a good rate you have no
volume to use is the problem.

## What would have to be true for a yes

All of these, not a subset:

1. Written confirmation from Fin compliance that USDC whose on-chain ancestry includes a STRK20
   pool withdrawal is acceptable, and that a CCTP hop does not change the answer. In writing,
   before payment.
2. A legal entity that can pass KYB and that is comfortable being the disclosed operator of a
   money-movement product. That is a different posture than "non-custodial Starknet app".
3. A decision that end users will complete full KYC including a selfie, and product copy that says
   so honestly rather than burying it.
4. Either Starknet support from Fin, or acceptance that the fiat leg lives entirely on the public
   side of a CCTP hop and is architecturally separate from the pool.
5. Enough volume that 0.35% on real flow justifies the setup fee.

Item 3 is the one that conflicts with the product thesis. Items 1 and 2 are answerable this week
and cost nothing to ask.

## The better-shaped alternative, if a fiat leg is genuinely wanted

**Due** (opendue.com, app.due.network) is a cross-border payments provider that Starknet Foundation
launched with in September 2025, connectable to Braavos and **Ready**, which is the wallet this app
already uses.

| | Fin.com | Due |
|---|---|---|
| Starknet | Not supported anywhere | Named in the Transfers API ("Transfer USDC from Arbitrum to USDC on Starknet"). See caveat below. |
| Entry cost | $5,000 onboarding | No published setup fee. Self-serve signup at app.due.network. |
| Quoted rate | 0.35% tier one | 0.2 to 0.5% per Starknet Foundation's launch post; current rate is quote-based |
| Virtual accounts | USD and MXN per docs | EUR, GBP, USD, MXN, AED, BRL per their API page |
| Licensing | Delaware holdco; UAE entity on a DFSA Innovation Testing Licence | Due Network S.L. authorised as a CASP by Spain's CNMV and in the ESMA register; Due Payments Inc. FINTRAC MSB C100000185 |
| Docs | Gated behind a sales conversation and a Slack channel | Public at due.readme.io |
| Company age | ~12 months | Trading since at least 2024 across six jurisdictions |

Due's CNMV CASP authorisation and FINTRAC MSB number are specific, checkable registrations. Fin's
strongest verifiable regulatory artifact found is a sandbox licence. That is a meaningful
difference in counterparty quality, independent of price.

**Caveat, stated because it matters.** Due's developer overview is marked "Updated 12 months ago".
It names Starknet as a Transfers API destination, but its Vault MPC wallet section says Starknet
support is "coming soon", and the current crypto/web3 marketing page lists Ethereum, Arbitrum,
Optimism, Polygon and Base without naming Starknet. So Starknet support at Due is a strong lead,
not a verified present-day fact. Treat it as **UNVERIFIED until confirmed live**, by an API call
against their supported-rails endpoint or a direct answer from their team.

Also note: Due runs the same KYC/KYB model. It does not solve blocker 2. Nobody licensed does.
Due is the better vendor for a fiat leg, not a way to have a fiat leg without identity.

Third option worth naming: the Starknet Foundation runs a grants program for payment applications
(monthly STRK grants for user acquisition and features). For a pre-revenue Starknet payments app,
that is capital coming in rather than $5,000 going out.
Source: https://www.starknet.io/blog/starknet-foundation-announces-support-program-for-payment-applications/

## What to send Fin, if you want the conversation to continue

Five questions, all answerable by email, none requiring payment:

1. What does your risk engine do with a USDC deposit whose immediate on-chain ancestor is a
   withdrawal from a shielded privacy pool on Starknet, and does a CCTP hop change that answer?
   We are asking because your prohibited list includes "mixing services" and we want your written
   read before we integrate, not after.
2. The order form lists roughly 110 currencies. Your coverage page lists 59 live and 36
   on-request, and your developer docs list USD, MXN, BDT and PKR. Which of the three governs the
   contract, and can the order form be amended to the live list?
3. The order form prices FedNow at $1.00, but your 2026-09-09 changelog removed FEDNOW from virtual
   account source rails. It also prices ACH, which the same changelog says is not yet available for
   payouts. When do these go live, and is that date contractual?
4. Is Starknet on the roadmap for payin or payout, and with what date? If not, we route via CCTP to
   Ethereum or Polygon, and we would like that confirmed as supported.
5. The order form is headed "Shield.Cash". Please reissue it correctly.

And two commercial asks, if the answers come back clean: make the $5,000 a credit against
transaction fees rather than cash, or defer it until first live transaction; and start the 90-day
refund clock at first live transaction, not at signature.

## Recommendation

Do not sign. Do not pay $5,000. Send the five questions, because the answers are free and the
compliance answer is worth having on file regardless of what you decide.

The deeper point: sealed.cash does not currently have a fiat problem. It has no completed unshield
on mainnet, no completed private send, and no users. A fiat rail is the correct thing to buy after
there is flow to put through it, and the right vendor question at that point is not "which ramp" but
"which legal entity operates the public side of this product, and does it touch the pool at all".

## Sources

All read 2026-09-22 unless noted.

- https://developer.fin.com/guides/coverage/supported-rails-and-currencies
- https://developer.fin.com/guides/coverage/coverage-and-capabilities
- https://developer.fin.com/guides/customers-and-compliance/high-risk-activities
- https://developer.fin.com/guides/customers-and-compliance/nested-payments-and-onboarding
- https://developer.fin.com/guides/customers-and-compliance/onboarding-individuals
- https://developer.fin.com/guides/crypto-orchestration/introduction
- https://developer.fin.com/guides/move-money/how-usd-features-work-for-a-customer
- https://developer.fin.com/changelogs/2026-09-09
- https://www.fin.com/ , /coverage , /company , /products/virtual-accounts , /products/wallets
- https://crypto.news/fin-com-raises-20m-to-expand-stablecoin-payments/
- https://fortune.com/2026/09/15/exclusive-expa-coinbase-ventures-fin-com-20-million-seed-round-global-stablecoin-infrastructure/
- https://www.opendue.com/ , /api , /crypto-web3 , /legal/regulatory
- https://due.readme.io/docs/overview (marked updated 12 months ago)
- https://www.starknet.io/blog/global-payments-settled-fast-on-starknet-powered-by-due/ (2025-09-04)
- https://www.starknet.io/blog/starknet-foundation-announces-support-program-for-payment-applications/ (2025-04-04)

Related in-repo: `docs/CARD_LAST_MILE.md`, `docs/research/issuer-options.md`,
`docs/research/CARD_LEG_NOBODY_CARDS.md`.
