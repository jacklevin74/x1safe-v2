#!/usr/bin/env node
/**
 * X1SAFE MVP - Deploy & Initialize
 * Simple single-token vault
 */

const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createMint, createAccount, mintTo, getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
const fs = require('fs');

// Configuration
const RPC_URL = 'https://rpc.testnet.x1.xyz';
const PROGRAM_ID = new PublicKey('6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac');

// Testnet USDC.X
const USDC_X_MINT = new PublicKey('B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq');

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     X1SAFE MVP - Deploy & Initialize                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Load wallet
    const walletPath = process.env.WALLET_PATH || `${require('os').homedir()}/.config/solana/id.json`;
    if (!fs.existsSync(walletPath)) {
        console.log('❌ Wallet not found!');
        console.log('Create one with: solana-keygen new');
        process.exit(1);
    }

    const keypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );
    console.log('Wallet:', keypair.publicKey.toBase58());

    // Connect
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    console.log('Balance:', balance / 1e9, 'XNT');
    
    if (balance < 0.01 * 1e9) {
        console.log('\n⚠️  Low balance! Get testnet XNT from:');
        console.log('https://faucet.testnet.x1.xyz');
        process.exit(1);
    }

    console.log('\n✅ Wallet ready\n');

    // Check if program exists
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    if (!programInfo) {
        console.log('❌ Program not deployed yet!');
        console.log('Run: bash scripts/deploy-mvp.sh\n');
        process.exit(1);
    }
    console.log('✅ Program deployed:', PROGRAM_ID.toBase58());
    console.log('   Size:', programInfo.data.length, 'bytes\n');

    // Create X1SAFE mint
    console.log('📝 Creating X1SAFE token mint...');
    const x1safeMint = await createMint(
        connection,
        keypair,
        keypair.publicKey,
        null,
        6,
        Keypair.generate()
    );
    console.log('✅ X1SAFE Mint:', x1safeMint.toBase58());

    // Save config
    const config = {
        programId: PROGRAM_ID.toBase58(),
        x1safeMint: x1safeMint.toBase58(),
        usdcxMint: USDC_X_MINT.toBase58(),
        authority: keypair.publicKey.toBase58(),
        network: RPC_URL,
        createdAt: new Date().toISOString()
    };

    fs.writeFileSync('.mvp-config.json', JSON.stringify(config, null, 2));
    console.log('\n💾 Saved to .mvp-config.json\n');

    // Summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     MVP Ready!                                              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Program:    ${PROGRAM_ID.toBase58().substring(0, 44)} ║`);
    console.log(`║  X1SAFE:     ${x1safeMint.toBase58().substring(0, 44)} ║`);
    console.log(`║  USDC.X:     ${USDC_X_MINT.toBase58().substring(0, 44)} ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Get testnet USDC.X from faucet');
    console.log('2. Initialize vault: node scripts/init-mvp-vault.js');
    console.log('3. Test deposit/exit: node scripts/test-mvp.js');
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    if (err.message?.includes('blockhash')) {
        console.log('\n💡 Try again - RPC may be busy');
    }
    process.exit(1);
});
