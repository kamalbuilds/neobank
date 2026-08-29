# Why the build script does not pass `--webpack`

Written after an independent recheck contradicted the commit message that made
the change (`ba6b9bd`). That commit is right about what to do and wrong about
why, so the correction lives here rather than in a message nobody re-reads.

## What happened

The deployment carrying the docs site failed:

```
TypeError: Cannot read properties of undefined (reading 'length')
    at WasmHash._updateWithBuffer (next/dist/compiled/webpack/bundle5.js)
Next.js build worker exited with code: 1
Error: Command "npm run build" exited with 1
```

Removing `--webpack` from `package.json` fixed the deploy. That part is
verified: the next push went `READY` and all eleven `/docs` routes went from
404 to 200.

## What the commit claimed, and why it was wrong

It claimed webpack itself was broken, citing two local builds that sat past 20
minutes without finishing.

A recheck from a **fresh clone** does not support that:

| tree | builder | cache | result |
|---|---|---|---|
| fresh clone | turbopack (default) | none | ✓ 58s |
| fresh clone | `--webpack` | 265MB from a prior turbopack build | ✓ 26s |
| **cold clone** | `--webpack` | **none** | ✓ 18.6s |

Webpack builds this repository fine, cold, in under twenty seconds. The
20-minute local hangs were almost certainly a `next dev` server competing for
the same `.next` directory - a dev server was running for both of them, and was
killed before the build that finally succeeded.

## What the evidence actually points to

The failing Vercel log's first line is:

```
Restored build cache from previous deployment (39L5qDvWKo8J9e2Y4hebdyhLgFU6)
```

That cache was produced by a webpack build of an older tree. `WasmHash` crashing
inside cache hashing is consistent with an incompatible restored cache, not with
webpack being unable to compile this code. Nothing reproduced the crash locally,
because no local build restored that cache.

## So why keep the change?

Because the flag was never wanted. It arrived seeding a starter kit in
`478605d`, nothing since has needed it, and Turbopack is the Next 16 default.
Dropping it removes an opt-out we had no reason to carry and sidesteps a cache
format we had no reason to depend on.

Keep it dropped. But do not repeat the claim that webpack cannot build this
project - a cold clone disproves it in 18.6 seconds, and a wrong reason in a
commit message is quoted later as if it were established.

## Unresolved

The exact interaction between that restored cache and `WasmHash` was not
reproduced, only inferred from the log. If `--webpack` is ever reinstated,
expect the crash to return only on a deployment that restores an incompatible
cache, and clear the build cache before concluding anything about the builder.
