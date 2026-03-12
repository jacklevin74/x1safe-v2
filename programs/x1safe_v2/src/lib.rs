//! X1SAFE V2 - Multi-Token Vault with Soulbound X1SAFE
//! 
//! This contract implements a multi-token vault where users can:
//! 1. Deposit USDC.X, XNT, XEN, or XNM to receive soulbound X1SAFE tokens
//! 2. Exit the vault to receive their original deposit back
//! 3. Withdraw X1SAFE from the pool (becomes transferable, loses exit rights)
//! 
//! Architecture:
//! - lib.rs: Entry points and instruction handlers
//! - state.rs: Account structures and data layouts
//! - oracle.rs: Price oracle integration with xDEX
//! - deposit.rs: Deposit instruction logic
//! - exit.rs: Exit instruction logic  
//! - withdraw.rs: Withdraw instruction logic
//! - admin.rs: Admin functions
//! - errors.rs: Custom error definitions

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::associated_token::AssociatedToken;

pub mod state;
pub mod oracle;
pub mod deposit;
pub mod exit;
pub mod withdraw;
pub mod admin;
pub mod errors;

use state::*;
use oracle::*;
use deposit::*;
use exit::*;
use withdraw::*;
use admin::*;
use errors::*;

declare_id!("Fg6nWVLnLkHkxwFxk2YrMwf4sKVzNTVXxHAYjMoBzD9C");

/// Fixed decimals for X1SAFE token
pub const X1SAFE_DECIMALS: u8 = 6;

/// USDC.X to X1SAFE conversion: 1 X1SAFE = 0.001 USDC.X (fixed)
/// So 1 USDC.X = 1000 X1SAFE
pub const USDC_X_TO_X1SAFE: u64 = 1000;

/// Minimum deposit amount (0.01 USDC.X equivalent)
pub const MIN_DEPOSIT_AMOUNT: u64 = 10_000; // 0.01 USDC.X in micro-units

/// Maximum deposit amount per transaction (100,000 USDC.X equivalent)
pub const MAX_DEPOSIT_AMOUNT: u64 = 100_000_000_000_000; // 100k USDC.X in micro-units

/// Authority seeds for PDA derivation
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";
pub const USER_POSITION_SEED: &[u8] = b"user_position";
pub const ORACLE_CONFIG_SEED: &[u8] = b"oracle_config";
pub const ADMIN_CONFIG_SEED: &[u8] = b"admin_config";

/// Token mint addresses on X1 Mainnet
pub mod token_mints {
    use anchor_lang::solana_program::pubkey::Pubkey;
    
    /// USDC.X wrapped token
    pub const USDC_X: Pubkey = anchor_lang::solana_program::pubkey!("B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq");
    
    /// XEN token
    pub const XEN: Pubkey = anchor_lang::solana_program::pubkey!("y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC");
    
    /// XNT (native wrapped - placeholder, actual address needed)
    pub const XNT: Pubkey = anchor_lang::solana_program::pubkey!("3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv");
    
    /// XNM - XenBlocks Miner Token
    pub const XNM: Pubkey = anchor_lang::solana_program::pubkey!("XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m");
}

#[program]
pub mod x1safe_v2 {
    use super::*;

    /// Initialize the vault with admin configuration
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        admin::handler_initialize(ctx, params)
    }

    /// Initialize price oracle configuration
    pub fn initialize_oracle(ctx: Context<InitializeOracle>, params: OracleConfigParams) -> Result<()> {
        oracle::handler_initialize_oracle(ctx, params)
    }

    /// Update oracle prices (admin only)
    pub fn update_prices(ctx: Context<UpdatePrices>, prices: Vec<TokenPrice>) -> Result<()> {
        oracle::handler_update_prices(ctx, prices)
    }

    /// Deposit tokens into the vault and mint soulbound X1SAFE
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handler_deposit(ctx, amount)
    }

    /// Exit the vault - receive original deposit back, burn X1SAFE
    pub fn exit(ctx: Context<Exit>) -> Result<()> {
        exit::handler_exit(ctx)
    }

    /// Withdraw X1SAFE from pool - becomes transferable, loses exit rights
    pub fn withdraw_from_pool(ctx: Context<WithdrawFromPool>, amount: u64) -> Result<()> {
        withdraw::handler_withdraw_from_pool(ctx, amount)
    }

    /// Emergency withdrawal (admin only, for stuck tokens)
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>, amount: u64) -> Result<()> {
        admin::handler_emergency_withdraw(ctx, amount)
    }

    /// Pause deposits (admin only)
    pub fn pause_deposits(ctx: Context<AdminOnly>) -> Result<()> {
        admin::handler_pause_deposits(ctx)
    }

    /// Resume deposits (admin only)
    pub fn resume_deposits(ctx: Context<AdminOnly>) -> Result<()> {
        admin::handler_resume_deposits(ctx)
    }

    /// Update admin (current admin only)
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        admin::handler_update_admin(ctx, new_admin)
    }

    /// Update fee recipient (admin only)
    pub fn update_fee_recipient(ctx: Context<AdminOnly>, new_recipient: Pubkey) -> Result<()> {
        admin::handler_update_fee_recipient(ctx, new_recipient)
    }
}

// ============================================================================
// Account Contexts
// ============================================================================

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + AdminConfig::SIZE,
        seeds = [ADMIN_CONFIG_SEED],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    /// The X1SAFE mint (soulbound token)
    #[account(
        init,
        payer = payer,
        mint::decimals = X1SAFE_DECIMALS,
        mint::authority = vault_authority,
    )]
    pub x1safe_mint: Account<'info, Mint>,

    /// PDA that controls token operations
    /// CHECK: PDA validated in program logic
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault token account for USDC.X
    #[account(
        init,
        payer = payer,
        token::mint = usdc_x_mint,
        token::authority = vault_authority,
    )]
    pub vault_usdc_x: Account<'info, TokenAccount>,

    /// Vault token account for XNT
    #[account(
        init,
        payer = payer,
        token::mint = xnt_mint,
        token::authority = vault_authority,
    )]
    pub vault_xnt: Account<'info, TokenAccount>,

    /// Vault token account for XEN
    #[account(
        init,
        payer = payer,
        token::mint = xen_mint,
        token::authority = vault_authority,
    )]
    pub vault_xen: Account<'info, TokenAccount>,

    /// Vault token account for XNM
    #[account(
        init,
        payer = payer,
        token::mint = xnm_mint,
        token::authority = vault_authority,
    )]
    pub vault_xnm: Account<'info, TokenAccount>,

    /// CHECK: Token mints validated in logic
    pub usdc_x_mint: Account<'info, Mint>,
    pub xnt_mint: Account<'info, Mint>,
    pub xen_mint: Account<'info, Mint>,
    pub xnm_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        has_one = admin @ X1SafeError::UnauthorizedAdmin
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub admin: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + OracleConfig::SIZE,
        seeds = [ORACLE_CONFIG_SEED],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrices<'info> {
    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        has_one = admin @ X1SafeError::UnauthorizedAdmin
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        constraint = !admin_config.deposits_paused @ X1SafeError::DepositsPaused
    )]
    pub admin_config: Account<'info, AdminConfig>,

    #[account(
        seeds = [ORACLE_CONFIG_SEED],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// User position account - tracks deposits
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::SIZE,
        seeds = [USER_POSITION_SEED, user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    /// The X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == admin_config.x1safe_mint @ X1SafeError::InvalidMint
    )]
    pub x1safe_mint: Account<'info, Mint>,

    /// PDA that controls token operations
    /// CHECK: PDA validated
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The mint of the token being deposited
    pub deposit_mint: Account<'info, Mint>,

    /// Source token account (user's deposit)
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ X1SafeError::InvalidTokenAccount,
        constraint = user_token_account.mint == deposit_mint.key() @ X1SafeError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault destination for this token
    #[account(
        mut,
        constraint = vault_token_account.owner == vault_authority.key() @ X1SafeError::InvalidTokenAccount,
        constraint = vault_token_account.mint == deposit_mint.key() @ X1SafeError::InvalidMint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// User's X1SAFE account (will receive minted tokens)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = x1safe_mint,
        associated_token::authority = user,
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Exit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    /// User position - must have active deposit
    #[account(
        mut,
        seeds = [USER_POSITION_SEED, user.key().as_ref()],
        bump,
        constraint = user_position.owner == user.key() @ X1SafeError::InvalidPosition,
        constraint = user_position.deposit_amount > 0 @ X1SafeError::NoActiveDeposit,
        constraint = user_position.is_in_pool @ X1SafeError::PositionNotInPool,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == admin_config.x1safe_mint @ X1SafeError::InvalidMint
    )]
    pub x1safe_mint: Account<'info, Mint>,

    /// PDA that controls tokens
    /// CHECK: PDA validated
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault source for original deposit
    #[account(
        mut,
        constraint = vault_token_account.mint == user_position.deposit_mint @ X1SafeError::InvalidMint
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// User destination for returned tokens
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ X1SafeError::InvalidTokenAccount,
        constraint = user_token_account.mint == user_position.deposit_mint @ X1SafeError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// User's X1SAFE token account (will burn tokens)
    #[account(
        mut,
        constraint = user_x1safe_account.owner == user.key() @ X1SafeError::InvalidTokenAccount,
        constraint = user_x1safe_account.mint == x1safe_mint.key() @ X1SafeError::InvalidMint
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,

    /// Burn address for X1SAFE
    /// CHECK: Validated burn address
    #[account(
        mut,
        address = admin_config.burn_address @ X1SafeError::InvalidBurnAddress
    )]
    pub burn_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFromPool<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump
    )]
    pub admin_config: Account<'info, AdminConfig>,

    /// User position
    #[account(
        mut,
        seeds = [USER_POSITION_SEED, user.key().as_ref()],
        bump,
        constraint = user_position.owner == user.key() @ X1SafeError::InvalidPosition,
        constraint = user_position.is_in_pool @ X1SafeError::AlreadyWithdrawn,
    )]
    pub user_position: Account<'info, UserPosition>,

    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == admin_config.x1safe_mint @ X1SafeError::InvalidMint
    )]
    pub x1safe_mint: Account<'info, Mint>,

    /// User's X1SAFE token account
    #[account(
        mut,
        constraint = user_x1safe_account.owner == user.key() @ X1SafeError::InvalidTokenAccount
    )]
    pub user_x1safe_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        has_one = admin @ X1SafeError::UnauthorizedAdmin
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub admin: Signer<'info>,

    /// PDA that controls tokens
    /// CHECK: PDA validated
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault token account to withdraw from
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Destination for emergency withdrawal
    #[account(mut)]
    pub destination_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        has_one = admin @ X1SafeError::UnauthorizedAdmin
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [ADMIN_CONFIG_SEED],
        bump,
        has_one = admin @ X1SafeError::UnauthorizedAdmin
    )]
    pub admin_config: Account<'info, AdminConfig>,

    pub admin: Signer<'info>,
}

// ============================================================================
// Instruction Parameters
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeParams {
    pub burn_address: Pubkey,
    pub fee_recipient: Pubkey,
    pub deposit_fee_bps: u16, // Basis points (100 = 1%)
    pub exit_fee_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct OracleConfigParams {
    pub usdc_x_price: u64, // Price in micro-USDC.X per unit
    pub xnt_price: u64,
    pub xen_price: u64,
    pub xnm_price: u64,
    pub price_decimals: u8,
    pub update_frequency_secs: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenPrice {
    pub token_mint: Pubkey,
    pub price: u64,
    pub confidence: u64, // Confidence interval in basis points
    pub timestamp: i64,
}

// Re-export from submodules
pub use state::*;
pub use errors::*;