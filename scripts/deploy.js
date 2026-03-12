#!/usr/bin/env node
/**
 * X1SAFE V2 Deployment Script
 * Deploys the multi-token vault contract to X1 mainnet
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// X1 Mainnet token mints
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("So11111111111111111111111111111111111111112"), // Replace with actual XNM mint
};

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         X1SAFE V2 - Multi-Token Vault Deployment           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet;
  const connection = provider.connection;

  console.log("👤 Deployer:", wallet.publicKey.toString());
  console.log("📡 Connection:", connection.rpcEndpoint);
  console.log();

  // Load program
  const programIdl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/x1safe_v2.json"), "utf8")
  );

  const program = new anchor.Program(programIdl, provider);
  console.log("📦 Program ID:", program.programId.toString());

  // Generate or load X1SAFE mint keypair
  let x1safeMintKeypair;
  const mintKeypairPath = path.join(__dirname, "../.x1safe-mint.json");
  
  if (fs.existsSync(mintKeypairPath)) {
    const secretKey = JSON.parse(fs.readFileSync(mintKeypairPath, "utf8"));
    x1safeMintKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(secretKey));
    console.log("🔑 Loaded existing X1SAFE mint:", x1safeMintKeypair.publicKey.toString());
  } else {
    x1safeMintKeypair = anchor.web3.Keypair.generate();
    fs.writeFileSync(mintKeypairPath, JSON.stringify(Array.from(x1safeMintKeypair.secretKey)));
    console.log("🔑 Generated new X1SAFE mint:", x1safeMintKeypair.publicKey.toString());
  }

  // Derive PDAs
  const [adminConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    program.programId
  );

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    program.programId
  );

  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    program.programId
  );

  console.log("📋 PDAs:");
  console.log("   Admin Config:", adminConfigPda.toString());
  console.log("   Oracle Config:", oracleConfigPda.toString());
  console.log("   Vault Authority:", vaultAuthorityPda.toString());
  console.log();

  // Check if already initialized
  let isInitialized = false;
  try {
    await program.account.adminConfig.fetch(adminConfigPda);
    isInitialized = true;
    console.log("⚠️  Vault already initialized!");
  } catch (e) {
    console.log("✅ Ready to initialize new vault");
  }

  if (!isInitialized) {
    console.log();
    console.log("🚀 Initializing X1SAFE V2 Vault...");
    console.log();

    // Configuration
    const feeRecipient = wallet.publicKey; // Use deployer as fee recipient
    const burnAddress = new PublicKey("11111111111111111111111111111111"); // System program for burning
    
    const initializeParams = {
      burnAddress: burnAddress,
      feeRecipient: feeRecipient,
      depositFeeBps: 50, // 0.5%
      exitFeeBps: 50, // 0.5%
    };

    // Create token account keypairs for vault
    const vaultUsdcXKeypair = anchor.web3.Keypair.generate();
    const vaultXntKeypair = anchor.web3.Keypair.generate();
    const vaultXenKeypair = anchor.web3.Keypair.generate();
    const vaultXnmKeypair = anchor.web3.Keypair.generate();

    console.log("Creating vault token accounts...");

    try {
      await program.methods
        .initialize(initializeParams)
        .accounts({
          payer: wallet.publicKey,
          adminConfig: adminConfigPda,
          x1safeMint: x1safeMintKeypair.publicKey,
          vaultAuthority: vaultAuthorityPda,
          vaultUsdcX: vaultUsdcXKeypair.publicKey,
          vaultXnt: vaultXntKeypair.publicKey,
          vaultXen: vaultXenKeypair.publicKey,
          vaultXnm: vaultXnmKeypair.publicKey,
          usdcXMint: TOKEN_MINTS.USDC_X,
          xntMint: TOKEN_MINTS.XNT,
          xenMint: TOKEN_MINTS.XEN,
          xnmMint: TOKEN_MINTS.XNM,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([
          x1safeMintKeypair,
          vaultUsdcXKeypair,
          vaultXntKeypair,
          vaultXenKeypair,
          vaultXnmKeypair,
        ])
        .rpc();

      console.log("✅ Vault initialized successfully!");
      console.log();
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      throw error;
    }

    // Initialize oracle
    console.log("🔮 Initializing price oracle...");

    const oracleParams = {
      usdcXPrice: 1000000, // 1.0 (6 decimals)
      xntPrice: 100000, // 0.1 USDC.X per XNT
      xenPrice: 50000, // 0.05 USDC.X per XEN
      xnmPrice: 200000, // 0.2 USDC.X per XNM
      priceDecimals: 6,
      updateFrequencySecs: 300, // 5 minutes
    };

    try {
      await program.methods
        .initializeOracle(oracleParams)
        .accounts({
          payer: wallet.publicKey,
          adminConfig: adminConfigPda,
          admin: wallet.publicKey,
          oracleConfig: oracleConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Oracle initialized successfully!");
    } catch (error) {
      console.error("❌ Oracle initialization failed:", error);
      throw error;
    }
  }

  // Verify deployment
  console.log();
  console.log("🔍 Verifying deployment...");
  console.log();

  const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
  const oracleConfig = await program.account.oracleConfig.fetch(oracleConfigPda);

  console.log("📊 Admin Config:");
  console.log("   Admin:", adminConfig.admin.toString());
  console.log("   X1SAFE Mint:", adminConfig.x1safeMint.toString());
  console.log("   Fee Recipient:", adminConfig.feeRecipient.toString());
  console.log("   Deposit Fee:", adminConfig.depositFeeBps / 100, "%");
  console.log("   Exit Fee:", adminConfig.exitFeeBps / 100, "%");
  console.log("   Deposits Paused:", adminConfig.depositsPaused);
  console.log("   Total TVL:", adminConfig.totalTvlUsd.toString());
  console.log("   Active Positions:", adminConfig.activePositions.toString());

  console.log();
  console.log("🔮 Oracle Config:");
  console.log("   USDC.X Price:", oracleConfig.usdcXPrice.toString());
  console.log("   XNT Price:", oracleConfig.xntPrice.toString());
  console.log("   XEN Price:", oracleConfig.xenPrice.toString());
  console.log("   XNM Price:", oracleConfig.xnmPrice.toString());
  console.log("   Last Update:", new Date(oracleConfig.lastUpdate * 1000).toISOString());

  // Save deployment info
  const deploymentInfo = {
    network: connection.rpcEndpoint,
    programId: program.programId.toString(),
    x1safeMint: x1safeMintKeypair.publicKey.toString(),
    adminConfig: adminConfigPda.toString(),
    oracleConfig: oracleConfigPda.toString(),
    vaultAuthority: vaultAuthorityPda.toString(),
    admin: adminConfig.admin.toString(),
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "../.deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log();
  console.log("📝 Deployment info saved to:", deploymentPath);

  console.log();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║              ✅ DEPLOYMENT SUCCESSFUL!                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Next steps:");
  console.log("  1. Fund vault token accounts with initial liquidity");
  console.log("  2. Set up oracle price updates (cron job or keeper)");
  console.log("  3. Test deposit/exit flow");
  console.log("  4. Update fee recipient if needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });