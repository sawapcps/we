// src/lib/news/fetcher.ts
// ============================================================
// 📰 جلب الأخبار من مصادر متعددة
// ============================================================

import type { NewsArticle } from './types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

export async function fetchNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    // ✅ 1. جلب من CoinDesk
    const coindeskRes = await fetch(`${WORKER_URL}/coindesk-news`);
    if (coindeskRes.ok) {
      const data = await coindeskRes.json();
      if (data.success) {
        articles.push(...data.articles);
        console.log(`✅ CoinDesk: ${data.articles.length} خبر`);
      }
    }

    // ✅ 2. جلب من CryptoCompare
    const ccRes = await fetch(`${WORKER_URL}/cryptocompare-news`);
    if (ccRes.ok) {
      const data = await ccRes.json();
      if (data.success) {
        articles.push(...data.articles);
        console.log(`✅ CryptoCompare: ${data.articles.length} خبر`);
      }
    }

    return articles;
  } catch (error) {
    console.error('❌ فشل جلب الأخبار:', error);
    return [];
  }
}

// ✅ دالة للتحقق من الأخبار العاجلة
export function isBreakingNews(article: NewsArticle): boolean {
  const keywords = ['breaking', 'urgent', 'just in', 'alert', 'flash', 'emergency'];
  const text = `${article.title} ${article.description}`.toLowerCase();
  return keywords.some(k => text.includes(k)) || article.isBreaking;
}

