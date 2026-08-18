# Positioning: how to say what this is

Date: 2026-08-22. Source of truth for every spoken and written pitch.

Rule: lead with the fact that the user's salary is public. That is the hook. The product is
the answer to it, never the opening line.

## The 15 second version

> Your salary is public. Anyone who has your address can see what you earn, what you hold, and
> everyone you pay. I built the account that fixes that: your money sits shielded on Starknet,
> and you spend it without broadcasting your income.

## The 30 second version (default for the video)

> Your salary is public. If you get paid in USDC, anyone with your address can see what you
> earn, what you hold, and every contractor you pay.
>
> I'm building the account that fixes that. Money lands, you shield it into the STRK20 pool, and
> from there you hold it, send it, and later spend it, without broadcasting your income or your
> net worth.
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
> to people you pay, yield on what sits idle, and a path out to a card when you need to spend.
>
> You keep the keys. Ready does the proving, and the app never touches a viewing key. Deposit
> and withdrawal amounts stay public, and I say that in the product, because pretending
> otherwise is how these things get people hurt.
>
> It is not a bank and it is not a mixer. It is the account you use on the day you get paid.

## Line bank

Use these individually. Each survives being quoted alone.

- "Your salary is public."
- "It is not a bank and it is not a mixer."
- "You keep the keys. Ready does the proving. The app never touches a viewing key."
- "I'm the user. My payday is public right now."
- "The ten second action is: payday landed, shield it."
- "Every shield grows the shared anonymity set, so this is not zero sum with anyone else
  building here."
- "No issuer debits an encrypted note. So the card is not v0, and I won't fake one."

## Banned language

Never say, in any medium:

| Banned | Why |
|---|---|
| untraceable, anonymous, bank grade privacy | Anonymity set is small today. The claim is false and the audience knows it. |
| bank, neobank (as a claim about what this is) | Not licensed. Say "money account". |
| mixer | Wrong primitive, wrong regulatory frame. |
| "the merchant can't see the card" | Merchant sees a Visa, issuer sees KYC. |
| any pool TVL or asset count number | The community figure is UNVERIFIED, single source, not re-indexed. |
| compliant, regulator approved | Selective disclosure is a capability, not an endorsement. |

Do not describe the product as "privacy preserving neobank infrastructure". That is the
category, and it says nothing.
