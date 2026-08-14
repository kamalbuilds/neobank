# Salvage: demand and competitor landscape

Date fetched: 2026-08-14.
Agent: `gsd-researcher` `019fff91-1c89-7f20-9712-7c6f994a69c3`.
Status: cancelled after 416s on turn 1, 14 tool results, no dossier. Earlier than the nine long hangs. Mid-flight only.

Prompt asked for a blank-seed competitive landscape (do not start from STRK20). Agent probed live sites and a few dashboards, then was cancelled.

## What landed

HTTP probes of privacy and neobank homepages (agent's own table):

| URL | HTTP | Note |
|---|---|---|
| https://www.railgun.org/ | 200 | live |
| https://aztec.network/ | 200 | live |
| https://privacypools.com/ | 200 | live |
| https://hinkal.pro/ | 200 | live |
| https://umbra.cash/ | 000 | did not resolve in that probe |
| https://www.zcashcommunity.com/ | 200 | live |
| https://getzashi.com/ | 000 | did not resolve in that probe |
| https://namada.net/ | 200 | live |
| https://penumbra.zone/ | 200 | live |
| https://scrt.network/ | 200 | live |
| https://www.midnight.network/ | 429 | Vercel checkpoint |
| https://www.aleo.org/ | 200 | live |
| https://www.ether.fi/ | 200 | live |
| https://gnosispay.com/ | 200 | live |
| https://www.kast.xyz/ | 200 | live |

`getready.com` was in the probe list (wrong Ready domain). Our Ready is https://www.ready.co/.

## Sourced snippets

### Aztec Connect is dead (historical)

https://docs.aztec.network/aztec_connect_sunset

Aztec Connect no longer developed. Sequencer stopped accepting deposits 21 March 2023. Withdrawals through 31 March 2024. Later Aztec Labs incident post: admin roles revoked, upgrade authority renounced. This is not a 2026 private-payments competitor. Do not build on Connect.

### Railgun is the live Ethereum private-balance analogue

https://l2beat.com/privacy/projects/railgun

L2BEAT: onchain privacy, encrypted UTXO-style private balances, zk-proven DeFi. Snapshot in the fetch: about 70M USD TVL across WETH, USDC, USDT, DAI, WBTC, others. DefiLlama page in the same fetch showed a higher TVL figure. Treat both as third-party dashboards; do not freeze a number into the product.

Railgun is Ethereum. It is not our pool and not a card issuer.

### Public-wallet cards have volume

https://paymentscan.xyz/cards/etherfi

EtherFi Cash: Paymentscan series Nov 2024 to Aug 2026. Secondary analytics. Describes Rain infrastructure and self-custodial wallet spend plus Borrow Mode. This is the demand for public crypto cards, not demand for private notes.

https://thedefiant.io/news/tradfi-and-fintech/crypto-card-volume-hits-748-7m-in-july-a-fifth-straight-monthly-gain-paymentscan

The Defiant / Paymentscan industry volume piece. Opened, not extracted. UNVERIFIED detail.

### Hinkal positioning

https://stablecoininsider.org/privacy-as-table-stakes/ (2026-07-28)

Interview with Hinkal CEO: public ledgers block institutional stablecoin settlement. Hinkal claims private stablecoin volume. This is wallet-to-wallet privacy, not a card. See hinkal.md.

## Not finished

- Demand writeup (who pays for private balances vs who pays for a Visa sticker).
- Competitor kill list with sources (Railgun, Aztec Network 2026, Privacy Pools, Umbra, Nocturne, ether.fi, Kast, Gnosis Pay, Avici, Bleap, Xapo).
- HN / Reddit sentiment. Queries were queued (Algolia) but not synthesized.

## Fit for this repo

Blank-seed still lands on the same product: private money account (notes), not a public-wallet card clone and not a mixer. Card remains a later last mile after unshield.
