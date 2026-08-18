// src/config/networks.ts

import type { NetworkOption, ChainId } from '@/types';

export const NETWORKS: NetworkOption[] = [
  // ============ الشبكات الرئيسية (مفعلة) ============
  { id: 'solana', name: 'Solana', shortName: 'SOL', color: '#14F195', dexId: 'raydium', enabled: true },
  { id: 'ethereum', name: 'Ethereum', shortName: 'ETH', color: '#627EEA', dexId: 'uniswap_v3', enabled: true },
  { id: 'bsc', name: 'BNB Smart Chain', shortName: 'BSC', color: '#F3BA2F', dexId: 'pancakeswap', enabled: true },
  { id: 'base', name: 'Base', shortName: 'BASE', color: '#0052FF', dexId: 'aerodrome', enabled: true },
  { id: 'arbitrum', name: 'Arbitrum', shortName: 'ARB', color: '#28A0F0', dexId: 'uniswap_v3', enabled: true },
  { id: 'polygon', name: 'Polygon', shortName: 'MATIC', color: '#8247E5', dexId: 'quickswap', enabled: true },
  { id: 'avalanche', name: 'Avalanche', shortName: 'AVAX', color: '#E84142', dexId: 'trader_joe', enabled: true },
  { id: 'optimism', name: 'Optimism', shortName: 'OP', color: '#FF0420', dexId: 'uniswap_v3', enabled: true },

  // ============ الشبكات الجديدة (من Watchlist) ============
  { id: 'robinhood', name: 'Robinhood', shortName: 'HOOD', color: '#FF4500', dexId: 'robinswap', enabled: true },
  { id: 'ronin', name: 'Ronin', shortName: 'RON', color: '#0A8F5C', dexId: 'katana', enabled: true },
  { id: 'sui', name: 'Sui', shortName: 'SUI', color: '#4DA2FF', dexId: 'cetus', enabled: true },
  { id: 'ton', name: 'TON', shortName: 'TON', color: '#0098EA', dexId: 'dedust', enabled: true },
  { id: 'pulsechain', name: 'PulseChain', shortName: 'PLS', color: '#00A3FF', dexId: 'pulsex', enabled: true },
  { id: 'worldchain', name: 'World Chain', shortName: 'WLD', color: '#00B4D8', dexId: 'aerodrome', enabled: true },
  { id: 'hyperevm', name: 'HyperEVM', shortName: 'HYPE', color: '#8B5CF6', dexId: 'hyperswap', enabled: true },
  { id: 'mantle', name: 'Mantle', shortName: 'MNT', color: '#000000', dexId: 'mantleswap', enabled: true },
  { id: 'cronos', name: 'Cronos', shortName: 'CRO', color: '#002D74', dexId: 'cronoswap', enabled: true },
  { id: 'monad', name: 'Monad', shortName: 'MON', color: '#00FF87', dexId: 'monadswap', enabled: true },
  { id: 'hyperliquid', name: 'Hyperliquid', shortName: 'HYPE', color: '#6366F1', dexId: 'hyperliquid', enabled: true },
  { id: 'abstract', name: 'Abstract', shortName: 'ABS', color: '#00BFA5', dexId: 'abstractswap', enabled: true },
  { id: 'tron', name: 'Tron', shortName: 'TRX', color: '#EF4444', dexId: 'sunswap', enabled: true },
  { id: 'sonic', name: 'Sonic', shortName: 'SONIC', color: '#F59E0B', dexId: 'sonicswap', enabled: true },
  { id: 'hedera', name: 'Hedera', shortName: 'HBAR', color: '#00A3FF', dexId: 'saucerswap', enabled: true },
  { id: 'ink', name: 'Ink', shortName: 'INK', color: '#000000', dexId: 'inkswap', enabled: true },
  { id: 'berachain', name: 'Berachain', shortName: 'BERA', color: '#F5A623', dexId: 'beraswap', enabled: true },
  { id: 'near', name: 'NEAR', shortName: 'NEAR', color: '#000000', dexId: 'ref_finance', enabled: true },
  { id: 'multiversx', name: 'MultiversX', shortName: 'EGLD', color: '#23F7DD', dexId: 'xexchange', enabled: true },
  { id: 'zksync', name: 'zkSync', shortName: 'ZK', color: '#8A2BE2', dexId: 'syncswap', enabled: true },
  { id: 'linea', name: 'Linea', shortName: 'LINEA', color: '#121212', dexId: 'lynex', enabled: true },
  { id: 'plasma', name: 'Plasma', shortName: 'PLASMA', color: '#7B61FF', dexId: 'plasmaswap', enabled: true },
  { id: 'fantom', name: 'Fantom', shortName: 'FTM', color: '#1969FF', dexId: 'spookyswap', enabled: true },
  { id: 'icp', name: 'ICP', shortName: 'ICP', color: '#3B00B9', dexId: 'icpswap', enabled: true },
  { id: 'megaeeth', name: 'MegaETH', shortName: 'MEGA', color: '#FF6B6B', dexId: 'megaswap', enabled: true },
  { id: 'algorand', name: 'Algorand', shortName: 'ALGO', color: '#000000', dexId: 'tinyman', enabled: true },
  { id: 'polkadot', name: 'Polkadot', shortName: 'DOT', color: '#E6007A', dexId: 'hydradx', enabled: true },
  { id: 'sei', name: 'Sei V2', shortName: 'SEI', color: '#8B00FF', dexId: 'seiswap', enabled: true },
  { id: 'opbnb', name: 'opBNB', shortName: 'opBNB', color: '#F3BA2F', dexId: 'pancakeswap', enabled: true },
  { id: 'apechain', name: 'ApeChain', shortName: 'APE', color: '#0066FF', dexId: 'apeswap', enabled: true },
  { id: 'flare', name: 'Flare', shortName: 'FLR', color: '#FF6B00', dexId: 'flareswap', enabled: true },
  { id: 'aptos', name: 'Aptos', shortName: 'APT', color: '#00B4D8', dexId: 'liquidswap', enabled: true },
  { id: 'flow', name: 'Flow EVM', shortName: 'FLOW', color: '#00EF8B', dexId: 'flowswap', enabled: true },
  { id: 'soneium', name: 'Soneium', shortName: 'SON', color: '#FF6B35', dexId: 'soneiumswap', enabled: true },
  { id: 'starknet', name: 'Starknet', shortName: 'STRK', color: '#FF6B6B', dexId: 'jedi', enabled: true },
  { id: 'celo', name: 'Celo', shortName: 'CELO', color: '#35D07F', dexId: 'ubeswap', enabled: true },
  { id: 'unichain', name: 'Unichain', shortName: 'UNI', color: '#FF007A', dexId: 'uniswap_v3', enabled: true },
  { id: 'blast', name: 'Blast', shortName: 'BLAST', color: '#FFD700', dexId: 'blastexchange', enabled: true },
  { id: 'metis', name: 'Metis', shortName: 'METIS', color: '#00D4FF', dexId: 'netswap', enabled: true },
  { id: 'cardano', name: 'Cardano', shortName: 'ADA', color: '#0033AD', dexId: 'sundae', enabled: true },
  { id: 'stacks', name: 'Stacks', shortName: 'STX', color: '#4A4A4A', dexId: 'alex', enabled: true },
  { id: 'conflux', name: 'Conflux', shortName: 'CFX', color: '#FF6B00', dexId: 'swappi', enabled: true },
  { id: 'harmony', name: 'Harmony', shortName: 'ONE', color: '#00AEEF', dexId: 'viperswap', enabled: true },
  { id: 'story', name: 'Story', shortName: 'STORY', color: '#FF6B6B', dexId: 'storyswap', enabled: true },
  { id: 'kava', name: 'Kava', shortName: 'KAVA', color: '#FF4500', dexId: 'kavaswap', enabled: true },
  { id: 'scroll', name: 'Scroll', shortName: 'SCR', color: '#00B4D8', dexId: 'scrollswap', enabled: true },
  { id: 'dogechain', name: 'Dogechain', shortName: 'DC', color: '#C2A633', dexId: 'dogeswap', enabled: true },
  { id: 'injective', name: 'Injective', shortName: 'INJ', color: '#00F2FE', dexId: 'injective', enabled: true },
  { id: 'venom', name: 'Venom', shortName: 'VENOM', color: '#00BFA5', dexId: 'venomswap', enabled: true },
  { id: 'beam', name: 'Beam', shortName: 'BEAM', color: '#00FF87', dexId: 'beamswap', enabled: true },
  { id: 'taiko', name: 'Taiko', shortName: 'TAI', color: '#E8183C', dexId: 'taikoswap', enabled: true },
  { id: 'movement', name: 'Movement', shortName: 'MOVE', color: '#FF6B6B', dexId: 'movementswap', enabled: true },
  { id: 'vana', name: 'Vana', shortName: 'VANA', color: '#7C3AED', dexId: 'vanaswap', enabled: true },
  { id: 'zkfair', name: 'ZKFair', shortName: 'ZKF', color: '#8B5CF6', dexId: 'zkfairswap', enabled: true },
  { id: 'neon', name: 'Neon EVM', shortName: 'NEON', color: '#00FF87', dexId: 'neonswap', enabled: true },
  { id: 'mode', name: 'Mode', shortName: 'MODE', color: '#0066FF', dexId: 'modeswap', enabled: true },
  { id: 'moonriver', name: 'Moonriver', shortName: 'MOVR', color: '#F2B807', dexId: 'solarbeam', enabled: true },
  { id: 'fuse', name: 'Fuse', shortName: 'FUSE', color: '#00B4D8', dexId: 'fuseswap', enabled: true },
];

export const DEFAULT_NETWORKS: ChainId[] = [
  'solana',
  'ethereum',
  'bsc',
  'base',
  'arbitrum',
  'polygon',
  'avalanche',
  'robinhood',
];

export function getNetwork(id: ChainId): NetworkOption | undefined {
  return NETWORKS.find((n) => n.id === id);
}

export function getNetworkColor(id: ChainId): string {
  return getNetwork(id)?.color ?? '#6B7280';
}

export function getNetworkName(id: ChainId): string {
  return getNetwork(id)?.name ?? id;
}

export function getEnabledNetworks(): NetworkOption[] {
  return NETWORKS.filter((n) => n.enabled);
}

export function getNetworkDexId(id: ChainId): string {
  return getNetwork(id)?.dexId ?? 'unknown';
}

export function getNetworkByDexId(dexId: string): NetworkOption | undefined {
  return NETWORKS.find((n) => n.dexId === dexId);
}