# Interview answers

Date: 2026-08-22. Spoken answers for any recorded call, podcast, judge Q&A, or investor intro.
Every claim here traces to `docs/PRODUCTION_BUILD_PLAN.md`, `docs/CARD_LAST_MILE.md`, `README.md`
or `strk20.json`. If a doc changes, change this file.

Opener is in `POSITIONING.md`. Do not improvise a new one.

## "Who is the ideal customer?"

Answer as one person, not a segment. Source: `docs/PRODUCTION_BUILD_PLAN.md:33`.

> A crypto native worker or founder paid in USDC or STRK who doesn't want colleagues, copy
> traders, or the open chain sizing their income.
>
> I'm that user. My payday is public right now.
>
> The second one is small crypto teams doing payroll. A company paying fifteen contractors on
> Starknet publishes every salary and the full headcount. Phase 1 is a payroll helper: batched
> channels, aggregate visible to an auditor, per recipient encrypted, and each recipient pulls
> their own income statement with their viewing key.

The "I'm that user" line does the work. Say it.

## "What does the product look like?"

Describe a day, not a feature list.

> Payday lands. Open the app, connect Ready, shield the incoming USDC in one tap. That is the
> ten second action.
>
> After that it behaves like an account. Balance stays hidden until you press Reveal. You send a
> private payment to a teammate, or share a receive link. Idle stables earn. When you need to
> spend, the funds unshield and hop out toward a card.
>
> The return trigger is the next payday, the next contractor payout, the next yield claim. It is
> not a dashboard you check.

If asked what is literally on screen: connect, capability gate, balances strip with Reveal, then
Shield / Send / Receive / Unshield / Swap. Balances are live chain reads, not fixtures.

## "What is live today?"

Answer before anyone has to dig. Source: `strk20.json`, `README.md:56`.

> Three real mainnet transactions from one Ready wallet, all logged in `strk20.json` and open on
> Voyager: deploy account, shield 0.1 STRK, and shield 0.2 USDC. Public repo, public demo at
> neobank-six.vercel.app.

Once the loop closes, add: "plus a private send and an unshield, so the full loop is done on
mainnet."

If a blocker is still open at recording time, name it with its number in one sentence. "Unshield
needs more public STRK than the demo wallet holds past the live 6 STRK pool fee." A specific
blocker reads as engineering. A vague one reads as vapor.

## "How does it make money?"

Source: `docs/PRODUCTION_BUILD_PLAN.md:137`.

> Yield spread on idle shielded stables. A take on private swap. Basis points on payroll volume
> in Phase 1. Card interchange in Phase 2, and only after a real BIN.
>
> Not from prize money.

## "What about the card?"

The trap question. Source: `docs/CARD_LAST_MILE.md:10`.

> No issuer debits a STRK20 note. Visa authorizes in about two seconds against a public liquid
> balance, and a note is encrypted and needs a proof. So the card is not v0, and I won't fake
> one.
>
> The hop I own is real and shipped: unshield to native USDC on Starknet, then a Circle CCTP V2
> burn on domain 25 out to Base or Solana. Past that it is Stripe Issuing plus Bridge JIT, which
> is partner gated. The merchant sees a Visa and the issuer sees KYC. I'm not going to claim
> otherwise.

Refusing to fake the card is the most credible thing available to say. Do not soften it.

## "Why Starknet?"

> The pool is live on mainnet with onchain deposit screening and selective disclosure, and it
> composes: AVNU private swap, lending anonymizers. That combination does not exist elsewhere.
> Railgun is the closest analogue on EVM and it is not this composability.
>
> And every shield I bring grows the shared anonymity set, so this is not zero sum with anyone
> else building here.

That last sentence is the one that makes an ecosystem team want to amplify you. Land it.

## "Who are your competitors?"

Source: `docs/PRODUCTION_BUILD_PLAN.md:147`. Name them, do not dodge.

> ether.fi Cash, Kast, and the Ready card all spend from a public wallet, so holdings and
> history are public. Gnosis Pay is the best self custodial Visa and has no shielded book.
> Hinkal Pay proves the demand for private stables but it is wallet to wallet on EVM, not a
> Starknet account with DeFi and a card path. Railgun is the closest protocol analogue.
>
> The demand is proven. What is missing is the account.

## "What is hard about this?"

Shows depth fast. Source: `docs/PRODUCTION_BUILD_PLAN.md:93`.

> Notes mature around ten blocks and the prover reads finalized state, so you sequence private
> transactions or the next proof fails. Open notes leak output amounts, so anything from DeFi
> needs an extra private transfer if the amount must stay hidden. And you can never bundle a
> public deposit with the private spend it funds, which is the mistake that quietly destroys the
> whole point.
>
> Also: history and analytics have to read the pool's Deposit event and its first indexed key,
> never the transaction sender, because private transactions are relayed and the sender is the
> relayer for everybody.

## "What do you need?"

Always have an ask. Pick two:

- AVNU paymaster key so the private swap path is live on the deployment.
- A second registered Ready wallet for demos.
- Xverse Wallet API timing for the dapp facing path.
- Whether shadow accounts land on the Wallet API path. `wallet_rpc.json` v0.10.4-rc.1 specs
  `wallet_strk20ShadowAccountCommitment` and `shadow_account_invoke`, stable types-js is still
  0.10.3, and Ready support is unverified.

## "What is next?"

> Phase 1 is payroll and recurring payouts, plus the Privacy Bridge so EVM users can fund in and
> get out unlinked. Phase 2 is the card, only after an issuer contract exists.

Do not promise the card on a date.
