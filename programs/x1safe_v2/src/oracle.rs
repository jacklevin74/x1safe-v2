//! Price oracle module for X1SAFE V2
//! 
//! Handles price data for supported tokens (USDC.X, XNT, XEN, XNM)
//! Prices are stored in USDC.X terms with configurable decimals

use anchor_lang::prelude::*;
use crate::{
    state::*,
    errors::*,
    OracleConfigParams,
    TokenPrice,
    InitializeOracle, UpdatePrices,
};

/// Initialize oracle configuration
pub fn handler_initialize_oracle(
    ctx: Context<InitializeOracle>,
    params: OracleConfigParams,
) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle_config;
    let clock = Clock::get()?;
    
    // Validate price decimals
    require!(params.price_decimals > 0 && params.price_decimals <= 12, X1SafeError::InvalidPriceDecimals);
    
    // Validate prices are non-zero
    require!(params.usdc_x_price > 0, X1SafeError::InvalidPriceDecimals);
    require!(params.xnt_price > 0, X1SafeError::InvalidPriceDecimals);
    require!(params.xen_price > 0, X1SafeError::InvalidPriceDecimals);
    require!(params.xnm_price > 0, X1SafeError::InvalidPriceDecimals);
    
    oracle.last_update = clock.unix_timestamp;
    oracle.price_decimals = params.price_decimals;
    oracle.usdc_x_price = params.usdc_x_price;
    oracle.xnt_price = params.xnt_price;
    oracle.xen_price = params.xen_price;
    oracle.xnm_price = params.xnm_price;
    oracle.usdc_x_confidence = 100; // 1% confidence
    oracle.xnt_confidence = 200;    // 2% confidence
    oracle.xen_confidence = 200;
    oracle.xnm_confidence = 300;    // 3% confidence
    oracle.min_update_frequency = params.update_frequency_secs;
    oracle.bump = ctx.bumps.oracle_config;
    
    msg!("Oracle initialized at timestamp {}", oracle.last_update);
    msg!("USDC.X price: {}", oracle.usdc_x_price);
    msg!("XNT price: {}", oracle.xnt_price);
    msg!("XEN price: {}", oracle.xen_price);
    msg!("XNM price: {}", oracle.xnm_price);
    
    Ok(())
}

/// Update token prices (admin only)
pub fn handler_update_prices(
    ctx: Context<UpdatePrices>,
    prices: Vec<TokenPrice>,
) -> Result<()> {
    let oracle = &mut ctx.accounts.oracle_config;
    let clock = Clock::get()?;
    let admin = ctx.accounts.admin.key();
    
    // Check update frequency
    let time_since_last_update = clock.unix_timestamp - oracle.last_update;
    require!(
        time_since_last_update >= oracle.min_update_frequency as i64,
        X1SafeError::PriceTooOld
    );
    
    for price_update in prices {
        let old_price = oracle.get_price(&price_update.token_mint)?;
        
        // Update price based on token type
        use crate::token_mints;
        
        if price_update.token_mint == token_mints::USDC_X {
            oracle.usdc_x_price = price_update.price;
            oracle.usdc_x_confidence = price_update.confidence;
        } else if price_update.token_mint == token_mints::XNT {
            oracle.xnt_price = price_update.price;
            oracle.xnt_confidence = price_update.confidence;
        } else if price_update.token_mint == token_mints::XEN {
            oracle.xen_price = price_update.price;
            oracle.xen_confidence = price_update.confidence;
        } else if price_update.token_mint == token_mints::XNM {
            oracle.xnm_price = price_update.price;
            oracle.xnm_confidence = price_update.confidence;
        } else {
            return Err(error!(X1SafeError::UnsupportedToken));
        }
        
        // Emit event
        emit!(PriceUpdateEvent {
            admin,
            token_mint: price_update.token_mint,
            old_price,
            new_price: price_update.price,
            timestamp: clock.unix_timestamp,
        });
        
        msg!("Updated price for {:?}: {} -> {}", 
            price_update.token_mint, old_price, price_update.price);
    }
    
    oracle.last_update = clock.unix_timestamp;
    
    Ok(())
}

/// Calculate X1SAFE amount from deposit amount
/// 
/// For USDC.X: 1 X1SAFE = 0.001 USDC.X (fixed rate)
/// For other tokens: convert to USDC.X equivalent first
pub fn calculate_x1safe_amount(
    deposit_amount: u64,
    deposit_token: &Pubkey,
    deposit_decimals: u8,
    oracle: &OracleConfig,
) -> Result<u64> {
    use crate::token_mints;
    use crate::USDC_X_TO_X1SAFE;
    use crate::errors::SafeMath;
    
    // USDC.X has fixed rate: 1 X1SAFE = 0.001 USDC.X
    // So 1 USDC.X = 1000 X1SAFE
    if deposit_token == &token_mints::USDC_X {
        // deposit_amount is in USDC.X micro-units (6 decimals)
        // Result should be X1SAFE with 6 decimals
        // Formula: x1safe = deposit_amount * 1000
        deposit_amount.safe_mul(USDC_X_TO_X1SAFE)
    } else {
        // For other tokens, get price in USDC.X terms
        let price = oracle.get_price(deposit_token)?;
        let confidence = oracle.get_confidence(deposit_token)?;
        
        // Require minimum confidence
        require!(confidence <= 500, X1SafeError::LowPriceConfidence); // Max 5% spread
        
        // Convert to USDC.X value first
        // value_usdcx = deposit_amount * price / 10^price_decimals
        let value_usdcx = convert_to_usdcx(deposit_amount, deposit_decimals, price, oracle.price_decimals)?;
        
        // Then convert USDC.X value to X1SAFE
        value_usdcx.safe_mul(USDC_X_TO_X1SAFE)
    }
}

/// Convert token amount to USDC.X equivalent
fn convert_to_usdcx(
    amount: u64,
    token_decimals: u8,
    price: u64,
    price_decimals: u8,
) -> Result<u64> {
    use crate::errors::SafeMath128;
    
    // Convert to u128 for intermediate calculation to avoid overflow
    let amount_128 = amount as u128;
    let price_128 = price as u128;
    let token_factor = 10_u128.pow(token_decimals as u32);
    let price_factor = 10_u128.pow(price_decimals as u32);
    
    // value = (amount * price) / (10^token_decimals * 10^price_decimals / 10^6)
    // Simplified: value_usdcx = (amount * price) / 10^(token_decimals + price_decimals - 6)
    
    let numerator = amount_128.safe_mul(price_128)?;
    let denominator = 10_u128.pow((token_decimals as u32 + price_decimals as u32).saturating_sub(6));
    
    let result = if denominator > 0 {
        numerator.safe_div(denominator)?
    } else {
        numerator
    };
    
    // Check if result fits in u64
    require!(result <= u64::MAX as u128, X1SafeError::MathOverflow);
    
    Ok(result as u64)
}

/// Validate price is not stale
pub fn validate_price_freshness(
    oracle: &OracleConfig,
    max_age_secs: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    let age = clock.unix_timestamp - oracle.last_update;
    
    require!(age <= max_age_secs, X1SafeError::StalePriceData);
    
    Ok(())
}

/// Get current price with validation
pub fn get_validated_price(
    oracle: &OracleConfig,
    token_mint: &Pubkey,
    max_age_secs: i64,
) -> Result<u64> {
    validate_price_freshness(oracle, max_age_secs)?;
    oracle.get_price(token_mint)
}