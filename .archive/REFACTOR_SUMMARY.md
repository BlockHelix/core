# Agent Management Refactor - Summary

## What Changed

Replaced centralized admin API authentication with wallet-based operator dashboard.

## Key Changes

### 1. Storage Layer
- **New:** `/agent-runtime/src/services/storage.ts`
- Persistent JSON file storage at `/agent-runtime/data/agents.json`
- Tracks `ownerWallet`, `createdAt`, `updatedAt` for each agent
- Load on startup, save on changes

### 2. Wallet Authentication
- **New:** `/agent-runtime/src/services/wallet-verify.ts`
- Message signing with `tweetnacl` + `bs58`
- Signature format: `BlockHelix: <action> agent <agentId> at <timestamp>`
- 60-second message expiry
- Owner verification before updates

### 3. API Endpoints
**Updated:** `/agent-runtime/src/routes/admin.ts`
- Removed `ADMIN_SECRET` authentication
- Added `GET /admin/agents/by-owner?wallet=xxx` - List agents by owner
- Added `GET /admin/agents/:agentId?wallet=xxx` - Get full config (owner only)
- Added `PUT /admin/agents/:agentId` - Update config with signature
- `POST /admin/agents` now accepts `ownerWallet` field

**Updated:** `/agent-runtime/src/server.ts`
- Registered new dashboard routes
- No auth middleware needed

### 4. Frontend - Operator Dashboard
**New Pages:**
- `/app/src/app/dashboard/operator/page.tsx` - List operator's agents
- `/app/src/app/dashboard/agent/[id]/page.tsx` - Edit agent config

**New Components:**
- `/app/src/components/pages/OperatorDashboard.tsx` - Agent list UI
- `/app/src/components/pages/EditAgentContent.tsx` - Agent config editor

**Updated:**
- `/app/src/lib/runtime.ts` - Removed ADMIN_SECRET, added dashboard APIs
- `/app/src/components/pages/CreateContent.tsx` - Pass `ownerWallet` on registration
- `/app/src/components/Header.tsx` - Added "AGENTS" link to operator dashboard

### 5. Configuration
**Removed:**
- `ADMIN_SECRET` from runtime
- `NEXT_PUBLIC_ADMIN_SECRET` from frontend

**Added:**
- `/agent-runtime/data/` directory with `.gitignore`
- Empty `agents.json` for initialization

## Trust Model

**Capital on-chain = trust.** Operators prove ownership through wallet signatures. No centralized secrets.

## Migration Guide

### Before
```bash
# Deploy agent (wrong)
curl -X POST /admin/agents \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -d '{"agentId":"...","systemPrompt":"...","apiKey":"..."}'
```

### After
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

// Update via dashboard
// 1. Navigate to /dashboard/operator
// 2. Click "Configure" on agent
// 3. Edit prompt/price/API key
// 4. Sign with wallet
// 5. Changes saved
```

## User Flow

1. **Deploy Agent** → `/create`
   - Connect wallet
   - Fill form (prompt, price, API key)
   - On-chain deployment
   - Runtime registration with owner wallet

2. **Manage Agents** → `/dashboard/operator`
   - See all owned agents
   - Status, price, vault info
   - Click "Configure" to edit

3. **Edit Config** → `/dashboard/agent/[id]`
   - Update prompt, API key, price
   - Toggle active status
   - Sign message with wallet
   - Changes saved to storage

4. **Runtime Execution**
   - Load config from storage
   - Execute with stored prompt/key
   - Revenue flows to vault

## Testing

```bash
# 1. Start runtime
cd agent-runtime
npm run dev

# 2. Start frontend
cd app
npm run dev

# 3. Test flow
# - Visit http://localhost:3000
# - Connect wallet
# - Go to /create and deploy agent
# - Visit /dashboard/operator
# - Click "Configure" on agent
# - Update prompt/price
# - Sign and save
# - Runtime loads updated config
```

## Dependencies Added

**Runtime:**
```bash
npm install tweetnacl bs58 @types/bs58
```

**Frontend:**
```bash
npm install bs58
```

## Files Modified

### Runtime (8 files)
- `src/services/storage.ts` - NEW
- `src/services/wallet-verify.ts` - NEW
- `src/services/agent-config.ts` - Updated to use storage
- `src/routes/admin.ts` - Removed auth, added dashboard routes
- `src/server.ts` - Registered new routes
- `data/agents.json` - NEW (persistent storage)
- `data/.gitignore` - NEW
- `.env.example` - Removed ADMIN_SECRET

### Frontend (8 files)
- `components/pages/OperatorDashboard.tsx` - NEW
- `components/pages/EditAgentContent.tsx` - NEW
- `app/dashboard/operator/page.tsx` - NEW
- `app/dashboard/agent/[id]/page.tsx` - NEW
- `lib/runtime.ts` - Removed ADMIN_SECRET, added dashboard APIs
- `components/pages/CreateContent.tsx` - Pass ownerWallet
- `components/Header.tsx` - Added AGENTS link

### Documentation (2 files)
- `WALLET_AUTH.md` - NEW (detailed documentation)
- `REFACTOR_SUMMARY.md` - NEW (this file)

## Status

- All files compile successfully
- Frontend build passes
- Runtime build passes
- Ready for testing

## Next Steps

1. Test agent creation flow
2. Test dashboard edit flow
3. Verify signature verification works
4. Test runtime loads updated config
5. Deploy and iterate

## Notes

- Simple JSON file storage for hackathon
- Production: Replace with database (Postgres, Supabase)
- No breaking changes to existing agent execution
- Backwards compatible with existing agents (if migrated with ownerWallet)
