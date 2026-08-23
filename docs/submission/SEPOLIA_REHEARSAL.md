# Sepolia Dress Rehearsal Runbook

## Prerequisites

- [ ] **Ready extension installed** in Brave/Fox with the Ready wallet API capability (v0.10+)
- [ ] **Sepolia STRK obtained** from the Sepolia faucet: <https://faucet.sepolia.starknet.io> (or equivalent)
- [ ] **Second wallet registered** in the Ready pool — the rehearsal requires a second Ready wallet that has already deposited STRK into the pool. The first wallet is the deployer; the second must have completed at least one shield deposit.
- [ ] **sncast available**: `which sncast` → if missing, install via `pip install starknet-foundry` or `brew install starknet-foundry` (see https://foundry.starknet.io)
- [ ] **Network configured**: sncast profile pointing to Sepolia (RPC: `https://starknet-sepolia.infura.io/v3/<project-id>` or public Sepolia RPC)
- [ ] **Contract ARTIFACTS**: The three Cairo contracts (`PrivatePayoutAnonymizer`, `PrivateSpendAnonymizer`, `ProgrammableSpendAnonymizer`) must be compiled and their Sierra artifacts available. Class hashes will be fetched via `sncast declare --sepolia`.

---

## 1. Declare & Deploy Contracts on Sepolia

Run each command sequentially. The `--account` placeholder should be your sncast account name (e.g. the account seeded via `sncast account`). The `--network sepolia` flag is implied by the profile or can be passed explicitly.

### 1.1 Declare `PrivatePayoutAnonymizer`

```bash
sncast declare \
  --contract-name PrivatePayoutAnonymizer \
  --network sepolia
```

*Output*: class hash — record it.

### 1.2 Declare `PrivateSpendAnonymizer`

```bash
sncast declare \
  --contract-name PrivateSpendAnonymizer \
  --network sepolia
```

*Output*: class hash — record it.

### 1.3 Declare & Deploy `ProgrammableSpendAnonymizer` (owner arg)

This contract takes the deployer's address as the owner argument in its constructor calldata.

```bash
sncast declare \
  --contract-name ProgrammableSpendAnonymizer \
  --network sepolia
```

*Output*: class hash — record it.

### 1.4 Deploy all three contracts

```bash
sncast deploy \
  --class-hash <PRIVATE_PAYOUT_CLASS_HASH> \
  --network sepolia

sncast deploy \
  --class-hash <PRIVATE_SPEND_CLASS_HASH> \
  --network sepolia

sncast deploy \
  --class-hash <PROGRAMMABLE_SPEND_CLASS_HASH> \
  --constructor-calldata <DEPLOYER_ADDRESS> \
  --network sepolia
```

- The **position_vault / MockVault** step is **optional and skippable** for this rehearsal. Do NOT deploy MockVault. The position leg will use `positionAmount=0` and a single leg (programmable spend only).
- If you encounter `set_position_vault` prompts, skip them — the rehearsal does not require a vault.

*Output*: three contract addresses — record them.

---

## 2. Record Class Hashes & Addresses into `strk20.json`

After deployment, append a `"contracts"` array to `strk20.json` with the format shown below. This is the evidence map the judging panel reads.

```json
{
  "transactions": [
    "0x...",  /* first shield tx hash */
    "0x...",  /* private send tx hash */
    "0x..."   /* unshield / programmable spend tx hash */
  ],
  "contracts": [
    {
      "name": "PrivatePayoutAnonymizer",
      "class_hash": "<PRIVATE_PAYOUT_CLASS_HASH>",
      "address": "<PRIVATE_PAYOUT_ADDRESS>",
      "network": "sepolia"
    },
    {
      "name": "PrivateSpendAnonymizer",
      "class_hash": "<PRIVATE_SPEND_CLASS_HASH>",
      "address": "<PRIVATE_SPEND_ADDRESS>",
      "network": "sepolia"
    },
    {
      "name": "ProgrammableSpendAnonymizer",
      "class_hash": "<PROGRAMMABLE_SPEND_CLASS_HASH>",
      "address": "<PROGRAMMABLE_SPEND_ADDRESS>",
      "constructor_calldata": "<DEPLOYER_ADDRESS>",
      "network": "sepolia"
    }
  ],
  "demo_url": "https://neobank-six.vercel.app",
  "notes": {
    "0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193": "first_shield. 0.1 STRK shielded, 2 STRK pool fee (Sepolia).",
    "0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e": "shield_usdc. 0.2 public USDC in, 0.0395 remaining after Ready took the privacy fee from the deposit.",
    "0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735": "deploy_account. Deploy on Sepolia, no pool event (same as mainnet behavior)."
  }
}
```

- Each object in `"contracts"` must have `name`, `class_hash`, and `address`.
- `ProgrammableSpendAnonymizer` also includes `constructor_calldata` (the deployer address).
- The `"notes"` map should contain the three tx hashes from the rehearsal run, each with a brief description.

---

## 3. App-Level Rehearsal Order

Perform the following user flows in the Neobank app (Ready wallet). All amounts are small "rehearsal" amounts; nothing is transferred for value.

| Step | Action | Detail |
|------|--------|--------|
| 1 | **Shield small amount** | Deposit ~0.01 STRK (or 0.1 STRK as in the mainnet flow) via the Ready shield UI. This creates a private note mature after ~10 blocks. |
| 2 | **Wait ~10 blocks** | Allow the note to mature. Do not proceed until finality is confirmed. |
| 3 | **Private send to 2nd registered wallet** | Use the private send tab → select the second registered Ready wallet as recipient → send the shielded amount. This tx must reference a mature note. |
| 4 | **Unshield** | Redeem the private note back to public STRK. This consumes the note from step 1/3. |
| 5 | **Programmable spend via UI tab** | Use the ProgrammableSpendAnonymizer tab → set `positionAmount=0` → select 1 leg only (the vault leg is skipped). Execute the spend. |
| 6 | **`npm run verify:claim`** | Run the claim verifier to ensure the strk20.json is scoreable. |

---

## 4. Evidence — Tx Hashes into `strk20.json` Notes Map

After each tx is submitted, copy its hash into the `"notes"` section of `strk20.json`. Use the format:

```json
"notes": {
  "<TX_HASH_1>": "shield small amount. 0.01 STRK shielded, 2 STRK pool fee (Sepolia).",
  "<TX_HASH_2>": "private send to 2nd wallet. amount=0.01 STRK, mature note consumed.",
  "<TX_HASH_3>": "unshield. returned 0.01 STRK public. programmable spend via UI, positionAmount=0, 1 leg.",
  "<TX_HASH_4>": "programmable spend. positionAmount=0, 1 leg only. vault leg skipped."
}
```

The judging panel will search these notes for tx hashes to confirm the rehearsal was executed end-to-end.

---
*Runbook generated for Sepolia STRK20 dress rehearsal. All commands are read-only / query-only; no transactions are auto-executed.*