# Madu payments and Eth712Account: later-phase options, not v0

Date: 2026-08-14.
Status: research only. Do not start Phase 0 work on either path. Do not generate Cairo. Do not scaffold the app from this note.

This document records what [starkware-libs/starknet-payments](https://github.com/starkware-libs/starknet-payments) (Madu) and [starkware-libs/earn-contracts](https://github.com/starkware-libs/earn-contracts) (Eth712Account + AccountFactory) actually are, whether they are deployed, what Eth712 gives a MetaMask user, why a Visa-style card cannot debit a STRK20 shielded note, and what must be true before this repo touches either.

They are later-phase options. Phase 0 stays Ready + Privacy Wallet API on the live STRK20 pool.

## Scope and non-goals

In scope:

- Honest description of Madu from its README, spec, and audit listing.
- Honest description of Eth712Account and AccountFactory from earn-contracts sources.
- How privacy-client 0.1.0 would later let an Eth712 account authorize pool calls.
- Why card spend is an unshield-to-issuer problem, not a note-debit problem.
- Entry criteria copied from the local plans, not invented.

Out of scope:

- Deploying or wrapping Madu.
- Pinning Eth712 class hashes.
- Generating Cairo, factory scripts, or an app scaffold.
- Treating Tongo (`starknet-edu/starknet-privacy-toolkit`) as this pool.
- Inventing mainnet addresses. If a class hash or contract address is not stated in the sources below, it is written **UNVERIFIED**.

## What Madu actually is

Madu is the product name on the spec in `starkware-libs/starknet-payments` (`docs/spec.md` is titled "Madu Payment - Specs."). The repository README calls the same thing "Starknet Payments" and says it "holds the implementation of Staknet Payments contracts" (upstream spelling). The README disclaimer is one sentence: Payments is a work in progress.

It is a signed two-sided order matcher. It is RFQ/OTC settlement on public ERC-20s. It is not Beam (phone/email). It is not a card processor. It is not STRK20. It does not read or spend shielded notes.

The public entry that matters is:

`trade(order_a, order_b, signature_a, signature_b, order_a_actual_sell_amount, order_a_actual_buy_amount)`

Anyone may call `trade`. Each `Order` carries `salt`, `expiry`, `user`, `sell_token`, `buy_token`, `sell_amount`, `buy_amount`, and `allowed_addresses`. The spec requires:

- The contract is not paused.
- Both signatures verify.
- Neither order is expired.
- Both users are on the allowlist and are different addresses.
- Both tokens are registered and are not the same token on one order.
- `order_a.sell_token == order_b.buy_token` and `order_a.buy_token == order_b.sell_token`.
- Each user appears in the counterparty's `allowed_addresses`.
- Actual fill amounts are non-zero, respect remaining `fulfillment[order_hash]`, and do not worsen either side's signed price.
- Fees come out of each side's `sell_token`.

So a fill is a public, allowlisted, registered-token swap between two named Starknet addresses. `TradeExecuted` keys `user_a`, `user_b`, `sell_token`, and `buy_token`, and logs fill amounts and fees. The operator can `cancel_orders`. The app governor registers tokens and allowlist entries. Roles, pause, and replaceability are the usual StarkWare-utils components.

That is useful later as a private-OTC *venue* if we ever wrap `trade` in an anonymizer. It is not a v0 payment rail, and it is not how a card works.

Local inventory use of this repo: "Later private OTC anonymizer."

## Is Madu deployed?

**UNVERIFIED.**

Checked:

- [starkware-libs/starknet-payments README](https://github.com/starkware-libs/starknet-payments/blob/main/README.md): no network, no address, no class hash.
- [docs/spec.md](https://github.com/starkware-libs/starknet-payments/blob/main/docs/spec.md): constructor and methods only. No deployment table.
- Local inventory `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md` lists the same gap: "Is Madu payments deployed?"

Repo timestamps from the 2026-08-14 org scan: last push 2026-07-23. GitHub `updated_at` on the same day as this note is 2026-08-11. That is not a deploy.

There is an audit. `docs/audit/README.md` lists a V0 Release report by [cairosecurityclan](https://cairosecurityclan.com/) on commit [`23e72ca15a0e06e75313675d1d0f5c7727d3e92f`](https://github.com/starkware-libs/starknet-payments/tree/23e72ca15a0e06e75313675d1d0f5c7727d3e92f), dated 30.09.2025, PDF `docs/audit/Starknet_Payments_Audit_Report.pdf`. The audit folder README table text says the reports were "performed on the Starkware Utils library"; the file name is the Payments report. An audit of a WIP contract is not a mainnet address. Do not treat it as a ship signal.

Until a class hash and contract address are stated by StarkWare or verified on a block explorer against that class, write **UNVERIFIED**. Do not guess.

## What Eth712 gives MetaMask users

[starkware-libs/earn-contracts](https://github.com/starkware-libs/earn-contracts) is the Earn portal Cairo workspace (`README`: "earn-backend" / "Earn portal cairo contracts"). Workspace 0.1.0, last push in the inventory 2026-06-28. Members: `contracts`, `eth_712_account`, `account_factory`, `earn_reporter`, `strategy_implementation`, `testing_utils`.

**Eth712Account** (`StarknetEth712Account`) is a Starknet account owned by an Ethereum address. It implements ISRC6 (validate/execute), ISRC9_V2 (execute-from-outside v2), and ISRC5. `__validate__` recovers a secp256k1 signature over an EIP-712 transaction hash. A browser EVM wallet (MetaMask and equivalents) can therefore authorize Starknet calls without Ready, without a Starknet-native key, and without this app becoming an EVM app.

It also exposes `is_custom_signature_valid(calls, signature)`. That check is over an EIP-712 `CallSet { calls }` message and is independent of Starknet tx metadata (version, resource bounds, nonce) so a browser wallet can produce the signature. The interface comments are explicit: it is a stateless predicate with no replay protection. A valid 6-felt signature returns `VALIDATED`; a wrong-but-well-formed signature returns `0`; a malformed signature reverts. The caller must bind replay if it authorizes work off that result.

**AccountFactory** is how that account appears on chain:

- `get_expected_account_address(eth_address)`: deterministic address, deployed or not.
- `get_account(eth_address)`: that address if deployed, otherwise zero.
- `deploy_account(eth_address, signature)`: if missing, deploy a primer at the deterministic salt, replace to the current account class hash, then `initialize(eth_address, signature)`.
- `account_class_hash` / `set_account_class_hash` (app governor).

This is the RFP "sign with MetaMask" path. The production plan says the Earn portal already uses it. That claim is from `docs/PRODUCTION_BUILD_PLAN.md`. This note does not invent a portal URL or a factory address.

What Eth712 does **not** give:

- A way around Ready for v0. Phase 0 users are Ready.
- An EVM privacy pool. The user still ends on Starknet, talking to the STRK20 pool.
- A card. An account is not an issuer.
- A verified mainnet class hash. See the next section.

### Mainnet deployment of Eth712

**UNVERIFIED.**

- earn-contracts README and root `Scarb.toml` state no network, no class hash, no factory address.
- `STRK20_INTEGRATION_PLAN.md` open item: "earn-contracts Eth712Account mainnet class hash if we take that path."
- Inventory gap: "Is earn-contracts Eth712Account deployed on mainnet, and at what class hash?"

Do not copy Privacy Pool / Vesu / Ekubo class hashes from the [starknet-privacy README](https://github.com/starkware-libs/starknet-privacy) compatibility table and label them Eth712. Those are protocol class hashes for a different repo.

### How it would compose with STRK20 later

[starkware-libs/starknet-privacy](https://github.com/starkware-libs/starknet-privacy) `client/` (`@starkware-libs/starknet-privacy-client` 0.1.0) ships `Eip712CallSetSigner` in `client/src/signers/eip712-call-set-signer.ts`. Exports include `Eip712HashSigner`, `Eip712TypedDataSigner`, `callSetTypedData`, `computeCallSet712Hash`, `outsideExecutionTypedData`, `secp256k1SignFn`. The inventory description: this lets an Eth712Account / MetaMask authorize pool invocations.

The same client also has `createPrivacyClient`, `resolveShadowAccounts`, `AvnuPaymaster`, `deriveViewingKey`. It is 0.1.0 and under active development. The integration plan says do not pin 0.1.x for v0. Combining Eth712 + this client + Privacy Bridge is the "one-click privacy from any chain" story. It is a later onboarding path, not the sprint.

## Why a Visa-style card cannot debit a shielded note

A STRK20 note is an encrypted pool note. Spending it is a wallet-mediated private action (Privacy Wallet API or an SDK path that produces a proof). Notes mature about 10 blocks. The consumer app never holds the user's viewing key. The pool, not a card network, is the source of truth for that spend.

A Visa or Mastercard authorization is a public card-network debit against an issuer-controlled funding source (USDC or fiat at a BIN/program). The issuer pulls a visible balance. It does not construct a STRK20 proof. It does not wait for note maturity. It does not talk to `wallet_strk20InvokeTransaction`.

`docs/PRODUCTION_BUILD_PLAN.md` kill list: "A Visa that spends a shielded note at POS. No issuer does this. Ready's own card is currently unavailable (issuer wind-down)."

The honest last-mile path in that plan is Phase 2 only:

1. Unshield, or a later team `CardSettle` helper, to a public issuer funding address (fresh per auth when possible).
2. Move USDC onto Solana or EVM.
3. Hand that public USDC to Bridge+Stripe JIT, a Gnosis Pay Safe, or a Rain program.
4. The network charges the card.

Consequences that the product must not paper over:

- The unshield (or CardSettle output) is a public withdrawal amount. Deposit and withdrawal amounts are already public on this protocol.
- The merchant sees the card. The issuer sees KYC. Do not claim otherwise.
- Madu `trade()` moves registered public ERC-20 between allowlisted addresses. It does not unlock notes and it does not speak ISO 8583.
- Eth712 is an account. It can sign the unshield. It cannot make the note itself card-debitable.
- A mock issuer or a UI card that does not hit a real BIN is theater. Do not ship it.

Card spend is therefore an unshield-then-issuer problem. It is not a v0 feature and it is not a reason to touch Madu.

## What must be true before we touch Madu

All of the following, not a subset:

1. Phase 0/1 private money account is live on mainnet on the Ready Wallet API path (shield, private send, AVNU or Vesu).
2. We have a named OTC/RFQ need that first-party AVNU private swap does not cover.
3. Madu mainnet contract address and class hash are verified against source. Today: **UNVERIFIED**. Do not guess.
4. We accept the on-chain semantics as specified: allowlist, registered tokens, public `TradeExecuted` (counterparties, tokens, amounts). This is not a privacy pool. Wrapping it later does not change what the matcher itself emits.
5. If the product need is *private* OTC, we design an anonymizer on paper first (withdraw, act, open note), then review, audit, and deploy. Study `packages/vesu_lending_anonymizer` and Privacy Bridge inbound `privacy_compute` before writing Cairo. The integration plan forbids generating that Cairo from a skill. The team owns it.
6. We treat the repo as WIP even though a V0 audit exists.

Until then, do not import the ABI, do not wrap `trade`, and do not mention Madu in the v0 UI.

## What must be true before we touch Eth712

All of the following, not a subset:

1. A real product need: MetaMask users who will not install Ready. Ready remains the Phase 0 wallet.
2. Eth712Account class hash and AccountFactory address on the target network are verified. Today: **UNVERIFIED**.
3. We have read privacy-client 0.1.0 (`Eip712CallSetSigner`, outside-execution typed data) and accept 0.1.x churn. Not a pin for v0.
4. We keep the mental model: this is still a Starknet app. Eth712 does not replace Wallet API for Ready users. It does not make the dapp an EVM app.
5. If we care about sender unlinkability, the SRC9 execute-from-outside / paymaster path is designed so the Ethereum owner is not `tx.sender`. History still reads the pool `Deposit` event first indexed key, never `tx.sender`.
6. Replay binding for `is_custom_signature_valid` is owned by the caller. The account will not do it.
7. Privacy Bridge is not combined with this path until we have read that repo's README and `CLAUDE.md` and accepted 0.1.x churn (`STRK20_INTEGRATION_PLAN.md`).

Until then, do not deploy a factory, do not prompt MetaMask, and do not advertise "sign with MetaMask" on the sprint surface.

## What v0 does instead

From `docs/PRODUCTION_BUILD_PLAN.md` and `STRK20_INTEGRATION_PLAN.md`:

- Connect Ready. Detect Wallet API `>= 0.10.3`. Degrade honestly otherwise.
- Shield USDC or STRK. Do not bundle the deposit with the next spend.
- Private transfer to a registered recipient. Receive via QR / payment link.
- One of: AVNU private swap, or Vesu via the official anonymizer.
- Statement view only via consented `strk20Balances` when balances are actually shown.
- Honest hidden vs visible labels. Sender, receiver, and private transfer amounts stay in the pool. Deposit and withdrawal amounts are public. Open-note fill amounts may be public.

Canonical pool used by the local plans (awesome-strk20 / skill), not a Madu or Eth712 address:

`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`

Do not use Tongo. Do not call Wallet API 0.10.4 shadow methods until a real wallet advertises them. Do not ship a card. Do not ship Madu. Do not ship Eth712.

## Sources

Official:

- https://github.com/starkware-libs/starknet-privacy
- https://github.com/starkware-libs/starknet-payments (README, `docs/spec.md`, `docs/audit/README.md`)
- https://github.com/starkware-libs/earn-contracts (`eth_712_account`, `account_factory`, root README / `Scarb.toml`)
- https://github.com/starkware-libs/starknet-privacy/blob/main/client/src/signers/eip712-call-set-signer.ts
- https://github.com/starkware-libs/starknet-privacy/blob/main/client/src/signers/index.ts

Local, 2026-08-14:

- `docs/STARKWARE_LIBS_INVENTORY_2026-08-14.md`
- `STRK20_INTEGRATION_PLAN.md`
- `docs/PRODUCTION_BUILD_PLAN.md`

Deployment claims in this file are only as strong as those sources. Madu contract address: **UNVERIFIED**. Eth712Account class hash: **UNVERIFIED**. AccountFactory address: **UNVERIFIED**.

CLAUDE_SESSION_DONE payments-eth712
