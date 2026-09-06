// src/lib/birdeye.ts
// ============================================================
// 🐋 Birdeye API - النسخة السريعة (مع تقليل التأخير)
// ✅ تناوب المفاتيح
// ✅ إعادة محاولة محدودة (محاولتان فقط)
// ✅ تأخير قصير (500ms)
// ✅ مهلة 5 ثوانٍ للطلبات
// ✅ فشل سريع عند 429 (عدم الانتظار الطويل)
// ============================================================

const BIRDEYE_API_URL = 'https://public-api.birdeye.so';

// ✅ المفاتيح من wrangler.toml
const API_KEYS = [
  'd5efb6b004254910960e831488727733',
  'a470be92f49443269dcd5705ed0fbdbc',
];

let currentKeyIndex = 0;

// ✅ دالة جلب المفتاح النشط (تناوب تلقائي)
function getActiveKey(): string {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

// ✅ دالة التأخير (قصير)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ دالة جلب مع إعادة محاولة محدودة (محاولتان فقط، تأخير 500ms)
async function fetchWithRetry(
  url: string,
  retries: number = 2,
  delayMs: number = 500
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      // ✅ مهلة 5 ثوانٍ للطلب
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': getActiveKey(),
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ✅ إذا كان 429، انتظر قليلاً وأعد المحاولة (مرة واحدة فقط)
      if (response.status === 429) {
        if (i < retries - 1) {
          console.warn(`⚠️ Rate limit (429)، إعادة محاولة سريعة...`);
          await delay(delayMs);
          continue;
        }
        console.warn(`⚠️ Rate limit (429)، تخطي الطلب`);
        return null;
      }

      // ✅ إذا كان خطأ آخر، أعد المحاولة
      if (!response.ok) {
        if (i < retries - 1) {
          await delay(delayMs);
          continue;
        }
        return null;
      }

      return response;
    } catch (error) {
      if (i < retries - 1) {
        await delay(delayMs);
        continue;
      }
      return null;
    }
  }

  return null;
}

// ============================================================
// 📊 1. بيانات السوق الأساسية (مع مهلة قصيرة)
// ============================================================
export async function getTokenMarketData(tokenAddress: string) {
  try {
    const url = `${BIRDEYE_API_URL}/defi/v3/token/market-data?address=${tokenAddress}`;
    const response = await fetchWithRetry(url);
    if (!response) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.warn('⚠️ فشل جلب بيانات السوق (تخطي):', error);
    return null;
  }
}

// ============================================================
// 👥 2. أكبر الحائزين (Top Holders)
// ============================================================
export async function getTopHolders(tokenAddress: string, limit: number = 20) {
  try {
    const url = `${BIRDEYE_API_URL}/defi/v3/token/holder?address=${tokenAddress}&limit=${limit}`;
    const response = await fetchWithRetry(url);
    if (!response) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.warn('⚠️ فشل جلب قائمة الحائزين (تخطي):', error);
    return null;
  }
}

// ============================================================
// 🎯 3. المتداولون المتميزون (مع تصنيفاتهم)
// ============================================================
export async function getTopTraders(
  tokenAddress: string,
  tag?: 'sniper' | 'smart_trader' | 'insider' | 'dev' | 'bundler',
  limit: number = 10
) {
  try {
    let url = `${BIRDEYE_API_URL}/defi/v2/tokens/top_traders?address=${tokenAddress}&limit=${limit}`;
    if (tag) url += `&wallet_tags=${tag}`;
    const response = await fetchWithRetry(url);
    if (!response) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.warn(`⚠️ فشل جلب المتداولين (${tag || 'الكل'}) (تخطي):`, error);
    return null;
  }
}

// ============================================================
// 🐋 4. الحيتان (المحافظ الكبيرة)
// ============================================================
export async function getWhaleWallets(tokenAddress: string, minBalance: number = 100000) {
  try {
    const holders = await getTopHolders(tokenAddress, 100);
    if (!holders?.items) return null;
    
    const price = await getTokenPrice(tokenAddress);
    const whales = holders.items
      .filter((h: any) => h.ui_amount * price > minBalance)
      .map((h: any) => ({
        owner: h.owner,
        amount: h.ui_amount,
        valueUsd: h.ui_amount * price,
        percentage: (h.ui_amount / holders.totalSupply) * 100,
      }))
      .sort((a: any, b: any) => b.valueUsd - a.valueUsd);

    return {
      totalWhales: whales.length,
      whales: whales.slice(0, 20),
      totalWhaleValue: whales.reduce((sum: number, w: any) => sum + w.valueUsd, 0),
      topWhale: whales[0] || null,
    };
  } catch (error) {
    console.warn('⚠️ فشل جلب الحيتان (تخطي):', error);
    return null;
  }
}

// ============================================================
// 💰 5. سعر العملة الحالي
// ============================================================
export async function getTokenPrice(tokenAddress: string): Promise<number> {
  try {
    const data = await getTokenMarketData(tokenAddress);
    return data?.price || 0;
  } catch {
    return 0;
  }
}

// ============================================================
// 📊 6. تحليل متقدم للعملة (مع تأخير قصير بين الطلبات)
// ============================================================
export async function getAdvancedTokenAnalysis(tokenAddress: string) {
  try {
    // ✅ جلب البيانات بالتسلسل مع تأخير 300ms فقط (بدلاً من 500ms)
    const marketData = await getTokenMarketData(tokenAddress);
    await delay(300);

    const holders = await getTopHolders(tokenAddress, 20);
    await delay(300);

    const snipers = await getTopTraders(tokenAddress, 'sniper', 10);
    await delay(300);

    const smartTraders = await getTopTraders(tokenAddress, 'smart_trader', 10);
    await delay(300);

    const insiders = await getTopTraders(tokenAddress, 'insider', 10);
    await delay(300);

    const dev = await getTopTraders(tokenAddress, 'dev', 5);

    // ✅ حساب إحصاءات الحيتان
    const price = marketData?.price || 0;
    const whaleData = holders?.items
      ?.filter((h: any) => h.ui_amount * price > 100000)
      .map((h: any) => ({
        owner: h.owner,
        amount: h.ui_amount,
        valueUsd: h.ui_amount * price,
        percentage: (h.ui_amount / holders.totalSupply) * 100,
      })) || [];

    return {
      marketData,
      holders: {
        total: holders?.holder || 0,
        top10Percent: holders?.top10_hold_percent || 0,
        topHolders: holders?.items?.slice(0, 10) || [],
      },
      whales: {
        total: whaleData.length,
        list: whaleData.slice(0, 20),
        totalValue: whaleData.reduce((sum: number, w: any) => sum + w.valueUsd, 0),
        topWhale: whaleData[0] || null,
      },
      snipers: snipers || [],
      smartTraders: smartTraders || [],
      insiders: insiders || [],
      dev: dev || [],
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn('⚠️ فشل جلب التحليل المتقدم (تخطي):', error);
    return null;
  }
}

// ============================================================
// 🏷️ تصنيفات المتداولين
// ============================================================
export const TRADER_TAGS = {
  SNIPER: 'sniper',
  SMART_TRADER: 'smart_trader',
  INSIDER: 'insider',
  DEV: 'dev',
  BUNDLER: 'bundler',
} as const;

export type TraderTag = typeof TRADER_TAGS[keyof typeof TRADER_TAGS];