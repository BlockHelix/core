#!/bin/bash

echo "========================================="
echo "BlockHelix Scaffold Verification"
echo "========================================="
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not installed. Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
else
    echo "✓ Rust/Cargo installed: $(cargo --version)"
fi

if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not installed. Run: sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
else
    echo "✓ Solana CLI installed: $(solana --version)"
fi

if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not installed. Run: cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked"
else
    echo "✓ Anchor CLI installed: $(anchor --version)"
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not installed"
else
    echo "✓ Node.js installed: $(node --version)"
fi

if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn not installed. Run: npm install -g yarn"
else
    echo "✓ Yarn installed: $(yarn --version)"
fi

echo ""
echo "Checking scaffold structure..."

# Check directories
dirs=(
    "programs/agent-vault/src"
    "programs/receipt-registry/src"
    "programs/agent-factory/src"
    "tests"
    "agent/src/routes"
    "agent/src/services"
    "agent/src/utils"
    "app/src/app"
    "app/src/components"
    "app/src/hooks"
    "app/src/lib"
)

for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✓ $dir"
    else
        echo "❌ $dir missing"
    fi
done

echo ""
echo "Checking key files..."

files=(
    "Anchor.toml"
    "Cargo.toml"
    "package.json"
    "programs/agent-vault/src/lib.rs"
    "programs/receipt-registry/src/lib.rs"
    "programs/agent-factory/src/lib.rs"
    "tests/agent-vault.ts"
    "tests/agent-factory.ts"
    "tests/receipt-registry.ts"
    "agent/package.json"
    "app/package.json"
    "README.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "❌ $file missing"
    fi
done

echo ""
echo "========================================="
echo "Next steps:"
echo "1. Install missing prerequisites (see above)"
echo "2. Run 'make install-deps' to install Node dependencies"
echo "3. Run 'anchor build' to compile programs"
echo "4. Run 'anchor keys list' to get program IDs"
echo "5. Update program IDs with 'make update-program-ids'"
echo "========================================="
