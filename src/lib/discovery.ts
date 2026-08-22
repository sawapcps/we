// src/lib/discovery.ts

import type { TokenPair, ChainId } from '@/types';
import { 
  discoverNetworkPairs, 
  getTrendingTokens, 
  getLatestBoostedTokens,
  searchPairs 
} from '@/lib/dexscreener';
import { 
  discoverGeckoPairs, 
  getNewPools, 
  getTrendingPools 
} from '@/lib/geckoterminal';

export type DataSource = 'dexscreener' | 'geckoterminal' | 'new_pairs' | 'new_pools' | 'trending';

export interface MultiSourceResult {
  pairs: TokenPair[];
  sources: { name: DataSource; count: number; error: string | null }[];
  error: string | null;
}

// ============================================================
// ? œ«‰… Ã‰» «‰ŸÂ‰«  «‰ÃœÍœ… ÂÊ DexScreener
// ============================================================

async function getNewPairsFromDex(network: ChainId): Promise<TokenPair[]> {
  try {
    // ? «‰»ÕÀ ŸÊ ŸÂ‰«  ÃœÍœ… »«” Œœ«Â „‰Â«  Â· «ÕÍ…
    const queries = ['new', 'launch', 'recent', 'just launched', '24h'];
    let allPairs: TokenPair[] = [];
    
    for (const query of queries) {
      try {
        const results = await searchPairs(`${query} ${network}`);
        allPairs = [...allPairs, ...results];
      } catch (e) {
        //  Ã«Á‰ «‰√Œ◊«¡
      }
    }
    
    // ? ≈“«‰… «‰Â„——« 
    const seen = new Set<string>();
    const unique = allPairs.filter(p => {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // ? ·‰ — «‰ŸÂ‰«  «‰ÃœÍœ… (√‚‰ ÂÊ 24 ”«Ÿ…)
    const now = Date.now();
    return unique.filter(p => {
      if (!p.pairCreatedAt) return false;
      const ageHours = (now - p.pairCreatedAt) / (1000 * 60 * 60);
      return ageHours < 24;
    });
    
  } catch (error) {
    console.error('? ·‘‰ Ã‰» «‰ŸÂ‰«  «‰ÃœÍœ… ÂÊ DexScreener:', error);
    return [];
  }
}

// ============================================================
// ? œ«‰… Ã‰» «‰ŸÂ‰«  «‰ÃœÍœ… Ãœ«Î (√‚‰ ÂÊ ”«Ÿ…)
// ============================================================

async function getVeryNewPairsFromDex(network: ChainId): Promise<TokenPair[]> {
  try {
    const queries = ['just launched', 'new', '1m', '5m', '30m'];
    let allPairs: TokenPair[] = [];
    
    for (const query of queries) {
      try {
        const results = await searchPairs(`${query} ${network}`);
        allPairs = [...allPairs, ...results];
      } catch (e) {
        //  Ã«Á‰ «‰√Œ◊«¡
      }
    }
    
    const seen = new Set<string>();
    const unique = allPairs.filter(p => {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // ? ·‰ — «‰ŸÂ‰«  «‰ÃœÍœ… Ãœ«Î (√‚‰ ÂÊ ”«Ÿ…)
    const now = Date.now();
    return unique.filter(p => {
      if (!p.pairCreatedAt) return false;
      const ageMinutes = (now - p.pairCreatedAt) / (1000 * 60);
      return ageMinutes < 60; // √‚‰ ÂÊ ”«Ÿ…
    });
    
  } catch (error) {
    console.error('? ·‘‰ Ã‰» «‰ŸÂ‰«  «‰ÃœÍœ… Ãœ«Î:', error);
    return [];
  }
}

// ============================================================
// ? «‰œ«‰… «‰—∆Í”Í… -  Ã‰» „‰ «‰ŸÂ‰«  »Â« ·ÍÁ« «‰ÃœÍœ…
// ============================================================

export async function discoverAllPairs(network: ChainId): Promise<MultiSourceResult> {
  // ? Ã‰» ÂÊ ÃÂÍŸ «‰Â’«œ— (»Â« ·ÍÁ« «‰ŸÂ‰«  «‰ÃœÍœ…)
  const [dexResult, geckoResult, newPairs, newPools, trendingPools, veryNewPairs] = await Promise.all([
    discoverNetworkPairs(network),
    discoverGeckoPairs(network),
    getNewPairsFromDex(network),      // ? ŸÂ‰«  ÃœÍœ… ÂÊ DexScreener (< 24 ”«Ÿ…)
    getNewPools(network),             // ? ÂÃÂËŸ«  ÃœÍœ… ÂÊ GeckoTerminal
    getTrendingPools(network),        // ? ŸÂ‰«  —«∆Ã… ÂÊ GeckoTerminal
    getVeryNewPairsFromDex(network),  // ? ŸÂ‰«  ÃœÍœ… Ãœ«Î (< 1 ”«Ÿ…)
  ]);

  const sources: MultiSourceResult['sources'] = [
    { name: 'dexscreener', count: dexResult.pairs.length, error: dexResult.error },
    { name: 'geckoterminal', count: geckoResult.pairs.length, error: geckoResult.error },
    { name: 'new_pairs', count: newPairs.length, error: null },
    { name: 'very_new_pairs', count: veryNewPairs.length, error: null },
    { name: 'new_pools', count: newPools.length, error: null },
    { name: 'trending', count: trendingPools.length, error: null },
  ];

  const seen = new Set<string>();
  const merged: TokenPair[] = [];

  const addPairs = (pairs: TokenPair[], source: DataSource) => {
    for (const p of pairs) {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
  };

  // ? ≈÷«·… «‰ŸÂ‰«  ÂÊ ÃÂÍŸ «‰Â’«œ— ( — Í» «‰√Ë‰ËÍ… ‰‰ÃœÍœ…)
  addPairs(veryNewPairs, 'new_pairs');        // ? √ÕœÀ «‰ŸÂ‰«  √Ë‰«Î
  addPairs(newPairs, 'new_pairs');            // ? ŸÂ‰«  ÃœÍœ…
  addPairs(newPools, 'new_pools');            // ? ÂÃÂËŸ«  ÃœÍœ…
  addPairs(trendingPools, 'trending');        // ? ŸÂ‰«  —«∆Ã…
  addPairs(dexResult.pairs, 'dexscreener');   // ? ŸÂ‰«  Â œ«Ë‰…
  addPairs(geckoResult.pairs, 'geckoterminal'); // ? ŸÂ‰«  Â œ«Ë‰…

  // ?  — Í» Õ”» «‰√ÕœÀ √Ë‰«Î
  merged.sort((a, b) => {
    const dateA = a.pairCreatedAt || 0;
    const dateB = b.pairCreatedAt || 0;
    return dateB - dateA;
  });

  if (merged.length === 0) {
    return {
      pairs: [],
      sources,
      error: 'All data sources failed',
    };
  }

  return { pairs: merged, sources, error: null };
}

// ============================================================
// ? œ«‰… Ã‰» «‰ŸÂ‰«  «‰ÃœÍœ… ·‚◊ (‰‰«” Œœ«Â «‰Â»«‘—)
// ============================================================

export async function discoverNewPairsOnly(network: ChainId): Promise<MultiSourceResult> {
  const [newPairs, veryNewPairs, newPools] = await Promise.all([
    getNewPairsFromDex(network),
    getVeryNewPairsFromDex(network),
    getNewPools(network),
  ]);

  const sources: MultiSourceResult['sources'] = [
    { name: 'new_pairs', count: newPairs.length, error: null },
    { name: 'very_new_pairs', count: veryNewPairs.length, error: null },
    { name: 'new_pools', count: newPools.length, error: null },
  ];

  const seen = new Set<string>();
  const merged: TokenPair[] = [];

  const addPairs = (pairs: TokenPair[], source: DataSource) => {
    for (const p of pairs) {
      const key = `${p.chainId}:${p.pairAddress}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(p);
      }
    }
  };

  addPairs(veryNewPairs, 'new_pairs');
  addPairs(newPairs, 'new_pairs');
  addPairs(newPools, 'new_pools');

  merged.sort((a, b) => {
    const dateA = a.pairCreatedAt || 0;
    const dateB = b.pairCreatedAt || 0;
    return dateB - dateA;
  });

  if (merged.length === 0) {
    return {
      pairs: [],
      sources,
      error: 'No new pairs found',
    };
  }

  return { pairs: merged, sources, error: null };
}

// ============================================================
// ? œË«‰ Â”«Ÿœ… √Œ—È
// ============================================================

export async function discoverAllPairsMultiNetwork(
  networks: ChainId[],
): Promise<Map<ChainId, MultiSourceResult>> {
  const results = new Map<ChainId, MultiSourceResult>();
  const settled = await Promise.allSettled(
    networks.map((n) => discoverAllPairs(n)),
  );

  networks.forEach((network, i) => {
    const result = settled[i];
    if (result && result.status === 'fulfilled') {
      results.set(network, result.value);
    } else {
      results.set(network, {
        pairs: [],
        sources: [],
        error: result && result.status === 'rejected' ? String(result.reason) : 'Failed',
      });
    }
  });

  return results;
}

export async function getTrendingGlobal(): Promise<TokenPair[]> {
  try {
    return await getTrendingTokens();
  } catch {
    return [];
  }
}

export async function getLatestBoosted(): Promise<TokenPair[]> {
  try {
    return await getLatestBoostedTokens();
  } catch {
    return [];
  }
}