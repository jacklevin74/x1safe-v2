//! Exit instruction logic for X1SAFE V2
//! 
//! Users can exit their position to receive their original deposit back
//! This burns their X1SAFE tokens and removes their position
//! Only available for positions still in the pool (not withdrawn)

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Burn};
use crate::{
    state::*,
    errors::*,
    Exit,
};

/// Handle exit instruction
pub fn handler_exit(ctx: Context<Exit>) -> Result<()> {
    let clock = Clock::get()?;
    let position = &mut ctx.accounts.user_position;
    let user_key = ctx.accounts.user.key();
    
    // Ensure position is not already exited
    require!(!position.is_exited, X1SafeError::PositionAlreadyExited);
    
    // Ensure position is in pool
    require!(position.is_in_pool, X1SafeError::CannotExitWithdrawnPosition);
    
    let deposit_mint = position.deposit_mint;
    let deposit_amount = position.deposit_amount;
    let x1safe_balance = position.x1safe_balance;
    
    require!(deposit_amount > 0, X1SafeError::NoActiveDeposit);
    require!(x1safe_balance > 0, X1SafeError::InsufficientBalance);
    
    // Calculate exit fee
    let fee_bps = ctx.accounts.admin_config.exit_fee_bps;
    let fee_amount = if fee_bps > 0 {
        let fee = (deposit_amount as u128)
            .checked_mul(fee_bps as u128)
            .ok_or(X1SafeError::MathOverflow)?
            .checked_div(10000)
            .ok_or(X1SafeError::MathOverflow)? as u64;
        fee
    } else {
        0
    };
    
    let return_amount = deposit_amount.safe_sub(fee_amount)?;
    
    // Get vault authority signer seeds
    let vault_authority_bump = ctx.bumps.vault_authority;
    let seeds = &[crate::VAULT_AUTHORITY_SEED, &[vault_authority_bump]];
    let signer = &[&seeds[..]
    ];
    
    // Transfer original deposit tokens back to user
    let transfer_cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_cpi_accounts,
        signer,
    );
    
    token::transfer(cpi_ctx, return_amount)?;
    
    // Transfer fee to fee recipient (if any)
    if fee_amount > 0 {
        // In a real implementation, you'd transfer fee to a fee recipient account
        // For now, fee stays in vault
        msg!("Exit fee: {} tokens", fee_amount);
    }
    
    // Burn X1SAFE tokens from user
    let burn_cpi_accounts = Burn {
        mint: ctx.accounts.x1safe_mint.to_account_info(),
        from: ctx.accounts.user_x1safe_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    
    let burn_cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        burn_cpi_accounts,
    );
    
    // Burn all X1SAFE balance
    token::burn(burn_cpi_ctx, x1safe_balance)?;
    
    // If fee was charged in X1SAFE, burn those too
    // (already handled by burning the full balance)
    
    // Update position
    position.is_exited = true;
    position.is_in_pool = false;
    position.x1safe_balance = 0;
    position.last_update = clock.unix_timestamp;
    
    // Update admin stats
    let admin_config = &mut ctx.accounts.admin_config;
    admin_config.total_x1safe_burned = admin_config.total_x1safe_burned.safe_add(x1safe_balance)?;
    admin_config.active_positions = admin_config.active_positions.saturating_sub(1);
    
    // Calculate TVL reduction (simplified - actual implementation would track per-token TVL)
    // This is a placeholder - real TVL tracking needs more sophisticated logic
    
    // Emit exit event
    emit!(ExitEvent {
        user: user_key,
        deposit_mint,
        returned_amount: return_amount,
        x1safe_burned: x1safe_balance,
        fee_amount,
        timestamp: clock.unix_timestamp,
    });
    
    msg!("Exit successful: {} {} returned", return_amount, deposit_mint);
    msg!("Burned {} X1SAFE tokens", x1safe_balance);
    msg!("Position closed");
    
    Ok(())
}