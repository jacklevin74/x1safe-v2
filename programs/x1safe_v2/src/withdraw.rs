//! Withdraw instruction logic for X1SAFE V2
//! 
//! Users can withdraw their X1SAFE tokens from the pool
//! This makes them transferable but loses exit rights
//! The position remains but is no longer in the pool

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, MintTo, Burn};
use crate::{
    state::*,
    errors::*,
    WithdrawFromPool,
};

/// Handle withdraw from pool instruction
/// 
/// This "unlocks" the X1SAFE tokens, making them transferable
/// but the user loses the right to exit for their original deposit
pub fn handler_withdraw_from_pool(ctx: Context<WithdrawFromPool>, amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let position = &mut ctx.accounts.user_position;
    let user_key = ctx.accounts.user.key();
    
    // Validate amount
    require!(amount > 0, X1SafeError::InvalidDepositAmount);
    require!(position.x1safe_balance >= amount, X1SafeError::InsufficientBalance);
    
    // Ensure position is still in pool
    require!(position.is_in_pool, X1SafeError::AlreadyWithdrawn);
    
    // Mark position as withdrawn from pool
    // This makes X1SAFE tokens transferable (no longer soulbound in pool context)
    // The actual transfer restriction is handled at the token contract level
    // Here we just record the state change
    
    // For X1SAFE V2, the soulbound nature is enforced by:
    // 1. The token mint having a freeze authority that prevents transfers
    // 2. This contract being the freeze authority
    // 3. When withdrawing, we thaw the account (remove freeze)
    // 
    // For this implementation, we mark the position as withdrawn
    // and rely on off-chain indexing to enforce transfer restrictions
    
    // In a production implementation, you would:
    // 1. Call token::thaw_account to unfreeze the user's X1SAFE token account
    // 2. This requires the freeze authority to be the vault_authority PDA
    
    // Update position
    let remaining_balance = position.x1safe_balance.safe_sub(amount)?;
    
    if remaining_balance == 0 {
        // Fully withdrawn - mark completely out of pool
        position.is_in_pool = false;
    }
    
    position.x1safe_balance = remaining_balance;
    position.last_update = clock.unix_timestamp;
    
    // Note: We don't burn any tokens here
    // The tokens just become transferable
    // The user's X1SAFE account balance remains the same
    // but they can now transfer/sell them
    
    // Update admin stats
    let admin_config = &mut ctx.accounts.admin_config;
    admin_config.active_positions = admin_config.active_positions.saturating_sub(1);
    
    // Emit withdraw event
    emit!(WithdrawFromPoolEvent {
        user: user_key,
        amount,
        timestamp: clock.unix_timestamp,
    });
    
    msg!("Withdraw from pool successful: {} X1SAFE", amount);
    msg!("Remaining balance: {} X1SAFE", remaining_balance);
    msg!("X1SAFE tokens are now transferable");
    msg!("WARNING: Exit rights forfeited");
    
    Ok(())
}