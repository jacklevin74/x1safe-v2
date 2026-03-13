# X1SAFE MVP

Simple single-token vault (USDC.X only) cho testing trước khi mở rộng.

---

## 🎯 Architecture

```
User ──deposit USDC.X──→ Vault ──mint X1SAFE──→ User
                         │
User ──exit────────────→ Vault ──X1SAFE→burn_ata→burn──→ USDC.X return
                         │
User ──withdraw────────→ Vault ──mark withdrawn──→ User (X1SAFE transferable)
```

**Burn Tracking:**
- `burn_ata` - Token account nhận X1SAFE trước khi burn
- `BurnEvent` - On-chain event ghi lại mỗi lần burn

- **1:1 ratio** — 1 USDC.X = 1 X1SAFE (đơn giản cho MVP)
- **Soulbound** — X1SAFE trong vault, chỉ có thể exit
- **Withdraw** — rút X1SAFE khỏi pool → transferable, mất quyền exit
- **Burn Tracking** — Burn ATA + BurnEvent on-chain

---

## 🎯 MVP Features

| Feature | Status |
|---------|--------|
| ✅ Deposit USDC.X → mint X1SAFE (1:1) | Đã có |
| ✅ Exit → burn X1SAFE → nhận lại USDC.X | Đã có |
| ✅ Withdraw → X1SAFE transferable, mất quyền exit | Đã có |
| ❌ Oracle pricing | Không có (1:1 fixed) |
| ❌ Multi-token | Không có (USDC.X only) |

---

## 🎯 MVP Features

| Feature | Status |
|--------|--------|
| ✅ Deposit USDC.X → mint X1SAFE (1:1) | Đã có |
| ✅ Exit → burn X1SAFE → nhận lại USDC.X | Đã có |
| ✅ Withdraw → X1SAFE transferable, mất quyền exit | Đã có |
| ✅ Burn Tracking (ATA + Event) | Đã có |
| ❌ Oracle pricing | Không có (1:1 fixed) |
| ❌ Multi-token | Không có (USDC.X only) |

## 🎯 State Accounts

### Vault

```rust
pub struct Vault {
    pub authority: Pubkey,
    pub token_mint: Pubkey,    // USDC.X
    pub x1safe_mint: Pubkey,   // X1SAFE
    pub burn_ata: Pubkey,      // Burn ATA for tracking
    pub total_deposits: u64,
    pub bump: u8,
}
```

### UserVault

```rust
pub struct UserVault {
    pub owner: Pubkey,
    pub deposited_amount: u64,  // USDC.X deposited
    pub x1safe_balance: u64,    // X1SAFE received
    pub withdrawn: bool,      // True if user withdrew from pool
    pub withdrawn_at: i64,      // Timestamp of withdrawal
}
```

### BurnEvent

```rust
#[event]
pub struct BurnEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
```

---

## 📁 Structure

```
x1safe_v2/
├── programs/x1safe_mvp/      # Contract Rust (đơn giản)
│   ├── src/lib.rs
│   └── Cargo.toml
├── idl/x1safe_mvp.json       # IDL cho frontend
├── scripts/
│   ├── deploy-mvp.sh         # Deploy contract
│   ├── init-mvp.js           # Khởi tạo vault + X1SAFE mint
│   └── test-mvp.js           # Test deposit/exit
├── web-ui/src/
│   └── mvp-constants.ts      # Constants + IDL
└── MVP.md                    # This file
```

---

## 🚀 Quick Start

### Step 1: Prerequisites

```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Wallet
solana-keygen new

# Switch to testnet
solana config set --url https://rpc.testnet.x1.xyz

# Get XNT from faucet
# https://faucet.testnet.x1.xyz
```

### Step 2: Deploy Contract

```bash
cd x1safe_v2

# Deploy
bash scripts/deploy-mvp.sh

# Expected output:
# ✅ Deployment complete!
# Program ID: 6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac
```

### Step 3: Initialize

```bash
# Create X1SAFE mint + vault
node scripts/init-mvp.js

# Expected output:
# ✅ X1SAFE Mint: <address>
# 💾 Saved to .mvp-config.json
```

### Step 4: Test

```bash
node scripts/test-mvp.js
```

### Step 5: Frontend

```bash
cd web-ui
npm install
npm run dev

# Open http://localhost:5173
```

---

## 📊 Contract Flow

### Initialize (one-time)

```rust
initialize(
    authority: signer,      // Admin
    vault: PDA,            // Vault state
    token_mint: USDC.X,    // Token accepted
    x1safe_mint: X1SAFE,   // Token minted
    vault_token: ATA,      // Holds USDC.X
)
```

### Deposit

```rust
deposit(amount: u64)
    user: signer
    user_token: User USDC.X ATA → Vault USDC.X ATA
    x1safe_mint: Mint X1SAFE → User X1SAFE ATA
```

### Exit

```rust
exit()
    user: signer
    user_x1safe: Transfer X1SAFE → burn_ata
    burn_ata: Burn X1SAFE (trackable)
    emit BurnEvent { user, amount, timestamp }
    vault_token: Return deposited USDC.X → User
    require!(!user_vault.withdrawn)  // Cannot exit if withdrawn
```

**Burn Flow:**
1. User X1SAFE → Burn ATA (để tracking)
2. Burn ATA → Burn (xóa khỏi supply)
3. Emit `BurnEvent` on-chain

### Withdraw

```rust
withdraw()
    user: signer
    user_vault.withdrawn = true  // Mark withdrawn
    user_vault.withdrawn_at = now
    // X1SAFE remains in user's wallet but now transferable
    // Exit disabled after withdraw
```

---

## 🔧 PDAs

| PDA | Seeds | Purpose |
|-----|-------|---------|
| Vault | `["vault", authority, token_mint]` | Global vault state |
| UserVault | `["user_vault", vault, user]` | User deposit tracking |

---

## 🧪 Testing Checklist

- [ ] Contract deploy thành công
- [ ] X1SAFE mint tạo được
- [ ] Vault initialize
- [ ] Deposit USDC.X → nhận X1SAFE
- [ ] Withdraw X1SAFE → mất quyền exit
- [ ] Exit X1SAFE → nhận lại USDC.X
- [ ] Cannot exit sau khi đã withdraw
- [ ] Frontend kết nối wallet
- [ ] Frontend deposit/exit/withdraw hoạt động

---

## 📝 Program ID

```
6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac
```

**Explorer:** https://explorer.testnet.x1.xyz/address/6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac

---

## ⚠️ Limitations

| Feature | MVP | Full V2 |
|---------|-----|---------|
| Tokens | USDC.X only | USDC.X, XNT, XEN, XNM |
| Ratio | 1:1 | Oracle-based |
| Withdraw | ✅ Yes | ✅ Yes |
| Emergency | ❌ No | ✅ Yes |
| Multi-vault | ❌ No | ✅ Yes |

---

## 🔄 Next Steps sau MVP

1. ✅ MVP chạy ổn → Deploy full V2
2. Thêm oracle pricing
3. Thêm multi-token support
4. Thêm withdraw feature
5. Mainnet deployment

---

*Simple working > Complex broken*
