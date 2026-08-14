#!/usr/bin/env bash
# Dispatch one Claude Code session on TWO axes: model size and thinking effort.
#
# Claude Code 2.1.220 flags (verified):
#   --model  haiku | sonnet | opus | fable
#   --effort low | medium | high | xhigh | max
#
# Haiku has no adjustable effort. Do not pass --effort.
# Fable is permanently max effort. Do not pass --effort.
# Sonnet high often beats Opus low for bounded coding. Prefer that over
# spending Opus on work that is hard-but-specced.
#
# Usage:
#   scripts/claude-dispatch.sh <preset> <name> <prompt-file>
#   scripts/claude-dispatch.sh <model>/<effort> <name> <prompt-file>
#
# Presets:
#   SORT       haiku            high-volume reads, pins, curl, format
#   CODE       sonnet/medium    specced edits, tests, routine review
#   CODE-HARD  sonnet/high      subtle bugs, multi-file but one correct shape
#   JUDGE      opus/high        architecture, security, plan holes
#   DEEP       opus/xhigh       cross-source contradiction, irreversible calls
#   MAX        fable            longest judgment, do not use for typing
#
# Writes /tmp/neobank-claude-out/<name>.{json,err}
set -euo pipefail

spec="${1:?preset or model/effort}"
name="${2:?session name}"
prompt="${3:?prompt file}"

model=""
effort=""   # empty means do not pass --effort

case "$spec" in
  SORT|LOW|HAIKU)     model=haiku;  effort="" ;;
  CODE|MEDIUM)        model=sonnet; effort=medium ;;
  CODE-HARD)          model=sonnet; effort=high ;;
  JUDGE|HIGH)         model=opus;   effort=high ;;
  DEEP)               model=opus;   effort=xhigh ;;
  MAX|FABLE)          model=fable;  effort="" ;;
  haiku|haiku/*)      model=haiku;  effort="" ;;
  fable|fable/*)      model=fable;  effort="" ;;
  */*)
    model="${spec%%/*}"
    effort="${spec##*/}"
    ;;
  *)
    echo "unknown spec: $spec" >&2
    echo "use SORT|CODE|CODE-HARD|JUDGE|DEEP|MAX or model/effort" >&2
    exit 2
    ;;
esac

case "$model" in
  haiku|sonnet|opus|fable) ;;
  *) echo "unknown model: $model" >&2; exit 2 ;;
esac

if [ -n "$effort" ]; then
  case "$effort" in
    low|medium|high|xhigh|max) ;;
    *) echo "unknown effort: $effort (low|medium|high|xhigh|max)" >&2; exit 2 ;;
  esac
fi

# Haiku and Fable ignore or reject adjustable effort. Drop it.
if [ "$model" = haiku ] || [ "$model" = fable ]; then
  effort=""
fi

if [ ! -f "$prompt" ]; then
  echo "prompt file missing: $prompt" >&2
  exit 2
fi

mkdir -p /tmp/neobank-claude-out
cd /Users/kamal/Desktop/neobank

args=(
  -p
  --model "$model"
  --output-format json
  --permission-mode acceptEdits
  --allowedTools Read,Write,Edit,Grep,Glob,WebFetch,WebSearch,Bash
  --disable-slash-commands
  --name "claude-${model}${effort:+-$effort}-$name"
)
if [ -n "$effort" ]; then
  args+=(--effort "$effort")
fi

echo "LAUNCH name=$name spec=$spec model=$model effort=${effort:-none}"
claude "${args[@]}" "$(cat "$prompt")" \
  > "/tmp/neobank-claude-out/${name}.json" \
  2> "/tmp/neobank-claude-out/${name}.err"
echo "EXIT name=$name code=$? model=$model effort=${effort:-none}"
