# Parallel Claude Code sessions: 2026-08-14

Four headless Claude Code sessions plus two Claude-process subagents and one read-only explorer. No Phase 1 app code. Plan still needs explicit approval.

## How to actually run Claude in parallel

`claude --bg` starts an idle PTY and **does not consume the prompt**. Four earlier `--bg` sessions sat `blocked` until killed.

What works:

```
cat prompt.md | claude -p --output-format json \
  --permission-mode acceptEdits \
  --allowedTools Read,Write,Edit,Grep,Glob,WebFetch,WebSearch,Bash \
  --disable-slash-commands --effort medium --name neobank-topic
```

Run one process per topic. Do not combine `-p` with `--bg`. Auth on this machine: Claude Max (`claude.ai`), `claude auth status` logged in.

## Sessions that wrote files

| Name | Session ID | Exit | File | Last line |
|---|---|---|---|---|
| neobank-wallet-api | fb0a2ccc-f491-41dd-9c60-be770052209f | 0 at 10:00:57Z | `docs/research/claude-wallet-api.md` | CLAUDE_SESSION_DONE wallet-api |
| neobank-starter-kit | 62d234ad-4d98-445d-a485-d2702c933a3a | 0 at 09:59:54Z | `docs/research/claude-starter-kit.md` | CLAUDE_SESSION_DONE starter-kit |
| neobank-first-party-defi | c66921d0-e4b3-46e6-9b08-6ec2d54313b5 | 0 at 10:00:21Z | `docs/research/claude-first-party-defi.md` | CLAUDE_SESSION_DONE first-party-defi |
| neobank-challenge | efb34480-f931-4f59-b091-069d7d8a8253 | 0 at 10:01:53Z | `docs/research/claude-challenge-plan.md` | CLAUDE_SESSION_DONE challenge |
| kimi-coder payments | 019fffb5-102e-7c71-a5de-5cdd22cfb97b | 0 | `docs/research/claude-payments-eth712.md` | CLAUDE_SESSION_DONE payments-eth712 |
| kimi-coder privacy-sdk | 019fffb5-102e-7c71-a5de-5cc8465d26c2 | failed | none | tokenrouter 503, no Kimi K3 channel |
| explore org scan | 019fffb5-102f-7e73-b2b4-fdb717d29497 | 0 | this file + plan patches | no file (read-only) |

Privacy SDK writeup was finished in-host after the Kimi fail: `docs/research/claude-privacy-sdk.md`.

All four Claude jobs launched together at 09:58:05Z and finished in about four minutes.

## Findings we absorbed into the plans

1. Demo floor is connect + shield + private send. DeFi and a statement PDF are stretch. A 90-second shield-then-spend is impossible without bundling (notes mature ~10 blocks).
2. Prefer AVNU for the sprint DeFi leg. Vesu is a class hash in the monorepo README, not a verified instance address.
3. Pin exact packages, not ranges against `next`. Starter kit commit to copy from: `187fe78`.
4. Recipient must already be registered. The dapp cannot register them.
5. Signers live on privacy-client 0.1.0, not on the SDK. SDK is 0.14.3-rc.5.
6. Madu and Eth712 remain UNVERIFIED deploys. Not v0.

## Still not started

Phase 1 scaffold. Skill requires explicit approval of `STRK20_INTEGRATION_PLAN.md`.
