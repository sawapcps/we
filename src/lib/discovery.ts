import type { TokenPair, ChainId } from '@/types';
import { discoverNetworkPairs, getTrendingTokens, getLatestBoostedTokens } from '@/lib/dexscreener';
import { discoverGeckoPairs } from '@/lib/geckoterminal';

export type DataSource = 'dexscreener' | 'geckoterminal';

export interface MultiSourceResult {
  pairs: TokenPair[];
  sources: { name: DataSource; count: number; error: string | null }[];
  error: string | null;
}

export async function discoverAllPairs(network: ChainId): Promise<MultiSourceResult> {
  const [dexResult, geckoResult] = await Promise.all([
    discoverNetworkPairs(network),
    discoverGeckoPairs(network),
  ]);

  const sources: MultiSourceResult['sources'] = [
    { name: 'dexscreener', count: dexResult.pairs.length, error: dexResult.error },
    { name: 'geckoterminal', count: geckoResult.pairs.length, error: geckoResult.error },
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

  addPairs(dexResult.pairs, 'dexscreener');
  addPairs(geckoResult.pairs, 'geckoterminal');

  if (merged.length === 0) {
    return {
      pairs: [],
      sources,
      error: 'All data sources failed',
    };
  }

  return { pairs: merged, sources, error: null };
}

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
