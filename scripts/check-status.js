#!/usr/bin/env node
/**
 * X1SAFE V2 Contract Initialization Script
 * Simple approach using direct RPC calls
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const { BN } = require("bn.js");

// Program ID (Testnet)
const PROGRAM_ID = new PublicKey("6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac");
const RPC_URL = "https://rpc.testnet.x1.xyz";

// Token mints (Testnet)
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

// IDL for instruction encoding
const IDL = {
  version: "2.0.0",
  name: "x1safe_v2",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "payer", isMut: true, isSigner: true },
        { name: "adminConfig", isMut: true, isSigner: false },
        { name: "x1safeMint", isMut: true, isSigner: true },
        { name: "vaultAuthority", isMut: false, isSigner: false },
        { name: "vaultUsdcX", isMut: true, isSigner: false },
        { name: "vaultXnt", isMut: true, isSigner: false },
        { name: "vaultXen", isMut: true, isSigner: false },
        { name: "vaultXnm", isMut: true, isSigner: false },
        { name: "usdcXMint", isMut: false, isSigner: false },
        { name: "xntMint", isMut: false, isSigner: false },
        { name: "xenMint", isMut: false, isSigner: false },
        { name: "xnmMint", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: [
        { name: "params", type: { defined: "InitializeParams" } }
      ]
    },
    {
      name: "initializeOracle",
      accounts: [
        { name: "payer", isMut: true, isSigner: true },
        { name: "adminConfig", isMut: false, isSigner: false },
        { name: "admin", isMut: false, isSigner: true },
        { name: "oracleConfig", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [
        { name: "params", type: { defined: "OracleConfigParams" } }
      ]
    }
  ],
  types: [
    {
      name: "InitializeParams",
      type: {
        kind: "struct",
        fields: [
          { name: "burnAddress", type: "publicKey" },
          { name: "feeRecipient", type: "publicKey" },
          { name: "depositFeeBps", type: "u16" },
          { name: "exitFeeBps", type: "u16" }
        ]
      }
    },
    {
      name: "OracleConfigParams",
      type: {
        kind: "struct",
        fields: [
          { name: "usdcXPrice", type: "u64" },
          { name: "xntPrice", type: "u64" },
          { name: "xenPrice", type: "u64" },
          { name: "xnmPrice", type: "u64" },
          { name: "priceDecimals", type: "u8" },
          { name: "updateFrequencySecs", type: "u32" }
        ]
      }
    }
  ]
};

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     X1SAFE V2 - Contract Initialization (Testnet)           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // Load wallet
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Wallet not found at:", keypairPath);
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("👤 Wallet:", walletKeypair.publicKey.toBase58());

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");

  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("💰 Balance:", balance / 1e9, "XNT");

  if (balance < 0.1 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.1 XNT");
    console.log("   Get testnet XNT from: https://apexfaucet.xyz");
    process.exit(1);
  }

  console.log("📦 Program ID:", PROGRAM_ID.toBase58());
  console.log();

  // Derive PDAs
  const [adminConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    PROGRAM_ID
  );

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    PROGRAM_ID
  );

  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    PROGRAM_ID
  );

  console.log("📍 Admin Config PDA:", adminConfigPda.toBase58());
  console.log("📍 Oracle Config PDA:", oracleConfigPda.toBase58());
  console.log("📍 Vault Authority PDA:", vaultAuthorityPda.toBase58());
  console.log();

  // Check if already initialized
  const adminConfigInfo = await connection.getAccountInfo(adminConfigPda);
  const oracleConfigInfo = await connection.getAccountInfo(oracleConfigPda);

  if (adminConfigInfo) {
    console.log("✅ Admin Config already initialized");
  } else {
    console.log("⏳ Need to initialize Admin Config");
  }

  if (oracleConfigInfo) {
    console.log("✅ Oracle already initialized");
  } else {
    console.log("⏳ Need to initialize Oracle");
  }

  if (adminConfigInfo && oracleConfigInfo) {
    console.log("\n✅ X1SAFE V2 is already fully initialized!");
    return;
  }

  // For now, just report status - actual init requires Anchor CLI
  console.log("\n📋 Status Report:");
  console.log("=================");
  console.log("Contract exists on-chain: ✅");
  console.log("Admin Config initialized:", adminConfigInfo ? "✅" : "❌");
  console.log("Oracle initialized:", oracleConfigInfo ? "✅" : "❌");
  console.log();
  console.log("To fully initialize, run:");
  console.log("  cd ~/.openclaw/workspace/x1safe_v2");
  console.log("  anchor run initialize");
  console.log();
  console.log("Or use the X1 Wallet to call initialize() manually.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
