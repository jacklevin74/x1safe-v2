#!/bin/bash
#
# X1SAFE MVP Deployment Script
# Simple, minimal deployment
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MVP_DIR="$PROJECT_DIR/programs/x1safe_mvp"

RPC_URL="https://rpc.testnet.x1.xyz"

# Program keypair
PROGRAM_KEYPAIR="$PROJECT_DIR/target/deploy/x1safe_mvp-keypair.json"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     X1SAFE MVP - Program Deployment                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

# Check requirements
if ! command -v solana &> /dev/null; then
    echo "❌ solana CLI required"
    echo "Install: https://docs.solanalabs.com/cli/install"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo required"
    echo "Install: https://rustup.rs/"
    exit 1
fi

echo "Wallet: $(solana-keygen pubkey)"
echo

# Generate program keypair if needed
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "📝 Generating program keypair..."
    mkdir -p "$(dirname "$PROGRAM_KEYPAIR")"
    solana-keygen new --no-passphrase -o "$PROGRAM_KEYPAIR"
fi

PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "Program ID: $PROGRAM_ID"

# Check balance
echo
echo "Checking wallet balance..."
solana balance --url "$RPC_URL"

# Build program
echo
echo "🔨 Building program..."
cd "$MVP_DIR"
cargo build --release --target bpfel-unknown-unknown --features no-entrypoint 2>> /tmp/build.log || {
    echo "❌ Build failed!"
    echo "See /tmp/build.log"
    exit 1
}

# Copy binary
mkdir -p "$PROJECT_DIR/target/deploy"
cp "$MVP_DIR/../../../target/bpfel-unknown-unknown/release/x1safe_mvp.so" \
   "$PROJECT_DIR/target/deploy/x1safe_mvp.so" 2>/dev/null || {
    echo "Binary location varies, searching..."
    find "$MVP_DIR" -name "*.so" -exec cp {} "$PROJECT_DIR/target/deploy/x1safe_mvp.so" \; 2>/dev/null
}

if [ ! -f "$PROJECT_DIR/target/deploy/x1safe_mvp.so" ]; then
    echo "❌ Binary not found!"
    echo "Looking in target directory..."
    find "$PROJECT_DIR" -name "x1safe_mvp.so" 2>/dev/null
    exit 1
fi

echo "✅ Build complete"
ls -lh "$PROJECT_DIR/target/deploy/x1safe_mvp.so"

# Check if already deployed
echo
echo "Checking if program exists..."
ACCOUNT_INFO=$(solana account "$PROGRAM_ID" --url "$RPC_URL" 2>/dev/null || echo "NOT_FOUND")

if [[ "$ACCOUNT_INFO" != *"NOT_FOUND"* ]]; then
    echo "⚠️  Program already deployed"
    echo "$ACCOUNT_INFO" | head -3
    echo
    read -p "Re-deploy? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
    echo "Re-deploying..."
fi

# Deploy
echo
echo "🚀 Deploying..."
solana program deploy "$PROJECT_DIR/target/deploy/x1safe_mvp.so" \
    --program-id "$PROGRAM_KEYPAIR" \
    --url "$RPC_URL" \
    --confirm-timeout 300

echo
echo "✅ Deployment complete!"
echo
echo "Program ID: $PROGRAM_ID"
echo "Explorer:  https://explorer.testnet.x1.xyz/address/$PROGRAM_ID"
echo

# Save deployment info
cat > "$PROJECT_DIR/.mvp-deployment.json" <<EOF
{
  "programId": "$PROGRAM_ID",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployedBy": "$(solana-keygen pubkey)",
  "network": "$RPC_URL"
}
EOF

echo "💾 Saved to .mvp-deployment.json"
echo
echo "Next: node scripts/init-mvp.js"
