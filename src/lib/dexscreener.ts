import type { TokenPair, ChainId } from '@/types';

const BASE = 'https://api.dexscreener.com';

interface DexResponse {
  schemaVersion?: string;
  pairs?: TokenPair[];
}

export async function searchPairs(query: string): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`DexScreener search failed: ${res.status}`);
  const data: DexResponse = await res.json();
  return data.pairs ?? [];
}

export async function getPairsByToken(chainId: ChainId, tokenAddress: string): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/tokens/v1/${chainId}/${tokenAddress}`);
  if (!res.ok) throw new Error(`DexScreener token fetch failed: ${res.status}`);
  return res.json();
}

export async function getPairByAddress(chainId: ChainId, pairId: string): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/latest/dex/pairs/${chainId}/${pairId}`);
  if (!res.ok) throw new Error(`DexScreener pair fetch failed: ${res.status}`);
  const data: DexResponse = await res.json();
  return data.pairs ?? [];
}

export async function getTrendingTokens(): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/token-boosts/top/v1`);
  if (!res.ok) throw new Error(`DexScreener trending fetch failed: ${res.status}`);
  return res.json();
}

export async function getLatestBoostedTokens(): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/token-boosts/latest/v1`);
  if (!res.ok) throw new Error(`DexScreener boosts fetch failed: ${res.status}`);
  return res.json();
}

export async function searchByNetwork(network: ChainId): Promise<TokenPair[]> {
  const res = await fetch(`${BASE}/latest/dex/search?q=${encodeURIComponent(network)}`);
  if (!res.ok) throw new Error(`DexScreener network search failed: ${res.status}`);
  const data: DexResponse = await res.json();
  return (data.pairs ?? []).filter((p) => p.chainId === network);
}

export interface NetworkDiscoveryResult {
  pairs: TokenPair[];
  error: string | null;
}

export async function discoverNetworkPairs(network: ChainId): Promise<NetworkDiscoveryResult> {
  try {
    const networkPairs = await searchByNetwork(network);
    const seen = new Set(networkPairs.map((p) => p.pairAddress));

    if (networkPairs.length < 50) {
      const trending = await getTrendingTokens();
      const trendingFiltered = trending.filter((p) => p.chainId === network);
      for (const p of trendingFiltered) {
        if (!seen.has(p.pairAddress)) {
          networkPairs.push(p);
          seen.add(p.pairAddress);
        }
      }
    }

    const boosted = await getLatestBoostedTokens();
    const boostedFiltered = boosted.filter((p) => p.chainId === network);
    for (const p of boostedFiltered) {
      if (!seen.has(p.pairAddress)) {
        networkPairs.push(p);
      }
    }

    return { pairs: networkPairs, error: null };
  } catch (e) {
    return { pairs: [], error: e instanceof Error ? e.message : 'Failed to fetch from DEX Screener' };
  }
}

export async function getTopPairsForNetwork(network: ChainId, limit = 30): Promise<TokenPair[]> {
  try {
    const { pairs } = await discoverNetworkPairs(network);
    return pairs
      .filter((p) => p.liquidity && p.liquidity.usd > 10000)
      .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}
