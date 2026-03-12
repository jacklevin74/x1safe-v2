#!/usr/bin/env node
/**
 * Token Configuration Script for X1SAFE V2
 * Sets up and verifies token configurations
 */

const { PublicKey, Connection } = require("@solana/web3.js");
const { getMint, getAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

// X1 Mainnet configuration
const X1_MAINNET_RPC = "https://rpc.mainnet.x1.xyz";

// Token mint addresses on X1 Mainnet
const SUPPORTED_TOKENS = {
  USDC_X: {
    mint: "B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq",
    decimals: 6,
    symbol: "USDC.X",
    name: "Wrapped USDC on X1",
    isStable: true,
  },
  XEN: {
    mint: "y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC",
    decimals: 6,
    symbol: "XEN",
    name: "XEN Token",
    isStable: false,
  },
  XNT: {
    mint: "3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv",
    decimals: 9,
    symbol: "XNT",
    name: "X1 Native Token",
    isStable: false,
  },
  XNM: {
    mint: "XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m",
    decimals: 9,
    symbol: "XNM",
    name: "XenBlocks Miner Token",
    isStable: false,
  },
};

async function verifyToken(connection, tokenName, tokenInfo) {
  console.log(`\n🔍 Verifying ${tokenName}...`);
  console.log(`   Mint: ${tokenInfo.mint}`);
  
  try {
    const mintPubkey = new PublicKey(tokenInfo.mint);
    const mintInfo = await getMint(connection, mintPubkey);
    
    console.log(`   ✅ Token found`);
    console.log(`   Decimals: ${mintInfo.decimals} (expected: ${tokenInfo.decimals})`);
    console.log(`   Supply: ${mintInfo.supply}`);
    console.log(`   Mint Authority: ${mintInfo.mintAuthority?.toString() || "None (immutable)"}`);
    console.log(`   Freeze Authority: ${mintInfo.freezeAuthority?.toString() || "None"}`);
    
    if (mintInfo.decimals !== tokenInfo.decimals) {
      console.log(`   ⚠️  WARNING: Decimals mismatch!`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Token not found or invalid: ${error.message}`);
    return false;
  }
}

async function queryX1TokenDB(symbol) {
  // Placeholder for querying x1_token_db
  // In production, this would query the local database
  console.log(`\n📚 Querying x1_token_db for ${symbol}...`);
  console.log(`   (This would query data/x1_tokens.db)`);
  return null;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        X1SAFE V2 - Token Configuration Setup               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  const network = process.argv[2] || "mainnet";
  const rpcUrl = network === "mainnet" ? X1_MAINNET_RPC : "http://localhost:8899";
  
  console.log(`\n📡 Network: ${network}`);
  console.log(`🔗 RPC: ${rpcUrl}`);
  
  const connection = new Connection(rpcUrl, "confirmed");
  
  // Verify connection
  try {
    const slot = await connection.getSlot();
    console.log(`✅ Connected to ${network} at slot ${slot}`);
  } catch (error) {
    console.error(`❌ Failed to connect: ${error.message}`);
    process.exit(1);
  }
  
  // Verify all supported tokens
  console.log("\n" + "=".repeat(60));
  console.log("VERIFYING SUPPORTED TOKENS");
  console.log("=".repeat(60));
  
  const results = {};
  
  for (const [name, info] of Object.entries(SUPPORTED_TOKENS)) {
    results[name] = await verifyToken(connection, name, info);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  
  const verified = Object.entries(results).filter(([_, v]) => v).length;
  const total = Object.keys(results).length;
  
  console.log(`\nVerified: ${verified}/${total} tokens`);
  
  for (const [name, valid] of Object.entries(results)) {
    const status = valid ? "✅" : "❌";
    console.log(`   ${status} ${name}: ${SUPPORTED_TOKENS[name].symbol}`);
  }
  
  // Price reference
  console.log("\n" + "=".repeat(60));
  console.log("PRICE CONFIGURATION REFERENCE");
  console.log("=".repeat(60));
  console.log(`
X1SAFE uses USDC.X as the base currency.

Conversion Rates (example):
• 1 X1SAFE = 0.001 USDC.X (fixed)
• 1 USDC.X = 1000 X1SAFE

Oracle Prices (in USDC.X with 6 decimals):
• USDC.X: 1,000,000 (1.0)
• XNT:     100,000 (0.1)
• XEN:      50,000 (0.05)
• XNM:     200,000 (0.2)

Example calculations:
• 100 USDC.X deposit → 100,000 X1SAFE
• 1000 XNT deposit → 100 * 1000 = 100,000 X1SAFE
• 2000 XEN deposit → 100 * 1000 = 100,000 X1SAFE
`);

  // Token account addresses
  console.log("=".repeat(60));
  console.log("VAULT TOKEN ACCOUNTS");
  console.log("=".repeat(60));
  console.log(`
After deployment, create vault token accounts at:
• USDC.X: [Derived from vault_authority PDA]
• XNT:    [Derived from vault_authority PDA]
• XEN:    [Derived from vault_authority PDA]
• XNM:    [Derived from vault_authority PDA]

Use Associated Token Accounts for automatic derivation.
`);

  // Recommendations
  console.log("=".repeat(60));
  console.log("RECOMMENDATIONS");
  console.log("=".repeat(60));
  console.log(`
1. Ensure all token mints are verified before deployment
2. Update XNM mint address when confirmed
3. Set up oracle price feed (Cron job or keeper bot)
4. Configure fee recipient to a secure multisig
5. Test deposits with small amounts first
6. Set up monitoring for vault token balances

Oracle Update Frequency: 5 minutes recommended
Price Confidence Threshold: 5% maximum
`);

  if (verified < total) {
    console.log("\n⚠️  WARNING: Not all tokens verified!");
    console.log("   Please verify token mint addresses before deployment.");
    process.exit(1);
  }

  console.log("\n✅ All tokens verified successfully!");
}

main().catch(console.error);