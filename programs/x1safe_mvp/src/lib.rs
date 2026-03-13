use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac");

/// X1SAFE MVP - Single Token Vault (USDC.X only)
/// Simple deposit/exit with soulbound tokens

#[program]
pub mod x1safe_mvp {
    use super::*;

    /// Initialize vault
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.token_mint = ctx.accounts.token_mint.key();
        vault.x1safe_mint = ctx.accounts.x1safe_mint.key();
        vault.burn_ata = ctx.accounts.burn_ata.key();
        vault.total_deposits = 0;
        vault.bump = ctx.bumps.vault;
        
        msg!("Vault initialized: {}", vault.key());
        msg!("Burn ATA: {}", vault.burn_ata);
        Ok(())
    }

    /// Deposit USDC.X → receive X1SAFE (soulbound in vault)
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Transfer USDC.X from user to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // Mint X1SAFE to user (soulbound - stays in vault)
        let vault_key = ctx.accounts.vault.key();
        let seeds = &[b"vault", vault_key.as_ref(), &[ctx.accounts.vault.bump]];
        let signer = &[&seeds[..],
        ];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.x1safe_mint.to_account_info(),
                    to: ctx.accounts.user_x1safe.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            amount, // 1:1 ratio for MVP
        )?;

        // Update deposit record
        let user_vault = &mut ctx.accounts.user_vault;
        user_vault.owner = ctx.accounts.user.key();
        user_vault.deposited_amount = user_vault.deposited_amount.checked_add(amount).unwrap();
        user_vault.x1safe_balance = user_vault.x1safe_balance.checked_add(amount).unwrap();

        // Update vault total
        ctx.accounts.vault.total_deposits = ctx.accounts.vault.total_deposits.checked_add(amount).unwrap();

        msg!("Deposited: {} USDC.X, Minted: {} X1SAFE", amount, amount);
        Ok(())
    }

    /// Withdraw X1SAFE from pool → transferable, loses exit rights
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let user_vault = &mut ctx.accounts.user_vault;
        
        require!(user_vault.x1safe_balance > 0, ErrorCode::NoBalance);
        require!(!user_vault.withdrawn, ErrorCode::AlreadyWithdrawn);
        
        // Mark as withdrawn - loses exit rights
        user_vault.withdrawn = true;
        user_vault.withdrawn_at = Clock::get()?.unix_timestamp;
        
        // Note: X1SAFE tokens remain in user's wallet (user_x1safe ATA)
        // But now they can transfer them freely (no longer soulbound)
        // The user_vault.withdrawn flag prevents future exit
        
        msg!("Withdraw: {} X1SAFE now transferable, exit disabled", user_vault.x1safe_balance);
        Ok(())
    }

    /// Exit vault → burn X1SAFE, receive USDC.X back
    pub fn exit(ctx: Context<Exit>) -> Result<()> {
        let user_vault = &ctx.accounts.user_vault;
        let x1safe_balance = user_vault.x1safe_balance;
        let deposited = user_vault.deposited_amount;
        
        require!(x1safe_balance > 0, ErrorCode::NoBalance);
        require!(!user_vault.withdrawn, ErrorCode::AlreadyWithdrawn);

        // Transfer X1SAFE to burn ATA first (for tracking)
        let vault_key = ctx.accounts.vault.key();
        let seeds = &[b"vault", vault_key.as_ref(), &[ctx.accounts.vault.bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_x1safe.to_account_info(),
                    to: ctx.accounts.burn_ata.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            x1safe_balance,
        )?;

        // Burn X1SAFE from burn ATA
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.x1safe_mint.to_account_info(),
                    from: ctx.accounts.burn_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            x1safe_balance,
        )?;

        // Emit burn event for tracking
        emit!(BurnEvent {
            user: ctx.accounts.user.key(),
            amount: x1safe_balance,
            timestamp: Clock::get()?.unix_timestamp,
        });

        // Transfer USDC.X back to user
        let vault = &ctx.accounts.vault;
        let vault_seeds = &[
            b"vault",
            vault.authority.as_ref(),
            vault.token_mint.as_ref(),
            &[ctx.bumps.vault_token],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                &[seeds[..]],
            ),
            deposited,
        )?;

        // Reset user vault
        let user_vault = &mut ctx.accounts.user_vault;
        let returned = user_vault.deposited_amount;
        user_vault.deposited_amount = 0;
        user_vault.x1safe_balance = 0;

        // Update vault total
        ctx.accounts.vault.total_deposits = ctx.accounts.vault.total_deposits.checked_sub(returned).unwrap();

        msg!("Exit: Burned {} X1SAFE, Returned {} USDC.X", x1safe_balance, returned);
        Ok(())
    }
}

// ============== ACCOUNTS ==============

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Vault state account
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::SIZE,
        seeds = [b"vault", authority.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    /// USDC.X token mint
    pub token_mint: Account<'info, Mint>,
    
    /// X1SAFE token mint (created separately)
    pub x1safe_mint: Account<'info, Mint>,
    
    /// Burn ATA for X1SAFE (for tracking burns)
    #[account(
        init,
        payer = authority,
        associated_token::mint = x1safe_mint,
        associated_token::authority = vault,
    )]
    pub burn_ata: Account<'info, TokenAccount>,
    
    /// Vault token account (holds USDC.X)
    #[account(
        init,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    
    /// User's USDC.X account
    #[account(
        mut,
        associated_token::mint = vault.token_mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,
    
    /// Vault's USDC.X account
    #[account(
        mut,
        associated_token::mint = vault.token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    
    /// X1SAFE mint
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault.x1safe_mint
    )]
    pub x1safe_mint: Account<'info, Mint>,
    
    /// User's X1SAFE account
    #[account(
        mut,
        associated_token::mint = x1safe_mint,
        associated_token::authority = user,
    )]
    pub user_x1safe: Account<'info, TokenAccount>,
    
    /// User vault state (tracks deposits)
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserVault::SIZE,
        seeds = [b"user_vault", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Exit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        mut,
        associated_token::mint = vault.token_mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = vault.token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = x1safe_mint.key() == vault.x1safe_mint
    )]
    pub x1safe_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = x1safe_mint,
        associated_token::authority = user,
    )]
    pub user_x1safe: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"user_vault", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,
    
    /// Burn ATA - receives X1SAFE before burning (for tracking)
    #[account(
        mut,
        associated_token::mint = x1safe_mint,
        associated_token::authority = vault,
    )]
    pub burn_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref(), vault.token_mint.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,
    
    /// X1SAFE mint
    #[account(
        constraint = x1safe_mint.key() == vault.x1safe_mint
    )]
    pub x1safe_mint: Account<'info, Mint>,
    
    /// User's X1SAFE account (must have balance)
    #[account(
        associated_token::mint = x1safe_mint,
        associated_token::authority = user,
    )]
    pub user_x1safe: Account<'info, TokenAccount>,
    
    /// User vault state
    #[account(
        mut,
        seeds = [b"user_vault", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,
}

// ============== STATE ==============

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub token_mint: Pubkey,    // USDC.X
    pub x1safe_mint: Pubkey,   // X1SAFE
    pub burn_ata: Pubkey,      // Burn ATA for tracking
    pub total_deposits: u64,
    pub bump: u8,
}

impl Vault {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 8 + 1; // ~137 bytes
}

#[account]
pub struct UserVault {
    pub owner: Pubkey,
    pub deposited_amount: u64,  // USDC.X deposited
    pub x1safe_balance: u64,    // X1SAFE received
    pub withdrawn: bool,      // True if user withdrew from pool
    pub withdrawn_at: i64,      // Timestamp of withdrawal
}

impl UserVault {
    pub const SIZE: usize = 32 + 8 + 8 + 1 + 8; // ~57 bytes
}

// ============== ERRORS ==============

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("No balance to exit")]
    NoBalance,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Already withdrawn")]
    AlreadyWithdrawn,
}

// ============== EVENTS ==============

#[event]
pub struct BurnEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
