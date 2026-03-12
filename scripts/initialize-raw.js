#!/usr/bin/env node
/**
 * X1SAFE V2 - Initialize via raw RPC
 * Bypass Anchor issues by using direct RPC calls
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const { BN } = require("bn.js");

// Testnet Program ID
const PROGRAM_ID = new PublicKey("3ha5JkZi6bcwiinWo357pyFJcGH2UWi36AhGJn2LHJbD");
const RPC_URL = "https://rpc.testnet.x1.xyz";

// Token mints (Testnet)
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

// Discriminator for initialize instruction (8 bytes)
// SHA256("global:initialize")[:8]
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
const INITIALIZE_ORACLE_DISCRIMINATOR = Buffer.from([144, 223, 131, 120, 196, 253, 181, 99]);

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   X1SAFE V2 - Initialize Contract (Testnet) - Raw RPC     ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Wallet not found:", keypairPath);
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("👤 Wallet:", walletKeypair.publicKey.toBase58());

  // Setup connection
  const connection = new Connection(RPC_URL, "confirmed");

  // Check balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("💰 Balance:", (balance / 1e9).toFixed(4), "XNT\n");

  if (balance < 0.1 * 1e9) {
    console.error("❌ Insufficient balance. Need at least 0.1 XNT");
    process.exit(1);
  }

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
  console.log("📍 Vault Authority:", vaultAuthorityPda.toBase58());

  // Load or generate X1SAFE mint
  const mintKeypairPath = path.join(__dirname, "../.x1safe-mint.json");
  let x1safeMintKeypair;
  if (fs.existsSync(mintKeypairPath)) {
    const data = JSON.parse(fs.readFileSync(mintKeypairPath, "utf8"));
    x1safeMintKeypair = Keypair.fromSecretKey(new Uint8Array(data));
    console.log("🔄 Loaded X1SAFE mint:", x1safeMintKeypair.publicKey.toBase58());
  } else {
    x1safeMintKeypair = new Keypair();
    fs.writeFileSync(mintKeypairPath, JSON.stringify(Array.from(x1safeMintKeypair.secretKey)));
    console.log("🆕 Generated X1SAFE mint:", x1safeMintKeypair.publicKey.toBase58());
  }

  // Get vault token accounts
  const vaultUsdcX = await getAssociatedTokenAddress(TOKEN_MINTS.USDC_X, vaultAuthorityPda, true);
  const vaultXnt = await getAssociatedTokenAddress(TOKEN_MINTS.XNT, vaultAuthorityPda, true);
  const vaultXen = await getAssociatedTokenAddress(TOKEN_MINTS.XEN, vaultAuthorityPda, true);
  const vaultXnm = await getAssociatedTokenAddress(TOKEN_MINTS.XNM, vaultAuthorityPda, true);

  console.log("\n📍 Vault USDC.X:", vaultUsdcX.toBase58());
  console.log("📍 Vault XNT:", vaultXnt.toBase58());
  console.log("📍 Vault XEN:", vaultXen.toBase58());
  console.log("📍 Vault XNM:", vaultXnm.toBase58());

  // Check if already initialized
  const adminExists = await accountExists(connection, adminConfigPda);
  const oracleExists = await accountExists(connection, oracleConfigPda);

  console.log("\n🔍 Status Check:");
  console.log("   Admin Config:", adminExists ? "✅ EXISTS" : "❌ Not initialized");
  console.log("   Oracle Config:", oracleExists ? "✅ EXISTS" : "❌ Not initialized");
  console.log();

  if (adminExists && oracleExists) {
    console.log("✅ X1SAFE V2 is already FULLY INITIALIZED!");
    console.log("   Web UI: https://x1safe.vercel.app/");
    return;
  }

  // Build initialize instruction data
  // Borsh encoding for InitializeParams
  // burnAddress (32) + feeRecipient (32) + depositFeeBps (2) + exitFeeBps (2) = 68 bytes
  if (!adminExists) {
    console.log("\n🚀 Building Initialize Transaction...");
    console.log("   Fee: 0.5% deposit, 0.5% exit");

    // Encode InitializeParams
    const paramsBuffer = Buffer.alloc(68);
    walletKeypair.publicKey.toBuffer().copy(paramsBuffer, 0);   // burnAddress
    walletKeypair.publicKey.toBuffer().copy(paramsBuffer, 32);  // feeRecipient
    paramsBuffer.writeUInt16LE(50, 64);  // depositFeeBps
    paramsBuffer.writeUInt16LE(50, 66);  // exitFeeBps

    const data = Buffer.concat([INITIALIZE_DISCRIMINATOR, paramsBuffer]);

    // Build transaction
    const tx = new Transaction();
    tx.add({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: adminConfigPda, isSigner: false, isWritable: true },          // adminConfig
        { pubkey: x1safeMintKeypair.publicKey, isSigner: true, isWritable: true }, // x1safeMint
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },     // vaultAuthority
        { pubkey: vaultUsdcX, isSigner: false, isWritable: true },             // vaultUsdcX
        { pubkey: vaultXnt, isSigner: false, isWritable: true },               // vaultXnt
        { pubkey: vaultXen, isSigner: false, isWritable: true },               // vaultXen
        { pubkey: vaultXnm, isSigner: false, isWritable: true },               // vaultXnm
        { pubkey: TOKEN_MINTS.USDC_X, isSigner: false, isWritable: false },    // usdcXMint
        { pubkey: TOKEN_MINTS.XNT, isSigner: false, isWritable: false },        // xntMint
        { pubkey: TOKEN_MINTS.XEN, isSigner: false, isWritable: false },        // xenMint
        { pubkey: TOKEN_MINTS.XNM, isSigner: false, isWritable: false },        // xnmMint
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },       // tokenProgram
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },    // rent
      ],
      programId: PROGRAM_ID,
      data: data
    });

    console.log("📤 Sending initialize transaction...");
    try {
      const sig = await connection.sendTransaction(tx, [walletKeypair, x1safeMintKeypair], {
        commitment: "confirmed",
        preflightCommitment: "confirmed"
      });
      console.log("✅ Initialize SUCCESS!");
      console.log("   Signature:", sig);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
    } catch (e) {
      console.error("❌ Initialize failed:", e.message);
      throw e;
    }
  }

  // Initialize Oracle
  if (!oracleExists) {
    console.log("\n🔮 Building Initialize Oracle Transaction...");
    console.log("   USDC.X: $1.00 | XNT: $0.05 | XEN: $0.01 | XNM: $0.001");

    // Encode OracleConfigParams
    // usdcXPrice (8) + xntPrice (8) + xenPrice (8) + xnmPrice (8) + priceDecimals (1) + updateFrequencySecs (4) = 37 bytes
    const oracleParams = Buffer.alloc(37);
    oracleParams.writeBigUInt64LE(BigInt(1000000000), 0);   // usdcXPrice
    oracleParams.writeBigUInt64LE(BigInt(50000000), 8);      // xntPrice
    oracleParams.writeBigUInt64LE(BigInt(10000000), 16);     // xenPrice
    oracleParams.writeBigUInt64LE(BigInt(1000000), 24);      // xnmPrice
    oracleParams.writeUInt8(9, 32);                         // priceDecimals
    oracleParams.writeUInt32LE(300, 33);                     // updateFrequencySecs

    const oracleData = Buffer.concat([INITIALIZE_ORACLE_DISCRIMINATOR, oracleParams]);

    const oracleTx = new Transaction();
    oracleTx.add({
      keys: [
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true }, // payer
        { pubkey: adminConfigPda, isSigner: false, isWritable: false },        // adminConfig
        { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: false }, // admin
        { pubkey: oracleConfigPda, isSigner: false, isWritable: true },       // oracleConfig
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
      ],
      programId: PROGRAM_ID,
      data: oracleData
    });

    console.log("📤 Sending oracle initialize transaction...");
    try {
      const sig = await connection.sendTransaction(oracleTx, [walletKeypair], {
        commitment: "confirmed",
        preflightCommitment: "confirmed"
      });
      console.log("✅ Oracle initialize SUCCESS!");
      console.log("   Signature:", sig);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
    } catch (e) {
      console.error("❌ Oracle initialize failed:", e.message);
      throw e;
    }
  }

  // Final verification
  console.log("\n📊 Final State:");
  const finalAdmin = await accountExists(connection, adminConfigPda);
  const finalOracle = await accountExists(connection, oracleConfigPda);

  console.log("   Admin Config:", finalAdmin ? "✅ READY" : "❌ FAILED");
  console.log("   Oracle Config:", finalOracle ? "✅ READY" : "❌ FAILED");

  if (finalAdmin && finalOracle) {
    console.log("\n✅ X1SAFE V2 is FULLY INITIALIZED and ready!");
    console.log("   Web UI: https://x1safe.vercel.app/");
    console.log("\n🎉 Users can now:");
    console.log("   • Connect wallet");
    console.log("   • Deposit USDC.X, XNT, XEN, XNM");
    console.log("   • Receive X1SAFE tokens");
    console.log("   • Exit positions");
  }
}

async function accountExists(connection, pubkey) {
  const account = await connection.getAccountInfo(pubkey);
  return account !== null;
}

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
