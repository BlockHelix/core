#!/bin/bash

echo "Testing Runtime Integration"
echo "============================"
echo ""

RUNTIME_URL="${RUNTIME_URL:-http://localhost:3001}"
ADMIN_SECRET="${ADMIN_SECRET:-test_secret}"

echo "1. Check runtime health"
curl -s "$RUNTIME_URL/health" | jq '.' || echo "Runtime not responding"
echo ""

echo "2. Test agent registration (this will fail without proper auth)"
curl -X POST "$RUNTIME_URL/admin/agents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{
    "agentId": "test-agent-123",
    "name": "Test Agent",
    "systemPrompt": "You are a helpful test agent.",
    "priceUsdcMicro": 50000,
    "model": "claude-sonnet-4-20250514",
    "agentWallet": "11111111111111111111111111111111",
    "vault": "11111111111111111111111111111112",
    "registry": "",
    "isActive": true
  }' | jq '.'
echo ""

echo "3. List all agents"
curl -s -H "Authorization: Bearer $ADMIN_SECRET" "$RUNTIME_URL/admin/agents" | jq '.'
echo ""

echo "Done!"
