# Wallet-Authenticated Agent Management

## Overview

Agent management now uses wallet authentication instead of admin API secrets. Operators manage their agents through a dashboard, and the runtime reads configuration from persistent storage.

## Trust Model

**Capital on-chain = trust.** No centralized admin secrets needed. Operators prove ownership through wallet signatures.

## Architecture

### Storage Layer
- `/agent-runtime/data/agents.json` - Persistent agent configuration
- Loaded on startup, saved on changes
- Schema: `{ [agentId]: { ...config, ownerWallet, createdAt, updatedAt } }`

### Authentication
- Wallet signature verification using `tweetnacl` and `bs58`
- Message format: `BlockHelix: <action> agent <agentId> at <timestamp>`
- Signatures expire after 60 seconds
- Owner wallet must match stored `ownerWallet` field

### API Endpoints

**Public (No Auth)**
- `GET /v1/agents` - List all active agents
- `GET /v1/agent/:agentId` - Get agent metadata
- `POST /admin/agents` - Register new agent

**Wallet-Authenticated**
- `GET /admin/agents/by-owner?wallet=xxx` - List agents by owner
- `GET /admin/agents/:agentId?wallet=xxx` - Get full config (owner only)
- `PUT /admin/agents/:agentId` - Update agent config (requires signature)

### Frontend Pages

**`/dashboard/operator`** - Operator Dashboard
- Lists all agents owned by connected wallet
- Shows status, price, vault link
- Configure button links to edit page

**`/dashboard/agent/[id]`** - Edit Agent
- Update system prompt, API key, price, active status
- Requires wallet signature for changes
- Owner-only access

**`/dashboard`** - Investor Dashboard (unchanged)
- Shows vault positions and P&L

## Usage Flow

### 1. Deploy Agent
1. Operator connects wallet
2. Fills create form (name, prompt, price, API key)
3. On-chain deployment creates vault
4. Runtime registration stores config with `ownerWallet`
5. Agent is live

### 2. Manage Agent
1. Visit `/dashboard/operator`
2. Click "Configure" on agent
3. Edit prompt/price/API key
4. Sign message with wallet
5. Changes saved to storage
6. Runtime reads updated config on next call

### 3. Runtime Execution
1. Call arrives at `/v1/agent/:agentId/run`
2. Runtime loads config from storage (or on-chain fallback)
3. Executes with stored prompt and API key
4. Revenue flows to vault on-chain

## Security

- API keys stored in `agents.json` (not exposed via API)
- Only owner wallet can view/update full config
- Signature verification prevents replay attacks
- Message expiry prevents stale signatures
- No centralized admin secret

## Migration

### Before (wrong)
```bash
ADMIN_SECRET=secret123
curl -X POST /admin/agents \
  -H "Authorization: Bearer secret123" \
  -d '{"agentId":"...","systemPrompt":"...",...}'
```

### After (correct)
```typescript
// Frontend registers with owner wallet
await registerAgentWithRuntime({
  agentId,
  name,
  systemPrompt,
  apiKey,
  ownerWallet: wallet.address,
  ...
});

// Later: update with signature
const message = `BlockHelix: update agent ${agentId} at ${Date.now()}`;
const signature = await wallet.signMessage(message);

await fetch('/admin/agents/:agentId', {
  method: 'PUT',
  body: JSON.stringify({
    message,
    signature,
    wallet: wallet.address,
    updates: { systemPrompt, apiKey, ... }
  })
});
```

## Files Changed

### Runtime
- `/agent-runtime/src/services/storage.ts` - New persistent storage
- `/agent-runtime/src/services/wallet-verify.ts` - Signature verification
- `/agent-runtime/src/services/agent-config.ts` - Use storage instead of in-memory
- `/agent-runtime/src/routes/admin.ts` - Remove ADMIN_SECRET, add wallet auth
- `/agent-runtime/src/server.ts` - New dashboard routes
- `/agent-runtime/data/agents.json` - Persistent storage file

### Frontend
- `/app/src/lib/runtime.ts` - Remove ADMIN_SECRET, add dashboard APIs
- `/app/src/components/pages/OperatorDashboard.tsx` - List operator's agents
- `/app/src/components/pages/EditAgentContent.tsx` - Edit agent config
- `/app/src/app/dashboard/operator/page.tsx` - Operator dashboard route
- `/app/src/app/dashboard/agent/[id]/page.tsx` - Edit agent route
- `/app/src/components/Header.tsx` - Add operator link

## Dependencies

```bash
# Runtime
npm install tweetnacl bs58 @types/bs58

# Frontend
npm install bs58
```

## Environment Variables

### Removed
- `ADMIN_SECRET` - No longer used
- `NEXT_PUBLIC_ADMIN_SECRET` - No longer used

### Optional
- `DEFAULT_AGENT_*` - For pre-loading a default agent on startup

## Testing

1. Start runtime: `cd agent-runtime && npm run dev`
2. Start frontend: `cd app && npm run dev`
3. Connect wallet
4. Create agent at `/create`
5. Visit `/dashboard/operator`
6. Click "Configure" on agent
7. Edit prompt/price
8. Sign and save
9. Runtime loads updated config on next call

## Notes

- Hackathon-ready: Simple JSON file storage
- Production: Replace with database (Postgres, Supabase, etc.)
- Capital on-chain is the trust model
- No API secrets to manage or rotate
- Operators control their own agents
