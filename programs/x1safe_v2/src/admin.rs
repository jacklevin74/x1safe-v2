//! Admin functions for X1SAFE V2
//! 
//! Handles initialization, emergency operations, and admin controls

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{
    state::*,
    errors::*,
    Initialize, InitializeParams, AdminOnly, UpdateAdmin, EmergencyWithdraw,
};

/// Maximum fee basis points (10%)
const MAX_FEE_BPS: u16 = 1000;

/// Initialize the vault
pub fn handler_initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let clock = Clock::get()?;
    let admin_config = &mut ctx.accounts.admin_config;
    
    // Validate fees
    require!(params.deposit_fee_bps <= MAX_FEE_BPS, X1SafeError::InvalidFeeBps);
    require!(params.exit_fee_bps <= MAX_FEE_BPS, X1SafeError::InvalidFeeBps);
    
    // Set admin configuration
    admin_config.admin = ctx.accounts.payer.key();
    admin_config.fee_recipient = params.fee_recipient;
    admin_config.burn_address = params.burn_address;
    admin_config.x1safe_mint = ctx.accounts.x1safe_mint.key();
    admin_config.usdc_x_mint = ctx.accounts.usdc_x_mint.key();
    admin_config.xnt_mint = ctx.accounts.xnt_mint.key();
    admin_config.xen_mint = ctx.accounts.xen_mint.key();
    admin_config.xnm_mint = ctx.accounts.xnm_mint.key();
    admin_config.vault_authority = ctx.accounts.vault_authority.key();
    admin_config.deposit_fee_bps = params.deposit_fee_bps;
    admin_config.exit_fee_bps = params.exit_fee_bps;
    admin_config.deposits_paused = false;
    admin_config.total_tvl_usd = 0;
    admin_config.total_x1safe_minted = 0;
    admin_config.total_x1safe_burned = 0;
    admin_config.active_positions = 0;
    admin_config.bump = ctx.bumps.admin_config;
    admin_config.created_at = clock.unix_timestamp;
    
    msg!("X1SAFE V2 initialized");
    msg!("Admin: {}", admin_config.admin);
    msg!("X1SAFE Mint: {}", admin_config.x1safe_mint);
    msg!("Burn Address: {}", admin_config.burn_address);
    msg!("Deposit Fee: {} bps", admin_config.deposit_fee_bps);
    msg!("Exit Fee: {} bps", admin_config.exit_fee_bps);
    
    Ok(())
}

/// Pause deposits
pub fn handler_pause_deposits(ctx: Context<AdminOnly>) -> Result<()> {
    let admin_config = &mut ctx.accounts.admin_config;
    require!(!admin_config.deposits_paused, X1SafeError::DepositsPaused);
    
    admin_config.deposits_paused = true;
    
    msg!("Deposits paused by admin: {}", ctx.accounts.admin.key());
    
    Ok(())
}

/// Resume deposits
pub fn handler_resume_deposits(ctx: Context<AdminOnly>) -> Result<()> {
    let admin_config = &mut ctx.accounts.admin_config;
    require!(admin_config.deposits_paused, X1SafeError::DepositsPaused);
    
    admin_config.deposits_paused = false;
    
    msg!("Deposits resumed by admin: {}", ctx.accounts.admin.key());
    
    Ok(())
}

/// Update admin
pub fn handler_update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
    require!(new_admin != Pubkey::default(), X1SafeError::InvalidMint);
    
    let admin_config = &mut ctx.accounts.admin_config;
    let old_admin = admin_config.admin;
    
    admin_config.admin = new_admin;
    
    msg!("Admin updated: {} -> {}", old_admin, new_admin);
    
    Ok(())
}

/// Update fee recipient
pub fn handler_update_fee_recipient(ctx: Context<AdminOnly>, new_recipient: Pubkey) -> Result<()> {
    require!(new_recipient != Pubkey::default(), X1SafeError::InvalidMint);
    
    let admin_config = &mut ctx.accounts.admin_config;
    let old_recipient = admin_config.fee_recipient;
    
    admin_config.fee_recipient = new_recipient;
    
    msg!("Fee recipient updated: {} -> {}", old_recipient, new_recipient);
    
    Ok(())
}

/// Emergency withdrawal - for stuck tokens or critical situations
/// 
/// WARNING: This should only be used in emergencies as it can
/// affect user positions. Use with extreme caution.
pub fn handler_emergency_withdraw(
    ctx: Context<EmergencyWithdraw>,
    amount: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    let admin_key = ctx.accounts.admin.key();
    
    require!(amount > 0, X1SafeError::InvalidDepositAmount);
    
    // Get vault authority signer seeds
    let vault_authority_bump = ctx.bumps.vault_authority;
    let seeds = &[crate::VAULT_AUTHORITY_SEED, &[vault_authority_bump]];
    let signer = &[&seeds[..]
    ];
    
    // Transfer tokens from vault to destination
    let transfer_cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.destination_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_cpi_accounts,
        signer,
    );
    
    token::transfer(cpi_ctx, amount)?;
    
    // Emit emergency event
    emit!(EmergencyWithdrawEvent {
        admin: admin_key,
        token_mint: ctx.accounts.vault_token_account.mint,
        amount,
        timestamp: clock.unix_timestamp,
    });
    
    msg!("EMERGENCY WITHDRAWAL executed by admin: {}", admin_key);
    msg!("Amount: {} tokens", amount);
    msg!("Token: {}", ctx.accounts.vault_token_account.mint);
    msg!("Destination: {}", ctx.accounts.destination_account.key());
    
    Ok(())
}