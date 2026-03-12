import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from '@solana/spl-token';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { ArrowDownLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { TOKENS, NETWORKS, USDC_X1SAFE_RATIO } from '../constants';
import { IDL } from '../idl';

interface DepositPanelProps {
  network: 'mainnet' | 'devnet';
}

export function DepositPanel({ network }: DepositPanelProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [selectedToken, setSelectedToken] = useState<keyof typeof TOKENS>('USDC_X');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimatedX1safe, setEstimatedX1safe] = useState<number | null>(null);

  const token = TOKENS[selectedToken];

  const calculateX1safe = (inputAmount: string) => {
    const num = parseFloat(inputAmount);
    if (isNaN(num) || num <= 0) {
      setEstimatedX1safe(null);
      return;
    }

    // Simple calculation for demo
    // In production, this would query the oracle
    if (token.isStable) {
      setEstimatedX1safe(num * USDC_X1SAFE_RATIO);
    } else {
      // Mock oracle prices for demo
      const mockPrices: Record<string, number> = {
        XEN: 0.05,
        XNT: 0.1,
        XNM: 0.2
      };
      const price = mockPrices[token.symbol] || 0.1;
      const usdcValue = num * price;
      setEstimatedX1safe(usdcValue * USDC_X1SAFE_RATIO);
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    calculateX1safe(value);
  };

  const handleDeposit = async () => {
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    
    try {
      // Mock deposit for demo
      // In production, this would call the actual program
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`Successfully deposited ${amount} ${token.symbol}!`);
      setAmount('');
      setEstimatedX1safe(null);
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Deposit failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Deposit Tokens</h2>
        <p className="text-gray-400 mt-1">Deposit supported tokens to receive X1SAFE</p>
      </div>

      {/* Token Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Select Token</label>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(TOKENS).map(([key, t]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedToken(key as keyof typeof TOKENS);
                calculateX1safe(amount);
              }}
              className={`p-4 rounded-xl border transition-all duration-200 ${
                selectedToken === key
                  ? 'bg-white/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: t.color }}
                >
                  {t.symbol.slice(0, 2)}
                </div>
                <div className="text-left">
                  <div className="font-medium text-white">{t.symbol}</div>
                  <div className="text-xs text-gray-400">{t.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-mono focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="text-gray-400 font-medium">{token.symbol}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Decimals: {token.decimals} | Mint: {token.mint.toString().slice(0, 8)}...
        </p>
      </div>

      {/* Estimation */}
      {estimatedX1safe !== null && (
        <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-indigo-400" />
              <span className="text-gray-300">You will receive:</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-white">
                {estimatedX1safe.toLocaleString(undefined, { maximumFractionDigits: 2 })} X1SAFE
              </div>
              <div className="text-sm text-gray-400">
                ≈ ${(estimatedX1safe * 0.001).toFixed(2)} USDC
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={loading || !amount || parseFloat(amount) <= 0}
        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>Deposit {token.symbol}</>
        )}
      </button>

      {/* Warning */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <p className="text-sm text-yellow-200">
          ⚠️ <strong>Note:</strong> X1SAFE tokens will be soulbound and non-transferable 
          until you withdraw from the pool.
        </p>
      </div>
    </div>
  );
}
