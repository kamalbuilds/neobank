# Starknet Foundation Seed Grant: Sealed

Application answers for the Airtable form at
`airtable.com/appfoRv2ottjRfTpL/pag0G55zA8aU4V9bD/form`, field by field.
`spikes/fill-grant.py` fills the form straight from this file.

---

## General project information

**Project name**

> Sealed

**One liner**

> Sealed gives people paid in crypto a money account on Starknet where holding, sending and spending don't publish their salary or their net worth, built directly on the canonical STRK20 privacy pool.

**Website URL**

> https://sealed.cash

**Project GitHub**

> https://github.com/kamalbuilds/neobank

---

## Team and location

**Team**

> Kamal Nayan, founder. Kamal writes the Cairo contracts, the app and the on-chain verification tooling behind Sealed. Before Sealed he built at Ionic Money and Kaia, and he's been shipping and winning at hackathons across ecosystems for years.
> GitHub https://github.com/kamalbuilds · X https://x.com/kamalbuilds · LinkedIn https://www.linkedin.com/in/kamal-singh7
>
> Aarav, engineer, building Sealed alongside Kamal.
> GitHub https://github.com/aarav1656 · LinkedIn https://www.linkedin.com/in/aarav1656/

---

## Project details

**Project overview**

> Sealed is a private money account on Starknet. You hold USDC or STRK, send to other Starknet users, spend at a merchant and earn on what's sitting idle, and none of those amounts end up on a public explorer for a colleague, a client or a copy-trader to read.
>
> It's built on the canonical STRK20 pool on purpose. Privacy scales with the crowd you hide in, so rather than starting a pool of our own we bring every deposit into the set the whole ecosystem shares. Each Sealed account makes STRK20 more private for everyone.
>
> Why we're building it: we get paid in USDC, and so does every contractor we know. The moment you self-custody and then spend from the same address, every invoice you've ever received is permanently linked to every purchase you've ever made. That pushes people straight back to exchanges and custodians. Sealed is how they stay on-chain without giving up their privacy.
>
> What's already running. On Starknet mainnet, Sealed shields, holds, sends privately and unshields through the canonical pool, with five transactions anyone can open on Voyager. The newest, 0x6342cd9a1c1f4f9cd85f6561b3d78ed196c0ee3a332b8cc1feacd89e739360e, is a private send: one apply_actions, proved by the STRK20 prover through Starkscan's relay, registers a viewing key, shields 3 STRK, sends 1 STRK privately to a second account and unshields 1 STRK. On Sepolia, through eight Cairo contracts we wrote and deployed, the whole loop works: a card swipe that sells shielded STRK and pays the merchant in USDC in a single transaction, a dinner paid while a lending position opens in the same receipt (10.24 STRK out of the pool, 0.24 to the merchant, 10 into the vault, AuthorizationSettled and PositionOpened together), the same dinner paid again by redeeming vault shares, and USDC bridged in from Base over CCTP V2 that lands already shielded.
>
> Spending runs through a settlement path that pays merchants straight from shielded value, with card policy (per-swipe cap, daily cap, blocked categories) enforced in a contract rather than a dashboard. No issuer can freeze it and no backend can quietly change the limits.
>
> Every claim on sealed.cash links to a transaction, and the evidence page carries a stamp written by our verifier on every run: pass count, the block it read each chain at, and when.

**Raise details**

> Fully bootstrapped. We've built everything so far on our own time and our own money: eight Cairo contracts, the app, the bridge flow and the verification tooling. This grant is what takes Sealed from Sepolia to mainnet and puts it in front of its first users.

---

## Technical information

**Integrated chains**

> Starknet is home. Sealed holds and shields on Starknet mainnet through the canonical STRK20 pool, and our eight Cairo contracts run on Starknet Sepolia today. Base is an on-ramp only: USDC comes in over Circle's CCTP V2 and lands already shielded on Starknet.

**Tools, infrastructure and frameworks**

> STRK20 privacy pool, the canonical mainnet deployment. Sealed is a consumer layer on top of it rather than a competing pool, so every user we bring grows the shared anonymity set.
>
> @starkware-libs/starknet-privacy-sdk for the server-side account that processes card settlements. The app itself never touches a user's viewing key.
>
> Starknet privacy Wallet API through starknet.js and get-starknet. Private actions appear as soon as a wallet advertises Wallet API 0.10 or newer, detected by capability rather than by wallet name. Ready supports it today.
>
> Cairo with Scarb and Starknet Foundry for eight contracts: CardSettlementAnonymizer, CardProgramAnonymizer, ProgrammableSpendAnonymizer, PrivateSpendAnonymizer, PrivatePayoutAnonymizer, EarnVault, EarnAdapter and a JIT converter.
>
> Ekubo, through the STRK20 private swap route that went live on 2026-09-22, for selling a shielded asset and paying a merchant in another inside one settlement. AVNU for paymaster-sponsored gas across shield, unshield, send and spend.
>
> Circle CCTP V2 for funding that arrives shielded, Voyager and Starkscan behind the evidence register, and Next.js on Vercel for the app.
>
> Small detail we're proud of: the pool fee is read from get_fee_amount at runtime and never hardcoded, so when governance moves it Sealed just keeps working.

**Starknet specifics**

> Sealed is built for Starknet from the first commit. The thing the whole product stands on, an encrypted-note pool where shielded value is programmable, only exists here. One STRK20 privacy_invoke paying a merchant and opening a lending position at the same time isn't something you can port from another chain. It's the reason we're on Starknet.

**Starknet language**

> Yes, and with deployed contracts. We wrote and deployed eight Cairo contracts to Starknet Sepolia during the STRK20 Private Sprint, and every class hash, address and deploy transaction is in strk20.json, re-checkable with node scripts/verify-strk20-claim.mjs --network sepolia (8 of 8 verified).
>
> CardSettlementAnonymizer 0x074dcd5ee5e0fbfdcf25a7cbc3408711de19fccdf46e8f53c71d35e795f5390a
> CardProgramAnonymizer 0x059524ff1c689a45b92e0ff02c752b261805409ff5940721aa4c382ac6b572a4
> ProgrammableSpendAnonymizer 0x0604a76fd7f50d4856cadbc1b6c45908d3be856fde267435124b7a74a7dcbbb0
> PrivateSpendAnonymizer 0x054d94bbe6640e1258a1961ab1226fcb7cb0a9bfdcd72dab8857195e552dc334
> PrivatePayoutAnonymizer 0x042fd2df34df378e33c2c0cbc3e0183974b2ca69c0d222da2326a5bfd64ec2c3
> EarnVault 0x076811f28a950b5c6ddaa02bd323b5fccb572676ff57bbc3b979a430f0acda8b
> plus EarnAdapter and the JIT converter.
>
> Source: https://github.com/kamalbuilds/neobank/tree/master/contracts

**Starknet contributions**

> We built Sealed in the STRK20 Private Sprint (starkience/strk20-hackathon) and kept building after it closed.
>
> Everything is open source under Apache 2.0, including the part most teams keep private: our verification tooling. verify-strk20-claim.mjs re-checks every claimed mainnet transaction against a live RPC, and verify-evidence.mjs checks every hash and address on our public evidence page and writes the attestation the page displays. Any STRK20 team can point both at their own manifest.
>
> We're also writing up the integration details we worked out along the way, like the action ordering that funds an anonymizer (withdraw, then an OPEN transfer, then invoke), so the next team building on the pool gets there faster.

**Proposed solution**

> Sealed is RFP 18 from the STRK20 Request for Startups, "Private crypto neobank with a non-custodial spending card", built and running.
>
> Pay and invest in one transaction. A single STRK20 privacy_invoke pays a merchant, puts the remainder into a lending position and reshields the change, with the payer hidden the whole way. It already works on Sepolia: 10.24 STRK left the pool, 0.24 reached the merchant, 10 went into the vault, and AuthorizationSettled and PositionOpened landed in the same receipt. A card network settles and stops. Sealed settles and keeps working for you, and that only exists on a chain where shielded value is programmable.
>
> Spend rules live in a contract. Per-swipe cap, daily cap and blocked merchant categories sit in CardProgramAnonymizer and are enforced on-chain at settlement. A custodian can change its limits overnight. A contract can't.
>
> A money account that outlives its app. We're shipping viewing-key export, a documented recovery path and a second client that reads the same notes, so a Sealed balance never depends on our frontend staying online. Nothing on STRK20 offers that today, and for anything that calls itself a bank account, it's the difference between a demo and a product.
>
> Privacy users can actually see. The pool has an auditor key and a screener key set by governance. In Milestone 1 Sealed ships a page that reads both live from the contract and shows users exactly who can read what, the same way our evidence page already shows the verifier's last run. No other privacy product tells its users this, and it's how compliant privacy earns trust.
>
> Built to compose. A Sealed swipe already sells shielded STRK and pays the merchant in USDC in one transaction, routed through Ekubo liquidity. Ekubo's private swaps went live on STRK20 on 2026-09-22, and Milestone 2 moves settlement onto that route. We use the ecosystem's primitives instead of rebuilding them.
>
> Spending without a card issuer in the middle. Card programs keep failing at the issuer layer: Kulipa's insolvency took Ready's card down in July, and Gnosis Pay is retiring its consumer card in December. Sealed's settlement path pays merchants straight from shielded value with policy enforced on-chain, so there's no issuer to lose.
>
> And every new Sealed account grows the anonymity set the whole STRK20 ecosystem shares. The pool counted 415 distinct depositors in the 30 days to 2026-09-23 and holds $205,622 in shielded USDC. A payroll account funded every payday moves those numbers more than any campaign could.

---

## Strategy and execution

**Project KPIs**

> We measure Sealed on-chain, never with an analytics dashboard, so every number we report can be checked by anyone.
>
> Mainnet transactions routed through Sealed's own contracts. This is the one that matters most, and Milestone 1 is built to move it.
>
> Distinct accounts that complete a shield and a private action, with a target of 50 mainnet accounts by the end of Milestone 2.
>
> Repeat use: accounts that shield again in a second month. That's what tells us Sealed is someone's account and not a one-off.
>
> Value shielded through Sealed and its share of STRK20 deposits, read straight from pool Deposit events.
>
> Settled card authorizations per network, read from our settlement contracts.
>
> Today we have five mainnet pool transactions including a private send and an unshield, eight deployed Sepolia contracts and five settled card authorizations, all published on sealed.cash/docs/evidence.

**User acquisition strategy**

> We start with people who already have this problem: contractors and small studios invoicing in USDC, and DAO contributors whose payment addresses are public by default. They self-custody already and don't need convincing that their salary shouldn't be public.
>
> Through the wallet. Private actions need the Starknet privacy Wallet API, which Ready supports. Ready users are exactly our audience, and an in-wallet entry point reaches them without paid acquisition.
>
> Through invoices. A private payment request sent to a contractor brings that contractor into the pool. Invoicing is a habit, so it compounds every month.
>
> Through builders. We publish what we learn integrating STRK20, on the community forum and awesome-strk20, so the teams building next find Sealed along the way.
>
> Through payroll and treasury tools on Starknet, which get private disbursement without having to build it.
>
> What we won't do: airdrops or points farming. A privacy pool filled by farmers loses its anonymity set the day the incentive ends, and our users deserve better than that.

**Business model**

> Sealed earns where the account earns, so we only make money when users do.
>
> Yield spread on shielded balances. Idle balance is lent through a Starknet lending venue and Sealed keeps a small slice, the way a neobank does on deposits. This is the core line because it grows with the balances people hold.
>
> A small take on private swaps routed through the account, now that Ekubo's private route is live.
>
> A fee on private payouts and payroll batches, paid by the business sending them, which is the party that values the privacy most.
>
> We batch pool actions and sponsor gas through a paymaster, so the economics work even for small everyday payments.

**Project cost components**

> Engineering is the main cost: the two of us, full time on Sealed.
>
> Taking all eight contracts to mainnet: declaring the classes, deploying instances, and the pool fees for real transactions while we ship Milestone 1.
>
> An external security audit of the anonymizer contracts in Milestone 2, the largest single line in the plan.
>
> Infrastructure stays lean: Vercel, a Starknet RPC provider and an indexer for pool events, a few hundred dollars a month at this stage. Batching and paymaster sponsorship keep per-user costs falling as we grow.

**Security and audits**

> Security is built in from day one, and it's all verifiable.
>
> Every deployed contract has its class hash, address and deploy transaction published and re-checkable against a live RPC with a script in our repo. Spending limits are enforced on-chain, with max_per_transaction and daily_limit fixed at deploy and checked at every settlement. The app never sees a user's viewing key: the wallet generates and keeps it on the device. Our test suite and three live verification gates run against real RPCs and fail the build if any claimed transaction doesn't exist or didn't succeed.
>
> A full external audit of the anonymizer contracts is funded in Milestone 2, and we'll publish the report in full.

---

## Project plan

**Funding amount**: 25000

**Number of milestones**: 2

### Milestone 1

**Name**: Everything on mainnet

**Deliverables**

> All eight Cairo contracts declared and deployed on Starknet mainnet, with class hashes, addresses and deploy transactions published in strk20.json and on sealed.cash/docs/evidence.
>
> A card authorization settled on Starknet mainnet through CardSettlementAnonymizer, paying a merchant from shielded value, with the AuthorizationSettled event public on Voyager.
>
> Private send and unshield in the Sealed app for every user, building on the mainnet send already settled through our own tooling (0x6342cd9a1c1f4f9cd85f6561b3d78ed196c0ee3a332b8cc1feacd89e739360e).
>
> The atomic pay-and-lend transaction on Starknet mainnet: AuthorizationSettled and PositionOpened in a single receipt.
>
> Viewing-key export, a documented recovery path and a second client that reads the same notes, so a Sealed balance survives without our frontend.
>
> A live disclosure page reading get_auditor_public_key and get_screener_public_key from the pool, showing users who can read what.
>
> The evidence register and its verification stamp running against mainnet contracts, with documentation checked against deployed state by script.

**Amount**: $11,000
**Completion date**: December 19, 2026

### Milestone 2

**Name**: Composable private spend, externally reviewed

**Deliverables**

> A private swap inside settlement on Starknet mainnet through the STRK20 Ekubo route: one transaction sells a shielded asset and pays a merchant in another, hash published.
>
> Yield on shielded balances through a live Starknet lending venue on mainnet.
>
> Private payment requests on mainnet: a link, a QR code and an invoice with an expiry, settled from a shielded note with amount and counterparty kept private.
>
> A viewing-key scoped disclosure artifact, so a counterparty or accountant can verify one payment without seeing the rest of the account.
>
> An external security audit of the anonymizer contracts, completed and published in full.
>
> A cohort report on Sealed's first 50 mainnet accounts: completed shields and private actions, two-month repeat use, and Sealed's contribution to the STRK20 anonymity set, every figure traceable to on-chain events.
>
> A published STRK20 integration guide with working code, on the Starknet community forum and awesome-strk20.

**Amount**: $14,000
**Completion date**: March 31, 2027

---

## Past work and grants

**Track record**

> Sealed is the best picture of how we work. In three weeks during the STRK20 Private Sprint we wrote and deployed eight Cairo contracts, shipped a 22-route app, landed four mainnet transactions through the canonical pool, and on 2 October added the first private send on mainnet and settled card payments from shielded value on Sepolia. sealed.cash has been live since 2026-08-29 and we've kept shipping since the sprint closed: a full redesign, a verifier that stamps the evidence page on every run, and bug fixes found by our own audits.
>
> It's all public under Apache 2.0 at github.com/kamalbuilds/neobank, and every number on the site links to a transaction.
>
> Before Sealed, Kamal built at Ionic Money and Kaia and has a long run of hackathon builds and wins across ecosystems.

**Other Starknet grant programs**

> This is our first Starknet Foundation grant application. We came to Starknet through the STRK20 Private Sprint.

**Other grants**

> None. Sealed has been fully bootstrapped.

---

## Collaboration and support

**Starknet collaborations**

> StarkWare and the STRK20 team. Sealed is a consumer surface on their pool and pushes on the privacy SDK and Wallet API early, especially the shadow-account path coming in Wallet API 0.10.4. Working directly with them gets those features to users faster.
>
> Ready, the wallet that runs the privacy Wallet API today. Their users are exactly our audience, and an in-wallet entry point to Sealed would serve both of us.
>
> Ekubo, now that private swaps are live on STRK20. Sealed puts that route inside card settlement, a new use of their liquidity they don't have to build.
>
> Vesu, or whichever Starknet lending venue fits best, as the mainnet home for yield on shielded balances, with the yield staying in their protocol and the privacy in ours.
>
> Xenia, who are building private payment links. One shared link format that several products speak is better for users than incompatible ones, and we'd love to work on it together.
>
> Payroll and treasury tools on Starknet that want to offer private disbursement.

**Extra support**

> Introductions to the STRK20 and Ready teams would move us fastest.
>
> Recommendations on auditors the Foundation trusts for Cairo privacy contracts, ahead of our Milestone 2 audit.
>
> And a conversation with the Foundation on private spending: paying merchants straight from shielded value, with no issuer in the middle. It's the model we're taking to mainnet, and the Foundation's view on it would help us get it right.

---

## Other details

**Source license**: Open Source (Apache 2.0)
**How did you hear about this program**: Starkware
**Referral**: STRK20 Private Sprint, run by StarkWare's STRK20 team
