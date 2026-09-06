// src/lib/gemini.ts
// ============================================================
// 🧠 تحليل الذكاء الاصطناعي Gemini
// ✅ تحليل باللغة العربية مع شروحات قوية
// ✅ تستخدم Worker بدلاً من الاتصال المباشر بـ Google
// ✅ يدعم الإشعارات والتنبيهات عند وجود فرص تداول
// ✅ يدعم قرارات البوتات المختلفة (Hunter, Signal, Scalper)
// ============================================================

import type { AIAnalysis, DiscoveredToken } from '@/types';

// ============================================================
// 🌐 Worker URL
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============================================================
// 📊 واجهة قرار البوت والإشعارات
// ============================================================

export interface BotDecision {
  action: 'BUY' | 'WATCH' | 'REJECT';
  confidence: number;
  reason: string;
  score: number;
}

export interface TradeAlert {
  type: 'BUY_SIGNAL' | 'SELL_SIGNAL' | 'STRONG_BUY' | 'STRONG_SELL' | 'WARNING';
  tokenSymbol: string;
  tokenName: string;
  network: string;
  price: number;
  reason: string;
  confidence: number;
  timestamp: number;
}

// ============================================================
// 📢 دالة إرسال الإشعارات
// ============================================================

async function sendTradeAlert(alert: TradeAlert, userId?: string) {
  try {
    const response = await fetch(`${WORKER_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId || '999999',
        type: alert.type === 'STRONG_BUY' ? 'success' : 
              alert.type === 'STRONG_SELL' ? 'error' : 'info',
        message: `🔔 ${alert.type}: ${alert.tokenSymbol} (${alert.tokenName})
💰 السعر: $${alert.price.toFixed(8)}
📊 الثقة: ${alert.confidence}%
📝 السبب: ${alert.reason}
🌐 الشبكة: ${alert.network}`,
        app_id: 'hunter',
        timestamp: new Date().toISOString(),
      }),
    });
    console.log('📢 تم إرسال الإشعار:', alert.tokenSymbol);
  } catch (error) {
    console.warn('⚠️ فشل إرسال الإشعار:', error);
  }
}

// ============================================================
// 🧠 تحليل التوكن عبر Worker مع شروحات قوية
// ============================================================

export async function analyzeToken(
  token: DiscoveredToken,
  botType?: 'hunter' | 'signal' | 'manual' | 'scalper'
): Promise<AIAnalysis> {
  try {
    console.log('🧠 [analyzeToken] الاتصال بـ Worker للتحليل...');

    // ✅ استدعاء الـ Worker
    const response = await fetch(`${WORKER_URL}/analyze-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenAddress: token.tokenAddress,
        network: token.chainId || 'solana',
        symbol: token.symbol,
        name: token.name || token.symbol,
        price: token.priceUsd || 0,
        liquidity: token.liquidityUsd || 0,
        volume24h: token.volume24h || 0,
        priceChange24h: token.priceChange24h || 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.analysis) {
      throw new Error('Invalid response from Worker');
    }

    const analysis = data.analysis;
    console.log('✅ [analyzeToken] تحليل Worker ناجح:', analysis);

    // ✅ بناء الشروحات القوية باللغة العربية
    const signals = analysis.signals || [];
    const recommendation = analysis.recommendation || 'hold';
    const confidence = analysis.confidence || 50;
    const priceUsd = token.priceUsd || 0;

    // ✅ بناء الملخص باللغة العربية مع شروحات قوية
    let summary = analysis.summary || '';
    
    // ✅ إضافة شروحات محسنة بالعربية
    const change24 = token.priceChange24h || 0;
    const liqUsd = token.liquidityUsd || 0;
    const vol24 = token.volume24h || 0;
    const score = token.score || 0;
    const whaleCount = analysis.whaleInfo?.whaleCount || 0;
    const largeBuys = analysis.whaleInfo?.largeBuys || 0;
    const largeSells = analysis.whaleInfo?.largeSells || 0;

    // ✅ بناء تحليل شامل بالعربية
    const detailedSummary = `
📊 **تحليل ${token.symbol} (${token.name})**

📈 **السعر الحالي:** $${priceUsd.toFixed(8)}
📊 **التغير 24 ساعة:** ${change24 > 0 ? '+' : ''}${change24.toFixed(2)}%
💧 **السيولة:** $${liqUsd.toLocaleString()}
📊 **حجم التداول:** $${vol24.toLocaleString()}

${score >= 70 ? '✅ **تقييم إيجابي:** العملة تظهر قوة ملحوظة في السوق.' : ''}
${score >= 50 && score < 70 ? '⚠️ **تقييم متوسط:** العملة تحتاج إلى مراقبة.' : ''}
${score < 50 ? '❌ **تقييم منخفض:** العملة تحمل مخاطر عالية.' : ''}

${change24 > 10 ? '🚀 **زخم صاعد قوي:** السعر في ارتفاع ملحوظ.' : ''}
${change24 < -10 ? '📉 **زخم هابط:** السعر في انخفاض حاد.' : ''}

${liqUsd > 100000 ? '✅ **سيولة جيدة:** تسمح بتنفيذ صفقات كبيرة.' : '⚠️ **سيولة منخفضة:** قد تواجه صعوبة في تنفيذ صفقات كبيرة.'}

${whaleCount > 5 ? '🐋 **نشاط حيتان:** هناك محافظ كبيرة نشطة في هذه العملة.' : ''}
${largeBuys > largeSells ? '📈 **ضغط شراء:** عدد المشتريات أكبر من المبيعات.' : ''}
${largeSells > largeBuys ? '📉 **ضغط بيع:** عدد المبيعات أكبر من المشتريات.' : ''}

${summary}
    `.trim();

    // ✅ قرار البوت بناءً على التوصية
    let botDecision: BotDecision = {
      action: 'WATCH',
      confidence: confidence,
      reason: analysis.summary || 'تحليل تلقائي',
      score: score,
    };

    if (recommendation === 'strong_buy' || recommendation === 'buy') {
      botDecision.action = 'BUY';
    } else if (recommendation === 'strong_sell' || recommendation === 'sell') {
      botDecision.action = 'REJECT';
    }

    // ✅ منطق خاص لكل نوع بوت (محسن)
    if (botType === 'hunter') {
      if (score >= 60 && (token.volume24h || 0) > 100000 && change24 > 0) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(95, 60 + score * 0.3);
        botDecision.reason = `عملة ${token.symbol} تظهر زخماً قوياً مع سيولة جيدة ونشاط شراء مرتفع.`;
        
        // ✅ إرسال إشعار لـ Hunter
        await sendTradeAlert({
          type: 'STRONG_BUY',
          tokenSymbol: token.symbol,
          tokenName: token.name || token.symbol,
          network: token.chainId || 'solana',
          price: priceUsd,
          reason: botDecision.reason,
          confidence: botDecision.confidence,
          timestamp: Date.now(),
        });
      } else if (score >= 40) {
        botDecision.action = 'WATCH';
        botDecision.confidence = 40;
        botDecision.reason = `عملة ${token.symbol} تحتاج مراقبة إضافية.`;
      } else {
        botDecision.action = 'REJECT';
        botDecision.confidence = 20;
        botDecision.reason = `عملة ${token.symbol} لا تستوفي معايير Hunter.`;
      }
    } else if (botType === 'signal') {
      if (change24 > 3 && (token.volume24h || 0) > 50000) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(90, 50 + change24 * 5);
        botDecision.reason = `إشارات فنية إيجابية على ${token.symbol} مع زخم قوي وحجم تداول جيد.`;
        
        // ✅ إرسال إشعار لـ Signal
        await sendTradeAlert({
          type: 'BUY_SIGNAL',
          tokenSymbol: token.symbol,
          tokenName: token.name || token.symbol,
          network: token.chainId || 'solana',
          price: priceUsd,
          reason: botDecision.reason,
          confidence: botDecision.confidence,
          timestamp: Date.now(),
        });
      } else if (change24 > 1) {
        botDecision.action = 'WATCH';
        botDecision.confidence = 35;
        botDecision.reason = `إشارات فنية متوسطة على ${token.symbol}.`;
      } else {
        botDecision.action = 'REJECT';
        botDecision.confidence = 15;
        botDecision.reason = `إشارات فنية ضعيفة على ${token.symbol}.`;
      }
    } else if (botType === 'scalper') {
      if (change24 < -2 && (token.volume24h || 0) > 100000 && (token.liquidityUsd || 0) > 50000) {
        botDecision.action = 'BUY';
        botDecision.confidence = Math.min(85, 60 + Math.abs(change24) * 5);
        botDecision.reason = `انخفاض سريع لـ ${token.symbol} مع سيولة جيدة، فرصة شراء لحظية.`;
      } else if (change24 > 5) {
        botDecision.action = 'REJECT';
        botDecision.confidence = 10;
        botDecision.reason = `ارتفاع سريع جداً لـ ${token.symbol}، خطر التصحيح.`;
      } else {
        botDecision.action = 'WATCH';
        botDecision.confidence = 30;
        botDecision.reason = `انتظار حركة سعرية أوضح لـ ${token.symbol}.`;
      }
    }

    // ✅ إذا كانت التوصية قوية، أرسل إشعاراً عاماً
    if (recommendation === 'strong_buy' && confidence > 70) {
      await sendTradeAlert({
        type: 'STRONG_BUY',
        tokenSymbol: token.symbol,
        tokenName: token.name || token.symbol,
        network: token.chainId || 'solana',
        price: priceUsd,
        reason: analysis.summary || `فرصة شراء قوية على ${token.symbol}`,
        confidence: confidence,
        timestamp: Date.now(),
      });
    }

    if (recommendation === 'strong_sell' && confidence > 70) {
      await sendTradeAlert({
        type: 'STRONG_SELL',
        tokenSymbol: token.symbol,
        tokenName: token.name || token.symbol,
        network: token.chainId || 'solana',
        price: priceUsd,
        reason: analysis.summary || `فرصة بيع قوية على ${token.symbol}`,
        confidence: confidence,
        timestamp: Date.now(),
      });
    }

    // ✅ التحليل النهائي مع الشروحات القوية
    return {
      tokenSymbol: token.symbol,
      network: token.chainId || 'solana',
      recommendation: recommendation as 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell',
      confidence: confidence,
      summary: detailedSummary,
      summary_ar: detailedSummary,
      signals: signals,
      priceTarget: analysis.priceTarget || priceUsd * 1.1,
      riskLevel: analysis.riskLevel || 'medium',
      timestamp: Date.now(),
      botDecision: botDecision,
      additionalAnalysis: {
        buyRatio: 50,
        volumeToLiquidityRatio: (token.liquidityUsd || 1) > 0 ? (token.volume24h || 0) / (token.liquidityUsd || 1) : 0,
        whaleCount: analysis.whaleInfo?.whaleCount || 0,
        whaleBuying: (analysis.whaleInfo?.largeBuys || 0) > (analysis.whaleInfo?.largeSells || 0),
        isNew: (token.age || 0) < 3600,
        isMomentum: (token.priceChange24h || 0) > 20,
      },
    };
  } catch (error) {
    console.error('❌ فشل تحليل Worker، الانتقال للتحليل السريع:', error);
    return quickAnalysis(token);
  }
}

// ============================================================
// 🧠 تحليل سريع بدون Gemini (للحالات الطارئة)
// ============================================================

export function quickAnalysis(token: DiscoveredToken): AIAnalysis {
  const priceUsd = token.priceUsd || 0;
  const vol24 = token.volume24h || 0;
  const liqUsd = token.liquidityUsd || 0;
  const change24 = token.priceChange24h || 0;
  const txns24 = token.txns24h || { buys: 0, sells: 0 };
  const score = token.score || 0;

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
    network: token.chainId || 'solana',
    recommendation,
    confidence,
    summary: `📊 تحليل سريع لـ ${token.symbol}

💰 السعر: $${priceUsd.toFixed(8)}
📊 التغير 24 ساعة: ${change24 > 0 ? '+' : ''}${change24.toFixed(2)}%
💧 السيولة: $${liqUsd.toLocaleString()}
📊 الحجم: $${vol24.toLocaleString()}
⭐ النقاط: ${score}/100

${score >= 70 ? '✅ توصية إيجابية' : score >= 50 ? '⚠️ توصية محايدة' : '❌ توصية سلبية'}`,
    summary_ar: `تحليل سريع لـ ${token.symbol}`,
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
      action: recommendation === 'strong_buy' || recommendation === 'buy' ? 'BUY' : recommendation === 'sell' || recommendation === 'strong_sell' ? 'REJECT' : 'WATCH',
      confidence: confidence,
      reason: `تحليل سريع: النقاط ${score}/100، نسبة الشراء ${buyRatio.toFixed(1)}%`,
      score: score,
    },
    additionalAnalysis: {
      buyRatio,
      volumeToLiquidityRatio: liqUsd > 0 ? vol24 / liqUsd : 0,
      whaleCount: 0,
      whaleBuying: false,
      isNew: false,
      isMomentum: change24 > 20,
    },
  };
}

// ============================================================
// ✅ دالة مساعدة للتحقق من حالة Worker
// ============================================================

export async function checkWorkerStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}/status`);
    const data = await response.json();
    return data.keys?.gemini === true;
  } catch {
    return false;
  }
}
