# Fin.com as a fiat leg for sealed.cash

Date: 2026-09-22. Trigger: an inbound order form from Fin.com quoting $5,000 onboarding and 0.35%
tier-one ramp pricing.

Verdict: **no, not for this product, and not on this order form.** Three independent blockers, any
one of which is sufficient. A narrower yes exists and is stated at the end.

Updated 2026-09-22 after a diligence pass. The registry finding below was not in the first draft and
is the strongest single reason not to pay anything yet.

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

- **"Fed Now (Instant 24/7): $1.00"**. The 2026-09-09 changelog records `FEDNOW` being **removed**
  from virtual account source rails, which now accept only ACH, SWIFT, FEDWIRE and SPEI. The order
  form prices a rail Fin deleted thirteen days before sending it.
  Source: https://developer.fin.com/changelogs/2026-09-09
- **"ACH (same day or standard): $1.00"**. The same changelog states "USD ACH payouts are not yet
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

## The registry does not match the contract

This is the finding that changes the recommendation from "not a fit" to "do not send money".

Their Account Holder Terms name the regulated entity you would contract with:

> Regulated payment services under these Terms [...] are provided through Fin's licensed subsidiary,
> **FIN.COM Payments Inc.**, a Money Services Business registered with the Financial Transactions and
> Reports Analysis Centre of Canada (FINTRAC) under registration number **M23303386**.

Source: https://legal.fin.com/account-terms, read 2026-09-22.

FINTRAC publishes its registrant list as a spreadsheet. I downloaded it on 2026-09-22
(`https://fintrac-canafe.canada.ca/msb-esm/reg-eng.xlsx`, 1,095,194 bytes) and parsed all 8,536
registrant rows. `M23303386` appears exactly once:

| Column | Value |
|---|---|
| Legal Name | FXDD TRADING LTD. |
| Business Address | 408-55 Water Street, Office 8723, Vancouver, British Columbia, V6B 1A1 |
| Services Offered | Foreign Exchange, Money Transferring, Virtual Currency, PSP |
| Status | Registered |
| MSB Registration Number | M23303386 |

`FIN.COM Payments Inc.` returns zero rows. The only string matches for "fin.com" in the whole file
are substrings inside unrelated domains (thehalfin.com, spherefin.com, finrefin.com, turanfin.com,
greenzonefin.com).

What this is not: proof of anything improper. The likeliest explanation is an acquisition followed by
a name change that has not been filed or has not propagated to the published list. Fin's own press
says they have completed seven acquisitions and named none of them.

What this is: the registry does not corroborate the name and number printed on the contract that
would govern your client funds. Ask for the FINTRAC extract showing the name change before you sign
or pay. If they cannot produce it, that is your answer.

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
- Named banking partners appear in the v3 virtual account API as `SSB` and `PORTAGE`. These resolve
  to SSB Bank, Pittsburgh (FDIC cert 30431, about $430M in assets) and Portage Bank, Bellevue (FDIC
  cert 8197, about $116M). Your funds would sit in an FBO account at a community bank two hops away
  from you, and the terms state plainly that balances "are not deposits". Sponsor-bank de-risking is
  the most common way small payments startups go dark.
- Claimed customers "collectively serve more than 800 million end users", with no customer named.
  Of the four case studies on their own site, only Cadana has publicly confirmed the relationship
  from its own account.
- The brand is younger than the company. The same operation ran as River (river.app) through mid
  2025, and both identifiable acquisitions were made under the River name. fin.com served a
  registrar parking page as recently as January 2025.
- LinkedIn self-reports 11 to 50 employees. The press release says 200-plus.
- Two live matters worth knowing about, both allegations rather than findings, neither involving
  Fin.com itself: *Panda Restaurant Group v. Lunchbox Technologies* (S.D.N.Y. 1:25-cv-09999, in
  discovery) pursues the CEO's prior company on alter-ego and fraudulent-transfer theories over a
  $3.65M judgment, and a derivative action naming him personally is open in Queens County Supreme
  Court (index 735582/2025). Neither says anything about Fin.com's conduct. Both are the kind of
  thing you want to know before wiring $5,000 to a company with no operating history under its
  current name.

### Contract terms worth reading before signing

From https://legal.fin.com/account-terms, read 2026-09-22:

- Aggregate liability for any claim is capped at "the fees you paid for the relevant Service in the
  three (3) months before the event". On a $5,000 setup fee plus thin transaction fees, the cap is
  close to nothing.
- Governing law is British Columbia, with exclusive jurisdiction in BC courts. Enforcing anything
  means litigating in Vancouver.
- "Completed conversions and settled transactions are final and irrevocable."
- Their UAE terms page carries a disclaimer stating that the Wind Technologies licence "authorises
  the Firm solely to test its services", that participants "may have reduced rights and may not be
  fully compensated for any losses", and that the firm "will not undertake or process any financial
  transactions until a designated Client Money Account has been opened and approved". That is on
  their own site, at https://legal.fin.com/terms-and-conditions.

## The money math

The refund condition is the tell. $5,000 upfront, refundable in full only on $100,000 of volume
within 90 days of going live. At tier one, $100,000 of volume earns Fin $350. A vendor does not
return $5,000 to earn $350 unless it expects the threshold to be missed, or expects whoever clears
it to become a long-term account.

sealed.cash today has four mainnet `apply_actions` transactions, no completed unshield, no
completed private send, and no users. $100,000 in 90 days is not a stretch goal, it is not a goal.
Price the $5,000 as non-refundable and ask whether a pre-revenue product with zero fiat users
should spend it.

On the rate itself: 0.35% is defensible. Bridge publishes 0.25% for basic orchestration and 0.50%
for virtual-account orchestration in its developer agreement
(https://www.bridge.xyz/legal/developer-agreement), so the quote sits between the two closest
published comparables. BCG's May 2025 stablecoin paper puts on and off-ramp charges at 0.1 to 1% for
major exchanges and 1 to 3% for specialist providers
(https://media-publications.bcg.com/Stablecoins-five-killer-tests-to-gauge-their-potential.pdf).
The quote is inside the tighter band.

One caveat on that comparison. A 35 bps rate is only coherent over bank rails, because interchange
alone exceeds 35 bps on any card transaction. If someone compares it against a widget's all-in card
price of around 4%, that is not a like-for-like comparison.

The setup fee has no published comparable in this category. Of fourteen providers surveyed, BVNK is
the only one that even discloses that an onboarding fee exists, and it publishes no amount. The fee
is also the entire problem, because it amortises against volume you do not have:

| First-year ramp volume | $5,000 as bps | Effective all-in rate |
|---|---|---|
| $1,000,000 | 50 bps | 0.85% |
| $100,000 | 500 bps | 5.35%, worse than a retail card ramp |

Break-even against a 1% self-serve alternative is roughly $770,000 of first-year volume. Note that
$100,000 is also the refund trigger. Miss it and you have paid 535 bps on everything you did move.
The rate is fine. The entry fee is the whole cost.

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

### Ramps that already support Starknet

Correcting my own earlier framing, which treated Due as the only Starknet-aware option. Three
consumer ramps support Starknet today, and all three are self-serve or near it, with no setup fee
published anywhere:

- **Alchemy Pay.** A live read of their production ramp API on 2026-09-22 returns
  `{"crypto":"STRK","network":"STARKNET"}` and `{"crypto":"USDC","network":"STARKNET"}` among 366
  pairs at `api.alchemypay.org/index/v2/crypto/network/list`. Their own Network Code docs page is
  stale and omits Starknet; the live API outranks the doc. Buy side confirmed, sell side not
  publicly callable. Published prices: cards 3.99% plus $0.40, SEPA Instant 0.60%, US ACH 1.50%.
  Sales-led onboarding, roughly five working days.
- **Ramp Network** and **Banxa**, both confirmed for Starknet.

These are retail widget pricing, several times fin's 35 bps, and they charge nothing to start. For a
product with no fiat users, a higher rate on zero volume costs zero, and a $5,000 fee on zero volume
costs $5,000. That is the whole trade.

Not verified: spreads. Alchemy Pay and Coinbase both confirm a spread exists and neither sizes it,
so no all-in cost is knowable from published sources for either. Alchemy Pay off-ramp pricing is not
published anywhere reachable. Every figure here is a list price, not an executed contract.

Also worth knowing: Coinbase Onramp cannot pay you. Its OpenAPI schema contains only `coinbase_fee`
and `network_fee`, with no partner fee or revenue-share field. Transak, MoonPay and Alchemy Pay all
allow a partner markup.

Third option worth naming: the Starknet Foundation runs a grants program for payment applications
(monthly STRK grants for user acquisition and features). For a pre-revenue Starknet payments app,
that is capital coming in rather than $5,000 going out.
Source: https://www.starknet.io/blog/starknet-foundation-announces-support-program-for-payment-applications/

## What to send Fin, if you want the conversation to continue

Six questions. All answerable by email, none requiring payment. Send them in this order; the first
one matters more than the other five combined.

1. Your Account Holder Terms say regulated services are provided by FIN.COM Payments Inc. under
   FINTRAC registration M23303386. We pulled FINTRAC's published registrant list on 2026-09-22 and
   M23303386 is registered to FXDD TRADING LTD. of Vancouver. FIN.COM Payments Inc. does not appear.
   Can you send the registry extract showing the name change, plus the licence certificate for every
   jurisdiction we would transact in?
2. What does your risk engine do with a USDC deposit whose immediate on-chain ancestor is a
   withdrawal from a shielded privacy pool on Starknet, and does a CCTP hop change that answer? We
   ask because your prohibited list includes mixing services, and we would rather have your written
   read before we integrate than after.
3. The order form lists roughly 110 currencies. Your coverage page says 59 live and 36 on-request.
   Your developer docs say USD, MXN, BDT and PKR. Which governs the contract, and will you amend the
   order form to the live list?
4. The order form prices FedNow at $1.00, but your 2026-09-09 changelog removed FEDNOW from virtual
   account source rails. It also prices ACH, which that changelog says is not yet available for
   payouts. When do both go live, and is that date contractual?
5. Is Starknet on the roadmap for payin or payout? If not, we route via CCTP to Ethereum or Polygon
   and would like that confirmed as supported.
6. The order form is headed "Shield.Cash". Please reissue it correctly.

Four commercial asks, if the answers come back clean. Convert the $5,000 into a credit against
transaction fees rather than cash, or defer it to first live transaction. Start the 90-day refund
clock at first live transaction, not at signature. Add a refund-on-non-delivery clause tied to the
specific corridors you need. Cap any prefunded balance, since non-USD payouts require prefunding and
the terms make settled transactions irrevocable.

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
