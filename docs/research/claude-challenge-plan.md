# Adversarial challenge: STRK20 private money account plan

Date: 2026-08-14. Reviewer: Claude, hostile pass. Scope: `STRK20_INTEGRATION_PLAN.md`, `docs/PRODUCTION_BUILD_PLAN.md`, `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md`, checked against the skill's own `references/concepts.md` and `references/wallet-api-route.md` and against the repo working tree.

Repo state at review time: zero code. No `package.json`, no `src`, no lockfile, no CI. Three markdown files and a skill. Everything below is therefore a plan defect, not a code defect.

Findings are ordered by severity. Each names the exact line of the plan it breaks.

---

## BLOCKERS

**1. The 90-second demo is arithmetically impossible as written.**
`PRODUCTION_BUILD_PLAN.md:30` promises "90-second proof: three mainnet txs (shield, private send, Vesu deposit or AVNU private swap)". The skill's own gotcha list says notes mature ~10 blocks after creation, and `STRK20_INTEGRATION_PLAN.md:49` repeats it. Ten Starknet mainnet blocks is minutes, not seconds. The only way to compress it is to bundle the deposit into the spending transaction, which `concepts.md` says publishes "this address put in X" next to the transfer it funded. So the demo either takes far longer than 90 seconds or it leaks the exact thing the product sells.
The plan never states the resolution. The honest version is: shield well before the demo, and on stage show private send plus DeFi only, with the earlier shield as a Voyager link. Say that in the plan or the demo dies live.

**2. Private transfer requires the recipient to be registered. The invite loop and payroll both assume otherwise.**
`concepts.md`: "an account must register in the pool (set a viewing key) before it can hold or receive private balances; both sender and recipient must be registered before private transfers between them. Wallets handle registration automatically on first use, dapps don't."
`PRODUCTION_BUILD_PLAN.md:31` sells "Invite: send a receive link to a teammate so they can get paid privately". That teammate must already have installed Ready, opened it on mainnet, and triggered a first pool use before your link works. The dapp cannot register them, cannot check whether they are registered (it holds no viewing key and the 0.10.3 method list has no registration read), and cannot tell the sender why the transfer will fail.
Phase 1 payroll is worse: a batch disbursement to N contractors requires all N pre-registered, and one unregistered recipient fails the batch. `PRODUCTION_BUILD_PLAN.md:115` does not mention this at all.
Required before build: a documented way to determine recipient registration state, or an explicit pending-until-registered UX with funds held by the sender. Neither exists in the plan.

**3. The viewing-key income statement PDF has no implementation path in Phase 0.**
`PRODUCTION_BUILD_PLAN.md:30` puts it in the 90-second proof. But the golden rule is that the dapp never touches a viewing key, and the inventory's own 0.10.3 method list is exactly three methods: `wallet_strk20InvokeTransaction`, `wallet_strk20PrepareInvoke`, `wallet_strk20Balances`. None of them produce a disclosure artifact. `strk20Balances` returns a consented balance snapshot, which is a number, not an income statement, and carries no proof of provenance a counterparty would accept.
Selective disclosure is named as a differentiator in three places (`PRODUCTION_BUILD_PLAN.md:31`, `STRK20_INTEGRATION_PLAN.md:43`, and the compliance section) and is implementable in Phase 0 in exactly zero of them. Either find the wallet-side or SDK-side disclosure API and cite it, or cut the PDF from the sprint scope and stop calling selective disclosure a Phase 0 asset. A PDF the app renders from a consented balance read is statement theater and a judge who knows the stack will say so.

**4. The Vesu path names a class hash, not a deployed address.**
`STRK20_INTEGRATION_PLAN.md:26`: "Vesu reference helper already on mainnet class hash. Wire Wallet API invoke to that deployed helper." A class hash is not callable. The plan pins the pool address to the felt and pins nothing for the Vesu lending anonymizer instance. `PRODUCTION_BUILD_PLAN.md:104` makes "AVNU private swap or Vesu deposit" a Phase 0 must-work item, so one of the two required demo legs currently has no target address.
Also unverified: whether the pool restricts `privacy_invoke` targets to a registered or whitelisted helper set. If it does, a helper you deploy yourself is not callable until it is registered, which changes Phase 3 entry cost materially. Resolve both before the AVNU-or-Vesu choice is made, and prefer AVNU for the sprint since it is first-party and does not need an address you have not found yet.

**5. The public demo publishes the deanonymization ground truth for its own address.**
The sprint deliverable is a public repo plus a demo anyone can open plus three mainnet txs you will point people at. That means the demo address, its deposit amount, its timing, and the fact that the same actor performed all three actions are permanently and publicly linked, by you, on purpose. In a pool holding roughly $890K across roughly 34 assets, a deposit of an unusual amount at a announced time is close to a set of one for that asset in that window.
Consequences the plan does not state: never use the demo wallet for real money afterward; never demo with a round or distinctive amount; never fund the demo wallet directly from a CEX withdrawal tied to a real identity; and expect that any later note spent by that address inherits the correlation. Add this as an explicit demo operating procedure. Right now `PRODUCTION_BUILD_PLAN.md:156` "Manual check after Phase 0" walks the team into it.

---

## HIGH

**6. Version pins contradict each other across the two documents, and neither is safe to install.**
`PRODUCTION_BUILD_PLAN.md:50` says get-starknet 6.0.3. `STRK20_INTEGRATION_PLAN.md:56` says 6.0.4 and calls 6.0.3 stale. Two live plans, two pins, no single source of truth.
Worse, `STRK20_INTEGRATION_PLAN.md:55` pins `starknet` as a range: ">= 10.4.0 is enough" with the justification "10.5+ adds nothing STRK20-specific". That justification is asserted, not evidenced by a changelog read. A range against a package whose relevant releases live on the `next` dist-tag means the lockfile resolves to whatever prerelease is current on install day, and `next` moves. `open items` (line 122) admits `next` versus `latest` is unresolved, which means the plan pins a version it has not decided how to resolve.
The only verified combination in this repo's own skill is `starknet@10.4.0` plus get-starknet 6.0.3, tested 2026-07-13, including the TS2459 subpath-import workaround. 6.0.4 is unverified against that workaround. Pin exact versions, commit the lockfile, and re-run the import check after any bump.

**7. Capability-detection threshold is inconsistent and the comparison is unspecified.**
`wallet-api-route.md` says treat wallet API ">= 0.10" as STRK20-capable. Both plans say ">= 0.10.3" (`STRK20_INTEGRATION_PLAN.md:60`, `PRODUCTION_BUILD_PLAN.md:101`). If Ready advertises `0.10` or `0.10.2`, the plan's gate hides every private action and the demo shows an empty app.
Separately, no plan line says what `supportedWalletApi` returns (string, array of strings, semver range) or how to compare. Naive string comparison ranks "0.10.10" below "0.10.3" and ranks "0.9.0" above "0.10.0". Use a real semver compare, and decide the threshold by reading what Ready actually advertises today, not by picking a number.

**8. Single-wallet dependency with no fallback, on a wallet whose card business is already winding down.**
Ready is the only supported wallet. Xverse's dapp API is "in progress". Braavos and Privy are unsupported. The entire sprint outcome depends on one third party's extension continuing to serve mainnet privacy calls through 2026-08-31. `PRODUCTION_BUILD_PLAN.md:140` already notes the Ready card is down due to an issuer wind-down, which is evidence of pressure on that vendor, not reassurance.
There is no contingency. The SDK route is not a fallback for consumers because the app must never hold a viewing key. Write the contingency down: what the demo shows if Ready's privacy API is broken on demo day. A recorded-run fallback with a Voyager link is legitimate; discovering the gap at 9am is not.

**9. Network and relayer metadata leakage is absent from both hidden/visible tables.**
Both tables (`STRK20_INTEGRATION_PLAN.md:37`, `PRODUCTION_BUILD_PLAN.md:36`) reason only about onchain visibility. For a privacy product, that is half the threat model. Unmodeled channels:
- The relayer that submits private transactions sees the request and the requester's IP. The plans treat the relayer only as "not the user" for attribution purposes and never ask what it observes.
- The RPC provider sees address plus IP plus timing for every read the app makes on the user's behalf.
- The demo's own hosting (Vercel by default) logs IP, user agent, and any wallet address that appears in a path or query parameter. A privacy product that leaks correlation through its own analytics is the easiest possible criticism to make.
Add a metadata row to the honesty table and a rule that no wallet address ever appears in a URL, log line, or analytics event.

**10. Anonymizer usage partitions the anonymity set, and the ecosystem claim ignores this.**
Gate three (`PRODUCTION_BUILD_PLAN.md:13`) says every shield grows the shared set. True for plain shields. But Phase 3 ships team-owned anonymizers (`STRK20_INTEGRATION_PLAN.md:86`), and notes routed through a specific helper contract are distinguishable by that helper. Users of your payroll helper form an identifiable sub-population inside the pool, and a sub-population of size 12 is not protected by a pool of size 890K. This gets worse the more differentiated your helper is.
Nowhere in either document. It should drive a design rule: prefer first-party helpers (AVNU, Vesu) that many apps share over bespoke helpers only your users touch, and only ship a bespoke helper when the flow has no shared alternative. That is the opposite of the current instinct to own the payroll helper early.

**11. Pool fee economics and fee-payment provenance are unresolved, and one answer is a leak.**
The fee is flat and was 4 STRK per private operation. Two live questions the plan never asks:
- Who pays it and from where. If it is paid in public STRK from the user's own account, then every private operation emits a public STRK payment from that address at that moment, which is a timing correlation channel that partly undoes the point. If it comes out of the shielded amount, that is fine. The plan says only "subtract from MAX" (`STRK20_INTEGRATION_PLAN.md:71`), which implicitly assumes the second answer without verifying it.
- What it does to the product. A flat per-operation fee makes small private payments uneconomic, which kills the contractor-payout and subscription stories at low ticket sizes and makes the "shield then transfer separately for unlinkability" guidance cost two fees. The revenue table (`PRODUCTION_BUILD_PLAN.md:128`) never nets this out.

**12. There is no schedule, no cut line, and no owner.**
Phase 0 runs to 2026-08-31, which is 17 days from today, with six must-work items, on mainnet, from an empty repo. No day-by-day plan, no defined minimum shippable subset, no named owner per item, no decision date for the AVNU-versus-Vesu fork. `PRODUCTION_BUILD_PLAN.md:110` asserts "whatever the repo shows on Aug 31 counts" with no citation to sprint rules.
Define the cut line now, in writing: connect plus shield plus private send is the floor; DeFi leg and statement view are the stretch. Then the last-week decision is mechanical instead of panicked.

**13. Paymaster key on a public demo is an unmetered spend surface with no scoped backend.**
`PRODUCTION_BUILD_PLAN.md:81` puts the paymaster key server-side, and constraint 7 notes browser dapps must split fee and submit. That is a backend, and it is nowhere in the architecture beyond one line. No rate limit, no address allowlist, no spend cap, no abuse story, and the demo is explicitly "anyone can open". Anyone who finds the endpoint sponsors their own transactions on your key until it drains.
Scope the route handlers, cap per-address and global daily spend, and log denials. This is a half-day of work and an unbounded loss if skipped.

---

## MEDIUM

**14. Card framing still contains theater, in the architecture diagram if not in the kill list.**
The kill list correctly refuses a Visa that spends a shielded note. Then the architecture diagram (`PRODUCTION_BUILD_PLAN.md:75`) ships a `CardSettle` helper and the revenue table books card interchange, under a product named neobank. The unstated cost: unshielding to an issuer funding address makes the amount and timing of every top-up public and correlates it with the draw on the shielded balance. The card does not merely fail to be private, it actively leaks a periodic signal about the shielded book.
Also `PRODUCTION_BUILD_PLAN.md:122` "unshield to a fresh issuer funding address per auth when possible" is aspirational. Issuers assign funding accounts to a KYC'd cardholder; per-authorization address rotation is not a feature they offer. Do not put it in a plan as policy until an issuer confirms it in writing.

**15. Phase 0 revenue lines are not reachable in Phase 0.**
The revenue table books yield spread and swap take as "Phase 0/1". A yield spread requires routing or aggregating user funds, which requires either custody or a helper the team owns, neither of which exists in Phase 0. An AVNU referral take requires a referral agreement. Phase 0 as scoped earns nothing. Say so; a plan that overstates near-term revenue gets less trust on the parts that are real.

**16. Anonymity-set numbers are single-source and are being used as a gate verdict.**
The roughly $890K and roughly 34 assets figures come from one X account, and `INDEPENDENT_DISCOVERY_2026-08-14.md:139` admits they were not independently re-indexed. `PRODUCTION_BUILD_PLAN.md:13` uses them to answer the ecosystem gate "Yes". Index the pool's Deposit events yourself before the number appears in anything public. If the real set is materially smaller, the honest-labeling copy needs to change, not just the slide.

**17. No indexer, no RPC provider, no event-read plan, but three features need one.**
History, the statement view, and any later rewards must read the pool's `Deposit` event first indexed key. That requires event queries over block ranges against a named mainnet RPC with a key and a rate limit, or an indexer. Neither document names a provider, a key strategy, or a fallback when the range query times out. This is the single most likely source of a silent wrong number in the UI, and the skill flags it precisely because two natural queries fail without throwing.

**18. Starter-kit supply chain is unpinned.**
The plan seeds a money application from a personal third-party repo with no pinned commit SHA, no license check named, and no review step beyond "delete the DEMO amounts and the echo helper". Pin the SHA, read the diff you are importing, and record the license. Repeating "do not ship the echo helper" three times across the plans does not substitute for pinning what you actually copied.

**19. Transaction verification standard is weaker for two of the three demo legs.**
Manual check 2 correctly asserts a Voyager `Deposit` with your address in topic1. Checks 3 and 4 assert only that the recipient "sees the note" and that an open note exists, with no stated onchain post-condition. Combined with the guidance to treat a `waitForTransaction` timeout as "submitted", it is possible to finish the checklist with a transaction that never landed. Define a post-condition per leg that only completion can produce, and treat submitted-but-unconfirmed as a failure of the check, not a pass.

**20. Screening can decline the demo deposit, and there is no pre-flight.**
Deposit screening is enforced onchain and applies to every route. The plan handles this as a UX state, which is right, but there is no step that screens the demo funding source before demo day and no stated recovery if the demo wallet's funding path is declined mid-sprint. Fund the demo wallet early, from a clean source, and confirm a successful mainnet deposit at least a week before you need one on stage.

**21. Types dependency collision between the two pins is unchecked.**
Phase 1 pins `@starknet-io/types-js@0.10.3` while allowing `starknet` from the `next` tag at 10.7.0. If that starknet build already depends transitively on `0.10.4-beta.2`, you get two copies of the types package and structurally incompatible interfaces at the WalletAccount boundary. Check the resolved tree before writing code, not after the first confusing type error.

**22. The two hidden/visible tables disagree.**
`STRK20_INTEGRATION_PLAN.md:43` lists the screening decision on deposit as public. `PRODUCTION_BUILD_PLAN.md:36` omits screening from the table entirely. Pick one canonical table, put it in one file, and have the other reference it. Two tables in two documents will diverge again, and this one is the table you show to users.

**23. Shadow accounts are the feature that makes the product's implicit promise true, and they are gated on someone else.**
Until a wallet ships 0.10.4 methods, the user's Ready address is publicly a pool participant and every non-pool action that address takes is linked to it. A user hearing "private money account" assumes otherwise. The Phase 0 copy needs to say this plainly on screen, not just in a plan appendix. Right now the honest-labeling requirement (`PRODUCTION_BUILD_PLAN.md:106`) is one bullet with no specified wording.

**24. Legal posture is a punt at exactly the point it becomes a gate.**
"Team owns legal" is fine for Phase 0. It is not fine for Phase 1 payroll (handling third-party payroll flows) or Phase 2 card. Jurisdiction and entity decisions have lead times measured in months and gate the issuer conversation that gates the card. If the card is genuinely on the six-month roadmap, the legal decision belongs in Phase 1, not in a footnote.

---

## What I could not verify from this repo

These are open questions, not findings. Each one can turn a MEDIUM above into a BLOCKER.

- Whether the pool fee is drawn from the shielded amount or paid publicly by the user's account (drives finding 11).
- Whether the pool whitelists `privacy_invoke` targets (drives finding 4 and all of Phase 3's cost).
- The deployed mainnet address of the Vesu lending anonymizer.
- The exact string Ready returns from `supportedWalletApi` today.
- Whether the sprint registry requires anything beyond a repo PR.
- Real pool size, independently indexed.

## The one change with the highest leverage

Cut the statement PDF and the DeFi leg from the sprint floor, and spend the recovered days on the two things that actually fail live: recipient registration state (finding 2) and the maturity-versus-demo-timing conflict (finding 1). A working connect, shield, and private send on mainnet, with honest labels and a second real wallet receiving, beats six half-wired features. The current plan has six must-work Phase 0 items and no cut line, which is how sprints end with nothing demoable.

CLAUDE_SESSION_DONE challenge
