import React from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { TrendingUp, Users, Coins, Shield } from 'lucide-react';
import { TOKENS } from '../constants';

interface VaultStatsProps {
  network: 'mainnet' | 'devnet';
}

export function VaultStats({ network }: VaultStatsProps) {
  // Mock stats - in production, fetch from contract
  const stats = {
    tvl: 2450000,
    totalDepositors: 142,
    totalX1safeMinted: 2450000000,
    supportedTokens: Object.keys(TOKENS).length
  };

  const formatTVL = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
        label="Total Value Locked"
        value={formatTVL(stats.tvl)}
        change="+12.5%"
        positive={true}
      />
      <StatCard
        icon={<Users className="w-5 h-5 text-blue-400" />}
        label="Total Depositors"
        value={stats.totalDepositors.toString()}
        change="+8"
        positive={true}
      />
      <StatCard
        icon={<Coins className="w-5 h-5 text-amber-400" />}
        label="X1SAFE Minted"
        value={`${(stats.totalX1safeMinted / 1000000).toFixed(2)}M`}
        change="Total supply"
        positive={null}
      />
      <StatCard
        icon={<Shield className="w-5 h-5 text-purple-400" />}
        label="Supported Tokens"
        value={stats.supportedTokens.toString()}
        change="Multi-token"
        positive={null}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  positive: boolean | null;
}

function StatCard({ icon, label, value, change, positive }: StatCardProps) {
  return (
    <div className="p-4 bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className={`text-xs mt-1 ${
        positive === true ? 'text-emerald-400' : 
        positive === false ? 'text-red-400' : 
        'text-gray-500'
      }`}>
        {change}
      </div>
    </div>
  );
}
