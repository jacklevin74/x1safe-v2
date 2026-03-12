//! Custom error definitions for X1SAFE V2

use anchor_lang::prelude::*;

#[error_code]
pub enum X1SafeError {
    #[msg("Unauthorized admin access")]
    UnauthorizedAdmin,
    
    #[msg("Invalid token mint address")]
    InvalidMint,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Unsupported token type")]
    UnsupportedToken,
    
    #[msg("Deposits are currently paused")]
    DepositsPaused,
    
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    
    #[msg("Deposit amount below minimum")]
    DepositTooSmall,
    
    #[msg("Deposit amount exceeds maximum")]
    DepositTooLarge,
    
    #[msg("No active position found")]
    NoActiveDeposit,
    
    #[msg("Position is not in pool")]
    PositionNotInPool,
    
    #[msg("Position already withdrawn from pool")]
    AlreadyWithdrawn,
    
    #[msg("Invalid position owner")]
    InvalidPosition,
    
    #[msg("Insufficient X1SAFE balance")]
    InsufficientBalance,
    
    #[msg("Invalid burn address")]
    InvalidBurnAddress,
    
    #[msg("Math overflow")]
    MathOverflow,
    
    #[msg("Math underflow")]
    MathUnderflow,
    
    #[msg("Price data stale")]
    StalePriceData,
    
    #[msg("Price confidence too low")]
    LowPriceConfidence,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Invalid fee basis points")]
    InvalidFeeBps,
    
    #[msg("Token account mismatch")]
    TokenAccountMismatch,
    
    #[msg("Vault authority mismatch")]
    VaultAuthorityMismatch,
    
    #[msg("Position already exited")]
    PositionAlreadyExited,
    
    #[msg("Cannot exit - position withdrawn from pool")]
    CannotExitWithdrawnPosition,
    
    #[msg("Oracle not initialized")]
    OracleNotInitialized,
    
    #[msg("Invalid price decimals")]
    InvalidPriceDecimals,
    
    #[msg("Price too old")]
    PriceTooOld,
    
    #[msg("Emergency withdrawal not available for this token")]
    EmergencyWithdrawNotAllowed,
}

/// Helper trait for safe math operations
pub trait SafeMath {
    fn safe_add(self, other: u64) -> Result<u64>;
    fn safe_sub(self, other: u64) -> Result<u64>;
    fn safe_mul(self, other: u64) -> Result<u64>;
    fn safe_div(self, other: u64) -> Result<u64>;
}

impl SafeMath for u64 {
    fn safe_add(self, other: u64) -> Result<u64> {
        self.checked_add(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
    
    fn safe_sub(self, other: u64) -> Result<u64> {
        self.checked_sub(other).ok_or_else(|| error!(X1SafeError::MathUnderflow))
    }
    
    fn safe_mul(self, other: u64) -> Result<u64> {
        self.checked_mul(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
    
    fn safe_div(self, other: u64) -> Result<u64> {
        if other == 0 {
            return Err(error!(X1SafeError::MathOverflow));
        }
        self.checked_div(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
}

/// Extended safe math for u128
pub trait SafeMath128 {
    fn safe_add(self, other: u128) -> Result<u128>;
    fn safe_mul(self, other: u128) -> Result<u128>;
    fn safe_div(self, other: u128) -> Result<u128>;
}

impl SafeMath128 for u128 {
    fn safe_add(self, other: u128) -> Result<u128> {
        self.checked_add(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
    
    fn safe_mul(self, other: u128) -> Result<u128> {
        self.checked_mul(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
    
    fn safe_div(self, other: u128) -> Result<u128> {
        if other == 0 {
            return Err(error!(X1SafeError::MathOverflow));
        }
        self.checked_div(other).ok_or_else(|| error!(X1SafeError::MathOverflow))
    }
}