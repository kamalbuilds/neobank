# STRK20 integration plan

Repo is greenfield (`neobank/`). There is no existing Starknet app to patch. The plan is a greenfield Wallet API app plus team-owned anonymizers.

Full product judgment, kill list, revenue, and phases: `docs/PRODUCTION_BUILD_PLAN.md`.
Discovery log: `docs/INDEPENDENT_DISCOVERY_2026-08-14.md`.

## Snapshot (nothing to confirm in-repo)

- No `package.json`, no Cairo, no wallet connect. Greenfield.
- Standard stack: Next.js + starknet.js >= 10.4.0 + get-starknet 6.0.3 + Ready.
- Seed from `https://github.com/Akashneelesh/strk20-starter-kit` then delete DEMO/echo.

## Route

Consumer flows: Privacy Wallet API.  
Payroll / card settlement / recurring payouts: our anonymizer + Wallet API.  
EVM funding: Privacy Bridge (early).  
We do not put viewing keys in the dapp.

## Phase 0 (blocked on your approval)

1. Scaffold from starter kit.
2. Pin versions from `docs/PRODUCTION_BUILD_PLAN.md`.
3. Shield / private send / receive / AVNU private swap or Vesu deposit on mainnet.
4. Honest hidden-vs-visible UI.
5. Sprint `strk20.json` + three mainnet hashes.

Nothing in the app changes until you approve this plan.
