# Independent discovery log

Date: 2026-08-14
Objective (artifact-independent): design a production private money product people would actually use daily, that can generate revenue, and that grows a shared privacy anonymity set.

User URLs and STRK20 names were validation seeds, not the first map.

## Method

Blank-seed queries first, then official STRK20 / RFP validation, then GitHub, X, Reddit/HN snippets, papers, issuer docs.

Tools: web_search, web_fetch, browse_page, X semantic + keyword search, gh CLI, spawn_subagent (explore + general-purpose + gsd-researcher).

last30days engine: configured (`SETUP_COMPLETE=true`) but not run this turn (5+ min engine). Social bar met via X + Reddit/HN search, not via last30days synthesis.

## Seed queries (blank first)

- private crypto neobank 2026
- privacy preserving stablecoin payments payroll remittance
- shielded wallet DeFi confidential transfers 2026
- Railgun Aztec Privacy Pools Tornado Cash alternatives 2026
- private perps trading Hyperliquid privacy wallet
- crypto privacy compliance selective disclosure KYC 2026
- NEAR Intents cross-chain private execution TEE wallet
- Rain Reap Bridge crypto card issuer API non-custodial 2026
- Hinkal Pay volume private stablecoin 2026

## Official / validation URLs (full-text read)

1. https://strk20.starknet.io/rfp/private-crypto-neobank
2. https://strk20.starknet.io/rfp
3. https://strk20.starknet.io/build
4. https://strk20.starknet.io/hackathon
5. https://strk20.starknet.io/llms.txt
6. https://strk20-by-example.org/llms.txt
7. https://strk20-by-example.org/what-is-strk20.md
8. https://strk20-by-example.org/compliance.md
9. https://strk20-by-example.org/helpers/privacy-invoke.md
10. https://strk20-by-example.org/builder-privacy-overview.md
11. https://strk20-by-example.org/starknet-wallet-api/overview.md
12. https://strk20-by-example.org/sdk/getting-started.md
13. https://strk20-by-example.org/helpers/vesu-lending-helper.md
14. https://strk20.starknet.io/rfp/private-payroll
15. https://strk20.starknet.io/rfp/private-pumpfun
16. https://strk20.starknet.io/rfp/chain-abstracted-private-execution
17. https://strk20.starknet.io/rfp/universal-private-payment-rail
18. https://strk20.starknet.io/rfp/privacy-wallet
19. https://strk20.starknet.io/rfp/private-yield-account
20. https://strk20.starknet.io/rfp/private-cross-chain-bridge
21. https://strk20.starknet.io/rfp/cross-chain-privacy-hub
22. https://strk20.starknet.io/rfp/private-subscriptions
23. https://eprint.iacr.org/2026/474
24. https://docs.avnu.fi/docs/privacy
25. https://docs.avnu.fi/docs/privacy/private-swap
26. https://github.com/starkware-libs/starknet-privacy
27. https://github.com/starkware-libs/starknet-privacy/blob/main/sdk/README.md
28. https://github.com/starkware-libs/privacy-bridge
29. https://github.com/Akashneelesh/awesome-strk20
30. https://github.com/Akashneelesh/strk20-starter-kit
31. https://www.near.org/blog/how-confidential-intents-works
32. https://intents.near.org/
33. https://www.bridge.xyz/product/cards
34. https://www.rain.xyz/
35. https://aleo.org/post/stablecoin-privacy/
36. https://www.canton.network/private-stablecoin-payments-on-public-blockchain
37. https://insights4vc.substack.com/p/privacy-trends-for-2026
38. https://insights4vc.substack.com/p/the-state-of-stablecoin-cards
39. https://hinkal.io/blog/top-5-privacy-solutions-for-stablecoin-payments-in-2026
40. https://polygon.technology/blog/private-payments-are-live-on-polygon
41. https://panteracapital.com/building-permissionless-neobanks/
42. https://www.xverse.app/blog/best-onchain-neobanks-2026
43. https://baltex.io/blog/ecosystem/tornado-cash-alternatives-ethereum-privacy-2026
44. https://www.altrady.com/blog/cryptocurrency/railgun-privacy-protocol-guide-2026
45. https://solana.com/docs/tokens/extensions/confidential-transfer
46. https://proof.starknet.io
47. https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a

## Social

X (semantic + keyword, 2026-08 window):
- @Starknet STRK20 launch thread (2026-03-10)
- @hieuvueth pool stats 2026-08-14: ~34 assets, ~$890K shielded, ~7.4M STRK privately staked
- @StarkWareLtd Private Sprint announcement 2026-08-13
- @onlyonealexia consumer-privacy explainer
- @Ceri_Watt / @vauban_tech agent receipts on STRK20

Reddit / HN (search + snippets, not full last30days engine):
- https://www.reddit.com/r/ethereum/comments/1e7j8d4/solutions_for_privacy_that_are_not_sanctioned/
- https://www.reddit.com/r/Monero/comments/1gf3gkk/railgun_vs_monero/
- https://www.reddit.com/r/CryptoCurrency/comments/1sqmwry/what_happened_to_the_anonymous_part_of_crypto/
- https://news.ycombinator.com/item?id=48642699 (Crypto in 2026)
- https://news.ycombinator.com/item?id=46706001 (payment automation / Request)

## Papers / reports

- eprint 2026/474: Scalable Compliant Privacy on Starknet (Goldberg et al., StarkWare)
- insights4vc Privacy Trends 2026
- Grant Thornton crypto compliance 2026 / GENIUS Act notes (via card-issuer research)

## GitHub inspected beyond README

- starkware-libs/starknet-privacy (pool, SDK 0.14.3-rc.5, Vesu/Ekubo/shadow anonymizers, OZ audit 2026-05-29)
- starkware-libs/privacy-bridge (0.1.19, CCTP inbound/outbound)
- Akashneelesh/awesome-strk20 (PoCs + honesty that payroll/KYC/Polymarket repos are not public)
- Akashneelesh/strk20-starter-kit (Wallet API demo, echo helper)
- Code search: `privacy_invoke` in cairo (official helpers + PhilippeR26 + community)

## Failures / route-arounds

- jina.ai blocked (AS9009) for eprint PDF and some Starknet blogs
- strk20.starknet.io `*.md` mirrors 404 on RFP slugs; used HTML routes
- Reddit JSON blocked by network security
- gbrain query returned empty for STRK20
- last30days engine not invoked this turn
- gsd-researcher still running at write time; card + GitHub agents completed

## Org scan addendum (same day)

Full inventory: `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md`.

Additional URLs read:
- https://github.com/orgs/starkware-libs/repositories
- https://github.com/orgs/starknet-edu/repositories
- https://github.com/starkware-libs/earn-contracts
- https://github.com/starkware-libs/starknet-payments
- https://github.com/starkware-libs/strkBTC
- https://github.com/starkware-libs/usdc-migration
- https://github.com/starkware-libs/Seamless-2FA-Wallet
- https://github.com/starkware-libs/starknet-perpetual
- https://github.com/starkware-libs/starknet-specs (wallet-api 0.10.4-rc.1)
- https://github.com/starkware-libs/starknet-privacy/tree/main/client
- https://github.com/starknet-edu/starknet-privacy-toolkit
- https://github.com/starknet-edu/starknet-privy-demo
- npm `@starknet-io/types-js@0.10.3` and `@0.10.4-beta.2`

## Gaps still open

- Full eprint PDF body (abstract only)
- Live pool TVL / note count from Voyager (community X figure used, not independently re-indexed)
- Rain/Bridge sandbox access (docs gated)
- StarkWare internal Google doc (user-linked; not fetched: may be auth-gated)
- Beam identifier product (RFP names Beam; Eco Beam vs STRK20 Beam not the same thing)
