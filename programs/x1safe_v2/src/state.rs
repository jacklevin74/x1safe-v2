//! State accounts and data structures for X1SAFE V2

use anchor_lang::prelude::*;

/// Admin configuration account
#[account]
pub struct AdminConfig {
    /// Admin pubkey with full control
    pub admin: Pubkey,
    
    /// Fee recipient for protocol fees
    pub fee_recipient: Pubkey,
    
    /// Burn address for X1SAFE tokens
    pub burn_address: Pubkey,
    
    /// X1SAFE mint address
    pub x1safe_mint: Pubkey,
    
    /// USDC.X mint
    pub usdc_x_mint: Pubkey,
    
    /// XNT mint
    pub xnt_mint: Pubkey,
    
    /// XEN mint
    pub xen_mint: Pubkey,
    
    /// XNM mint
    pub xnm_mint: Pubkey,
    
    /// Vault PDA
    pub vault_authority: Pubkey,
    
    /// Deposit fee in basis points (100 = 1%)
    pub deposit_fee_bps: u16,
    
    /// Exit fee in basis points
    pub exit_fee_bps: u16,
    
    /// Whether deposits are paused
    pub deposits_paused: bool,
    
    /// Total value locked in USD (micro-units)
    pub total_tvl_usd: u64,
    
    /// Total X1SAFE minted
    pub total_x1safe_minted: u64,
    
    /// Total X1SAFE burned
    pub total_x1safe_burned: u64,
    
    /// Number of active positions
    pub active_positions: u64,
    
    /// Bump seed for PDA
    pub bump: u8,
    
    /// Initialization timestamp
    pub created_at: i64,
}

impl AdminConfig {
    pub const SIZE: usize = 32 + // admin
        32 + // fee_recipient
        32 + // burn_address
        32 + // x1safe_mint
        32 + // usdc_x_mint
        32 + // xnt_mint
        32 + // xen_mint
        32 + // xnm_mint
        32 + // vault_authority
        2 + // deposit_fee_bps
        2 + // exit_fee_bps
        1 + // deposits_paused
        8 + // total_tvl_usd
        8 + // total_x1safe_minted
        8 + // total_x1safe_burned
        8 + // active_positions
        1 + // bump
        8; // created_at
}

/// User position account - tracks individual deposits
#[account]
pub struct UserPosition {
    /// Position owner
    pub owner: Pubkey,
    
    /// Token mint that was deposited
    pub deposit_mint: Pubkey,
    
    /// Amount deposited (in deposit token decimals)
    pub deposit_amount: u64,
    
    /// Amount in X1SAFE
    pub x1safe_balance: u64,
    
    /// Deposit timestamp
    pub deposit_time: i64,
    
    /// Last update timestamp
    pub last_update: i64,
    
    /// Whether position is still in pool (soulbound)
    pub is_in_pool: bool,
    
    /// Whether position has been exited
    pub is_exited: bool,
    
    /// Price at deposit time (for slippage protection)
    pub deposit_price: u64,
    
    /// Bump seed
    pub bump: u8,
}

impl UserPosition {
    pub const SIZE: usize = 32 + // owner
        32 + // deposit_mint
        8 + // deposit_amount
        8 + // x1safe_balance
        8 + // deposit_time
        8 + // last_update
        1 + // is_in_pool
        1 + // is_exited
        8 + // deposit_price
        1; // bump
}

/// Price oracle configuration
#[account]
pub struct OracleConfig {
    /// Last update timestamp
    pub last_update: i64,
    
    /// Price decimals
    pub price_decimals: u8,
    
    /// USDC.X price (always 1.0 = 1_000_000)
    pub usdc_x_price: u64,
    
    /// XNT price in USDC.X
    pub xnt_price: u64,
    
    /// XEN price in USDC.X
    pub xen_price: u64,
    
    /// XNM price in USDC.X
    pub xnm_price: u64,
    
    /// Confidence intervals (in basis points)
    pub usdc_x_confidence: u64,
    pub xnt_confidence: u64,
    pub xen_confidence: u64,
    pub xnm_confidence: u64,
    
    /// Minimum update frequency (seconds)
    pub min_update_frequency: u32,
    
    /// Bump seed
    pub bump: u8,
}

impl OracleConfig {
    pub const SIZE: usize = 8 + // last_update
        1 + // price_decimals
        8 + // usdc_x_price
        8 + // xnt_price
        8 + // xen_price
        8 + // xnm_price
        8 + // usdc_x_confidence
        8 + // xnt_confidence
        8 + // xen_confidence
        8 + // xnm_confidence
        4 + // min_update_frequency
        1; // bump
}

impl OracleConfig {
    /// Get price for a specific token mint
    pub fn get_price(&self, mint: &Pubkey) -> Result<u64> {
        use crate::token_mints;
        
        if mint == &token_mints::USDC_X {
            Ok(self.usdc_x_price)
        } else if mint == &token_mints::XNT {
            Ok(self.xnt_price)
        } else if mint == &token_mints::XEN {
            Ok(self.xen_price)
        } else if mint == &token_mints::XNM {
            Ok(self.xnm_price)
        } else {
            Err(error!(crate::errors::X1SafeError::UnsupportedToken))
        }
    }
    
    /// Get confidence for a specific token
    pub fn get_confidence(&self, mint: &Pubkey) -> Result<u64> {
        use crate::token_mints;
        
        if mint == &token_mints::USDC_X {
            Ok(self.usdc_x_confidence)
        } else if mint == &token_mints::XNT {
            Ok(self.xnt_confidence)
        } else if mint == &token_mints::XEN {
            Ok(self.xen_confidence)
        } else if mint == &token_mints::XNM {
            Ok(self.xnm_confidence)
        } else {
            Err(error!(crate::errors::X1SafeError::UnsupportedToken))
        }
    }
}

/// Supported token types
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum TokenType {
    USDCX,
    XNT,
    XEN,
    XNM,
}

impl TokenType {
    pub fn from_mint(mint: &Pubkey) -> Result<Self> {
        use crate::token_mints;
        
        if mint == &token_mints::USDC_X {
            Ok(TokenType::USDCX)
        } else if mint == &token_mints::XNT {
            Ok(TokenType::XNT)
        } else if mint == &token_mints::XEN {
            Ok(TokenType::XEN)
        } else if mint == &token_mints::XNM {
            Ok(TokenType::XNM)
        } else {
            Err(error!(crate::errors::X1SafeError::UnsupportedToken))
        }
    }
    
    pub fn get_decimals(&self) -> u8 {
        match self {
            TokenType::USDCX => 6,
            TokenType::XNT => 9,
            TokenType::XEN => 6,
            TokenType::XNM => 9,
        }
    }
}

/// Events
#[event]
pub struct DepositEvent {
    pub user: Pubkey,
    pub deposit_mint: Pubkey,
    pub deposit_amount: u64,
    pub x1safe_minted: u64,
    pub fee_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ExitEvent {
    pub user: Pubkey,
    pub deposit_mint: Pubkey,
    pub returned_amount: u64,
    pub x1safe_burned: u64,
    pub fee_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawFromPoolEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PriceUpdateEvent {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub old_price: u64,
    pub new_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmergencyWithdrawEvent {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}