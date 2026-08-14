# Claude context pack (must be in every code prompt)

Grok research lives in `docs/research/` and the two plans. A Claude session that only gets "build the app" will invent the wrong API. Paste this pack, then name the files to read.

## Product

Private money account on the live STRK20 pool. Not a bank. Not a mixer. Not a Visa that spends a shielded note.

Floor: Ready connect, shield, private send to a registered recipient, receive QR/link, unshield, honest labels.
Stretch: AVNU private swap from an already-shielded balance, paymaster key server-side only.
Cut from sprint: statement PDF, Vesu, payroll, card, shadow accounts.

## Hard rules

- App code only. Never generate Cairo anonymizers.
- Dapp never touches viewing keys.
- No mocks, stubs, TODO, fake receipts, DEMO amounts, echo helper.
- Capability: `compareVersions(v, "0.10") >= 0`. Never gate at `0.10.3`. Never probe `strk20Balances` to feature-detect.
- Pins: `starknet@10.4.0` exact, get-starknet `6.0.4`, types-js `0.10.3` with npm overrides.
- Pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- Fee: read `get_fee_amount` at runtime. Live 6 STRK at the last mainnet read. Public STRK from `tx.caller`. Self-submit leaks. Paymaster-relayed only.
- Deposit is approve then private deposit. Notes mature ~10 blocks. Never bundle deposit + spend.
- History reads pool Deposit event topic1, never `tx.sender` (that is the relayer).
- Recipient must already be registered. Dapp cannot register them.
- Deposit screening is onchain. Surface as screening, not a bug.
- AVNU `takerAddress` must not be sent on the public quote. That rebuilds quoteId -> user.
- No em dashes. No prize amounts. No Co-Authored-By.

## Read these files

1. `STRK20_INTEGRATION_PLAN.md`
2. `docs/PRODUCTION_BUILD_PLAN.md`
3. `docs/research/claude-wallet-api.md`
4. `docs/research/claude-first-party-defi.md`
5. `docs/research/claude-starter-kit.md`
6. `docs/JUDGE_PASS_2026-08-14.md` if present
7. Matching source under `src/app/`

## Card (not sprint)

A Visa cannot debit a STRK20 note. Path is unshield / CardSettle to an issuer funding address, then a real BIN. Ready Card died because issuer **Kulipa** wound down (also killed Solflare Card, July 2026). Do not rebuild on Kulipa.

Candidates to re-verify before any card code: Stripe Issuing + Bridge (non-custodial preview), Gnosis Pay Safe, Rain (Visa principal, custody/program), Reap. BlankCard (`altaga/BlankCard`) is a Noir anti-cloning circuit on Base, not an issuer.

## Memory

This machine's durable memory is `~/brain` + `gbrain`, not supermemory. `claude-mem` is installed for Claude Code session observations. Research files in this repo are the ground truth for this project. Do not rely on a previous Claude session having seen them.
