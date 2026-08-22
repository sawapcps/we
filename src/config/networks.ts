// src/config/networks.ts

export interface NetworkConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  nativeToken: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
  };
  rpcUrl?: string;
  chainId?: number;
}

// ✅ العملات الأساسية لكل شبكة
export const NATIVE_TOKENS: Record<string, { symbol: string; name: string; address: string; decimals: number }> = {
  solana: { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  ethereum: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  bsc: { symbol: 'BNB', name: 'BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
  polygon: { symbol: 'POL', name: 'Polygon', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  arbitrum: { symbol: 'ETH', name: 'Arbitrum ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  base: { symbol: 'ETH', name: 'Base ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  avalanche: { symbol: 'AVAX', name: 'Avalanche', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  optimism: { symbol: 'ETH', name: 'Optimism ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  robinhood: { symbol: 'ETH', name: 'Robinhood ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
};

export const NETWORKS: NetworkConfig[] = [
  {
    id: 'solana',
    name: 'Solana',
    icon: '🟣',
    color: '#9945FF',
    nativeToken: { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    icon: '🔵',
    color: '#627EEA',
    nativeToken: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 1,
  },
  {
    id: 'bsc',
    name: 'BNB Chain',
    icon: '🟡',
    color: '#F0B90B',
    nativeToken: { symbol: 'BNB', name: 'BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
    chainId: 56,
  },
  {
    id: 'polygon',
    name: 'Polygon',
    icon: '🟣',
    color: '#8247E5',
    nativeToken: { symbol: 'POL', name: 'Polygon', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 137,
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    icon: '🔷',
    color: '#2D374B',
    nativeToken: { symbol: 'ETH', name: 'Arbitrum ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 42161,
  },
  {
    id: 'base',
    name: 'Base',
    icon: '🔷',
    color: '#0052FF',
    nativeToken: { symbol: 'ETH', name: 'Base ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 8453,
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    icon: '🔴',
    color: '#E84142',
    nativeToken: { symbol: 'AVAX', name: 'Avalanche', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 43114,
  },
  {
    id: 'optimism',
    name: 'Optimism',
    icon: '🔴',
    color: '#FF0420',
    nativeToken: { symbol: 'ETH', name: 'Optimism ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 10,
  },
  {
    id: 'robinhood',
    name: 'Robinhood',
    icon: '🟢',
    color: '#00C805',
    nativeToken: { symbol: 'ETH', name: 'Robinhood ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    chainId: 1,
  },
];

export function getNetworkName(id: string): string {
  return NETWORKS.find(n => n.id === id)?.name || id;
}

export function getNetworkColor(id: string): string {
  return NETWORKS.find(n => n.id === id)?.color || '#888';
}

export function getNetworkIcon(id: string): string {
  return NETWORKS.find(n => n.id === id)?.icon || '🌐';
}

export function getNativeToken(network: string) {
  return NATIVE_TOKENS[network] || NATIVE_TOKENS.solana;
}

export function getNetworkByChainId(chainId: number): NetworkConfig | undefined {
  return NETWORKS.find(n => n.chainId === chainId);
}