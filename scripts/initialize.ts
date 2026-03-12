import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { IDL } from "./idl";

// Program ID
const PROGRAM_ID = new PublicKey("12izSQkcRswfrm9Nxy9X3NuypzH2N1To2KmDWCogsJHA");

// X1 Testnet RPC
const RPC_URL = "https://rpc.testnet.x1.xyz";

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.local(RPC_URL);
  anchor.setProvider(provider);

  const wallet = provider.wallet as anchor.Wallet;
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Load program
  const program = new Program(IDL as any, PROGRAM_ID, provider);

  // Derive PDAs
  const [adminConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("admin_config")],
    PROGRAM_ID
  );

  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle_config")],
    PROGRAM_ID
  );

  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority")],
    PROGRAM_ID
  );

  console.log("Admin Config PDA:", adminConfigPda.toBase58());
  console.log("Oracle Config PDA:", oracleConfigPda.toBase58());
  console.log("Vault Authority PDA:", vaultAuthorityPda.toBase58());

  // Check if already initialized
  try {
    const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
    console.log("✅ Contract already initialized!");
    console.log("Admin:", adminConfig.admin.toBase58());
    console.log("Fee Recipient:", adminConfig.feeRecipient.toBase58());
    console.log("Burn Address:", adminConfig.burnAddress.toBase58());
    console.log("Platform Fee:", adminConfig.platformFeeBps / 100, "%");
    return;
  } catch (e) {
    console.log("Contract not initialized yet. Initializing...");
  }

  // Initialize
  try {
    const tx = await program.methods
      .initialize(
        wallet.publicKey, // fee_recipient
        wallet.publicKey, // burn_address
        100 // platform_fee_bps (1%)
      )
      .accounts({
        adminConfig: adminConfigPda,
        oracleConfig: oracleConfigPda,
        vaultAuthority: vaultAuthorityPda,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Initialize transaction sent!");
    console.log("Signature:", tx);

    // Verify
    const adminConfig = await program.account.adminConfig.fetch(adminConfigPda);
    console.log("\n📊 Admin Config:");
    console.log("  Admin:", adminConfig.admin.toBase58());
    console.log("  Fee Recipient:", adminConfig.feeRecipient.toBase58());
    console.log("  Burn Address:", adminConfig.burnAddress.toBase58());
    console.log("  Platform Fee:", adminConfig.platformFeeBps / 100, "%");
    console.log("  Emergency Halt:", adminConfig.emergencyHalt);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
