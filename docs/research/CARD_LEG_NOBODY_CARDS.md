# nobody.cards teardown, and what it settles for our card leg

Date: 2026-09-07. Method: read their shipped bundle, not their marketing. Landing HTML,
`/login`, the Vite entry `/assets/index-BkhLiNIa.js`, and all 129 lazy chunks fetched and
searched. Every quote below is a string in code they serve to every visitor.

Short version: nobody.cards is **not** a privacy technology. It is a custodial white-label
prepaid card with the KYC step deferred, and its own published AML policy would freeze a
deposit that came out of a privacy pool. It confirms Track B2 in
[`../CARD_LAST_MILE.md`](../CARD_LAST_MILE.md) stays dead, and it does not threaten Track A.

## What it is, from their own code

| Claim | Evidence in the bundle |
|---|---|
| It is a reskin, not a build | `offid-dashboard.css` header: *"the vendor app (\"Zeroid v2\", captures in cloudflare-worker/base_html/v2-\*.html) renders a dark mobile-first shell (div.zeroid-v2)"*. A Cloudflare Worker injects CSS and `offid-route-sync.js` over a third-party app. Landing is Next.js on Vercel; the app is a Vite SPA. `offid.cards` serves the identical site. |
| Identity is an email or a Telegram account | `/api/auth/telegram` (Telegram `initData`), `/api/auth/email/request-code`, `/api/auth/email/verify`. JWT in `localStorage("token")`. No wallet, no signature, no proof. |
| Custody is theirs | Deposit USDT/USDC on TRC20, ERC20, BEP20, SOL or POLYGON to an address they control; they hold the fiat balance and the card spends it. Routes `/fiat-crypto`, `/select-crypto`, `/confirm-transaction`, `/payment-setup/apple-pay`. |
| They are not the issuer | *"Virtual cards accessible through the Platform are issued and processed by licensed financial institutions or authorized payment partners."* |
| "Private" means a legal threshold, not cryptography | FAQ: *"nobody operates under legal frameworks that allow limited-value prepaid cards without full KYC requirements."* |

Commercials, from the FAQ: USD 50 issuance (marketed as 50% off 100), top-up USD 1 + 4%,
e-wallet deposit about USD 3.50, USD 10,000 per transaction, USD 300,000 per month.

## The part that matters to us

Their card state machine contains `FROZEN`, `FROZEN_INPROGRESS`, `FROZEN_REFUND` and
**`FROZEN_KYC_REQUESTED`**. The policy behind that state, verbatim:

> All incoming transactions are subject to automatic verification. Wallet addresses and
> transaction hashes are analyzed using a risk assessment system.
> Risk Score Threshold 60% — if this threshold is exceeded, the transaction is temporarily
> suspended for further verification (KYC/SoF).

> Zero-Tolerance Categories — FREEZE and VERIFICATION […] **Mixing Services or Obfuscation
> Tools (including coin mixers, tumblers, and any services or mechanisms designed to
> anonymize, obfuscate, or conceal the origin of funds, including indirect usage through
> intermediary platforms)**

On a freeze the user is asked for passport, a selfie holding it, proof of source of funds,
and signed proof of wallet ownership, with a decision window of **up to 90 business days**.

Read the parenthesis carefully. "Any services or mechanisms designed to anonymize" plus
"indirect usage through intermediary platforms" describes a shielded pool withdrawal, and it
describes it even after a CCTP hop, because the hop is the intermediary. The no-KYC card is
no-KYC exactly until the money looks private, which is the only case we would ever route.

So the pitch "unshield, then top up a no-KYC card" is worse than unverified. It is
contradicted by the provider's own published terms, and the failure mode is not a declined
top-up but a frozen balance plus a demand for the identity documents the user came here to
avoid, held for up to 90 business days.

## Consequences

1. **Track B2 stays out of the product, now on evidence rather than caution.** The previous
   argument was that we could not verify solvency or durability. The stronger argument is
   that the category's compliance stack is explicitly built to catch our exact user.
2. **Any future card partner is screened on one question, before anything else is built:**
   what does your risk engine do with a deposit whose immediate ancestor is a shielded pool
   withdrawal? A partner without a written answer is not a partner. This belongs at the top
   of [`issuer-options.md`](issuer-options.md) outreach, ahead of BIN, fees and geography.
3. **They are not a competitor, and we should stop treating card-shaped products as the
   benchmark.** Their privacy boundary is the merchant and the bank not learning your name,
   with the operator learning everything. Ours is the chain not learning amounts or
   counterparties, with the operator learning nothing. A user who wants both needs both.
4. **The honest comparison is a marketing asset**, not a threat. "They hide you from the
   merchant, we hide you from the chain, and neither of us can do the other's job" is a
   sharper line than any claim we could make alone, and it is verifiable.

## Comparison, stated so we can publish it

| | nobody.cards | sealed.cash |
|---|---|---|
| What is hidden | your name, from the merchant and the bank | amounts and counterparties, from the chain |
| Hidden from the operator | nothing, they hold the balance and the ledger | everything, the dapp never holds a viewing key |
| Custody | custodial | non-custodial STRK20 pool |
| Identity to start | email or Telegram | a Starknet wallet |
| Spends at an arbitrary merchant | yes, Visa and Apple Pay | no |
| Behaviour on privacy-sourced funds | frozen, KYC and source of funds demanded | it is the normal case |

## Method note, so this is reproducible

```bash
npm run verify:nokyc-card
```

`scripts/verify-nokyc-card-policy.mjs` discovers the content-hashed Vite entry from `/login`,
fetches all 129 chunks plus the landing page, and asserts each quote this doc cites is still
present, exiting non-zero if any is gone or the site moved. Verified to fail: mutating one
needle exits 1 naming that claim, and pointing it at a bad origin exits 1 on the 404. Run it
before citing this doc, because vendors edit terms quietly.

By hand, if the script is not to hand:

```bash
curl -s https://www.nobody.cards/login -o nbl.html                 # names /assets/index-*.js
curl -s https://www.nobody.cards/assets/index-BkhLiNIa.js -o app.js
grep -oE 'assets/[a-zA-Z0-9._-]+\.js' app.js | sort -u \
  | while read f; do curl -s "https://www.nobody.cards/$f"; done > all.js
grep -o 'FROZEN_KYC_REQUESTED' all.js
grep -o 'Mixing Services or Obfuscation Tools' all.js
```

The policy text lives in the client bundle because their terms and privacy pages are React
components, so it needs no login and no account to verify.

Blind spot: this reads one program's published policy. It proves what nobody.cards says it
does, not what every no-KYC issuer does in practice, and a policy this broad may well be
enforced loosely until an amount gets large. The screening question in
[`issuer-options.md`](issuer-options.md) exists because only a written answer from a specific
partner settles that.
