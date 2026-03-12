# X1SAFE V2 - Multi-Token Vault

A sophisticated multi-token vault on X1 blockchain with soulbound X1SAFE tokens. Users can deposit USDC.X, XNT, XEN, or XNM and receive X1SAFE tokens that are non-transferable while in the pool.

## Features

### 🏦 Multi-Token Support
- **USDC.X**: Fixed rate deposit (1 X1SAFE = 0.001 USDC.X)
- **XNT, XEN, XNM**: Dynamic pricing via oracle
- Automatic price conversion to USDC.X equivalent

### 🔒 Soulbound Tokens
- X1SAFE is non-transferable while in pool
- Users must withdraw from pool to transfer
- Withdrawal forfeits exit rights

### 🔄 Three Operations
1. **Deposit**: Lock tokens, mint X1SAFE (soulbound)
2. **Exit**: Receive original deposit back, burn X1SAFE
3. **Withdraw**: Make X1SAFE transferable, lose exit rights

### 📊 Price Oracle
- Configurable price feeds for all supported tokens
- Staleness protection
- Confidence intervals
- Admin-controlled updates

## Architecture

```
x1safe_v2/
├── programs/x1safe_v2/src/
│   ├── lib.rs       # Entry points & instruction handlers
│   ├── state.rs     # Account structures
│   ├── oracle.rs    # Price oracle module
│   ├── deposit.rs   # Deposit logic
│   ├── exit.rs      # Exit logic
│   ├── withdraw.rs  # Withdraw logic
│   ├── admin.rs     # Admin functions
│   └── errors.rs    # Custom errors
├── tests/
│   └── x1safe_v2.ts # Test suite
└── scripts/
    ├── deploy.js    # Deployment script
    └── setup_tokens.js # Token configuration
```

## Quick Start

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Anchor CLI 0.30.1
- Solana CLI

### Installation
```bash
cd x1safe_v2
yarn install
```

### Build
```bash
anchor build
```

### Test (Localnet)
```bash
anchor test
```

### Deploy to X1 Mainnet
```bash
anchor deploy --provider.cluster mainnet
node scripts/deploy.js
```

## Usage

### Deposit USDC.X
```typescript
await program.methods
  .deposit(new BN(100_000_000)) // 100 USDC.X
  .accounts({
    user: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
// Returns: 100,000 X1SAFE (minus fees)
```

### Deposit XNT (via Oracle)
```typescript
// 1000 XNT at 0.1 USDC.X/XNT = 100 USDC.X equivalent
// Returns: 100,000 X1SAFE
await program.methods
  .deposit(new BN(1000_000_000_000)) // 1000 XNT (9 decimals)
  .accounts({ ... })
  .rpc();
```

### Exit Position
```typescript
await program.methods
  .exit()
  .accounts({
    user: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
// Returns original deposit, burns X1SAFE
```

### Withdraw from Pool
```typescript
await program.methods
  .withdrawFromPool(new BN(50000)) // 50,000 X1SAFE
  .accounts({ ... })
  .rpc();
// X1SAFE becomes transferable, exit rights lost
```

## Token Addresses (X1 Mainnet)

| Token | Mint Address | Decimals |
|-------|-------------|----------|
| USDC.X | `B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq` | 6 |
| XEN | `cktHYqN9dxNZWfGn9adki7r5SJbhuQG6PWzHjR9z8N5q` | 6 |
| XNT | `3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv` | 9 |
| XNM | *(verify from x1_token_db)* | 9 |

## Configuration

### Initialize Parameters
```typescript
{
  burnAddress: Pubkey,      // Address for burning X1SAFE
  feeRecipient: Pubkey,      // Fee collection address
  depositFeeBps: 50,         // 0.5% deposit fee
  exitFeeBps: 50             // 0.5% exit fee
}
```

### Oracle Parameters
```typescript
{
  usdcXPrice: 1000000,       // 1.0 (6 decimals)
  xntPrice: 100000,          // 0.1 USDC.X per XNT
  xenPrice: 50000,           // 0.05 USDC.X per XEN
  xnmPrice: 200000,          // 0.2 USDC.X per XNM
  priceDecimals: 6,
  updateFrequencySecs: 300    // 5 minutes
}
```

## Fees

- **Deposit Fee**: 0.5% (configurable)
- **Exit Fee**: 0.5% (configurable)
- **Withdraw from Pool**: No fee

## Security

### Access Controls
- Admin-only for critical functions
- PDA-based authority
- Pause/unpause capability

### Price Safety
- Staleness checks (max 5 minutes)
- Confidence intervals
- Slippage protection

### Math Safety
- Overflow/underflow protection
- SafeMath utilities
- Precision handling for conversions

## Admin Functions

```typescript
// Pause deposits
await program.methods.pauseDeposits().accounts({ ... }).rpc();

// Resume deposits
await program.methods.resumeDeposits().accounts({ ... }).rpc();

// Update prices
await program.methods.updatePrices([
  { tokenMint: XEN_MINT, price: 55000, confidence: 200, timestamp: now }
]).accounts({ ... }).rpc();

// Emergency withdraw (for stuck tokens)
await program.methods.emergencyWithdraw(new BN(amount))
  .accounts({ ... }).rpc();
```

## Events

- `DepositEvent`: Emitted on successful deposit
- `ExitEvent`: Emitted on successful exit
- `WithdrawFromPoolEvent`: Emitted on withdrawal
- `PriceUpdateEvent`: Emitted on price updates
- `EmergencyWithdrawEvent`: Emitted on emergency operations

## Testing

```bash
# Run all tests
anchor test

# Test specific suite
anchor test --grep "Deposit"

# Test with verbose output
anchor test --verbose
```

## License

MIT License - See [LICENSE](./LICENSE)

## Support

For questions or issues:
- X1 Discord: https://discord.gg/x1
- Documentation: https://docs.x1.xyz