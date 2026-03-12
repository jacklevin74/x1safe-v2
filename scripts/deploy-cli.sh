#!/bin/bash
set -e

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   X1SAFE V2 - Deploy with Solana CLI                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

PROGRAM_SO="target/deploy/x1safe_v2.so"
PROGRAM_KEYPAIR="target/deploy/x1safe_v2-keypair-new.json"
RPC_URL="https://rpc.testnet.x1.xyz"

echo "📦 Program: $PROGRAM_SO"
echo "🔑 Keypair: $PROGRAM_KEYPAIR"
echo "📡 RPC: $RPC_URL"
echo

# Check files
if [ ! -f "$PROGRAM_SO" ]; then
    echo "❌ Program not found: $PROGRAM_SO"
    exit 1
fi

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Keypair not found: $PROGRAM_KEYPAIR"
    exit 1
fi

# Show program ID
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "🔑 Program ID: $PROGRAM_ID"
echo

# Check balance
echo "💳 Checking balance..."
solana balance --url "$RPC_URL"
echo

# Deploy
echo "🚀 Deploying..."
solana program deploy "$PROGRAM_SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --url "$RPC_URL" \
    --confirm-timeout 300

echo
echo "✅ Deployment complete!"
echo "🔗 Explorer: https://explorer.testnet.x1.xyz/address/$PROGRAM_ID"
