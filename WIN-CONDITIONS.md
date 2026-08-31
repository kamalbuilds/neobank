# Win conditions: STRK20 Private Sprint

Brief: https://strk20.starknet.io/rfp/private-crypto-neobank
Written 2026-08-31. Values, not prose. Anything I cannot evidence is marked
UNVERIFIED with what would settle it, rather than filled with a guess.

    Scoreboard: UNVERIFIED, first cohort of this sprint, no prior winners. Nearest shipped comparables and the asset each owns: Gnosis Pay (Visa issuer licence + Monerium EMI), ether.fi Cash (custody + card BIN), Kast (BIN + LATAM distribution). None owns a privacy-pool integration. Usage numbers not read this pass.
    Bar to beat: 3 mainnet STRK20 pool transactions (logged in strk20.json). The bar that decides the category is 1 mainnet private card settlement, which no entry and no shipped product has.
    Asset we will own: the mainnet proof-relay settlement path, Starkscan STRK20 prover to screened attestation to apply_actions to card settlement in one transaction. Obtained via an operator-issued Starkscan prove-scope key plus our 8 Cairo contracts, 2 already declared on mainnet.
    Off-platform buyer: a contractor invoicing in USDC who does not want each client reading their whole book. Already self-custodies, already spends on a crypto card; today those two facts link every invoice to every purchase.
    Single entry: Sealed (sealed.cash). One product, no second submission.
    Verb the brief names: "hold", "send", "spend", "earn" (a "private crypto neobank"). Repo one-liner: "Hold, send, and earn on STRK20 without publishing salary or net worth."
    Our product performs that verb: partly. HOLD yes on mainnet (0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193, Accepted on L1). SPEND yes on Sepolia (0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df, Accepted on L1) and no on mainnet, blocked on prover access which unblocks today. EARN yes on Sepolia (EarnVault 1:1 ERC-4626, 10 STRK lent in the same transaction as the settlement, no yield). SEND no, needs a second registered pool recipient.
    Metric plan: mainnet transactions exercising a verb, counted in strk20.json, checkable on voyager.online. Today 3, target 5 by deadline including 1 mainnet card settlement.
    Live by: MISSED. The gate wants 7 days of runway and the deadline is today, 2026-08-31 23:59 UTC. sealed.cash went live 2026-08-29. Recorded as failed rather than massaged.
    Deviation from research: two. Card settlement was Phase 3 in STRK20_INTEGRATION_PLAN.md and was pulled forward because it is the only verb no competitor performs. The plan named AVNU as the sprint DeFi leg and Vesu as unverified; we shipped our own EarnVault, which pays no yield, and the video and thread say so.

## The verb test, applied honestly

The rule that lost BuildX: the brief names a verb, and read-only entries scored
zero because every winner executed. This brief names four verbs. We execute
three on Sepolia and one on mainnet. The gap that decides the category is SPEND
on mainnet, which needed the prover relay that only became available today.

## Not claimed

- No mainnet card settlement exists yet. 2 of 8 classes are declared on mainnet;
  declared is not deployed and no instance has a mainnet address.
- The card runs against Lithic's issuer sandbox, not a live card program.
- The EarnVault pays no yield.
