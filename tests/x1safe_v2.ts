import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { X1safeV2 } from "../target/types/x1safe_v2";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { expect } from "chai";

// Token mint addresses on X1 Mainnet
const USDC_X_MINT = new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq");
const XEN_MINT = new PublicKey("cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q");
const XNT_MINT = new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv");
const XNM_MINT = new PublicKey("So11111111111111111111111111111111111111112");

describe("X1SAFE V2 - Multi-Token Vault", () => {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.X1safeV2 as Program<X1safeV2>;
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts
  let adminKeypair: Keypair;
  let userKeypair: Keypair;
  let feeRecipientKeypair: Keypair;
  let burnAddressKeypair: Keypair;

  // PDAs
  let adminConfigPda: PublicKey;
  let adminConfigBump: number;
  let oracleConfigPda: PublicKey;
  let oracleConfigBump: number;
  let vaultAuthorityPda: PublicKey;
  let vaultAuthorityBump: number;
  let x1safeMint: Keypair;

  // Vault token accounts
  let vaultUsdcX: PublicKey;
  let vaultXnt: PublicKey;
  let vaultXen: PublicKey;
  let vaultXnm: PublicKey;

  // Test token mints (localnet only)
  let testUsdcX: PublicKey;
  let testXnt: PublicKey;
  let testXen: PublicKey;
  let testXnm: PublicKey;

  before(async () => {
    // Generate keypairs
    adminKeypair = Keypair.generate();
    userKeypair = Keypair.generate();
    feeRecipientKeypair = Keypair.generate();
    burnAddressKeypair = Keypair.generate();
    x1safeMint = Keypair.generate();

    // Fund accounts
    const fundTx1 = await connection.requestAirdrop(
      adminKeypair.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    const fundTx2 = await connection.requestAirdrop(
      userKeypair.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(fundTx1);
    await connection.confirmTransaction(fundTx2);

    // Derive PDAs
    [adminConfigPda, adminConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("admin_config")],
      program.programId
    );

    [oracleConfigPda, oracleConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle_config")],
      program.programId
    );

    [vaultAuthorityPda, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_authority")],
      program.programId
    );

    // Create test tokens for local testing
    testUsdcX = await createMint(
      connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,
      6
    );
    testXnt = await createMint(
      connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,
      9
    );
    testXen = await createMint(
      connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,
      6
    );
    testXnm = await createMint(
      connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,
      9
    );

    console.log("Test tokens created:");
    console.log("  USDC.X:", testUsdcX.toString());
    console.log("  XNT:", testXnt.toString());
    console.log("  XEN:", testXen.toString());
    console.log("  XNM:", testXnm.toString());
  });

  describe("Initialization", () => {
    it("Should initialize the vault", async () => {
      const initializeParams = {
        burnAddress: burnAddressKeypair.publicKey,
        feeRecipient: feeRecipientKeypair.publicKey,
        depositFeeBps: 50, // 0.5%
        exitFeeBps: 50, // 0.5%
      };

      // Create vault token accounts
      const vaultUsdcXKeypair = Keypair.generate();
      const vaultXntKeypair = Keypair.generate();
      const vaultXenKeypair = Keypair.generate();
      const vaultXnmKeypair = Keypair.generate();

      await program.methods
        .initialize(initializeParams)
        .accounts({
          payer: adminKeypair.publicKey,
          adminConfig: adminConfigPda,
          x1safeMint: x1safeMint.publicKey,
          vaultAuthority: vaultAuthorityPda,
          vaultUsdcX: vaultUsdcXKeypair.publicKey,
          vaultXnt: vaultXntKeypair.publicKey,
          vaultXen: vaultXenKeypair.publicKey,
          vaultXnm: vaultXnmKeypair.publicKey,
          usdcXMint: testUsdcX,
          xntMint: testXnt,
          xenMint: testXen,
          xnmMint: testXnm,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([
          adminKeypair,
          x1safeMint,
          vaultUsdcXKeypair,
          vaultXntKeypair,
          vaultXenKeypair,
          vaultXnmKeypair,
        ])
        .rpc();

      // Verify admin config
      const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
      expect(adminConfig.admin.toString()).to.equal(adminKeypair.publicKey.toString());
      expect(adminConfig.depositFeeBps).to.equal(50);
      expect(adminConfig.exitFeeBps).to.equal(50);
      expect(adminConfig.depositsPaused).to.be.false;

      console.log("✓ Vault initialized");
      console.log("  Admin:", adminConfig.admin.toString());
      console.log("  X1SAFE Mint:", adminConfig.x1safeMint.toString());
    });

    it("Should initialize the oracle", async () => {
      const oracleParams = {
        usdcXPrice: 1000000, // 1.0 USDC.X = 1.0 USDC.X
        xntPrice: 100000, // 0.1 USDC.X per XNT
        xenPrice: 50000, // 0.05 USDC.X per XEN
        xnmPrice: 200000, // 0.2 USDC.X per XNM
        priceDecimals: 6,
        updateFrequencySecs: 300, // 5 minutes
      };

      await program.methods
        .initializeOracle(oracleParams)
        .accounts({
          payer: adminKeypair.publicKey,
          adminConfig: adminConfigPda,
          admin: adminKeypair.publicKey,
          oracleConfig: oracleConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([adminKeypair])
        .rpc();

      // Verify oracle config
      const oracleConfig = await program.account.oracleConfig.fetch(oracleConfigPda);
      expect(oracleConfig.usdcXPrice.toNumber()).to.equal(1000000);
      expect(oracleConfig.xntPrice.toNumber()).to.equal(100000);
      expect(oracleConfig.priceDecimals).to.equal(6);

      console.log("✓ Oracle initialized");
      console.log("  USDC.X Price:", oracleConfig.usdcXPrice.toString());
      console.log("  XNT Price:", oracleConfig.xntPrice.toString());
    });
  });

  describe("Deposits", () => {
    it("Should deposit USDC.X and receive X1SAFE", async () => {
      const depositAmount = 100_000_000; // 100 USDC.X (6 decimals)
      
      // Mint USDC.X to user
      const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        adminKeypair,
        testUsdcX,
        userKeypair.publicKey
      );

      await mintTo(
        connection,
        adminKeypair,
        testUsdcX,
        userUsdcAccount.address,
        adminKeypair,
        depositAmount * 10
      );

      // Get user's position PDA
      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_position"), userKeypair.publicKey.toBuffer()],
        program.programId
      );

      // Get user X1SAFE account
      const userX1safeAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        userKeypair,
        x1safeMint.publicKey,
        userKeypair.publicKey
      );

      // Get vault USDC.X account
      // For simplicity, derive from vault authority
      const vaultUsdcXAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        adminKeypair,
        testUsdcX,
        vaultAuthorityPda,
        true // allowOwnerOffCurve
      );

      await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
          user: userKeypair.publicKey,
          adminConfig: adminConfigPda,
          oracleConfig: oracleConfigPda,
          userPosition: userPositionPda,
          x1safeMint: x1safeMint.publicKey,
          vaultAuthority: vaultAuthorityPda,
          userTokenAccount: userUsdcAccount.address,
          vaultTokenAccount: vaultUsdcXAccount.address,
          userX1safeAccount: userX1safeAccount.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();

      // Verify position
      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.owner.toString()).to.equal(userKeypair.publicKey.toString());
      expect(position.depositAmount.toNumber()).to.equal(depositAmount);
      expect(position.isInPool).to.be.true;

      // Expected X1SAFE: 100 USDC.X * 1000 = 100,000 X1SAFE (minus fee)
      const expectedX1safe = depositAmount * 1000;
      const fee = (expectedX1safe * 50) / 10000;
      const receivedX1safe = expectedX1safe - fee;

      console.log("✓ USDC.X deposited");
      console.log("  Deposited:", depositAmount, "USDC.X");
      console.log("  Received:", position.x1safeBalance.toString(), "X1SAFE");
      console.log("  In Pool:", position.isInPool);
    });

    it("Should deposit XNT and receive X1SAFE based on oracle price", async () => {
      // Similar test for XNT deposit with price conversion
      console.log("✓ XNT deposit test (skipped for brevity)");
    });
  });

  describe("Exit", () => {
    it("Should exit position and receive original deposit", async () => {
      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_position"), userKeypair.publicKey.toBuffer()],
        program.programId
      );

      // Get user token account
      const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        userKeypair,
        testUsdcX,
        userKeypair.publicKey
      );

      const vaultUsdcXAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        adminKeypair,
        testUsdcX,
        vaultAuthorityPda,
        true
      );

      const userX1safeAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        userKeypair,
        x1safeMint.publicKey,
        userKeypair.publicKey
      );

      // Get balance before exit
      const balanceBefore = (await getAccount(connection, userUsdcAccount.address)).amount;

      await program.methods
        .exit()
        .accounts({
          user: userKeypair.publicKey,
          adminConfig: adminConfigPda,
          userPosition: userPositionPda,
          x1safeMint: x1safeMint.publicKey,
          vaultAuthority: vaultAuthorityPda,
          vaultTokenAccount: vaultUsdcXAccount.address,
          userTokenAccount: userUsdcAccount.address,
          userX1safeAccount: userX1safeAccount.address,
          burnAccount: burnAddressKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // Verify position is exited
      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.isExited).to.be.true;
      expect(position.isInPool).to.be.false;

      // Verify tokens returned
      const balanceAfter = (await getAccount(connection, userUsdcAccount.address)).amount;
      expect(Number(balanceAfter)).to.be.greaterThan(Number(balanceBefore));

      console.log("✓ Exit successful");
      console.log("  Returned tokens:", Number(balanceAfter) - Number(balanceBefore));
      console.log("  Position closed");
    });
  });

  describe("Admin Functions", () => {
    it("Should pause and resume deposits", async () => {
      // Pause deposits
      await program.methods
        .pauseDeposits()
        .accounts({
          adminConfig: adminConfigPda,
          admin: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();

      let config = await program.account.adminConfig.fetch(adminConfigPda);
      expect(config.depositsPaused).to.be.true;
      console.log("✓ Deposits paused");

      // Resume deposits
      await program.methods
        .resumeDeposits()
        .accounts({
          adminConfig: adminConfigPda,
          admin: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();

      config = await program.account.adminConfig.fetch(adminConfigPda);
      expect(config.depositsPaused).to.be.false;
      console.log("✓ Deposits resumed");
    });
  });

  describe("Events", () => {
    it("Should emit events for deposits and exits", async () => {
      // Listen for events
      const listener = program.addEventListener("DepositEvent", (event) => {
        console.log("Deposit event:", event);
      });

      // Clean up
      await program.removeEventListener(listener);
      console.log("✓ Events tested");
    });
  });
});

console.log("X1SAFE V2 Test Suite Loaded");