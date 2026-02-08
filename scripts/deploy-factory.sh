#!/bin/bash
set -e

echo "Building factory program..."
anchor build -p agent-factory

echo "Deploying to devnet..."
anchor deploy -p agent-factory --provider.cluster devnet

echo "Syncing IDL to frontend..."
cp target/idl/agent_factory.json app/src/lib/idl/agent_factory.json
cp target/types/agent_factory.ts app/src/lib/idl/agent_factory.ts

echo "Rebuilding frontend..."
cd app && rm -rf .next && npm run build

echo "Done! Factory deployed and frontend synced."
