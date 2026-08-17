# Card last mile: stablecoin funding, Visa acceptance

Date: 2026-08-14.
Status: architecture locked. Visa credential is not in this repo. The hop we own is.

This is the same commercial architecture PYMNTS described for Thredd + Cashi (11 Aug 2026): keep the digital dollar on the funding side, keep conventional card rails on the acceptance side, monetize the translation layer. Cashi is a closed HK program. We are not Cashi. The developer-facing stack that implements that same split is Stripe Issuing + Bridge (Lead Bank), not a Visa we invent.

## What unshield is, and what it is not

Unshield turns a STRK20 note into public native USDC on Starknet. That is necessary. It is not spend at a merchant. Visa authorizes in about 2 seconds against a public, liquid balance or credit line on a chain the issuer lists. A note is encrypted and needs a proof. No issuer, including Brahma/Swype (dead), HypurrFi, Rain, Gnosis Pay, or Stripe+Bridge, debits a STRK20 note.

## The translation layer we will ship

```
private note (STRK20 pool)
  -> unshield (Wallet API, already coded)
  -> public native USDC on Starknet
  -> Circle CCTP V2 deposit_for_burn (domain 25)
  -> native USDC minted on Base (domain 6) or Solana (domain 5)
  -> standing Bridge-approved wallet on that chain
  -> Stripe Issuing + Bridge JIT pull at swipe
  -> Visa / Apple Pay / Google Pay
```

Merchant sees a Visa. Issuer and Bridge see KYC. This app never holds a viewing key. Amounts on the public hops stay public. Copy must say that.

## Why this stack, not Thredd + Cashi

| Layer | Cashi (PYMNTS example) | Us |
|---|---|---|
| Consumer app | Cashi wallet | This Ready dapp + STRK20 |
| Funding asset | Stablecoin balance | STRK20 note, then native USDC |
| Processor | Thredd | Stripe Issuing |
| BIN / bank | Visa program via Thredd | Lead Bank via Bridge |
| Onchain pull | Cashi's own rails | Bridge JIT on Base or Solana |

Thredd + Cashi is live in Hong Kong (virtual Visa + Google Pay) with Mexico later. It is not a self-serve API for a Starknet dapp. Bridge cards are the documented developer product: Phantom, Airtm, Chipper, Fuse. Visa + Bridge (Mar 2026) are expanding that program; cards already live in 18 countries. Starknet is not on Bridge's JIT chain list. Circle CCTP V2 is live on Starknet (domain 25, Dec 2025), so the hop to Base or Solana is a real protocol, not a wrapped bridge.

## Contracts we can call today (public, after unshield)

From Circle's CCTP Starknet reference, mainnet:

| Piece | Value |
|---|---|
| Starknet domain | 25 |
| TokenMessengerMinterV2 | `0x07d421B9cA8aA32DF259965cDA8ACb93F7599F69209A41872AE84638B2A20F2a` |
| MessageTransmitterV2 | `0x02EBB5777B6dD8B26ea11D68Fdf1D2c85cD2099335328Be845a28c77A8AEf183` |
| Native USDC (this app already uses this) | `0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` |
| Bridged USDC.e (do not burn) | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` |
| Base domain | 6 |
| Solana domain | 5 |

CCTP only burns native USDC. Our `TOKENS.USDC` is the native address (Circle migration guide, 3 Dec 2025). The 0.0395 [USDC] note in `strk20.json` is this token.

`deposit_for_burn` is a public ERC-20 approve + burn after the note is already unshielded. It does not need a viewing key. Completing the mint on Base/Solana needs Circle's Iris attestation + `receive_message` on the destination. That second half can live in this app as a follow-up call once Iris returns the attestation.

## What is still partner-only

- A Visa PAN, Apple Pay, Google Pay
- Bridge JIT approval on the destination wallet
- Stripe Issuing addendum (private preview: first meeting after addendum, ~2 weeks internal, 6-8 weeks external)
- KYC (Persona on the Stripe+Bridge path)

Outreach URL: https://www.bridge.xyz/requestfreedemo (HubSpot embed; blocked in the `neobank` Brave profile by tracker blocking on 2026-08-14). Stripe Issuing create-account: https://dashboard.stripe.com/register/issuing.

## What we will not ship

- A fake BIN, mock authorize, or simulated Visa
- A Yield tab against the undeclared Vesu class
- Burning CCTP from USDC.e
- Claiming the merchant cannot see the card

## Product surface in this app

1. Unshield (exists). Blocked on public STRK for the 6 STRK pool fee.
2. Hop: public CCTP burn of native USDC to a Base or Solana mint recipient the user types. Honest label: this is the card-funding hop, not a swipe.
3. Later: Privacy Bridge outbound so the Starknet wallet and the mint recipient are not linked on the public hop.
4. Later: Stripe+Bridge program once the addendum exists. Then the mint recipient is the user's Bridge-approved wallet, not a random address.

## Sources (2026-08-14)

- https://www.pymnts.com/cryptocurrency/2026/stablecoin-cards-turn-crypto-last-mile-into-payments-infrastructure-business/
- https://www.pymnts.com/news/payment-methods/2026/thredd-helps-cashi-launch-stablecoin-card-program/
- https://mediaconnect.com/thredd-powers-cashis-global-stablecoin-spending-card
- https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22206.html
- https://docs.stripe.com/issuing/bridge-stablecoin-cards
- https://www.bridge.xyz/product/cards
- https://www.bridge.xyz/blog/the-last-mile-how-card-programs-are-turning-stablecoins-into-a-real-utility
- https://developers.circle.com/cctp/references/starknet-contracts
- https://developers.circle.com/cctp/concepts/supported-chains-and-domains
- https://www.circle.com/blog/starknet-migration-guide
- https://www.starknet.io/blog/native-usdc-live-on-starknet/
- https://github.com/circlefin/starknet-cctp
- https://swype.fun/ and https://app.hypurrfi.com/card (bhn, same day)
