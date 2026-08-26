# Progress

Updated: 2026-08-27. Deadline 2026-08-31 23:59 UTC.

**Gate: NOT SCOREABLE.** Mainnet still has two qualifying pool events and no demo video.
`npm run verify:claim` is the check. The Sepolia card loop below does not change that.

## Now

| Item | State | Evidence |
|---|---|---|
| Osteria dinner swipe from the pool | DONE | First settle-only: `0x18d87405...be8a`. Atomic dinner+lend: `0x4d94fa79...2639` block 14109923, ACCEPTED_ON_L2, SUCCEEDED. |
| Earn vault | DONE | New class with `allowance` at `0x076811f2...cda8b` (class `0x779c101f...0d038`). `total_assets` went 0 to 10 STRK on the dinner tx. Old vault `0x00474c6b...68bb` lacked `allowance` and is retired. |
| Atomic private dinner+lend | DONE | Same proof: pool withdrew 10.24 STRK, helper paid 0.24 STRK to `0x071c62...494d`, deposited 10 STRK into the vault, emitted `AuthorizationSettled` and `PositionOpened`, opened a vault-share note. Private STRK notes 18.26 to 8.02. |
| Hosted card authorization loop | DONE | Sepolia tx `0x063b3fe7...88acf4`, ACCEPTED_ON_L1, `AuthorizationSettled` 0.5 STRK to `0x071c62...494d`. `/api/card/status/settlements` returns that receipt. `/card` rendered it in deepsurge. |
| CardSettlementAnonymizer | DONE | Sepolia `0x074dcd5e...5390a`, class `0x0171adb...6d9c5`. Replay map and daily spend read back after the tx. |
| Stripe-compatible authorize API | DONE | `tests/card-authorization.test.ts`, `tests/card-authorize.test.ts`. Tampered HMAC 401. Policy-blocked merchant does not settle. Already-settled id returns confirmed and does not settle twice. |
| /card product route | DONE | Runtime Ready, all four probes Healthy, live 0.5 STRK feed, 500 USD swipe cap from server env. |
| Settlement event parser | DONE | Live event shape test. Using `keys[0]` (selector) instead of `keys[1]` reddened; restore greened. |
| Ready spend path | PARTIAL | Direct STRK20 withdraw, hex amount. Payment-request prefill restored. Not re-executed on chain this session. |
| Programmable spend anonymizer | DONE | Deployed Sepolia `0x0604a76f...cbbb0`. Separate from the card loop. |
| Shield STRK and USDC on mainnet | DONE | `0x04c4bea0...`, `0x059eb6c1...` |
| Stripe Issuing sandbox | NOT BUILT | Webhook schema is Stripe Issuing. No issuer account is wired. Demo button signs locally when `CARD_DEMO_AUTHORIZE=1`. |
| Chain-abstraction / JIT USDC | NOT BUILT | First proof settles test STRK. USDC conversion is the next slice. |
| Demo video | NOT BUILT | required to be scored |

## Blocked

| Item | Blocked on | Who can clear it |
|---|---|---|
| Third mainnet pool transaction | live STRK for the pool fee plus a demo video | user only, money and recording |
| Real issuer sandbox | Stripe Issuing or Lithic credentials | user only, account |

## Known defects

- Vault tabs do not preview their panel until a wallet is connected. Spend/Send copy is hidden behind the connect wall.
- Marketing docs still disagree with the card-loop architecture. Fix the docs or stop quoting them.
- Pool size and TVL figures disagree across four sources. UNVERIFIED, unpublished.

## Verified 2026-08-27

- EarnVault `allowance` call on the retired class reverted `entrypoint does not exist`. Same call on `0x076811f2...cda8b` returned 0.
- Vault `total_assets` 0 before the swipe, 10 STRK after. Recipient STRK rose by 0.24. Daily spend on CardProgram is 0.24.
- Voyager receipt for `0x4d94fa79...2639`: `AuthorizationSettled`, `PositionOpened`, pool `Withdrawal` 10.24, `OpenNoteDeposited`.
- `POST /api/card/demo-authorize?wait=1` returned confirmed, ACCEPTED_ON_L2, settle 0.24, lend 10.
- Card Cairo tests 10/10 (8 program + 2 vault). 31 vitest card tests green.

Blind spot: ACCEPTED_ON_L2, not L1. `card:balance` only lists STRK notes, not the new vault-share note. Stripe Issuing is still unsigned. Mainnet remains not scoreable.

## Verified 2026-08-26

- 113 vitest tests pass
- `npx tsc --noEmit` clean
- GET `/api/card/status/settlements` returned the live 0.5 STRK receipt
- GET `/api/card/authorize` ready=true with no missing env
- `/card` in deepsurge at 1470x820: Runtime Ready, four probes Healthy, 0.5 STRK feed, tx link to Voyager
- Settlement parser mutation: `keys[0]` red, `keys[1]` green

Blind spot: this session did not fire a second live authorization, did not re-run Cairo tests, and did not verify `/card` at a 375 viewport.
