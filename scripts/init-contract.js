#!/usr/bin/env node
/**
 * X1SAFE V2 Contract Initialization Script
 * Initializes the multi-token vault on X1 testnet
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Program ID (Testnet)
const PROGRAM_ID = new PublicKey("12izSQkcRswfrm9Nxy9X3NuypzH2N1To2KmDWCogsJHA");

// X1 Testnet RPC
const RPC_URL = "https://rpc.testnet.x1.xyz";

// Token mints (Testnet)
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     X1SAFE V2 - Contract Initialization (Testnet)         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // Load wallet from default location
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    console.error("❌ Wallet not found at:", keypairPath);
    console.error("Please run: solana-keygen new");
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new anchor.Wallet(walletKeypair);

  console.log("👤 Wallet:", wallet.publicKey.toBase58());

  // Setup connection
  const connection = new anchor.web3.Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.join(__dirname, "../idl/x1safe_v2.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  // Update IDL with correct program ID for testnet
  idl.metadata = idl.metadata || {};
  idl.metadata.address = PROGRAM_ID.toBase58();

  // Create program
  const program = new anchor.Program(idl, provider);

  console.log("📦 Program ID:", PROGRAM_ID.toBase58());
  console.log("📡 RPC:", RPC_URL);
  console.log();

  // Generate or load X1SAFE mint keypair
  let x1safeMintKeypair;
  const mintKeypairPath = path.join(__dirname, "../.x1safe-mint.json");

  if (fs.existsSync(mintKeypairPath)) {
    const mintData = JSON.parse(fs.readFileSync(mintKeypairPath, "utf8"));
    x1safeMintKeypair = Keypair.fromSecretKey(new Uint8Array(mintData));
    console.log("🔄 Loaded existing X1SAFE mint:", x1safeMintKeypair.publicKey.toBase58());
  } else {
    x1safeMintKeypair = new Keypair();
    fs.writeFileSync(mintKeypairPath, JSON.stringify(Array.from(x1safeMintKeypair.secretKey)));
    console.log("🆕 Generated new X1SAFE mint:", x1safeMintKeypair.publicKey.toBase58());
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
  console.log("📍 Vault Authority PDA:", vaultAuthorityPda.toBase58());
  console.log();

  // Check if already initialized
  try {
    const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
    console.log("✅ Contract already initialized!");
    console.log("   Admin:", adminConfig.admin.toBase58());
    console.log("   Fee Recipient:", adminConfig.feeRecipient.toBase58());
    console.log("   X1SAFE Mint:", adminConfig.x1safeMint.toBase58());
    console.log();

    // Check if oracle is initialized
    try {
      const oracleConfig = await program.account.oracleConfig.fetch(oracleConfigPda);
      console.log("✅ Oracle already initialized!");
      console.log("   Price Decimals:", oracleConfig.priceDecimals);
      console.log("   Last Update:", new Date(oracleConfig.lastUpdate.toNumber() * 1000).toISOString());
      return;
    } catch (e) {
      console.log("⏳ Oracle not initialized. Initializing...");
    }
  } catch (e) {
    console.log("⏳ Contract not initialized. Initializing...");
  }

  // Get vault token accounts
  const vaultUsdcX = await getAssociatedTokenAddress(
    TOKEN_MINTS.USDC_X,
    vaultAuthorityPda,
    true
  );
  const vaultXnt = await getAssociatedTokenAddress(
    TOKEN_MINTS.XNT,
    vaultAuthorityPda,
    true
  );
  const vaultXen = await getAssociatedTokenAddress(
    TOKEN_MINTS.XEN,
    vaultAuthorityPda,
    true
  );
  const vaultXnm = await getAssociatedTokenAddress(
    TOKEN_MINTS.XNM,
    vaultAuthorityPda,
    true
  );

  // Initialize contract
  if (!(await accountExists(connection, adminConfigPda))) {
    console.log("\n🚀 Initializing X1SAFE V2...");
    try {
      const tx = await program.methods
        .initialize({
          burnAddress: wallet.publicKey,
          feeRecipient: wallet.publicKey,
          depositFeeBps: 50, // 0.5%
          exitFeeBps: 50,    // 0.5%
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
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([x1safeMintKeypair])
        .rpc();

      console.log("✅ Initialize transaction successful!");
      console.log("   Signature:", tx);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/", tx);
    } catch (error) {
      console.error("❌ Initialize failed:", error.message);
      throw error;
    }
  }

  // Initialize oracle
  if (!(await accountExists(connection, oracleConfigPda))) {
    console.log("\n🔮 Initializing Oracle...");
    try {
      const tx = await program.methods
        .initializeOracle({
          usdcXPrice: new anchor.BN(1000000000), // $1.00
          xntPrice: new anchor.BN(50000000),     // $0.05
          xenPrice: new anchor.BN(10000000),     // $0.01
          xnmPrice: new anchor.BN(1000000),      // $0.001
          priceDecimals: 9,
          updateFrequencySecs: 300,             // 5 minutes
        })
        .accounts({
          payer: wallet.publicKey,
          adminConfig: adminConfigPda,
          admin: wallet.publicKey,
          oracleConfig: oracleConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Oracle initialization successful!");
      console.log("   Signature:", tx);
      console.log("   Explorer: https://explorer.testnet.x1.xyz/tx/", tx);
    } catch (error) {
      console.error("❌ Oracle initialize failed:", error.message);
      throw error;
    }
  }

  // Verify final state
  console.log("\n📊 Final State:");
  const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
  const oracleConfig = await program.account.oracleConfig.fetch(oracleConfigPda);

  console.log("\nAdmin Config:");
  console.log("  Admin:", adminConfig.admin.toBase58());
  console.log("  Fee Recipient:", adminConfig.feeRecipient.toBase58());
  console.log("  X1SAFE Mint:", adminConfig.x1safeMint.toBase58());
  console.log("  Deposit Fee:", adminConfig.depositFeeBps / 100, "%");
  console.log("  Exit Fee:", adminConfig.exitFeeBps / 100, "%");
  console.log("  Deposits Paused:", adminConfig.depositsPaused);
  console.log("  Total TVL:", adminConfig.totalTvlUsd.toString());

  console.log("\nOracle Config:");
  console.log("  USDC.X Price:", adminConfig.usdcXMint.toBase58() === TOKEN_MINTS.USDC_X.toBase58() ? "$1.00" : "N/A");
  console.log("  Price Decimals:", oracleConfig.priceDecimals);
  console.log("  Last Update:", new Date(oracleConfig.lastUpdate.toNumber() * 1000).toISOString());

  console.log("\n✅ X1SAFE V2 is ready for use!");
}

async function accountExists(connection, pubkey) {
  const account = await connection.getAccountInfo(pubkey);
  return account !== null;
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
