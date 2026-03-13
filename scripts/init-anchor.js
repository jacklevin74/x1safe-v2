#!/usr/bin/env node
/**
 * X1SAFE V2 Initialize with Anchor
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");
const BN = require("bn.js");

const PROGRAM_ID = new PublicKey("GDd6RdVUwtx7qET8znKPtBPASm5U6qgzr3wz1GRmWrDz");
const RPC_URL = "https://rpc.testnet.x1.xyz";

const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m"),
};

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../idl/x1safe_v2.json"), "utf8"));

function loadWallet() {
  const data = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".config/solana/id.json")));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

async function main() {
  console.log("🎩 X1SAFE V2 Initialize (Anchor)\n");
  
  const walletKp = loadWallet();
  const wallet = new anchor.Wallet(walletKp);
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  const conn = new anchor.web3.Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  const program = new anchor.Program(IDL, provider);
  console.log("Program:", PROGRAM_ID.toBase58());
  
  // Derive PDAs
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [oracleConfig] = PublicKey.findProgramAddressSync([Buffer.from("oracle_config")], PROGRAM_ID);
  const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault_authority")], PROGRAM_ID);
  
  console.log("Admin:", adminConfig.toBase58());
  console.log("Oracle:", oracleConfig.toBase58());
  console.log("Vault:", vaultAuthority.toBase58());
  
  // Check if initialized
  try {
    await program.account.adminConfig.fetch(adminConfig);
    console.log("\n✅ Already initialized!");
    return;
  } catch(e) {
    console.log("\nNeed to initialize...");
  }
  
  // Generate X1SAFE mint
  const x1safeMintPath = path.join(__dirname, "../.x1safe-mint.json");
  let x1safeMint;
  if (fs.existsSync(x1safeMintPath)) {
    x1safeMint = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(x1safeMintPath))));
    console.log("Loaded mint:", x1safeMint.publicKey.toBase58());
  } else {
    x1safeMint = Keypair.generate();
    fs.writeFileSync(x1safeMintPath, JSON.stringify(Array.from(x1safeMint.secretKey)));
    console.log("Generated mint:", x1safeMint.publicKey.toBase58());
  }
  
  // Vault accounts
  const vaultUsdcX = await getAssociatedTokenAddress(TOKEN_MINTS.USDC_X, vaultAuthority, true);
  const vaultXnt = await getAssociatedTokenAddress(TOKEN_MINTS.XNT, vaultAuthority, true);
  const vaultXen = await getAssociatedTokenAddress(TOKEN_MINTS.XEN, vaultAuthority, true);
  const vaultXnm = await getAssociatedTokenAddress(TOKEN_MINTS.XNM, vaultAuthority, true);
  
  console.log("\n🚀 Initializing...");
  try {
    const tx = await program.methods
      .initialize({
        feeRecipient: wallet.publicKey,
        burnAddress: wallet.publicKey,
        depositFeeBps: 50,
        exitFeeBps: 50,
      })
      .accounts({
        payer: wallet.publicKey,
        adminConfig: adminConfig,
        x1safeMint: x1safeMint.publicKey,
        vaultAuthority: vaultAuthority,
        vaultUsdcX: vaultUsdcX,
        vaultXnt: vaultXnt,
        vaultXen: vaultXen,
        vaultXnm: vaultXnm,
        usdcXMint: TOKEN_MINTS.USDC_X,
        xntMint: TOKEN_MINTS.XNT,
        xenMint: TOKEN_MINTS.XEN,
        xnmMint: TOKEN_MINTS.XNM,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([x1safeMint])
      .rpc({ commitment: "confirmed" });
    
    console.log("✅ SUCCESS!");
    console.log("Tx:", tx);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + tx);
  } catch(e) {
    console.error("❌ Failed:", e.message);
    if (e.logs) console.log("Logs:", e.logs);
  }
}

main().catch(console.error);
