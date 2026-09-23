# Starknet Foundation Seed Grant: Sealed

Draft answers, field by field, for the Airtable form at
`airtable.com/appfoRv2ottjRfTpL/pag0G55zA8aU4V9bD/form`.

Status: DRAFT. Not submitted.

Every number below was read from this repo or from a live RPC on 2026-09-23, and the source is
named next to it. Anything I could not verify is marked and left for Kamal to fill.

Two checks run on 2026-09-23 before drafting:

- `npm run verify:claim` against `mainnet.nodes.starknet.org/rpc/v0_10`: all four mainnet
  transactions `SUCCEEDED`, each carrying 3 or 4 events from the canonical STRK20 pool, script
  reported `SCOREABLE`.
- `npm run verify:evidence`: 11 of 11 values passed, mainnet block 15,299,772, Sepolia block
  15,494,301. Mutating one hex digit of one hash made the same script exit 1, so the pass is not
  vacuous.

Ecosystem context as of 2026-09-23, which shapes several answers below:

- The STRK20 Private Sprint is over. StarkWare announced winners on 2026-09-21 and said the sprint
  drew more than 200 privacy projects. First was Erebus (confidential negotiation and settlement
  for AI agents), second StakeWars (private sealed-bid auctions in an onchain game), third Xenia
  (private payment links). Sealed did not place.
- Private swaps on Ekubo went live through STRK20 on 2026-09-22.
- Sprint judging weights, from strk20.starknet.io/hackathon: STRK20 integration depth 30%, working
  mainnet product 30%, innovation 25%, documentation and open-source quality 15%.

---

## General project information

**Project name**

> Sealed

**Project category**

> Payments, DeFi, Infrastructure/Tooling. Payments is the primary one; pick whichever of these the
> form actually offers.

**One liner**

> Sealed gives people paid in crypto a money account on Starknet where holding, sending and
> spending do not publish their salary or their net worth, by building ordinary banking flows
> directly on the canonical STRK20 privacy pool.

**Website URL**

> https://sealed.cash

**Project GitHub**

> https://github.com/kamalbuilds/neobank

**Team GitHub handles**

> kamalbuilds, aarav1656

**Project X URL**

> https://x.com/sealedcash

**Other social URLs**

> https://x.com/kamalbuilds

---

## Contact information

**Contact full name**: Kamal Nayan
**Contact email**: kamalthedev7@gmail.com
**Contact Telegram handle**: @kamalthedev
**Contact GitHub username**: kamalbuilds
**TG group <> SNF**: N/A

---

## Team and location

**Country**: India
**City**: [OPEN: Kamal to fill. profile.md lists San Francisco, Bali and India with no primary city.]

**Team**

> Kamal Nayan, founder. Writes the Cairo contracts, the application and the verification tooling.
> GitHub https://github.com/kamalbuilds
> X https://x.com/kamalbuilds
> LinkedIn https://www.linkedin.com/in/kamal-singh7
>
> Aarav, engineer.
> GitHub https://github.com/aarav1656
> LinkedIn https://www.linkedin.com/in/aarav1656/
> [OPEN: Aarav's full legal name and a one-line description of what he owns on this build. I have
> the two links and nothing else, and guessing either would be worse than leaving the gap.]

---

## Project details

**Project overview**

> Sealed is a private money account on Starknet. You hold USDC or STRK in it, you send to other
> Starknet users, you spend at a merchant, and you earn on the idle balance, without any of those
> amounts landing on a public explorer where a colleague, a client or a copy-trader can read them.
>
> It is built on the canonical STRK20 privacy pool rather than on a pool of our own. That choice is
> deliberate: privacy is a function of how many people share an anonymity set, so a product that
> starts its own pool starts with the worst privacy it will ever have. Every shield Sealed brings
> in grows the set every other STRK20 user depends on.
>
> The reason to work on this is narrow and specific. I am paid in USDC, and so is every contractor
> I know. The moment you self-custody and then spend from the same address, every invoice you have
> received is linked to every purchase you have made, permanently, for anyone who cares to look.
> That is not an abstract complaint about surveillance. It is a working condition that pushes
> people back onto exchanges and custodians, which is the opposite of where Starknet wants them.
>
> What runs today, with the network stated on every line, because the difference between mainnet
> and testnet is the difference between a product and a demo.
>
> Mainnet: shield and hold, through the canonical pool at
> 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a. Four transactions, all
> SUCCEEDED, re-verified against a live RPC on 2026-09-23. The first shield is
> 0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193.
>
> Sepolia, through eight Cairo contracts we wrote and deployed: a card swipe that sells shielded
> STRK and pays the merchant in USDC inside one transaction
> (0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df); a dinner paid and a lending
> position opened atomically, where the pool withdrew 10.24 STRK, sent 0.24 to the merchant and put
> 10 into the vault, emitting AuthorizationSettled and PositionOpened in the same receipt
> (0x4d94fa79724d3e997604e4a42a54daab3cc68f4ec17672b3ca9644a843e2639); the same dinner paid again
> by redeeming vault shares; and USDC bridged in from Base over CCTP V2 that lands already shielded.
>
> What is not built, said plainly because a committee will find it anyway. There is no Visa BIN and
> no issuer. No issuer debits an encrypted note, because Visa authorizes in roughly two seconds
> against a public liquid balance and a note needs a proof. What exists is a settlement path that
> pays a merchant out of shielded value, with the spending policy enforced in a contract instead of
> a dashboard. None of the eight contracts is deployed on mainnet yet; two of the eight classes are
> declared there. The EarnVault pays no yield. Every one of those limits is published on
> sealed.cash/docs/status rather than buried.
>
> The evidence register at sealed.cash/docs/evidence lists every transaction and contract with the
> source file each value is read from, and it carries a verification stamp written by the verifier
> itself: pass count, the block each chain was at, and the timestamp of the run. If the verifier
> fails or has not run in 72 hours, the page says so instead of showing a green badge.

**Current phase**

> MVP/Development

**Raise details**

> N/A. No funding raised, no revenue, no investors.

---

## Technical information

**Integrated chains**

> Starknet is the only chain the product runs on. Starknet mainnet for holding and shielding
> through the STRK20 pool, Starknet Sepolia for the eight contracts this project deployed. Base is
> a funding source only: USDC arrives over Circle's CCTP V2 and lands shielded on Starknet. No
> application logic lives on Base.

**Project live**

> Yes

**Starknet Testnet or Mainnet**

> Yes - Mainnet
>
> Qualifier carried into the text answers: the live mainnet surface is hold and shield through the
> canonical pool, four verified transactions. The card, vault and bridge loops are exercised on
> Sepolia. Milestone 1 closes exactly this gap, and it is the honest reason this is a Seed Grant
> rather than a Growth Grant.

**Tools, infrastructure and frameworks**

> STRK20 privacy pool, canonical mainnet deployment. The product is a consumer layer on top of it
> rather than a competing pool, for the anonymity-set reason above.
>
> @starkware-libs/starknet-privacy-sdk 0.14.3-rc.5, for the server-side account that processes card
> settlements. The dapp itself never touches a viewing key.
>
> Starknet privacy Wallet API, through starknet.js 10.4.0 and get-starknet 6.0.4. Private actions
> only appear in the UI when the connected wallet advertises Wallet API 0.10 or above, checked with
> a version comparison rather than a wallet-name allowlist. Ready implements this today, so Ready
> is what the product asks for, and the docs say why.
>
> Cairo, with Scarb and Starknet Foundry, for eight anonymizer and vault contracts:
> CardSettlementAnonymizer, CardProgramAnonymizer, ProgrammableSpendAnonymizer,
> PrivateSpendAnonymizer, PrivatePayoutAnonymizer, EarnVault, EarnAdapter, and a JIT converter.
>
> Ekubo, through the STRK20 private swap route that went live on 2026-09-22. This replaces AVNU as
> the planned swap leg in Milestone 2. AVNU stays in the stack for paymaster-sponsored gas, where
> it is already wired into shield, unshield, send and spend.
>
> Circle CCTP V2 for shielded inbound funding.
>
> Voyager and Starkscan for the evidence register and the proof-relay client.
>
> Next.js 16 on Vercel for the application.
>
> One implementation detail that matters more than it looks: the live pool fee is read from
> `get_fee_amount` at runtime and never hardcoded. It was 6 STRK at the last mainnet read, and a
> hardcoded number breaks silently rather than loudly.

**Starknet specifics**

> Built specifically for Starknet. Not a migration, not a port. The primitive the whole product
> stands on, an encrypted-note privacy pool with a wallet-held viewing key and programmable actions
> against shielded value, does not exist on another chain in a form we could have started from. The
> single transaction that pays a merchant and opens a lending position in one call is a STRK20
> `privacy_invoke`, and there is no equivalent elsewhere to migrate.

**Starknet language**

> Cairo, with deployed contracts rather than tutorials. Eight Cairo contracts written and deployed
> to Starknet Sepolia during the STRK20 Private Sprint. Every class hash, address and deploy
> transaction is recorded in `strk20.json` and re-verifiable with
> `node scripts/verify-strk20-claim.mjs --network sepolia`, which reports 8 of 8.
>
> CardSettlementAnonymizer 0x074dcd5ee5e0fbfdcf25a7cbc3408711de19fccdf46e8f53c71d35e795f5390a
> CardProgramAnonymizer 0x059524ff1c689a45b92e0ff02c752b261805409ff5940721aa4c382ac6b572a4
> ProgrammableSpendAnonymizer 0x0604a76fd7f50d4856cadbc1b6c45908d3be856fde267435124b7a74a7dcbbb0
> PrivateSpendAnonymizer 0x054d94bbe6640e1258a1961ab1226fcb7cb0a9bfdcd72dab8857195e552dc334
> PrivatePayoutAnonymizer 0x042fd2df34df378e33c2c0cbc3e0183974b2ca69c0d222da2326a5bfd64ec2c3
> EarnVault 0x076811f28a950b5c6ddaa02bd323b5fccb572676ff57bbc3b979a430f0acda8b
> plus EarnAdapter and a JIT converter, all in strk20.json.
>
> Source: https://github.com/kamalbuilds/neobank/tree/master/contracts

**Starknet contributions**

> Participated in the STRK20 Private Sprint (starkience/strk20-hackathon), 2026-08-14 to
> 2026-09-07, and shipped Sealed as the entry. StarkWare has since said the sprint drew more than
> 200 privacy projects; Sealed was not one of the three that placed.
>
> The repository is public under Apache 2.0, including the parts most projects keep to themselves:
> the verification scripts. `verify-strk20-claim.mjs` re-checks every claimed mainnet transaction
> against a live RPC and fails the submission if a hash does not exist, did not succeed, or carries
> no pool event. `verify-evidence.mjs` does the same for every hash and address on the public
> evidence page and writes an attestation the page renders, so a stale claim shows as stale. Any
> other STRK20 team can point both at their own manifest.
>
> Sealed publishes a refused-claims page listing twelve things the project will not say about
> itself, and a per-surface status page marking what is LIVE, PARTIAL and NOT BUILT. Both are small
> contributions to how privacy products on Starknet describe themselves, and both cost us the
> easiest marketing lines we have.
>
> [OPEN: a findings post for community.starknet.io is written and being re-verified against current
> mainnet before posting. It documents STRK20 integration traps that fail silently, including that
> the action funding an anonymizer is `withdraw` and not `transfer`, with the working three-action
> ordering. Once it is posted, put the thread URL here. It turns this answer from "we open-sourced
> our tooling" into "another team's integration is unblocked because of us", which is what the
> eligibility criteria actually ask for.]

**Proposed solution**

> Start with what the sprint results say, because it is the most useful framing available. The
> three projects that placed were Erebus (confidential settlement between AI agents), StakeWars
> (sealed-bid auctions inside a game) and Xenia (private payment links). Two of those are new
> categories, and the third, private payment links, is a primitive Sealed also has. So the question
> worth answering is what Sealed does that none of them do.
>
> One transaction that pays and invests. A single STRK20 `privacy_invoke` pays a merchant, puts the
> remainder into a lending position, and reshields the change, with the payer hidden throughout.
> That is exercised on Sepolia today: 10.24 STRK left the pool, 0.24 reached the merchant, 10
> entered the vault, and `AuthorizationSettled` and `PositionOpened` landed in the same receipt. A
> payment link settles and stops. A card network settles and stops. This is specific to a chain
> where shielded value is programmable, which today means Starknet, and it is the capability the
> rest of the product is arranged around.
>
> Spend rules enforced in a contract, not a dashboard. Per-swipe cap, daily cap and blocked merchant
> categories live in CardProgramAnonymizer and are checked on chain at settlement, with
> `max_per_transaction` and `daily_limit` fixed at deploy. A custodian that enforces limits in its
> backend can change its mind. A contract cannot.
>
> Composition with what shipped this week. Private swaps on Ekubo went live through STRK20 on
> 2026-09-22. That makes a swipe that sells a shielded asset and pays a merchant in a different one
> a composition of two live pieces rather than a thing we have to build alone, and Milestone 2 is
> built on it. Sealed is useful to the ecosystem precisely because it consumes other people's
> privacy primitives instead of reimplementing them.
>
> A privacy product that publishes what it does not do. Every competing pitch in this category
> claims a card. Sealed publishes the reason there is no BIN, refuses third-party no-KYC virtual
> cards on the evidence that they freeze privacy-pool funds, and marks its own shadow-spend feature
> PARTIAL because exactly one transaction has settled through it. For a committee that has to tell
> shipped work from a good deck, that is the most useful signal a project can offer.
>
> The ecosystem value is concrete rather than rhetorical. STRK20's usefulness scales with its
> anonymity set, and an anonymity set grows through ordinary reasons to deposit, not through people
> who want privacy in the abstract. An account someone funds every payday is a better source of set
> growth than any amount of advocacy.

---

## Strategy and execution

**Project KPIs**

> The honest starting position: Sealed has no users. It went live at sealed.cash on 2026-08-29 and
> has been a sprint submission rather than a launched product. The KPIs below carry today's real
> value, not a projection dressed as traction.
>
> Mainnet transactions that exercise a product verb, counted in `strk20.json` and checkable on
> voyager.online. Today: 4, all on the hold side. This is the headline number because it is the one
> that cannot be faked.
>
> Mainnet transactions routed through Sealed's own contracts. Today: 0. Milestone 1 makes this
> non-zero, and it is the single metric separating "uses the pool" from "built on the pool".
>
> Value shielded through Sealed, and its share of STRK20 pool deposits, read from pool `Deposit`
> events rather than from a dashboard. Today: the four mainnet transactions total roughly 20 STRK
> and 0.2 USDC, which is honest seed-stage activity not worth dressing up.
>
> Distinct accounts completing at least one shield and one private action. Today: 1.
>
> Settled card authorizations, split by network. Today: 4 on Sepolia, 0 on mainnet.
>
> Repeat rate, meaning accounts that shield in two consecutive months. This is the number that
> decides whether the product is a demo or an account. It is unmeasurable until there is a cohort,
> and Milestone 2 is where it starts.

**User acquisition strategy**

> The wedge is people already paid in crypto who already self-custody, because they have the
> problem today and need no persuading that it is a problem. Concretely: contractors and small
> studios invoicing in USDC, and DAO contributors whose payment addresses are public by
> construction.
>
> Distribution through the wallet. Private actions require the Starknet privacy Wallet API, and
> Ready implements it. Ready's users are a pre-qualified audience of exactly the people who can use
> this, so a wallet integration or listing reaches them without paid acquisition.
>
> The payer pulls in the payee. A private payment request sent to a contractor requires that
> contractor to have a pool-registered account, so every invoice is a reason for one more person to
> register. Invoicing is a habit rather than a campaign, which is why it compounds.
>
> Teaching the integration rather than advertising the product. The traps we hit building on STRK20
> cost real hours, and writing them up for community.starknet.io and the awesome-strk20 list reaches
> builders who then have a reason to look at what we built.
>
> Partnership with Starknet payroll and treasury tools, where a private disbursement path is a
> feature they do not have and we do not want to rebuild their front end to offer.
>
> What we are not doing: an airdrop, a points programme, or paid influencer coverage. A privacy pool
> filled by farmers has an anonymity set that evaporates the day the incentive stops, which makes
> the product worse for the people it is for.

---

## Business and financials

**Business model**

> No revenue today. That is the accurate answer, and here is what it becomes.
>
> Yield spread on shielded balances. Idle balance is lent through a Starknet lending venue and
> Sealed keeps a slice, in the range a neobank keeps on deposits rather than a DeFi headline rate.
> This is the primary line because it scales with balances held rather than with transactions,
> which matches what the product is.
>
> A take on private swaps routed through the account, now that the Ekubo private swap route is live.
>
> A fee on private payouts and payroll batches, charged to the payer, which is the party that
> values the privacy and is usually a business rather than an individual.
>
> Card interchange, but only if a licensed issuer relationship ever becomes real. It is not today,
> and nothing in this plan depends on it. Treating interchange as the business model is what makes
> every other project in this category a waiting room for an issuer.
>
> The cost that shapes all of this is the pool fee, 6 STRK per action at the last mainnet read,
> which is large relative to a small payment. Batching actions and paymaster sponsorship are how
> that gets absorbed, and both are in the codebase rather than on a roadmap.

**Project cost components**

> Engineering time is the whole cost. Two engineers.
>
> Mainnet deployment and operating gas. Declaring the remaining six Cairo classes on mainnet and
> deploying instances is the immediate cash need, alongside a 6 STRK pool fee per action during
> testing. This is the literal thing blocking Milestone 1 right now, not a line invented to fill a
> budget.
>
> A security review of the anonymizer contracts, the largest single expense in the plan, in
> Milestone 2.
>
> Infrastructure is small and stays small: Vercel, a Starknet RPC provider, and an indexer for pool
> `Deposit` events. Under a few hundred dollars a month at this stage.
>
> Costs fall as the pool fee is amortized across batched actions and as paymaster sponsorship
> absorbs user-facing gas. They rise only with headcount, which is deliberately not in this request.

**Security and audits**

> No external audit yet, and pretending otherwise would be the wrong way to start a relationship
> with a funder. It is the main reason mainnet deployment has been deliberate rather than fast.
>
> What exists instead, today. Every deployed contract has its class hash, address and deploy
> transaction recorded in `strk20.json`, re-verifiable against a live RPC with a script in the repo.
> Spending limits are enforced on chain, with `max_per_transaction` and `daily_limit` set at deploy
> and checked at settlement. The dapp never receives or stores a user viewing key; the wallet
> generates and holds it on device. The one custodial exception, the hosted account that processes
> card settlements, has its own separate server-held key that cannot decrypt a user's notes, and
> that exception has its own documentation page rather than being omitted. There is a test suite
> under `tests/`, and three verification gates that hit live RPCs and the live site and fail the
> build if a claimed hash does not exist or did not succeed.
>
> Milestone 2 funds an external review of the anonymizer contracts, with the report published in
> full whatever it says.

---

## Project plan

**Funding amount**: 25000

**Number of milestones**: 2

### Milestone 1

**Name**: Everything on mainnet

**Deliverables**

> All eight Cairo contracts declared and deployed on Starknet mainnet, with class hashes, addresses
> and deploy transactions published in `strk20.json` and on sealed.cash/docs/evidence. Six of the
> eight classes are currently undeclared on mainnet, which is the gap this closes.
>
> One card authorization settled on Starknet mainnet through CardSettlementAnonymizer, paying a
> merchant out of shielded value, with the transaction hash public and the `AuthorizationSettled`
> event readable on Voyager.
>
> One unshield and one private transfer executed on Starknet mainnet, hashes published. Both code
> paths are exercised on Sepolia today and neither has ever run on mainnet.
>
> An atomic pay-and-lend transaction on Starknet mainnet: `AuthorizationSettled` and
> `PositionOpened` in a single mainnet receipt.
>
> A public evidence register carrying a machine-written verification stamp, showing the pass count,
> the block each chain was at, and the run timestamp, regenerated on every deploy, and displaying a
> failed or stale state rather than a green badge when the verifier has not passed recently. This
> exists today and Milestone 1 keeps it true against mainnet contracts.
>
> Documentation brought current with the deployed state, checked by a script rather than by eye, so
> that no page claims a capability the chain does not show. Documentation and open-source quality
> was 15% of the sprint's score and our docs lagged the code; this deliverable is the correction.

**Amount**: $11,000
**Completion date**: December 19, 2026

### Milestone 2

**Name**: Composable private spend, externally reviewed

**Deliverables**

> A private swap inside the settlement path on Starknet mainnet, through the STRK20 Ekubo route
> that went live on 2026-09-22: one transaction sells a shielded asset and pays a merchant in a
> different asset, with the transaction hash public.
>
> Yield on shielded balances through a live Starknet lending venue on mainnet, replacing the
> project's own EarnVault, which pays no yield and is described that way today.
>
> Private payment requests live on mainnet: a link, a QR code and an invoice with an expiry, where
> the payer settles from a shielded note and neither the amount nor the counterparty is published.
>
> A viewing-key scoped disclosure artifact: a counterparty or an accountant can verify one payment
> without the holder revealing the rest of their book.
>
> An external security review of the anonymizer contracts completed, with the report published in
> full including anything left unresolved.
>
> A published cohort report giving distinct mainnet accounts that completed a shield and a private
> action, the repeat rate across two consecutive months, and the volume Sealed added to the STRK20
> anonymity set, each figure traceable to on-chain events rather than to an analytics dashboard.
> Target is 50 distinct mainnet accounts; the deliverable is the report with whatever number is
> real.
>
> A published STRK20 integration guide covering the traps found during the sprint, with working
> code, contributed to the Starknet community forum and the awesome-strk20 list.

**Amount**: $14,000
**Completion date**: March 31, 2027

---

## Past work and grants

**Track record**

> Sealed is the most relevant piece. Built during the STRK20 Private Sprint between 2026-08-14 and
> 2026-09-07: eight Cairo contracts, a Next.js application with sixteen routes, four verified
> mainnet transactions against the canonical pool, and a card settlement path exercised on Sepolia.
> Live at sealed.cash since 2026-08-29. Public and Apache 2.0 at github.com/kamalbuilds/neobank.
>
> The sprint result, stated rather than omitted: more than 200 projects entered and Sealed was not
> among the three that placed. The judging weights were integration depth 30%, working mainnet
> product 30%, innovation 25%, documentation and open-source quality 15%, and the two places we
> were weakest are the two this grant addresses. Nothing we wrote had run on mainnet, and the
> documentation lagged the code. Milestone 1 is written against exactly that diagnosis rather than
> around it.
>
> Usage metrics, accurately: there are none worth quoting. The only account that has completed the
> full loop is ours. Quoting page visits here would make the rest of this application less
> believable. The verifiable artifacts are the four mainnet transaction hashes, the eight deployed
> Sepolia contracts and the live site, all listed at sealed.cash/docs/evidence.
>
> [OPEN: Kamal and Aarav to add prior shipped work outside this project, with links. Previous
> hackathon results, other production deployments, or open-source contributions all belong here and
> I have not assumed any of it.]

**Starknet Foundation Seed Grant (previously applied?)**: No

**Other Starknet grant programs**

> N/A. The STRK20 Private Sprint was a hackathon rather than a grant programme, and Sealed did not
> place, so no prize was received.
> [OPEN: Kamal to confirm there is nothing else.]

**Other grants**

> [OPEN: Kamal to confirm. Drafted as N/A.]

---

## Collaboration and support

**Starknet collaborations**

> StarkWare and the STRK20 team. Sealed is a consumer surface on their pool and reaches the edges of
> the privacy SDK and Wallet API earlier than most teams. The shadow-account path is specified in
> `wallet_rpc.json` 0.10.4-rc.1 while the stable types package is still 0.10.3, and that kind of gap
> is cheap to close with direct contact and expensive to work around alone.
>
> Ready, because private actions need a wallet implementing the privacy Wallet API and Ready is the
> one that does. Their users are the exact audience for this product, and an in-wallet entry point
> is worth more than any campaign we could run.
>
> Ekubo, now that private swaps through STRK20 are live. Milestone 2 puts that route inside a card
> settlement, which is a use of their liquidity they do not have to build for.
>
> Vesu, or whichever Starknet lending venue is the right mainnet home for shielded balances.
> Milestone 2 replaces our own yield-free vault with a real one, and doing that through an
> anonymizer rather than a fork keeps the yield in their protocol and the privacy in ours.
>
> Xenia, which took third in the sprint for private payment links. There is overlap, and the
> sensible outcome is one good link format that several products speak rather than two incompatible
> ones. Worth a conversation before we ship ours in Milestone 2.
>
> Starknet payroll and treasury tools, where private disbursement is a feature they lack.

**Extra support**

> An introduction to the STRK20 and Ready teams would remove more uncertainty than anything else
> here, for the two reasons above.
>
> Guidance on which auditors the Foundation trusts for Cairo privacy contracts. Milestone 2 spends
> real money on a review and picking the wrong firm wastes it.
>
> A view on whether the Foundation considers a settlement path that pays merchants from shielded
> value, with no issuer and no BIN, a legitimate answer to the private-spending problem. We have
> published our reasoning and refused the alternatives on evidence, but it is the one strategic
> question where being wrong is expensive, and the Foundation sees more of this category than we do.

---

## Other details

**Source license**: Apache 2.0, public repository
**How did you hear about this program**: pick from the form's options; the STRK20 sprint is the
honest route
**Referral**: N/A

---

## Open questions before this is submitted

1. City for the location field.
2. Aarav's full legal name, and one line on what he owns.
3. Prior shipped work outside this project, for the track record answer.
4. Confirm no prior Starknet grant and no grants from other ecosystems.
5. The community.starknet.io findings post is being re-verified now. Post it, then paste the thread
   URL into the Starknet contributions answer.
6. Milestone split is $11,000 upfront and $14,000 on completion, against $25,000. The audit sits in
   Milestone 2, which is why the back end is heavier.
