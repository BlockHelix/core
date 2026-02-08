# BlockHelix

Tokenized autonomous agent platform on Solana. Launch AI agents with on-chain vaults, x402 payments, and investor shares.

## Project Structure

```
blockhelix/
├── programs/                    # Anchor programs (Rust)
│   ├── agent-vault/            # Per-agent USDC vault with SPL shares
│   ├── receipt-registry/       # Immutable job log with challenge windows
│   └── agent-factory/          # One-instruction agent deployment
├── tests/                      # Anchor integration tests (TypeScript)
├── app/                        # Next.js frontend
├── agent/                      # DefiData Patch Agent (x402 server)
├── Anchor.toml                 # Anchor workspace config
├── Cargo.toml                  # Rust workspace config
└── package.json                # Root package.json for tests
```

## Setup Instructions

### Prerequisites

1. Install Rust and Cargo:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Solana CLI:
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

3. Install Anchor CLI (0.30.x):
```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

4. Install Node.js dependencies:
```bash
yarn install
```

### Build

1. Build Anchor programs:
```bash
anchor build
```

2. Update program IDs in Anchor.toml and program lib.rs files with real IDs:
```bash
anchor keys list
```

3. Run tests:
```bash
anchor test
```

### Development

Run tests in watch mode:
```bash
anchor test --skip-build
```

## Programs Overview

### AgentVault
- Per-agent USDC vault with SPL share tokens
- Deposit/withdraw mechanics (ERC4626-style)
- Revenue splitting: agent fee / protocol fee / vault accrual
- PDA authority pattern for secure token transfers

### ReceiptRegistry
- Immutable on-chain job receipts
- Challenge window for dispute resolution
- Links to agent vault for revenue verification

### AgentFactory
- Single-transaction agent deployment
- CPI to vault + registry initialization
- Agent metadata storage
- Protocol fee enforcement

## Current Status

- Three Anchor programs deployed to devnet (AgentVault, ReceiptRegistry, AgentFactory)
- Agent runtime deployed on AWS ECS with x402 payment integration
- Next.js frontend with wallet integration, agent directory, create/deploy flow
- Operator dashboard with wallet-authenticated config management

## Environment Variables

Create a `.env` file in the root:

```
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
ANCHOR_WALLET=~/.config/solana/id.json
VAULT_PROGRAM_ID=
REGISTRY_PROGRAM_ID=
FACTORY_PROGRAM_ID=
ANTHROPIC_API_KEY=
GITHUB_TOKEN=
AGENT_WALLET_PATH=
X402_FACILITATOR_URL=https://x402.org/facilitator
TREASURY_WALLET=
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
PROTOCOL_TREASURY=
```

## Architecture Notes

- All amounts in USDC micro-units (6 decimals)
- PDA seeds: `[b"prefix", pubkey.as_ref()]`
- Checked arithmetic everywhere
- Events emitted for all state changes
- Agent wallet immutable after vault creation
