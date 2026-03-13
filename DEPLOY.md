# X1SAFE V2 - Deployment Guide

## 🎯 New Program ID

**Program ID:** `6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac`

Source code và tất cả scripts đã được update để match program ID này.

---

## 🚀 Deployment Steps

### 1. Prerequisites

```bash
# Install solana CLI (nếu chưa có)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Setup wallet (nếu chưa có)
solana-keygen new

# Switch to testnet
solana config set --url https://rpc.testnet.x1.xyz
```

### 2. Deploy Program

```bash
cd x1safe_v2
bash scripts/deploy.sh
```

Hoặc manual:

```bash
solana program deploy target/deploy/x1safe_v2.so \
    --program-id target/deploy/x1safe_v2-fresh-keypair.json \
    --url https://rpc.testnet.x1.xyz
```

### 3. Initialize Contract

Sau khi deploy thành công:

```bash
node scripts/init-testnet.js
```

### 4. Initialize Oracle

```bash
node scripts/oracle-update.js
```

### 5. Run Tests

```bash
node scripts/test-suite.js
```

---

## 📁 Files Updated

| File | Thay đổi |
|------|----------|
| `programs/x1safe_v2/src/lib.rs` | declare_id! updated |
| `idl/x1safe_v2.json` | metadata.address updated |
| `scripts/init-testnet.js` | PROGRAM_ID updated |
| `scripts/oracle-update.js` | PROGRAM_ID updated |
| `scripts/test-suite.js` | PROGRAM_ID updated |
| `.deployment-testnet.json` | programId updated |
| `scripts/deploy.sh` | New deployment script |

---

## ⚠️ Known Issues

1. **Anchor CLI không có sẵn** trong workspace → Cần dùng `solana CLI` để deploy
2. **Node.js segfault** khi chạy scripts (non-critical, vẫn hoạt động)
3. **Testnet programs cũ** bị lỗi (chỉ 36 bytes) → Cần deploy mới

---

## ✅ Status

| Step | Status | File |
|------|--------|------|
| Source code | ✅ Updated | `lib.rs` |
| IDL | ✅ Updated | `idl/x1safe_v2.json` |
| Init script | ✅ Ready | `scripts/init-testnet.js` |
| Oracle script | ✅ Ready | `scripts/oracle-update.js` |
| Test suite | ✅ Ready | `scripts/test-suite.js` |
| Deploy script | ✅ Ready | `scripts/deploy.sh` |
| **Deploy & Init** | ⏳ Pending | Cần chạy thủ công |

---

## 🔧 Commands Ready

```bash
# 1. Deploy (cần solana CLI)
bash scripts/deploy.sh

# 2. Initialize contract
node scripts/init-testnet.js

# 3. Update oracle prices  
node scripts/oracle-update.js

# 4. Run tests
node scripts/test-suite.js
```

---

*Generated: 2026-03-12*
