#!/usr/bin/env node
/**
 * X1SAFE V2 Oracle Price Updater
 * Fetches prices from xDEX API and updates on-chain oracle
 */

const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PROGRAM_ID = new PublicKey("6rEbPJ3Kbeb4bi2TofbzFybpkzDBi9ZYciEFvUemnhac");
const RPC_URL = "https://rpc.testnet.x1.xyz";
const XDEX_API = "https://api.xdex.xyz";

const TOKEN_MINTS = {
  USDC_X: "B69chRzqzDCmdB5WYB8NRu5Yv5ZA95ABiZcdzCgGm9Tq",
  XEN: "y1KEaaWVoEfX2gH7X1Vougmc9yD1Bi2c9VHeD7bDnNC",
  XNT: "3h3Sm8iRzV9wQM4N1kQqDm4CzRpD6o4T2yuvLVDm2wVv",
  XNM: "XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m",
};

// Anchor discriminator for "updatePrices"
const IX_UPDATE_PRICES = Buffer.from([59, 62, 102, 24, 101, 61, 103, 13]);

function loadWallet() {
  const keypairPath = path.join(process.env.HOME, ".config/solana/id.json");
  const data = JSON.parse(fs.readFileSync(keypairPath));
  return Keypair.fromSecretKey(new Uint8Array(data));
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getTokenPrices() {
  console.log("Fetching prices from xDEX...\n");
  
  const prices = {};
  const tokens = [
    { name: 'USDC.X', mint: TOKEN_MINTS.USDC_X, decimals: 6, isStable: true },
    { name: 'XEN', mint: TOKEN_MINTS.XEN, decimals: 6, isStable: false },
    { name: 'XNT', mint: TOKEN_MINTS.XNT, decimals: 9, isStable: false },
    { name: 'XNM', mint: TOKEN_MINTS.XNM, decimals: 9, isStable: false },
  ];
  
  // For testnet, use mock prices or fetch from mainnet as reference
  // In production, this would fetch from xDEX on the same network
  for (const token of tokens) {
    try {
      const url = `${XDEX_API}/api/token-price/price?network=X1%20Mainnet&address=${token.mint}`;
      const data = await fetchJSON(url);
      
      if (data.price) {
        prices[token.name] = {
          price: Math.floor(data.price * 1e6), // Convert to micro-units
          confidence: 9900, // 99% confidence
          timestamp: Date.now(),
        };
        console.log(`✅ ${token.name}: $${data.price}`);
      } else {
        // Fallback prices for testnet
        prices[token.name] = getFallbackPrice(token.name);
        console.log(`⚠️ ${token.name}: Using fallback $${prices[token.name].price / 1e6}`);
      }
    } catch(e) {
      prices[token.name] = getFallbackPrice(token.name);
      console.log(`⚠️ ${token.name}: Using fallback $${prices[token.name].price / 1e6}`);
    }
  }
  
  return prices;
}

function getFallbackPrice(tokenName) {
  // Fallback prices for testnet (in micro-USDC)
  const fallbacks = {
    'USDC.X': { price: 1000000, confidence: 10000, timestamp: Date.now() }, // $1.00
    'XEN': { price: 50000, confidence: 9500, timestamp: Date.now() },       // $0.05
    'XNT': { price: 100000, confidence: 9500, timestamp: Date.now() },    // $0.10
    'XNM': { price: 20000, confidence: 9000, timestamp: Date.now() },     // $0.02
  };
  return fallbacks[tokenName];
}

async function updateOracle(prices) {
  console.log("\n🚀 Updating on-chain oracle...\n");
  
  const wallet = loadWallet();
  const conn = new Connection(RPC_URL, "confirmed");
  
  // PDAs
  const [adminConfig] = PublicKey.findProgramAddressSync([Buffer.from("admin_config")], PROGRAM_ID);
  const [oracleConfig] = PublicKey.findProgramAddressSync([Buffer.from("oracle_config")], PROGRAM_ID);
  
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("AdminConfig:", adminConfig.toBase58());
  console.log("OracleConfig:", oracleConfig.toBase58());
  
  // Build price updates
  const tokenPrices = [
    { mint: TOKEN_MINTS.USDC_X, price: prices['USDC.X'].price, confidence: prices['USDC.X'].confidence },
    { mint: TOKEN_MINTS.XEN, price: prices['XEN'].price, confidence: prices['XEN'].confidence },
    { mint: TOKEN_MINTS.XNT, price: prices['XNT'].price, confidence: prices['XNT'].confidence },
    { mint: TOKEN_MINTS.XNM, price: prices['XNM'].price, confidence: prices['XNM'].confidence },
  ];
  
  // Serialize prices (simplified - in production use proper Borsh serialization)
  const data = Buffer.concat([
    IX_UPDATE_PRICES,
    Buffer.from([tokenPrices.length, 0, 0, 0]), // Vec length as u32
    ...tokenPrices.map(tp => Buffer.concat([
      new PublicKey(tp.mint).toBuffer(),
      Buffer.from(tp.price.toString(16).padStart(16, '0'), 'hex').reverse(), // u64 LE
      Buffer.from(tp.confidence.toString(16).padStart(16, '0'), 'hex').reverse(), // u64 LE
      Buffer.from(Date.now().toString(16).padStart(16, '0'), 'hex').reverse(), // i64 LE
    ])),
  ]);
  
  const keys = [
    { pubkey: adminConfig, isSigner: false, isWritable: false },
    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    { pubkey: oracleConfig, isSigner: false, isWritable: true },
  ];
  
  const tx = new Transaction().add(
    new TransactionInstruction({ programId: PROGRAM_ID, keys, data })
  );
  tx.feePayer = wallet.publicKey;
  
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet], { commitment: "confirmed" });
    console.log("✅ Oracle updated!");
    console.log("Tx:", sig);
    console.log("Explorer: https://explorer.testnet.x1.xyz/tx/" + sig);
  } catch(e) {
    console.error("❌ Failed:", e.message);
    if (e.logs) console.log("Logs:", e.logs.join("\n"));
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     X1SAFE V2 - Oracle Price Updater                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  const prices = await getTokenPrices();
  
  console.log("\n📊 Price Summary:");
  console.log("  USDC.X: $", (prices['USDC.X'].price / 1e6).toFixed(6));
  console.log("  XEN:    $", (prices['XEN'].price / 1e6).toFixed(6));
  console.log("  XNT:    $", (prices['XNT'].price / 1e6).toFixed(6));
  console.log("  XNM:    $", (prices['XNM'].price / 1e6).toFixed(6));
  
  // Update on-chain
  await updateOracle(prices);
}

main().catch(console.error);
