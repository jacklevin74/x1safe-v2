#!/usr/bin/env node
/**
 * X1SAFE V2 Initialize - Minimal working version
 */

const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey("GDd6RdVUwtx7qET8znKPtBPASm5U6qgzr3wz1GRmWrDz");
const RPC_URL = "https://rpc.testnet.x1.xyz";

const TOKENS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

function loadWallet() {
  const data = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json")));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

// Create TX using Solana web3 directly
async function createInitializeTx(wallet, x1safeMint) {
  const { Transaction, TransactionInstruction } = require("@solana/web3.js");
  
  // PDAs
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], PROGRAM_ID);
  
  // Vault ATAs
  const vaultUsdcX = getAssociatedTokenAddressSync(TOKENS.USDC_X, vaultAuthority, true);
  const vaultXnt = getAssociatedTokenAddressSync(TOKENS.XNT, vaultAuthority, true);
  const vaultXen = getAssociatedTokenAddressSync(TOKENS.XEN, vaultAuthority, true);
  const vaultXnm = getAssociatedTokenAddressSync(TOKENS.XNM, vaultAuthority, true);
  
  // Anchor instruction discriminator for "initialize"
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
  
  // Args: fee_recipient (32 bytes), burn_address (32 bytes), deposit_fee_bps (2 bytes), exit_fee_bps (2 bytes)
  const args = Buffer.concat([
    wallet.publicKey.toBytes(),
    wallet.publicKey.toBytes(),
    Buffer.from([50, 0]), // 0.5%
    Buffer.from([50, 0]),
  ]);
  
  const data = Buffer.concat([discriminator, args]);
  
  const keys = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: adminConfig, isSigner: false, isWritable: true },
    { pubkey: x1safeMint.publicKey, isSigner: true, isWritable: true },
    { pubkey: vaultAuthority, isSigner: false, isWritable: false },
    { pubkey: vaultUsdcX, isSigner: false, isWritable: true },
    { pubkey: vaultXnt, isSigner: false, isWritable: true },
    { pubkey: vaultXen, isSigner: false, isWritable: true },
    { pubkey: vaultXnm, isSigner: false, isWritable: true },
    { pubkey: TOKENS.USDC_X, isSigner: false, isWritable: false },
    { pubkey: TOKENS.XNT, isSigner: false, isWritable: false },
    { pubkey: TOKENS.XEN, isSigner: false, isWritable: false },
    { pubkey: TOKENS.XNM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  
  return new Transaction().add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data
    })
  );
}

async function main() {
  console.log("🎩 X1SAFE V2 Initialize\n");
  
  const wallet = loadWallet();
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);
  console.log("Balance:", (balance/1e9).toFixed(4), "XNT\n");
  
  // Check if already initialized
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  if (await conn.getAccountInfo(adminConfig)) {
    console.log("✅ Already initialized!");
    return;
  }
  
  // Generate mint
  const x1safeMint = Keypair.generate();
  console.log("Mint:", x1safeMint.publicKey.toBase58());
  fs.writeFileSync(".x1safe-mint.json", JSON.stringify(Array.from(x1safeMint.secretKey)));
  
  // Create and send tx
  const tx = await createInitializeTx(wallet, x1safeMint);
  tx.feePayer = wallet.publicKey;
  
  console.log("\n🚀 Sending...");
  try {
    const sig = await conn.sendTransaction(tx, [wallet, x1safeMint], { commitment: "confirmed" });
    console.log("✅ SUCCESS!");
    console.log("Tx:", sig);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
  } catch(e) {
    console.error("❌ Failed:", e.message);
    if (e.logs) console.log("Logs:", e.logs.join("\n"));
  }
}

main().catch(console.error);
