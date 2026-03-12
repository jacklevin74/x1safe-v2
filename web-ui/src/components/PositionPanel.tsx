import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TrendingUp, TrendingDown, Wallet, Clock, AlertCircle } from 'lucide-react';
import { TOKENS } from '../constants';

interface PositionPanelProps {
  network: 'mainnet' | 'devnet';
}

export function PositionPanel({ network }: PositionPanelProps) {
  const { publicKey } = useWallet();
  const [activeView, setActiveView] = useState<'overview' | 'history'>('overview');

  // Mock position data
  const position = {
    depositedToken: 'USDC_X' as keyof typeof TOKENS,
    depositedAmount: 1000,
    x1safeInPool: 1000000,
    x1safeWithdrawn: 0,
    depositTimestamp: Date.now() - 86400000 * 15, // 15 days ago
    isInPool: true
  };

  const token = TOKENS[position.depositedToken];
  const depositDate = new Date(position.depositTimestamp).toLocaleDateString();
  const daysHeld = Math.floor((Date.now() - position.depositTimestamp) / 86400000);

  // Mock history
  const history = [
    { type: 'deposit', amount: 1000, token: 'USDC.X', date: '2026-02-25', tx: '5xK3...8mN2' },
  ];

  const totalValue = position.depositedAmount; // In production, calculate with current prices

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Your Position</h2>
        <p className="text-gray-400 mt-1">View and manage your X1SAFE position</p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView('overview')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all ${
            activeView === 'overview'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveView('history')}
          className={`flex-1 py-2 rounded-lg font-medium transition-all ${
            activeView === 'history'
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          History
        </button>
      </div>

      {activeView === 'overview' ? (
        <>
          {/* Total Value Card */}
          <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Total Position Value</span>
              <span className={`inline-flex items-center gap-1 text-sm ${
                position.isInPool ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {position.isInPool ? '🟢 In Pool' : '🟡 Withdrawn'}
              </span>
            </div>
            <div className="text-3xl font-bold text-white">
              ${totalValue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              ≈ {(position.x1safeInPool / 1000).toLocaleString()} X1SAFE
            </div>
          </div>

          {/* Position Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailCard
              icon={<Wallet className="w-5 h-5" />}
              label="Deposited"
              value={`${position.depositedAmount.toLocaleString()} ${token.symbol}`}
              color="text-emerald-400"
            />
            <DetailCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="X1SAFE Minted"
              value={position.x1safeInPool.toLocaleString()}
              color="text-indigo-400"
            />
            <DetailCard
              icon={<Clock className="w-5 h-5" />}
              label="Days in Pool"
              value={`${daysHeld} days`}
              color="text-blue-400"
            />
            <DetailCard
              icon={<CalendarIcon />}
              label="Deposit Date"
              value={depositDate}
              color="text-purple-400"
            />
          </div>

          {/* Token Info */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <h3 className="font-medium text-white mb-3">Token Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Token</span>
                <span className="text-white">{token.name} ({token.symbol})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Decimals</span>
                <span className="text-white">{token.decimals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mint</span>
                <span className="text-white font-mono text-xs">
                  {token.mint.toString().slice(0, 8)}...{token.mint.toString().slice(-4)}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* History View */
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transaction history yet</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      item.type === 'deposit' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    }`}>
                      {item.type === 'deposit' ? (
                        <TrendingDown className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white capitalize">{item.type}</div>
                      <div className="text-sm text-gray-400">{item.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {item.type === 'deposit' ? '-' : '+'}{item.amount} {item.token}
                    </div>
                    <a 
                      href={`${network === 'mainnet' ? 'https://explorer.mainnet.x1.xyz' : 'https://explorer.x1-devnet.xen.network'}/tx/${item.tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {item.tx}
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Position Status Alert */}
      <div className={`p-4 rounded-xl border ${
        position.isInPool 
          ? 'bg-emerald-500/10 border-emerald-500/20' 
          : 'bg-amber-500/10 border-amber-500/20'
      }`}>
        <div className="flex gap-3">
          <AlertCircle className={`w-5 h-5 ${
            position.isInPool ? 'text-emerald-400' : 'text-amber-400'
          }`} />
          <div>
            <h4 className={`font-medium ${
              position.isInPool ? 'text-emerald-200' : 'text-amber-200'
            }`}>
              Position Status: {position.isInPool ? 'In Pool' : 'Withdrawn'}
            </h4>
            <p className={`text-sm mt-1 ${
              position.isInPool ? 'text-emerald-300' : 'text-amber-300'
            }`}>
              {position.isInPool 
                ? 'Your X1SAFE is soulbound and earning. You can exit anytime to retrieve your original deposit.'
                : 'Your X1SAFE has been withdrawn from the pool and is now transferable. You cannot exit to retrieve your original deposit.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ icon, label, value, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color: string;
}) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="font-semibold text-white mt-1">{value}</div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
