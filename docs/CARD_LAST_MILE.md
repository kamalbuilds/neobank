# Spending privately: the permissionless path, and the card last mile

Date: 2026-08-22. Supersedes the 2026-08-14 version, which treated a Visa credential as the
only real spend path and therefore made the whole product wait on an issuer.

Status: dual track. Track A is permissionless, ships now, and depends on nobody. Track B is the
traditional card, and it is optional.

## The hard fact, unchanged

No issuer debits a STRK20 note. Visa authorizes in about two seconds against a public, liquid
balance on a chain the issuer lists. A note is encrypted and needs a proof. That is true of
Stripe+Bridge, Gnosis Pay, Rain, and every self-custodial card program: each still runs on a
licensed issuer with a BIN, and the card itself is KYC'd even when the wallet is not.

What changed is the conclusion drawn from it. Waiting for an issuer made the card the product.
It is not. The product is a private money account, and the permissionless way to spend from one
already exists.

## Track A: private payment primitives (ships now, no issuer)

The permissionless analogue of a card is a private payment request, not a fake card number.

1. **Private payment links, QR codes, invoices.** The payee publishes a request against their
   registered pool channel. The payer spends a shielded note through a private transfer. Who
   paid whom and how much stay inside the pool. This already exists in the app as Receive; the
   work is invoicing and expiry on top of it.
2. **Programmable spend in one transaction.** A single `privacy_invoke` can pay a recipient,
   open a DeFi position with the remainder, and reshield the change, atomically. This is the
   differentiated capability and nothing on the card track can do it. Verified open: the pool
   validates only `contract_address.is_non_zero()`, there is no anonymizer registry or
   allowlist, and the live depositor blocklist is empty.
3. **Batched disbursement.** The pool charges its fee once per `apply_actions` call regardless
   of how many actions are in it (`privacy.cairo`, `collect_fee` sits outside the action loop),
   so paying a team in one call costs one fee instead of one per person. At the live 6 STRK fee,
   ten recipients is 6 STRK batched against 60 STRK looped.

Naming rule: never present any of this as a "card number". A disposable identifier that is
really a signed transfer intent is a payment request, and calling it a card invites a user to
type it into a merchant checkout where it will fail. Say what it is.

Limit, stated plainly: Track A spends to anyone who can receive a Starknet private transfer. It
does not spend at an arbitrary merchant. That is the honest boundary.

## Track B: reaching merchants that only take card numbers

Two sub-paths, and they are not equal.

**B1, the hop we own and have shipped.** Unshield to native USDC on Starknet, then Circle CCTP
V2 `deposit_for_burn` on domain 25 out to Base (6) or Solana (5). Public on both legs, by
construction. Later, route the outbound leg through the Privacy Bridge's `OutboundAnonymizer` so
the Starknet wallet and the destination address are not linked.

**B2, third-party no-KYC virtual cards. Not recommended, and not shipping.** The suggestion is
that a user bridges out privately, then tops up an offshore minimal-KYC virtual card. The
privacy argument is sound: the pool plus the bridge break the link between the STRK20 identity
and the card top-up.

The reason it does not ship anyway: we cannot verify any of the named services are solvent,
legitimate, or durable, and that category has a long history of frozen balances, vanishing
support, and outright exit scams. Shipping a deep link is an implicit endorsement, and a user
who loses funds lost them because our product pointed at it. Document the pattern generically if
users ask. Do not name, integrate, or link a specific provider we have not verified, and do not
route funds through one.

**B3, a real issuer, only on evidence.** Pursue Stripe+Bridge JIT, Gnosis Pay, or Rain only if
usage shows people genuinely need POS and Apple Pay acceptance. Even then the CardSettle helper
stays programmable so the private leg can act before the unshield.

## The hop we can call today (public, after unshield)

From Circle's CCTP Starknet reference, mainnet:

| Piece | Value |
|---|---|
| Starknet domain | 25 |
| TokenMessengerMinterV2 | `0x07d421B9cA8aA32DF259965cDA8ACb93F7599F69209A41872AE84638B2A20F2a` |
| MessageTransmitterV2 | `0x02EBB5777B6dD8B26ea11D68Fdf1D2c85cD2099335328Be845a28c77A8AEf183` |
| Native USDC (this app uses this) | `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` |
| Bridged USDC.e (do not burn) | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` |

CCTP burns native USDC only. Completing the mint needs Circle's Iris attestation plus
`receive_message` on the destination.

## What we will not ship

- A fake BIN, a mock authorize, or a simulated Visa.
- Anything called a card number that is not a card number.
- A named third-party no-KYC card integration we have not verified.
- Burning CCTP from USDC.e.
- Any claim that the merchant cannot see the card, or that the issuer cannot see KYC.

## Corrections to the 2026-08-22 external research

- The live pool fee is **6 STRK**, read from `get_fee_amount` on mainnet today, not 4. The app
  reads it live and prose should never hardcode it.
- Pool size figures are contested across sources and remain **UNVERIFIED**. Do not publish a TVL
  or deposit count until one is reconciled against the chain.

## Sources

- https://docs.stripe.com/issuing/bridge-stablecoin-cards
- https://www.bridge.xyz/product/cards
- https://developers.circle.com/cctp/references/starknet-contracts
- https://developers.circle.com/cctp/concepts/supported-chains-and-domains
- https://www.circle.com/blog/starknet-migration-guide
- https://github.com/starkware-libs/privacy-bridge
- https://github.com/circlefin/starknet-cctp
