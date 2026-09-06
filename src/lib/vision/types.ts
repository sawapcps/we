// src/lib/vision/types.ts
// ============================================================
// 📋 أنواع وكيل التداول البصري
// ============================================================

export interface DiscoveredToken {
  address: string;
  chain: string;
  symbol?: string;
  name?: string;
  source: 'google' | 'twitter' | 'reddit';
  foundAt: string;
}

export interface VisualAnalysis {
  shouldBuy: boolean;
  confidence: number;
  reason: string;
  volume: number;
  liquidity: number;
  priceChange: number;
  hasZombie: boolean;
  isHoneypot: boolean;
  contractVerified: boolean;
}

export interface TradeExecution {
  success: boolean;
  txHash?: string;
  error?: string;
  chain: string;
  amount: number;
  tokenAddress: string;
  executedAt: string;
}

export interface VisionBotConfig {
  enabled: boolean;
  checkInterval: number;
  maxAmountPerTrade: number;
  minConfidence: number;
  autoExecute: boolean;
  maxTradesPerDay: number;
  chains: string[];
  searchQueries: string[];
  notificationEnabled: boolean;
}

export interface VisionBotState {
  isRunning: boolean;
  lastScan: Date | null;
  discoveredTokens: DiscoveredToken[];
  executedTrades: TradeExecution[];
  currentAnalysis: VisualAnalysis | null;
}
