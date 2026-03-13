#!/usr/bin/env node
/**
 * Initialize X1SAFE V2 - Program GDd6RdVUwtx7qET8znKPtBPASm5U6qgzr3wz1GRmWrDz
 */

const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
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

// Instruction: initialize = 175,175,109,31,13,152,155,237
const IX_INIT = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

function loadWallet() {
  const data = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json")));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function main() {
  console.log("🎩 X1SAFE V2 Initialize\n");
  
  const wallet = loadWallet();
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);
  console.log("Balance:", (balance/1e9).toFixed(4), "XNT\n");
  
  // Derive PDAs
  const [adminPda] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [oraclePda] = PublicKey.findProgramAddressSync([Buffer.from("oracle_config")], PROGRAM_ID);
  const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], PROGRAM_ID);
  
  console.log("Admin:", adminPda.toBase58());
  console.log("Oracle:", oraclePda.toBase58());
  console.log("Vault:", vaultAuth.toBase58());
  
  // Check if exists
  if (await conn.getAccountInfo(adminPda)) {
    console.log("\n✅ Already initialized!");
    return;
  }
  
  // Generate X1SAFE mint
  const x1safeMint = Keypair.generate();
  console.log("\nMint:", x1safeMint.publicKey.toBase58());
  
  // Save mint
  fs.writeFileSync(".x1safe-mint.json", JSON.stringify(Array.from(x1safeMint.secretKey)));
  
  // Vault token accounts
  const vaultUsdcX = getAssociatedTokenAddressSync(TOKENS.USDC_X, vaultAuth, true);
  const vaultXnt = getAssociatedTokenAddressSync(TOKENS.XNT, vaultAuth, true);
  const vaultXen = getAssociatedTokenAddressSync(TOKENS.XEN, vaultAuth, true);
  const vaultXnm = getAssociatedTokenAddressSync(TOKENS.XNM, vaultAuth, true);
  
  // Args: fee_recipient (32), burn_address (32), deposit_fee_bps (2), exit_fee_bps (2)
  const args = Buffer.concat([
    wallet.publicKey.toBytes(),
    wallet.publicKey.toBytes(),
    Buffer.from([50, 0]), // 0.5%
    Buffer.from([50, 0]),
  ]);
  
  const data = Buffer.concat([IX_INIT, args]);
  
  const keys = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: adminPda, isSigner: false, isWritable: true },
    { pubkey: x1safeMint.publicKey, isSigner: true, isWritable: true },
    { pubkey: vaultAuth, isSigner: false, isWritable: false },
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
  
  const tx = new Transaction().add({ programId: PROGRAM_ID, keys, data });
  tx.feePayer = wallet.publicKey;
  
  console.log("\n🚀 Initializing...");
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet, x1safeMint], { commitment: "confirmed" });
    console.log("✅ SUCCESS!");
    console.log("Tx:", sig);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
  } catch(e) {
    console.error("❌ Failed:", e.message);
    if (e.logs) console.log(e.logs);
  }
}

main().catch(console.error);
