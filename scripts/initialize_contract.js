const { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync
} = require("@solana/spl-token");
const fs = require("fs");

// Program ID
const PROGRAM_ID = new PublicKey("6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac");
const RPC_URL = "https://rpc.testnet.x1.xyz";

// Token mints on X1
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("So11111111111111111111111111111111111111112")
};

// Load wallet
const keypairPath = process.env.HOME + "/.config/solana/id.json";
const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);

console.log("🎩 X1SAFE V2 - Initialize Contract");
console.log("====================================");
console.log("Wallet:", wallet.publicKey.toBase58());

const connection = new Connection(RPC_URL, "confirmed");

// Derive PDAs
const [adminConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("admin_config")], PROGRAM_ID
);

const [oracleConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("oracle_config")], PROGRAM_ID
);

const [vaultAuthorityPda, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_authority")], PROGRAM_ID
);

// Generate X1SAFE mint
const x1safeMint = Keypair.generate();

console.log("\n📋 Accounts:");
console.log("  Admin Config:", adminConfigPda.toBase58());
console.log("  Oracle Config:", oracleConfigPda.toBase58());
console.log("  Vault Authority:", vaultAuthorityPda.toBase58());
console.log("  X1SAFE Mint:", x1safeMint.publicKey.toBase58());

// Calculate vault token accounts
const vaultUsdcX = getAssociatedTokenAddressSync(TOKEN_MINTS.USDC_X, vaultAuthorityPda, true);
const vaultXnt = getAssociatedTokenAddressSync(TOKEN_MINTS.XNT, vaultAuthorityPda, true);
const vaultXen = getAssociatedTokenAddressSync(TOKEN_MINTS.XEN, vaultAuthorityPda, true);
const vaultXnm = getAssociatedTokenAddressSync(TOKEN_MINTS.XNM, vaultAuthorityPda, true);

console.log("\n🏦 Vault Token Accounts:");
console.log("  USDC.X:", vaultUsdcX.toBase58());
console.log("  XNT:", vaultXnt.toBase58());
console.log("  XEN:", vaultXen.toBase58());
console.log("  XNM:", vaultXnm.toBase58());

// Build initialize instruction data
// Discriminator for "initialize" + InitializeParams
function buildInitializeIxData(feeRecipient, burnAddress, platformFeeBps) {
  // Anchor instruction discriminator (first 8 bytes of hash of "global:initialize")
  // global:initialize -> sha256 -> first 8 bytes: [206, 14, 104, 20, 11, 207, 166, 138]
  const discriminator = Buffer.from([206, 14, 104, 20, 11, 207, 166, 138]);
  
  // InitializeParams: feeRecipient (32), burnAddress (32), platformFeeBps (2)
  const data = Buffer.alloc(8 + 32 + 32 + 2);
  discriminator.copy(data, 0);
  feeRecipient.toBuffer().copy(data, 8);
  burnAddress.toBuffer().copy(data, 40);
  data.writeUInt16LE(platformFeeBps, 72);
  
  return data;
}

async function initialize() {
  console.log("\n🚀 Building transaction...");
  
  const tx = new Transaction();
  
  // 1. Create X1SAFE mint account
  const mintRent = await connection.getMinimumBalanceForRentExemption(82);
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: x1safeMint.publicKey,
      lamports: mintRent,
      space: 82,
      programId: TOKEN_PROGRAM_ID
    })
  );
  
  // 2. Initialize mint (decimals=6, authority=vault_authority)
  tx.add(
    createInitializeMintInstruction(
      x1safeMint.publicKey,
      6, // decimals
      vaultAuthorityPda,
      null, // freeze authority
      TOKEN_PROGRAM_ID
    )
  );
  
  // 3. Create vault token accounts
  const tokenAccountRent = await connection.getMinimumBalanceForRentExemption(165);
  
  const vaultAccounts = [
    { mint: TOKEN_MINTS.USDC_X, account: vaultUsdcX },
    { mint: TOKEN_MINTS.XNT, account: vaultXnt },
    { mint: TOKEN_MINTS.XEN, account: vaultXen },
    { mint: TOKEN_MINTS.XNM, account: vaultXnm }
  ];
  
  for (const { mint, account } of vaultAccounts) {
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: account,
        lamports: tokenAccountRent,
        space: 165,
        programId: TOKEN_PROGRAM_ID
      })
    );
    
    // Initialize token account
    const initTokenAccountIx = {
      keys: [
        { pubkey: account, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
      ],
      programId: TOKEN_PROGRAM_ID,
      data: Buffer.from([1]) // InitializeAccount instruction
    };
    tx.add(initTokenAccountIx);
  }
  
  // 4. Call initialize instruction
  const initData = buildInitializeIxData(
    wallet.publicKey, // fee_recipient
    wallet.publicKey, // burn_address
    100 // 1% fee
  );
  
  const adminConfigRent = await connection.getMinimumBalanceForRentExemption(200);
  
  const initializeIx = {
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
      { pubkey: adminConfigPda, isSigner: false, isWritable: true }, // admin_config
      { pubkey: x1safeMint.publicKey, isSigner: false, isWritable: true }, // x1safe_mint
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false }, // vault_authority
      { pubkey: vaultUsdcX, isSigner: false, isWritable: true }, // vault_usdc_x
      { pubkey: vaultXnt, isSigner: false, isWritable: true }, // vault_xnt
      { pubkey: vaultXen, isSigner: false, isWritable: true }, // vault_xen
      { pubkey: vaultXnm, isSigner: false, isWritable: true }, // vault_xnm
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false } // rent
    ],
    programId: PROGRAM_ID,
    data: initData
  };
  tx.add(initializeIx);
  
  console.log("📤 Sending transaction...");
  
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet, x1safeMint],
      { commitment: "confirmed" }
    );
    
    console.log("\n✅ Initialize thành công!");
    console.log("Signature:", signature);
    console.log("\n📊 Contract Info:");
    console.log("  Program ID:", PROGRAM_ID.toBase58());
    console.log("  X1SAFE Mint:", x1safeMint.publicKey.toBase58());
    console.log("  Admin:", wallet.publicKey.toBase58());
    console.log("  Fee: 1%");
    
  } catch (error) {
    console.error("\n❌ Lỗi:", error.message);
    if (error.logs) {
      console.error("\nLogs:", error.logs);
    }
  }
}

initialize();
