import { PublicKey } from '@solana/web3.js';

// Network Configuration
export const NETWORKS = {
  mainnet: {
    name: 'X1 Mainnet',
    endpoint: 'https://rpc.mainnet.x1.xyz',
    programId: new PublicKey('Fg6nWVLnLkHkxwFxk2YrMwf4sKVzNTVXxHAYjMoBzD9C'),
    explorer: 'https://explorer.mainnet.x1.xyz'
  },
  devnet: {
    name: 'X1 Testnet',
    endpoint: 'https://rpc.testnet.x1.xyz',
    programId: new PublicKey('4377BZC8xDor2mGdWQK6ABXkhBpD6in3k9oLFp5iKmue'),
    explorer: 'https://explorer.testnet.x1.xyz'
  }
};

// Token Configuration (X1 Mainnet)
export const TOKENS = {
  USDC_X: {
    symbol: 'USDC.X',
    name: 'Wrapped USDC',
    mint: new PublicKey('B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq'),
    decimals: 6,
    isStable: true,
    color: '#2775CA'
  },
  XEN: {
    symbol: 'XEN',
    name: 'XEN Token',
    mint: new PublicKey('y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC'),
    decimals: 6,
    isStable: false,
    color: '#FF6B35'
  },
  XNT: {
    symbol: 'XNT',
    name: 'X1 Native Token',
    mint: new PublicKey('3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv'),
    decimals: 9,
    isStable: false,
    color: '#6366F1'
  },
  XNM: {
    symbol: 'XNM',
    name: 'XenBlocks Miner',
    mint: new PublicKey('XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m'),
    decimals: 9,
    isStable: false,
    color: '#10B981'
  }
};

// Exchange Rate: 1 X1SAFE = 0.001 USDC.X (fixed)
export const X1SAFE_RATE = 0.001;
export const USDC_X1SAFE_RATIO = 1000; // 1 USDC.X = 1000 X1SAFE

// Seed constants
export const SEEDS = {
  ADMIN_CONFIG: 'admin_config',
  USER_POSITION: 'user_position',
  ORACLE_CONFIG: 'oracle_config',
  VAULT_AUTHORITY: 'vault_authority'
};

// UI Constants
export const TOAST_DURATION = 5000;
