# Win conditions: STRK20 Private Sprint

Brief: https://strk20.starknet.io/rfp/private-crypto-neobank
Sprint: https://github.com/starkience/strk20-hackathon (August 14 to September 7, 2026)
Written 2026-08-31, revised 2026-09-05. Values, not prose. Anything I cannot
evidence is marked UNVERIFIED with what would settle it, rather than guessed.

    Scoreboard: UNVERIFIED for this sprint, first cohort, no prior winners. Registry of every competing entry is starkience/strk20-hackathon registry.json; a study of their shipped features is running 2026-09-05. Nearest shipped comparables and the asset each owns: Gnosis Pay (Visa issuer licence + Monerium EMI), ether.fi Cash (custody + card BIN), Kast (BIN + LATAM distribution). None owns a privacy-pool integration.
    Bar to beat: the panel scores at least 3 mainnet transactions that touched the STRK20 pool and, if contracts were deployed, ran through one of ours, plus a 3-minute demo video, read from strk20.json. We have 4 mainnet pool transactions as of 2026-09-07 and 0 through our own contracts on mainnet. The hub reads `contracts` as ours whatever network it is on, so listing the Sepolia deployments scored all four as verified_txs 0; they now sit under `sepolia_contracts` and the entry is judged on the pool alone, which is the documented route for a project that deployed nothing on mainnet. `npm run verify:claim` reports 4 of 3, SCOREABLE. The bar that decides the category is still 1 mainnet private card settlement, which no entry has.
    Asset we will own: the mainnet proof-relay settlement path, Starkscan STRK20 prover to screened attestation to apply_actions to card settlement in one transaction. Client is built (src/server/prover/starkscan.ts) and has no caller yet. STARKSCAN_API_KEY is present in .env as of 2026-09-05 (value never logged). Prove scope is now VERIFIED, not inferred: POST /v1/SN_MAIN/prove with that key returned 202 and job prv_cbb8e59e7a97df5a1d3647de8e80 on 2026-09-07 20:56 UTC, so the scope gate passes at submit. That job went terminal `unavailable` with `prover_unavailable` from the relay, which is what a deliberately invalid transaction body earns and is not evidence that a valid one would prove. A real proof is still unproduced. 2 of 8 Cairo classes are declared on mainnet.
    Off-platform buyer: a contractor invoicing in USDC who does not want each client reading their whole book. Already self-custodies, already spends on a crypto card; today those two facts link every invoice to every purchase.
    Single entry: Sealed (sealed.cash). One product, no second submission.
    Verb the brief names: "hold", "send", "spend", "earn" (a "private crypto neobank"). Repo one-liner: "Hold, send, and earn on STRK20 without publishing salary or net worth."
    Our product performs that verb: partly. HOLD yes on mainnet (0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193, Accepted on L1). SPEND yes on Sepolia (0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df, Accepted on L1), no on mainnet: prove scope is granted but no proof has been produced, the prover client has no caller, and 6 of 8 classes are undeclared on mainnet. EARN yes on Sepolia (EarnVault 1:1 ERC-4626, 10 STRK lent in the same transaction as the settlement, no yield). SEND no, needs a second registered pool recipient.
    Metric plan: mainnet transactions exercising a verb, counted in strk20.json, checkable on voyager.online. 4 as of 2026-09-07, all HOLD-side pool actions; the 5th, a mainnet card settlement through our own contracts, did not land. Money left for it: 15.5 STRK on 0x071c62...494d and 5.12 STRK on the deployer 0x0801e7...c9e1, against ~6 STRK to declare PrivateSpendAnonymizer, ~3.6 to deploy, and a 6 STRK pool fee per apply_actions.
    Live by: sealed.cash has been live since 2026-08-29, 9 days before the 2026-09-07 deadline; the 7-day runway line is met. The 2026-08-31 date in the first draft of this file was wrong.
    Deviation from research: two. Card settlement was Phase 3 in STRK20_INTEGRATION_PLAN.md and was pulled forward because it is the only verb no competitor performs. The plan named AVNU as the sprint DeFi leg and Vesu as unverified; we shipped our own EarnVault, which pays no yield, and the video and thread say so.

## The verb test, applied honestly

The rule that lost BuildX: the brief names a verb, and read-only entries scored
zero because every winner executed. This brief names four verbs. We execute
three on Sepolia and one on mainnet. The gap that decides the category is SPEND
on mainnet through our own contracts, which needs a prove-scoped submit plus
the remaining six mainnet declares. The API key line is now in .env.

## Not claimed

- No mainnet card settlement exists yet. 2 of 8 classes are declared on mainnet;
  declared is not deployed and no instance has a mainnet address.
- The fourth mainnet transaction registered a viewing key and paid the 6 STRK
  pool fee out of the same 6 STRK deposit, so `0x071c62...494d` holds a private
  balance of zero. It is a HOLD-side registration, not a private payment.
- Prove scope is accepted at submit. No proof has been produced, so the
  Starkscan prover path is unexercised end to end.
- The card runs against Lithic's issuer sandbox, not a live card program.
- The EarnVault pays no yield. Vesu is not integrated.
