#!/bin/bash
set -e

echo "Building all programs..."
anchor build

echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "Syncing IDLs to frontend..."
cp target/idl/agent_vault.json app/src/lib/idl/agent_vault.json
cp target/types/agent_vault.ts app/src/lib/idl/agent_vault.ts
cp target/idl/agent_factory.json app/src/lib/idl/agent_factory.json
cp target/types/agent_factory.ts app/src/lib/idl/agent_factory.ts
cp target/idl/receipt_registry.json app/src/lib/idl/receipt_registry.json
cp target/types/receipt_registry.ts app/src/lib/idl/receipt_registry.ts

echo "Rebuilding frontend..."
cd app && rm -rf .next && npm run build

echo "Done! All programs deployed and frontend synced."
