// src/lib/gemini.ts
// ============================================================
// 🧠 تحليل الذكاء الاصطناعي Gemini - النسخة المصححة والمحسنة
// ✅ تحليل باللغة العربية
// ✅ يعتمد على بيانات حقيقية فقط (بدون بيانات وهمية)
// ✅ يدعم قرارات البوتات المختلفة (Hunter, Signal, Scalper)
// ============================================================

import type { AIAnalysis, ChainId, DiscoveredToken } from '@/types';

// ============================================================
// 🔑 مفتاح Gemini
// ============================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

if (!GEMINI_API_KEY) {
  console.error('❌ VITE_GEMINI_API_KEY غير مضبوط في ملف .env');
}

// ============================================================
// 🧠 نماذج Gemini (مرتبة حسب الأولوية والسرعة)
// ============================================================

const MODELS = [
  'gemini-3.5-flash-lite',   // ? êÙåä (ãåÇ áê ÇäÊ×Èêâ ÇäÂÎÑ)
  'gemini-3.5-flash',        // ÈÏêä
  'gemini-1.5-flash',        // ÈÏêä ÇÍÊêÇ×ê
  'gemini-1.5-pro',          // ÇäÈÏêä ÇäÃÎêÑ
];

// ============================================================
// 📊 واجهة قرار البوت
// ============================================================

export interface BotDecision {
  action: 'BUY' | 'WATCH' | 'REJECT';
  confidence: number;
  reason: string;
  score: number;
}

// ============================================================
// 🔗 جلب بيانات إضافية للتحليل (حقيقية)
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

async function fetchAdditionalData(tokenAddress: string, network: string) {
  try {
    const [dexData, whaleData] = await Promise.all([
      fetch(`${WORKER_URL}/dex-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, network }),
      }).then(r => r.json()),
      fetch(`${WORKER_URL}/whale-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, network }),
      }).then(r => r.json()),
    ]);

    return {
      dex: dexData.success ? dexData.data : null,
      whales: whaleData.success ? whaleData.data : null,
    };
  } catch (error) {
    console.warn('⚠️ فشل جلب بيانات إضافية:', error);
    return { dex: null, whales: null };
  }
}

// ============================================================
// 🧠 استدعاء Gemini API
// ============================================================

export async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('❌ مفتاح Gemini غير موجود. الرجاء إضافة VITE_GEMINI_API_KEY في ملف .env');
  }

  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`🧠 محاولة استخدام النموذج: ${model}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // درجة منخفضة لضمان الالتزام بصيغة JSON
            maxOutputTokens: 1500,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ النموذج ${model} غير متاح:`, errText);
        lastError = new Error(`${model}: ${res.status} ${errText}`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        console.log(`✅ النموذج ${model} استجاب بنجاح`);
        return text;
      }
      
      lastError = new Error(`${model}: استجابة فارغة`);
    } catch (e) {
      console.warn(`⚠️ فشل النموذج ${model}:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error('❌ جميع نماذج Gemini فشلت');
}

// ============================================================
// 🧠 تحليل التوكن باستخدام Gemini (باللغة العربية)
// ============================================================

export async function analyzeToken(
  token: DiscoveredToken,
  botType?: 'hunter' | 'signal' | 'manual' | 'scalper'
): Promise<AIAnalysis> {
  const priceUsd = token.priceUsd;
  const vol24 = token.volume24h;
  const liqUsd = token.liquidityUsd;
  const change24 = token.priceChange.h24;
  const change6 = token.priceChange.h6;
  const change1 = token.priceChange.h1;
  const change5 = token.priceChange.m5;
  const txns24 = token.txns24h;
  const mcap = token.marketCap ?? 0;
  const fdv = token.fdv ?? 0;
  const network = token.chainId;
  const score = token.score;
  const numPairs = token.allPairs.length;
  const boosts = token.boosts;
  const strategy = token.strategy || 'established';

  let additionalData = { dex: null, whales: null };
  try {
    additionalData = await fetchAdditionalData(token.tokenAddress, network);
  } catch (e) {
    console.warn('⚠️ فشل جلب بيانات إضافية للتحليل:', e);
  }

  const whaleCount = additionalData.whales?.whaleCount || 0;
  const whaleBuying = additionalData.whales?.buying || false;
  const totalWhaleBalance = additionalData.whales?.totalWhaleBalance || 0;

  const totalTxns = txns24.buys + txns24.sells;
  const buyRatio = totalTxns > 0 ? (txns24.buys / totalTxns) * 100 : 50;
  const volumeToLiquidityRatio = liqUsd > 0 ? vol24 / liqUsd : 0;
  const isNew = strategy === 'new-listing';
  const isMomentum = strategy === 'momentum';

  const prompt = `أنت محلل مالي خبير في العملات الرقمية. حلل هذه العملة وقدم توصية مدعومة بالأرقام.
يجب أن ترجع النتيجة كـ JSON نقي فقط بدون أي أسطر مسبقة أو تنسيقات markdown.

📊 **بيانات العملة:**
- الاسم: ${token.name} (${token.symbol})
- الشبكة: ${network}
- السعر: $${priceUsd.toFixed(6)}
- الحجم (24 ساعة): $${vol24.toLocaleString()}
- السيولة: $${liqUsd.toLocaleString()}
- القيمة السوقية: $${mcap.toLocaleString()}
- التقييم المستقبلي (FDV): $${fdv.toLocaleString()}

📈 **تغيرات السعر:**
- 5 دقائق: ${change5 > 0 ? '+' : ''}${change5.toFixed(2)}%
- 1 ساعة: ${change1 > 0 ? '+' : ''}${change1.toFixed(2)}%
- 6 ساعات: ${change6 > 0 ? '+' : ''}${change6.toFixed(2)}%
- 24 ساعة: ${change24 > 0 ? '+' : ''}${change24.toFixed(2)}%

🔄 **النشاط:**
- المشتريات (24 ساعة): ${txns24.buys}
- المبيعات (24 ساعة): ${txns24.sells}
- نسبة الشراء: ${buyRatio.toFixed(1)}%
- عدد أزواج DEX: ${numPairs}

🐋 **نشاط الحيتان:**
- عدد محافظ الحيتان: ${whaleCount}
- الحيتان تشتري: ${whaleBuying ? 'نعم' : 'لا'}
- إجمالي رصيد الحيتان: $${totalWhaleBalance.toLocaleString()}

📊 **معلومات إضافية:**
- نقاط Hunter: ${score}/100
- نوع العملة: ${isNew ? 'جديدة (أقل من 24 ساعة)' : isMomentum ? 'زخم قوي' : 'راسخة'}
- الترويجات النشطة: ${boosts}

قم بإرجاع كائن JSON يلتزم بالبنية التالية تماماً:
{
  "recommendation": "strong_buy",
  "confidence": 85,
  "summary": "اكتب هنا تحليل شامل باللغة العربية في 3 إلى 4 جمل",
  "priceTarget": ${priceUsd * 1.1},
  "riskLevel": "medium",
  "botDecision": {
    "action": "BUY",
    "confidence": 80,
    "reason": "اكتب هنا سبب القرار بالعربية",
    "score": ${score}
  }
}`;

  try {
    const rawText = await callGemini(prompt);
    // تنظيف النتيجة من أي Markdown Formatting
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    let botDecision: BotDecision = parsed.botDecision || {
      action: 'WATCH',
      confidence: 50,
      reason: 'قرار تلقائي',
      score: score,
    };

    // منطق توجيه قرارات البوتات بمرونة
    if (botType === 'hunter') {
      if (isNew && score >= 60 && buyRatio > 55) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(95, 60 + score * 0.3);
        botDecision.reason = 'عملة جديدة مع زخم قوي ونشاط شراء مرتفع';
      } else if (isNew && score >= 40) {
        botDecision.action = 'WATCH';
        botDecision.confidence = 40;
        botDecision.reason = 'عملة جديدة تحتاج مراقبة إضافية';
      } else {
        botDecision.action = 'REJECT';
        botDecision.confidence = 20;
        botDecision.reason = 'لا تستوفي معايير Hunter';
      }
    } else if (botType === 'signal') {
      if (change1 > 3 && buyRatio > 60 && vol24 > 50000) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(90, 50 + change1 * 5);
        botDecision.reason = 'إشارات فنية إيجابية مع زخم قوي';
      } else if (change1 > 1 && buyRatio > 50) {
        botDecision.action = 'WATCH';
        botDecision.confidence = 35;
        botDecision.reason = 'إشارات فنية متوسطة، مراقبة مطلوبة';
      } else {
        botDecision.action = 'REJECT';
        botDecision.confidence = 15;
        botDecision.reason = 'إشارات فنية ضعيفة';
      }
    } else if (botType === 'scalper') {
      if (change5 < -2 && vol24 > 100000 && liqUsd > 50000) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(85, 60 + Math.abs(change5) * 5);
        botDecision.reason = 'انخفاض سريع مع سيولة جيدة، فرصة شراء';
      } else if (change5 > 5) {
        botDecision.action = 'REJECT';
        botDecision.confidence = 10;
        botDecision.reason = 'ارتفاع سريع جداً، خطر التصحيح';
      } else {
        botDecision.action = 'WATCH';
        botDecision.confidence = 30;
        botDecision.reason = 'انتظار حركة سعرية أوضح';
      }
    }

    return {
      tokenSymbol: token.symbol,
      network,
      recommendation: parsed.recommendation ?? 'hold',
      confidence: parsed.confidence ?? 50,
      summary: parsed.summary ?? `تحليل عملة ${token.symbol}`,
      signals: [
        { label: 'السيولة', value: `$${liqUsd.toLocaleString()}`, bullish: liqUsd > 50000 },
        { label: 'حجم التداول', value: `$${vol24.toLocaleString()}`, bullish: vol24 > 100000 },
        { label: 'اتجاه السعر', value: `${change24 > 0 ? '+' : ''}${change24.toFixed(2)}%`, bullish: change24 > 0 },
        { label: 'نسبة الشراء', value: `${buyRatio.toFixed(1)}%`, bullish: buyRatio > 55 },
      ],
      priceTarget: parsed.priceTarget ?? priceUsd,
      riskLevel: parsed.riskLevel ?? 'medium',
      timestamp: Date.now(),
      botDecision,
      additionalAnalysis: {
        buyRatio,
        volumeToLiquidityRatio,
        whaleCount,
        whaleBuying,
        isNew,
        isMomentum,
      },
    };
  } catch (error) {
    console.error('❌ فشل تحليل Gemini، الانتقال للتحليل السريع التلقائي:', error);
    // الاحتياطي التلقائي لضمان عدم توقف التطبيق عند الخطأ
    return quickAnalysis(token);
  }
}

// ============================================================
// 🧠 تحليل سريع بدون Gemini (للحالات الطارئة)
// ============================================================

export function quickAnalysis(token: DiscoveredToken): AIAnalysis {
  const priceUsd = token.priceUsd;
  const vol24 = token.volume24h;
  const liqUsd = token.liquidityUsd;
  const change24 = token.priceChange.h24;
  const txns24 = token.txns24h;
  const score = token.score;

  const totalTxns = txns24.buys + txns24.sells;
  const buyRatio = totalTxns > 0 ? (txns24.buys / totalTxns) * 100 : 50;

  let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = 'hold';
  let confidence = 30;

  if (score >= 70 && liqUsd > 100000 && vol24 > 200000 && change24 > 5 && buyRatio > 60) {
    recommendation = 'strong_buy';
    confidence = 80;
  } else if (score >= 50 && liqUsd > 50000 && vol24 > 100000 && change24 > 0 && buyRatio > 50) {
    recommendation = 'buy';
    confidence = 60;
  } else if (score >= 30 && liqUsd > 20000 && vol24 > 50000) {
    recommendation = 'hold';
    confidence = 40;
  } else if (change24 < -20 || liqUsd < 10000) {
    recommendation = 'sell';
    confidence = 50;
  }

  return {
    tokenSymbol: token.symbol,
    network: token.chainId,
    recommendation,
    confidence,
    summary: `تحليل سريع بناءً على البيانات المتاحة. النقاط: ${score}/100، السيولة: $${liqUsd.toLocaleString()}، الحجم: $${vol24.toLocaleString()}`,
    signals: [
      { label: 'السيولة', value: `$${liqUsd.toLocaleString()}`, bullish: liqUsd > 50000 },
      { label: 'حجم التداول', value: `$${vol24.toLocaleString()}`, bullish: vol24 > 100000 },
      { label: 'اتجاه السعر', value: `${change24 > 0 ? '+' : ''}${change24.toFixed(2)}%`, bullish: change24 > 0 },
      { label: 'نسبة الشراء', value: `${buyRatio.toFixed(1)}%`, bullish: buyRatio > 55 },
    ],
    priceTarget: priceUsd * (1 + (change24 > 0 ? (change24 / 100) * 0.5 : 0.05)),
    riskLevel: liqUsd < 50000 ? 'high' : liqUsd < 100000 ? 'medium' : 'low',
    timestamp: Date.now(),
    botDecision: {
      action:
        recommendation === 'strong_buy' || recommendation === 'buy'
          ? 'BUY'
          : recommendation === 'sell' || recommendation === 'strong_sell'
          ? 'REJECT'
          : 'WATCH',
      confidence,
      reason: `تحليل سريع: النقاط ${score}/100، نسبة الشراء ${buyRatio.toFixed(1)}%`,
      score,
    },
  };
}


