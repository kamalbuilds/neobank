# Positioning: how to say what this is

Date: 2026-08-22. Source of truth for every spoken and written pitch.

Rule: lead with the fact that the user's salary is public. That is the hook. The product is
the answer to it, never the opening line.

Second rule: spending privately is not a feature we are waiting on. It is the architecture.
Permissionless private spend ships without an issuer, so we never talk about the card as
something missing. We talk about what already works, then name the honest edge ourselves.

## The 15 second version

> Your salary is public. Anyone who has your address can see what you earn, what you hold, and
> everyone you pay. I built the account that fixes that: your money sits shielded on Starknet,
> and you spend it privately, without broadcasting your income.

## The 30 second version (default for the video)

> Your salary is public. If you get paid in USDC, anyone with your address can see what you
> earn, what you hold, and every contractor you pay.
>
> I'm building the account that fixes that. Money lands, you shield it into the STRK20 pool,
> and from there you hold it, send it, and spend it without broadcasting your income or your
> net worth. Spending means payment links, invoices, and batched payouts, all inside the pool.
>
> You keep the keys. Ready does the proving, and the app never touches a viewing key. It is not
> a bank and it is not a mixer.

## The 60 second version (if he asks you to expand)

> Your salary is public. If you get paid in USDC, anyone with your address can see what you
> earn, what you hold, and every contractor you pay. Your employer can see it. Your teammates
> can see it. Anyone who ever received a payment from you can see it.
>
> I'm building the account that fixes that. Payday lands, you shield it into the STRK20 pool,
> and from there it behaves like an account: balance hidden until you reveal it, private sends
> to people you pay, payment links and invoices for anything recurring, yield on what sits
> idle. Payroll can hit ten people in one call for one pool fee. And one transaction can pay
> someone, open a DeFi position with the remainder, and reshield the change, atomically.
>
> The honest edge, said out loud: this spends to anyone who can receive a Starknet private
> transfer, not to an arbitrary merchant. A card authorizes a public liquid balance, so it can
> never carry a shielded note and it can never do that last trick. The card is optional and
> evidence gated. Private spend did not wait for it, because it does not need it.
>
> You keep the keys. Ready does the proving, and the app never touches a viewing key. Deposit
> and withdrawal amounts stay public, and I say that in the product, because pretending
> otherwise is how these things get people hurt.
>
> It is not a bank and it is not a mixer. It is the account you use on the day you get paid.

## The differentiator: programmable private spend

Lead with this whenever someone asks what is defensible. Source: `docs/CARD_LAST_MILE.md`,
Track A.

One `privacy_invoke` pays a recipient, opens a DeFi position with the remainder, and reshields
the change in the same atomic call. The pool has no anonymizer allowlist standing in the way,
so arbitrary contracts compose. No card path can match any of it: authorization runs against a
public liquid balance, in the clear, on an issuer's clock. Spend plus invest plus reshield is
one private step here and three leaky ones everywhere else. This is not a bolted-on feature.
It falls out of building on notes instead of balances, which is exactly why a card-first
product cannot retrofit it.

## Line bank

Use these individually. Each survives being quoted alone.

- "Your salary is public."
- "It is not a bank and it is not a mixer."
- "You keep the keys. Ready does the proving. The app never touches a viewing key."
- "I'm the user. My payday is public right now."
- "The ten second action is: payday landed, shield it."
- "Every shield grows the shared anonymity set, so this is not zero sum with anyone else
  building here."
- "Private spend needed no issuer, so it shipped without one."
- "One transaction pays a person, puts the rest to work, and reshields the change. No card can
  do that."
- "Ten contractors, one call, one pool fee."
- "It pays anyone who can receive a Starknet private transfer. Not every merchant. That is the
  honest edge."
- "It is a payment request, not a card number. Calling it a card number trains someone to type
  it into a checkout where it fails."

## Banned language

Never say, in any medium:

| Banned | Why |
|---|---|
| untraceable, anonymous, bank grade privacy | Anonymity set is small today. The claim is false and the audience knows it. |
| bank, neobank (as a claim about what this is) | Not licensed. Say "money account". |
| mixer | Wrong primitive, wrong regulatory frame. |
| "card number" for a payment request | A signed transfer intent is not a card number. The name invites someone to type it into merchant checkout, where it fails. Say what it is. |
| "the merchant can't see the card" | Merchant sees a Visa, issuer sees KYC. |
| any pool TVL or deposit count number | Figures are contested across four sources. UNVERIFIED and unpublished until one reconciles against the chain. |
| a pool fee stated as a fixed constant | The app reads the fee live from `get_fee_amount`. Quote it only as a dated mainnet read, for example 6 STRK at the 2026-08-22 read. |
| compliant, regulator approved | Selective disclosure is a capability, not an endorsement. |

Do not describe the product as "privacy preserving neobank infrastructure". That is the
category, and it says nothing.
