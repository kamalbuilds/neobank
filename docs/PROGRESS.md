# Progress

Updated: 2026-08-26. Deadline 2026-08-31 23:59 UTC.

**Gate: NOT SCOREABLE.** Mainnet still has two qualifying pool events and no demo video.
`npm run verify:claim` is the check. The Sepolia card loop below does not change that.

## Now

| Item | State | Evidence |
|---|---|---|
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
| Second live demo authorize | 2 STRK pool fee plus 0.5 STRK settlement from the hosted account | operator, money |

## Known defects

- Vault tabs do not preview their panel until a wallet is connected. Spend/Send copy is hidden behind the connect wall.
- Marketing docs still disagree with the card-loop architecture. Fix the docs or stop quoting them.
- Pool size and TVL figures disagree across four sources. UNVERIFIED, unpublished.

## Verified 2026-08-26

- 113 vitest tests pass
- `npx tsc --noEmit` clean
- GET `/api/card/status/settlements` returned the live 0.5 STRK receipt
- GET `/api/card/authorize` ready=true with no missing env
- `/card` in deepsurge at 1470x820: Runtime Ready, four probes Healthy, 0.5 STRK feed, tx link to Voyager
- Settlement parser mutation: `keys[0]` red, `keys[1]` green

Blind spot: this session did not fire a second live authorization, did not re-run Cairo tests, and did not verify `/card` at a 375 viewport.
