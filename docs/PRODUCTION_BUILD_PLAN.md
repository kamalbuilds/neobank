# Production plan: private money account on STRK20

Status: Phase 0 in progress, 2026-08-14. Three real mainnet txs live from one Ready wallet
(`0x0101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a`, logged in `strk20.json`):
deploy account, shield 0.1 STRK, shield 0.2 USDC in (0.0395 USDC shielded after the pool's
privacy fee). Unshield, private send, and AVNU private swap are still blocked, each for a real
reason and not a fixture: unshield needs more public STRK in the demo wallet past the live 6 STRK
pool fee plus Ready's buffer; private send needs a second Ready wallet already registered in the
pool; AVNU swap needs `AVNU_PAYMASTER_API_KEY` set on the live deployment (`/api/avnu/status`
answers `configured: false`). No fourth transaction exists and none is claimed. Do not start
Phase 1 until Phase 0's floor items are closed and this plan is approved.

This is not a licensed bank and not a mixer. It is a non-custodial private money account: hold, send, earn, disclose, later spend. The RFP card is the last mile, not the first ship.

## Verdict on the three gates

| Gate | Verdict |
|---|---|
| People will use it / you would use it | Yes, if the loop is payday → shield → send/earn without publishing salary or net worth. Not if it is a dashboard or a fake card. |
| Real revenue | Yes: yield spread, private swap take, payroll/payouts take, later card interchange. Not from sprint prize money. |
| Scale the ecosystem | Yes: every shield grows the shared STRK20 anonymity set. Community-reported ~$890K / ~34 assets as of 2026-08-14 is UNVERIFIED (single X source, not re-indexed). Index Deposit events before that number appears in public copy. |

## What we are not building (kill list)

- A Visa that spends a shielded note at POS. No issuer does this. Ready's own card is currently unavailable (issuer wind-down).
- Private Hyperliquid as v0. Hyperliquid has no production private-position API. TEE + API-wallet copy is a 6-month product, not a 17-day one.
- A private Pump.fun as the company. Revenue exists. Daily use for a founder does not. Screening + memecoin culture is a compliance collision.
- A "superapp" that is wallet + launchpad + perps + card in one first release. That fails the 10-second action test.
- Any mock issuer, fake yield, or replayed mainnet receipts.

## Exact user and loop

- User: a crypto-native worker or founder paid in USDC/STRK who does not want colleagues, copy-traders, or the public chain to size their income or book.
- Open trigger: payday landed, or they need to pay someone, or they are about to spend.
- 10-second action: connect Ready, shield incoming USDC, or send a private payment link.
- Return: next payday, next contractor payout, next yield claim.
- Invite: send a receive link to a teammate who already has Ready and has registered on the pool. The dapp cannot register them.
- Live proof: a pre-matured shield (Voyager link) plus a private send on stage. Optional stretch: AVNU private swap. Notes mature ~10 blocks, so a 90-second shield-then-spend either waits or bundles and leaks. No statement PDF in the sprint: 0.10.3 has no disclosure artifact, only a consented `strk20Balances` number.
- Primitive others cannot copy cheaply: live STRK20 pool + anonymizers + CCTP privacy bridge + onchain deposit screening + selective disclosure.
- Lose condition: anonymity set stays tiny, or the card is theater, or we leak by bundling deposit + spend.

## Hidden vs visible (be honest in the product)

| Private inside the pool | Public onchain |
|---|---|
| Who paid whom, transfer amounts, token type of private transfers | Deposit and withdrawal amounts |
| Owner of open notes | Filled amount of open notes (DeFi output) |
| Viewing-key ledger | That an address interacted with the pool, and when; screening decision on deposit |

Anonymizers hide the user address. App-side amounts can stay public. Shadow accounts hide the wallet link: the SDK path works now; the Wallet API path is specified in `wallet_rpc.json` **v0.10.4-rc.1** (2026-08-13) and in `@starknet-io/types-js@0.10.4-beta.2` as `wallet_strk20ShadowAccountCommitment` + `shadow_account_invoke`. Stable types-js is still **0.10.3** (no shadow). Ready/Xverse support for 0.10.4 is unverified. Phase 0 stays on 0.10.3 actions only.

Never bundle a public deposit with the private spend it funds.

## Integration route

Mixed, and this is the correct split:

- Consumer app: Privacy Wallet API via `starknet@10.4.0` and get-starknet `6.0.4`. Ready today. Xverse in-wallet live, dapp API in progress. The app never sees a viewing key.
- Protocol actions we own (payroll, card settlement, recurring payouts): our anonymizer contracts + Wallet API. Team writes, reviews, audits, deploys. Reference: `packages/vesu_lending_anonymizer`, `packages/ekubo_swap_anonymizer`.
- Funding from EVM: Privacy Bridge (`@starkware-libs/starknet-privacy-bridge` 0.1.x). Early. Read its README before pinning.
- Advanced backend / org treasury that we operate: Privacy SDK `@starkware-libs/starknet-privacy-sdk` 0.14.3-rc.5 on GitHub Packages. Node >= 24. Viewing key only if we own the account.
- EVM users who will not install Ready: `earn-contracts` `Eth712Account` + `AccountFactory` (deterministic Starknet account from an Ethereum address, EIP-712 signatures) plus `@starkware-libs/starknet-privacy-client` `Eip712CallSetSigner`. Early (client 0.1.0). This is the RFP's "sign with MetaMask" path, already used by the Earn portal.
- Watch, do not pin yet: `client/` (`createPrivacyClient`, `resolveShadowAccounts`, `AvnuPaymaster`). Under active development.

Pinned live pool (awesome-strk20 / skill): `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`.

Do **not** use `starknet-edu/starknet-privacy-toolkit` (Tongo + Noir/Garaga). That is a different privacy pool with its own mainnet USDC contract. Not STRK20.

## Production architecture

```
User (Ready / Xverse)  OR  EVM wallet -> earn-contracts Eth712Account
  -> Wallet API 0.10.3 (Phase 0) / 0.10.4 shadow when wallets ship it
  -> STRK20 pool (encrypted notes)
       |-- AVNU executePrivateSwap (no custom anonymizer)
       |-- Vesu lending anonymizer (yield)
       |-- our Payroll helper (batch private disbursement)
       |-- our Payout helper (identifier / invoice)
       |-- our CardSettle helper (phase 2: unshield to issuer funding address)
  -> Privacy Bridge (EVM USDC in/out over CCTP)
  -> AVNU paymaster (sponsored_private; API key server-side only)

Card (phase 2 only):
  unshield / CardSettle -> USDC on Solana or EVM
    -> Bridge+Stripe JIT, or Gnosis Pay Safe, or Rain program
    -> Visa/Mastercard
```

Server holds: paymaster key, optional discovery URL, optional statement signer. Never user viewing keys for consumer wallets.

History, rewards, and analytics must read the pool `Deposit` event first indexed key, never `tx.sender` (that is the relayer).

## Constraints that will break a naive build

1. Notes mature ~10 blocks. The prover reads finalized state. Sequence private txs or the next proof fails.
2. SDK package is on GitHub Packages, not npmjs. Token required even for public packages.
3. Version drift: SDK 0.14.3-rc.5, bridge-core 0.1.19 still on older SDK/starknet pins. Align before combining.
4. Open notes leak output amounts. Extra private transfer after DeFi if amount must stay hidden.
5. Deposit screening is onchain from v0.14.3. Self-hosted proving does not bypass it.
6. Anonymity set is small today. Product copy must not claim "untraceable" or "bank-grade anonymity."
7. Paymaster API key is server-side. Browser dapps split fee + submit.

## Phase 0 (sprint, through 2026-08-31)

Ship a mainnet private money account. Three real txs. Public repo. `strk20.json`. Demo anyone can open.

Floor (must work):

1. Connect Ready. Detect wallet API with `compareVersions` against `"0.10"`. Degrade honestly if missing or below. Do not gate at 0.10.3: a spec-legal `"0.10"` string would hide every private action.
2. Shield USDC or STRK (do not bundle with the next action). Fund and confirm a mainnet deposit a week before any stage demo.
3. Private transfer to a second Ready wallet that is already registered. Receive via QR / payment link. Unregistered recipient is a pending state, not a silent fail.

Stretch: AVNU private swap from an already-shielded balance. Every private op is paymaster-relayed (`sponsored_private`). Self-submit is a privacy leak (public STRK fee from the user). Paymaster key stays on a rate-limited server route, never in the browser. Vesu is not on mainnet: class `0x3751128d...` is undeclared there (error 28). Off every dated phase.

Cut from the floor: viewing-key income statement PDF, payroll, card, shadow accounts, Madu, Eth712.

Start from `Akashneelesh/strk20-starter-kit` commit `187fe78`. Replace the echo helper and DEMO amounts. Do not ship the echo contract as the product.

Demo wallet is burned for correlation. Do not fund it from a CEX withdrawal tied to a real identity. Do not reuse it for real money.

Sprint entry: one PR to the sprint registry. Nothing else to submit. Whatever the repo shows on Aug 31 counts.

## Phase 1 (incubator, ~8 weeks)

1. Privacy Bridge: EVM USDC in, unlinkable EVM out.
2. Payroll helper: batched (payer, recipient) channels. Aggregate spend public or auditor-visible. Per-recipient encrypted. Recipient income statement via viewing key.
3. Recurring payouts / invoices (subscriptions RFP, stripped to contractors first).
4. Org admin: session key scoped to one payroll cycle budget.
5. Book the STRK20 team call (adiiHQ / Cal.com) with the live mainnet loop, not a deck.

## Phase 2 (6 months, real neobank last mile)

1. Card only after an issuer contract: Bridge+Stripe JIT (documented non-custodial pull), or Gnosis Pay Safe, or Rain if we accept program custody.
2. Policy: unshield to a prefunded standing issuer funding address (wallet, Safe, or reserve contract, per issuer), topped up ahead of expected spend, not rotated per auth. No candidate (Stripe+Bridge, Gnosis Pay, Rain) documents fresh-address-per-auth; see `docs/research/issuer-options.md`. Never imply the merchant cannot see the card or the issuer cannot see KYC.
3. Cross-chain execution later (NEAR Confidential Intents, private pump / HL) as separate surfaces on the same account. Do not block the money account on them.

## Revenue (production, not sprint)

| Line | When | Mechanism |
|---|---|---|
| Yield spread | Phase 0/1 | Vesu (and later other vaults) on idle shielded stables |
| Swap take | Phase 0/1 | Referral / overlay on AVNU private swap |
| Payroll / payouts | Phase 1 | bps on disbursed volume or per-seat |
| FX / remittance | Phase 1 | spread on bridge out |
| Card interchange | Phase 2 | issuer share, after a real BIN |

## Competitor honesty

| Product | What it actually is | Why we are not them |
|---|---|---|
| ether.fi Cash / Kast / Ready card | Spend from a public wallet | Holdings and history are public. Ready card is currently down. |
| Gnosis Pay | Self-custodial Visa on a public Safe | Best self-custody card. No shielded book. |
| Hinkal Pay | Private stables on EVM / Solana / Tron / Polygon | Proven demand. Wallet-to-wallet, not a Starknet account + DeFi + card path. |
| Railgun | EVM shielded DeFi | Closest protocol analogue. Not Starknet composability, not this pool. |
| Aztec Connect | Dead bridge into Aztec | Sunset. Do not copy. |
| Houdini | Private cross-chain, operator-trusted | Demand proof. We use a verifiable pool + CCTP anonymizers. |
| NEAR Confidential Intents | Cross-chain confidential execution | Complementary later, not the account. |
| Toku / Request | Payroll compliance | Compose, do not rebuild HR/tax. |

## Team tags (public chat, not DMs)

- @Lyskey engagement
- @adiiHQ product
- @starkience debugging
- @akashneelesh privacy stack

## Manual check after Phase 0

1. Ready connected, privacy API detected.
2. Shield on mainnet. Voyager shows pool Deposit for your address (topic1), not a unique sender.
3. Wait maturity. Private send. Recipient sees note via their wallet.
4. AVNU private swap or Vesu deposit. Open-note amount may be public; owner hidden.
5. Non-Ready wallet: UI degrades, no crash.
6. No viewing key in repo, logs, or env committed.
