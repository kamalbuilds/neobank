# Sealed launch thread (@sealedcash, sealed.cash)

Launch window: within 48 hours. All facts below are testnet (Starknet Sepolia) unless a line explicitly says mainnet. Card claims are issuer-sandbox (Lithic), not a live card program. Nothing in this doc should be posted with those qualifiers stripped out.

---

## MAIN THREAD (9 posts)

**1/** (hook, carries the video, must stand alone)

Every payment you make onchain is a public receipt: your salary, your rent, what you spent last night, all sitting on a block explorer forever, readable by anyone who bothers to look.

Sealed is a private money account on Starknet built to stop that.

[ATTACH: launch video]

**2/**

Most "private" crypto tools shield one step: a transfer, a mixer hop, then you spend from a normal wallet and the trail reconnects on the other side. Sealed shields the loop instead. Shielded balances. A card that spends straight from them. A fresh funding identity per transaction. And spend rules you program, so one swipe both pays the merchant and moves money where you told it to. Your balance and your history stay off the public record; the card's settlement leg runs through a hosted account we operate, and we say so on the site rather than pretending otherwise.

**3/**

Here's an actual transaction, not a mockup: a Sealed account sells private STRK and pays a merchant in USDC in a single call.

tx 0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df, block 14130415, SUCCEEDED, and now Accepted on L1.

Pull it up on a Sepolia explorer yourself.

**4/**

Every merchant you pay through Sealed sees a fresh identity, not your main account. Each spend is funded through a freshly derived onchain identity, so the funding leg of one payment doesn't link to the next. Settlement itself lands on a fixed program address today; per-merchant settlement addressing is the next piece.

tx 0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b, block 14130089.

**5/**

Funding comes in from another chain. We bridged USDC from Base: it mints on Starknet, then shields into the pool in the very next transaction. The mint is briefly visible, the shield is not, and we would rather state that than claim a hop that doesn't exist.

tx 0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2, block 14139603. Private notes went from 5 USDC to 6.

**6/**

The card is the part people don't believe until they see the decisioning logs. We ran it against Lithic's Authorization Stream API, a real issuer sandbox, not something we wrote ourselves to fake a demo: an over-limit swipe got declined, an in-policy grocery swipe got approved, both recorded on Lithic's side.

**7/**

You program what a swipe does. Set a rule and every restaurant purchase lends 10 STRK into the Earn vault in the same transaction that pays the merchant, no second signature, no separate trip.

To be exact about what that vault is: it's our own ERC-4626 contract, 1:1, deposit STRK and mint the same number of shares. It is a lockbox, not a yield strategy. There is no rate to quote and we don't quote one.

**8/**

And when someone needs proof a payment happened, you don't hand over your whole history. A viewing key generates a statement for that one authorization: proves it happened, exposes nothing else in the account.

**9/**

Where this actually stands: everything above runs on Starknet Sepolia testnet with real transactions and test money, not mainnet. The card runs against Lithic's sandbox, not a live card program yet. We're saying that plainly because a privacy product that hides its own stage isn't one you should trust.

We also sent work back upstream: a PR and an issue against StarkWare's own privacy SDK (github.com/starkware-libs/starknet-privacy/pull/977, /issues/978), plus a public starter repo if you want to build a shielded account yourself (github.com/kamalbuilds/starknet-shadow-account-starter).

Sealed launches within 48 hours. sealed.cash. Go watch the transactions move, then tell us what breaks it.

---

## THREE ALTERNATIVE POST-1 HOOKS

**A. Surveillance-premise-led** (different angle from the main hook: direct, second-person, confrontational rather than declarative)

Pull up your own wallet on a block explorer right now. Anyone can see what you got paid, what you spent it on, and exactly when. That's the default on every public chain, for every wallet, all the time.

Sealed is the account that turns it off. Testnet today, real transactions: sealed.cash

**B. Receipt-led**

This is a real transaction: a Sealed account sells private STRK and pays a merchant in USDC, in one call. tx 0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df, block 14130415, SUCCEEDED.

No mockup, no staged screenshot. That's what a private money account on Starknet looks like when it actually runs. sealed.cash

**C. Product-led**

Sealed is a private money account on Starknet: shielded balances, a card that spends straight from them, a fresh identity for every merchant, and spend rules you program so one swipe pays the merchant and moves money where you told it to.

Testnet today, real transactions, test money: sealed.cash

---

## SHORT VERSION (single post + video, for people who won't read a thread)

Every payment you make onchain is a public receipt: salary, rent, last night's dinner, permanent and readable by anyone. Sealed is a private money account on Starknet that stops that. Shielded balances, a card that spends from them, a fresh funding identity per spend, and funding that bridges in from another chain. Live on Sepolia testnet now, real transactions, test money. sealed.cash

[ATTACH: launch video]

---

## REPLY-BAIT PREP (5 hardest questions, answers ready to paste)

**"What's the actual anonymity set? Isn't it tiny on testnet?"**
Right now, small. It's testnet, volume is thin, so today's pool doesn't hide much on its own yet. Anonymity sets grow with real usage, that's true of every shielded pool at launch, not unique to us. The pool gets meaningfully private when it gets meaningfully used, which is the whole case for pushing to mainnet next rather than staying a demo forever.

**"Why not just use the STRK20 pool directly instead of your wrapper?"**
You can, the pool works fine on its own. Sealed adds what a raw pool doesn't give you: a spendable card, a fresh identity per merchant instead of reusing one shielded address everywhere, programmable spend rules that fire in the same transaction as the payment, and a statement you can hand someone without opening your whole account. If all you want is a shield, use the pool. If you want to live off it, that's what we built.

**"Is the card real or a mockup?"**
The authorization logic runs against Lithic's Authorization Stream API, real decisioning infrastructure, not something we wrote to fake a demo. What isn't real yet: a production card program a bank has approved, and a card working at a physical terminal. That step needs an issuing partnership we don't have yet.

**"Is this custodial? Do you hold my funds?"**
Your shielded balance is non-custodial: it lives in the STRK20 privacy pool under notes only your wallet can spend, and we never hold that key. One carve-out, stated plainly: the card's settlement leg runs through a hosted account we operate, with a server-held viewing key. That account is custodial and we label it as such in the app.

**"Testnet or mainnet, be straight with me"**
The product is Sepolia. Every screen in the video is Starknet Sepolia with real transactions and test money, and the card runs against Lithic's sandbox, not a live program.

What is on mainnet, and it's more than a gesture: we shielded real STRK into the canonical STRK20 privacy pool at 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a, and those transactions are Accepted on L1, so they're settled on Ethereum rather than merely sequenced. Two of our own contract classes are also declared on mainnet now. Declared is not deployed, and none of our contracts has a live mainnet address yet, so no, Sealed itself does not run on mainnet today.

---

## WHAT NOT TO CLAIM

- Don't say or imply Sealed is live on mainnet. It is not. Everything demoed is Sepolia testnet.
- Don't say "spend this at Starbucks today" or anything implying a live, bank-approved card program. The card is proven against Lithic's issuer sandbox, not production.
- Don't imply the test USDC or test STRK moved in these transactions has real monetary value. It's test money on a test network.
- Don't claim total, unbreakable, or perfect anonymity. A privacy pool's real-world protection depends on how many other people are using it at the same time; testnet volume is low.
- Don't claim a security audit unless one has actually happened and can be linked. None is referenced here.
- Don't position Sealed as a KYC/AML evasion tool or lead with "the government can't see this." Privacy is the feature; evasion framing is a different, unverified claim and invites the wrong scrutiny.
- Don't imply StarkWare endorses, funds, or partners with Sealed because of the upstream PR and issue. That's a contribution accepted into their repo, not a partnership.
- Don't cite user counts, a waitlist size, TVL, or a funding round. None of those numbers exist in what's verified here.
- Don't call Sealed "the first" or "the only" private neobank on Starknet. That's a competitive claim nobody has checked.
