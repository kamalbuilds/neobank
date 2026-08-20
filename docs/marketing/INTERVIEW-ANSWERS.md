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
> disbursement in one call at one pool fee instead of one per recipient, aggregate visible to an
> auditor, per recipient encrypted, and each recipient pulls their own income statement with
> their viewing key.

The "I'm that user" line does the work. Say it.

## "What does the product look like?"

Describe a day, not a feature list.

> Payday lands. Open the app, connect Ready, shield the incoming USDC in one tap. That is the
> ten second action.
>
> After that it behaves like an account. Balance stays hidden until you press Reveal. You send a
> private payment to a teammate, share a receive link so someone can bill you, or settle an
> invoice that arrived as a payment request. Idle stables earn. Spending happens inside the
> pool as another private transfer. Stepping out to a public balance is the exception, and it
> is optional.
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
is blocked on public STRK in the demo wallet: the pool fee alone was 6 STRK at the 2026-08-22
mainnet read, and the app reads it live at call time." A specific blocker reads as engineering.
A vague one reads as vapor.

## "How does it make money?"

Source: `docs/PRODUCTION_BUILD_PLAN.md:137`.

> Yield spread on idle shielded stables. A take on private swap. Basis points on batched payout
> volume in Phase 1. Card interchange only if a real issuer ever earns its way in, which is
> evidence gated, not assumed.
>
> Not from prize money.

## "What about the card?"

The trap question. Source: `docs/CARD_LAST_MILE.md`. The trap is answering it like an apology.
It is an architecture decision, so answer it like one.

> People ask when the card ships. I think that is the wrong question. The right one is: how do
> you spend from a shielded balance today, with nobody's permission? Payment links and invoices
> against your registered pool address. Payroll that pays ten contractors in one call for one
> pool fee instead of ten calls for ten fees. And my favorite: one transaction that pays a
> person, opens a DeFi position with whatever is left, and reshields the change. Atomically. A
> card structurally cannot do that last one, because Visa authorizes in about two seconds
> against a public liquid balance, and an encrypted note needs a proof.
>
> The boundary I will say plainly: this spends to anyone who can receive a Starknet private
> transfer. Not to an arbitrary merchant. If usage ever shows people genuinely need POS and
> Apple Pay acceptance, then an issuer conversation starts, evidence gated. Until then, the hop
> I own is real and shipped: unshield to native USDC on Starknet, then a Circle CCTP V2 burn on
> domain 25 out to Base or Solana. Past that it is partner territory. The merchant sees a Visa
> and the issuer sees KYC. I'm not going to claim otherwise.

Lead with what ships without an issuer. The refusal to fake a card lands on its own after that.

## "What is the defensible part?"

Source: `docs/CARD_LAST_MILE.md`, Track A.

> Anyone can fork a UI. What they would have to reinvent is the shape of the spend. One
> `privacy_invoke` pays a recipient, opens a DeFi position with the remainder, and reshields the
> change in the same atomic call. There is no allowlist gating which contracts compose; the
> pool checks the target contract address and executes. So batched payroll costs one pool fee
> per call, and spend plus invest plus reshield is one step where everything else takes three,
> each one leaking.
>
> Every card program runs the opposite direction: authorize a public liquid balance in two
> seconds, KYC at the issuer, settle later. They cannot retrofit atomic private composition
> onto that rail. Neither can we lose it by copying them. It falls out of building on notes
> instead of balances.

This is the answer to give when the room goes quiet. Do not bury it under three examples.

## "Why Starknet?"

> The pool is live on mainnet with onchain deposit screening and selective disclosure, and it
> composes: AVNU private swap, lending anonymizers. Programmable spend is the proof. One
> private call reaches arbitrary contracts because there is no allowlist in the way. That
> combination does not exist elsewhere. Railgun is the closest analogue on EVM and it is not
> this composability.
>
> And every shield I bring grows the shared anonymity set, so this is not zero sum with anyone
> else building here.

That last sentence is the one that makes an ecosystem team want to amplify you. Land it.

## "Who are your competitors?"

Source: `docs/PRODUCTION_BUILD_PLAN.md:147`. Name them, do not dodge.

> ether.fi Cash, Kast, and the Ready card all spend from a public wallet, so holdings and
> history are public. Gnosis Pay is the best self custodial Visa and has no shielded book.
> Hinkal Pay proves the demand for private stables but it is wallet to wallet on EVM, not a
> Starknet account with DeFi and a programmable spend path. Railgun is the closest protocol
> analogue.
>
> None of them can run one transaction that pays someone, opens a position with the change, and
> reshields, because their spend path authorizes a public balance.
>
> The demand is proven. What is missing is the account, and this one already spends.

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

> Right now: invoicing and expiry on top of payment requests, batched disbursement as the
> default payroll path, and the Privacy Bridge so EVM users can fund in and get out unlinked.
> Programmable spend grows with whatever composes next.
>
> The card has no date on any roadmap. It is evidence gated: if people genuinely need POS and
> Apple Pay acceptance, an issuer conversation starts. Nothing about the product waits on it.

Do not promise the card on a date.
