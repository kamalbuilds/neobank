# STRK20 mainnet + SDK verification (live on-chain reads)

Date: 2026-08-22. Live verification against mainnet RPC and fresh clones of the SDK/bridge repos, not secondhand claims. Supersedes any usage-volume guesses elsewhere in this folder; other files' route/architecture guidance (`claude-privacy-sdk.md`, `claude-wallet-api.md`) still stand.

## Working RPC endpoints (2026-08-22)

- `https://rpc.starknet.lava.build` — works, used for everything below.
- `https://starknet.publicnode.com` — also works.
- `https://starknet-mainnet.public.blastapi.io/rpc/v0_8` and `v0_9` — **dead**. Returns `403` with `{"code":-32000,"message":"Blast API is no longer available. Please update your integration to use Alchemy's API instead"}`. Drop this from any skill/reference that still lists it.
- `https://free-rpc.nethermind.io/mainnet-juno/` — does not resolve (DNS failure) from this network.

## Pool contract — confirmed live

- Address: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- Class hash (read live via `starknet_getClassAt`): `0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d`
- **This does not match** the class hash the `starknet-privacy` repo's top-level README pins for tag `PRIVACY-0.14.3-RC.0` (`0x52107fadffab71bdcbb6b2ccb68ba3e1b5558d94036538053e159d3076ad633`). Mainnet is running a different/newer build than that README table implies. Don't cite the README's contracts table as "what's on mainnet now" without re-checking the class hash.

### Full ABI (from `starknet_getClassAt`, 87 entries)

Interfaces / entrypoints:
- `IClient`: `__execute__`, `compile_and_panic`, `compile_actions` (view), `__validate__`
- `IServer`: `apply_actions`
- `IViews`: `channel_exists`, `get_num_of_channels`, `get_channel_info`, `subchannel_exists`, `get_subchannel_info`, `get_outgoing_channel_info`, `get_note`, `nullifier_exists`, `get_public_key`, `get_enc_private_key`, `get_auditor_public_key`, `get_screener_public_key`, `get_version`, `get_fee_amount`, `get_fee_collector`, `get_proof_validity_blocks`, `is_open_note_depositor_blocked`
- `IAdmin`: `set_auditor_public_key`, `set_screener_public_key`, `set_fee_amount`, `set_fee_collector`, `set_proof_validity_blocks`, `set_open_note_depositor_blocked` (role-gated: `security_governor` for the two key setters, `app_governor` for the rest)
- Plus OZ `IPausable`, `IReplaceable`, `ICommonRoles`

Events (namespace `privacy::events`, plus OZ/utils components):
- `ViewingKeySet{user_addr(key), public_key(key), enc_private_key(data)}`
- `Deposit{user_addr(key), token(key), amount(data:u128)}`
- `Withdrawal{enc_user_addr(data), to_addr(key), token(key), amount(data)}`
- `OpenNoteCreated{enc_recipient_addr(data), token(key), note_id(key)}`
- `EncNoteCreated{note_id(key), packed_value(data)}`
- `OpenNoteDeposited{depositor(key), token(key), note_id(key), amount(data)}`
- `ExternalContractInvoked{contract_address(key), selector(key)}`
- `NoteUsed{nullifier(key)}` — the spend/nullifier-reveal event
- `AuditorPublicKeySet`, `ScreenerPublicKeySet`, `FeeAmountSet`, `FeeCollectorSet`, `ProofValidityBlocksSet`, `OpenNoteDepositorBlockSet`
- Standard `AccessControl`/`SRC5`/`Pausable`/`Replaceability` component events

The live ABI still has the boolean `is_open_note_depositor_blocked`/`set_open_note_depositor_blocked` pair. The SDK's `CHANGELOG.md` "Unreleased" section (commits 2026-08-19/20) retires this in favor of `get_open_note_screening_policy`/`set_open_note_screening_policy` (`Required`/`Exempt`/`Delegated`) — **not live on mainnet yet** as of this pull.

### Event selectors (`starknet_keccak`, verified by decoding actual on-chain event payloads against the ABI field layout — do not trust a selector handed to you without doing this)

- `Deposit` = `0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2`
- `ViewingKeySet` = `0x01321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf`
- `Withdrawal` = `0x2eed7e29b3502a726faf503ac4316b7101f3da813654e8df02c13449e03da8`

**Gotcha hit during this research**: a value that looked like a plausible "Deposit selector" (`0x01321a49...`) was actually `ViewingKeySet`. Confirmed by computing `starknet_keccak("Deposit")` myself and cross-checking the returned event's key/data shape against the ABI (`Deposit` has 2 keys + 1 data field; `ViewingKeySet` has 2 keys + a struct data field that serializes to 3 felts — the wrong selector's results had exactly that 3-data-felt shape, which was the tell). Always recompute the selector from the name and sanity-check the field count against the ABI before trusting an event query.

## Mainnet usage — real numbers, not empty

Query: `starknet_getEvents`, `address` = pool, `keys=[[Deposit selector]]`, `from_block=9,000,000`, `to_block=latest (13,692,985)`, `chunk_size=1000`, paged via `continuation_token` to exhaustion (confirmed by an empty continuation token at the end, not just "stopped fetching").

- **13,912 Deposit events** total.
- **2,437 distinct depositor addresses** (`keys[1]` on the Deposit event — this is the address to key any per-user analytics off, per the existing skill's "sender is not the user" rule; depositor address IS reliable to key off for the deposit leg specifically, since deposits are public and the depositor signs them directly).
- First Deposit at block **9,023,083**; first ViewingKeySet registrations start at essentially the same block — consistent with this being close to the pool's mainnet go-live block.
- Not a smooth ramp: a dense burst at blocks **~11,238,000–11,340,000** produced 5,127 of the 13,912 deposits, from 704 distinct depositors (top single depositor: only 63 deposits, so not one whale gaming it, but the density looks like incentivized/farming activity rather than organic steady-state usage — flag this if usage numbers get quoted anywhere user-facing).
- ViewingKeySet (registration) total count: **not fully scanned** (ran out of time after confirming >9,500 from a partial pass with the wrong selector, which is still a valid count of ViewingKeySet events even though it was pulled by accident) — treat total registrations as an open question, re-run if it matters.

### Tokens actually deposited (symbol confirmed via live `symbol()` calls, selector `starknet_keccak("symbol")` = `0x216b05c387bab9ac31918a3e61672f4618601f3c598a2f3f2710f37053e1ea4`)

| Token | Address | Deposit events | Raw amount sum |
|---|---|---|---|
| STRK | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` | 8,104 | ≈39.18M STRK (18dp) |
| USDC (dominant) | `0x33068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb` | 5,218 | ≈584,743 USDC (6dp) |
| strkBTC | `0x787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135` | 1,219 | ≈6.75 BTC (8dp assumed) |
| ETH | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` | 155 | ≈100.26 ETH |
| USDC (2nd address, barely used) | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` | 4 | ≈13.86 USDC |
| WBTC | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` | 67 | — |
| xstrkBTC | `0x047751b3532fabca89b0f2e35ca1cb45e5a7b11d5e3d3663dfa1f4406b45fd88` | 41 | — |
| BROTHER (memecoin) | `0x03b405a98c9e795d427fe82cdeeeed803f221b52471e3a757574a2b4180793ee` | 26 | — |
| + 22 more | — | 1–13 each | — |

30 distinct token addresses total have at least one Deposit event. Two different addresses both report symbol `USDC` — the `0x33068f65...` one is the one actually used at volume; the `0x053c9125...` one (native Circle USDC per general Starknet knowledge) has essentially no pool activity. Don't assume "the USDC pool" without checking which address a given integration is targeting.

## SDK (`@starkware-libs/starknet-privacy-sdk`)

- Registry: GitHub Packages only (`publishConfig.registry: https://npm.pkg.github.com` in `sdk/package.json`). `npm view --registry=https://npm.pkg.github.com` → `401 Unauthorized` (no token, expected). `npm view --registry=https://registry.npmjs.org` → `404`, confirmed **not mirrored to public npm**. `npm search starknet-privacy` on public npm turns up nothing related.
- Version: **0.14.3-rc.5**, released 2026-08-12 (commit `66e3caa`). Unreleased commits on top through 2026-08-20: `36eac4e` (shadow account = its interaction's associated address), `f0cd946` + `83a4536` (open-note screening-policy rework, retiring the boolean block-list).
- Repo `github.com/starkware-libs/starknet-privacy` is public Apache 2.0, clones fine.
- `sdk/package.json` exports: `.` (dist/index.js), `./testing`, `./browser` (+ `.min`), `./browser/testing`, `./abi`. Dependencies: `starknet@10.5.0` (pinned exactly as of rc.5, was `^10.0.0-beta.6` before), `zod`, `ohttp-ts`, `starknet-devnet`, `@starknet-io/types-js~0.10.2`. No WASM dependency — proving is via a remote HTTP proving service (`ProvingService` class), not client-side WASM.
- Every meaningful action export (`createPrivateTransfers`, `SimplePrivateTransfersImpl`, `IndexerDiscoveryProvider`) needs the viewing key. The only secret-free surface is the pool's own `IViews` interface (channel/note/fee/version reads, `nullifier_exists`), callable directly via starknet.js with no SDK at all.
- Server-side indexer pattern is real and shipped: `crates/discovery-service` (Rust, HTTP, RPC-backed), Docker image `ghcr.io/starkware-libs/starknet-privacy/discovery-service:PRIVACY-0.14.3-RC.2`. SDK's `IndexerDiscoveryProvider` is the client for it.
- `demo/` in the repo is a full Vite/React app with `.env.mainnet.example` — i.e. StarkWare's own demo is built to run against mainnet, not just devnet. Worth reading for wiring patterns (`src/avnu.ts`, `paymaster.ts`, `timeline.ts`, `proof-provider.ts`).

## Anonymizers, compliance, bridge

- Repo README lists **class hashes**, not confirmed deployed instances: Ekubo Anonymizer `0x2a4ac595283d4d64b9952f5ef5c0da1775bfdb7c9d92237524a21dd8d19ebd7`, Vesu Anonymizer `0x3751128dc3ebd36215f982766f14aaca8f78793e4b0f42a73e49372a8e24aae`. Did not verify these are actually deployed on mainnet (would need a Voyager class-hash search) — **UNVERIFIED**.
- Compliance mechanism is real but narrow: pool has `auditor_public_key` and `screener_public_key` (both governance-settable, `security_governor`-gated), and pre-deposit screening is enforced (`SCREENING_REQUIRED` revert path referenced in SDK changelog test notes). No separate "selective disclosure" API beyond this.
- `github.com/starkware-libs/privacy-bridge` (Apache 2.0, public, clones fine): USDC-only EVM↔pool bridge over Circle CCTP, `OutboundAnonymizer`/`InboundAnonymizer` Cairo contracts (`packages/bridge-anonymizers`), TS engine (`packages/bridge-core`), demo app (`apps/bridge`). No `.env.mainnet` or mainnet address config found anywhere in the repo — looks pre-deploy. **UNVERIFIED** whether it's live on mainnet at all; treat as reference-only, matches this folder's existing guidance not to pin it.

## Raw artifacts (local, not committed)

`/tmp/starknet-privacy` and `/tmp/privacy-bridge` (fresh clones), `/tmp/pool_class_lava.json` (full ABI JSON), `/tmp/deposits_raw.txt` (13,912+ raw Deposit event lines). Re-clone/re-query if a later session needs to go deeper — these were scratch files, not preserved.
