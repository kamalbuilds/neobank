# Win conditions: STRK20 Private Sprint

Brief: https://strk20.starknet.io/rfp/private-crypto-neobank
Sprint: https://github.com/starkience/strk20-hackathon (August 14 to September 7, 2026)
Written 2026-08-31, revised 2026-09-05. Values, not prose. Anything I cannot
evidence is marked UNVERIFIED with what would settle it, rather than guessed.

    Scoreboard: UNVERIFIED for this sprint, first cohort, no prior winners. Registry of every competing entry is starkience/strk20-hackathon registry.json; a study of their shipped features is running 2026-09-05. Nearest shipped comparables and the asset each owns: Gnosis Pay (Visa issuer licence + Monerium EMI), ether.fi Cash (custody + card BIN), Kast (BIN + LATAM distribution). None owns a privacy-pool integration.
    Bar to beat: the panel scores at least 3 mainnet transactions that touched the STRK20 pool and, if contracts were deployed, ran through one of ours, plus a 3-minute demo video, read from strk20.json. We have 3 mainnet pool transactions today and 0 through our own contracts on mainnet. The bar that decides the category is 1 mainnet private card settlement, which no entry has.
    Asset we will own: the mainnet proof-relay settlement path, Starkscan STRK20 prover to screened attestation to apply_actions to card settlement in one transaction. Client is built (src/server/prover/starkscan.ts). Needs STARKSCAN_API_KEY in .env, which is NOT present as of 2026-09-05; .env holds a STARKSCAN_ENDPOINT URL only. 2 of 8 Cairo classes are declared on mainnet.
    Off-platform buyer: a contractor invoicing in USDC who does not want each client reading their whole book. Already self-custodies, already spends on a crypto card; today those two facts link every invoice to every purchase.
    Single entry: Sealed (sealed.cash). One product, no second submission.
    Verb the brief names: "hold", "send", "spend", "earn" (a "private crypto neobank"). Repo one-liner: "Hold, send, and earn on STRK20 without publishing salary or net worth."
    Our product performs that verb: partly. HOLD yes on mainnet (0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193, Accepted on L1). SPEND yes on Sepolia (0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df, Accepted on L1), no on mainnet pending the prover key. EARN yes on Sepolia (EarnVault 1:1 ERC-4626, 10 STRK lent in the same transaction as the settlement, no yield). SEND no, needs a second registered pool recipient.
    Metric plan: mainnet transactions exercising a verb, counted in strk20.json, checkable on voyager.online. Today 3, target 5 by 2026-09-07 including 1 mainnet card settlement through our contracts.
    Live by: sealed.cash has been live since 2026-08-29, 9 days before the 2026-09-07 deadline; the 7-day runway line is met. The 2026-08-31 date in the first draft of this file was wrong.
    Deviation from research: two. Card settlement was Phase 3 in STRK20_INTEGRATION_PLAN.md and was pulled forward because it is the only verb no competitor performs. The plan named AVNU as the sprint DeFi leg and Vesu as unverified; we shipped our own EarnVault, which pays no yield, and the video and thread say so.

## The verb test, applied honestly

The rule that lost BuildX: the brief names a verb, and read-only entries scored
zero because every winner executed. This brief names four verbs. We execute
three on Sepolia and one on mainnet. The gap that decides the category is SPEND
on mainnet through our own contracts, which needs the prover key and the
remaining six mainnet declares.

## Not claimed

- No mainnet card settlement exists yet. 2 of 8 classes are declared on mainnet;
  declared is not deployed and no instance has a mainnet address.
- The card runs against Lithic's issuer sandbox, not a live card program.
- The EarnVault pays no yield. Vesu is not integrated.
