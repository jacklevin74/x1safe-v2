#!/usr/bin/env node
/**
 * Deploy X1SAFE V2 Program to Testnet
 * Uses solana/web3.js to deploy BPF program
 */

const { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, BPF_LOADER_PROGRAM_ID } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://rpc.testnet.x1.xyz";
const PROGRAM_SO_PATH = path.join(__dirname, "../target/deploy/x1safe_v2.so");

function loadWallet() {
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const data = JSON.parse(fs.readFileSync(keypairPath));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function deployProgram() {
  console.log("🎩 X1SAFE V2 Program Deployment\n");
  
  const wallet = loadWallet();
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);
  console.log("Balance:", (balance/1e9).toFixed(4), "XNT");
  
  // Load program binary
  const programBinary = fs.readFileSync(PROGRAM_SO_PATH);
  console.log("Program binary:", programBinary.length, "bytes");
  
  // Generate program keypair or use existing
  const programKeypairPath = path.join(__dirname, "../target/deploy/x1safe_v2-keypair.json");
  let programKeypair;
  
  if (fs.existsSync(programKeypairPath)) {
    const data = JSON.parse(fs.readFileSync(programKeypairPath));
    programKeypair = Keypair.fromSecretKey(new Uint8Array(data));
    console.log("Using existing program ID:", programKeypair.publicKey.toBase58());
  } else {
    programKeypair = Keypair.generate();
    fs.writeFileSync(programKeypairPath, JSON.stringify(Array.from(programKeypair.secretKey)));
    console.log("Generated new program ID:", programKeypair.publicKey.toBase58());
  }
  
  // Check if already deployed
  const existing = await conn.getAccountInfo(programKeypair.publicKey);
  if (existing && existing.data.length > 100) {
    console.log("\n✅ Program already deployed!");
    console.log("Program ID:", programKeypair.publicKey.toBase58());
    return programKeypair.publicKey.toBase58();
  }
  
  console.log("\n⚠️  Note: BPF loader deployment requires solana CLI.");
  console.log("Please run manually:");
  console.log(`  solana program deploy ${PROGRAM_SO_PATH} --program-id ${programKeypairPath} --url ${RPC_URL}`);
  
  return null;
}

deployProgram().catch(console.error);
