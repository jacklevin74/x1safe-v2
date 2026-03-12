import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface WithdrawPanelProps {
  network: 'mainnet' | 'devnet';
}

export function WithdrawPanel({ network }: WithdrawPanelProps) {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data
  const mockPosition = {
    x1safeBalance: 1000000,
    isInPool: true
  };

  const handleWithdraw = async () => {
    if (!publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (withdrawAmount > mockPosition.x1safeBalance) {
      toast.error('Insufficient X1SAFE balance');
      return;
    }

    setLoading(true);
    
    try {
      // Mock withdraw for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`Successfully withdrew ${withdrawAmount.toLocaleString()} X1SAFE from pool!`);
      setAmount('');
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Withdraw failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(mockPosition.x1safeBalance.toString());
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Withdraw from Pool</h2>
        <p className="text-gray-400 mt-1">Withdraw X1SAFE to make it transferable</p>
      </div>

      {mockPosition.isInPool ? (
        <>
          {/* Balance Info */}
          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">Your X1SAFE Balance</p>
                <p className="text-2xl font-bold text-white">
                  {mockPosition.x1safeBalance.toLocaleString()} X1SAFE
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full">
                  🟢 In Pool
                </span>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Amount to Withdraw</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-mono focus:outline-none focus:border-purple-500 transition-colors"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-gray-400">X1SAFE</span>
                <button
                  onClick={handleMaxClick}
                  className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded hover:bg-purple-500/30 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <h4 className="font-medium text-white mb-3">Withdraw Preview</h4>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-400">From Pool</span>
                  <span className="text-white">{parseFloat(amount).toLocaleString()} X1SAFE</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">To Wallet</span>
                  <span className="text-purple-400 font-semibold">{parseFloat(amount).toLocaleString()} X1SAFE</span>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Transferable?</span>
                    <span className="text-emerald-400">✅ Yes (after withdraw)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Withdraw Button */}
          <button
            onClick={handleWithdraw}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                Withdraw from Pool
              </>
            )}
          </button>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-white mb-2">Already Withdrawn</h3>
          <p className="text-gray-400">Your X1SAFE is already outside the pool and transferable.</p>
        </div>
      )}

      {/* Warning */}
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <p className="text-sm text-red-200">
          ⚠️ <strong>Important:</strong> Withdrawing from pool makes X1SAFE transferable 
          but <strong>loses exit rights</strong>. You cannot exit to retrieve your original 
          deposit after withdrawing.
        </p>
      </div>
    </div>
  );
}
