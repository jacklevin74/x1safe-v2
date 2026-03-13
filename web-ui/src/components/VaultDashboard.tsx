import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { DepositPanel } from './DepositPanel';
import { ExitPanel } from './ExitPanel';
import { WithdrawPanel } from './WithdrawPanel';
import { PositionPanel } from './PositionPanel';
import { VaultStats } from './VaultStats';

type Tab = 'deposit' | 'exit' | 'withdraw' | 'position';

interface VaultDashboardProps {
  network: 'mainnet' | 'devnet';
}

export function VaultDashboard({ network }: VaultDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
          <Wallet className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white text-center">Connect Your Wallet</h2>
          <p className="text-gray-400 text-center mt-2 max-w-md">
            Connect your X1 wallet to deposit tokens, manage your position, 
            and interact with the X1SAFE vault.
          </p>
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-500">
              Supported wallets: Phantom, Solflare
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'deposit' as Tab, label: 'Deposit', color: 'from-emerald-500 to-teal-600' },
    { id: 'exit' as Tab, label: 'Exit', color: 'from-amber-500 to-orange-600' },
    { id: 'withdraw' as Tab, label: 'Withdraw', color: 'from-purple-500 to-pink-600' },
    { id: 'position' as Tab, label: 'My Position', color: 'from-blue-500 to-indigo-600' }
  ];

  return (
    <div className="space-y-6">
      {/* Vault Stats Overview */}
      <VaultStats network={network} />

      {/* Tab Navigation */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-2 border border-white/10">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-indigo-500/25`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
        {activeTab === 'deposit' && <DepositPanel network={network} />}
        {activeTab === 'exit' && <ExitPanel network={network} />}
        {activeTab === 'withdraw' && <WithdrawPanel network={network} />}
        {activeTab === 'position' && <PositionPanel network={network} />}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          title="🔒 Soulbound in Pool"
          description="X1SAFE tokens are soulbound while in the pool. They cannot be transferred but can be redeemed via Exit."
        />
        <InfoCard
          title="📤 Exit vs Withdraw"
          description="Exit burns X1SAFE and returns your original deposit. Withdraw moves X1SAFE out of pool, making it transferable."
        />
        <InfoCard
          title="💰 Exchange Rate"
          description="Fixed rate: 1 X1SAFE = 0.001 USDC.X. Other tokens use oracle prices to calculate equivalent X1SAFE amount."
        />
      </div>

      {/* X / Twitter Follow Button */}
      <div className="flex justify-center">
        <a
          href="https://x.com/X1SafeVault"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 px-8 py-4 bg-black border border-white/20 rounded-2xl text-white font-semibold text-base hover:bg-white/10 hover:border-white/40 hover:scale-105 transition-all duration-200 shadow-lg shadow-black/30"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-black group-hover:bg-gray-100 transition-colors">
            <XIcon />
          </span>
          <span>Follow <span className="text-gray-300">@X1SafeVault</span> on X</span>
          <span className="ml-1 text-gray-400 text-sm">→</span>
        </a>
      </div>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
