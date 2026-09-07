# Sealed launch thread, staged for X

Post from **@kamalbuilds**, then retweet from the sealed.cash account.

## When

Target **Tue 13:00-15:00 UTC = 18:30-20:30 IST**. That window overlaps EU
afternoon, US morning and India evening, which is the only slot that catches all
three for a crypto/dev audience. Avoid 02:00-06:00 UTC and Friday afternoon UTC.

Stay in the replies for the first hour. Early reply velocity is what the ranking
actually rewards; a launch post with no author replies dies in an hour.

## Files

- `sealed-launch-x.mp4` - the cut, re-encoded for X (H.264 high@4.0, yuv420p,
  limited range, AAC 192k, faststart, 11 MB, 52.8 s). The site's own
  `public/demo.mp4` is full-range yuvj420p, which shifts colour on some players,
  so upload THIS file, not that one.
- `thread.json` - the five posts in order.

## Post

Post 1 carries the video. The link sits in post 2, never in post 1: a URL in the
opening post measurably costs reach, and the first post is the one that has to
travel.

One hashtag, at the very end of the last post. Grok classifies by semantics now,
so a block of tags reads as spam and buys nothing.

## Handles, all checked live on 2026-09-08

| Handle | Who | Followers | Why it is tagged |
|---|---|---|---|
| `@Starknet` | official Starknet | 344,662 | the pool is theirs |
| `@StarkWareLtd` | StarkWare | 232,596 | STRK20 authors |
| `@ready__x` | Starknet wallet, ex-Argent X | 2,383 | real integration, Wallet API >= 0.10 |
| `@avnu_fi` | AVNU | 110,716 | real integration; the AVNU AA Forwarder is in the mainnet txs |

**Do not tag** `@ready_co` (parent brand, moving to Base, not the Starknet
wallet) or `@argentHQ` (dead). There is no official STRK20 account; `#STRK20` is
the tag they use.

Vesu and Ekubo are deliberately not tagged. Vesu appears in the film as a
settlement source, but `README.md` records that Vesu is not on mainnet and its
class hash is undeclared there, so tagging them would be decoration.

## Every claim in post 4 was read off the chain

`voyager get_transaction` on mainnet, 2026-09-08. All three returned
`finality_status: "Accepted on L1"` with `Deposit` and `EncNoteCreated` events
from `0x040337b1...812a`, which Voyager itself aliases "Starknet: Canonical
Privacy Pool".

| Tx | Block | Amount |
|---|---|---|
| `0xe08fd329091b483978c64f93288b7346b158e0dc485fd7c5f594899f0294` | 13948493 | 8.0 STRK |
| `0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e` | 13288349 | 0.2 USDC |
| `0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193` | 13281484 | 6.1 STRK |

If anyone asks for a link, the pattern is `https://voyager.online/tx/<hash>`.

## Command when you are ready

```bash
cd ~/Desktop/neobank/marketing/launch-x
social account use kamalbuilds
social post --text "$(python3 -c "import json;print(json.load(open('thread.json'))[0])")" --video sealed-launch-x.mp4
# then reply the remaining four in order to the previous post id
```
