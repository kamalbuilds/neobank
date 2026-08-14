# Private money account

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

Public demo: https://neobank-six.vercel.app
Wallet used for the mainnet runs: [`0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a`](https://voyager.online/contract/0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a)

| Live on mainnet | Tx |
|---|---|
| Connect Ready, capability gate | no tx |
| Deploy account | [`0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735`](https://voyager.online/tx/0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735) |
| Shield 0.1 STRK | [`0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193`](https://voyager.online/tx/0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193) |
| Shield 0.2 USDC in, 0.0395 USDC shielded after the pool's privacy fee | [`0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e`](https://voyager.online/tx/0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e) |

All three are logged in [`strk20.json`](strk20.json).

| Blocked, not shipped | Why |
|---|---|
| Unshield | The live pool fee is 6 STRK, paid in public STRK plus whatever buffer Ready needs. The demo wallet does not hold enough public STRK past that fee. Code path is real and untested past that point. |
| Private send | Needs a second Ready wallet already registered in the pool as the recipient. Only one wallet has been run so far. |
| AVNU private swap | Server route needs `AVNU_PAYMASTER_API_KEY`. Not set on this deployment; `/api/avnu/status` returns `configured: false` and the Swap tab degrades honestly with a 503. |

No unshield or private send tx exists yet, and none is claimed here. Card is later, not in this repo. `npm run typecheck` and `npm run build` pass.

## License

Apache-2.0.
