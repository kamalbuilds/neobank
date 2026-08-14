# STRK20 Starter Kit Map: copy vs delete for Phase 1

Source: https://github.com/Akashneelesh/strk20-starter-kit at `187fe78` ("feat: add STRK20 icon.png favicon and drop metadata override"), cloned to `/tmp/strk20-starter-kit`. Map only, no scaffold performed.

Upstream is a Next.js 16 / React 19 / starknet.js 10 demo that drives STRK20 through `WalletAccountV6.strk20InvokeTransaction`. It never touches a viewing key, which matches the neobank route in `docs/../STRK20_INTEGRATION_PLAN.md` §2. What it also carries is a fixed token, three hardcoded amounts, and an echo helper Cairo contract that does nothing but round-trip STRK. Those are demo scaffolding and must not enter the product.

## 1. Version pins for our `package.json`

Upstream pins are stale on two packages. Use these:

| Package | Upstream | Use in neobank | Why |
|---|---|---|---|
| `starknet` | `10.4.0` (exact) | `>=10.4.0` | 10.4.0 is the first with `WalletAccountV6` + `strk20InvokeTransaction`; allow newer (`next` tag is 10.7.0) |
| `@starknet-io/get-starknet-discovery` | `6.0.2` | `6.0.4` | upstream is two patches behind; 6.0.4 is current `next` |
| `@starknet-io/get-starknet-wallet-standard` | `6.0.2` | `6.0.4` | must match discovery version exactly |
| `@starknet-io/types-js` | `0.10.3` (dev) | `0.10.3` | keep. Stable Wallet API spec. Do NOT jump to `0.10.4-beta.2` until Ready advertises >= 0.10.4 |
| `next` | `^16.0.8` | `^16.0.8` | keep |
| `react` / `react-dom` | `19.2.1` | `19.2.1` | keep |
| `zustand` | `^5.0.9` | `^5.0.9` | keep, it is the whole state layer |
| `sharp` | `^0.34.5` | drop unless we use `next/image` | starter uses plain `<img>` everywhere, so sharp is unused |
| `typescript` | `^5.9.3` | keep | |
| `@types/node` `24.10.2`, `@types/react` `19.2.7` | keep | |

Also change: package `"name": "wallet_account_for_starknet"` → our name. Scripts use `--webpack` (opts out of Turbopack); keep that, starknet.js v10 + wallet-standard has not been verified under Turbopack here.

## 2. Verdict per file

### KEEP as-is (copy straight over)

| File | Note |
|---|---|
| `src/app/components/Wallet/walletContext.ts` | zustand wallet store: `WalletAccountV6`, address, chain, `isConnected`, `walletApiList`. This is the exact shape Phase 1 needs. `walletApiList` is how we capability-detect >= 0.10.3 rather than probing `strk20Balances`. |
| `src/app/components/client/provider/providerContext.ts` | frontend provider index store. 15 lines, correct. |
| `tsconfig.json` | strict, `@/*` → `./src/*`. Only edit: drop the `old/core` include and `old/**/*` / `doc` excludes (leftovers from the PhilippeR26 fork, no such dirs exist). |
| `next.config.js` | 5 lines. `reactStrictMode: false`: worth revisiting later, but leave for now: strict-mode double-invoke re-fires the wallet discovery subscription. |
| `.editorconfig`, `.gitignore` | trivial |
| `cairo/.tool-versions` | `scarb 2.18.0`: keep only if we keep a `cairo/` dir for our own Phase 3 helper. Not needed Phase 1. |

### KEEP but CHANGE

| File | Change |
|---|---|
| `src/app/components/client/WalletHandle/SelectWallet.tsx` | Copy the connect flow verbatim: `createStore({ eip1193Adapters: [] })` (kills MetaMask Snap popup spam), `store.subscribe` for late-registering wallets, `WalletAccountV6.connect`, `walletV6.requestAccounts` / `getPermissions` / `requestChainId` / `supportedSpecs`. **Change:** (a) line 67 hardcodes `myFrontendProviders[2]` (Sepolia) at connect time: our sprint is mainnet, so pick the provider from the wallet's chainId, not a literal index; (b) the filter at line 57-60 excludes Braavos by name: keep the MetaMask exclusion, drop the Braavos-by-name exclusion and gate on advertised Wallet API version instead; (c) strip the `console.log`s; (d) "Disconnect" button only flips `isConnected` false and leaves the store populated: make it clear state properly. |
| `src/app/components/client/WalletHandle/WalletAccountV6Tag.tsx` | **The reference implementation, not the product component.** Copy out and keep: `submit()` (submit → show hash → `waitForTransaction` with `retries: 400, retryInterval: 3000`, long budget because the pool verifies a STARK proof), the comment that `myWalletAccount.provider` is fixed at connect time and must not be used for receipt polling, `receiptToResult`, `balancesToResult`, `prettyStatus`, `strk20Balances([])` for all shielded tokens, and the action shapes for `deposit` / `withdraw` / `transfer`. Rewrite everything else: real user-entered amounts, real token selection, our own UI. Delete the echo tab and its whole verify path (see below). |
| `src/utils/constants.ts` | Keep only `myFrontendProviders` (and reorder: index 1 is a dead public BlastAPI v0_7 endpoint, drop it) and `Strk20Networks`. Delete every `DEMO` constant (see below). Mainnet + Sepolia Alchemy URLs are fine; `NEXT_PUBLIC_PROVIDER_URL` holds only the key, the URL prefix stays in code. |
| `.env.example` | Keep `NEXT_PUBLIC_PROVIDER_URL`. Delete the `NEXT_PUBLIC_STRK20_ECHO_HELPER_SEPOLIA` block. |
| `src/app/layout.tsx` | Keep the shape (Inter + Space Mono via `next/font/google`, `--font-body` / `--font-mono-ui`, `suppressHydrationWarning`). Replace the metadata title/description ("Shielded STRK · WalletAccountV6"). |
| `src/app/globals.css` (107 lines), `src/app/uni.module.css` (467 lines) | Useful as a reference for the receipt-card / modal / tab classes that the copied components reference. If we bring in our own design system, these go and the components get rewritten against it. Do not ship the file half-used: either port it or replace it wholesale. |
| `src/app/components/TokenIcons.tsx` | Pattern is fine (plain `<img>`, no `next/image` config). Regenerate for our actual token list. |
| `public/tokens/*.png|webp` | Keep only the tokens we actually list. `strk20.png` is the upstream brand mark: delete. |
| `README.md` | Rewrite entirely. Upstream README documents demo defaults and the echo helper. |

### DELETE from the product

**DEMO constants: all of these, by name:**

| Symbol | File | Why |
|---|---|---|
| `addrSTRK` | `src/utils/constants.ts:7` | hardcodes one token for every action; product needs a token registry / user selection |
| `Strk20EchoHelperAddress` | `src/utils/constants.ts:23` | mainnet address of the demo echo contract |
| `Strk20EchoHelperSepolia` | `src/utils/constants.ts:28` | env-fed sepolia echo address, defaults `"0x0"` |
| `Strk20EchoHelperClassHash` | `src/utils/constants.ts:33` | declared class hash of the echo contract, used only to UDC-deploy it from the UI |
| `echoHelperForIndex()` | `src/utils/constants.ts:37-41` | resolver for the above |
| `TOKEN` | `WalletAccountV6Tag.tsx:15` | alias of `addrSTRK` |
| `TEN_STRK` | `WalletAccountV6Tag.tsx:18` | fixed 10 STRK shield amount |
| `FIVE_STRK` | `WalletAccountV6Tag.tsx:19` | fixed 5 STRK echo amount |
| `ONE_STRK` | `WalletAccountV6Tag.tsx:20` | fixed 1 STRK unshield / transfer amount |

`fmtStrk` (`WalletAccountV6Tag.tsx:23`) also hardcodes 18 decimals: not a DEMO constant but a demo assumption; replace with per-token decimals.

**Echo helper: the whole thing, product-side:**

| Path / symbol | Why |
|---|---|
| `cairo/src/lib.cairo` | `StrkInvokeHelper`. Its `privacy_invoke` reads its own STRK balance and `approve`s the pool to pull it all back. Pure no-op round-trip whose only side effects are `invoke_count`, `last_note_id`, and an `Invoked` event. Zero product value, and shipping an unaudited `privacy_invoke` contract that blanket-approves its caller is an unnecessary attack surface. |
| `cairo/Scarb.toml`, `cairo/address.md` | package + deployed-address record for that contract only |
| `handleComplex()` (`WalletAccountV6Tag.tsx:335-363`) | builds the demo withdraw→helper→open-note→invoke triple |
| `verifyEcho()` (`WalletAccountV6Tag.tsx:367-430`) | scans the receipt for the demo `Invoked` event |
| `handleDeployHelper()` (`WalletAccountV6Tag.tsx:242-282`) | UDC-deploys the echo class from the UI and prints an env var to paste. Never in a product. |
| `Verdict` / `VerdictRow` types, `verdictComplex` state, the `echo` tab entry, the `verdict*` CSS classes | echo-only UI |
| `hasEchoHelper` / `echoHelperAddr` (`WalletAccountV6Tag.tsx:158-165`) | echo-only gating |

**Keep the knowledge, not the code:** the echo path is the only working example of a `privacy_invoke` composition and of the literal placeholder strings. Preserve these two facts in our docs before deleting the code:

1. In an `invoke` action, `"OPEN"`, `"${poolAddress}"`, `"${openNoteIds[0]}"` are literal strings the wallet substitutes during assembly. Never `num.toHex` them. Only real token addresses and amounts get hex-normalized. (`WalletAccountV6Tag.tsx:343-353`)
2. Phase order inside a `privacy_invoke` is withdraw < invoke: the pool has already moved funds to the helper when `privacy_invoke` runs. (`cairo/src/lib.cairo:76`)

Phase 2 replaces this shape with first-party AVNU / Vesu helpers per the integration plan; Phase 3 is our own audited Cairo.

**Repo cruft: delete outright:**

| Path | Why |
|---|---|
| `.codex/hooks.json`, `.cursor/hooks.json`, `.serena/project.local.yml` | upstream author's local agent config |
| `public/Images/StarkNet-JS_logo.png`, `StarkNet-JS_navbar.png`, `encoded-20231019075753.txt` | leftovers from the PhilippeR26 fork, unreferenced |
| `public/next.svg`, `public/vercel.svg` | CRA-era boilerplate, unreferenced |
| `public/tokens/strk20.png` | upstream brand mark, used in `page.tsx` nav |
| `src/app/icon.png` | upstream favicon |
| `src/app/page.tsx` | 100% demo landing page: 12 blurred background coins, "Just Encrypt / Everything" hero, footer crediting the upstream repo and hardcoding "Powered by Starknet.js v10.4.0". Rewrite from zero. |
| `LICENSE` | replace with ours |
| `packageManager` yarn field in `package.json` | pick our own package manager |

## 3. Phase 1 shopping list, in order

1. `package.json` with the pins in §1 (no `sharp`, no yarn `packageManager` unless we choose yarn).
2. `tsconfig.json`, `next.config.js`, `.editorconfig`, `.gitignore` copied with the `old/*` include cleanup.
3. `walletContext.ts` + `providerContext.ts` copied unchanged.
4. `constants.ts` reduced to `myFrontendProviders` (mainnet + sepolia only) and `Strk20Networks`.
5. `SelectWallet.tsx` copied, then the four changes in §2.
6. A new actions component that reuses `submit` / `receiptToResult` / `balancesToResult` from `WalletAccountV6Tag.tsx` but takes real amounts and our token list.
7. `.env.example` with `NEXT_PUBLIC_PROVIDER_URL` only.

Nothing from `cairo/` enters Phase 1.

CLAUDE_SESSION_DONE starter-kit
