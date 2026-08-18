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
| Unshield | Fund the demo wallet with ~10 public STRK, past the live 6 STRK pool fee plus Ready's buffer, then run it | cheapest |
| Private send | Second Ready wallet, shield once to register it, then send between the two | one tx |
| AVNU private swap | Set `AVNU_PAYMASTER_API_KEY` on the Vercel deployment and redeploy | needs a key |

The private send is the actual money shot. It is the transaction that proves who paid whom is
hidden.

After each new transaction: append to `strk20.json`, update the status table in `README.md`,
commit.

## Reply to send now

> Hey Adithya, yes, in for 15. Free [2 to 3 slots, IST plus UTC]. Send a link.
>
> What I've got: a private money account on the live STRK20 pool. Hold and send without
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
2. **The honest table, 20s.** Put the private vs public table from `README.md:11` on screen.
   Private: who paid whom, transfer size, your shielded book. Public: deposit and withdrawal
   amounts, that an address touched the pool, the screening decision. Saying the limits out loud
   is what makes everything else credible.
3. **Two lines verbatim.** "The dapp never holds a viewing key. Ready does the proving." And:
   "It is not a bank and it is not a mixer."
4. **Live loop, 40s.** Connect, capability gate unlocks the panels, shield, private send to the
   second wallet, unshield. Voyager tabs open behind.
5. **The gate, 10s.** The app reads Ready's advertised Wallet API version and runs
   `compareVersions` against `"0.10"`. Below that, private panels never render. A real feature
   gate, not a banner. Integrators doing this correctly is something StarkWare cares about.
6. **Close.** What is not built. A Visa that spends a shielded note is not in v0 because no
   issuer does that. Saying it kills the obvious question before anyone asks it.

## Do not say

Full list in `POSITIONING.md`. The three that would cost you this room specifically:

- "untraceable" or "anonymous". The anonymity set is small today and their team knows it.
- Any pool TVL or asset count figure. The community number is UNVERIFIED, single source.
- Any card capability that does not exist. They will know immediately.

## Ask before you hang up

Two from the list in `INTERVIEW-ANSWERS.md`. Do not spend a StarkWare call without an ask.

Also worth asking Adithya directly: recording format, whether they want screen capture, and
whether they need the repo public at publish time.
