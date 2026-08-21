# STRK20 Private Sprint: field scan

Scanned 2026-08-22. Registry `starkience/strk20-hackathon` @ `registry.json`, 122 entries. Deadline 2026-08-31 23:59 UTC, 9 days out.

Method: every repo pulled from the GitHub GraphQL API (repo meta + `HEAD:strk20.json` blob in one pass), then every transaction hash listed by every project independently re-verified against Starknet mainnet over `rpc.starknet.lava.build` and Alchemy's public mainnet endpoint. A hash counts only if the receipt exists, `execution_status == SUCCEEDED`, and the receipt carries an event whose `from_address` is the STRK20 pool `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`. 101 unique hashes checked.

The tx check is not a rubber stamp: of 101 hashes, 82 passed, 7 do not exist on mainnet, 6 are literal placeholders (`0xHASH_1`, `TODO_MAINNET_TX_HASH_1`), and 6 are real successful mainnet txs that never touched the pool. Three of the not-founds resolve on Sepolia, so those teams pasted testnet hashes.

## Headline counts

| Gate | Count | of 122 |
|---|---:|---:|
| Registered entries | 122 | 100% |
| Repo resolves (3 are 404: `Dapperdavidd/Privora`, `builder-of-web3/Alias`, `okhaimie-dev/veil`) | 119 | 98% |
| Has a root `strk20.json` | 100 | 82% |
| Lists >= 3 tx hashes in it | 24 | 20% |
| **>= 3 hashes that verify as successful mainnet pool txs** | **19** | **16%** |
| Has a non-empty `demo_video` value | 7 | 6% |
| `demo_video` that is actually a video (not a placeholder or an app URL) | 3 | 2% |
| Has a demo URL (field or repo Website) | 49 | 40% |
| Demo URL returns HTTP 200 (of 25 probed) | 24 | - |
| **ALL THREE GATES, verified end to end** | **2** | **1.6%** |

The two that are fully scoreable today are **`neromtoobad/doom`** and **`SergioSSantiago/philoxenia`**. Exactly one other project has shot a real video, `obiJohnbosco163/Veilfolio`, and neither of its two hashes exists on mainnet or Sepolia. Every other `demo_video` value in the field is an unedited template string or a link to the app rather than a video.

Read that carefully before treating it as good news. The video is the cheapest gate in the sprint and every serious team will record one in the last 48 hours. The gate that actually filters is **>= 3 verified pool transactions**, and 19 teams clear it. That 19, plus a handful of near-misses with heavy commit history, is the real competitive set. Call it 20 to 25 by Aug 31.

Two more counts worth holding: 79 of 122 repos pushed within the last 3 days, so the field is not as dead as 16% suggests, but 24 have not pushed since Aug 17 and 30 have no license at all (an automatic hit on the 15% docs/OSS weight, and the rules require a license outright).

## The scoreable set

Sorted by verified pool tx count. `vtx` is verified; `listed` is what the file claims.

| # | Project | Repo | vtx | listed | Video | Demo | Cat | Last push | Commits | License | One-liner |
|---:|---|---|---:|---:|:--:|:--:|---|---|---:|---|---|
| 1 | **Aegis Rescue** | `justbiar/aegis` | **7** | 7 | no | live | Tooling | 2026-08-22 | 78 | MIT | Whitehat rescue bot: sweeps exposed on-chain funds into the STRK20 shielded pool before attackers can, returns them to verified GitHub  |
| 2 | **Aperture** | `OoJae/aperture-strk20` | **7** | 7 | no | live | Infra | 2026-08-20 | 38 | MIT | Sealed-ballot governance and a shielded treasury for DAOs, native to STRK20. |
| 3 | **Stealth Checkout** | `bongbongcrypto/stealth-checkout` | **7** | 7 | no | live | Tooling | 2026-08-21 | 27 | MIT | Accept private payments on Starknet: drop-in checkout widget, hosted invoices, webhook confirmations, honest privacy receipts. |
| 4 | **offbook** | `Akinbola247/offbook` | **6** | 6 | no | - | DeFi | 2026-08-18 | 105 | **none** | a private OTC settlement layer for Starknet, Counterparties agree a token-for-token block trade (RFQ), then settle atomically through S |
| 5 | **VeilPay** | `OpenDagri/veilpay` | **6** | 6 | no | - | Payments | 2026-08-19 | 17 | MIT | Private payroll with scoped disclosure. Public can verify a run; only the payee or auditor can open a slice. |
| 6 | **Airlock** | `kenkomu/airlock` | **4** | 4 | no | live | Infra | 2026-08-22 | 69 | MIT | One-click privacy from any chain: bridge in, hold private, withdraw to a different chain with no on-chain link. |
| 7 | **NIGHTSHIFT** | `kshitij-hash/nightshift` | **4** | 10 | no | live | Payments | 2026-08-22 | 44 | Apache-2.0 | Recurring private authorization on the STRK20 pool: subscribe once inside the pool, get charged on schedule without surfacing. |
| 8 | **Doom** | `neromtoobad/doom` | **4** | 4 | YES | live | DeFi | 2026-08-21 | 42 | MIT | A private prediction market on Starknet: visible odds, invisible bettors. Bet sizes and prices are public so the market stays accurate; |
| 9 | **Cutout** | `dmetagame/cutout` | **4** | 4 | no | live | Infra | 2026-08-22 | 17 | Apache-2.0 | A privacy-liquidity router for STRK20. Before you sign, it checks whether your amount has meaningful public cover and routes flexible t |
| 10 | **philoxenia** | `SergioSSantiago/philoxenia` | **3** | 3 | YES | live | Other | 2026-08-20 | 245 | MIT | Private P2P hospitality on Starknet, STRK20 Private Sprint |
| 11 | **Booty Bank** | `welttowelt/booty-bank` | **3** | 3 | no | live | Consumer | 2026-08-18 | 62 | **none** | Private income credentials and credit eligibility for OnlyFans creators on Starknet. |
| 12 | **Crosslink** | `CaptainDiv/crosslink` | **3** | 3 | no | live | Payments | 2026-08-22 | 37 | **none** | Crosslink measures whether a private payment is actually private. StarkWare's bridgeOutToWallet already does unlinkable payout to any a |
| 13 | **MorokPay** | `ssadkov/morok-pay-starknet` | **3** | 3 | no | live | Payments | 2026-08-20 | 34 | MIT | Private USDC treasury on Starknet, funded from Ethereum via CCTP. |
| 14 | **Xence** | `AustinChris1/xence` | **3** | 3 | no | live | Infra | 2026-08-22 | 27 | Apache-2.0 | Proof you were right, before it happened - seal a probabilistic forecast, bond it privately through the STRK20 pool, and let the chain  |
| 15 | **Mirage** | `YanYuanFE/mirage` | **3** | 3 | no | - | Consumer | 2026-08-22 | 24 | MIT | One wallet, every chain, no trace. Shield any ERC-20 on Starknet, exit privately to 35+ chains via NEAR Intents. |
| 16 | **whisperpay** | `bugsm/whisperpay` | **3** | 3 | no | - | Payments | 2026-08-19 | 22 | MIT | One-link private payments on STRK20, with the funding deposit over-shielded so the public leg never states what was paid. |
| 17 | **VeilPay** | `OpenDagri/veilpay` | 6 | Payments | 17 | - | Private payroll with scoped disclosure. Public can verify a run; only the payee or auditor can open a slice. |
| **NIGHTSHIFT** | `kshitij-hash/nightshift` | 4 | Payments | 44 | live | Recurring private authorization on the STRK20 pool: subscribe once inside the pool, get charged on schedule without surf |
| **Booty Bank** | `welttowelt/booty-bank` | 3 | Consumer | 62 | live | Private income credentials and credit eligibility for OnlyFans creators on Starknet. |
| **Crosslink** | `CaptainDiv/crosslink` | 3 | Payments | 37 | live | Crosslink measures whether a private payment is actually private. StarkWare's bridgeOutToWallet already does unlinkable  |
| **MorokPay** | `ssadkov/morok-pay-starknet` | 3 | Payments | 34 | live | Private USDC treasury on Starknet, funded from Ethereum via CCTP. |
| **Mirage** | `YanYuanFE/mirage` | 3 | Consumer | 24 | - | One wallet, every chain, no trace. Shield any ERC-20 on Starknet, exit privately to 35+ chains via NEAR Intents. |
| **whisperpay** | `bugsm/whisperpay` | 3 | Payments | 22 | - | One-link private payments on STRK20, with the funding deposit over-shielded so the public leg never states what was paid |
| **Redpocket** | `kevlau1/redpocket` | 3 | Payments | 21 | live | Password red packets: one link, N shares, each claim lands in a shielded STRK20 balance. |

- **`kshitij-hash/nightshift`** is the closest strategic neighbour: recurring private authorization, 4 contracts, pushed today, Apache-2.0. It is the Payments entry with real contract depth.
- **`YanYuanFE/mirage`** is the closest product neighbour and the most direct threat to our positioning: "one wallet, every chain, no trace", shield any ERC-20 and exit privately to 35+ chains via NEAR Intents. That is our cross-chain exit story with a wider surface. Its weaknesses are a 1.8k README and no demo URL.
- **`ssadkov/morok-pay-starknet`** overlaps our CCTP work exactly: private USDC treasury on Starknet funded from Ethereum via CCTP, 3 verified txs, live demo, MIT.
- **`welttowelt/booty-bank`** is the other Consumer entry with verified txs. Private income credentials and credit eligibility for creators. Sharp, defensible wedge, but no license and stalled since Aug 18.
- **`OpenDagri/veilpay`** has 6 verified txs, the highest in our categories, but a 1.5k README and no demo URL. Payroll, not a personal account: adjacent, not overlapping.
- **`CaptainDiv/crosslink`** is a measurement tool for whether a private payment is actually private, not a competing account product, but it verifies on chain and will read well on innovation.

Note how many Payments teams wrote the identical one-liner: `OpenDagri/veilpay` and `Ololadestephen/paybook` both submitted "Private payroll with scoped disclosure. Public can verify a run; only the payee or auditor can open a slice." verbatim, which is RFP text from IDEAS.md pasted in unchanged. Private payroll is the single most duplicated idea in the sprint (`veilpay`, `zkpayslip`, `paybook`, `shadowledger`, `shadowpay`, `cloakpay`, `Cistern`) and almost none of them have shipped anything on chain.

## Where we stand

`kamalbuilds/neobank` today: `strk20.json` present, 3 hashes listed, **2 verify**, no video, demo live at `neobank-six.vercel.app`, 43 commits, Apache-2.0, **last push Aug 15**. We are in the near-miss table, not the scoreable set. Three specific defects, all cheap:

1. `0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735` is a `deploy_account` and touches no pool contract. It does not count. We need at least one more real pool transaction.
2. Our `transactions` array holds objects (`{hash, kind, network, status}`), not hash strings. The hub scanner reports us at **0 verified** because of this alone, and it is the same mistake that is currently hiding `CaptainDiv/crosslink`'s 3 good txs. This is a one-line fix and it is the highest-leverage edit in the repo.
3. No demo video. Only 3 exist across all 122 entries, so shipping a real one early is disproportionately valuable.

The 7-day push gap is also visible on the hub and reads as abandonment next to eight competitors who pushed today.

---

Blind spots in this scan, stated plainly: it verifies that a hash touched the pool, not that the touching transaction came from the project's own app or its own deployed contract, which the rules also require of teams that deployed contracts. It reads only the default branch. Demo liveness was probed for 25 URLs, not all 49. And it cannot judge the 25% innovation weight or whether any demo actually works, only that it returns HTTP 200.
