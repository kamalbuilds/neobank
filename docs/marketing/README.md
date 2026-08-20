# Marketing

Everything said in public about this project. Claims here trace back to
`docs/PRODUCTION_BUILD_PLAN.md`, `docs/CARD_LAST_MILE.md`, `README.md`, and `strk20.json`. When a
source doc changes, these change with it.

| File | Use it for |
|---|---|
| [POSITIONING.md](POSITIONING.md) | The opener at 15, 30, and 60 seconds. Programmable spend as the differentiator. Reusable line bank. Banned language. |
| [INTERVIEW-ANSWERS.md](INTERVIEW-ANSWERS.md) | Spoken answers to customer, product, traction, revenue, the card question, defensibility, competition, and what's hard. |
| [STARKWARE-VIDEO-BRIEF.md](STARKWARE-VIDEO-BRIEF.md) | The Adithya / StarkWare privacy sprint video: what to fix first, the reply, the 90 second run of show. |

Three standing rules across all of it:

1. **Never claim a transaction that does not exist.** Live status lives in `strk20.json` and the
   table in `README.md`. Read them before recording anything.
2. **Say the limits out loud.** Deposit and withdrawal amounts are public, the anonymity set is
   small, and no issuer spends a shielded note. Stating this is what makes the rest believable.
3. **The card is a choice, not a gap.** Private spend is the product and ships without an
   issuer: payment links and invoices, batched disbursement at one pool fee per call, and
   programmable spend in one atomic `privacy_invoke`. Name the boundary yourself: it reaches
   anyone who can receive a Starknet private transfer, not an arbitrary merchant.

Numbers discipline: the app reads the pool fee live from `get_fee_amount` (6 STRK at the
2026-08-22 mainnet read), so prose never states it as a constant. Pool size figures are
contested across four sources and stay UNVERIFIED and unpublished until one reconciles against
the chain.
