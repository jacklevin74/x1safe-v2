//! Deposit instruction logic for X1SAFE V2
//! 
//! Users deposit USDC.X, XNT, XEN, or XNM and receive soulbound X1SAFE tokens
//! USDC.X has fixed rate: 1 X1SAFE = 0.001 USDC.X
//! Other tokens: price queried from oracle, converted to USDC.X equivalent

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::{
    state::*,
    errors::*,
    oracle::{calculate_x1safe_amount, validate_price_freshness},
    Deposit,
    USDC_X_TO_X1SAFE,
    MIN_DEPOSIT_AMOUNT,
    MAX_DEPOSIT_AMOUNT,
};

/// Handle deposit instruction
pub fn handler_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let deposit_mint = ctx.accounts.user_token_account.mint;
    let deposit_decimals = ctx.accounts.deposit_mint.decimals;
    
    // Validate supported token
    let token_type = TokenType::from_mint(&deposit_mint)?;
    
    // Validate deposit amount
    require!(amount > 0, X1SafeError::InvalidDepositAmount);
    require!(amount >= MIN_DEPOSIT_AMOUNT, X1SafeError::DepositTooSmall);
    require!(amount <= MAX_DEPOSIT_AMOUNT, X1SafeError::DepositTooLarge);
    
    // Validate price freshness (max 5 minutes old)
    validate_price_freshness(&ctx.accounts.oracle_config, 
        300 // 5 minutes
    )?;
    
    // Calculate X1SAFE to mint
    let x1safe_to_mint = calculate_x1safe_amount(
        amount,
        &deposit_mint,
        deposit_decimals,
        &ctx.accounts.oracle_config,
    )?;
    
    require!(x1safe_to_mint > 0, X1SafeError::MathOverflow);
    
    // Calculate fee
    let fee_bps = ctx.accounts.admin_config.deposit_fee_bps;
    let fee_amount = if fee_bps > 0 {
        let fee = (x1safe_to_mint as u128)
            .checked_mul(fee_bps as u128)
            .ok_or(X1SafeError::MathOverflow)?
            .checked_div(10000)
            .ok_or(X1SafeError::MathOverflow)? as u64;
        fee
    } else {
        0
    };
    
    let x1safe_after_fee = x1safe_to_mint.safe_sub(fee_amount)?;
    
    // Transfer deposit tokens from user to vault
    let transfer_cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, transfer_cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;
    
    // Mint X1SAFE to user
    let vault_authority_bump = ctx.bumps.vault_authority;
    let seeds = &[crate::VAULT_AUTHORITY_SEED, &[vault_authority_bump]];
    let signer = &[&seeds[..]
    ];
    
    let mint_to_cpi_accounts = token::MintTo {
        mint: ctx.accounts.x1safe_mint.to_account_info(),
        to: ctx.accounts.user_x1safe_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    
    let mint_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        mint_to_cpi_accounts,
        signer,
    );
    
    token::mint_to(mint_cpi_ctx, x1safe_after_fee)?;
    
    // If there's a fee, mint it to fee recipient
    if fee_amount > 0 {
        // Fee is minted to vault authority, then transferred to fee recipient
        // In production, you'd want a separate fee token account
        let fee_mint_cpi_accounts = token::MintTo {
            mint: ctx.accounts.x1safe_mint.to_account_info(),
            to: ctx.accounts.user_x1safe_account.to_account_info(), // Simplified - in prod use fee account
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        
        let fee_cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            fee_mint_cpi_accounts,
            signer,
        );
        
        token::mint_to(fee_cpi_ctx, fee_amount)?;
    }
    
    // Update user position
    let position = &mut ctx.accounts.user_position;
    position.owner = ctx.accounts.user.key();
    position.deposit_mint = deposit_mint;
    position.deposit_amount = position.deposit_amount.safe_add(amount)?;
    position.x1safe_balance = position.x1safe_balance.safe_add(x1safe_after_fee)?;
    position.deposit_time = clock.unix_timestamp;
    position.last_update = clock.unix_timestamp;
    position.is_in_pool = true;
    position.is_exited = false;
    position.deposit_price = ctx.accounts.oracle_config.get_price(&deposit_mint)?;
    position.bump = ctx.bumps.user_position;
    
    // Update admin stats
    let admin_config = &mut ctx.accounts.admin_config;
    admin_config.total_x1safe_minted = admin_config.total_x1safe_minted.safe_add(x1safe_to_mint)?;
    admin_config.active_positions = admin_config.active_positions.safe_add(1)?;
    
    // Emit deposit event
    emit!(DepositEvent {
        user: ctx.accounts.user.key(),
        deposit_mint,
        deposit_amount: amount,
        x1safe_minted: x1safe_after_fee,
        fee_amount,
        timestamp: clock.unix_timestamp,
    });
    
    msg!("Deposit successful: {} tokens, {} X1SAFE minted", amount, x1safe_after_fee);
    msg!("Fee: {} X1SAFE", fee_amount);
    msg!("Position is soulbound (in pool)");
    
    Ok(())
}