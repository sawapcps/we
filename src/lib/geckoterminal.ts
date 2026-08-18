// src/lib/geckoterminal.ts

import type { TokenPair, ChainId } from '@/types';

const BASE = 'https://api.geckoterminal.com/api/v2';

const NETWORK_MAP: Record<ChainId, string> = {
  // ============ ÇäÔÈãÇÊ ÇäÑÆêÓêÉ ============
  solana: 'solana',
  ethereum: 'eth',
  bsc: 'bsc',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  optimism: 'optimistic',

  // ============ ÇäÔÈãÇÊ ÇäÌÏêÏÉ ============
  robinhood: 'robinhood',
  ronin: 'ronin',
  sui: 'sui',
  ton: 'ton',
  pulsechain: 'pulsechain',
  worldchain: 'worldchain',
  hyperevm: 'hyperevm',
  mantle: 'mantle',
  cronos: 'cronos',
  monad: 'monad',
  hyperliquid: 'hyperliquid',
  abstract: 'abstract',
  tron: 'tron',
  sonic: 'sonic',
  hedera: 'hedera',
  ink: 'ink',
  berachain: 'berachain',
  near: 'near',
  multiversx: 'multiversx',
  zksync: 'zksync',
  linea: 'linea',
  plasma: 'plasma',
  fantom: 'fantom',
  icp: 'icp',
  megaeeth: 'megaeeth',
  algorand: 'algorand',
  polkadot: 'polkadot',
  sei: 'sei',
  opbnb: 'opbnb',
  apechain: 'apechain',
  flare: 'flare',
  aptos: 'aptos',
  flow: 'flow',
  soneium: 'soneium',
  starknet: 'starknet',
  celo: 'celo',
  unichain: 'unichain',
  blast: 'blast',
  metis: 'metis',
  cardano: 'cardano',
  stacks: 'stacks',
  conflux: 'conflux',
  harmony: 'harmony',
  story: 'story',
  kava: 'kava',
  scroll: 'scroll',
  dogechain: 'dogechain',
  injective: 'injective',
  venom: 'venom',
  beam: 'beam',
  taiko: 'taiko',
  movement: 'movement',
  vana: 'vana',
  zkfair: 'zkfair',
  neon: 'neon',
  mode: 'mode',
  moonriver: 'moonriver',
  fuse: 'fuse',
};

export function getGeckoNetwork(chainId: ChainId): string {
  return NETWORK_MAP[chainId] ?? chainId;
}

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    base_token_price_usd: string | null;
    quote_token_price_usd: string | null;
    pool_created_at: string | null;
    reserve_in_usd: string | null;
    fdv_usd: string | null;
    market_cap_usd: string | null;
    volume_usd: { h24: string; h6: string; h1: string; m15: string };
    sales: { h24: { buys: number; sells: number } };
    price_change_percentage: { h24: string; h6: string; h1: string; m15: string };
    transactions: { h24: { buys: number; sells: number; buyers: number; sellers: number } };
  };
  relationships: {
    base_token: { data: { id: string } };
    quote_token: { data: { id: string } };
    dex: { data: { id: string } };
  };
}

interface GeckoResponse {
  data: GeckoPool[];
  included?: {
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
    };
  }[];
}

function parseTokenId(tokenId: string): { chain: string; address: string } {
  const parts = tokenId.split('_');
  return { chain: parts[0], address: parts.slice(1).join('_') };
}

function poolToTokenPair(pool: GeckoPool, included: GeckoResponse['included']): TokenPair {
  const baseTokenId = pool.relationships.base_token.data.id;
  const quoteTokenId = pool.relationships.quote_token.data.id;
  const dexId = pool.relationships.dex.data.id;

  const baseIncluded = included?.find((i) => i.id === baseTokenId);
  const quoteIncluded = included?.find((i) => i.id === quoteTokenId);

  const baseAddr = baseIncluded?.attributes.address ?? parseTokenId(baseTokenId).address;
  const quoteAddr = quoteIncluded?.attributes.address ?? parseTokenId(quoteTokenId).address;

  const a = pool.attributes;

  return {
    chainId: parseTokenId(baseTokenId).chain,
    dexId,
    url: `https://www.geckoterminal.com/${parseTokenId(baseTokenId).chain}/pools/${pool.attributes.address}`,
    pairAddress: a.address,
    labels: null,
    baseToken: {
      address: baseAddr,
      name: baseIncluded?.attributes.name ?? a.name.split('/')[0]?.trim() ?? 'Unknown',
      symbol: baseIncluded?.attributes.symbol ?? a.name.split('/')[0]?.trim() ?? 'Unknown',
    },
    quoteToken: {
      address: quoteAddr,
      name: quoteIncluded?.attributes.name ?? a.name.split('/')[1]?.trim() ?? 'Unknown',
      symbol: quoteIncluded?.attributes.symbol ?? a.name.split('/')[1]?.trim() ?? 'Unknown',
    },
    priceNative: a.base_token_price_usd ?? '0',
    priceUsd: a.base_token_price_usd,
    txns: {
      h24: a.transactions?.h24 ?? { buys: 0, sells: 0 },
      h6: a.transactions?.h6 ?? { buys: 0, sells: 0 },
      h1: a.transactions?.h1 ?? { buys: 0, sells: 0 },
      m5: a.transactions?.m15 ?? { buys: 0, sells: 0 },
    },
    volume: {
      h24: parseFloat(a.volume_usd?.h24 ?? '0'),
      h6: parseFloat(a.volume_usd?.h6 ?? '0'),
      h1: parseFloat(a.volume_usd?.h1 ?? '0'),
      m5: parseFloat(a.volume_usd?.m15 ?? '0'),
    },
    priceChange: a.price_change_percentage
      ? {
          h24: parseFloat(a.price_change_percentage.h24 ?? '0'),
          h6: parseFloat(a.price_change_percentage.h6 ?? '0'),
          h1: parseFloat(a.price_change_percentage.h1 ?? '0'),
          m5: parseFloat(a.price_change_percentage.m15 ?? '0'),
        }
      : null,
    liquidity: a.reserve_in_usd
      ? { usd: parseFloat(a.reserve_in_usd), base: 0, quote: 0 }
      : null,
    fdv: a.fdv_usd ? parseFloat(a.fdv_usd) : null,
    marketCap: a.market_cap_usd ? parseFloat(a.market_cap_usd) : null,
    pairCreatedAt: a.pool_created_at ? new Date(a.pool_created_at).getTime() : null,
  };
}

async function fetchPools(url: string): Promise<TokenPair[]> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GeckoTerminal API failed: ${res.status}`);
  const data: GeckoResponse = await res.json();
  return (data.data ?? []).map((pool) => poolToTokenPair(pool, data.included));
}

export async function getTrendingPools(network: ChainId): Promise<TokenPair[]> {
  const geckoNet = getGeckoNetwork(network);
  return fetchPools(`${BASE}/networks/${geckoNet}/trending_pools?include=base_token,quote_token`);
}

export async function getNewPools(network: ChainId): Promise<TokenPair[]> {
  const geckoNet = getGeckoNetwork(network);
  return fetchPools(`${BASE}/networks/${geckoNet}/new_pools?include=base_token,quote_token`);
}

export async function getTopPools(network: ChainId, page = 1): Promise<TokenPair[]> {
  const geckoNet = getGeckoNetwork(network);
  return fetchPools(
    `${BASE}/networks/${geckoNet}/pools?include=base_token,quote_token&page=${page}`
  );
}

export async function getTrendingPoolsGlobal(): Promise<TokenPair[]> {
  return fetchPools(`${BASE}/networks/trending_pools?include=base_token,quote_token`);
}

export async function searchGeckoPools(query: string): Promise<TokenPair[]> {
  return fetchPools(
    `${BASE}/search/pools?include=base_token,quote_token&query=${encodeURIComponent(query)}`
  );
}

export interface GeckoDiscoveryResult {
  pairs: TokenPair[];
  error: string | null;
}

export async function discoverGeckoPairs(network: ChainId): Promise<GeckoDiscoveryResult> {
  try {
    const [trending, newPools, topPools] = await Promise.allSettled([
      getTrendingPools(network),
      getNewPools(network),
      getTopPools(network, 1),
    ]);

    const all: TokenPair[] = [];
    const seen = new Set<string>();

    const addPairs = (pairs: TokenPair[]) => {
      for (const p of pairs) {
        const key = `${p.chainId}:${p.pairAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(p);
        }
      }
    };

    if (trending.status === 'fulfilled') addPairs(trending.value);
    if (newPools.status === 'fulfilled') addPairs(newPools.value);
    if (topPools.status === 'fulfilled') addPairs(topPools.value);

    if (all.length === 0) {
      const errors = [trending, newPools, topPools]
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason instanceof Error ? r.reason.message : String(r.reason));
      return { pairs: [], error: errors.join('; ') || 'No data from GeckoTerminal' };
    }

    return { pairs: all, error: null };
  } catch (e) {
    return { pairs: [], error: e instanceof Error ? e.message : 'GeckoTerminal failed' };
  }
}