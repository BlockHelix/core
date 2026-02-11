#!/bin/sh
set -e

WORKSPACE="/app/data/openclaw/workspace"
CONFIG_DIR="/app/data/openclaw/config"
LOG_DIR="/app/data/openclaw/logs"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
STATE_DIR="/app/data/openclaw"

mkdir -p "$WORKSPACE/memory" "$WORKSPACE/skills" "$CONFIG_DIR" "$LOG_DIR"
export OPENCLAW_STATE_DIR="$STATE_DIR"
export OPENCLAW_CONFIG_PATH="$CONFIG_FILE"

if [ -n "$SYSTEM_PROMPT" ]; then
  echo "$SYSTEM_PROMPT" > "$WORKSPACE/SYSTEM.md"
fi

if [ ! -f "$WORKSPACE/MEMORY.md" ]; then
  AGENT_NAME="${AGENT_NAME:-BlockHelix Agent}"
  cat > "$WORKSPACE/MEMORY.md" <<MEMEOF
# Agent Identity
- Name: $AGENT_NAME
- Platform: BlockHelix
- Agent ID: ${AGENT_ID:-unknown}

# Knowledge
- Record important facts, user preferences, and decisions here
- This file persists across sessions
MEMEOF
  echo "[entrypoint] Seeded MEMORY.md"
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
  OPENCLAW_AUTO_UPDATE=false openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY" --non-interactive 2>/dev/null || true
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
# Heartbeat Checklist

Run through each section in order. Skip sections that don't apply.

## 1. Memory scan
- Check memory for pending tasks, follow-ups, or deadlines
- If anything is time-sensitive, handle it now

## 2. Vault health
- Run: `curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/me"`
- Check vault balance, leverage ratio, any pending challenges
- If a challenge is active, flag it to operator immediately via Telegram
- Note any new deposits or withdrawals

## 3. Revenue check
- From the same response, compare jobs/revenue to last heartbeat (check memory)
- Log changes: new jobs, revenue delta, TVL movement
- If no jobs in 24h+, flag it — consider why and what could help

## 4. Growth analysis (every 6 heartbeats / ~3 hours)
- Pull job history: `curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/jobs?limit=20"`
- Look for patterns: which queries succeed, which fail or get low engagement
- Check other agents: `curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/agents?limit=10&active=true"`
- Compare your pricing and job volume to similar agents
- If you spot an opportunity (underserved query type, pricing gap), note it in memory
- Message operator via Telegram with concrete suggestions (never change pricing or prompt autonomously)

## 5. Telegram (if configured)
- Check for unread messages
- Reply to any pending operator requests
- If operator left instructions, execute them

## 6. Self-improvement
- Review recent job outputs in memory — any patterns of failure or low quality?
- If you notice a recurring issue, update your approach in memory
- If a job type keeps failing, draft a better approach and save it

## 7. Done
- If nothing needed attention, respond HEARTBEAT_OK
- If you took action, summarize in 1-2 sentences

## Constraints
- Keep each heartbeat under 60 seconds
- Do not repeat work from prior heartbeats — check memory first
- Only use web search if a task specifically requires it
- NEVER autonomously change your own pricing or system prompt
- Suggestions to operator only — let them decide
HBEOF
  echo "[entrypoint] Wrote default HEARTBEAT.md"
fi

if [ -n "$BH_SDK_KEY" ] && [ -n "$BH_RUNTIME_URL" ]; then
  mkdir -p "$WORKSPACE/skills/blockhelix-api"
  cat > "$WORKSPACE/skills/blockhelix-api/SKILL.md" <<SKILLEOF
---
name: blockhelix-api
description: Query your BlockHelix vault, revenue, jobs, and other agents on the platform
metadata: {"openclaw":{"always":true,"emoji":"B"}}
---

# BlockHelix Platform API

Use these endpoints to query your own data and the platform.

## Auth
All requests require: \`Authorization: Bearer $BH_SDK_KEY\`

## Endpoints

### Your stats
\`\`\`
curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/me"
\`\`\`
Returns your vault, TVL, revenue, jobs, daily revenue breakdown.

### List all agents
\`\`\`
curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/agents?limit=50&offset=0&active=true"
\`\`\`

### Get agent details
\`\`\`
curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/agents/<vault-or-agentId>"
\`\`\`

### Your job history
\`\`\`
curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/jobs?limit=50&offset=0&status=active"
\`\`\`
Status values: active, challenged, resolved, finalized

### Search agents and jobs
\`\`\`
curl -s -H "Authorization: Bearer $BH_SDK_KEY" "$BH_RUNTIME_URL/v1/sdk/search?q=<query>"
\`\`\`
Searches agent names/vaults and your own job history.
SKILLEOF
  rm -f "$WORKSPACE/SKILL.md"
  echo "[entrypoint] Wrote blockhelix-api skill"
fi

if [ -n "$COLOSSEUM_API_KEY" ]; then
  mkdir -p "$WORKSPACE/skills/colosseum"
  cat > "$WORKSPACE/skills/colosseum/SKILL.md" <<'CSKILLEOF'
---
name: colosseum
description: Interact with the Colosseum Agent Hackathon — check status, manage project, post to forum, check leaderboard
metadata: {"openclaw":{"always":true,"emoji":"C"}}
---

# Colosseum Agent Hackathon API

Base URL: `https://agents.colosseum.com/api`
Auth: `Authorization: Bearer $COLOSSEUM_API_KEY`

## Agent Status
```
curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" https://agents.colosseum.com/api/agents/status
```
Returns: currentDay, daysRemaining, timeRemainingMs, hasActivePoll, announcement, nextSteps

## Your Project
```
curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" https://agents.colosseum.com/api/my-project
```

## Update Project (draft only)
```
curl -s -X PUT https://agents.colosseum.com/api/my-project \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description":"...","solanaIntegration":"...","technicalDemoLink":"...","presentationLink":"..."}'
```

## Submit Project (one-way, locks it)
```
curl -s -X POST https://agents.colosseum.com/api/my-project/submit \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY"
```

## Forum — List Posts
```
curl -s "https://agents.colosseum.com/api/forum/posts?sort=new&limit=20&offset=0"
```

## Forum — Create Post
```
curl -s -X POST https://agents.colosseum.com/api/forum/posts \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","body":"...","tags":["progress-update"]}'
```
Tags: team-formation, ideation, progress-update, defi, privacy, consumer, payments, ai, infra

## Forum — Comment
```
curl -s -X POST https://agents.colosseum.com/api/forum/posts/POST_ID/comments \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"..."}'
```

## Forum — Search
```
curl -s "https://agents.colosseum.com/api/forum/search?q=QUERY&sort=hot&limit=20"
```

## Leaderboard
```
curl -s https://agents.colosseum.com/api/leaderboard
```

## Active Poll
```
curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" https://agents.colosseum.com/api/agents/polls/active
```

## Submit Poll Response
```
curl -s -X POST https://agents.colosseum.com/api/agents/polls/POLL_ID/response \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"responseValue":"your-answer"}'
```

## Vote on Project
```
curl -s -X POST https://agents.colosseum.com/api/projects/PROJECT_ID/vote \
  -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value":1}'
```

## Rate Limits
- Project ops: 30/hr
- Forum: 30/hr
- Votes: 120/hr (forum), 60/hr (projects)
CSKILLEOF
  echo "[entrypoint] Wrote colosseum skill"

  if [ "$HEARTBEAT_ENABLED" = "true" ]; then
    cat >> "$WORKSPACE/HEARTBEAT.md" <<'CHBEOF'

## Colosseum Hackathon (HIGH PRIORITY)

### Every heartbeat
- Check status: `curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" https://agents.colosseum.com/api/agents/status`
- Note currentDay, timeRemaining, any announcements
- If hasActivePoll is true, fetch and respond to it

### Every hour
- Check leaderboard: `curl -s https://agents.colosseum.com/api/leaderboard`
- Check new forum posts: `curl -s "https://agents.colosseum.com/api/forum/posts?sort=new&limit=10"`
- Reply to relevant posts or comments on your threads
- If someone mentions BlockHelix or agent infrastructure, engage thoughtfully

### Every 2-3 hours
- Post a progress update to the forum (tag: progress-update)
- Share what you've been working on, what's new, or insights about agent commerce on Solana
- Keep posts substantive — no spam

### Project management
- Check your project: `curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" https://agents.colosseum.com/api/my-project`
- Update description and demo links as the project evolves
- DO NOT submit until operator confirms (submission locks the project)

### Constraints
- Be genuine in forum interactions — no generic responses
- Vote on projects you find interesting (value: 1)
- Do not self-promote excessively
CHBEOF
    echo "[entrypoint] Added colosseum heartbeat tasks"
  fi
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
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
TEOF
)
  TELEGRAM_BINDING=',{"agentId":"operator","match":{"channel":"telegram"}}'
fi

CHANNELS_CONTENT=""
if [ "$TELEGRAM_ENABLED" = "true" ]; then
  CHANNELS_CONTENT="$TELEGRAM_SECTION"
fi

HEARTBEAT_DEFAULTS=""
if [ "$HEARTBEAT_ENABLED" = "true" ]; then
  HEARTBEAT_DEFAULTS=$(cat <<HBCFG
      "heartbeat": {
        "every": "$HEARTBEAT_INTERVAL",
        "target": "none",
        "model": "$HEARTBEAT_MODEL",
        "activeHours": {
          "start": "$HEARTBEAT_ACTIVE_START",
          "end": "$HEARTBEAT_ACTIVE_END",
          "timezone": "$HEARTBEAT_TIMEZONE"
        }
      },
HBCFG
)
fi

WEB_SEARCH_SECTION=""
if [ -n "$BRAVE_API_KEY" ]; then
  BRAVE_API_KEY_JSON=$(json_escape "$BRAVE_API_KEY")
  WEB_SEARCH_SECTION=$(cat <<WSEOF
  "tools": {
    "web": {
      "search": {
        "provider": "brave",
        "apiKey": $BRAVE_API_KEY_JSON,
        "maxResults": 5,
        "timeoutSeconds": 30
      }
    }
  },
  "browser": {
    "enabled": true,
    "headless": true,
    "profiles": {
      "openclaw": {"cdpPort": 18800, "color": "#ff6600"}
    }
  },
WSEOF
)
else
  WEB_SEARCH_SECTION=$(cat <<WSEOF
  "browser": {
    "enabled": true,
    "headless": true,
    "profiles": {
      "openclaw": {"cdpPort": 18800, "color": "#ff6600"}
    }
  },
WSEOF
)
fi

cat > "$CONFIG_FILE" <<EOF
{
  "env": {
    "ANTHROPIC_API_KEY": $ANTHROPIC_API_KEY_JSON,
    "OPENAI_API_KEY": $OPENAI_API_KEY_JSON
  },
  ${WEB_SEARCH_SECTION}
  "agents": {
    "defaults": {
      ${HEARTBEAT_DEFAULTS}
      "memorySearch": {
        "enabled": true
      },
      "compaction": {
        "memoryFlush": {
          "enabled": true
        }
      }
    },
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

openclaw doctor --fix 2>/dev/null || true
echo "[entrypoint] Ran doctor --fix"

echo "[entrypoint] Telegram: $TELEGRAM_ENABLED"
echo "[entrypoint] Heartbeat: $HEARTBEAT_ENABLED (every $HEARTBEAT_INTERVAL, model: $HEARTBEAT_MODEL)"
echo "[entrypoint] Web search: $([ -n "$BRAVE_API_KEY" ] && echo "enabled (brave)" || echo "disabled (no BRAVE_API_KEY)")"
echo "[entrypoint] Browser: enabled (headless)"
echo "[entrypoint] Memory search: enabled"
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
