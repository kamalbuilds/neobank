# DEMO_SCRIPT.md

## 1. 90-Second Shot List
| Time | Screen / Tab | Narration (<15 words) | Must Be Visible |
|------|--------------|-----------------------|-----------------|
| 0:00–0:10 | App wallet "Ready connect" screen | "Connect wallet to STRK20 pool" | Connect button, pool logo, account address |
| 0:10–0:20 | Shield view – select STRK/USDC, amount | "Shield assets into privacy pool" | Input fields, shield button, fee label (e.g., 0.001 ETH equiv) |
| 0:20–0:30 | Tx hash shown on Voyager after shield tx | "Shield tx submitted – hash visible" | Tx hash, fee amount, status "Success" |
| 0:30–0:40 | Private send between two registered wallets | "Send private – recipient wallet selected" | Amount, memo, private note, change note displayed |
| 0:40–0:50 | Multi-leg payout + atomic change reshield via Cairo anonymizer | "Programmable multi-leg payout with reshield" | Multi-leg table, atomic flag, reshield button, change amount |
| 0:50–1:00 | Payment request QR/link generation | "Generate QR / link for recipient" | QR code, copy link button, address label |
| 1:00–1:10 | Honest labels overlay – balance hidden onchain, unshield public | "Onchain: balances hidden; unshield is public" | Label badges: "Balance hidden", "Unshield public" |
| 1:10–1:20 | Summary of 3 pool-emitting mainnet txs (2 already sent, 1 remaining) | "Three txs needed for pool submission" | Tx hashes count, fee totals, remaining tx badge |
| 1:20–1:30 | End screen – deadline reminder + registry URL | "Aug 31 deadline – submit registry" | Deadline text, URL placeholder |

## 2. One-Take Recording Checklist
- **Pre-open browser tabs**: 
  - Neobank app (local dev or staging URL)
  - Voyager tx page (pre-loaded with a dummy tx hash)
  - Metamask/Wallet connect popover (unlocked account)
- **Wallet state prep**: 
  - Two registered wallets loaded (test accounts, no real funds)
  - Sufficient STRK/USDC balance for 3 shield txs (testnet faucet)
  - Fees covered by testnet ETH
- **Do-not-show list**: 
  - No `.env` files or API keys in any window
  - No internal doc paths or source code snippets
  - No wallet private keys or seed phrases visible
  - No personal identifiers beyond test account addresses

## 3. Honest-Boundary Lines to Say on Camera
- "Spending works today inside the STRK20 privacy pool."
- "Transfers are private onchain – balances are hidden by design."
- "Unshield is public by design – onchain data is transparent after unshield."
- "We are NOT a card-number product; this is a privacy pool for wallet-to-wallet transfers."
- "Card-only merchant payments are not supported yet; we focus on pool-native flows."

## 4. Upload / Publish Steps + Registry URL
1. Export the 90‑second video (MP4, < 15 MB).
2. Upload to the project’s S3 bucket: `s3://neobank-hackathon-submissions/<git‑sha>/demo.mp4`.
3. Copy the final URL (`https://s3.amazonaws.com/neobank-hackathon-submissions/<git‑sha>/demo.mp4`).
4. Fill the registry row (Google Sheet column "Demo Video URL") with that URL.
5. Ensure the row also has:
   - STRK20 integration depth score (30 %)
   - Mainnet product readiness (30 %)
   - Innovation score (25 %)
   - Docs/OSS quality (15 %)
6. Tag the PR with `neobank/demo‑script` and link the URL in the PR description.