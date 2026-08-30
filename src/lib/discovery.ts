// src/lib/discovery.ts
// ============================================================
// ?? اكتشاف العملات - DexScreener + GeckoTerminal (سريع ومستقر)
// ? يدعم DexScreener كمصدر رئيسي
// ? يدعم GeckoTerminal كمصدر إضافي
// ? إزالة التكرار تلقائياً
// ? ترتيب حسب الأحدث
// ? مهلة قصيرة لتجنب التعلق
// ============================================================

import type { TokenPair, ChainId } from '@/types';
import { searchPairs } from '@/lib/dexscreener';
import { discoverGeckoPairs } from '@/lib/geckoterminal';

// ============================================================
// ?? الأنواع
// ============================================================

export type DataSource = 'dexscreener' | 'geckoterminal' | 'new_pairs' | 'trending';

export interface MultiSourceResult {
  pairs: TokenPair[];
  sources: { name: DataSource; count: number; error: string | null }[];
  error: string | null;
  totalPairs: number;
}

// ============================================================
// ?? الدالة الرئيسية - تجلب كل شيء (DexScreener + GeckoTerminal)
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
  const startTime = Date.now();
  console.log(`?? جلب الأزواج لـ ${network}...`);

  try {
    // ? 1. جلب من DexScreener (المصدر الرئيسي)
    let dexPairs: TokenPair[] = [];
    try {
      const results = await searchPairs(network);
      dexPairs = results.filter(p => p.chainId?.toLowerCase() === network.toLowerCase());
      console.log(`? DexScreener: ${dexPairs.length} زوج`);
    } catch (error) {
      console.warn('?? DexScreener فشل:', error);
    }

    // ? 2. جلب من GeckoTerminal (مصدر إضافي)
    let geckoPairs: TokenPair[] = [];
    let geckoError: string | null = null;
    try {
      const geckoResult = await discoverGeckoPairs(network, 30);
      geckoPairs = geckoResult.pairs || [];
      geckoError = geckoResult.error || null;
      console.log(`? GeckoTerminal: ${geckoPairs.length} زوج`);
    } catch (error) {
      geckoError = error instanceof Error ? error.message : 'فشل GeckoTerminal';
      console.warn('?? GeckoTerminal فشل:', geckoError);
    }

    // ? 3. دمج النتائج وإزالة التكرار
    const seen = new Set<string>();
    const merged: TokenPair[] = [];

    const addPairs = (pairs: TokenPair[], source: string) => {
      for (const p of pairs) {
        const key = `${p.chainId}:${p.pairAddress}`;
        if (!seen.has(key)) {
          seen.add(key);
          // إضافة مصدر للتوضيح
          (p as any)._source = source;
          merged.push(p);
        }
      }
    };

    // ? إضافة GeckoTerminal أولاً (للعملات الجديدة)
    addPairs(geckoPairs, 'geckoterminal');
    // ? إضافة DexScreener (للعملات الراسخة)
    addPairs(dexPairs, 'dexscreener');

    // ? 4. ترتيب حسب الأحدث
    merged.sort((a, b) => {
      const dateA = a.pairCreatedAt || 0;
      const dateB = b.pairCreatedAt || 0;
      return dateB - dateA;
    });

    // ? 5. تحديد العدد النهائي
    const limitedPairs = merged.slice(0, limit);

    const elapsed = Date.now() - startTime;
    console.log(`? تم جلب ${limitedPairs.length} زوج لـ ${network} في ${elapsed}ms`);

    return {
      pairs: limitedPairs,
      sources: [
        { name: 'dexscreener', count: dexPairs.length },
        { name: 'geckoterminal', count: geckoPairs.length, error: geckoError || undefined },
      ],
      totalPairs: merged.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'فشل اكتشاف الأزواج';
    console.error('? خطأ:', msg);
    return {
      pairs: [],
      sources: [{ name: 'dexscreener', count: 0, error: msg }],
      error: msg,
      totalPairs: 0,
    };
  }
}

// ============================================================
// ?? جلب العملات الجديدة فقط
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

    // دمج النتائج
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

    merged.sort((a, b) => {
      const dateA = a.pairCreatedAt || 0;
      const dateB = b.pairCreatedAt || 0;
      return dateB - dateA;
    });

    return {
      pairs: merged.slice(0, limit),
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
// ?? جلب العملات الرائجة (Trending)
// ============================================================

export async function getTrendingGlobal(limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs('trending');
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================
// ?? جلب العملات المدعومة (Boosted)
// ============================================================

export async function getLatestBoosted(limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs('boosted');
    return results.slice(0, limit);
  } catch {
    return [];
  }
}

// ============================================================
// ?? جلب العملات من شبكات متعددة
// ============================================================

export async function discoverAllPairsMultiNetwork(
  networks: ChainId[],
  limit: number = 30
): Promise<Map<ChainId, MultiSourceResult>> {
  const results = new Map<ChainId, MultiSourceResult>();
  
  const settled = await Promise.allSettled(
    networks.map(n => discoverAllPairs(n, limit))
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
// ?? البحث عن عملة معينة
// ============================================================

export async function searchTokenPairs(query: string, limit: number = 20): Promise<TokenPair[]> {
  try {
    const results = await searchPairs(query);
    return results.slice(0, limit);
  } catch (error) {
    console.error('? فشل البحث:', error);
    return [];
  }
}

// ============================================================
// ?? دالة مساعدة للحصول على إحصائيات سريعة
// ============================================================

export function getQuickStats(tokens: TokenPair[]): {
  total: number;
  avgLiquidity: number;
  avgVolume: number;
  newCount: number;
} {
  const now = Date.now();
  const newCount = tokens.filter(t => {
    if (!t.pairCreatedAt) return false;
    const ageHours = (now - t.pairCreatedAt) / (1000 * 60 * 60);
    return ageHours < 24;
  }).length;

  const avgLiquidity = tokens.reduce((sum, t) => sum + (t.liquidity?.usd || 0), 0) / (tokens.length || 1);
  const avgVolume = tokens.reduce((sum, t) => sum + (t.volume?.h24 || 0), 0) / (tokens.length || 1);

  return {
    total: tokens.length,
    avgLiquidity,
    avgVolume,
    newCount,
  };
}