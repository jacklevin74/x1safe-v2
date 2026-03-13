#!/usr/bin/env node
/**
 * X1SAFE V2 Initialize - FINAL
 */

const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const PROGRAM_ID = new PublicKey("34K7WkZjuvtzbYAVpaGk3Je69BnghKsTScpWBoj6nHTj");
const RPC_URL = "https://rpc.testnet.x1.xyz";

const TOKENS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

// Anchor discriminator for "initialize"
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
  
  // PDAs
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], PROGRAM_ID);
  
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("Admin:", adminConfig.toBase58());
  console.log("Vault:", vaultAuthority.toBase58());
  
  // Check if initialized
  if (await conn.getAccountInfo(adminConfig)) {
    console.log("\n✅ Already initialized!");
    return;
  }
  
  // Generate X1SAFE mint
  const x1safeMint = Keypair.generate();
  console.log("\nMint:", x1safeMint.publicKey.toBase58());
  fs.writeFileSync(".x1safe-mint.json", JSON.stringify(Array.from(x1safeMint.secretKey)));
  
  // Vault ATAs
  const vaultUsdcX = getAssociatedTokenAddressSync(TOKENS.USDC_X, vaultAuthority, true);
  const vaultXnt = getAssociatedTokenAddressSync(TOKENS.XNT, vaultAuthority, true);
  const vaultXen = getAssociatedTokenAddressSync(TOKENS.XEN, vaultAuthority, true);
  const vaultXnm = getAssociatedTokenAddressSync(TOKENS.XNM, vaultAuthority, true);
  
  // Args: fee_recipient, burn_address, deposit_fee_bps, exit_fee_bps
  const args = Buffer.concat([
    wallet.publicKey.toBytes(),
    wallet.publicKey.toBytes(),
    Buffer.from([50, 0]), // 0.5%
    Buffer.from([50, 0]),
  ]);
  
  const data = Buffer.concat([IX_INIT, args]);
  
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
  
  const { Transaction, TransactionInstruction } = require("@solana/web3.js");
  const tx = new Transaction().add(
    new TransactionInstruction({ programId: PROGRAM_ID, keys, data })
  );
  tx.feePayer = wallet.publicKey;
  
  console.log("\n🚀 Initializing...");
  try {
    const sig = await conn.sendTransaction(tx, [wallet, x1safeMint], { commitment: "confirmed" });
    console.log("✅ SUCCESS!");
    console.log("Tx:", sig);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
    
    // Save deployment info
    const info = {
      programId: PROGRAM_ID.toBase58(),
      adminConfig: adminConfig.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      x1safeMint: x1safeMint.publicKey.toBase58(),
      deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(".deployment-testnet.json", JSON.stringify(info, null, 2));
    console.log("\n📝 Saved to .deployment-testnet.json");
  } catch(e) {
    console.error("❌ Failed:", e.message);
    if (e.logs) console.log("Logs:", e.logs);
  }
}

main().catch(console.error);
