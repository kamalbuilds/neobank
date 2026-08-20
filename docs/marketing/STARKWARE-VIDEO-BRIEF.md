# StarkWare video call brief

Date: 2026-08-22. Adithya (adiiHQ, StarkWare) asked for a 15 minute video call to feature this
project in a privacy sprint video, amplified by StarkWare and Starknet handles.

`docs/PRODUCTION_BUILD_PLAN.md:129` lists "book the STRK20 team call (adiiHQ / Cal.com) with the
live mainnet loop, not a deck" as a Phase 1 item. That call arrived early. The loop is the
deliverable, not the script.

## Credit where it belongs

The `strk20-privacy-integration` skill in this repo is not ours. `skills-lock.json` sources it
from `starkience/strk20-agent-skills`. Never present it as our build.

The honest framing is stronger anyway: this is a real mainnet app built using StarkWare's own
STRK20 agent skill. That is proof their developer tooling works, which is material their team
wants.

## Close before recording

Today the on camera loop is money goes in and never comes out. Fix that first.

| Blocker | Fix | Cost |
|---|---|---|
| Unshield | Fund the demo wallet with ~10 public STRK, clearing the pool fee the app reads live (6 STRK at the 2026-08-22 mainnet read) plus Ready's buffer, then run it | cheapest |
| Private send | Second Ready wallet, shield once to register it, then send between the two | one tx |
| AVNU private swap | Set `AVNU_PAYMASTER_API_KEY` on the Vercel deployment and redeploy | needs a key |

The private send is the actual money shot. It is the transaction that proves who paid whom is
hidden.

After each new transaction: append to `strk20.json`, update the status table in `README.md`,
commit.

## Reply to send now

> Hey Adithya, yes, in for 15. Free [2 to 3 slots, IST plus UTC]. Send a link.
>
> What I've got: a private money account on the live STRK20 pool. Hold, send, and spend without
> publishing your salary or net worth. Non custodial, Ready does the proving, the dapp never
> touches a viewing key. Live at neobank-six.vercel.app with mainnet transactions on Voyager.
>
> One thing that might be useful for you: I built it using the `strk20-agent-skills` skill from
> starkience. It scanned my repo, routed me to the Wallet API path, and wrote the plan. Happy to
> talk about where that flow helped and where I hit walls, if that is material you want.
>
> I'll have the full shield, private send, unshield loop on mainnet by then.

That last line is a commitment. Only send it if the fixes above are done.

## On camera, 90 seconds

1. **Open.** The 15 or 30 second version from `POSITIONING.md`. Never improvise this.
2. **The honest table, 15s.** Put the private vs public table from `README.md:11` on screen.
   Private: who paid whom, transfer size, your shielded book. Public: deposit and withdrawal
   amounts, that an address touched the pool, the screening decision. Saying the limits out loud
   is what makes everything else credible.
3. **Two lines verbatim.** "The dapp never holds a viewing key. Ready does the proving." And:
   "It is not a bank and it is not a mixer."
4. **Live loop, 30s.** Connect, capability gate unlocks the panels, shield, private send to the
   second wallet, unshield. Voyager tabs open behind.
5. **The differentiator, 15s.** Say what one transaction can do: pay a recipient, open a DeFi
   position with the remainder, reshield the change, atomically. And batched payroll: ten
   people, one call, one pool fee. Describe the primitive and point at `docs/CARD_LAST_MILE.md`.
   Do not demo it unless it is wired into the app that day.
6. **The gate, 10s.** The app reads Ready's advertised Wallet API version and runs
   `compareVersions` against `"0.10"`. Below that, private panels never render. A real feature
   gate, not a banner. Integrators doing this correctly is something StarkWare cares about.
7. **Close, 10s.** What is deliberately optional. "Spending privately ships without an issuer:
   payment links, invoices, batched payouts, programmable spend. A Visa authorizes a public
   liquid balance in two seconds, so it can never carry the note and never gets that last
   trick." Saying it as a choice kills the obvious question before anyone asks it.

## Do not say

Full list in `POSITIONING.md`. The ones that would cost you this room specifically:

- "untraceable" or "anonymous". The anonymity set is small today and their team knows it.
- Any pool TVL or deposit count figure. Sources disagree with each other. UNVERIFIED,
  unpublished.
- Any card capability that does not exist. They will know immediately.
- Calling a payment request a card number. It is a payment request.

## Ask before you hang up

Two from the list in `INTERVIEW-ANSWERS.md`. Do not spend a StarkWare call without an ask.

Also worth asking Adithya directly: recording format, whether they want screen capture, and
whether they need the repo public at publish time.
