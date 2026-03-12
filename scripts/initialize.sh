#!/bin/bash

# Initialize X1SAFE V2 Contract on X1 Testnet
# Usage: ./scripts/initialize.sh

set -e

export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd "$(dirname "$0")/.."

echo "🎩 X1SAFE V2 - Initialize Contract"
echo "==================================="
echo ""

# Set RPC
solana config set --url https://rpc.testnet.x1.xyz

# Get wallet address
WALLET=$(solana address)
echo "Wallet: $WALLET"
echo ""

# Program ID
PROGRAM_ID="12izSQkcRswfrm9Nxy9X3NuypzH2N1To2KmDWCogsJHA"
echo "Program ID: $PROGRAM_ID"
echo ""

# Derive PDAs (using solana-keygen for deterministic derivation)
echo "Deriving PDAs..."

# Admin Config PDA: PDA(["admin_config"], program_id)
# We'll compute these manually using a simple Node.js script
cat > /tmp/compute_pda.js << 'EOF'
const { PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey("12izSQkcRswfrm9Nxy9X3NuypzH2N1To2KmDWCogsJHA");

const [adminConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from("admin_config")],
  PROGRAM_ID
);

const [oracleConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_config")],
  PROGRAM_ID
);

const [vaultAuthority] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_authority")],
  PROGRAM_ID
);

console.log("Admin Config:", adminConfig.toBase58());
console.log("Oracle Config:", oracleConfig.toBase58());
console.log("Vault Authority:", vaultAuthority.toBase58());
EOF

cd web-ui && node /tmp/compute_pda.js

echo ""
echo "💡 Để initialize contract, bạn cần gọi instruction 'initialize' với các params:"
echo "   - fee_recipient: $WALLET"
echo "   - burn_address: $WALLET"  
echo "   - platform_fee_bps: 100 (1%)"
echo ""
echo "Sau khi nhận XNT testnet, tôi có thể tạo transaction initialize."
