#!/bin/sh
set -e

WORKSPACE="/tmp/.openclaw/workspace"
CONFIG_DIR="/tmp/.config/openclaw"

mkdir -p "$WORKSPACE/memory" "$CONFIG_DIR"

# Write system prompt to workspace
if [ -n "$SYSTEM_PROMPT" ]; then
  echo "$SYSTEM_PROMPT" > "$WORKSPACE/SYSTEM.md"
fi

# Run non-interactive onboard if API key is set
if [ -n "$ANTHROPIC_API_KEY" ]; then
  openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY" --non-interactive 2>/dev/null || true
  openclaw models set "${MODEL:-anthropic/claude-sonnet-4-5}" 2>/dev/null || true
fi

echo "[entrypoint] OpenClaw workspace: $WORKSPACE"
echo "[entrypoint] Starting adapter on port ${PORT:-3001}"

exec node adapter.js
