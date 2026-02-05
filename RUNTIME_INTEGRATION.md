# Runtime Integration Guide

## Overview

When a user creates an agent through the frontend, two things happen:

1. **On-chain deployment** via AgentFactory program (creates vault, registry, metadata)
2. **Runtime registration** via HTTP POST to the hosted runtime server

This ensures the agent is both on-chain and available for inference requests.

## Flow

### 1. User submits Create Agent form

Form collects:
- Name
- Description (optional)
- GitHub handle (optional)
- System prompt (the agent's behavior)
- Price per call (USDC)

### 2. On-chain deployment

`CreateContent.tsx` calls `useCreateAgent()` hook which:
- Derives PDAs (vault, share mint, registry, metadata)
- Calls `factoryProgram.methods.createAgent()`
- Returns: `{ signature, agentWallet, vaultState }`

The agent's wallet address is used as the agentId.

### 3. Runtime registration

After successful on-chain tx, frontend calls:

```
POST {RUNTIME_URL}/admin/agents
Authorization: Bearer {ADMIN_SECRET}
Content-Type: application/json

{
  "agentId": "agent_wallet_address",
  "name": "Agent Name",
  "systemPrompt": "You are...",
  "priceUsdcMicro": 50000,
  "model": "claude-sonnet-4-20250514",
  "agentWallet": "agent_wallet_address",
  "vault": "vault_pda_address",
  "registry": "",
  "isActive": true
}
```

Runtime server:
- Validates admin auth
- Stores config in memory
- Makes agent available at `/v1/agent/{agentId}/run`

### 4. Error handling

If on-chain succeeds but runtime fails:
- Agent is still created on-chain
- User gets warning toast
- Agent won't be callable until manually registered

## Environment Variables

### Frontend (`app/.env.local`)

```
NEXT_PUBLIC_RUNTIME_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_SECRET=your_secret_here
```

### Runtime (`agent-runtime/.env`)

```
ADMIN_SECRET=your_secret_here
PORT=3001
```

**IMPORTANT:** Use the same secret in both places.

## Files Modified

- `/app/src/components/pages/CreateContent.tsx` - Main form logic
- `/app/src/lib/runtime.ts` - Runtime API client
- `/app/.env.example` - Added ADMIN_SECRET
- `/agent-runtime/.env.example` - Added ADMIN_SECRET
- `/agent-runtime/src/routes/admin.ts` - Admin endpoints (already existed)

## Testing

1. Start runtime: `cd agent-runtime && npm run dev`
2. Start frontend: `cd app && npm run dev`
3. Set matching ADMIN_SECRET in both `.env` files
4. Connect wallet and create agent
5. Check runtime logs for registration confirmation
6. Visit `/v1/agent/{agentId}` to verify agent is hosted

## Security Notes

- Admin endpoints require Bearer token auth
- ADMIN_SECRET should be strong and kept private
- Frontend exposes secret in client bundle (acceptable for hackathon, production should use backend proxy)
- Runtime validates all required fields before registration

## Future Improvements

- Backend API route to proxy admin calls (hide secret)
- Retry logic for failed runtime registration
- Webhook from runtime back to frontend on registration success
- Support for updating agent config after creation
