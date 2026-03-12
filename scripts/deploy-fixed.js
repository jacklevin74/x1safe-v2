#!/usr/bin/env node
/**
 * Deploy X1SAFE V2 Program to Testnet (BPF Upgradeable Loader v3)
 * Pure web3.js implementation
 */

const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction
} = require("@solana/web3.js");

// BPF Upgradeable Loader
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://rpc.testnet.x1.xyz";
const PROGRAM_SO_PATH = path.join(__dirname, "../target/deploy/x1safe_v2.so");
const PROGRAM_KEYPAIR_PATH = path.join(__dirname, "../target/deploy/x1safe_v2-keypair-new.json");

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
  return Keypair.fromSecretKey(Uint8Array.from(data));
}

async function loadWallet() {
  const keypairPath = path.join(process.env.HOME || "/home/jack", ".config/solana/id.json");
  if (!fs.existsSync(keypairPath)) {
    throw new Error(`Wallet not found: ${keypairPath}`);
  }
  const data = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(data));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deployProgram(connection, payer, programKeypair, programBytes) {
  console.log("📦 Program size:", programBytes.length, "bytes");
  console.log("🔑 Program ID:", programKeypair.publicKey.toBase58());
  console.log("👤 Payer:", payer.publicKey.toBase58());

  const loaderId = BPF_LOADER_UPGRADEABLE_PROGRAM_ID;

  // Check if program already exists and is executable
  const existing = await connection.getAccountInfo(programKeypair.publicKey);
  if (existing) {
    if (existing.executable) {
      console.log("✅ Program already deployed and executable!");
      return programKeypair.publicKey.toBase58();
    } else {
      console.log("⚠️  Account exists but not executable. Need fresh keypair.");
      throw new Error("Program account exists with wrong data");
    }
  }

  // Calculate rent
  const programDataRent = await connection.getMinimumBalanceForRentExemption(programBytes.length);
  const bufferSize = programBytes.length;
  const bufferRent = await connection.getMinimumBalanceForRentExemption(bufferSize);

  console.log("💰 Program rent:", (programDataRent / 1e9).toFixed(6), "XNT");
  console.log("💰 Buffer rent:", (bufferRent / 1e9).toFixed(6), "XNT");

  const balance = await connection.getBalance(payer.publicKey);
  console.log("💳 Balance:", (balance / 1e9).toFixed(4), "XNT");

  const required = programDataRent + bufferRent + 0.1 * 1e9;
  if (balance < required) {
    throw new Error(`Need ${(required/1e9).toFixed(4)} XNT, have ${(balance/1e9).toFixed(4)}`);
  }

  // Generate buffer keypair
  const bufferKeypair = Keypair.generate();
  console.log("\n🚀 Deploying with BPF Loader v3...");
  console.log("📁 Buffer:", bufferKeypair.publicKey.toBase58().slice(0, 16) + "...");
  console.log("Debug - payer:", payer?.publicKey?.toBase58());
  console.log("Debug - buffer:", bufferKeypair?.publicKey?.toBase58());
  console.log("Debug - loaderId:", loaderId?.toBase58());
  console.log("Debug - bufferRent:", bufferRent);
  console.log("Debug - bufferSize:", bufferSize);

  // Step 1: Create buffer account
  console.log("\n1️⃣  Creating buffer...");
  const createBufferTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: bufferKeypair.publicKey,
      lamports: bufferRent,
      space: bufferSize,
      programId: loaderId,
    })
  );

  await sendAndConfirmTransaction(connection, createBufferTx, [payer, bufferKeypair]);
  console.log("   ✅ Buffer created");
  await sleep(500);

  // Step 2: Write data in chunks
  console.log("\n2️⃣  Writing program data...");
  const numChunks = Math.ceil(programBytes.length / CHUNK_SIZE);
  console.log("   Chunks:", numChunks);

  for (let i = 0; i < numChunks; i++) {
    const offset = i * CHUNK_SIZE;
    const chunk = programBytes.slice(offset, Math.min(offset + CHUNK_SIZE, programBytes.length));
    
    // Instruction: Write = 1
    // Format: [1] + [offset: u32 LE] + [data...]
    const data = Buffer.alloc(1 + 4 + chunk.length);
    data.writeUInt8(1, 0); // Write instruction (1 byte)
    data.writeUInt32LE(offset, 1); // offset (4 bytes LE)
    chunk.copy(data, 5); // data

    const writeTx = new Transaction().add({
      keys: [
        { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      programId: loaderId,
      data: data,
    });

    await sendAndConfirmTransaction(connection, writeTx, [payer]);
    
    if ((i + 1) % 20 === 0 || i === numChunks - 1) {
      process.stdout.write(`\r   ${i + 1}/${numChunks} (${Math.round((i+1)/numChunks*100)}%)`);
    }
  }
  console.log("\n   ✅ Data written");
  await sleep(500);

  // Step 3: Create program account
  console.log("\n3️⃣  Creating program account...");
  const programRent = await connection.getMinimumBalanceForRentExemption(36);
  
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
  await sleep(500);

  // Step 4: Deploy with max data length
  console.log("\n4️⃣  Finalizing...");
  
  // Find program data PDA
  const [programDataPDA] = PublicKey.findProgramAddressSync(
    [programKeypair.publicKey.toBuffer()],
    loaderId
  );

  // DeployWithMaxDataLen = 2
  const data = Buffer.alloc(9);
  data.writeUInt32LE(2, 0); // Deploy instruction
  data.writeBigUInt64LE(BigInt(programBytes.length), 1);

  const deployTx = new Transaction().add({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: programDataPDA, isSigner: false, isWritable: true },
      { pubkey: programKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: bufferKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    programId: loaderId,
    data: data,
  });

  const sig = await sendAndConfirmTransaction(connection, deployTx, [payer]);
  console.log("   ✅ Deployed! Sig:", sig.slice(0, 20) + "...");

  // Verify
  const info = await connection.getAccountInfo(programKeypair.publicKey);
  if (info?.executable) {
    console.log("   ✅ Program is executable!");
    return programKeypair.publicKey.toBase58();
  }
  throw new Error("Program not executable");
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   X1SAFE V2 - Deploy to Testnet                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const [payer, programKeypair, programBytes] = await Promise.all([
    loadWallet(),
    loadProgramKeypair(),
    loadProgramBytes()
  ]);

  const programId = await deployProgram(connection, payer, programKeypair, programBytes);

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              ✅ DEPLOYMENT SUCCESSFUL!                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n📦 Program ID:", programId);
  console.log("🔗 Explorer: https://explorer.testnet.x1.xyz/address/" + programId);

  // Save info
  fs.writeFileSync(
    path.join(__dirname, "../.deployment-testnet.json"),
    JSON.stringify({
      network: RPC_URL,
      programId: programId,
      deployedAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log("\n⚠️  IMPORTANT: Update these files with new program ID:");
  console.log("   - web-ui/src/constants.ts");
  console.log("   - programs/x1safe_v2/src/lib.rs (declare_id!)");
  console.log("   - idl/x1safe_v2.json (metadata.address)");
}

main().catch(e => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
