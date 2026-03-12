#!/usr/bin/env node
/**
 * Deploy X1SAFE V2 Program to Testnet (BPF Upgradeable Loader v3)
 * Uses solana/web3.js to deploy without CLI
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  TransactionInstruction,
  sendAndConfirmTransaction,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID
} = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://rpc.testnet.x1.xyz";
const PROGRAM_SO_PATH = path.join(__dirname, "../target/deploy/x1safe_v2.so");
const PROGRAM_KEYPAIR_PATH = path.join(__dirname, "../target/deploy/x1safe_v2-keypair.json");

// BPF Upgradeable Loader instruction indices
const BUFFER_CREATE = 0;
const BUFFER_WRITE = 1;
const DEPLOY_WITH_MAX_DATA_LEN = 2;

// Chunk size for program data
const CHUNK_SIZE = 800;

async function loadProgramBytes() {
  if (!fs.existsSync(PROGRAM_SO_PATH)) {
    throw new Error(`Program not found: ${PROGRAM_SO_PATH}`);
  }
  return fs.readFileSync(PROGRAM_SO_PATH);
}

async function loadProgramKeypair() {
  if (!fs.existsSync(PROGRAM_KEYPAIR_PATH)) {
    throw new Error(`Program keypair not found: ${PROGRAM_KEYPAIR_PATH}`);
  }
  const data = JSON.parse(fs.readFileSync(PROGRAM_KEYPAIR_PATH, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function loadWallet() {
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Wallet not found: ${keypairPath}`);
  }
  const data = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function deployProgram(connection, payer, programKeypair, programBytes) {
  console.log("📦 Program size:", programBytes.length, "bytes");
  console.log("🔑 Program ID:", programKeypair.publicKey.toBase58());
  console.log("👤 Payer:", payer.publicKey.toBase58());

  const loaderId = BPF_LOADER_UPGRADEABLE_PROGRAM_ID;

  // Calculate rent for program data account
  const programDataRent = await connection.getMinimumBalanceForRentExemption(
    programBytes.length + 8, // +8 for header
    "confirmed"
  );

  // Calculate rent for buffer
  const bufferSize = programBytes.length;
  const bufferRent = await connection.getMinimumBalanceForRentExemption(
    bufferSize + 8, // +8 for header
    "confirmed"
  );

  console.log("💰 Program data rent:", (programDataRent / 1e9).toFixed(9), "XNT");
  console.log("💰 Buffer rent:", (bufferRent / 1e9).toFixed(9), "XNT");

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("💳 Payer balance:", (balance / 1e9).toFixed(4), "XNT");

  const required = programDataRent + bufferRent + 0.05 * 1e9; // +0.05 for fees
  if (balance < required) {
    throw new Error(`Insufficient balance. Need ${(required/1e9).toFixed(4)} XNT`);
  }

  // Create buffer account
  const bufferKeypair = Keypair.generate();
  console.log("\n🚀 Starting deployment (Upgradeable Loader v3)...");
  console.log("📁 Buffer account:", bufferKeypair.publicKey.toBase58().slice(0, 20) + "...");

  // Step 1: Create buffer with BPF Loader Upgradeable
  console.log("\n1️⃣  Creating buffer account...");
  const createBufferTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: bufferKeypair.publicKey,
      lamports: bufferRent,
      space: bufferSize,
      programId: loaderId,
    })
  );

  const createSig = await sendAndConfirmTransaction(connection, createBufferTx, [payer, bufferKeypair]);
  console.log("   ✅ Buffer created:", createSig.slice(0, 20) + "...");

  // Step 2: Write program data in chunks
  console.log("\n2️⃣  Uploading program data...");
  const numChunks = Math.ceil(programBytes.length / CHUNK_SIZE);
  console.log("   Chunks:", numChunks);

  for (let i = 0; i < numChunks; i++) {
    const offset = i * CHUNK_SIZE;
    const chunk = programBytes.slice(offset, offset + CHUNK_SIZE);

    // Create write instruction for Upgradeable Loader
    const keys = [
      { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ];

    const data = Buffer.alloc(5 + chunk.length);
    data.writeUInt32LE(BUFFER_WRITE, 0); // instruction: Write
    data.writeUInt32LE(offset, 1); // offset
    chunk.copy(data, 5); // data

    const writeTx = new Transaction().add(
      new TransactionInstruction({
        keys,
        programId: loaderId,
        data,
      })
    );

    await sendAndConfirmTransaction(connection, writeTx, [payer]);

    if ((i + 1) % 10 === 0 || i === numChunks - 1) {
      process.stdout.write(`\r   Progress: ${i + 1}/${numChunks} (${Math.round((i+1)/numChunks*100)}%)`);
    }
  }
  console.log("\n   ✅ Program data uploaded");

  // Step 3: Create program account
  console.log("\n3️⃣  Creating program account...");
  const programRent = await connection.getMinimumBalanceForRentExemption(
    36, // Program account is small (just points to program data)
    "confirmed"
  );

  const createProgramTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: programKeypair.publicKey,
      lamports: programRent,
      space: 36,
      programId: loaderId,
    })
  );

  await sendAndConfirmTransaction(connection, createProgramTx, [payer, programKeypair]);
  console.log("   ✅ Program account created");

  // Step 4: Deploy/Initialize program
  console.log("\n4️⃣  Finalizing deployment...");
  
  // Calculate program data address (PDA derived from program key)
  const [programDataPDA] = PublicKey.findProgramAddressSync(
    [programKeypair.publicKey.toBuffer()],
    loaderId
  );

  const keys = [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: programDataPDA, isSigner: false, isWritable: true },
    { pubkey: programKeypair.publicKey, isSigner: false, isWritable: true },
    { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // rent sysvar
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // DeployWithMaxDataLen: instruction 2
  // Data: [2] + [max_data_len: u64 little endian]
  const maxDataLen = programBytes.length;
  const data = Buffer.alloc(9);
  data.writeUInt32LE(DEPLOY_WITH_MAX_DATA_LEN, 0);
  data.writeBigUInt64LE(BigInt(maxDataLen), 1);

  const deployTx = new Transaction().add(
    new TransactionInstruction({
      keys,
      programId: loaderId,
      data,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, deployTx, [payer]);
  console.log("   ✅ Deployment finalized!");
  console.log("   Signature:", sig);

  // Step 5: Verify
  console.log("\n5️⃣  Verifying deployment...");
  const accountInfo = await connection.getAccountInfo(programKeypair.publicKey);

  if (accountInfo && accountInfo.executable) {
    console.log("   ✅ Program is executable!");
    console.log("   Program data size:", accountInfo.data.length, "bytes");
    return programKeypair.publicKey.toBase58();
  } else {
    throw new Error("Program not marked as executable");
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   X1SAFE V2 - Deploy (BPF Upgradeable Loader v3)      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const [payer, programKeypair, programBytes] = await Promise.all([
    loadWallet(),
    loadProgramKeypair(),
    loadProgramBytes()
  ]);

  try {
    const programId = await deployProgram(connection, payer, programKeypair, programBytes);

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║              ✅ DEPLOYMENT SUCCESSFUL!                    ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("\n📦 Program ID:", programId);
    console.log("🔍 Explorer: https://explorer.testnet.x1.xyz/address/" + programId);

    // Save deployment info
    const deploymentInfo = {
      network: RPC_URL,
      programId: programId,
      deployedAt: new Date().toISOString(),
      deployer: payer.publicKey.toBase58(),
    };

    const deploymentPath = path.join(__dirname, "../.deployment-testnet.json");
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📝 Saved to:", deploymentPath);

    // Update constants for web-ui
    console.log("\n⚠️  Remember to update web-ui/src/constants.ts with new program ID!");

  } catch (e) {
    console.error("\n❌ Deployment failed:", e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
