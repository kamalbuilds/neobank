#!/usr/bin/env bash
# Dispatch one Claude Code session. Model is chosen by task tier, not by project.
#   LOW    -> haiku  --effort low
#   MEDIUM -> sonnet --effort medium
#   HIGH   -> opus   --effort high
#
# Usage: scripts/claude-dispatch.sh <LOW|MEDIUM|HIGH> <name> <prompt-file>
# Writes /tmp/neobank-claude-out/<name>.{json,err}
set -euo pipefail

tier="${1:?tier LOW|MEDIUM|HIGH}"
name="${2:?session name}"
prompt="${3:?prompt file}"

case "$tier" in
  LOW)    model=haiku;  effort=low ;;
  MEDIUM) model=sonnet; effort=medium ;;
  HIGH)   model=opus;   effort=high ;;
  *) echo "tier must be LOW, MEDIUM, or HIGH" >&2; exit 2 ;;
esac

mkdir -p /tmp/neobank-claude-out
cd /Users/kamal/Desktop/neobank

echo "LAUNCH name=$name tier=$tier model=$model effort=$effort"
claude -p \
  --model "$model" \
  --effort "$effort" \
  --output-format json \
  --permission-mode acceptEdits \
  --allowedTools Read,Write,Edit,Grep,Glob,WebFetch,WebSearch,Bash \
  --disable-slash-commands \
  --name "claude-$model-$name" \
  "$(cat "$prompt")" \
  > "/tmp/neobank-claude-out/${name}.json" \
  2> "/tmp/neobank-claude-out/${name}.err"
echo "EXIT name=$name code=$?"
