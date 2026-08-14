# STRK20 Package Pin Verification

Run 2026-08-14. Freshness check + npm view evidence.

## check_freshness.py --quick output

```
npm pins
--------
  ok   starknet : next=10.7.0 (>= pinned 10.4.0)
  ok   @starknet-io/get-starknet-discovery : next=6.0.4
  ok   @starknet-io/get-starknet-wallet-standard : next=6.0.4
  ok   @starknet-io/types-js : latest=0.10.3
  ok   @avnu/avnu-sdk : latest=4.2.0

privacy monorepo
----------------
  ok   packages/ekubo_swap_anonymizer
  ok   packages/privacy
  ok   packages/shadow_account_anonymizer
  ok   packages/vesu_lending_anonymizer
  ok   packages/escrow absent : exclusion note still valid
  ok   monorepo last push : 2026-08-13T09:19:56Z

wallet API spec
---------------
  ok   wallet-api spec : latest stable v0.10.3; v0.10.4-rc.1 in flight

No drift. Claims still hold, but a clean run only proves paths and versions : 
read the monorepo CHANGELOG for capabilities that changed underneath them.
```

## npm view starknet@next

```
starknet@10.7.0 | MIT | deps: 12 | versions: 328
JavaScript library for Starknet
https://github.com/starknet-io/starknet.js#readme

keywords: starknet, cairo, starkware, l2, zk, rollup

dist
.tarball: https://registry.npmjs.org/starknet/-/starknet-10.7.0.tgz
.shasum: 11e4328ae7e993e5c4a3c1ef172caab8690a05a1
.integrity: sha512-tHNQTqxCnmeR8slyQ9VfLxbBJmGj7eK0uxb13uVMjG6HNdPxxfDX2v0F41053VgX/3R8BHGd5gBxH+CP8LYT+w==
.unpackedSize: 6.3 MB

dependencies:
@noble/curves: ~1.7.0
@noble/hashes: ~1.6.0
@scure/base: ~1.2.1
@scure/starknet: 1.1.0
@starknet-io/get-starknet-wallet-standard-v6: npm:@starknet-io/get-starknet-wallet-standard@6.0.4
@starknet-io/get-starknet-wallet-standard: ^5.0.0
```

## npm view @starknet-io/get-starknet-discovery@next

```
@starknet-io/get-starknet-discovery@6.0.4 | MIT | deps: 4 | versions: 7
https://github.com/starknet-io/get-starknet#readme

keywords: starknet, starkware, l2, zk, rollup, wallet, dapp

dist
.tarball: https://registry.npmjs.org/@starknet-io/get-starknet-discovery/-/get-starknet-discovery-6.0.4.tgz
.shasum: e2cb62ae1d16e4fc8c0f69931b8eba2f3b46f61c
.integrity: sha512-lKmO/osLLPQKcTtkvu7dcE6/6Man//EH9mvMANPieLRTgJX5F7RKU4Kt+YdXhI4wCHnmZpctbXig5ANRzr+jag==
.unpackedSize: 42.3 kB

dependencies:
@starknet-io/get-starknet-virtual-wallet: ^6.0.4
@starknet-io/get-starknet-wallet-standard: ^6.0.4
@starknet-io/types-js: 0.10.4-beta.2
@wallet-standard/base: ^1.1.1
```

## npm view @starknet-io/get-starknet-wallet-standard@next

```
@starknet-io/get-starknet-wallet-standard@6.0.4 | MIT | deps: 4 | versions: 7
https://github.com/starknet-io/get-starknet#readme

keywords: starknet, starkware, l2, zk, rollup, wallet, dapp

dist
.tarball: https://registry.npmjs.org/@starknet-io/get-starknet-wallet-standard/-/get-starknet-wallet-standard-6.0.4.tgz
.shasum: 17c759c02692f8fe35cd17b986416b4a8eac51e4
.integrity: sha512-HhJlC7lSqaiFZPcn+nY4j3hNyzprt7KC7UZY6TFi8w1TNRYccGV9dwY2NtJ+bfLl5mv5ZSxt9OigRn9t6WzNLg==
.unpackedSize: 61.1 kB

dependencies:
@starknet-io/types-js: 0.10.4-beta.2
@wallet-standard/base: ^1.1.1
@wallet-standard/features: ^1.1.1
ox: ^0.4.4
```

## npm view @starknet-io/types-js

```
@starknet-io/types-js@0.10.3 | MIT | deps: none | versions: 51
Shared TypeScript definitions for Starknet projects
https://github.com/starknet-io/types-js

keywords: starknet, starkware, l2, zk, rollup, wallet, dapp

dist
.tarball: https://registry.npmjs.org/@starknet-io/types-js/-/types-js-0.10.3.tgz
.shasum: 724476fe89bd7be2c30954d253b7dd718c16a47f
.integrity: sha512-WtTGjqgyjqYSaSks/CQrpERGiLlwhr1TTD4llsr8IKEZHb78OJEmEhzrb/LxJV1SIz+MEsB1pioG62BOmFKYLA==
.unpackedSize: 247.0 kB

dist-tags:
alpha: 0.10.0-alpha.2
```

## npm view @avnu/avnu-sdk

```
@avnu/avnu-sdk@4.2.0 | MIT | deps: 4 | versions: 74
TypeScript SDK for building exchange functionality on Layers 2 with the AVNU API
https://github.com/avnu-labs/avnu-sdk#readme

keywords: starknet, l2, exchange, swap

dist
.tarball: https://registry.npmjs.org/@avnu/avnu-sdk/-/avnu-sdk-4.2.0.tgz
.shasum: 0aef92e272b18832dbbfc98bf2f5c768edd0a9f1
.integrity: sha512-7oEf+BavAhesZgFlwkOBL8i2JBx92uhJcBm8SfzefkFkQoM3IwAUsrl6vsKxua9STL5Nzc8nDXpxRVFLkV3Jug==
.unpackedSize: 4.9 MB

dependencies:
dayjs: ^1.11.19
moment: ^2.30.1
qs: ^6.14.1
zod: ^4.3.6
```

## Section 4 pin matches

STRK20_INTEGRATION_PLAN.md section 4 specifies these pins after 2026-08-14 freshness check:

- `starknet@10.4.0` exact: current next is 10.7.0 (drift)
- `@starknet-io/get-starknet-discovery@6.0.4`: MATCH
- `@starknet-io/get-starknet-wallet-standard@6.0.4`: MATCH
- `@starknet-io/types-js@0.10.3` Phase 1 stable: MATCH (latest)
- `@avnu/avnu-sdk@4.2.0` Phase 2: MATCH (latest)

Critical issue: @starknet-io/get-starknet-discovery@6.0.4 and @starknet-io/get-starknet-wallet-standard@6.0.4 both depend on @starknet-io/types-js@0.10.4-beta.2, not 0.10.3. Plan specifies 0.10.3 for Phase 1. This is a transitive dependency conflict. Pinning types-js@0.10.3 in package.json will need override or monorepo resolution.

starknet@10.7.0 (next) is 0.3.0 semver ahead of the pinned 10.4.0. Plan says "Do not leave a floating range against next" and to re-run the import check. Re-run required before npm install.

CLAUDE_SESSION_DONE haiku-pins
