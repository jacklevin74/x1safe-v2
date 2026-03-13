// X1SAFE MVP - Frontend Constants
// Simple single-token vault for testing

export const PROGRAM_ID = '6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac';
export const RPC_URL = 'https://rpc.testnet.x1.xyz';

// Token mints (testnet)
export const USDC_X_MINT = 'B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq';

// X1SAFE mint (created after init)
export let X1SAFE_MINT = localStorage.getItem('x1safe_mvp_mint') || '';

export function setX1safeMint(mint: string) {
  X1SAFE_MINT = mint;
  localStorage.setItem('x1safe_mvp_mint', mint);
}

// IDL for MVP
export const MVP_IDL = {
  "version": "1.0.0",
  "name": "x1safe_mvp",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "tokenMint", "isMut": false, "isSigner": false },
        { "name": "x1safeMint", "isMut": false, "isSigner": false },
        { "name": "burnAta", "isMut": true, "isSigner": false },
        { "name": "vaultToken", "isMut": true, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "userToken", "isMut": true, "isSigner": false },
        { "name": "vaultToken", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "userX1safe", "isMut": true, "isSigner": false },
        { "name": "userVault", "isMut": true, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "associatedTokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "withdraw",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": false, "isSigner": false },
        { "name": "userX1safe", "isMut": false, "isSigner": false },
        { "name": "userVault", "isMut": true, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "exit",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "vault", "isMut": true, "isSigner": false },
        { "name": "userToken", "isMut": true, "isSigner": false },
        { "name": "vaultToken", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "userX1safe", "isMut": true, "isSigner": false },
        { "name": "burnAta", "isMut": true, "isSigner": false },
        { "name": "userVault", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Vault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "tokenMint", "type": "publicKey" },
          { "name": "x1safeMint", "type": "publicKey" },
          { "name": "burnAta", "type": "publicKey" },
          { "name": "totalDeposits", "type": "u64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserVault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "publicKey" },
          { "name": "depositedAmount", "type": "u64" },
          { "name": "x1safeBalance", "type": "u64" },
          { "name": "withdrawn", "type": "bool" },
          { "name": "withdrawnAt", "type": "i64" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidAmount", "msg": "Invalid amount" },
    { "code": 6001, "name": "NoBalance", "msg": "No balance to exit" },
    { "code": 6002, "name": "Unauthorized", "msg": "Unauthorized" },
    { "code": 6003, "name": "MathOverflow", "msg": "Math overflow" },
    { "code": 6004, "name": "AlreadyWithdrawn", "msg": "Already withdrawn" }
  ],
  "events": [
    {
      "name": "BurnEvent",
      "fields": [
        { "name": "user", "type": "publicKey", "index": false },
        { "name": "amount", "type": "u64", "index": false },
        { "name": "timestamp", "type": "i64", "index": false }
      ]
    }
  ],
  "metadata": {
    "address": "6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac"
  }
};
