import type { TokenPair, ChainId, DiscoveredToken, TokenStatus, PipelineStats } from '@/types';

export interface HunterFilters {
  minLiquidityUsd: number;
  minVolume24h: number;
  minPriceChange24h: number;
}

export interface HunterResult {
  tokens: DiscoveredToken[];
  stats: PipelineStats;
}

const SUSPICIOUS_SYMBOLS = new Set([
  'USDC', 'USDT', 'USDB', 'DAI', 'WETH', 'WBTC', 'WMATIC', 'WBNB',
  'WSOL', 'USDS', 'FRAX', 'LUSD', 'SUSDS', 'PYUSD', 'USD1',
]);

const STABLECOIN_PATTERNS = /^(USDC|USDT|DAI|FRAX|LUSD|USDS|PYUSD|USD1|SUSDS|USDB)$/i;

function isSuspiciousPair(pair: TokenPair): string[] {
  const flags: string[] = [];
  const symbol = pair.baseToken.symbol.toUpperCase();

  if (SUSPICIOUS_SYMBOLS.has(symbol) || STABLECOIN_PATTERNS.test(symbol)) {
    flags.push('stablecoin');
  }

  if (pair.liquidity && pair.liquidity.usd < 1000) {
    flags.push('low-liquidity');
  }

  if (pair.pairCreatedAt && pair.pairCreatedAt > 0) {
    const ageHours = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60);
    if (ageHours < 1) {
      flags.push('very-new');
    }
  }

  if (pair.volume?.h24 && pair.liquidity?.usd) {
    const volToLiq = pair.volume.h24 / pair.liquidity.usd;
    if (volToLiq > 50) {
      flags.push('wash-trading-suspect');
    }
  }

  const txns = pair.txns?.h24;
  if (txns && (txns.buys + txns.sells) < 10) {
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

function classifyStrategy(token: DiscoveredToken): 'new-listing' | 'momentum' | 'established' {
  if (!token.pairCreatedAt || token.pairCreatedAt <= 0) return 'established';
  const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
  if (ageHours < 24) return 'new-listing';
  if (ageHours < 168 && token.priceChange.h24 >= 10) return 'momentum';
  return 'established';
}

function scoreToken(token: DiscoveredToken): number {
  let score = 0;
  const strategy = classifyStrategy(token);
  token.strategy = strategy;

  if (token.liquidityUsd >= 500000) score += 25;
  else if (token.liquidityUsd >= 100000) score += 15;
  else if (token.liquidityUsd >= 50000) score += 8;
  else if (token.liquidityUsd >= 10000) score += 3;

  if (token.volume24h >= 1000000) score += 25;
  else if (token.volume24h >= 500000) score += 18;
  else if (token.volume24h >= 100000) score += 10;
  else if (token.volume24h >= 50000) score += 5;

  if (strategy === 'momentum') {
    if (token.priceChange.h1 >= 15) score += 20;
    else if (token.priceChange.h1 >= 8) score += 15;
    else if (token.priceChange.h1 >= 3) score += 10;

    if (token.priceChange.h6 >= 30) score += 15;
    else if (token.priceChange.h6 >= 15) score += 10;
    else if (token.priceChange.h6 >= 5) score += 5;

    if (token.priceChange.h24 >= 50) score += 15;
    else if (token.priceChange.h24 >= 25) score += 10;
    else if (token.priceChange.h24 >= 10) score += 7;
    else if (token.priceChange.h24 >= 0) score += 3;
  } else if (strategy === 'established') {
    if (token.priceChange.h24 >= 20) score += 15;
    else if (token.priceChange.h24 >= 10) score += 10;
    else if (token.priceChange.h24 >= 5) score += 7;
    else if (token.priceChange.h24 >= 0) score += 3;
    else if (token.priceChange.h24 <= -20) score -= 10;

    if (token.priceChange.h1 >= 10) score += 10;
    else if (token.priceChange.h1 >= 5) score += 5;
    else if (token.priceChange.h1 >= 0) score += 2;

    if (token.priceChange.m5 >= 5) score += 5;
    else if (token.priceChange.m5 >= 0) score += 2;
  } else {
    if (token.priceChange.h24 >= 20) score += 15;
    else if (token.priceChange.h24 >= 10) score += 10;
    else if (token.priceChange.h24 >= 5) score += 7;
    else if (token.priceChange.h24 >= 0) score += 3;
    else if (token.priceChange.h24 <= -20) score -= 10;

    if (token.priceChange.h1 >= 10) score += 10;
    else if (token.priceChange.h1 >= 5) score += 5;
    else if (token.priceChange.h1 >= 0) score += 2;

    if (token.priceChange.m5 >= 5) score += 5;
    else if (token.priceChange.m5 >= 0) score += 2;
  }

  const totalTxns = token.txns24h.buys + token.txns24h.sells;
  if (totalTxns >= 1000) score += 10;
  else if (totalTxns >= 500) score += 7;
  else if (totalTxns >= 100) score += 4;

  const buyRatio = totalTxns > 0 ? token.txns24h.buys / totalTxns : 0.5;
  if (buyRatio >= 0.65) score += 8;
  else if (buyRatio >= 0.55) score += 4;
  else if (buyRatio < 0.4) score -= 5;

  if (token.marketCap && token.marketCap >= 1000000) score += 5;
  if (token.boosts > 0) score += token.boosts * 2;

  if (token.pairCreatedAt && token.pairCreatedAt > 0) {
    const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
    if (strategy === 'established' && ageHours >= 168) score += 5;
    else if (ageHours < 1) score -= 10;
    else if (ageHours < 6) score -= 3;
  }

  for (const _flag of token.securityFlags) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function classifyToken(score: number): TokenStatus {
  if (score >= 70) return 'candidate';
  if (score >= 45) return 'watch';
  return 'reject';
}

export function runHunterPipeline(
  rawPairs: TokenPair[],
  chainId: ChainId,
  filters: HunterFilters,
): HunterResult {
  const totalPairs = rawPairs.length;

  const aggregated = aggregatePairsToTokens(rawPairs, chainId);
  const uniqueTokens = aggregated.size;

  const securityFiltered = new Map<string, DiscoveredToken>();
  let securityRejectCount = 0;

  for (const [id, token] of aggregated) {
    const flags = isSuspiciousPair(token.bestPair);
    if (flags.includes('stablecoin') || flags.includes('no-price') || flags.includes('spam-symbol')) {
      securityRejectCount++;
      continue;
    }
    token.securityFlags = flags;
    securityFiltered.set(id, token);
  }

  const afterSecurity = securityFiltered.size;

  const liquidityFiltered = new Map<string, DiscoveredToken>();
  for (const [id, token] of securityFiltered) {
    if (token.liquidityUsd >= filters.minLiquidityUsd) {
      liquidityFiltered.set(id, token);
    }
  }
  const afterLiquidity = liquidityFiltered.size;

  const volumeFiltered = new Map<string, DiscoveredToken>();
  for (const [id, token] of liquidityFiltered) {
    if (token.volume24h >= filters.minVolume24h) {
      volumeFiltered.set(id, token);
    }
  }
  const afterVolume = volumeFiltered.size;

  const scored: DiscoveredToken[] = [];
  for (const token of volumeFiltered.values()) {
    token.score = scoreToken(token);
    token.status = classifyToken(token.score);
    scored.push(token);
  }

  scored.sort((a, b) => b.score - a.score);

  const candidates = scored.filter((t) => t.status === 'candidate').length;
  const watchlist = scored.filter((t) => t.status === 'watch').length;
  const rejected = scored.filter((t) => t.status === 'reject').length;

  const stats: PipelineStats = {
    totalPairs,
    uniqueTokens,
    afterSecurity,
    afterLiquidity,
    afterVolume,
    candidates,
    watchlist,
    rejected,
    lastUpdate: Date.now(),
    error: null,
  };

  return { tokens: scored, stats };
}

export function getTopCandidates(tokens: DiscoveredToken[], limit = 10): DiscoveredToken[] {
  return tokens
    .filter((t) => t.status === 'candidate' || t.status === 'watch')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
