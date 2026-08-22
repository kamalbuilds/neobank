# Progress

Updated: 2026-08-23. Deadline 2026-08-31 23:59 UTC, 8 days.

**Gate: NOT SCOREABLE.** The panel needs three mainnet transactions that each emitted a pool
event, plus a demo video. We have two qualifying transactions and no video. Verified by
`npm run verify:claim`. Nothing else in this file matters until that line reads SCOREABLE.

## Now

| Item | State | Evidence |
|---|---|---|
| Shield STRK and USDC on mainnet | DONE | `0x04c4bea0...`, `0x059eb6c1...`, 4 and 3 pool events |
| Wallet capability gate | DONE | `tests/capability.test.ts`, 6 pass |
| Claim verifier CLI | DONE | `npm run verify:claim`; wrong pool address reddens all rows |
| `strk20.json` schema fix | DONE | object form scored zero on the hub scanner, now hash strings |
| Pool activity panel | DONE | 2 entries for our wallet, 14.2s against 85.8s sequential |
| Batched multi-recipient send | DONE | `tests/batch-parse.test.ts`; one pool fee per call, not per recipient |
| Private payment requests | DONE | `tests/payment-request.test.ts`; amount, memo, expiry in URL |
| Anonymizer action builders | DONE | `tests/anonymizer-actions.test.ts`, 9 pass, 2 mutations reddened |
| `PrivatePayoutAnonymizer` Cairo | DONE, NOT DEPLOYED | `snforge test` 4 pass; removing `ZERO_RECIPIENT` reddens 1 |
| Sepolia support | DONE, UNVERIFIED | pool and RPC verified by hand; no wallet run yet |
| Unshield | DONE, UNVERIFIED | code path real, never executed on any network |
| Private send | DONE, UNVERIFIED | needs a second registered wallet |
| AVNU private swap | BLOCKED | key now in `.env`, not on the deployment |
| **Programmable spend** | **NOT BUILT** | claimed as the differentiator in `docs/marketing/POSITIONING.md` and `INTERVIEW-ANSWERS.md`. Action builder exists, no contract does pay-plus-position-plus-reshield, nothing calls it |
| Payroll channels, income statement | NOT BUILT | Phase 1 in `docs/PRODUCTION_BUILD_PLAN.md` |
| Privacy Bridge, EVM in and out | NOT BUILT | Phase 1 |
| Org admin session key | NOT BUILT | Phase 1 |
| Demo video | NOT BUILT | required to be scored |

## Blocked

| Item | Blocked on | Who can clear it |
|---|---|---|
| Third pool transaction | ~6 STRK for the live fee. Wallet holds 6.846 STRK, about $0.19 | user only, money and signature |
| Private send on mainnet | a second Ready wallet, registered by one shield | user only |
| AVNU swap live | `AVNU_PAYMASTER_API_KEY` on the Vercel deployment | user only, deploy |
| RPC env vars reaching the browser | rename to `NEXT_PUBLIC_MAINNET_RPC` / `NEXT_PUBLIC_TESTNET_RPC` | user only, `.env` |

## Known defects

- `src/app/page.tsx:167` still says "unshield to a public USDC balance and take it to an issuer".
  Old framing, contradicted by `docs/CARD_LAST_MILE.md`. First screen anyone sees.
- Marketing docs lead with programmable spend, which is NOT BUILT. Either build it or cut the
  claim before the StarkWare call. Do not say that line on camera until one of those is done.
- Pool size and TVL figures disagree across four sources. UNVERIFIED, unpublished.

## Verified 2026-08-23

- 76 unit tests, 8 files, pass
- 4 Cairo tests via `snforge`, pass
- `npx tsc --noEmit` clean
- App boots, `HTTP 200`, zero console exceptions, graceful degradation with no wallet installed
- Sepolia pool `get_fee_amount` returns 2 STRK; mainnet returns 6 STRK

Blind spot: every mainnet claim above rests on two shield transactions from one wallet. No
unshield, private send, swap, or anonymizer call has ever executed on any network.
