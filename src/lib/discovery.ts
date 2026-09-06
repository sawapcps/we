// src/lib/discovery.ts
// ============================================================
// 🔥 اكتشاف العملات - DexScreener + GeckoTerminal + تصفية بالزخم
// ✅ يدعم DexScreener كمصدر رئيسي
// ✅ يدعم GeckoTerminal كمصدر إضافي
// ✅ تصفية العملات ذات الزخم العالي
// ✅ ترتيب حسب الزخم (الأعلى أولاً)
// ✅ إزالة التكرار تلقائياً
// ✅ تحويل TokenPair → DiscoveredToken لـ botEngine
// ============================================================

import type { TokenPair, ChainId, DiscoveredToken } from '@/types';
import { searchPairs } from '@/lib/dexscreener';
import { discoverGeckoPairs } from '@/lib/geckoterminal';

// ============================================================
// 📊 الأنواع
// ============================================================

export type DataSource = 'dexscreener' | 'geckoterminal' | 'new_pairs' | 'trending';

export interface MultiSourceResult {
  pairs: TokenPair[];
  sources: { name: DataSource; count: number; error: string | null }[];
  error: string | null;
  totalPairs: number;
}

// ============================================================
// 🔄 دالة تحويل TokenPair → DiscoveredToken
// ============================================================

function pairToDiscoveredToken(pair: TokenPair): DiscoveredToken | null {
  // ✅ التحقق من وجود عنوان
  const tokenAddress = pair.baseToken?.address;
  if (!tokenAddress || tokenAddress === '') {
    return null;
  }

  const priceUsd = parseFloat(pair.priceUsd || '0');
  const volume24h = pair.volume?.h24 || 0;
  const liquidityUsd = pair.liquidity?.usd || 0;
  const txns24h = pair.txns?.h24 || { buys: 0, sells: 0 };
  const priceChange = pair.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 };
  const symbol = pair.baseToken?.symbol || '??';
  const name = pair.baseToken?.name || symbol;

  return {
    chainId: pair.chainId as ChainId,
    tokenAddress,
    name,
    symbol,
    bestPair: pair,
    allPairs: [pair],
    priceUsd,
    volume24h,
    liquidityUsd,
    marketCap: pair.marketCap || null,
    fdv: pair.fdv || null,
    priceChange: {
      m5: priceChange.m5 || 0,
      h1: priceChange.h1 || 0,
      h6: priceChange.h6 || 0,
      h24: priceChange.h24 || 0,
    },
    txns24h: {
      buys: txns24h.buys || 0,
      sells: txns24h.sells || 0,
    },
    pairAge: pair.pairCreatedAt || null,
    pairCreatedAt: pair.pairCreatedAt || null,
    dexId: pair.dexId || '',
    pairAddress: pair.pairAddress || '',
    boosts: pair.boosts?.active || 0,
    score: 0,
    status: 'reject',
    securityFlags: [],
    source: pair.chainId === 'solana' ? 'dexscreener' : 'geckoterminal',
    strategy: 'established',
  };
}

// ============================================================
// 🔥 تصفية العملات ذات الزخم العالي (تعمل على TokenPair)
// ============================================================

export function filterByMomentum(pairs: TokenPair[], minScore: number = 0): TokenPair[] {
  const scored = pairs.map(p => {
    const momentumScore = 
      (p.priceChange?.m5 || 0) * 2 +
      (p.priceChange?.h1 || 0) * 1.5 +
      (p.priceChange?.h6 || 0) * 0.8;
    
    return {
      ...p,
      _momentumScore: momentumScore,
    };
  });

  scored.sort((a, b) => (b._momentumScore || 0) - (a._momentumScore || 0));
  const filtered = scored.filter(p => p._momentumScore > minScore);

  console.log(`🔥 تم اختيار ${filtered.length} عملة ذات زخم عالٍ من ${pairs.length}`);
  
  return filtered;
}

// ============================================================
// 🔥 جلب العملات النشطة (تعيد TokenPair[] - للتوافق مع الصفحات)
// ============================================================

export async function discoverActivePairs(
  network: ChainId,
  limit: number = 50
): Promise<{
  pairs: TokenPair[];
  sources: { name: string; count: number; error?: string }[];
  error?: string;
  totalPairs: number;
}> {
  const startTime = Date.now();
  console.log(`🔥 جلب العملات النشطة لـ ${network}...`);

  try {
    let dexPairs: TokenPair[] = [];
    let dexError: string | null = null;
    try {
      const results = await searchPairs(network);
      dexPairs = results.filter(p => p.chainId?.toLowerCase() === network.toLowerCase());
      console.log(`📊 DexScreener: ${dexPairs.length} زوج`);
    } catch (error) {
      dexError = error instanceof Error ? error.message : 'فشل DexScreener';
      console.warn('⚠️ DexScreener فشل:', dexError);
    }

    let geckoPairs: TokenPair[] = [];
    let geckoError: string | null = null;
    try {
      const geckoResult = await discoverGeckoPairs(network, 50);
      geckoPairs = geckoResult.pairs || [];
      geckoError = geckoResult.error || null;
      console.log(`📊 GeckoTerminal: ${geckoPairs.length} زوج`);
    } catch (error) {
      geckoError = error instanceof Error ? error.message : 'فشل GeckoTerminal';
      console.warn('⚠️ GeckoTerminal فشل:', geckoError);
    }

    const seen = new Set<string>();
    const merged: TokenPair[] = [];

    const addPairs = (pairs: TokenPair[]) => {
      for (const p of pairs) {
        const key = `${p.chainId}:${p.pairAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      }
    };

    addPairs(geckoPairs);
    addPairs(dexPairs);

    console.log(`📊 إجمالي الأزواج قبل التصفية: ${merged.length}`);

    const activePairs = filterByMomentum(merged, 0);

    activePairs.sort((a, b) => {
      const momentumA = (a.priceChange?.h1 || 0) + (a.priceChange?.h6 || 0);
      const momentumB = (b.priceChange?.h1 || 0) + (b.priceChange?.h6 || 0);
      return momentumB - momentumA;
    });

    const limitedPairs = activePairs.slice(0, limit);

    const elapsed = Date.now() - startTime;
    console.log(`✅ تم جلب ${limitedPairs.length} عملة نشطة في ${elapsed}ms`);

    return {
      pairs: limitedPairs,
      sources: [
        { name: 'dexscreener', count: dexPairs.length, error: dexError || undefined },
        { name: 'geckoterminal', count: geckoPairs.length, error: geckoError || undefined },
      ],
      totalPairs: merged.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'فشل اكتشاف الأزواج';
    console.error('❌ خطأ:', msg);
    return {
      pairs: [],
      sources: [{ name: 'dexscreener', count: 0, error: msg }],
      error: msg,
      totalPairs: 0,
    };
  }
}

// ============================================================
// 📡 الدالة الرئيسية (للتوافق مع الكود القديم - تعيد TokenPair[])
// ============================================================

export async function discoverAllPairs(
  network: ChainId,
  limit: number = 50
): Promise<{
  pairs: TokenPair[];
  sources: { name: string; count: number; error?: string }[];
  error?: string;
  totalPairs: number;
}> {
  return discoverActivePairs(network, limit);
}

// ============================================================
// 🆕 دالة جديدة لجلب DiscoveredToken[] مباشرة (لـ botEngine)
// ============================================================

export async function discoverAllTokens(
  network: ChainId,
  limit: number = 50
): Promise<{
  pairs: DiscoveredToken[];
  sources: { name: string; count: number; error?: string }[];
  error?: string;
  totalPairs: number;
}> {
  const result = await discoverActivePairs(network, limit * 2);
  
  const tokens = result.pairs
    .map(pairToDiscoveredToken)
    .filter((t): t is DiscoveredToken => t !== null)
    .slice(0, limit);

  return {
    pairs: tokens,
    sources: result.sources,
    error: result.error,
    totalPairs: result.totalPairs,
  };
}

// ============================================================
// 🆕 جلب العملات الجديدة فقط
// ============================================================

export async function discoverNewPairsOnly(
  network: ChainId,
  limit: number = 20
): Promise<MultiSourceResult> {
  try {
    const geckoResult = await discoverGeckoPairs(network, limit);
    const dexResults = await searchPairs(network);
    const newDex = dexResults
      .filter(p => p.chainId?.toLowerCase() === network.toLowerCase())
      .filter(p => {
        if (!p.pairCreatedAt) return false;
        const ageHours = (Date.now() - p.pairCreatedAt) / (1000 * 60 * 60);
        return ageHours < 24;
      });

    const seen = new Set<string>();
    const merged: TokenPair[] = [];

    const addPairs = (pairs: TokenPair[]) => {
      for (const p of pairs) {
        const key = `${p.chainId}:${p.pairAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(p);
        }
      }
    };

    addPairs(geckoResult.pairs);
    addPairs(newDex);

    const activeMerged = filterByMomentum(merged, 0);

    activeMerged.sort((a, b) => {
      const dateA = a.pairCreatedAt || 0;
      const dateB = b.pairCreatedAt || 0;
      return dateB - dateA;
    });

    return {
      pairs: activeMerged.slice(0, limit),
      sources: [
        { name: 'geckoterminal', count: geckoResult.pairs.length, error: geckoResult.error || null },
        { name: 'dexscreener', count: newDex.length, error: null },
      ],
      error: null,
      totalPairs: merged.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'فشل جلب العملات الجديدة';
    return {
      pairs: [],
      sources: [{ name: 'geckoterminal', count: 0, error: msg }],
      error: msg,
      totalPairs: 0,
    };
  }
}

// ============================================================
// 🌟 جلب العملات الرائجة (Trending)
// ============================================================

export async function getTrendingGlobal(limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs('trending');
    const active = filterByMomentum(results, 0);
    return active.slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================
// ⚡ جلب العملات المدعومة (Boosted)
// ============================================================

export async function getLatestBoosted(limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs('boosted');
    const active = filterByMomentum(results, 0);
    return active.slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================
// 🌐 جلب العملات من شبكات متعددة
// ============================================================

export async function discoverAllPairsMultiNetwork(
  networks: ChainId[],
  limit: number = 30
): Promise<Map<ChainId, MultiSourceResult>> {
  const results = new Map<ChainId, MultiSourceResult>();
  
  const settled = await Promise.allSettled(
    networks.map(n => discoverActivePairs(n, limit))
  );

  networks.forEach((network, i) => {
    const result = settled[i];
    if (result && result.status === 'fulfilled') {
      const data = result.value;
      results.set(network, {
        pairs: data.pairs,
        sources: data.sources.map(s => ({ ...s, error: s.error || null })),
        error: data.error || null,
        totalPairs: data.totalPairs || data.pairs.length,
      });
    } else {
      const error = result && result.status === 'rejected' ? String(result.reason) : 'فشل';
      results.set(network, {
        pairs: [],
        sources: [{ name: 'dexscreener', count: 0, error }],
        error,
        totalPairs: 0,
      });
    }
  });

  return results;
}

// ============================================================
// 🔍 البحث عن عملة معينة
// ============================================================

export async function searchTokenPairs(query: string, limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs(query);
    const active = filterByMomentum(results, 0);
    return active.slice(0, limit);
  } catch (error) {
    console.error('❌ فشل البحث:', error);
    return [];
  }
}

// ============================================================
// 📊 دالة مساعدة للحصول على إحصائيات سريعة
// ============================================================

export function getQuickStats(tokens: TokenPair[]): {
  total: number;
  avgLiquidity: number;
  avgVolume: number;
  newCount: number;
  activeCount: number;
} {
  const now = Date.now();
  const newCount = tokens.filter(t => {
    if (!t.pairCreatedAt) return false;
    const ageHours = (now - t.pairCreatedAt) / (1000 * 60 * 60);
    return ageHours < 24;
  }).length;

  const activeCount = tokens.filter(t => {
    const momentum = (t.priceChange?.h1 || 0) + (t.priceChange?.h6 || 0);
    return momentum > 0;
  }).length;

  const avgLiquidity = tokens.reduce((sum, t) => sum + (t.liquidity?.usd || 0), 0) / (tokens.length || 1);
  const avgVolume = tokens.reduce((sum, t) => sum + (t.volume?.h24 || 0), 0) / (tokens.length || 1);

  return {
    total: tokens.length,
    avgLiquidity,
    avgVolume,
    newCount,
    activeCount,
  };
}