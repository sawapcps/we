// src/types/index.ts

export type ChainId =
  // ============ الشبكات الرئيسية ============
  | 'solana'
  | 'ethereum'
  | 'bsc'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'avalanche'
  | 'optimism'
  // ============ الشبكات الجديدة (من Watchlist) ============
  | 'robinhood'
  | 'ronin'
  | 'sui'
  | 'ton'
  | 'pulsechain'
  | 'worldchain'
  | 'hyperevm'
  | 'mantle'
  | 'cronos'
  | 'monad'
  | 'hyperliquid'
  | 'abstract'
  | 'tron'
  | 'sonic'
  | 'hedera'
  | 'ink'
  | 'berachain'
  | 'near'
  | 'multiversx'
  | 'zksync'
  | 'linea'
  | 'plasma'
  | 'fantom'
  | 'icp'
  | 'megaeeth'
  | 'algorand'
  | 'polkadot'
  | 'sei'
  | 'opbnb'
  | 'apechain'
  | 'flare'
  | 'aptos'
  | 'flow'
  | 'soneium'
  | 'starknet'
  | 'celo'
  | 'unichain'
  | 'blast'
  | 'metis'
  | 'cardano'
  | 'stacks'
  | 'conflux'
  | 'harmony'
  | 'story'
  | 'kava'
  | 'scroll'
  | 'dogechain'
  | 'injective'
  | 'venom'
  | 'beam'
  | 'taiko'
  | 'movement'
  | 'vana'
  | 'zkfair'
  | 'neon'
  | 'mode'
  | 'moonriver'
  | 'fuse';

export interface NetworkOption {
  id: ChainId;
  name: string;
  shortName: string;
  color: string;
  dexId: string;
  enabled: boolean;
}

export interface TokenPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels: string[] | null;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string | null;
  txns: Record<string, { buys: number; sells: number }>;
  volume: Record<string, number>;
  priceChange: Record<string, number> | null;
  liquidity: { usd: number; base: number; quote: number } | null;
  fdv: number | null;
  marketCap: number | null;
  pairCreatedAt: number | null;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { platform: string; handle: string }[];
  };
  boosts?: { active: number };
}

export type BotMode = 'auto' | 'manual';
export type BotStatus = 'running' | 'paused' | 'stopped';
export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'executed' | 'pending' | 'failed';

export interface Trade {
  id: string;
  timestamp: number;
  network: ChainId;
  tokenSymbol: string;
  tokenAddress: string;
  pairAddress: string;
  side: TradeSide;
  amountUsd: number;
  priceUsd: number;
  quantity: number;
  status: TradeStatus;
  reason: string;
  pnl?: number;
  txHash?: string;
}

export interface BotConfig {
  mode: BotMode;
  status: BotStatus;
  networks: ChainId[];
  minLiquidityUsd: number;
  minVolume24h: number;
  minPriceChange24h: number;
  maxPositionUsd: number;
  takeProfitPct: number;
  stopLossPct: number;
  tradeIntervalSec: number;
  autoSell: boolean;
  aiAssist: boolean;
}

export interface WalletAsset {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  network: ChainId;
  address: string;
}

export interface WalletTransaction {
  id: string;
  timestamp: number;
  type: 'deposit' | 'withdraw' | 'trade' | 'swap';
  symbol: string;
  amount: number;
  usdValue: number;
  txHash: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface WalletState {
  address: string;
  encryptedKey: string;
  assets: WalletAsset[];
  transactions: WalletTransaction[];
  totalUsd: number;
}

export interface AIAnalysis {
  id?: string;
  tokenSymbol: string;
  network: ChainId;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  summary: string;
  signals: { label: string; value: string; bullish: boolean }[];
  priceTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface BotLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export type TokenStatus = 'candidate' | 'watch' | 'reject';

export interface DiscoveredToken {
  chainId: ChainId;
  tokenAddress: string;
  name: string;
  symbol: string;
  bestPair: TokenPair;
  allPairs: TokenPair[];
  priceUsd: number;
  volume24h: number;
  liquidityUsd: number;
  marketCap: number | null;
  fdv: number | null;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  txns24h: { buys: number; sells: number };
  pairAge: number | null;
  pairCreatedAt: number | null;
  dexId: string;
  pairAddress: string;
  boosts: number;
  score: number;
  status: TokenStatus;
  securityFlags: string[];
  source: 'dexscreener' | 'geckoterminal' | 'merged';
  strategy: 'new-listing' | 'momentum' | 'established';
}

export interface PipelineStats {
  totalPairs: number;
  uniqueTokens: number;
  afterSecurity: number;
  afterLiquidity: number;
  afterVolume: number;
  candidates: number;
  watchlist: number;
  rejected: number;
  lastUpdate: number | null;
  error: string | null;
}