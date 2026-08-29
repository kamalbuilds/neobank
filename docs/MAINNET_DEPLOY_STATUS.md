# Mainnet deployment status

Read from the chain with `starknet_getClass` against the mainnet RPC, not from
a deploy log. Every hash below is checkable on Voyager.

## Declared on mainnet

| Contract | Class hash | Declare tx |
|---|---|---|
| PrivatePayoutAnonymizer | `0x349208109fe1f795a2c516acec8b5c1184de828f289a53fb1ee1873d56d927f` | `0x2f458195b6f62fc90d931f310f78377fcc561346435784927c5a3996543b0da` |
| EarnAdapter | `0x71457f3ba7cc2e755a907fb3c07931c3e7b3ed4524011b779a4e36bc08ca03a` | `0x317e63ac7b6fa3baaf9969b043a5d6ce355ce67987f642df0d5e8468a1ceeb0` |

Declared means the class exists on mainnet. It is not the same as deployed:
no instance of either class has an address on mainnet yet.

## Blocked on deployer balance

Deployer `0x0801e718e9f717a066fbaad4f71d3f244b2254e6119fca4cf3904daa47cc9e1`
holds 5.1164 STRK. The next declare fails validation with its exact bounds,
so this is a measurement rather than a guess:

    ProgrammableSpendAnonymizer: l2_gas 306,160,800 @ 53,277,365,191 fri
                                 = 16.31 STRK, against a 5.12 STRK balance

Declare cost tracks Sierra size at roughly 0.0142 STRK/KB on that data point:

| Contract | Sierra | Est. declare |
|---|---|---|
| PrivateSpendAnonymizer | 424 KB | ~6.0 STRK |
| ProgrammableSpendAnonymizer | 1149 KB | 16.3 STRK (measured) |
| JitConverter | 1254 KB | ~17.8 STRK |
| EarnVault | 1513 KB | ~21.5 STRK |
| CardSettlementAnonymizer | 1911 KB | ~27.1 STRK |
| CardProgramAnonymizer | 2370 KB | ~33.7 STRK |

Remaining declares ~122 STRK, plus eight deploys (constructor invokes, ~3.6
STRK each on the observed mainnet invoke) ~30 STRK. Call it 150-200 STRK to
finish, about $4-5 at the STRK price read with the balance.

## Nonce

Declares submitted back to back fail with "Invalid transaction nonce" because
the account nonce has not settled. Leave a gap between them, or submit one at
a time.
