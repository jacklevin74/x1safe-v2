#!/bin/bash
#
# X1SAFE V2 Deployment Script
# Deploys the program to X1 Testnet
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RPC_URL="https://rpc.testnet.x1.xyz"
PROGRAM_SO="$PROJECT_DIR/target/deploy/x1safe_v2.so"
PROGRAM_KEYPAIR="$PROJECT_DIR/target/deploy/x1safe_v2-fresh-keypair.json"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     X1SAFE V2 - Program Deployment                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo

# Check solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ solana CLI not found!"
    echo "Please install: https://docs.solanalabs.com/cli/install"
    exit 1
fi

# Check wallet
if [ ! -f "$HOME/.config/solana/id.json" ]; then
    echo "❌ Wallet not found at ~/.config/solana/id.json"
    echo "Please run: solana-keygen new"
    exit 1
fi

echo "Wallet: $(solana-keygen pubkey)"
echo "Program ID: $(solana-keygen pubkey "$PROGRAM_KEYPAIR")"
echo

# Check balance
echo "Checking balance..."
solana balance --url "$RPC_URL"
echo

# Check if program already deployed
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
ACCOUNT_INFO=$(solana account "$PROGRAM_ID" --url "$RPC_URL" 2>/dev/null || echo "NOT_FOUND")

if [[ "$ACCOUNT_INFO" != *"NOT_FOUND"* ]]; then
    echo "⚠️  Program already exists!"
    echo "If you want to redeploy, use: solana program deploy --program-id ..."
    echo
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy
echo "🚀 Deploying program..."
solana program deploy "$PROGRAM_SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --url "$RPC_URL" \
    --confirm-timeout 300

echo
echo "✅ Deployment complete!"
echo
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.testnet.x1.xyz/address/$PROGRAM_ID"
echo

# Save deployment info
cat > "$PROJECT_DIR/.deployment-testnet.json" <<EOF
{
  "network": "$RPC_URL",
  "programId": "$PROGRAM_ID",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployedBy": "$(solana-keygen pubkey)"
}
EOF

echo "📝 Saved to .deployment-testnet.json"
