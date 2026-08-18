// src/components/NetworkSelector.tsx

import React from 'react';

interface Network {
  id: string;
  name: string;
  icon: string;
  pairs: string;
  color: string;
}

interface NetworkSelectorProps {
  selectedNetworks: string[];
  onNetworkChange: (networks: string[]) => void;
}

const NETWORKS: Network[] = [
  // ============ الشبكات الرئيسية ============
  { id: 'solana', name: 'Solana', icon: '🟣', pairs: '15,000+', color: 'border-purple-500' },
  { id: 'ethereum', name: 'Ethereum', icon: '🔵', pairs: '8,000+', color: 'border-blue-500' },
  { id: 'bsc', name: 'BSC', icon: '🟡', pairs: '12,000+', color: 'border-yellow-500' },
  { id: 'base', name: 'Base', icon: '🔷', pairs: '2,500+', color: 'border-sky-500' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔷', pairs: '3,000+', color: 'border-indigo-500' },
  { id: 'polygon', name: 'Polygon', icon: '🟣', pairs: '5,000+', color: 'border-purple-600' },
  { id: 'avalanche', name: 'Avalanche', icon: '🔴', pairs: '4,000+', color: 'border-red-500' },
  { id: 'optimism', name: 'Optimism', icon: '🔴', pairs: '2,000+', color: 'border-red-400' },

  // ============ الشبكات الجديدة ============
  { id: 'robinhood', name: 'Robinhood', icon: '🦊', pairs: '2,500+', color: 'border-orange-500' },
  { id: 'ronin', name: 'Ronin', icon: '⚔️', pairs: '2,000+', color: 'border-emerald-500' },
  { id: 'sui', name: 'Sui', icon: '🌊', pairs: '1,500+', color: 'border-blue-400' },
  { id: 'ton', name: 'TON', icon: '💎', pairs: '1,200+', color: 'border-blue-300' },
  { id: 'pulsechain', name: 'PulseChain', icon: '⚡', pairs: '1,200+', color: 'border-blue-400' },
  { id: 'worldchain', name: 'World Chain', icon: '🌍', pairs: '800+', color: 'border-cyan-400' },
  { id: 'hyperevm', name: 'HyperEVM', icon: '🚀', pairs: '600+', color: 'border-purple-400' },
  { id: 'mantle', name: 'Mantle', icon: '🛡️', pairs: '900+', color: 'border-gray-500' },
  { id: 'cronos', name: 'Cronos', icon: '⚡', pairs: '700+', color: 'border-blue-700' },
  { id: 'monad', name: 'Monad', icon: '🔵', pairs: '500+', color: 'border-green-400' },
  { id: 'hyperliquid', name: 'Hyperliquid', icon: '💧', pairs: '400+', color: 'border-indigo-400' },
  { id: 'abstract', name: 'Abstract', icon: '🎨', pairs: '300+', color: 'border-teal-400' },
  { id: 'tron', name: 'Tron', icon: '🔴', pairs: '1,500+', color: 'border-red-500' },
  { id: 'sonic', name: 'Sonic', icon: '🎵', pairs: '400+', color: 'border-yellow-500' },
  { id: 'hedera', name: 'Hedera', icon: '🌿', pairs: '600+', color: 'border-green-500' },
  { id: 'near', name: 'NEAR', icon: '🟢', pairs: '500+', color: 'border-green-500' },
  { id: 'multiversx', name: 'MultiversX', icon: '🌌', pairs: '300+', color: 'border-cyan-400' },
  { id: 'zksync', name: 'zkSync', icon: '🟪', pairs: '800+', color: 'border-purple-400' },
  { id: 'linea', name: 'Linea', icon: '⬛', pairs: '600+', color: 'border-gray-500' },
  { id: 'fantom', name: 'Fantom', icon: '🔷', pairs: '1,000+', color: 'border-blue-400' },
  { id: 'icp', name: 'ICP', icon: '🟣', pairs: '400+', color: 'border-purple-700' },
  { id: 'algorand', name: 'Algorand', icon: '🔷', pairs: '500+', color: 'border-blue-300' },
  { id: 'polkadot', name: 'Polkadot', icon: '🔴', pairs: '600+', color: 'border-red-600' },
  { id: 'aptos', name: 'Aptos', icon: '🟣', pairs: '400+', color: 'border-purple-500' },
  { id: 'celo', name: 'Celo', icon: '🟢', pairs: '300+', color: 'border-green-400' },
  { id: 'blast', name: 'Blast', icon: '💥', pairs: '500+', color: 'border-yellow-500' },
  { id: 'scroll', name: 'Scroll', icon: '📜', pairs: '300+', color: 'border-blue-300' },
  { id: 'injective', name: 'Injective', icon: '🔷', pairs: '400+', color: 'border-cyan-400' },
  { id: 'beam', name: 'Beam', icon: '🔦', pairs: '200+', color: 'border-green-300' },
  { id: 'taiko', name: 'Taiko', icon: '🥁', pairs: '200+', color: 'border-red-400' },
  { id: 'sei', name: 'Sei V2', icon: '🌀', pairs: '300+', color: 'border-purple-600' },
  { id: 'opbnb', name: 'opBNB', icon: '🟡', pairs: '800+', color: 'border-yellow-400' },
  { id: 'starknet', name: 'Starknet', icon: '⭐', pairs: '300+', color: 'border-red-400' },
  { id: 'unichain', name: 'Unichain', icon: '🦄', pairs: '200+', color: 'border-pink-500' },
  { id: 'cardano', name: 'Cardano', icon: '🔷', pairs: '400+', color: 'border-blue-600' },
];

export function NetworkSelector({ selectedNetworks, onNetworkChange }: NetworkSelectorProps) {
  const totalPairs = selectedNetworks.reduce((acc, id) => {
    const network = NETWORKS.find((n) => n.id === id);
    const pairs = network ? parseInt(network.pairs.replace(/,/g, '')) : 0;
    return acc + pairs;
  }, 0);

  const toggleNetwork = (id: string) => {
    if (selectedNetworks.includes(id)) {
      if (selectedNetworks.length === 1) return;
      onNetworkChange(selectedNetworks.filter((n) => n !== id));
    } else {
      onNetworkChange([...selectedNetworks, id]);
    }
  };

  const selectAll = () => {
    onNetworkChange(NETWORKS.map((n) => n.id));
  };

  const clearAll = () => {
    onNetworkChange([NETWORKS[0].id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            🌐 اختيار الشبكات
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            اختر شبكة واحدة أو أكثر ليعمل البوت عليها
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            الكل
          </button>
          <button
            onClick={clearAll}
            className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            مسح
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {NETWORKS.map((network) => {
          const isSelected = selectedNetworks.includes(network.id);
          return (
            <button
              key={network.id}
              onClick={() => toggleNetwork(network.id)}
              className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? `${network.color} bg-opacity-10 bg-${network.color.split('-')[1]}-50 dark:bg-opacity-20 shadow-md`
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{network.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{network.name}</div>
                  <div className="text-xs text-gray-400">{network.pairs}</div>
                </div>
                {isSelected && <span className="text-green-500 text-sm">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedNetworks.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              ✅ {selectedNetworks.length} شبكة محددة
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              📊 {totalPairs.toLocaleString()} زوج تداول
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {selectedNetworks.map((id) => {
              const network = NETWORKS.find((n) => n.id === id);
              return network ? (
                <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                  {network.icon} {network.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}