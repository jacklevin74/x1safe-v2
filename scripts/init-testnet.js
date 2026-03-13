#!/usr/bin/env node
/**
 * Initialize X1SAFE V2 on Testnet
 * Program: 34K7WkZjuvtzbYAVpaGk3Je69BnghKsTScpWBoj6nHTj
 */

const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
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
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const data = JSON.parse(fs.readFileSync(keypairPath));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function main() {
  console.log("🎩 X1SAFE V2 Initialize - Testnet\n");
  
  const wallet = loadWallet();
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const conn = new Connection(RPC_URL, "confirmed");
  const balance = await conn.getBalance(wallet.publicKey);
  console.log("Balance:", (balance/1e9).toFixed(4), "XNT\n");
  
  if (balance < 0.1) {
    console.error("❌ Insufficient balance. Need at least 0.1 XNT");
    process.exit(1);
  }
  
  // PDAs
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], PROGRAM_ID);
  
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("Admin:", adminConfig.toBase58());
  console.log("Vault:", vaultAuthority.toBase58());
  
  // Check if initialized
  const accountInfo = await conn.getAccountInfo(adminConfig);
  if (accountInfo) {
    console.log("\n✅ Already initialized!");
    return;
  }
  
  // Generate X1SAFE mint
  const x1safeMint = Keypair.generate();
  console.log("\nX1SAFE Mint:", x1safeMint.publicKey.toBase58());
  
  // Save mint keypair
  fs.writeFileSync(".x1safe-mint-testnet.json", JSON.stringify(Array.from(x1safeMint.secretKey)));
  
  // Vault ATAs
  const vaultUsdcX = getAssociatedTokenAddressSync(TOKENS.USDC_X, vaultAuthority, true);
  const vaultXnt = getAssociatedTokenAddressSync(TOKENS.XNT, vaultAuthority, true);
  const vaultXen = getAssociatedTokenAddressSync(TOKENS.XEN, vaultAuthority, true);
  const vaultXnm = getAssociatedTokenAddressSync(TOKENS.XNM, vaultAuthority, true);
  
  console.log("\nVault ATAs:");
  console.log("  USDC.X:", vaultUsdcX.toBase58());
  console.log("  XNT:", vaultXnt.toBase58());
  console.log("  XEN:", vaultXen.toBase58());
  console.log("  XNM:", vaultXnm.toBase58());
  
  // Build InitializeParams: fee_recipient, burn_address, deposit_fee_bps, exit_fee_bps
  // fee_recipient: 32 bytes (wallet)
  // burn_address: 32 bytes (wallet for now)
  // deposit_fee_bps: u16 (50 = 0.5%)
  // exit_fee_bps: u16 (50 = 0.5%)
  const args = Buffer.alloc(68);
  wallet.publicKey.toBuffer().copy(args, 0);     // fee_recipient
  wallet.publicKey.toBuffer().copy(args, 32);    // burn_address  
  args.writeUInt16LE(50, 64);                      // deposit_fee_bps
  args.writeUInt16LE(50, 66);                      // exit_fee_bps
  
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
  
  const tx = new Transaction().add(
    new TransactionInstruction({ programId: PROGRAM_ID, keys, data })
  );
  tx.feePayer = wallet.publicKey;
  
  console.log("\n🚀 Initializing...");
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet, x1safeMint], { 
      commitment: "confirmed",
      preflightCommitment: "confirmed"
    });
    console.log("✅ SUCCESS!");
    console.log("Tx:", sig);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
    
    // Save deployment info
    const info = {
      network: RPC_URL,
      programId: PROGRAM_ID.toBase58(),
      adminConfig: adminConfig.toBase58(),
      vaultAuthority: vaultAuthority.toBase58(),
      x1safeMint: x1safeMint.publicKey.toBase58(),
      vaultUsdcX: vaultUsdcX.toBase58(),
      vaultXnt: vaultXnt.toBase58(),
      vaultXen: vaultXen.toBase58(),
      vaultXnm: vaultXnm.toBase58(),
      initializedAt: new Date().toISOString(),
    };
    fs.writeFileSync(".deployment-testnet-full.json", JSON.stringify(info, null, 2));
    console.log("\n📝 Saved to .deployment-testnet-full.json");
  } catch(e) {
    console.error("\n❌ Failed:", e.message);
    if (e.logs) {
      console.log("\nLogs:");
      e.logs.forEach((log, i) => console.log(`  [${i}] ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
