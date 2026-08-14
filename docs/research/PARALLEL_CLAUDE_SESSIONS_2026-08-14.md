# Parallel Claude Code sessions: 2026-08-14

Four headless Claude Code sessions plus two Claude-process subagents and one read-only explorer. No Phase 1 app code. Plan still needs explicit approval.

## How to actually run Claude in parallel

Grok's subagent panel only lists `spawn_subagent` types (`kimi-coder`, `explore`, ...). It cannot take `--model haiku|sonnet|opus`. Direct Claude Code is `scripts/claude-dispatch.sh`.

`claude --bg` starts an idle PTY and does not consume the prompt.

```
scripts/claude-dispatch.sh LOW    <name> <prompt-file>   # haiku,  effort low
scripts/claude-dispatch.sh MEDIUM <name> <prompt-file>   # sonnet, effort medium
scripts/claude-dispatch.sh HIGH   <name> <prompt-file>   # opus,   effort high
```

Watch them in Claude Code: `claude agents --json --cwd /Users/kamal/Desktop/neobank`.
They will not appear as Grok "kimi" rows. Do not combine `-p` with `--bg`. Auth: Claude Max.

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

Second wave, model-tiered Claude Code (visible as `claude-haiku-pins`, `claude-sonnet-skill-drift`, `claude-opus-open-q`):

| Tier | Model | Session | File |
|---|---|---|---|
| LOW | haiku | b8f36ae6-e6c3-420a-89a1-6dba541d2d0a | `docs/research/claude-haiku-pins.md` |
| MEDIUM | sonnet | 9b328404-b765-4707-9138-cd67e0eb0a6c | `docs/research/claude-sonnet-skill-drift.md` + sdk-route.md |
| HIGH | opus | a978521f-3e00-4463-b1ad-a5b32b906413 | `docs/research/claude-opus-open-questions.md` |

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
