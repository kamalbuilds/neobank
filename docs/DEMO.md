# Judge demo, 90 seconds

Live URL: https://neobank-six.vercel.app

## Script

1. **Open the app.** (5s) Land on the connect screen.
2. **Connect Ready.** (10s) Click connect, approve in Ready. Wallet address and network show.
3. **Show the capability gate.** (15s) Point out the wallet API version check: the app reads
   Ready's supported wallet API and only unlocks the STRK20 panels above `0.10`. Say this is a
   real feature gate, not a cosmetic banner.
4. **Show the balances strip.** (15s) Public STRK/USDC are live reads. Shielded balances appear
   only after the user clicks Reveal. Say these are not fixtures.
5. **Show the three mainnet txs.** (30s) Open Voyager on the three transactions logged in
   `strk20.json`, all from the same Ready wallet:
   - Deploy account: `0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735`
   - Shield 0.1 STRK, 6 STRK pool fee: `0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193`
   - Shield 0.2 USDC in, 0.0395 USDC shielded after the pool's privacy fee: `0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e`
6. **Say what is blocked, and why.** (15s)
   - Unshield is blocked: MAX unshields the full note, and the pool fee (6 STRK, read live from
     `get_fee_amount`) plus buffer is paid in public STRK, which this wallet does not hold past
     that fee yet.
   - Private send needs a second Ready wallet already registered in the pool as the recipient;
     only one wallet has been run through the app so far.
   - Swap needs an AVNU paymaster key on the deployment; without it `/api/avnu/status` answers
     `configured: false` and the Swap tab shows that honestly.

## Notes for the judge

- All three transactions above are real, `ACCEPTED_ON_L2` on mainnet, and are the only
  transactions this wallet has submitted. No fourth transaction exists and none is claimed.
- Unshield and private send have not succeeded on mainnet; the code paths are real and exercised
  up to the point each is blocked.
