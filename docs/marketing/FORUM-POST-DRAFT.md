# Forum post draft, community.starknet.io

Status: DRAFT. Not posted. Needs Kamal's sign-off before it goes anywhere.

Target: community.starknet.io, the STRK20 area where threads 116264, 116173 and 116163 live.

Why a findings post and not an announcement: an announcement asks the reader for attention, a
findings post gives them something. It also earns the sprint's own line, "if another team depends
on something you published, that counts in your favour", which an announcement does not.

Every claim below was verified against mainnet or against the scanner source this week. Nothing
here is repeated from someone else's README.

---

## Title

Six things that silently cost us time building on STRK20, with the fixes

## Body

We are building a private money account on STRK20 for the Private Sprint. Along the way we lost
hours to six things that fail quietly, where nothing errors and you just get a wrong answer. All
six are verified against mainnet. Posting them so nobody else pays for them twice.

**1. The action that funds an anonymizer is `withdraw`, not `transfer`.**

This one is currently blocking at least one other team. To call your own `privacy_invoke`
contract you need three actions, and the order matters:

```ts
{ type: "withdraw", token: TOKEN, amount: num.toHex(amount), recipient: helper },
{ type: "transfer", token: TOKEN, amount: "OPEN", recipient: connectedAddress },
{ type: "invoke", contract: helper, calldata: [num.toHex(TOKEN), "${poolAddress}", "${openNoteIds[0]}"] },
```

The `withdraw` moves value out to your contract. The `transfer` with amount `"OPEN"` does not
fund anything: it creates the *output* open note your contract fills on the way back. Send only a
transfer plus an invoke and your contract has nothing to spend.

`"OPEN"`, `"${poolAddress}"` and `"${openNoteIds[0]}"` are literal placeholder strings the wallet
substitutes while assembling. Running them through `num.toHex` corrupts them. Only real tokens and
amounts get hex-normalised. Credit to the starter kit for documenting the placeholder rule:
<https://github.com/Akashneelesh/strk20-starter-kit>

If your helper returns an empty span, as a one-way payout does, you skip the `"OPEN"` transfer
entirely. Every open note created in a call has to be filled exactly once or the pool rejects with
`UNDEPOSITED_OPEN_NOTES`.

**2. `strk20.json` transactions must be hash strings. Objects score zero.**

The hub scanner does `typeof raw === "string" ? raw.trim() : ""` and skips everything else. We
had written ours as `{hash, kind, note}` objects to keep our own annotations, so two genuinely
verified pool transactions were being counted as none. We were not the only repo doing this.

Use `"transactions": ["0x...", "0x..."]` and put notes under a different key.

**3. A transaction that succeeded is not necessarily a transaction that touched the pool.**

The bar is three mainnet hashes that each emitted an event from the pool contract. A
`DEPLOY_ACCOUNT` succeeds, looks perfect in an explorer, and emits zero pool events, so it does
not count. Ours was in the list.

We wrote a checker that runs the same test the panel does, against any repo:

```sh
node scripts/verify-strk20-claim.mjs --repo owner/name
```

It reports per transaction whether it exists, succeeded, and emitted a pool event, and flags the
object-form schema trap from point 2. Apache-2.0, in our repo, take it: <https://github.com/kamalbuilds/neobank>

**4. `starknet_getEvents` from block 0 returns empty pages, not results.**

Pages are block windows, not N matches. Filtering pool events from block 0 gave us twelve
consecutive empty pages, each still carrying a `continuation_token`. Any sane page budget is spent
long before the pool's first deposit in block 9,023,083, so the feature returns nothing for
everybody and looks like a filter bug.

Start from the pool's first block. Filtering by depositor as a second key lets the node do the
matching, and splitting the range into windows scanned concurrently took our activity read from
86 seconds to 14.

**5. `Deposit` and `ViewingKeySet` are easy to mix up, and the failure is invisible.**

Check selectors with `hash.getSelectorFromName` rather than copying a hex string:

```
Deposit        0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2
ViewingKeySet  0x1321a492485b4f19851fb787ab3800a0030b595332cba93cd5fe40dfb5a4daf
```

We had them swapped. `ViewingKeySet` fires once per account at registration, so our activity view
showed exactly one row forever and hid every shield that was not the account's first. It looked
like a working feature.

`Deposit` carries everything on one event: `keys[1]` depositor, `keys[2]` token, `data[0]` amount.
Compare addresses as `BigInt`, never as strings, because the RPC returns them unpadded.

Also worth knowing: that amount is gross. A shield of 0.1 STRK with a 6 STRK fee records as 6.1,
so label it as fee-inclusive or your users will think they shielded sixty times what they did.

**6. Test on Sepolia. The pool is there and the fee is lower.**

We spent a while assuming mainnet was the only option. It is not.

```
sepolia pool  0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91
mainnet fee   6 STRK      sepolia fee  2 STRK      (read live, get_fee_amount)
```

Verified on chain as "Starknet: Canonical Privacy Pool". With Ready the Wallet API flow works
there and needs no prover of your own. Testnet STRK is free.

One trap while you are there: `blastapi.io` is retired and answers every call with "Blast API is
no longer available", so if it is still your Sepolia fallback it fails silently.
`starknet-sepolia-rpc.publicnode.com` works.

---

Happy to go deeper on any of these. If you are stuck on a custom anonymizer specifically, point 1
is almost always the answer.

---

## Before posting, check

- [ ] Kamal reads it end to end and agrees with publishing points 2 and 3
- [ ] Confirm the repo is public and the verifier script path in point 3 is correct
- [ ] Re-read `get_fee_amount` on both networks the morning it posts, since the fee is admin
      settable and this post quotes both
- [ ] No pool TVL or deposit count anywhere, those figures are still contested
- [ ] Cross-post the point 1 answer as a direct reply to the builder who asked about it

## The tradeoff, stated plainly

Points 2 and 3 will help competitors fix their own submissions before the deadline. Our scan
found that most registered entries fail at least one gate, and several fail exactly these two.

Publish anyway. The sprint rewards work others depend on, this lands in front of the StarkWare
team before the video call, and a project that hands rivals the fix while still being further
along reads as confident. Competing by hoping other people stay broken is not a moat.
