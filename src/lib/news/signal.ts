// src/lib/news/signal.ts
// ============================================================
// 📈 توليد إشارات التداول من الأخبار
// ============================================================

import type { NewsArticle, NewsSignal, NewsBotConfig } from './types';

export function generateSignals(
  articles: NewsArticle[],
  config: NewsBotConfig
): NewsSignal[] {
  const signals: NewsSignal[] = [];

  // ✅ تجميع الأخبار حسب العملة
  const grouped: Record<string, NewsArticle[]> = {};
  for (const article of articles) {
    // ✅ تصفية حسب العملات المختارة
    const targetCoins = config.coins.length > 0 ? config.coins : [];
    for (const coin of article.mentionedCoins) {
      if (targetCoins.length === 0 || targetCoins.includes(coin)) {
        if (!grouped[coin]) grouped[coin] = [];
        grouped[coin].push(article);
      }
    }
  }

  // ✅ تحليل كل عملة
  for (const [coin, coinArticles] of Object.entries(grouped)) {
    // ✅ حساب متوسط المشاعر
    const avgScore = coinArticles.reduce(
      (sum, a) => sum + a.sentimentScore, 0
    ) / coinArticles.length;

    // ✅ حساب الثقة
    const confidence = Math.min(
      100,
      coinArticles.length * 10 + Math.abs(avgScore) * 0.5
    );

    // ✅ التحقق من الأخبار العاجلة
    const hasBreaking = coinArticles.some(a => a.isBreaking);

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let reason = '';

    // ✅ إذا كان هناك خبر عاجل، نعطي أولوية أعلى
    const threshold = hasBreaking ? config.minSentimentScore * 0.5 : config.minSentimentScore;

    if (avgScore > threshold && confidence > config.minConfidence) {
      action = 'BUY';
      reason = `📈 ${hasBreaking ? '🚨 خبر عاجل! ' : ''}أخبار إيجابية عن ${coin} (${coinArticles.length} خبر، المشاعر: ${avgScore.toFixed(0)})`;
    } else if (avgScore < -threshold && confidence > config.minConfidence) {
      action = 'SELL';
      reason = `📉 ${hasBreaking ? '🚨 خبر عاجل! ' : ''}أخبار سلبية عن ${coin} (${coinArticles.length} خبر، المشاعر: ${avgScore.toFixed(0)})`;
    } else if (hasBreaking) {
      // ✅ إذا كان هناك خبر عاجل ولكن المشاعر محايدة، نعطي تنبيه
      action = 'HOLD';
      reason = `🔔 خبر عاجل عن ${coin} (بحاجة لمتابعة)`;
    } else {
      reason = `⏳ أخبار محايدة عن ${coin} (${coinArticles.length} خبر)`;
    }

    signals.push({
      id: crypto.randomUUID(),
      coin,
      action,
      confidence,
      reason,
      articles: coinArticles,
      timestamp: new Date().toISOString(),
      executed: false,
      isBreaking: hasBreaking,
    });
  }

  return signals;
}