#!/usr/bin/env node
/**
 * Deploy X1SAFE V2 using Anchor CLI (if available) or direct RPC calls
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://rpc.testnet.x1.xyz";
const PROGRAM_SO_PATH = path.join(__dirname, "../target/deploy/x1safe_v2.so");
const PROGRAM_KEYPAIR_PATH = path.join(__dirname, "../target/deploy/x1safe_v2-keypair.json");

async function checkAnchor() {
  try {
    execSync("which anchor", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function checkSolana() {
  try {
    execSync("which solana", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║   X1SAFE V2 - Deploy Program                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const hasAnchor = await checkAnchor();
  const hasSolana = await checkSolana();

  console.log("🔧 Tools available:");
  console.log("   Anchor:", hasAnchor ? "✅" : "❌");
  console.log("   Solana CLI:", hasSolana ? "✅" : "❌");
  console.log();

  if (!fs.existsSync(PROGRAM_SO_PATH)) {
    console.error("❌ Program binary not found:", PROGRAM_SO_PATH);
    console.log("Run: anchor build");
    process.exit(1);
  }

  if (!fs.existsSync(PROGRAM_KEYPAIR_PATH)) {
    console.error("❌ Program keypair not found:", PROGRAM_KEYPAIR_PATH);
    process.exit(1);
  }

  // Read program ID
  const keypairData = JSON.parse(fs.readFileSync(PROGRAM_KEYPAIR_PATH, "utf8"));
  const { PublicKey } = require("@solana/web3.js");
  const programId = PublicKey.fromSecretKey(new Uint8Array(keypairData)).toBase58();
  
  console.log("📦 Program file:", PROGRAM_SO_PATH);
  console.log("🔑 Program ID:", programId);
  console.log("📡 RPC:", RPC_URL);
  console.log();

  // Check if program already exists
  try {
    const { Connection } = require("@solana/web3.js");
    const conn = new Connection(RPC_URL);
    const account = await conn.getAccountInfo(new PublicKey(programId));
    if (account) {
      console.log("⚠️  Program already exists at this address!");
      console.log("   Executable:", account.executable ? "✅ Yes" : "❌ No");
      console.log("   Size:", account.data.length, "bytes");
      
      if (account.executable) {
        console.log("\n✅ Program is already deployed and executable!");
        console.log("   Explorer: https://explorer.testnet.x1.xyz/address/" + programId);
        return;
      }
    }
  } catch (e) {
    // Account doesn't exist, continue with deploy
  }

  console.log("🚀 Deploying...\n");

  if (hasSolana) {
    // Use Solana CLI
    try {
      const result = execSync(
        `solana program deploy "${PROGRAM_SO_PATH}" ` +
        `--program-id "${PROGRAM_KEYPAIR_PATH}" ` +
        `--url "${RPC_URL}" ` +
        `--fee-payer ~/.config/solana/id.json`,
        { 
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 300000
        }
      );
      console.log(result);
      console.log("\n✅ Deployment successful!");
    } catch (e) {
      console.error("❌ Solana CLI deploy failed:", e.message);
      if (e.stderr) console.error(e.stderr.toString());
      process.exit(1);
    }
  } else if (hasAnchor) {
    // Use Anchor
    try {
      process.chdir(path.join(__dirname, ".."));
      const result = execSync(
        `anchor deploy --program-name x1safe_v2 --url "${RPC_URL}"`,
        { 
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 300000
        }
      );
      console.log(result);
      console.log("\n✅ Deployment successful!");
    } catch (e) {
      console.error("❌ Anchor deploy failed:", e.message);
      if (e.stderr) console.error(e.stderr.toString());
      process.exit(1);
    }
  } else {
    console.error("❌ Neither Solana CLI nor Anchor found!");
    console.log("Install with:");
    console.log("  sh -c \"$(curl -sSfL https://release.solana.com/v1.17.0/install)\"");
    console.log("Or:");  
    console.log("  npm install -g @coral-xyz/anchor");
    process.exit(1);
  }

  // Save deployment info
  const deploymentInfo = {
    network: RPC_URL,
    programId: programId,
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "../.deployment-testnet.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📝 Saved to:", deploymentPath);
  console.log("🔍 Explorer: https://explorer.testnet.x1.xyz/address/" + programId);
}

main().catch(e => {
  console.error("\n❌ Fatal error:", e.message);
  process.exit(1);
});
