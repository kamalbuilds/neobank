# Sealed launch thread, staged for X

Post from **@kamalbuilds**, then retweet from the sealed.cash account.

## When

Target **Tue 13:00-15:00 UTC = 18:30-20:30 IST**. That window overlaps EU
afternoon, US morning and India evening, which is the only slot that catches all
three for a crypto/dev audience. Avoid 02:00-06:00 UTC and Friday afternoon UTC.

Stay in the replies for the first hour. Early reply velocity is what the ranking
actually rewards; a launch post with no author replies dies in an hour.

## Files

- `sealed-square-x.mp4` - **the file `post.sh` uploads.** 1080x1080, H.264
  yuv420p, limited range, AAC, 30.1 s, 2.5 MB. Square, because the timeline
  crops 16:9 and square takes more vertical space on mobile.
- `sealed-launch-x.mp4` - the earlier 1920x1080 cut, 52.8 s, 9.6 MB. Kept for
  the site and for anywhere landscape is wanted. Not what goes on X.
- Neither is the site's `public/demo.mp4`, which is full-range yuvj420p and
  shifts colour on some players.
- `thread.json` - keys `post` (the opener) and `replies` (four), in order.
- `post.sh` - the runnable publish sequence.
- `posted-ids.json` - written by `post.sh`, one line per tweet it creates.

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

## Voice

`thread.json` was rewritten against @kamalbuilds' own recent posts, not written in
a generic launch register. His habits: blunt openings, colon-label lists
("Hidden until settlement: exact order size"), receipts over adjectives
("Measured, not vibes"), and limits stated out loud ("A lockbox, not a yield
strategy. There's no rate to quote, so we don't quote one").

The pre-humanizer draft is kept at `thread-pre-humanizer.json`. What changed:

- Cut "The part nobody else ships". An unverifiable superlative, and the opposite
  of how this account argues; it counts things instead ("Still running a private
  DEX: zero"). Replaced with a first-person reason, which is an opinion and not
  a claim that can be wrong.
- Broke up two runs of dramatic three-beat fragments.
- Cut the "How it works." heading that the next line only restated.
- Cut "Not a mockup" as a clipped negative opener; post 4 leads with the deposits.
- Post 5 now echoes his own line about writing things down so the marketing
  cannot outrun the code.

No em dashes, no curly quotes, every post under 280.

## Accounts

`social account list` returns account **names**, which are not the same as the
X usernames. Verified 2026-09-08:

| Account name | Username | Use |
|---|---|---|
| `kamalbuilds` | `kamalbuilds` | posts the thread |
| `sealed` | `sealedcash` | retweets post 1 |

There is no account named `sealedcash`, so `social account switch sealedcash`
exits 1 with "Account 'sealedcash' not found". The product account is `sealed`.
There are also two rows whose username is `kamalbuilds` (named `kamal` and
`kamalbuilds`); both authenticate as @kamalbuilds, and the script uses
`kamalbuilds`.

## Commands

Run the script. It does the whole sequence, chains on the real ids, and stops on
the first failure instead of unrolling the thread into orphan posts.

```bash
bash ~/Desktop/neobank/marketing/launch-x/post.sh
```

The verified syntax it uses, checked against `--help` and the social-cli /
twitter-cli source on 2026-09-08. The earlier draft of this file had all four
lines wrong:

```bash
social account switch kamalbuilds              # NOT `account use`
social post "<text>" -v sealed-square-x.mp4 -a kamalbuilds   # text is POSITIONAL, there is no --text
social reply <previous-id> "<text>" -a kamalbuilds           # id and text both positional
social account switch sealed                   # the NAME, not the username sealedcash
social retweet <post-1-id> -a sealed
```

`social thread "t1" "t2" ...` exists but takes no media flag, so it cannot carry
the video on post 1. The post-then-reply chain is the only route.

Success shapes differ between the two paths, which is why the script parses both:

```jsonc
// social post ... -v video   (GraphQL CreateTweet, data is a plain string)
{"ok": true, "data": "https://x.com/i/web/status/1963..."}

// social reply ...           (twitter-cli, OUTPUT=json)
{"ok": true, "data": {"ok": true, "schema_version": "1",
  "data": {"success": true, "action": "reply", "id": "1963...",
           "replyTo": "1963...", "url": "https://x.com/i/status/1963..."}}}
```

Ids are appended to `posted-ids.json` as each one lands, so an interrupted run
can be finished by hand.

Then stay in the replies for the first hour. Reply velocity in the first hour is
the part that actually moves distribution.
