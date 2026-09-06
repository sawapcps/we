// src/lib/news/analyzer.ts
// ============================================================
// 📊 تحليل الأخبار واستخراج العملات والمشاعر
// ============================================================

import type { NewsArticle } from './types';
import { isBreakingNews } from './fetcher';

// ✅ كلمات إيجابية وسلبية
const POSITIVE_WORDS = [
  'bull', 'rally', 'surge', 'breakout', 'partnership', 'listing',
  'adoption', 'upgrade', 'win', 'success', 'approve', 'launch',
  'innovation', 'growth', 'record', 'moon', 'pump', 'skyrocket'
];

const NEGATIVE_WORDS = [
  'bear', 'dump', 'crash', 'hack', 'exploit', 'rug', 'scam',
  'fraud', 'lawsuit', 'ban', 'fail', 'decline', 'reject',
  'investigation', 'warning', 'risk', 'collapse', 'panic'
];

// ✅ العملات المعروفة
const KNOWN_COINS: Record<string, string[]> = {
  'bitcoin': ['BTC'],
  'ethereum': ['ETH'],
  'solana': ['SOL'],
  'ripple': ['XRP'],
  'bnb': ['BNB'],
  'cardano': ['ADA'],
  'dogecoin': ['DOGE'],
  'polygon': ['POL'],
  'avalanche': ['AVAX'],
  'arbitrum': ['ARB'],
  'optimism': ['OP'],
  'base': ['BASE'],
  'binance': ['BNB'],
};

export function analyzeArticle(article: Partial<NewsArticle>): NewsArticle {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  
  // ✅ حساب درجة المشاعر
  let score = 0;
  for (const word of POSITIVE_WORDS) {
    if (text.includes(word)) score += 10;
  }
  for (const word of NEGATIVE_WORDS) {
    if (text.includes(word)) score -= 10;
  }

  // ✅ تحديد العملات المذكورة
  const mentionedCoins: string[] = [];
  for (const [name, symbols] of Object.entries(KNOWN_COINS)) {
    if (text.includes(name)) {
      mentionedCoins.push(...symbols);
    }
  }

  // ✅ تحديد المشاعر
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 20) sentiment = 'positive';
  else if (score < -20) sentiment = 'negative';

  return {
    id: article.id || crypto.randomUUID(),
    title: article.title || '',
    description: article.description || '',
    url: article.url || '',
    source: article.source || 'Unknown',
    publishedAt: article.publishedAt || new Date().toISOString(),
    sentiment,
    sentimentScore: score,
    mentionedCoins: [...new Set(mentionedCoins)],
    isBreaking: article.isBreaking || isBreakingNews(article as NewsArticle),
    imageUrl: article.imageUrl,
  };
}