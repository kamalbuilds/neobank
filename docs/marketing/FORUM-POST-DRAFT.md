# Forum post draft, community.starknet.io

Status: DRAFT. Not posted. Needs Kamal's sign-off before it goes anywhere.

Target: community.starknet.io, the STRK20 area where threads 116264, 116173 and 116163 live.

Why a findings post and not an announcement: an announcement asks the reader for attention, a
findings post gives them something. The sprint is over, so there is no scoreboard reason left to
publish. The reason that remains is the better one: the next cohort of teams will hit the same
traps, and every one of these is cheap to avoid once you know it exists.

Re-verification pass: 2026-09-23. Every number in the body was re-read that day against mainnet
RPC `https://mainnet.nodes.starknet.org/rpc/v0_10`, Sepolia RPC
`https://starknet-sepolia-rpc.publicnode.com`, the npm registry, or the hub's own source. The
calls are logged at the bottom of this file. One figure moved since the first draft and is
corrected in place, the paging timings in point 5. Four findings are new since 5 September:
points 4, 7, 8 and 10, plus the lava endpoint in point 11. One thing the draft treated as a trap
has been fixed upstream and now names the version that fixed it. Anything that could not be
re-read today is named in its own section rather than quietly dropped.

Two claims from the first draft were removed rather than republished. The Sepolia pool's explorer
label ("Starknet: Canonical Privacy Pool") is not an on-chain fact, so the class hash and the live
fee read stand in its place. The line about most registered entries failing a gate came from a
scan of the field during the sprint and has no reason to exist now that judging is done.

---

## Title

Eleven things that silently cost us time building on STRK20, with the fixes

## Body

The Private Sprint is finished and the winners are announced. We entered with Sealed, a private
money account built on the pool, and we did not place. What we do have is a list of things that
cost us hours while building, all of which fail quietly: nothing throws, nothing goes red, you
just get a wrong answer and carry on.

Re-checked every one of them against mainnet on 23 September before posting, because a findings
post whose findings have gone stale is worse than no post. Where a figure moved, the new figure is
here. Where something got fixed upstream, that is said, with the version that fixed it.

**1. The action that funds an anonymizer is `withdraw`, not `transfer`.**

To call your own `privacy_invoke` contract you need three actions, and the order matters:

```ts
{ type: "withdraw", token: TOKEN, amount: num.toHex(amount), recipient: helper },
{ type: "transfer", token: TOKEN, amount: "OPEN", recipient: connectedAddress },
{ type: "invoke", contract: helper, calldata: [num.toHex(TOKEN), "${poolAddress}", "${openNoteIds[0]}"] },
```

The `withdraw` moves value out to your contract. The `transfer` with amount `"OPEN"` funds
nothing. It creates the *output* open note your contract fills on the way back. Send only a
transfer plus an invoke and your contract has nothing to spend.

`"OPEN"`, `"${poolAddress}"` and `"${openNoteIds[0]}"` are literal placeholder strings that the
wallet substitutes while assembling the transaction. Running them through `num.toHex` corrupts
them. Only real tokens and amounts get hex-normalised.

This is no longer folklore. It is in the published types as of `@starknet-io/types-js@0.10.4`,
which is the npm `latest` tag today. `STRK20_TRANSFER_ACTION.amount` is typed `FELT | 'OPEN'`, and
the doc comment on `STRK20_INVOKE_ACTION` reads:

> Calldata items may be literal felts or wallet-resolved placeholders that the wallet substitutes
> during action assembly: `${openNoteIds[N]}` for the ID of the Nth open note (the Nth transfer
> action with amount "OPEN"), or `${poolAddress}` for the privacy pool address.

If your helper returns an empty span, as a one-way payout does, skip the `"OPEN"` transfer
entirely. Every open note created in a call has to be filled exactly once. Create one and leave it
unfilled and the pool panics with `UNDEPOSITED_OPEN_NOTES`; fill more than you created and it
panics with `TOO_MANY_OPEN_NOTES_DEPOSITED`. Both strings are in the deployed mainnet class, along
with `ACTIONS_OUT_OF_ORDER` for getting the sequence wrong. Finding 10 shows how to read that list
for yourself.

Credit to the starter kit for documenting the placeholder rule first:
<https://github.com/Akashneelesh/strk20-starter-kit>

**2. `strk20.json` transactions must be hash strings. Objects score zero.**

The hub's scanner does this, and it still does it today:

```js
const hash = typeof raw === "string" ? raw.trim() : "";
```

Anything that is not a string becomes the empty string, fails the felt regex, and is warned about
and skipped. We had written ours as `{hash, kind, note}` objects to keep our own annotations, so
two genuinely verified pool transactions were counted as none. We were not the only repo that did
this.

Use `"transactions": ["0x...", "0x..."]` and put your notes under a different key. While you are
in there, note that the scanner reads `declared.slice(0, 10)`, so only your first ten hashes are
ever looked at.

**3. A transaction that succeeded is not necessarily a transaction that touched the pool.**

The bar is `MIN_MAINNET_TXS = 3`, and a transaction only counts when it succeeded *and* emitted an
event from the pool address. A `DEPLOY_ACCOUNT` succeeds, looks perfect in an explorer, and emits
zero pool events. Ours was in the list. Re-read on 23 September, our deploy
`0x02cbfcceac813b17696710fd8f2e52b603e4ba6dabd87e774d1840d20b21a735` is still `SUCCEEDED` in block
13,281,287 with 0 events from the pool, so it still would not count.

We wrote a checker that runs the same test the panel does, against any repo:

```sh
node scripts/verify-strk20-claim.mjs --repo owner/name
```

It reports per transaction whether it exists, succeeded, and emitted a pool event, and it flags
the object-form schema trap from point 2. Apache-2.0, in our repo, take it:
<https://github.com/kamalbuilds/neobank>

**4. Declaring a Sepolia contract zeroes every mainnet transaction you have.**

This one is not in anybody's README and it cost us the most. The scanner decides whether a
transaction is *yours* like this:

```js
const own = contracts.map((c) => c.address).filter(Boolean);
```

Every address you declared, whatever network it lives on. The function that works out which chain
a contract is actually on runs separately and is used for display, so it never filters that list.
Declare a Sepolia address and you have armed a rule against a mainnet transaction that can never
satisfy it: the mainnet hash did not touch your Sepolia contract, because nothing on mainnet can.
All four of our real pool transactions came back as *touched the pool, but not through this
project's contracts*, which is `verified_txs: 0`.

The escape is in the scanner's own comment. A project that declares no contracts is judged on the
pool alone, and `mine` is `null` rather than `false`, which passes. So if everything you deployed
is on testnet, leave `contracts` empty and keep the addresses under a key of your own. We use
`sepolia_contracts`, which the hub ignores. Move one back into `contracts` only when it has a
mainnet address *and* a listed mainnet transaction runs through it.

**5. `starknet_getEvents` from block 0 returns empty pages, not results.**

A page is a block window, not N matches. Asking for pool events from block 0 gives you page after
page of nothing, each one still carrying a `continuation_token`, because the node is walking the
chain a window at a time and the pool did not exist yet.

Measured on 23 September: chunk size 1000, filtering the mainnet pool for `Deposit` from block 0.
Eight consecutive pages, all empty, tokens `81920-0`, `163840-0`, `245760-0` and so on. The step
is 81,920 blocks per page. Mainnet's first `Deposit` is in block 9,023,083
(`0x41b9adeba522c8cc212f4a08ffc1c6259c61303cd569fd7eaddcd1b75474675`), and there are zero `Deposit`
events anywhere in blocks 8,000,000 to 9,023,082, so you need roughly 110 pages before you see a
single result. Any sane page budget is long gone. The feature returns nothing for everybody and
looks like a bug in your filter.

Start from the pool's first block instead, and pass the depositor as a second key so the node does
the matching for you:

```ts
keys: [[DEPOSIT_SELECTOR], [address]],
from_block: { block_number: 9_000_000 },
```

Splitting the range into windows and scanning them concurrently is still worth doing, though the
gap has narrowed. Re-measured on 23 September over blocks 9,000,000 to 15,301,087: one sequential
scan came back in a single page after 27.4 seconds, while the same range split into eight
concurrent windows took 5.1 seconds across 12 pages. Both found the same single match. Our
original note said 86 seconds against 14, and that no longer reproduces, so treat the shape of the
result rather than those numbers as the finding.

**6. `Deposit` and `ViewingKeySet` are easy to mix up, and the failure is invisible.**

Check selectors with `hash.getSelectorFromName` rather than copying a hex string:

```
Deposit        0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2
ViewingKeySet  0x1321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf
```

We had them swapped. `ViewingKeySet` fires once per account at registration, so our activity view
showed exactly one row forever and hid every shield that was not the account's first. It looked
like a working feature.

Here is that failure measured rather than described. One mainnet account,
`0x101ab74cf27f868fa42f02de17c5fca88697dd63dd850ee6626d74c25ed6a4a`, read on 23 September: two
`Deposit` events, in blocks 13,281,484 and 13,288,349, and one `ViewingKeySet`, in block
13,281,484 only. Filter on the wrong selector and the second shield is gone.

`Deposit` carries everything on one event: `keys[1]` depositor, `keys[2]` token, `data[0]` amount.
Compare addresses as `BigInt`, never as strings, because the RPC returns them unpadded.

That amount is gross, and this trips people up. Our first shield of 0.1 STRK against a 6 STRK pool
fee recorded a `Deposit` of `0x54a78dae49e20000`, which is 6.1 STRK, followed by a `Withdrawal` of
`0x53444835ec580000`, which is the 6 STRK fee leaving again. Label it as fee-inclusive or your
users will think they shielded sixty times what they did.

**7. The pool fee comes out of your shielded balance, not your public one.**

We built the send panel to check public STRK against `get_fee_amount()` and tell the user to top
that up. Wrong balance. An account we drove on mainnet on 2026-09-07 held 19.616 public STRK and
2.0 shielded STRK, and a 0.05 shielded STRK private transfer was refused with "Insufficient funds
to pay fee" against a 6 STRK fee. Our gate passed it, and the user met the refusal at the wallet
approval screen with no clue which balance was short.

The chain says the same thing if you read a registration transaction.
`0x428d5947280d2c670162aa7a3d666bcaa4d5256e016fab460c1b7a560609578` emits, in one call, a
`Deposit` of exactly 6 STRK and a `Withdrawal` of exactly 6 STRK on the same token. The fee is
settled inside the pool against what you deposited. That account is registered and holds a
shielded balance of zero.

The fee is denominated in STRK whatever token you are sending, so a USDC send still needs shielded
STRK sitting there. Public STRK is still needed for gas, which is charged separately and is small
next to the fee. Gate on both, separately, and say which one is short.

**8. A private send to an unregistered recipient fails, and you can check first.**

The recipient has to have used the pool at least once. Your dapp cannot register them. The good
news is that the pool will tell you before you build the transaction, with a plain `starknet_call`
and no wallet involved:

```sh
# get_public_key(recipient) on the mainnet pool
curl -s -X POST https://mainnet.nodes.starknet.org/rpc/v0_10 \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_call","params":{"request":{
       "contract_address":"0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
       "entry_point_selector":"0x1a35984e05126dbecb7c3bb9929e7dd9106d460c59b1633739a5c733a5fb13b",
       "calldata":["<recipient>"]},"block_id":"latest"}}'
```

Read on 23 September, a registered account returns its viewing public key and
`get_num_of_channels` returns `0x1`. An address that has never touched the pool returns `0x0` from
both. So a two-call preflight turns a confusing wallet-side rejection into a sentence you can
write in your own UI. The pool's panic strings for getting this wrong are `RECIPIENT_NOT_REGISTERED`
and `SENDER_NOT_REGISTERED`.

**9. Sepolia is cheaper and real, but it is not a rehearsal for mainnet.**

The pool is on Sepolia, the flow works there with Ready, you need no prover of your own, and
testnet STRK is free. Read live on 23 September with `get_fee_amount`:

```
mainnet pool  0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a   fee 6 STRK
sepolia pool  0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91   fee 2 STRK
```

Both figures are unchanged since we first wrote them down, but the fee is admin-settable, so read
it rather than hardcode it.

Here is the part we did not know at the time. The two pools do not run the same class.

```
mainnet class  0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d
sepolia class  0x6d163f2b27df0f53c5b0d019366261ba8034af1bef949dee920a60fe58bcf83
```

Both expose 45 external entry points, and two of them differ on each side.
Mainnet has `is_open_note_depositor_blocked` and `set_open_note_depositor_blocked`. Sepolia has
`get_open_note_screening_policy` and `set_open_note_screening_policy` instead. The panic strings
tell the same story: 101 on mainnet, 102 on Sepolia, with `MULTIPLE_DEPOSITORS` and
`OPEN_NOTE_DEPOSITOR_BLOCKED` only on mainnet and `INVALID_ASSOCIATED_ADDRESSES`,
`MULTIPLE_SCREENING_SUBJECTS` and `NO_ASSOCIATED_ADDRESS` only on Sepolia.

So build on Sepolia, absolutely. Just do not assume that anything touching open-note screening
behaves identically when you move over. Diff the two classes before you promote that code.

**10. Read the pool's own error list. It is right there in the class.**

Cairo panics are felt short strings, which means the whole list is sitting in the deployed Sierra
program and you can pull it out without a repo, a build, or an explorer. This is how every panic
string quoted above was obtained:

```js
const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_getClassAt",
    params: ["latest", POOL] }) });
const cls = (await res.json()).result;

for (const felt of cls.sierra_program) {
  const v = BigInt(felt);
  if (v <= 0n || v >= (1n << 248n)) continue;
  const hex = v.toString(16);
  if (hex.length % 2) continue;
  const s = Buffer.from(hex, "hex").toString("ascii");
  if (/^[A-Z][A-Z0-9_]{5,30}$/.test(s)) console.log(s);
}
```

101 strings on the mainnet pool today. `ACTIONS_OUT_OF_ORDER`, `NOTE_ALREADY_DEPOSITED`,
`NOTE_NOT_OPEN`, `SCREENING_EXPIRED`, `SCREENING_REQUIRED`, `TOKEN_MISMATCH`,
`INVALID_INVOKE_RETURN_DATA`, `ZERO_NOTE_VALUE`. When a private transaction fails with a bare felt
you cannot read, this is the lookup table, and it takes one call to build.

**11. Two RPC endpoints you may still have in a fallback list are dead.**

Both of these bit us, and both fail in a way that reads as a data problem rather than a network
problem. Re-checked 23 September:

```
https://starknet-sepolia.blastapi.io/rpc/v0_8   HTTP 403, "Blast API is no longer available..."
https://rpc.starknet.lava.build                 HTTP 410, "This endpoint has been discontinued."
```

The lava one is the nastier of the two, because it answers every method identically, so a
verification script that expects `null` for a missing transaction concludes your transactions do
not exist. Ours did exactly that and reported a working submission as broken. If your checker
treats a null result as "not found", give it a liveness probe first.
`mainnet.nodes.starknet.org/rpc/v0_10` and `starknet-sepolia-rpc.publicnode.com` both answered
every call in this post.

### Fixed upstream since we hit it

Back in August, STRK20 support in starknet.js only existed on the `next` tag: a bare
`npm install starknet` resolved to a 10.0.x `latest` with no `WalletAccountV6`, no
`strk20InvokeTransaction`, no `STRK20_ACTION`. That is over. As of 23 September the npm `latest`
for `starknet` is **10.8.0**, and its type declarations carry `WalletAccountV6`,
`executeWithProof`, `strk20Balances`, `strk20PrepareInvoke`, `strk20InvokeTransaction` and
`strk20ShadowAccountCommitment`. Shadow accounts shipped stable too: `@starknet-io/types-js@0.10.4`
is now `latest` and adds `STRK20_SHADOW_ACCOUNT_INVOKE_ACTION` to the `STRK20_ACTION` union, where
0.10.3 has no shadow surface at all.

The half that is not fixed: `@starknet-io/get-starknet-discovery` and
`@starknet-io/get-starknet-wallet-standard` still publish `latest` as `5.0.0-beta.0`, with the v6
line only on `next` (6.0.6 today). `WalletAccountV6` needs v6. So that pair still has to be
installed off `next`, and you should pin the exact version rather than leave a floating range
against a moving tag.

One caution if you upgrade. If you pinned `@starknet-io/types-js` to 0.10.3 in an `overrides`
block, as we did to stop get-starknet pulling a prerelease in, that override will now hold you
below the shadow action types after you bump starknet. Drop the override when you move.

### What we did not verify

Worth stating, because a findings post that hides its gaps is just marketing.

- **Whether any wallet advertises Wallet API >= 0.10.4.** The types exist and are stable. Whether
  Ready or Xverse will answer `wallet_strk20ShadowAccountCommitment` today is not something we can
  read from a chain or a registry, and we did not drive a wallet to find out. Feature-detect on
  `wallet_supportedWalletApi` before you call anything shadow-related.
- **The shielded-balance fee refusal in point 7 was measured once, on 2026-09-07,** driving Ready
  against mainnet. We did not re-drive a wallet on 23 September. The on-chain corroboration in that
  section is fresh; the refusal message is not. What would settle it: a second wallet run with a
  public balance well above the fee and a shielded balance below it.
- **The Sepolia pool's first block.** We use 8,200,000 as a floor and it works, but we never
  pinned the exact first `Deposit` there the way we did on mainnet.

---

Happy to go deeper on any of these. If you are stuck on a custom anonymizer specifically, point 1
is almost always the answer, and if your submission scored zero verified transactions despite
having real ones, it is almost always point 4.

What we built with all of this is at <https://sealed.cash>. The checker from point 3 and the
class-reader from point 10 are both Apache-2.0 in the repo linked above, so lift them.

---

## Before posting, check

- [ ] Kamal reads it end to end
- [ ] Re-read `get_fee_amount` on both networks the morning it posts, since the fee is admin
      settable and this post quotes both. Command is in the verification log below.
- [ ] Confirm nothing in the body implies a placement in the sprint. It should read as a
      participant's writeup and nothing more.
- [ ] No pool TVL or deposit count anywhere. Those figures are still contested.
- [ ] Cross-post the point 1 answer as a direct reply to the builder who asked about it

## Verification log, 2026-09-23

Mainnet RPC `https://mainnet.nodes.starknet.org/rpc/v0_10` at block height 15,300,764 rising to
15,301,087 during the pass. Sepolia RPC `https://starknet-sepolia-rpc.publicnode.com` at block
15,495,273.

| Claim | Call | Result |
|---|---|---|
| Mainnet pool fee | `starknet_call` `get_fee_amount` (`0x3d323cd6…dd32ed2`), no args | `0x53444835ec580000` = 6 STRK |
| Sepolia pool fee | same selector, Sepolia pool | `0x1bc16d674ec80000` = 2 STRK |
| Mainnet pool class | `starknet_getClassHashAt` | `0x67dddd89d80fedadc06b6f160798f94800a4a70164e5a24301cd0d6076b554d` |
| Sepolia pool class | `starknet_getClassHashAt` | `0x6d163f2b27df0f53c5b0d019366261ba8034af1bef949dee920a60fe58bcf83` |
| Class entry points differ | `starknet_getClassAt` both, diff EXTERNAL selectors and ABI names | 45 each, 2 differ per side |
| Panic strings | `starknet_getClassAt`, short-string scan of `sierra_program` | 101 mainnet, 102 Sepolia; `UNDEPOSITED_OPEN_NOTES` present on mainnet |
| Four listed pool txs still qualify | `npm run verify:claim` | 4 of 3, SCOREABLE |
| Deploy tx emits no pool event | `starknet_getTransactionReceipt` `0x02cbfccea…` | SUCCEEDED, block 13,281,287, 0 pool events |
| Deposit is gross | receipt of `0x04c4bea0…` | Deposit `0x54a78dae49e20000` (6.1), Withdrawal `0x53444835ec580000` (6) |
| Fee settles inside the pool | receipt of `0x428d5947…` | Deposit 6 STRK and Withdrawal 6 STRK, same token, one call |
| Block-0 paging is empty | `starknet_getEvents` from block 0, chunk 1000 | 8 empty pages, token step 81,920 blocks |
| Mainnet first Deposit | `starknet_getEvents` 8,000,000 to 9,023,082, then from 9,023,000 | 0 events, then block 9,023,083 `0x41b9adeb…` |
| Sequential vs windowed | 9,000,000 to 15,301,087, 1 loop vs 8 concurrent windows | 27.4s / 1 page vs 5.1s / 12 pages, same match |
| ViewingKeySet fires once | event counts for `0x101ab74c…` | 2 Deposit (13,281,484 and 13,288,349), 1 ViewingKeySet (13,281,484) |
| Registration is readable | `get_public_key` and `get_num_of_channels` | registered: key + `0x1`; unregistered `0x…1234`: `0x0` and `0x0` |
| Hub still string-only | `raw.githubusercontent.com/starkience/strk20-hackathon/main/scripts/build-projects.mjs` | `typeof raw === "string" ? raw.trim() : ""` |
| Hub `own` is network-blind | same file | `const own = contracts.map((c) => c.address).filter(Boolean)` |
| Three-transaction bar | same file | `MIN_MAINNET_TXS = 3`, `t.ok && t.pool && t.mine !== false` |
| starknet.js latest | `npm view starknet dist-tags` | latest 10.8.0, next 11.0.2 |
| 10.8.0 has the STRK20 surface | `npm pack starknet@10.8.0`, grep `dist/index.d.ts` | all four methods plus `strk20ShadowAccountCommitment` |
| types-js latest | `npm view @starknet-io/types-js dist-tags` | latest 0.10.4 |
| 0.10.4 adds shadow action | `npm pack`, grep `wallet-api/components.d.ts` | `STRK20_SHADOW_ACCOUNT_INVOKE_ACTION` in the union; absent in 0.10.3 |
| get-starknet still on `next` | `npm view @starknet-io/get-starknet-discovery dist-tags` | latest 5.0.0-beta.0, next 6.0.6 |
| Blast is dead | POST `starknet_blockNumber` | HTTP 403, "Blast API is no longer available" |
| Lava is dead | POST `starknet_getTransactionReceipt` | HTTP 410, "This endpoint has been discontinued." |
| Judging weights | `strk20.starknet.io/hackathon` | integration depth 30, mainnet product 30, innovation 25, docs and open source 15 |
| Links resolve | HTTP HEAD | sealed.cash 200, kamalbuilds/neobank 200, Akashneelesh/strk20-starter-kit 200 |

Not re-read this pass, and flagged in the body: any wallet's advertised Wallet API version, the
Ready fee-refusal message from 2026-09-07, and the Sepolia pool's exact first block.
