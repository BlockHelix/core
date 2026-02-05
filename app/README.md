# BlockHelix Frontend

Terminal-Luxe DeFi interface for tokenized autonomous agents on Solana.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and configure:
```bash
cp .env.example .env.local
```

3. Update environment variables in `.env.local`:
- `NEXT_PUBLIC_VAULT_PROGRAM_ID` - AgentVault program ID
- `NEXT_PUBLIC_REGISTRY_PROGRAM_ID` - ReceiptRegistry program ID
- `NEXT_PUBLIC_FACTORY_PROGRAM_ID` - AgentFactory program ID
- `NEXT_PUBLIC_USDC_MINT` - USDC mint address (devnet)
- `NEXT_PUBLIC_PROTOCOL_TREASURY` - Protocol treasury address
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy app ID for wallet authentication
- `NEXT_PUBLIC_RPC_URL` - Solana RPC endpoint (default: devnet)

4. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

### Pages
- `/` - Agent Directory (landing page with all agents)
- `/create` - Create Agent form
- `/agent/[id]` - Agent detail with vault stats and invest/withdraw
- `/dashboard` - User dashboard showing positions

### Hooks
- `usePrograms` - Anchor program instances
- `useAgentList` - Fetch all agents from AgentFactory
- `useAgentDetails` - Fetch single agent + vault + registry data
- `useJobReceipts` - Fetch job receipts for an agent
- `useCreateAgent` - Create agent via factory (CPI to vault + registry)
- `useDeposit` / `useWithdraw` - Vault deposit/withdraw transactions
- `useDashboardData` - User positions across vaults

### Design System

**Terminal-Luxe:** Dark theme, monospace for data, refined spacing, subtle animations.

**Colors:**
- Backgrounds: `#0a0a0f` (bg), `#12121a` (card), `#1a1a28` (elevated)
- Text: `#e4e4e7` (primary), `#a1a1aa` (secondary), `#52525b` (tertiary)
- Accents: `#22d3ee` (cyan/primary), `#a78bfa` (violet), `#4ade80` (green/revenue), `#fbbf24` (amber), `#f87171` (red)

**Typography:**
- Display/data: JetBrains Mono (non-negotiable for numbers, addresses, amounts)
- Body: Geist Sans (via Next.js font)

**Key Rules:**
- All numbers, amounts, addresses: monospace
- Desktop-first, mobile-friendly
- Skeleton loaders (never spinners)
- Toast all transactions
- Copy button on every address

## Deployment

Build for production:
```bash
npm run build
```

Deploy to Vercel:
```bash
vercel
```

## IDL Files

IDL files are in `src/lib/idl/`:
- `agent_vault.json` - AgentVault program
- `agent_factory.json` - AgentFactory program
- `receipt_registry.json` - ReceiptRegistry program

TypeScript types are generated from IDL files by @coral-xyz/anchor.
