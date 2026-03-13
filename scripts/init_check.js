const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");

// Minimal IDL for initialize
const IDL = {
  version: "0.1.0",
  name: "x1safe_v2",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "payer", isMut: true, isSigner: true },
        { name: "adminConfig", isMut: true, isSigner: false },
        { name: "x1safeMint", isMut: true, isSigner: false },
        { name: "vaultAuthority", isMut: false, isSigner: false },
        { name: "vaultUsdcX", isMut: true, isSigner: false },
        { name: "vaultXnt", isMut: true, isSigner: false },
        { name: "vaultXen", isMut: true, isSigner: false },
        { name: "vaultXnm", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: [
        { name: "params", type: { defined: "InitializeParams" } }
      ]
    }
  ],
  types: [
    {
      name: "InitializeParams",
      type: {
        kind: "struct",
        fields: [
          { name: "feeRecipient", type: "publicKey" },
          { name: "burnAddress", type: "publicKey" },
          { name: "platformFeeBps", type: "u16" }
        ]
      }
    }
  ],
  accounts: [
    {
      name: "AdminConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "admin", type: "publicKey" },
          { name: "feeRecipient", type: "publicKey" },
          { name: "burnAddress", type: "publicKey" },
          { name: "platformFeeBps", type: "u16" },
          { name: "emergencyHalt", type: "bool" },
          { name: "pauseDeposits", type: "bool" },
          { name: "totalDeposits", type: "u64" },
          { name: "totalX1safeMinted", type: "u64" },
          { name: "totalX1safeWithdrawn", type: "u64" },
          { name: "vaultAuthorityBump", type: "u8" },
          { name: "adminConfigBump", type: "u8" }
        ]
      }
    }
  ]
};

const PROGRAM_ID = new PublicKey("6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac");
const RPC_URL = "https://rpc.testnet.x1.xyz";

// Token mints
const TOKEN_MINTS = {
  USDC_X: new PublicKey("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq"),
  XEN: new PublicKey("cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q"),
  XNT: new PublicKey("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv"),
  XNM: new PublicKey("So11111111111111111111111111111111111111112")
};

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.local(RPC_URL);
  anchor.setProvider(provider);
  
  const wallet = provider.wallet;
  console.log("🎩 X1SAFE V2 - Initialize Contract");
  console.log("====================================");
  console.log("Wallet:", wallet.publicKey.toBase58());
  
  // Create program
  const program = new anchor.Program(IDL, PROGRAM_ID, provider);
  
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
  
  console.log("\nPDAs:");
  console.log("  Admin Config:", adminConfigPda.toBase58());
  console.log("  Oracle Config:", oracleConfigPda.toBase58());
  console.log("  Vault Authority:", vaultAuthorityPda.toBase58(), "(bump:", vaultAuthorityBump + ")");
  
  // Generate X1SAFE mint keypair
  const x1safeMint = anchor.web3.Keypair.generate();
  console.log("  X1SAFE Mint:", x1safeMint.publicKey.toBase58());
  
  // Derive vault token accounts
  const getAssociatedTokenAddress = (mint, owner) => {
    return PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
  };
  
  const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  
  console.log("\n⚠️  Lưu ý: Script này cần IDL đầy đủ để gọi initialize.");
  console.log("Để initialize thực sự, cần:");
  console.log("  1. Tạo X1SAFE mint");
  console.log("  2. Tạo vault token accounts cho 4 tokens");
  console.log("  3. Gọi initialize với params");
  console.log("\nBạn muốn tôi tạo transaction initialize không? (Cần XNT để trả phí)");
  console.log("\n💡 Gợi ý: Có thể dùng `anchor test` để test contract trước.");
}

main().catch(console.error);
