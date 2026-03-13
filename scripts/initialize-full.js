#!/usr/bin/env node
/**
 * X1SAFE V2 Contract Initialize Script
 * Initialize the vault on X1 testnet
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const BN = require("bn.js");

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

// Load IDL from file and fix address
const idlPath = path.join(__dirname, "../idl/x1safe_v2.json");
const IDL = JSON.parse(fs.readFileSync(idlPath, "utf8"));
// Fix the program ID to match testnet
IDL.metadata = IDL.metadata || {};
IDL.metadata.address = PROGRAM_ID.toBase58();

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   X1SAFE V2 - Initialize Contract (Testnet)               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Load wallet
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Wallet not found:", keypairPath);
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new anchor.Wallet(walletKeypair);

  console.log("👤 Wallet:", wallet.publicKey.toBase58());

  // Setup provider
  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed"
  });
  anchor.setProvider(provider);

  // Create program
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);

  console.log("📦 Program:", PROGRAM_ID.toBase58());
  console.log("📡 RPC:", RPC_URL);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
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

  console.log("📍 Vault USDC.X:", vaultUsdcX.toBase58().slice(0, 20) + "...");
  console.log("📍 Vault XNT:", vaultXnt.toBase58().slice(0, 20) + "...");
  console.log("📍 Vault XEN:", vaultXen.toBase58().slice(0, 20) + "...");
  console.log("📍 Vault XNM:", vaultXnm.toBase58().slice(0, 20) + "...\n");

  // Check if already initialized
  const adminExists = await accountExists(connection, adminConfigPda);
  const oracleExists = await accountExists(connection, oracleConfigPda);

  console.log("🔍 Status Check:");
  console.log("   Admin Config:", adminExists ? "✅ EXISTS" : "❌ Not initialized");
  console.log("   Oracle Config:", oracleExists ? "✅ EXISTS" : "❌ Not initialized");
  console.log();

  // Initialize Admin Config
  if (!adminExists) {
    console.log("🚀 Initializing X1SAFE V2...");
    console.log("   Fee: 0.5% deposit, 0.5% exit");
    console.log("   Admin:", wallet.publicKey.toBase58());
    
    try {
      const tx = await program.methods
        .initialize({
          burnAddress: wallet.publicKey,
          feeRecipient: wallet.publicKey,
          depositFeeBps: 50,
          exitFeeBps: 50
        })
        .accounts({
          payer: wallet.publicKey,
          adminConfig: adminConfigPda,
          x1safeMint: x1safeMintKeypair.publicKey,
          vaultAuthority: vaultAuthorityPda,
          vaultUsdcX: vaultUsdcX,
          vaultXnt: vaultXnt,
          vaultXen: vaultXen,
          vaultXnm: vaultXnm,
          usdcXMint: TOKEN_MINTS.USDC_X,
          xntMint: TOKEN_MINTS.XNT,
          xenMint: TOKEN_MINTS.XEN,
          xnmMint: TOKEN_MINTS.XNM,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
        })
        .signers([x1safeMintKeypair])
        .rpc({ commitment: "confirmed" });

      console.log("✅ Initialize SUCCESS!");
      console.log("   Signature:", tx);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/" + tx);
    } catch (e) {
      console.error("❌ Initialize failed:", e.message);
      if (e.logs) console.error("Logs:", e.logs);
      throw e;
    }
  }

  // Initialize Oracle
  if (!oracleExists) {
    console.log("\n🔮 Initializing Oracle...");
    console.log("   USDC.X: $1.00 | XNT: $0.05 | XEN: $0.01 | XNM: $0.001");
    
    try {
      const tx = await program.methods
        .initializeOracle({
          usdcXPrice: new BN(1000000000),
          xntPrice: new BN(50000000),
          xenPrice: new BN(10000000),
          xnmPrice: new BN(1000000),
          priceDecimals: 9,
          updateFrequencySecs: 300
        })
        .accounts({
          payer: wallet.publicKey,
          adminConfig: adminConfigPda,
          admin: wallet.publicKey,
          oracleConfig: oracleConfigPda,
          systemProgram: SystemProgram.programId
        })
        .rpc({ commitment: "confirmed" });

      console.log("✅ Oracle initialize SUCCESS!");
      console.log("   Signature:", tx);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/" + tx);
    } catch (e) {
      console.error("❌ Oracle initialize failed:", e.message);
      if (e.logs) console.error("Logs:", e.logs);
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
