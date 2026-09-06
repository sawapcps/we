// src/lib/news/types.ts
// ============================================================
// 📰 أنواع بيانات بوت الأخبار
// ============================================================

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  mentionedCoins: string[];
  isBreaking: boolean;
  imageUrl?: string;
}

export interface NewsSignal {
  id: string;
  coin: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  articles: NewsArticle[];
  timestamp: string;
  executed: boolean;
  isBreaking: boolean;
}

export interface NewsBotConfig {
  enabled: boolean;
  checkInterval: number;
  minConfidence: number;
  minSentimentScore: number;
  autoExecute: boolean;
  maxTradesPerDay: number;
  notificationEnabled: boolean;
  breakingNewsOnly: boolean;
  sources: {
    coindesk: boolean;
    cryptocompare: boolean;
    twitter: boolean;
    reddit: boolean;
  };
  coins: string[];
}

export interface NewsAlert {
  id: string;
  type: 'BREAKING' | 'SIGNAL' | 'TRADE' | 'INFO';
  message: string;
  coin?: string;
  timestamp: string;
  read: boolean;
}