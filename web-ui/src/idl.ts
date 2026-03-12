export const IDL = {
  "version": "0.1.0",
  "name": "x1safe_v2",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "payer", "isMut": true, "isSigner": true },
        { "name": "adminConfig", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "usdcXVault", "isMut": true, "isSigner": false },
        { "name": "xntVault", "isMut": true, "isSigner": false },
        { "name": "xenVault", "isMut": true, "isSigner": false },
        { "name": "xnmVault", "isMut": true, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false },
        { "name": "rent", "isMut": false, "isSigner": false }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "InitializeParams"
          }
        }
      ]
    },
    {
      "name": "deposit",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userPosition", "isMut": true, "isSigner": false },
        { "name": "tokenMint", "isMut": false, "isSigner": false },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "userX1safeAccount", "isMut": true, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "oracleConfig", "isMut": false, "isSigner": false },
        { "name": "adminConfig", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "exit",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userPosition", "isMut": true, "isSigner": false },
        { "name": "depositedTokenMint", "isMut": false, "isSigner": false },
        { "name": "vaultTokenAccount", "isMut": true, "isSigner": false },
        { "name": "userTokenAccount", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "userX1safeAccount", "isMut": true, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "adminConfig", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "withdrawFromPool",
      "accounts": [
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "userPosition", "isMut": true, "isSigner": false },
        { "name": "x1safeMint", "isMut": true, "isSigner": false },
        { "name": "userX1safeAccount", "isMut": true, "isSigner": false },
        { "name": "vaultAuthority", "isMut": false, "isSigner": false },
        { "name": "adminConfig", "isMut": false, "isSigner": false },
        { "name": "tokenProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "AdminConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "admin", "type": "publicKey" },
          { "name": "feeRecipient", "type": "publicKey" },
          { "name": "paused", "type": "bool" },
          { "name": "platformFeeBps", "type": "u16" },
          { "name": "totalDeposits", "type": "u64" },
          { "name": "totalX1safeMinted", "type": "u64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "publicKey" },
          { "name": "depositedToken", "type": "publicKey" },
          { "name": "depositedAmount", "type": "u64" },
          { "name": "x1safeMinted", "type": "u64" },
          { "name": "depositTimestamp", "type": "i64" },
          { "name": "isInPool", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "OracleConfig",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "admin", "type": "publicKey" },
          { "name": "lastUpdateTimestamp", "type": "i64" },
          { "name": "prices", "type": { "vec": { "defined": "TokenPrice" } } },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "InitializeParams",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "feeRecipient", "type": "publicKey" },
          { "name": "platformFeeBps", "type": "u16" }
        ]
      }
    },
    {
      "name": "TokenPrice",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "tokenMint", "type": "publicKey" },
          { "name": "priceUsdc", "type": "u64" },
          { "name": "decimals", "type": "u8" },
          { "name": "lastUpdate", "type": "i64" }
        ]
      }
    }
  ],
  "errors": [
    { "code": 6000, "name": "InvalidToken", "msg": "Invalid token mint" },
    { "code": 6001, "name": "VaultPaused", "msg": "Vault is paused" },
    { "code": 6002, "name": "InsufficientBalance", "msg": "Insufficient token balance" },
    { "code": 6003, "name": "InvalidAmount", "msg": "Invalid amount" },
    { "code": 6004, "name": "PriceExpired", "msg": "Oracle price has expired" },
    { "code": 6005, "name": "NotInPool", "msg": "Position is not in pool" },
    { "code": 6006, "name": "AlreadyInPool", "msg": "Position is already in pool" },
    { "code": 6007, "name": "Unauthorized", "msg": "Unauthorized access" }
  ]
};
