import React, { useState, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { Toaster } from 'react-hot-toast';
import { Shield, Network } from 'lucide-react';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { NETWORKS } from './constants';
import { VaultDashboard } from './components/VaultDashboard';
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<'mainnet' | 'devnet'>('devnet');
  
  const network = useMemo(() => 
    selectedNetwork === 'mainnet' 
      ? WalletAdapterNetwork.Mainnet 
      : WalletAdapterNetwork.Devnet,
    [selectedNetwork]
  );
  
  const endpoint = useMemo(() => NETWORKS[selectedNetwork].endpoint, [selectedNetwork]);
  
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen">
            <Toaster 
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1a1a2e',
                  color: '#e0e0e0',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }
              }}
            />
            
            {/* Header */}
            <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-white">X1SAFE V2</h1>
                      <p className="text-sm text-gray-400">Multi-Token Vault</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* X / Twitter Link */}
                    <a
                      href="https://x.com/X1SafeVault"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="@X1SafeVault on X"
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-sm"
                    >
                      <XIcon />
                      <span className="hidden sm:inline text-xs font-medium">@X1SafeVault</span>
                    </a>

                    {/* Network Selector */}
                    <div className="relative">
                      <Network className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={selectedNetwork}
                        onChange={(e) => setSelectedNetwork(e.target.value as 'mainnet' | 'devnet')}
                        className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="devnet">🔧 X1 Devnet</option>
                        <option value="mainnet">🌐 X1 Mainnet</option>
                      </select>
                    </div>
                    
                    <WalletMultiButton />
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <VaultDashboard network={selectedNetwork} />
            </main>

            {/* Footer */}
            <footer className="mt-auto py-6 border-t border-white/10">
              <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
                <p>X1SAFE V2 - Secure Multi-Token Vault on X1 Blockchain</p>
                <p className="mt-1">
                  Current: {NETWORKS[selectedNetwork].endpoint}
                </p>
                <a
                  href="https://x.com/X1SafeVault"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-gray-500 hover:text-white transition-colors"
                >
                  <XIcon />
                  <span>@X1SafeVault</span>
                </a>
              </div>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
