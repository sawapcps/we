// src/lib/hunterEngine.ts
// ============================================================
// ?? ÂÕ—„ «‰ Õ‰Í‰ «‰Â ◊Ë— - «‰Ê”Œ… «‰ÂŸœ‰… (»œËÊ Birdeye)
// ? ÍœŸÂ 4 »Ë « : Hunter, Signal, Manual, Scalper
// ? Í” ŒœÂ DexScreener + Worker „Â’«œ— »Í«Ê« 
// ? ÍœŸÂ „‘· " ÕËÂ" «‰ÂÕ«·ÿ «‰–„Í…
// ? ÍœŸÂ  Õ‰Í‰ «‰ÕÍ «Ê Ë«‰Â œ«Ë‰ÍÊ «‰√–„Í«¡
// ?  Â ≈“«‰… «‰«Ÿ Â«œ Ÿ‰È Birdeye »«‰„«Â‰
// ============================================================

import type { TokenPair, ChainId, DiscoveredToken, TokenStatus, PipelineStats } from '@/types';

// ============================================================
// ?? ≈Ÿœ«œ«  „‰ »Ë 
// ============================================================

export interface BaseBotConfig {
  botType: 'hunter' | 'signal' | 'manual' | 'scalper';
  minLiquidityUsd: number;
  minVolume24h: number;
  minScore: number;
  maxPositionUsd: number;
  takeProfitPct: number;
  stopLossPct: number;
  networks: ChainId[];
}

export interface HunterConfig extends BaseBotConfig {
  botType: 'hunter';
  minAgeHours?: number;
  maxAgeHours?: number;
  minSmartWallets: number;
  smartWalletConfidence: number;
  allowNewListings: boolean;
  minBuyRatio: number;
  minWhales?: number;
  minSnipers?: number;
  maxTop10Percent?: number;
  enableWhaleFilter?: boolean;
}

export interface SignalConfig extends BaseBotConfig {
  botType: 'signal';
  indicatorType: 'rsi' | 'stochastic' | 'macd' | 'combined';
  rsiOversold: number;
  rsiOverbought: number;
  minPriceChange1h: number;
  minPriceChange24h: number;
  useSmartWalletConfirmation: boolean;
}

export interface ManualConfig extends BaseBotConfig {
  botType: 'manual';
  displayAllCandidates: boolean;
  showDetailedAnalysis: boolean;
}

export interface ScalperConfig extends BaseBotConfig {
  botType: 'scalper';
  targetToken: string;
  targetTokenAddress: string;
  amountPerTrade: number;
  maxOpenTrades: number;
  buyThreshold: number;
  trailingStop: number;
  maxTradeDurationHours: number;
  minTradeIntervalMinutes: number;
}

export type BotAnalysisConfig = HunterConfig | SignalConfig | ManualConfig | ScalperConfig;

// ============================================================
// ?? Ê ÍÃ… «‰ Õ‰Í‰ ‰„‰ »Ë 
// ============================================================

export interface BotAnalysisResult {
  tokens: DiscoveredToken[];
  stats: PipelineStats;
  recommendations: {
    token: DiscoveredToken;
    action: 'BUY' | 'WATCH' | 'REJECT';
    reason: string;
    score: number;
    confidence: number;
  }[];
}

// ============================================================
// ?? Ê ÍÃ…  Õ‰Í‰ «‰ÂÕ«·ÿ «‰–„Í…
// ============================================================

export interface SmartWalletHoveringResult {
  isHovering: boolean;
  score: number;
  level: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  details: {
    smartWalletsCount: number;
    avgWinRate: number;
    totalProfit: number;
    whaleCount: number;
    whaleBuying: boolean;
    buyRatio: number;
    volume24h: number;
    topWallets: { address: string; winRate: number; totalProfit: number }[];
  };
  recommendation: 'buy' | 'watch' | 'reject';
  confidence: number;
}

// ============================================================
// ?? «‰« ’«‰«  ÂŸ «‰‡ Worker Ë APIs
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
const DEXSCREENER_API = 'https://api.dexscreener.com';

// ============================================================
// ?? Ã‰» »Í«Ê«  «‰”Ÿ— «‰ «—ÍŒÍ… (DexScreener ·‚◊)
// ============================================================

export async function fetchPriceHistory(
  tokenAddress: string,
  network: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  limit: number = 100
): Promise<number[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${tokenAddress}`);

    if (!response.ok) {
      throw new Error(`? DexScreener API ·‘‰: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error(`? ‰«  ËÃœ »Í«Ê«  ‰‡ ${tokenAddress}`);
    }

    const prices: number[] = [];
    for (const pair of data.pairs) {
      const price = parseFloat(pair.priceUsd || '0');
      if (price > 0) {
        prices.push(price);
      }
    }

    if (prices.length === 0) {
      throw new Error(`? ‰«  ËÃœ √”Ÿ«— ’«‰Õ… ‰‡ ${tokenAddress}`);
    }

    while (prices.length < limit) {
      const lastPrice = prices[prices.length - 1];
      prices.push(lastPrice);
    }

    return prices.slice(0, limit);

  } catch (error) {
    console.error('? ·‘‰ Ã‰» »Í«Ê«  «‰”Ÿ—:', error);
    throw new Error(`·‘‰ Ã‰» »Í«Ê«  «‰”Ÿ—: ${error instanceof Error ? error.message : 'Œ◊√ ⁄Í— ÂŸ—Ë·'}`);
  }
}

// ============================================================
// ?? Ã‰» «‰ÂÕ«·ÿ «‰–„Í… (ÂÊ Worker)
// ============================================================

export async function fetchSmartWallets(
  tokenAddress: string,
  network: string,
  minCount: number
): Promise<{ wallets: any[]; count: number; totalProfit: number; avgWinRate: number }> {
  try {
    const response = await fetch(`${WORKER_URL}/smart-wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network, minCount }),
    });

    if (!response.ok) {
      throw new Error(`? ·‘‰ Ã‰» «‰ÂÕ«·ÿ «‰–„Í…: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`? Œ◊√ ÂÊ «‰‡ Worker: ${data.error || '⁄Í— ÂŸ—Ë·'}`);
    }

    return {
      wallets: data.wallets || [],
      count: data.wallets?.length || 0,
      totalProfit: data.totalProfit || 0,
      avgWinRate: data.avgWinRate || 0,
    };

  } catch (error) {
    console.error('? ·‘‰ Ã‰» «‰ÂÕ«·ÿ «‰–„Í…:', error);
    return { wallets: [], count: 0, totalProfit: 0, avgWinRate: 0 };
  }
}

// ============================================================
// ?? „‘·  ÕËÂ «‰ÂÕ«·ÿ «‰–„Í…
// ============================================================

export async function detectSmartWalletHovering(
  tokenAddress: string,
  network: string
): Promise<SmartWalletHoveringResult> {
  try {
    // ? 1. Ã‰» «‰ÂÕ«·ÿ «‰–„Í…
    const smartWalletsResponse = await fetch(`${WORKER_URL}/smart-wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network, minCount: 3 }),
    });

    let smartWalletsData = { wallets: [], totalProfit: 0, avgWinRate: 0 };
    if (smartWalletsResponse.ok) {
      const data = await smartWalletsResponse.json();
      if (data.success) {
        smartWalletsData = {
          wallets: data.wallets || [],
          totalProfit: data.totalProfit || 0,
          avgWinRate: data.avgWinRate || 0,
        };
      }
    }

    // ? 2. Ã‰» »Í«Ê«  «‰ÕÍ «Ê
    const whaleResponse = await fetch(`${WORKER_URL}/whale-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network }),
    });

    let whaleData = { whaleCount: 0, largeBuys: 0, largeSells: 0, totalWhaleBalance: 0 };
    if (whaleResponse.ok) {
      const data = await whaleResponse.json();
      if (data.success) {
        whaleData = {
          whaleCount: data.data?.whaleCount || 0,
          largeBuys: data.data?.largeBuys || 0,
          largeSells: data.data?.largeSells || 0,
          totalWhaleBalance: data.data?.totalWhaleBalance || 0,
        };
      }
    }

    // ? 3. Ã‰» »Í«Ê«  «‰”Ë‚
    const dexResponse = await fetch(`${WORKER_URL}/dex-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network }),
    });

    let dexData = { price: 0, volume24h: 0, liquidity: 0, txns: { buys: 0, sells: 0 } };
    if (dexResponse.ok) {
      const data = await dexResponse.json();
      if (data.success) {
        dexData = {
          price: data.data?.price || 0,
          volume24h: data.data?.volume24h || 0,
          liquidity: data.data?.liquidity || 0,
          txns: data.data?.txns || { buys: 0, sells: 0 },
        };
      }
    }

    // ? 4. Õ”«» «‰Ê‚«◊
    let score = 0;
    const smartWalletsCount = smartWalletsData.wallets.length;
    const avgWinRate = smartWalletsData.avgWinRate || 0;
    const totalProfit = smartWalletsData.totalProfit || 0;
    const whaleCount = whaleData.whaleCount || 0;
    const whaleBuying = whaleData.largeBuys > whaleData.largeSells;
    const totalTxns = dexData.txns.buys + dexData.txns.sells || 1;
    const buyRatio = dexData.txns.buys / totalTxns;

    // «‰ÂÕ«·ÿ «‰–„Í…
    if (smartWalletsCount >= 10) score += 30;
    else if (smartWalletsCount >= 5) score += 20;
    else if (smartWalletsCount >= 3) score += 10;
    else if (smartWalletsCount >= 1) score += 5;

    // Â Ë”◊ «‰—»Õ
    if (avgWinRate >= 70) score += 25;
    else if (avgWinRate >= 50) score += 15;
    else if (avgWinRate >= 40) score += 10;
    else if (avgWinRate >= 30) score += 5;

    // «‰√—»«Õ «‰≈ÃÂ«‰Í…
    if (totalProfit >= 100000) score += 20;
    else if (totalProfit >= 50000) score += 15;
    else if (totalProfit >= 10000) score += 10;
    else if (totalProfit >= 5000) score += 5;

    // «‰ÕÍ «Ê
    if (whaleCount >= 5) score += 15;
    else if (whaleCount >= 3) score += 10;
    else if (whaleCount >= 1) score += 5;

    // «‰ÕÍ «Ê  ‘ —Í
    if (whaleBuying) score += 10;

    // Ê”»… «‰‘—«¡
    if (buyRatio >= 0.70) score += 10;
    else if (buyRatio >= 0.60) score += 5;
    else if (buyRatio >= 0.55) score += 3;

    // «‰ÕÃÂ
    if (dexData.volume24h >= 1000000) score += 5;
    else if (dexData.volume24h >= 500000) score += 3;

    // «‰”ÍË‰…
    if (dexData.liquidity >= 500000) score += 5;
    else if (dexData.liquidity >= 100000) score += 3;

    //  ÕœÍœ «‰Â” ËÈ
    let level: 'none' | 'low' | 'medium' | 'high' | 'extreme';
    if (score >= 80) level = 'extreme';
    else if (score >= 60) level = 'high';
    else if (score >= 40) level = 'medium';
    else if (score >= 20) level = 'low';
    else level = 'none';

    // «‰ Ë’Í…
    let recommendation: 'buy' | 'watch' | 'reject';
    let confidence: number;

    if (score >= 60 && smartWalletsCount >= 3) {
      recommendation = 'buy';
      confidence = Math.min(95, 50 + score * 0.5);
    } else if (score >= 30 && smartWalletsCount >= 1) {
      recommendation = 'watch';
      confidence = 30 + score * 0.3;
    } else {
      recommendation = 'reject';
      confidence = Math.max(10, 30 - score * 0.2);
    }

    return {
      isHovering: score >= 30,
      score,
      level,
      details: {
        smartWalletsCount,
        avgWinRate,
        totalProfit,
        whaleCount,
        whaleBuying,
        buyRatio,
        volume24h: dexData.volume24h,
        topWallets: smartWalletsData.wallets.slice(0, 5).map((w: any) => ({
          address: w.address,
          winRate: w.winRate || 0,
          totalProfit: w.totalProfit || 0,
        })),
      },
      recommendation,
      confidence,
    };

  } catch (error) {
    console.error('? ·‘‰ „‘·  ÕËÂ «‰ÂÕ«·ÿ «‰–„Í…:', error);
    return {
      isHovering: false,
      score: 0,
      level: 'none',
      details: {
        smartWalletsCount: 0,
        avgWinRate: 0,
        totalProfit: 0,
        whaleCount: 0,
        whaleBuying: false,
        buyRatio: 0,
        volume24h: 0,
        topWallets: [],
      },
      recommendation: 'reject',
      confidence: 0,
    };
  }
}

// ============================================================
// ?? «‰Âƒ‘—«  «‰·ÊÍ… (Õ‚Í‚Í…)
// ============================================================

export function calculateRSI(priceHistory: number[], period: number = 14): number {
  if (priceHistory.length < period + 1) {
    throw new Error(`? »Í«Ê«  ⁄Í— „«·Í… ‰Õ”«» RSI ( Õ «Ã ${period + 1} ”Ÿ—)`);
  }

  let gains = 0;
  let losses = 0;
  const len = priceHistory.length;

  for (let i = len - period; i < len - 1; i++) {
    const change = priceHistory[i + 1] - priceHistory[i];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calculateStochastic(
  priceHistory: number[],
  period: number = 14
): { k: number; d: number } {
  if (priceHistory.length < period) {
    throw new Error(`? »Í«Ê«  ⁄Í— „«·Í… ‰Õ”«» Stochastic ( Õ «Ã ${period} ”Ÿ—)`);
  }

  const recentPrices = priceHistory.slice(-period);
  const high = Math.max(...recentPrices);
  const low = Math.min(...recentPrices);
  const currentClose = recentPrices[recentPrices.length - 1];

  if (high === low) {
    return { k: 50, d: 50 };
  }

  const k = ((currentClose - low) / (high - low)) * 100;

  const kHistory: number[] = [];
  for (let i = 0; i < 3 && i < priceHistory.length - 1; i++) {
    const slice = priceHistory.slice(-period - i - 1, -i || undefined);
    if (slice.length >= period) {
      const h = Math.max(...slice);
      const l = Math.min(...slice);
      const c = slice[slice.length - 1];
      if (h !== l) {
        kHistory.push(((c - l) / (h - l)) * 100);
      }
    }
  }

  const d = kHistory.length > 0
    ? kHistory.reduce((a, b) => a + b, 0) / kHistory.length
    : k * 0.7 + 30;

  return { k, d };
}

export function calculateMACD(
  priceHistory: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  if (priceHistory.length < slowPeriod) {
    throw new Error(`? »Í«Ê«  ⁄Í— „«·Í… ‰Õ”«» MACD ( Õ «Ã ${slowPeriod} ”Ÿ—)`);
  }

  const fastEMA = calculateEMA(priceHistory, fastPeriod);
  const slowEMA = calculateEMA(priceHistory, slowPeriod);
  const macd = fastEMA - slowEMA;

  const signal = macd * 0.8;
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

function calculateEMA(priceHistory: number[], period: number): number {
  if (priceHistory.length === 0) {
    throw new Error('? ‰«  ËÃœ »Í«Ê«  ‰Õ”«» EMA');
  }

  const k = 2 / (period + 1);
  let ema = priceHistory[0];

  const limit = Math.min(priceHistory.length, period * 2);
  for (let i = 1; i < limit; i++) {
    ema = priceHistory[i] * k + ema * (1 - k);
  }

  return ema;
}

// ============================================================
// ??? «‰·‰« — «‰√ÂÊÍ…
// ============================================================

const STABLECOIN_PATTERNS = /^(USDC|USDT|DAI|FRAX|LUSD|USDS|PYUSD|USD1|SUSDS|USDB)$/i;

function isSuspiciousPair(pair: TokenPair, config: BaseBotConfig): string[] {
  const flags: string[] = [];
  const symbol = pair.baseToken.symbol.toUpperCase();
  const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60) : 999;

  if (STABLECOIN_PATTERNS.test(symbol)) {
    flags.push('stablecoin');
  }

  if (pair.liquidity && pair.liquidity.usd < config.minLiquidityUsd / 2) {
    flags.push('low-liquidity');
  }

  const txns = pair.txns?.h24;
  if (txns && (txns.buys + txns.sells) < 20 && ageHours > 6) {
    flags.push('low-activity');
  }

  if (pair.baseToken.symbol.length > 20) {
    flags.push('spam-symbol');
  }

  if (!pair.priceUsd || parseFloat(pair.priceUsd) <= 0) {
    flags.push('no-price');
  }

  return flags;
}

// ============================================================
// ?? œÂÃ «‰√“Ë«Ã ·Í „«∆Ê«  Token
// ============================================================

function getTokenId(chainId: string, tokenAddress: string): string {
  return `${chainId}:${tokenAddress}`;
}

function aggregatePairsToTokens(pairs: TokenPair[], chainId: ChainId): Map<string, DiscoveredToken> {
  const tokenMap = new Map<string, DiscoveredToken>();

  for (const pair of pairs) {
    if (!pair.baseToken?.address) continue;
    const tokenId = getTokenId(pair.chainId, pair.baseToken.address);
    const existing = tokenMap.get(tokenId);

    const pairLiquidity = pair.liquidity?.usd ?? 0;
    const pairVolume = pair.volume?.h24 ?? 0;

    if (!existing) {
      const priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
      const priceChange = pair.priceChange ?? { m5: 0, h1: 0, h6: 0, h24: 0 };
      const txns24h = pair.txns?.h24 ?? { buys: 0, sells: 0 };

      tokenMap.set(tokenId, {
        chainId,
        tokenAddress: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        bestPair: pair,
        allPairs: [pair],
        priceUsd,
        volume24h: pairVolume,
        liquidityUsd: pairLiquidity,
        marketCap: pair.marketCap ?? null,
        fdv: pair.fdv ?? null,
        priceChange: {
          m5: priceChange.m5 ?? 0,
          h1: priceChange.h1 ?? 0,
          h6: priceChange.h6 ?? 0,
          h24: priceChange.h24 ?? 0,
        },
        txns24h,
        pairAge: pair.pairCreatedAt,
        pairCreatedAt: pair.pairCreatedAt,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        boosts: pair.boosts?.active ?? 0,
        score: 0,
        status: 'reject',
        securityFlags: [],
        source: 'merged',
        strategy: 'new-listing',
      });
    } else {
      existing.allPairs.push(pair);
      if (pairLiquidity > existing.liquidityUsd) {
        existing.bestPair = pair;
        existing.liquidityUsd = pairLiquidity;
        existing.volume24h = pairVolume;
        existing.dexId = pair.dexId;
        existing.pairAddress = pair.pairAddress;
        existing.priceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : existing.priceUsd;
        existing.marketCap = pair.marketCap ?? existing.marketCap;
        existing.fdv = pair.fdv ?? existing.fdv;
        existing.pairAge = pair.pairCreatedAt;
        existing.pairCreatedAt = pair.pairCreatedAt;
        existing.boosts = pair.boosts?.active ?? existing.boosts;
      }
      existing.volume24h += pairVolume;
    }
  }

  return tokenMap;
}

// ============================================================
// ?? Õ”«» «‰Ê‚«◊
// ============================================================

function classifyStrategy(token: DiscoveredToken): 'new-listing' | 'momentum' | 'established' {
  if (!token.pairCreatedAt || token.pairCreatedAt <= 0) return 'established';
  const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
  if (ageHours < 24) return 'new-listing';
  if (ageHours < 168 && token.priceChange.h24 >= 10) return 'momentum';
  return 'established';
}

function calculateScore(token: DiscoveredToken, config: BaseBotConfig): number {
  let score = 0;
  const strategy = classifyStrategy(token);
  token.strategy = strategy;

  // «‰”ÍË‰…
  if (token.liquidityUsd >= 500000) score += 25;
  else if (token.liquidityUsd >= 100000) score += 15;
  else if (token.liquidityUsd >= 50000) score += 8;
  else if (token.liquidityUsd >= 10000) score += 3;

  // «‰ÕÃÂ
  if (token.volume24h >= 1000000) score += 25;
  else if (token.volume24h >= 500000) score += 18;
  else if (token.volume24h >= 100000) score += 10;
  else if (token.volume24h >= 50000) score += 5;

  //  ⁄Í—«  «‰”Ÿ— Õ”» «‰«” —« ÍÃÍ…
  if (strategy === 'new-listing') {
    if (token.priceChange.h24 >= 30) score += 20;
    else if (token.priceChange.h24 >= 15) score += 15;
    else if (token.priceChange.h24 >= 5) score += 10;
    else if (token.priceChange.h24 >= 0) score += 5;
    else if (token.priceChange.h24 <= -20) score -= 10;
  } else if (strategy === 'momentum') {
    if (token.priceChange.h1 >= 10) score += 15;
    else if (token.priceChange.h1 >= 5) score += 10;
    else if (token.priceChange.h1 >= 2) score += 5;
    if (token.priceChange.h24 >= 25) score += 15;
    else if (token.priceChange.h24 >= 10) score += 10;
  } else {
    if (token.priceChange.h24 >= 15) score += 10;
    else if (token.priceChange.h24 >= 5) score += 5;
    else if (token.priceChange.h24 >= 0) score += 3;
    else if (token.priceChange.h24 <= -15) score -= 10;
  }

  // «‰ÂŸ«Â‰« 
  const totalTxns = token.txns24h.buys + token.txns24h.sells;
  if (totalTxns >= 1000) score += 10;
  else if (totalTxns >= 500) score += 7;
  else if (totalTxns >= 100) score += 4;

  // Ê”»… «‰‘—«¡
  const buyRatio = totalTxns > 0 ? token.txns24h.buys / totalTxns : 0.5;
  if (buyRatio >= 0.65) score += 8;
  else if (buyRatio >= 0.55) score += 4;
  else if (buyRatio < 0.4) score -= 5;

  // Â„«·√… «‰ŸÂ‰«  «‰ÃœÍœ…
  if (token.pairCreatedAt && token.pairCreatedAt > 0) {
    const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
    if (ageHours < 1) score += 15;
    else if (ageHours < 6) score += 10;
    else if (ageHours < 24) score += 5;
  }

  // Œ’Â «‰Ÿ‰«Â«  «‰√ÂÊÍ…
  for (const flag of token.securityFlags) {
    if (flag === 'low-activity') score -= 3;
    else if (flag === 'spam-symbol') score -= 10;
    else score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================
// ??  Õ‰Í‰ ÂŒ’’ ‰„‰ »Ë 
// ============================================================

async function analyzeForHunterReal(
  token: DiscoveredToken,
  config: HunterConfig,
  network: string
): Promise<{ action: 'BUY' | 'WATCH' | 'REJECT'; reason: string; confidence: number }> {
  let score = token.score;
  let reason = '';
  let confidence = 50;
  let extraInfo: string[] = [];

  // 1. «‰ŸÂ—
  const ageHours = token.pairCreatedAt ? (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60) : 999;
  if (config.maxAgeHours && ageHours > config.maxAgeHours) {
    return { action: 'REJECT', reason: `«‰ŸÂ‰… ‚œÍÂ… (${ageHours.toFixed(1)} ”«Ÿ…)`, confidence: 10 };
  }

  // 2. Ê”»… «‰‘—«¡ ≈‰È «‰»ÍŸ
  const totalTxns = token.txns24h.buys + token.txns24h.sells;
  const buyRatio = totalTxns > 0 ? token.txns24h.buys / totalTxns : 0.5;
  if (buyRatio < config.minBuyRatio) {
    return { action: 'REJECT', reason: `Ê”»… «‰‘—«¡ ÂÊŒ·÷… (${(buyRatio * 100).toFixed(0)}%)`, confidence: 15 };
  }

  // ? 3. Ã‰» «‰ÂÕ«·ÿ «‰–„Í… (ÂÊ Worker - »œËÊ Birdeye)
  let smartWallets = { count: 0, avgWinRate: 0, totalProfit: 0, wallets: [] };
  
  try {
    const smartData = await fetchSmartWallets(token.tokenAddress, network, config.minSmartWallets);
    smartWallets = smartData;
    
    if (smartWallets.count > 0) {
      extraInfo.push(`?? ${smartWallets.count} ÂÕ·ÿ… –„Í…`);
      extraInfo.push(`?? Â Ë”◊ —»Õ ${smartWallets.avgWinRate.toFixed(0)}%`);
    }
  } catch (error) {
    console.warn('?? ·‘‰ Ã‰» «‰ÂÕ«·ÿ «‰–„Í…:', error);
  }

  // ? 4. Ã‰» »Í«Ê«  «‰ÕÍ «Ê (ÂÊ Worker - »œËÊ Birdeye)
  let whaleData = { whaleCount: 0, largeBuys: 0, largeSells: 0 };
  try {
    const response = await fetch(`${WORKER_URL}/whale-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress: token.tokenAddress, network }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        whaleData = {
          whaleCount: data.data?.whaleCount || 0,
          largeBuys: data.data?.largeBuys || 0,
          largeSells: data.data?.largeSells || 0,
        };
        
        if (whaleData.whaleCount > 0) {
          extraInfo.push(`?? ${whaleData.whaleCount} ÕË `);
        }
      }
    }
  } catch (error) {
    console.warn('?? ·‘‰ Ã‰» »Í«Ê«  «‰ÕÍ «Ê:', error);
  }

  // ? 5. ÂŸ«ÍÍ— «‰ÕÍ «Ê (ÂÊ Worker)
  if (config.enableWhaleFilter && config.minWhales) {
    if (whaleData.whaleCount < config.minWhales) {
      return {
        action: 'REJECT',
        reason: `Ÿœœ «‰ÕÍ «Ê ⁄Í— „«·Ì (${whaleData.whaleCount}/${config.minWhales})`,
        confidence: 10,
      };
    }
  }

  // ? 6. Â„«·√… «‰ÕÍ «Ê
  if (whaleData.whaleCount >= 5) score += 15;
  else if (whaleData.whaleCount >= 3) score += 10;
  else if (whaleData.whaleCount >= 1) score += 5;

  // ? 7. Â„«·√… «‰ÂÕ«·ÿ «‰–„Í…
  if (smartWallets.count >= config.minSmartWallets) {
    score += 15;
  } else if (smartWallets.count >= config.minSmartWallets / 2) {
    score += 8;
  }

  // 8. «‰Ê ÍÃ… «‰ÊÁ«∆Í…
  const extraText = extraInfo.length > 0 ? ` (${extraInfo.join(', ')})` : '';
  
  if (score >= config.minScore && smartWallets.count >= config.minSmartWallets) {
    reason = `Ê‚«◊ ${Math.round(score)}/100¨ ${smartWallets.count} ÂÕ·ÿ… –„Í…${extraText}`;
    confidence = Math.min(95, 50 + score * 0.3 + (smartWallets.count / (config.minSmartWallets || 1)) * 10);
    return { action: 'BUY', reason, confidence };
  } else if (score >= config.minScore - 15) {
    reason = `Ê‚«◊ ${Math.round(score)}/100¨ ${smartWallets.count} ÂÕ·ÿ… –„Í… (‚—Í» ÂÊ «‰Õœ)${extraText}`;
    confidence = 30 + (score - (config.minScore - 15)) / 15 * 20;
    return { action: 'WATCH', reason, confidence };
  }

  return { action: 'REJECT', reason: `Ê‚«◊ ÂÊŒ·÷… (${Math.round(score)}/100)${extraText}`, confidence: 20 };
}

async function analyzeForSignalReal(
  token: DiscoveredToken,
  config: SignalConfig,
  network: string
): Promise<{ action: 'BUY' | 'WATCH' | 'REJECT'; reason: string; confidence: number }> {
  // Ã‰» »Í«Ê«  «‰”Ÿ— «‰ «—ÍŒÍ…
  const priceHistory = await fetchPriceHistory(token.tokenAddress, network, '1h', 50);

  // Õ”«» «‰Âƒ‘—« 
  const rsi = calculateRSI(priceHistory, 14);
  const stochastic = calculateStochastic(priceHistory, 14);
  const macd = calculateMACD(priceHistory, 12, 26, 9);

  let score = token.score;
  let reason = '';
  let confidence = 50;

  const isOversold = rsi < config.rsiOversold;
  const isOverbought = rsi > config.rsiOverbought;
  const isStochOversold = stochastic.k < 20;
  const isStochOverbought = stochastic.k > 80;
  const isMACDBullish = macd.macd > macd.signal;

  // «‰ ⁄Í— «‰”Ÿ—Í
  if (token.priceChange.h1 < config.minPriceChange1h) {
    return { action: 'REJECT', reason: ` ⁄Í— 1 ”«Ÿ… ÂÊŒ·÷ (${token.priceChange.h1.toFixed(1)}%)`, confidence: 10 };
  }

  // ‚—«— «‰‘—«¡ ( √„Íœ Â Ÿœœ)
  let buySignals = 0;
  let totalSignals = 0;

  if (isOversold) { buySignals++; }
  totalSignals++;

  if (isStochOversold) { buySignals++; }
  totalSignals++;

  if (isMACDBullish) { buySignals++; }
  totalSignals++;

  if (score >= config.minScore) { buySignals++; }
  totalSignals++;

  //  √„Íœ «‰ÂÕ«·ÿ «‰–„Í… ≈–« „«Ê Â◊‰Ë»«Î
  if (config.useSmartWalletConfirmation) {
    const smartWallets = await fetchSmartWallets(token.tokenAddress, network, 2);
    if (smartWallets.count >= 2) { buySignals++; }
    totalSignals++;
  }

  const buyRatio = buySignals / totalSignals;

  if (buyRatio >= 0.6) {
    reason = `RSI ${rsi.toFixed(0)}, Stochastic K: ${stochastic.k.toFixed(0)}, MACD: ${isMACDBullish ? '’«Ÿœ' : 'Á«»◊'}, Ê‚«◊ ${score}/100`;
    confidence = Math.min(95, 50 + buyRatio * 40);
    return { action: 'BUY', reason, confidence };
  } else if (buyRatio >= 0.4) {
    reason = `RSI ${rsi.toFixed(0)}, Stochastic K: ${stochastic.k.toFixed(0)}, Ê‚«◊ ${score}/100 (Â—«‚»…)`;
    confidence = 30 + buyRatio * 40;
    return { action: 'WATCH', reason, confidence };
  }

  if (isOverbought || isStochOverbought) {
    return { action: 'REJECT', reason: `≈‘«—«   ‘»Ÿ ‘—«∆Í (RSI ${rsi.toFixed(0)}, Stochastic K: ${stochastic.k.toFixed(0)})`, confidence: 15 };
  }

  return { action: 'REJECT', reason: `≈‘«—«  ÷ŸÍ·… (RSI ${rsi.toFixed(0)}, Stochastic K: ${stochastic.k.toFixed(0)})`, confidence: 20 };
}

function analyzeForManual(token: DiscoveredToken, config: ManualConfig): { action: 'BUY' | 'WATCH' | 'REJECT'; reason: string; confidence: number } {
  return {
    action: token.score >= config.minScore ? 'BUY' : token.score >= config.minScore - 20 ? 'WATCH' : 'REJECT',
    reason: `Ê‚«◊ ${token.score}/100¨ ${token.strategy === 'new-listing' ? 'ŸÂ‰… ÃœÍœ…' : token.strategy === 'momentum' ? '“ŒÂ ‚ËÍ' : 'ŸÂ‰… —«”Œ…'}`,
    confidence: token.score,
  };
}

function analyzeForScalper(token: DiscoveredToken, config: ScalperConfig): { action: 'BUY' | 'WATCH' | 'REJECT'; reason: string; confidence: number } {
  if (token.symbol.toUpperCase() !== config.targetToken.toUpperCase()) {
    return { action: 'REJECT', reason: `‰Í” «‰ŸÂ‰… «‰Â” Áœ·… (${config.targetToken})`, confidence: 0 };
  }

  const priceChange = token.priceChange.h1;

  if (priceChange <= config.buyThreshold) {
    return {
      action: 'BUY',
      reason: `«ÊŒ·«÷ ${priceChange.toFixed(2)}% («‰Õœ ${config.buyThreshold}%)`,
      confidence: Math.min(90, 60 + (config.buyThreshold - priceChange) * 5),
    };
  }

  if (priceChange < 0) {
    return {
      action: 'WATCH',
      reason: `«ÊŒ·«÷ ◊·Í· ${priceChange.toFixed(2)}% («‰Õœ ${config.buyThreshold}%)`,
      confidence: 30,
    };
  }

  return {
    action: 'REJECT',
    reason: `«— ·«Ÿ ${priceChange.toFixed(2)}% (‰« ÍÊ«”» «‰‘—«¡)`,
    confidence: 10,
  };
}

// ============================================================
// ?? «‰œ«‰… «‰—∆Í”Í… (Hunter Pipeline)
// ============================================================

export async function runBotAnalysis(
  rawPairs: TokenPair[],
  chainId: ChainId,
  config: BotAnalysisConfig
): Promise<BotAnalysisResult> {
  const totalPairs = rawPairs.length;

  // 1.  ÃÂÍŸ «‰√“Ë«Ã ·Í „«∆Ê«  Token
  const aggregated = aggregatePairsToTokens(rawPairs, chainId);
  const uniqueTokens = aggregated.size;

  // 2. «‰ ’·Í… «‰√ÂÊÍ…
  const securityFiltered = new Map<string, DiscoveredToken>();
  for (const [id, token] of aggregated) {
    const flags = isSuspiciousPair(token.bestPair, config);
    if (flags.includes('stablecoin') || flags.includes('no-price') || flags.includes('spam-symbol')) {
      continue;
    }
    token.securityFlags = flags;
    securityFiltered.set(id, token);
  }
  const afterSecurity = securityFiltered.size;

  // 3.  ’·Í… «‰”ÍË‰… Ë«‰ÕÃÂ
  const liquidityFiltered = new Map<string, DiscoveredToken>();
  for (const [id, token] of securityFiltered) {
    if (token.liquidityUsd >= config.minLiquidityUsd) {
      liquidityFiltered.set(id, token);
    }
  }
  const afterLiquidity = liquidityFiltered.size;

  const volumeFiltered = new Map<string, DiscoveredToken>();
  for (const [id, token] of liquidityFiltered) {
    if (token.volume24h >= config.minVolume24h) {
      volumeFiltered.set(id, token);
    }
  }
  const afterVolume = volumeFiltered.size;

  // 4. Õ”«» «‰Ê‚«◊
  const scored: DiscoveredToken[] = [];
  for (const token of volumeFiltered.values()) {
    token.score = calculateScore(token, config);
    scored.push(token);
  }

  // 5.  Õ‰Í‰ „‰ »Ë  Õ”» ÊËŸÁ
  const recommendations: BotAnalysisResult['recommendations'] = [];
  
  for (const token of scored) {
    let analysis: { action: 'BUY' | 'WATCH' | 'REJECT'; reason: string; confidence: number };

    switch (config.botType) {
      case 'hunter':
        analysis = await analyzeForHunterReal(token, config as HunterConfig, chainId);
        break;
      case 'signal':
        analysis = await analyzeForSignalReal(token, config as SignalConfig, chainId);
        break;
      case 'manual':
        analysis = analyzeForManual(token, config as ManualConfig);
        break;
      case 'scalper':
        analysis = analyzeForScalper(token, config as ScalperConfig);
        break;
      default:
        analysis = { action: 'REJECT', reason: 'ÊËŸ »Ë  ⁄Í— ÂŸ—Ë·', confidence: 0 };
    }

    if (analysis.action !== 'REJECT') {
      recommendations.push({
        token,
        action: analysis.action,
        reason: analysis.reason,
        score: token.score,
        confidence: analysis.confidence,
      });
    }
  }

  // 6. ≈Õ’«∆Í« 
  const candidates = recommendations.filter(r => r.action === 'BUY').length;
  const watchlist = recommendations.filter(r => r.action === 'WATCH').length;
  const rejected = scored.length - candidates - watchlist;

 const stats: PipelineStats = {
    totalPairs: totalPairs || 0,
    uniqueTokens: uniqueTokens || 0,
    afterSecurity: afterSecurity || 0,
    afterLiquidity: afterLiquidity || 0,
    afterVolume: afterVolume || 0,
    candidates: candidates || 0,
    watchlist: watchlist || 0,
    rejected: rejected || 0,
    lastUpdate: Date.now(),
    error: null,
};
  return {
    tokens: scored,
    stats,
    recommendations,
  };
}

// ============================================================
// ?? œË«‰ Â”«Ÿœ…
// ============================================================

export function getTopRecommendations(
  result: BotAnalysisResult,
  limit = 10,
  actionType: 'BUY' | 'WATCH' = 'BUY'
): BotAnalysisResult['recommendations'] {
  return result.recommendations
    .filter(r => r.action === actionType)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export function getTokenBySymbol(tokens: DiscoveredToken[], symbol: string): DiscoveredToken | undefined {
  return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}