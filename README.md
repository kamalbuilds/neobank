# Sealed

A private money account on Starknet. Hold, send, spend and earn on the live STRK20 pool without
publishing your salary or your net worth.

Live: [sealed.cash](https://sealed.cash) · Evidence: [sealed.cash/docs/evidence](https://sealed.cash/docs/evidence) · Per-surface status: [sealed.cash/docs/status](https://sealed.cash/docs/status)

Non-custodial. Not a licensed bank, not a mixer. The dapp never holds a viewing key; Ready does the
proving.

## What is private, what is not

| Private | Public |
|---|---|
| Who paid whom, and the size of a private transfer | Deposit and withdrawal amounts |
| The owner's shielded book | That an address touched the pool, and when |
| Statement detail without the viewing key | Screening decision on deposit |
| | Open-note fill amounts on DeFi |

## What runs today

Every row below is a transaction hash you can open, not a description of intent. Network is stated
on every row because it is the difference between a claim and a demo.

| Capability | Network | Proof |
|---|---|---|
| Shield and hold | **mainnet** | Four pool transactions, all SUCCEEDED. [`0x04c4bea0…9193`](https://voyager.online/tx/0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193) is the first shield |
| A swipe settles from shielded value | sepolia | [`0x1f815361…fe5df`](https://sepolia.voyager.online/tx/0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df) block 14,130,415. Sells shielded STRK and pays the merchant in USDC in one transaction |
| Dinner paid and a lending position opened, atomically | sepolia | [`0x4d94fa79…2639`](https://sepolia.voyager.online/tx/0x4d94fa79724d3e997604e4a42a54daab3cc68f4ec17672b3ca9644a843e2639) block 14,109,923. Pool withdrew 10.24 STRK: 0.24 to the merchant, 10 into the vault. `AuthorizationSettled` and `PositionOpened` in one receipt |
| The same dinner paid by redeeming vault shares | sepolia | [`0x45b8c5d7…f0e0`](https://sepolia.voyager.online/tx/0x45b8c5d7a7cae0a9f98d69e92c1120c0bee831e68f9795fde00e1f3ffa3f0e0) block 14,111,945. `PositionRedeemed` plus `AuthorizationSettled`; vault `total_assets` 10 STRK to 0 |
| Funding in from Base over CCTP V2 | sepolia | [`0x28b053d9…11fe2`](https://sepolia.voyager.online/tx/0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2) block 14,139,603. Bridged USDC lands and shields in the same flow |
| Viewing-key scoped statements | sepolia | `GET /api/card/statement?authorizationId=…&full=1` returns the settlement and the lend. Without the key it omits amounts |
| Repeat swipes do not link | sepolia, partial | [`0x48ccd889…cc111b`](https://sepolia.voyager.online/tx/0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b) block 14,130,089. One shadow spend settled through a per-merchant identity |

Contracts deployed for this, all on Sepolia: `CardSettlementAnonymizer`, `CardProgramAnonymizer`,
`ProgrammableSpendAnonymizer`, `PrivateSpendAnonymizer`, `PrivatePayoutAnonymizer`, `EarnVault`,
`EarnAdapter`, JIT converter. Addresses and the file each value comes from are in
[`src/lib/evidence.ts`](src/lib/evidence.ts) and [`strk20.json`](strk20.json).

## The honest boundary

**There is no Visa BIN here, and no issuer.** No issuer debits a STRK20 note: Visa authorizes in
about two seconds against a public liquid balance, and a note is encrypted and needs a proof. What
is live is a settlement path that pays a merchant out of shielded value, with card policy (per-swipe
cap, daily cap, blocked categories) enforced in a contract rather than in a dashboard. Calling that
a card number would invite someone to type it into a checkout where it would fail.

**Mainnet has deposits only so far.** The four mainnet transactions are pool registrations and
shields. No unshield and no private send has been run on mainnet, and none is claimed. The code path
for both is real and exercised on Sepolia. The mainnet blocker is public STRK for the 6 STRK pool
fee plus wallet buffer, not missing code.

Reasoning behind the card position, including why third-party no-KYC virtual cards are rejected on
evidence: [`docs/CARD_LAST_MILE.md`](docs/CARD_LAST_MILE.md).

## Run

```bash
npm install
npm run dev
```

Connect Ready. Private actions appear only when the wallet advertises Wallet API `>= 0.10`
(`compareVersions` against `"0.10"`). Shielding is two wallet prompts, approve then deposit. Notes
mature in about 10 blocks. A private send needs a recipient already registered in the pool.

## Verify the claims

Nothing above is taken on trust. Three gates, each hitting a live RPC or the live site:

```bash
npm run verify:claim       # every mainnet tx exists, succeeded, and carries a pool event
npm run verify:evidence    # every hash and address on the evidence page, checked against chain
npm run verify:deployment  # all 22 routes on sealed.cash return 200, demo video probed with ffprobe
```

`verify:claim` fails the submission unless each listed hash exists, succeeded, and carries a pool
event.

## How it talks to STRK20

- Wallet API via `WalletAccountV6` (`starknet@10.4.0`, get-starknet `6.0.4`).
- Canonical mainnet pool: [`0x040337b1…812a`](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a)
- History reads the pool `Deposit` event first indexed key, never `tx.sender`.
- Live pool fee is read from `get_fee_amount` at runtime, never hardcoded. It was 6 STRK at the last
  mainnet read.

Integration plan: [`STRK20_INTEGRATION_PLAN.md`](STRK20_INTEGRATION_PLAN.md). Production judgment:
[`docs/PRODUCTION_BUILD_PLAN.md`](docs/PRODUCTION_BUILD_PLAN.md).

## Known gaps

| Gap | State |
|---|---|
| Mainnet unshield and private send | Not run. Needs public STRK past the 6 STRK pool fee. Exercised on Sepolia |
| AVNU private swap | Server route needs `AVNU_PAYMASTER_API_KEY`. Not set on this deployment; `/api/avnu/status` returns `{"configured":false}` and the Swap tab degrades with a 503 |
| Shadow spend identities | One settled transaction. Marked PARTIAL on the status page rather than LIVE |
| Vesu | Not on mainnet. The published class hash is undeclared there |
| Mainnet contracts | None. Every contract this project deployed is on Sepolia, recorded under `sepolia_contracts` |

`npm run typecheck` and `npm run build` pass.

## License

Apache-2.0.
