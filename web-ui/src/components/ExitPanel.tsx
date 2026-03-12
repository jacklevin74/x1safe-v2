import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { TOKENS } from '../constants';

interface ExitPanelProps {
  network: 'mainnet' | 'devnet';
}

export function ExitPanel({ network }: ExitPanelProps) {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  
  // Mock position data - in production this would be fetched from the contract
  const mockPosition = {
    depositedToken: 'USDC_X',
    depositedAmount: 1000,
    x1safeMinted: 1000000,
    depositTimestamp: Date.now() - 86400000 * 7, // 7 days ago
    isInPool: true
  };

  const handleExit = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!mockPosition.isInPool) {
      toast.error('No position in pool to exit');
      return;
    }

    setLoading(true);
    
    try {
      // Mock exit for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const token = TOKENS[mockPosition.depositedToken as keyof typeof TOKENS];
      toast.success(`Exited successfully! Received ${mockPosition.depositedAmount} ${token.symbol}`);
    } catch (error) {
      console.error('Exit error:', error);
      toast.error('Exit failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const token = TOKENS[mockPosition.depositedToken as keyof typeof TOKENS];
  const depositDate = new Date(mockPosition.depositTimestamp).toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Exit Vault</h2>
        <p className="text-gray-400 mt-1">Exit to receive your original deposit back</p>
      </div>

      {mockPosition.isInPool ? (
        <>
          {/* Position Summary */}
          <div className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Your Position</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Deposited Token</span>
                <span className="text-white font-medium">{token.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Deposited Amount</span>
                <span className="text-white font-medium">{mockPosition.depositedAmount.toLocaleString()} {token.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">X1SAFE Balance</span>
                <span className="text-white font-medium">{mockPosition.x1safeMinted.toLocaleString()} X1SAFE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Deposit Date</span>
                <span className="text-white font-medium">{depositDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-emerald-400 font-medium">🟢 In Pool</span>
              </div>
            </div>
          </div>

          {/* Exit Preview */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <h4 className="font-medium text-white mb-3">Exit Preview</h4>
            <div className="flex items-center justify-between py-2 border-b border-white/10">
              <span className="text-gray-400">You burn</span>
              <span className="text-white">{mockPosition.x1safeMinted.toLocaleString()} X1SAFE</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400">You receive</span>
              <span className="text-emerald-400 font-semibold">{mockPosition.depositedAmount.toLocaleString()} {token.symbol}</span>
            </div>
          </div>

          {/* Exit Button */}
          <button
            onClick={handleExit}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpRight className="w-5 h-5" />
                Exit Position
              </>
            )}
          </button>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Active Position</h3>
          <p className="text-gray-400">You don't have any tokens in the pool to exit.</p>
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-sm text-blue-200">
          💡 <strong>How Exit works:</strong> When you exit, your X1SAFE tokens are burned 
          and you receive the exact amount of tokens you originally deposited.
        </p>
      </div>
    </div>
  );
}
