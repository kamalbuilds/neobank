# REGISTRY PR DRAFT: neobank (strk20 hackathon)

## Registry row update for `registry.json`

```json
{
  "slug": "neobank",
  "name": "Private money account",
  "one_liner": "Hold, send, and earn on STRK20 without publishing salary or net worth.",
  "category": "Consumer",
  "team": "kamalbuilds",
  "x_handle": "kamalbuilds",
  "inspired_by": "IDEA-13",
  "telegram": "kamalthedev",
  "deployed_contract_addresses": [
    // TODO: add STRK20 token address mainnet
    // TODO: add PrivatePayoutAnonymizer address mainnet
    // TODO: add PrivateSpendAnonymizer address mainnet
    // TODO: add ProgrammableSpendAnonymizer address mainnet
  ],
  "demo_url": "https://neobank-six.vercel.app"
}
```

## PR description

This PR adds the neobank entry to the STRK20 hackathon registry. Neobank demonstrates a privacy-preserving money account built on STRK20, utilizing Cairo anonymizers (`PrivatePayoutAnonymizer`, `PrivateSpendAnonymizer`, `ProgrammableSpendAnonymizer`) to shield transaction details on mainnet. Three verified shield transactions on mainnet demonstrate the privacy guarantees, and the programmable spend differentiator enables custom spend rules without exposing user data. The demo is available at `https://neobank-six.vercel.app`.

---
*TODO: Replace the `deployed_contract_addresses` placeholder array with actual mainnet contract addresses before merge.*