# Fully Programmable Private money account to spend from the pvt pool

Hold and send on the live STRK20 pool without publishing salary or net worth. Yield is planned, not in this repo.

First mainnet shield is live: [`0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193`](https://voyager.online/tx/0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193).

This is a non-custodial Starknet app. It is not a licensed bank and not a mixer. The dapp never holds a viewing key. Ready does the proving.

## What is private, what is not

| Private | Public |
|---|---|
| Who paid whom, and the size of a private transfer | Deposit and withdrawal amounts |
| The owner's shielded book | That an address touched the pool, and when |
| | Screening decision on deposit |
| | Open-note fill amounts on DeFi |

A Visa that spends a shielded note is not in v0. No issuer does that.

## Sprint floor

1. Connect Ready. Detect Wallet API with `compareVersions` against `"0.10"`.
2. Shield USDC or STRK (deploy account, then deposit). Two wallet prompts: approve, then deposit. Notes mature about 10 blocks.
3. Private send to a second Ready wallet that is already registered.
4. Receive by QR or link, to a registered pool address.
5. Unshield back to a public balance.

Card is later, not in this repo.

Stretch: AVNU private swap from an already-shielded balance, paymaster-relayed only. Self-submit publishes a public STRK fee from the user on every private op. Live pool fee is read from `get_fee_amount` (6 STRK at the last mainnet read).

Vesu is not on mainnet. The published class hash is undeclared there.

## How it talks to STRK20

- Wallet API via `WalletAccountV6` (`starknet@10.4.0`, get-starknet `6.0.4`).
- Canonical pool: [`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a)
- History reads the pool `Deposit` event first indexed key, never `tx.sender`.

Plan: [`STRK20_INTEGRATION_PLAN.md`](STRK20_INTEGRATION_PLAN.md). Production judgment: [`docs/PRODUCTION_BUILD_PLAN.md`](docs/PRODUCTION_BUILD_PLAN.md).

## Run

```bash
npm install
npm run dev
```

Connect Ready. Private actions appear only when the wallet advertises Wallet API `>= 0.10`. Shielding is two wallet prompts (approve, then deposit). Notes mature about 10 blocks. A private send needs a recipient already registered in the pool.

## Status, for a judge opening the demo

Public demo: https://sealed.cash

Four mainnet transactions, each one an `apply_actions` on the pool
`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`. Private
transactions are relayed, so the on-chain sender is a relayer; the account each
one belongs to is the `user_addr` on its pool events, listed here.

| Live on mainnet | Pool account | Pool events | Tx |
|---|---|---|---|
| Register the viewing key and shield 0.1 STRK, 6 STRK deposited to cover the pool fee | [`0x0101ab74…6a4a`](https://voyager.online/contract/0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a) | ViewingKeySet, Deposit, EncNoteCreated, Withdrawal | [`0x04c4bea0…9193`](https://voyager.online/tx/0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193) |
| Shield 0.2 USDC, 0.0395 left after the pool fee | [`0x0101ab74…6a4a`](https://voyager.online/contract/0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a) | Deposit, EncNoteCreated, Withdrawal | [`0x059eb6c1…586e`](https://voyager.online/tx/0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e) |
| Enable private tokens on a second account: 8 STRK deposited, 6 to the pool fee, 2 shielded | [`0x00801e71…c9e1`](https://voyager.online/contract/0x0801e718e9f717a066fbaad4f71d3f244b2254e6119fca4cf3904daa47cc9e1) | ViewingKeySet, Deposit, EncNoteCreated, Withdrawal | [`0xe08fd329…0294`](https://voyager.online/tx/0xe08fd329091b483978c64f93288b7346b158e0dc485fd7c5f594899f0294) |
| Enable private tokens on the owner account: 6 STRK deposited, all of it the pool fee, so nothing is shielded and no note is created | [`0x071c62df…494d`](https://voyager.online/contract/0x071c62dfb692c3821a9ef120919f388b4559cb2d414c7378da62e6bf7f4f494d) | ViewingKeySet, Deposit, Withdrawal | [`0x428d5947…9578`](https://voyager.online/tx/0x428d5947280d2c670162aa7a3d666bcaa4d5256e016fab460c1b7a560609578) |

All four are logged in [`strk20.json`](strk20.json) and re-checked against the
chain by `npm run verify:claim`, which fails the submission unless each hash
exists, succeeded, and carries a pool event.

The account deploy `0x02cbfccea…a735` also succeeded on mainnet and is not in
that list: it emits no pool event, so it does not count toward the sprint's
three-transaction bar. It stays recorded in `strk20.json` notes as part of the
first-shield flow.

| Blocked, not shipped | Why |
|---|---|
| Unshield | The live pool fee is 6 STRK, paid in public STRK plus whatever buffer Ready needs. The demo wallet does not hold enough public STRK past that fee. Code path is real and untested past that point. |
| Private send | No longer blocked on a recipient: `0x00801e71…c9e1` and `0x071c62df…494d` are both registered in the mainnet pool, checked with `get_public_key`. Blocked on a run: the sending account holds 0.1 shielded STRK and nobody has pressed Send on mainnet, so no transfer tx exists to point at. |
| AVNU private swap | Server route needs `AVNU_PAYMASTER_API_KEY`. Not set on this deployment; `/api/avnu/status` returns `configured: false` and the Swap tab degrades honestly with a 503. |

No unshield or private send tx exists yet, and none is claimed here. Card is later, not in this repo. `npm run typecheck` and `npm run build` pass.

## License

Apache-2.0.
