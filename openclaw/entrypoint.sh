#!/bin/sh
set -e

WORKSPACE="/app/data/openclaw/workspace"
CONFIG_DIR="/app/data/openclaw/config"
LOG_DIR="/app/data/openclaw/logs"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
STATE_DIR="/app/data/openclaw"

mkdir -p "$WORKSPACE/memory" "$CONFIG_DIR" "$LOG_DIR"
export OPENCLAW_STATE_DIR="$STATE_DIR"
export OPENCLAW_CONFIG_PATH="$CONFIG_FILE"

if [ -n "$SYSTEM_PROMPT" ]; then
  echo "$SYSTEM_PROMPT" > "$WORKSPACE/SYSTEM.md"
fi

DEFAULT_MODEL="claude-sonnet-4-20250514"
RAW_MODEL="${MODEL:-$DEFAULT_MODEL}"
if echo "$RAW_MODEL" | grep -q "/"; then
  MODEL_ID="$RAW_MODEL"
else
  MODEL_ID="anthropic/$RAW_MODEL"
fi

PROVIDER=$(echo "$MODEL_ID" | cut -d'/' -f1)
if [ "$PROVIDER" = "anthropic" ]; then
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "[entrypoint] ERROR: ANTHROPIC_API_KEY is required for model $MODEL_ID"
    exit 1
  fi
  openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY" --non-interactive 2>/dev/null || true
  openclaw models set "$MODEL_ID" 2>/dev/null || true
elif [ "$PROVIDER" = "openai" ]; then
  if [ -z "$OPENAI_API_KEY" ]; then
    echo "[entrypoint] ERROR: OPENAI_API_KEY is required for model $MODEL_ID"
    exit 1
  fi
  openclaw models set "$MODEL_ID" 2>/dev/null || true
fi
GATEWAY_PORT=18789
GATEWAY_AUTH="${GATEWAY_AUTH_TOKEN:-default-local-token}"
export OPENCLAW_GATEWAY_TOKEN="$GATEWAY_AUTH"

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1] ?? ""))' "$1"
}

ANTHROPIC_API_KEY_JSON=$(json_escape "$ANTHROPIC_API_KEY")
OPENAI_API_KEY_JSON=$(json_escape "$OPENAI_API_KEY")
GATEWAY_AUTH_JSON=$(json_escape "$GATEWAY_AUTH")

HEARTBEAT_ENABLED="${HEARTBEAT_ENABLED:-false}"
HEARTBEAT_INTERVAL="${HEARTBEAT_INTERVAL:-30m}"
HEARTBEAT_MODEL="${HEARTBEAT_MODEL:-anthropic/claude-haiku-4-5-20251001}"
HEARTBEAT_ACTIVE_START="${HEARTBEAT_ACTIVE_START:-09:00}"
HEARTBEAT_ACTIVE_END="${HEARTBEAT_ACTIVE_END:-22:00}"
HEARTBEAT_TIMEZONE="${HEARTBEAT_TIMEZONE:-America/New_York}"

if [ "$HEARTBEAT_ENABLED" = "true" ] && [ ! -f "$WORKSPACE/HEARTBEAT.md" ]; then
  cat > "$WORKSPACE/HEARTBEAT.md" <<'HBEOF'
# Heartbeat checklist

## Each check
- Scan memory for anything time-sensitive or pending
- If you have pending tasks or follow-ups, work on them
- If nothing needs attention, respond HEARTBEAT_OK

## Constraints
- Keep alerts under 2 sentences
- If nothing needs attention, respond HEARTBEAT_OK
- Do not repeat old tasks from prior conversations
HBEOF
  echo "[entrypoint] Wrote default HEARTBEAT.md"
fi

TELEGRAM_ENABLED=false
TELEGRAM_SECTION=""
TELEGRAM_BINDING=""
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  TELEGRAM_ENABLED=true
  TELEGRAM_BOT_TOKEN_JSON=$(json_escape "$TELEGRAM_BOT_TOKEN")
  TELEGRAM_SECTION=$(cat <<TEOF
    "telegram": {
      "enabled": true,
      "botToken": $TELEGRAM_BOT_TOKEN_JSON,
      "dmPolicy": "allowAll"
    }
TEOF
)
  TELEGRAM_BINDING=',{"agentId":"operator","match":{"channel":"telegram"}}'
fi

CHANNELS_CONTENT=""
if [ "$TELEGRAM_ENABLED" = "true" ]; then
  CHANNELS_CONTENT="$TELEGRAM_SECTION"
fi

HEARTBEAT_SECTION=""
if [ "$HEARTBEAT_ENABLED" = "true" ]; then
  HEARTBEAT_SECTION=$(cat <<HBCFG
    "defaults": {
      "heartbeat": {
        "every": "$HEARTBEAT_INTERVAL",
        "target": "none",
        "model": "$HEARTBEAT_MODEL",
        "activeHours": {
          "start": "$HEARTBEAT_ACTIVE_START",
          "end": "$HEARTBEAT_ACTIVE_END",
          "timezone": "$HEARTBEAT_TIMEZONE"
        }
      }
    },
HBCFG
)
fi

cat > "$CONFIG_FILE" <<EOF
{
  "env": {
    "ANTHROPIC_API_KEY": $ANTHROPIC_API_KEY_JSON,
    "OPENAI_API_KEY": $OPENAI_API_KEY_JSON
  },
  "agents": {
    ${HEARTBEAT_SECTION}
    "list": [
      {
        "id": "operator",
        "workspace": "$WORKSPACE",
        "model": "$MODEL_ID"
      },
      {
        "id": "public",
        "workspace": "$WORKSPACE",
        "model": "$MODEL_ID"
      }
    ]
  },
  "bindings": [
    {"agentId":"public","match":{"channel":"webchat"}}${TELEGRAM_BINDING}
  ],
  "channels": {
    ${CHANNELS_CONTENT}
  },
  "gateway": {
    "mode": "local",
    "port": $GATEWAY_PORT,
    "bind": "loopback",
    "auth": {"mode":"token","token": $GATEWAY_AUTH_JSON},
    "http": {
      "endpoints": {
        "chatCompletions": {"enabled": true}
      }
    }
  }
}
EOF

echo "[entrypoint] Config written to $CONFIG_FILE"
echo "[entrypoint] Telegram: $TELEGRAM_ENABLED"
echo "[entrypoint] Heartbeat: $HEARTBEAT_ENABLED (every $HEARTBEAT_INTERVAL, model: $HEARTBEAT_MODEL)"
echo "[entrypoint] Starting OpenClaw gateway on :$GATEWAY_PORT (model: $MODEL_ID)"

openclaw gateway run --allow-unconfigured --port "$GATEWAY_PORT" --bind "loopback" --auth "token" 2>&1 | tee "$LOG_DIR/gateway.log" &
GATEWAY_PID=$!

echo "[entrypoint] Waiting for gateway (pid $GATEWAY_PID) to be healthy..."
RETRIES=0
MAX_RETRIES=30
health_check() {
  if command -v curl >/dev/null 2>&1; then
    curl -sf "http://localhost:$GATEWAY_PORT/health" > /dev/null 2>&1
    return $?
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO- "http://localhost:$GATEWAY_PORT/health" > /dev/null 2>&1
    return $?
  fi
  node -e "fetch('http://localhost:$GATEWAY_PORT/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
}

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if health_check; then
    echo "[entrypoint] Gateway healthy!"
    break
  fi
  if ! kill -0 $GATEWAY_PID 2>/dev/null; then
    echo "[entrypoint] ERROR: Gateway process died"
    if [ -f "$LOG_DIR/gateway.log" ]; then
      echo "[entrypoint] Gateway log tail:"
      tail -n 200 "$LOG_DIR/gateway.log" || true
    fi
    exit 1
  fi
  RETRIES=$((RETRIES + 1))
  sleep 2
done

if [ $RETRIES -ge $MAX_RETRIES ]; then
  echo "[entrypoint] ERROR: Gateway failed to become healthy after $MAX_RETRIES attempts"
  exit 1
fi

echo "[entrypoint] Starting adapter on port ${PORT:-3001}"
exec node adapter.js
