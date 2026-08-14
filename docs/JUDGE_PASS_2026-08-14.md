# Judge pass, 2026-08-14

Adversarial review of the STRK20 private money account against `STRK20_INTEGRATION_PLAN.md` and
`docs/PRODUCTION_BUILD_PLAN.md`. Scope: viewing-key / paymaster-key handling, capability gating,
privacy claims, receipt honesty, and the AVNU swap path.

## Verdict

**PASS**, after the fixes applied in this pass.

One real privacy leak was found and fixed (the user's public address was being handed to AVNU's
quote endpoint on the private swap path). Everything else on the hunt list was either already
correct or was an honesty / robustness defect, all of which are now fixed. Two items are left open
because they are policy or deployment decisions, not code defects: no rate limit on the AVNU server
routes, and no wallet account/network change subscription. Neither blocks a demo; the first does
block placing a live paymaster key on a public deployment.

## What was verified live, not just read

| Check | Result |
|---|---|
| `get_fee_amount` on the mainnet pool | `0x53444835ec580000` = **6 STRK**, read at runtime, not hardcoded |
| STRK / USDC constants | symbol `STRK` decimals 18, symbol `USDC` decimals 6, both addresses resolve on mainnet |
| `waitStrk20Transaction` on a real mainnet tx | `confirmed`, real receipt carried: `SUCCEEDED` / `ACCEPTED_ON_L2` / `actual_fee {amount, unit: FRI}` |
| `waitStrk20Transaction` on a nonexistent tx | returned `submitted` at 120,003 ms; the ceiling holds and a timeout is never reported as a failure |
| Capability gate | `["0.10"]` true, `["0.10.3"]` true, `["0.11"]` true, `["0.9"]` false, `[]` false |
| Amount parsing | `12.5` USDC to `12500000`, 7-decimal USDC rejected, zero rejected |
| `/api/avnu/status` with no key | `{"configured":false}` |
| `/api/avnu/fee` and `/api/avnu/submit` with no key | HTTP 503, `AVNU private swap is not configured on this server.` |
| AVNU quote without `takerAddress` (the fixed path) | HTTP 200 with a live quote, `chainId: 0x534e5f4d41494e` |
| Client bundle | no `paymasterApiKey`, no key value, no `process.env.AVNU_*`; the only `AVNU_PAYMASTER_API_KEY` string is the UI copy telling the operator where to put it |
| `npm run typecheck` / `npm run build` | both pass after the changes |

Not exercised, and honestly out of reach without a browser and funded mainnet wallets: any real
shield, private send, unshield, or swap; a screened deposit revert; a real proof through Ready.

## Findings

### Fixed in this pass

**1. Privacy leak, high. `src/app/components/Panels/SwapPanel.tsx`**
The quote request passed `takerAddress: address`, the user's public wallet address, to AVNU's public
quote endpoint from the browser. The private swap then submits that same `quoteId` through AVNU's
paymaster, where the on-chain taker is AVNU's own executor. Handing them `quoteId -> user address`
first rebuilds exactly the link the pool exists to hide, and it is unforced: `takerAddress` is
optional on `QuoteRequest`, and `quoteToCalls({private: true})` overrides the taker with the executor
regardless ("Mutually exclusive with takerAddress" in the SDK types).
Fix: removed from the quote request. It stays in the prover plan, where the SDK uses it as the
in-pool recipient of the `OPEN` note for the bought token; that value never leaves the wallet's
proof. Verified live that quoting without it still returns a quote.

**2. Correctness, medium. `src/app/components/lib/strk20.ts`**
`waitForTransaction` was given `retries: 400` at a 3s interval, roughly 20 minutes, while the
`Promise.race` ceiling was 120s. The losing side kept polling long after the UI moved on, once per
submitted transaction, and the timer was never cleared.
Fix: retry budget now derives from the ceiling, the timer is cleared in `finally`, and the
provider's own exhaustion message is mapped to `submitted` rather than `error` so an unconfirmed
transaction is never reported as a failed one.

**3. Fake receipts, medium. all four panels plus `Panels/ActionResult.tsx`**
Each panel discarded the real receipt and built `{execution_status: "SUCCEEDED" | "REVERTED"}` by
hand, then passed that synthetic object to `receiptToResult`, which is written to read
`finality_status` and `actual_fee`. Every receipt card therefore showed a bare "Succeeded" with no
finality and no fee, derived from an invented object.
Fix: `WaitOutcome` now carries the real RPC receipt and the panels pass it through. Confirmed
against a live mainnet receipt that finality and `actual_fee {amount, unit}` now populate.

**4. Honesty, medium. `Panels/ActionResult.tsx`**
The fee row was labelled "Network fee", implying a cost the user paid. Wallet API 0.10.3 has no
fee-mode argument, so this app cannot know whether the wallet relayed the transaction or
self-submitted it. Relabelled "Network gas (paid by tx sender)", which is true in both cases and
matches the vocabulary already used in the honest table. Formatting also moved off
`Number(fee) / 1e18` onto exact bigint formatting, and the `unit` field now selects STRK or ETH.

**5. Silent failure, medium. all four panels plus `Panels/ActionResult.tsx`**
`classifyStrk20Error` captured the wallet's raw message but no panel ever rendered it, so any error
the matcher did not recognise, including a differently worded "not registered", surfaced as
"Action failed." with nothing else. That is the silent-fail shape the plan explicitly rules out.
Fix: new `walletErrorResult` shows the wallet's own text whenever the kind is `unknown`. The
explicit not-registered card in `SendPanel` is unchanged.

**6. Silent failure, low. `src/app/components/lib/strk20.ts`**
`readPrivateBalance` fell back to `"0x0"` when the balance entry had neither `balance` nor `amount`,
so an unreadable response presented as a real, empty shielded balance and MAX filled 0.
Fix: throws with an actionable message instead.

**7. Missing honest label, medium. `Panels/ShieldPanel.tsx`**
The panel where the user commits the public ERC-20 leg mentioned only the two prompts and note
maturity. It never said the deposit itself is public. The honest table further down the page says
so, but not at the point of action.
Fix: the panel now states that the address, the amount, and the time are visible onchain, and that
what stays private is what happens to the balance afterwards. The amount label on the receipt reads
"(public deposit)".

**8. Stale copy, low. `Panels/ShieldPanel.tsx`**
The pending card read "Confirm the deposit in your wallet, then waiting for confirmation" at a point
where the transaction hash already existed, so the wallet prompt was long done. Now "Deposit
submitted. Waiting for confirmation".

**9. Honesty, low. `Panels/SwapPanel.tsx`**
`FeeRow` sat at "reading…" forever on the Swap tab because the AVNU pool fee is only fetched inside
the submit handler, so the fee was unknowable until after the user authorised the swap. Now the row
says the fee is quoted by the paymaster at submit, and switches to the real number once known.
Fetching it on mount was rejected: it would burn paymaster key quota on every tab open.

**10. Missing guard, low. `Panels/SwapPanel.tsx`**
The SDK's `executePrivateSwap` fails fast when the caller's chain differs from `quote.chainId`,
before the expensive proof. The split flow this app uses drops that check. Re-added, comparing as
felts and skipping the check if either id is unparseable so it can never falsely block a valid swap.
Verified that AVNU returns `chainId` as a hex felt, so the comparison is real, not dead code.

**11. Doc overclaim, low. `README.md`**
The tagline read "Hold, send, and earn". Yield is not in this repo, and the build plan puts Vesu off
every dated phase because the published class hash is undeclared on mainnet. Changed to state that
yield is planned, not shipped. The rest of the README matches the code.

**12. Reproducibility, low. `.gitignore`**
`package-lock.json` was ignored while `package.json` carries caret ranges for `next`,
`@avnu/avnu-sdk`, `ethers`, `qrcode`, `zustand`, and `typescript`. A fresh install on the demo
machine or on a deploy could resolve different versions than the tree that was verified here, with
nothing committed to prevent it. Removed the ignore line so the lockfile can be tracked. It is not
committed by this pass.

### Open, not fixed

**13. Abuse surface, medium. `src/app/api/avnu/fee/route.ts:5`, `src/app/api/avnu/submit/route.ts:26`**
Both routes are unauthenticated public proxies in front of a paid paymaster key: no rate limit, no
origin check, no body size cap. `docs/PRODUCTION_BUILD_PLAN.md:105` requires "a rate-limited server
route". Not fixed here because the correct shape is a deployment decision, not a code detail: an
in-memory limiter is per-instance and near useless on Fluid Compute, so the real answer is a
platform rate limit or WAF rule plus a per-session cap. Fix before the key goes on a public
deployment, not before a local demo.
Nit in the same file: `submit` calls `requireAvnuKey()` before validating the payload, so a
malformed body returns 503 rather than 400 when the key is absent.

**14. Correctness, medium. `src/app/components/client/WalletHandle/SelectWallet.tsx:60`**
Address and chain id are read once at connect and never again. `WalletAccountV6` is constructed with
`accounts[0].address` at that moment. If the user switches account or network inside Ready, the app
keeps the old address: the receive QR and payment link publish a stale address, the unshield default
destination points at the old account, and explorer links can point at the wrong chain. starknet.js
exposes `walletV6.subscribeWalletEvent(wallet, cb)` for exactly this, and `WalletAccountV6.connect`
already calls `standardConnect` internally, which is the priming the wrapper requires before it
bridges those events, so the subscription would work. Not wired here because it cannot be exercised
outside a browser and the invariant is verified, not written. Wire and test it against Ready before
mainnet.

**15. Assumption, note. all Wallet API panels**
Both plans require every private op to be paymaster relayed (`sponsored_private`), on the grounds
that self-submitting publishes a public STRK fee from the user. Wallet API 0.10.3
`strk20InvokeTransaction` takes no fee-mode argument, so the dapp cannot request or verify the
relayed path for shield, send, or unshield. That guarantee lives entirely with the wallet. Only the
AVNU swap path is explicitly `sponsored_private`, because that one goes through the paymaster the
server calls. Worth confirming with Ready and stating in the demo rather than asserting.

## Hunt list, item by item

| # | Item | Result |
|---|---|---|
| 1 | Key leaking to the client | Clean. `AVNU_PAYMASTER_API_KEY` is read only in `api/avnu/key.ts`, never `NEXT_PUBLIC_`, absent from the client bundle. Proving runs in the browser with the user's wallet, fee build and submit run server-side, exactly the split the SDK documents. No viewing key or private key is touched anywhere. |
| 2 | Feature-detect via `strk20Balances` | Clean. Detection is `supportedWalletApi` only. `strk20Balances` is called solely from the unshield MAX button, which is a user-initiated consented read. |
| 3 | Gate at `0.10.3` | Clean. Gate is `compareVersions(v, "0.10") >= 0`, verified to accept the two-part `"0.10"` form. |
| 4 | Hardcoded pool fee | Clean. Read from `get_fee_amount` at runtime, re-read on network change. Live value 6 STRK. |
| 5 | Echo helper / DEMO amounts | Clean. No Cairo in the repo, no DEMO constants, no echo helper. |
| 6 | Claims that unshield or deposit amounts are private | Was partly true for the shield panel, fixed as finding 7. Unshield already said the amount and destination are public. No "untraceable" or "anonymous" copy anywhere. |
| 7 | Bundling deposit and spend | Clean. Every panel submits exactly one action array with one action. |
| 8 | Missing honest labels | Findings 4, 7, 9 fixed. |
| 9 | Stubs, TODO, fake receipts | No TODO or stub anywhere. Fake receipts found and fixed as finding 3. |
| 10 | Recipient-not-registered treated as a silent fail | Explicit card with its own title and copy, and the unclassified case no longer swallows the wallet's text after finding 5. |
| 11 | `waitForTransaction` without a ceiling | Ceiling existed and holds at 120s, verified live. Retry budget tightened as finding 2. |
| 12 | Type or build issues, dead Swap path | `typecheck` and `build` pass. The Swap path is real: `WalletAccountV6.strk20PrepareInvoke` exists in `starknet@10.4.0`, which is what `createStrk20WalletProver` binds to, and the AVNU quote endpoint answers live. |

Also checked: `@starknet-io/types-js` resolves to 0.10.3 everywhere thanks to the override, so no
0.10.4-beta shadow types leak in; `.env` is gitignored; no em dashes; no prize amounts.

## Still user-only

Nothing in this pass can close these.

1. **Ready in a browser.** Every private action, the capability gate against a real wallet, the
   two-prompt deposit, the ~10 block maturity wait, a real proof, and a screened-deposit revert.
2. **Mainnet transactions.** The sprint wants three real ones. The repo has none, and no fixture
   pretends otherwise.
3. **`strk20.json`.** Still `{"transactions": [], "contracts": []}`. It fills in only after real
   mainnet txs exist. Leaving it empty is the honest state.
4. **AVNU key placement.** `AVNU_PAYMASTER_API_KEY` goes in `.env` by hand, from the AVNU portal,
   server-side only. Until then the Swap tab degrades honestly with a 503 and a visible notice,
   which is verified. Address finding 13 before that key is on a public deployment.
5. **Deciding whether the demo wallet is burned for correlation**, per the build plan.
