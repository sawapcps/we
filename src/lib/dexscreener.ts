// src/lib/dexscreener.ts

import type { TokenPair, ChainId } from '@/types';

const BASE = 'https://api.dexscreener.com';

interface DexResponse {
  schemaVersion?: string;
  pairs?: TokenPair[];
}

// ============================================================
// ? الدوال الأساسية
// ============================================================

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

// ============================================================
// ? دالة جلب العملات الجديدة من DexScreener
// ============================================================

export async function getNewPairsFromDex(network: ChainId): Promise<TokenPair[]> {
  try {
    // ? البحث عن عملات جديدة باستخدام كلمات مفتاحية
    const queries = ['new', 'launch', 'recent', 'just launched', '24h'];
    let allPairs: TokenPair[] = [];
    
    for (const query of queries) {
      try {
        const results = await searchPairs(`${query} ${network}`);
        allPairs = [...allPairs, ...results];
      } catch (e) {
        // تجاهل الأخطاء
      }
    }
    
    // ? إزالة المكررات
    const seen = new Set<string>();
    const unique = allPairs.filter(p => {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // ? فلتر العملات الجديدة (أقل من 24 ساعة)
    const now = Date.now();
    return unique.filter(p => {
      if (!p.pairCreatedAt) return false;
      const ageHours = (now - p.pairCreatedAt) / (1000 * 60 * 60);
      return ageHours < 24;
    });
    
  } catch (error) {
    console.error('? فشل جلب العملات الجديدة من DexScreener:', error);
    return [];
  }
}

// ============================================================
// ? دالة جلب العملات الجديدة جداً (أقل من ساعة)
// ============================================================

export async function getVeryNewPairs(network: ChainId): Promise<TokenPair[]> {
  try {
    const queries = ['just launched', 'new', '1m', '5m', '30m'];
    let allPairs: TokenPair[] = [];
    
    for (const query of queries) {
      try {
        const results = await searchPairs(`${query} ${network}`);
        allPairs = [...allPairs, ...results];
      } catch (e) {
        // تجاهل الأخطاء
      }
    }
    
    const seen = new Set<string>();
    const unique = allPairs.filter(p => {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // ? فلتر العملات الجديدة جداً (أقل من ساعة)
    const now = Date.now();
    return unique.filter(p => {
      if (!p.pairCreatedAt) return false;
      const ageMinutes = (now - p.pairCreatedAt) / (1000 * 60);
      return ageMinutes < 60; // أقل من ساعة
    });
    
  } catch (error) {
    console.error('? فشل جلب العملات الجديدة جداً:', error);
    return [];
  }
}

// ============================================================
// ? دوال discovery الأصلية
// ============================================================

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