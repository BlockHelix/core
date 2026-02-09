#!/bin/sh
set -e

WORKSPACE="/app/data/openclaw/workspace"
CONFIG_DIR="/app/data/openclaw/config"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"

mkdir -p "$WORKSPACE/memory" "$CONFIG_DIR"

if [ -n "$SYSTEM_PROMPT" ]; then
  echo "$SYSTEM_PROMPT" > "$WORKSPACE/SYSTEM.md"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
  openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY" --non-interactive 2>/dev/null || true
  openclaw models set "${MODEL:-anthropic/claude-sonnet-4-5}" 2>/dev/null || true
fi

MODEL_ID="anthropic/${MODEL:-claude-sonnet-4-5}"
GATEWAY_PORT=18789
GATEWAY_AUTH="${GATEWAY_AUTH_TOKEN:-default-local-token}"

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1] ?? ""))' "$1"
}

ANTHROPIC_API_KEY_JSON=$(json_escape "$ANTHROPIC_API_KEY")
GATEWAY_AUTH_JSON=$(json_escape "$GATEWAY_AUTH")

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

cat > "$CONFIG_FILE" <<EOF
{
  "env": {
    "ANTHROPIC_API_KEY": $ANTHROPIC_API_KEY_JSON
  },
  "agents": {
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
    "port": $GATEWAY_PORT,
    "bind": "loopback",
    "auth": {"mode":"token","token": $GATEWAY_AUTH_JSON}
  }
}
EOF

echo "[entrypoint] Config written to $CONFIG_FILE"
echo "[entrypoint] Telegram: $TELEGRAM_ENABLED"
echo "[entrypoint] Starting OpenClaw gateway on :$GATEWAY_PORT"

openclaw gateway --config "$CONFIG_FILE" &
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
