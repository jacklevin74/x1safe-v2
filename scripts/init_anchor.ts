import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

// Program ID
const PROGRAM_ID = new PublicKey("12izSQkcRswfrm9Nxy9X3NuypzH2N1To2KmDWCogsJHA");
const RPC_URL = "https://rpc.testnet.x1.xyz";

async function main() {
  console.log("🎩 X1SAFE V2 - Initialize Contract");
  console.log("====================================");
  
  // Setup provider
  const provider = anchor.AnchorProvider.local(RPC_URL);
  anchor.setProvider(provider);
  
  const wallet = provider.wallet as anchor.Wallet;
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  // Load IDL
  const idlPath = "./target/idl/x1safe_v2.json";
  let idl;
  try {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } catch (e) {
    console.log("❌ IDL not found. Building first...");
    process.exit(1);
  }
  
  // Create program
  const program = new anchor.Program(idl, provider);
  
  // Derive PDAs
  const [adminConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")], PROGRAM_ID
  );
  
  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")], PROGRAM_ID
  );
  
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")], PROGRAM_ID
  );
  
  console.log("\nPDAs:");
  console.log("  Admin Config:", adminConfigPda.toBase58());
  console.log("  Oracle Config:", oracleConfigPda.toBase58());
  console.log("  Vault Authority:", vaultAuthorityPda.toBase58());
  
  // Check if already initialized
  try {
    const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
    console.log("\n✅ Contract already initialized!");
    console.log("Admin:", adminConfig.admin.toBase58());
    console.log("Fee Recipient:", adminConfig.feeRecipient.toBase58());
    return;
  } catch (e) {
    console.log("\n🚀 Initializing contract...");
  }
  
  // Generate X1SAFE mint
  const x1safeMint = Keypair.generate();
  console.log("  X1SAFE Mint:", x1safeMint.publicKey.toBase58());
  
  // Build initialize transaction
  try {
    const tx = await program.methods
      .initialize({
        feeRecipient: wallet.publicKey,
        burnAddress: wallet.publicKey,
        platformFeeBps: 100 // 1%
      })
      .accounts({
        payer: wallet.publicKey,
        adminConfig: adminConfigPda,
        x1safeMint: x1safeMint.publicKey,
        vaultAuthority: vaultAuthorityPda,
        vaultUsdcX: await getVaultTokenAccount(provider, TOKEN_MINTS.USDC_X, vaultAuthorityPda),
        vaultXnt: await getVaultTokenAccount(provider, TOKEN_MINTS.XNT, vaultAuthorityPda),
        vaultXen: await getVaultTokenAccount(provider, TOKEN_MINTS.XEN, vaultAuthorityPda),
        vaultXnm: await getVaultTokenAccount(provider, TOKEN_MINTS.XNM, vaultAuthorityPda),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([x1safeMint])
      .rpc();
    
    console.log("\n✅ Initialize thành công!");
    console.log("Signature:", tx);
    
  } catch (error) {
    console.error("\n❌ Lỗi:", error);
  }
}

async function getVaultTokenAccount(provider: anchor.AnchorProvider, mint: PublicKey, owner: PublicKey) {
  const { PublicKey } = anchor.web3;
  const { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
  
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("So11111111111111111111111111111111111111112")
};

main().catch(console.error);
