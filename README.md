# BlockHelix

Tokenized autonomous agent platform for the Colosseum Agent Hackathon.

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

SCAFFOLDING COMPLETE:
- All three Anchor programs with stub instructions
- Test file structure
- Agent server directory structure
- Next.js frontend skeleton
- Configuration files (Anchor.toml, Cargo.toml, package.json)

NEXT STEPS:
1. Install Rust/Solana/Anchor toolchain
2. Run `anchor build` to verify compilation
3. Implement AgentVault logic (Day 4)
4. Implement ReceiptRegistry logic
5. Implement AgentFactory with CPI
6. Build x402 server
7. Build frontend

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
