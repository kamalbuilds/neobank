# community.starknet.io as a research source

Added 2026-08-23. The official Starknet forum is a first-class source for STRK20 work: it is
where integrators write up route decisions and failure modes in more detail than any repo README,
and where competitors announce themselves before they ship.

## How to query it

Discourse exposes JSON on every route, so this needs no scraping and no browser.

```sh
# Search, returns topics with id, title, posts_count, created_at
curl -s "https://community.starknet.io/search.json?q=strk20%20privacy%20pool" -H "Accept: application/json"

# A whole thread including every post body
curl -s "https://community.starknet.io/t/116264.json" -H "Accept: application/json"

# Latest across the forum
curl -s "https://community.starknet.io/latest.json" -H "Accept: application/json"
```

Useful queries: `strk20`, `privacy pool`, `anonymizer`, `shielded`, `SNIP-36`, `viewing key`,
`confidential payments`.

As of 2026-08-23 a search for `strk20 privacy pool` returns three topics, all captured below.

## Thread 116264, confidential payments in a smart account

<https://community.starknet.io/t/adding-confidential-payments-to-an-advanced-smart-account-two-ways-to-use-the-starkware-privacy-pool-and-why-we-picked-the-companion/116264>
Posted 2026-07-06. The most useful STRK20 write-up outside the official repos.

**The two routes.** Native: add `is_valid_signature` to the account, implement SNIP-6, redeclare
the class, migrate users. Companion: leave the account alone and put a standard account in front
of the pool, a "deterministic, self-custodial standard sub-account" they call a shield account,
which does have `is_valid_signature`. Funds move wallet, then shield account, then pool. The
companion "nets to $0 at rest" because the private balance lives in the pool.

**Why companion.** Native meant touching "the audited signature-verification path on a
non-upgradable class", forcing a full re-audit and a user migration. The companion reuses "a
standard OZ class, already audited" and adds no new contract to audit.

**The finding that matters most, and it is not in any repo README.** Owner keys on a smart
account are designed to rotate, because that is what social recovery is for. A privacy spending
key must be stable forever. Quote: "If it changes, every note encrypted to the old key becomes
permanently unspendable." Their fix is to generate the privacy seed independently of any owner or
signing key and anchor it to something durable that survives device loss. They also note a
passkey PRF is "a backup of the seed, not its owner", that guardian-assisted recovery "cannot be
made safe against colluding guardians using only a fresh post-recovery key", and that they gate
launch so only users whose seed has a durable anchor may shield.

**Submission gotchas, for anyone who self-submits.** The call needs both `proof` and
`proof_facts`. Submitting over JSON-RPC "silently dropped `proof_facts`" while the sequencer
gateway carried them, the signed hash has to be the with-facts variant, prover version matters,
and the proof must be built against a base block a few blocks behind head.

**Cited as proof:** mainnet tx `0x31f84064cff15b6278acd2f949799e0880d4ed1edde11696d543d4e1e4a6c8f`.
Unverified by us.

### What this changes for us

Mostly it confirms our route rather than changing it. We are on the Privacy Wallet API and never
touch a viewing key, so the recovery-stable-key problem belongs to Ready, not to this app, and
the `proof_facts` gotcha does not apply because the wallet assembles and submits.

Two things worth taking:

1. Key rotation versus permanently unspendable notes is the sharpest "what is hard about this"
   answer available, and it is a real risk we correctly avoided by route choice, not by luck. It
   belongs in the interview answers.
2. If we ever take the SDK route for a treasury or server-held account, both problems become ours
   on day one. Note it in the plan before anyone reaches for the SDK.

## Thread 116173, Sigillo

<https://community.starknet.io/t/sigillo-hosted-snip-36-proving-compliance-templates-for-strk20/116173>
Posted 2026-04-20. Hosted STWO proof generation plus SNIP-36 submission behind single HTTP calls,
with seven gNARK circuits covering four KYC patterns and three audit templates. Endpoints
`/proofs`, `/verify`, `/submit`, `/audit`; instance at <https://sigillo.tech>.

Status is the point: "prototype, local only", with on-chain SNIP-36 submission listed as a grant
milestone, so it is not live. This corroborates our own finding that SDK-route teams are stuck
waiting on a proving service that does not exist yet, and that the Wallet API route we chose is
the only one that works today without operating infrastructure.

## Thread 116163, SilentSwap

<https://community.starknet.io/t/silentswap-enabling-compliant-execution-layer-privacy-for-strk20-institutional-treasury-flows/116163>
Posted 2026-04-06. A direct competitor for the payroll and treasury lane: private payroll, vendor
settlement, treasury rebalancing, "batch payouts in STRK or USDC/USDT where the total treasury
size, individual salaries, and recipient identities remain cryptographically shielded".

The distinction is architectural and worth stating plainly rather than dismissively: SilentSwap
is **TEE based**, interfacing with the pool from outside it. We are pool native, composing through
`privacy_invoke` with no allowlist in the way. A TEE carries a hardware trust assumption that a
STARK proof does not. Their proposal names no SDK, wallet API, or anonymizer contract, and states
no limitations.

## Standing rule

Nothing from this forum is verified by being posted. Treat every claim as a lead: the tx hash
above, Sigillo's availability, and SilentSwap's shipped state all need checking against the chain
or a repo before they enter any doc that a judge or partner reads.
