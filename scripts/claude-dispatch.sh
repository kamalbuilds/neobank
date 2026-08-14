#!/usr/bin/env bash
# Thin wrapper. The matrix lives in the global claude-route skill.
# Usage: scripts/claude-dispatch.sh <preset|model/effort> <name> <prompt-file>
set -euo pipefail
exec "$HOME/.agents/skills/claude-route/scripts/dispatch.sh" "$@" --cwd /Users/kamal/Desktop/neobank
