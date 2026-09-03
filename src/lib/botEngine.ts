// src/lib/botEngine.ts
// ============================================================
// 🤖 محرك التداول الرئيسي - النسخة النهائية المعدلة
// ✅ يدعم المسح اليدوي/التلقائي مع وضع صامت
// ✅ إشعارات فورية لكل تحركات البوت (اختيار عملة، رصيد، شراء، بيع)
// ✅ يدعم تحديث الشبكات والمسح التلقائي بالوقت المحدد
// ✅ زر المسح التلقائي يعمل بشكل صحيح مع إشعارات
// ============================================================

import type { BotConfig, Trade, ChainId, BotLogEntry, DiscoveredToken } from '@/types';
import { discoverAllPairs } from '@/lib/discovery';
import { runBotAnalysis, getTopRecommendations, type HunterFilters } from '@/lib/hunterEngine';
import { analyzeToken } from '@/lib/gemini';
import { saveTrade, saveLog, generateId, getTimestamp } from '@/lib/madarTech';
import { getNetworkName } from '@/config/networks';
import { BotWalletManager } from '@/lib/wallet';

type LogCallback = (log: BotLogEntry) => void;
type TradeCallback = (trade: Trade) => void;

// ============================================================
// 🔗 Worker URL
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
const DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';

// ============================================================
// 📊 إعدادات المخاطر (مخففة)
// ============================================================

const MAX_PRICE_IMPACT = 0.05;
const MAX_VOLATILITY = 0.50;
const MAX_POSITION_TIME = 24 * 60 * 60 * 1000;
const TRAILING_STOP_PERCENT = 8;
const RISK_PER_TRADE = 2;
const MAX_SELL_RETRIES = 5;
const SELL_RETRY_DELAY = 15000;

// ============================================================
// 📊 حساب حجم الصفقة
// ============================================================

function calculatePositionSize(
  walletBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number
): number {
  const riskAmount = walletBalance * (riskPercent / 100);
  const riskPerToken = Math.abs(entryPrice - stopLossPrice);
  if (riskPerToken <= 0) return 0;
  return riskAmount / riskPerToken;
}

// ============================================================
// 📊 حساب درجة الثقة التقنية (مع تركيز أكبر على الزخم)
// ============================================================

function calculateTechnicalScore(market: DiscoveredToken): number {
  let score = 0;
  
  if (market.liquidityUsd >= 200_000) score += 15;
  else if (market.liquidityUsd >= 50_000) score += 10;
  else if (market.liquidityUsd >= 15_000) score += 5;
  
  const volumeRatio = market.volume24h / Math.max(market.marketCap || 1, 1);
  if (volumeRatio >= 0.20) score += 15;
  else if (volumeRatio >= 0.10) score += 10;
  else if (volumeRatio >= 0.05) score += 5;
  
  // 🔥 الزخم (رفع الوزن)
  if (market.priceChange.m5 > 2) score += 20;
  if (market.priceChange.h1 > 5) score += 25;
  if (market.priceChange.h6 > 8) score += 20;
  
  const totalTxns = market.txns24h.buys + market.txns24h.sells;
  if (totalTxns >= 500) score += 15;
  else if (totalTxns >= 200) score += 10;
  else if (totalTxns >= 50) score += 5;
  
  const buyRatio = market.txns24h.buys / Math.max(totalTxns, 1);
  if (buyRatio > 0.60) score += 10;
  else if (buyRatio > 0.52) score += 5;
  
  return Math.min(score, 100);
}

// ============================================================
// ✅ تنفيذ الصفقة عبر Worker
// ============================================================

async function executeTradeViaWorker(params: {
  side: 'buy' | 'sell';
  network: ChainId;
  tokenAddress: string;
  amountUsd: number;
  pairAddress: string;
  userId: string;
  botId?: string;
}): Promise<{ txHash: string | null; price: number | null; error: string | null }> {
  try {
    const response = await fetch(`${WORKER_URL}/execute-trade?userId=${params.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botId: params.botId || null,
        side: params.side,
        tokenAddress: params.tokenAddress,
        amountUsd: params.amountUsd,
        tokenSymbol: 'UNKNOWN',
        network: params.network,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { txHash: null, price: null, error: `Worker error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    if (!data.success) {
      return { txHash: null, price: null, error: data.error || 'Trade execution failed' };
    }

    return {
      txHash: data.txHash || null,
      price: data.price || null,
      error: null,
    };
  } catch (error) {
    return {
      txHash: null,
      price: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================
// 🤖 فئة TradingBot الرئيسية
// ============================================================

export class TradingBot {
  private config: BotConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onLog: LogCallback;
  private onTrade: TradeCallback;
  private activePositions: Map<string, Trade> = new Map();
  private wallet: BotWalletManager;
  private userId: string;
  private botId?: string;
  
  private dailyTrades: number = 0;
  private lastResetDate: string = '';
  private dynamicMaxTrades: number = 5;
  
  private pendingTrades: Map<string, {
    tokenAddress: string;
    amount: number;
    attempt: number;
    lastAttempt: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }> = new Map();

  private highestPrices: Map<string, number> = new Map();
  
  // ⏱️ التحكم بالمسح التلقائي
  private autoScanIntervalId: number | null = null;
  private scanIntervalMinutes: number = 5;

  constructor(
    config: BotConfig,
    userId: string,
    onLog: LogCallback,
    onTrade: TradeCallback,
    botId?: string
  ) {
    this.config = config;
    this.userId = userId;
    this.botId = botId;
    this.onLog = onLog;
    this.onTrade = onTrade;
    this.wallet = BotWalletManager.getInstance();
  }

  // ============================================================
  // 📢 إرسال إشعار (جميع الإشعارات مهمة الآن)
  // ============================================================
  private async sendNotification(
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ): Promise<void> {
    try {
      // ✅ جميع الإشعارات تُرسل الآن (لا توجد تصفية)
      console.log(`📢 [${type}] ${message}`);

      // ✅ حفظ في قاعدة البيانات
      await saveLog({
        level: type.toUpperCase(),
        message,
        timestamp: getTimestamp(),
        context: { userId: this.userId, botId: this.botId }
      });

      // ✅ إرسال إلى Worker
      await fetch(`${WORKER_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: 'hunter',
          userId: this.userId,
          type,
          message,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});

    } catch (error) {
      console.warn('⚠️ فشل إرسال الإشعار:', error);
    }
  }

  // ============================================================
  // 📊 تحليل السوق
  // ============================================================

  private async analyzeMarketSignals(): Promise<{
    score: number;
    signals: string[];
    maxTrades: number;
  }> {
    try {
      const signals: string[] = [];
      let score = 0;

      const result = await discoverAllPairs('solana');
      if (result.error || result.pairs.length === 0) {
        throw new Error('❌ لا توجد بيانات سوق: ' + (result.error || 'لا توجد أزواج'));
      }

      const pairs = result.pairs.slice(0, 100);
      let bullishCount = 0;
      let bearishCount = 0;
      let totalVolume = 0;
      let totalBuys = 0;
      let totalSells = 0;
      let totalPriceChange = 0;

      for (const pair of pairs) {
        const priceChange = pair.priceChange?.h24 || 0;
        const volume = pair.volume?.h24 || 0;
        const txns = pair.txns?.h24 || { buys: 0, sells: 0 };

        if (priceChange > 0) bullishCount++;
        else if (priceChange < 0) bearishCount++;

        totalVolume += volume;
        totalBuys += txns.buys;
        totalSells += txns.sells;
        totalPriceChange += priceChange;
      }

      const total = bullishCount + bearishCount;
      const bullishRatio = total > 0 ? bullishCount / total : 0.5;
      const avgVolume = totalVolume / (pairs.length || 1);
      const firstVolume = pairs[0]?.volume?.h24 || 1;
      const volumeRatio = avgVolume > 0 ? firstVolume / avgVolume : 1;
      const totalTxns = totalBuys + totalSells;
      const buyRatio = totalTxns > 0 ? totalBuys / totalTxns : 0.5;
      const avgPriceChange = pairs.length > 0 ? totalPriceChange / pairs.length : 0;

      const newPairs = pairs.filter(p => {
        if (!p.pairCreatedAt) return false;
        return (Date.now() - p.pairCreatedAt) / (1000 * 60 * 60) < 24;
      });

      if (bullishRatio > 0.55) { score += 20; signals.push(`📈 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }
      else if (bullishRatio > 0.45) { score += 10; signals.push(`📊 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }
      else { score -= 5; signals.push(`📉 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }

      if (volumeRatio > 1.2) { score += 20; signals.push('📊 حجم مرتفع'); }
      else if (volumeRatio > 0.8) { score += 10; signals.push('📊 حجم متوسط'); }
      else { score -= 5; signals.push('📊 حجم منخفض'); }

      if (buyRatio > 0.58) { score += 20; signals.push(`🟢 شراء ${(buyRatio * 100).toFixed(0)}%`); }
      else if (buyRatio > 0.50) { score += 10; signals.push(`🟢 شراء ${(buyRatio * 100).toFixed(0)}%`); }
      else { score -= 5; signals.push(`🔴 شراء ${(buyRatio * 100).toFixed(0)}%`); }

      if (avgPriceChange > 3) { score += 20; signals.push(`📈 تغير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange > 1) { score += 10; signals.push(`📈 تغير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange < -2) { score -= 5; signals.push(`📉 تغير ${avgPriceChange.toFixed(1)}%`); }
      else { signals.push(`⚖️ تغير ${avgPriceChange.toFixed(1)}%`); }

      if (newPairs.length > 10) { score += 15; signals.push(`🆕 ${newPairs.length} جديد`); }
      else if (newPairs.length > 5) { score += 5; signals.push(`🆕 ${newPairs.length} جديد`); }
      else { signals.push(`🆕 ${newPairs.length} جديد`); }

      const balanceUsd = this.config.tradingAmount || 100;
      const multiplier = Math.max(0.3, Math.min(5, balanceUsd / 500));
      let baseTrades = 5;
      if (score >= 70) baseTrades = 10;
      else if (score >= 50) baseTrades = 8;
      else if (score >= 30) baseTrades = 6;
      else baseTrades = 5;

      let maxTrades = Math.round(baseTrades * multiplier);
      const maxLimit = Math.min(20, this.config.maxTradesPerDay || 10);
      maxTrades = Math.max(3, Math.min(maxTrades, maxLimit));

      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `🧠 تحليل السوق: النقاط ${score}/100 | المبلغ: $${balanceUsd.toFixed(0)} | الصفقات: ${maxTrades}`,
      });

      for (const signal of signals) {
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `   📊 ${signal}`,
        });
      }

      return { score, signals, maxTrades };

    } catch (error) {
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'warning',
        message: `⚠️ فشل تحليل السوق: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
      });
      return { score: 40, signals: ['⚠️ تحليل السوق غير متاح'], maxTrades: 5 };
    }
  }

  // ============================================================
  // 📊 التحقق من الحد اليومي
  // ============================================================

  private async canExecuteTrade(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.lastResetDate !== today) {
      this.dailyTrades = 0;
      this.lastResetDate = today;
      
      const analysis = await this.analyzeMarketSignals();
      this.dynamicMaxTrades = analysis.maxTrades;
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `📊 الحد الديناميكي اليومي: ${this.dynamicMaxTrades} صفقات`,
      });
      await this.sendNotification('info', `📊 الحد الديناميكي اليومي: ${this.dynamicMaxTrades} صفقات`);
    }

    if (this.dailyTrades >= this.dynamicMaxTrades) {
      const msg = `⚠️ تم الوصول للحد الديناميكي: ${this.dynamicMaxTrades} صفقات`;
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'warning',
        message: msg,
      });
      await this.sendNotification('warning', msg);
      return false;
    }

    return true;
  }

  // ============================================================
  // 📊 التحقق من فرصة التداول
  // ============================================================

  private async verifyTradeOpportunity(token: DiscoveredToken, network: ChainId): Promise<{
    shouldBuy: boolean;
    reason: string;
    currentPrice: number;
    currentVolume: number;
    currentLiquidity: number;
    priceChange5m: number;
    priceImpact: number;
    volatility: number;
  }> {
    try {
      const tradingAmount = this.config.tradingAmount || 100;
      if (tradingAmount < 5) {
        return {
          shouldBuy: false,
          reason: `⚠️ المبلغ المخصص ($${tradingAmount}) أقل من الحد الأدنى ($5)`,
          currentPrice: token.priceUsd,
          currentVolume: token.volume24h,
          currentLiquidity: token.liquidityUsd,
          priceChange5m: 0,
          priceImpact: 0,
          volatility: 0,
        };
      }

      const response = await fetch(`${WORKER_URL}/dex-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: token.tokenAddress,
          network: network,
        }),
      });

      if (!response.ok) {
        throw new Error(`❌ فشل جلب بيانات السوق: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error('❌ لا توجد بيانات سوق');
      }

      const marketData = data.data;
      const currentPrice = marketData.price || token.priceUsd;
      const currentVolume = marketData.volume24h || token.volume24h;
      const currentLiquidity = marketData.liquidity || token.liquidityUsd;
      const priceChange5m = marketData.priceChange?.m5 || 0;

      const priceImpact = Math.abs(currentPrice - token.priceUsd) / token.priceUsd;
      if (priceImpact > MAX_PRICE_IMPACT) {
        return {
          shouldBuy: false,
          reason: `⚠️ الانزلاق السعري كبير: ${(priceImpact * 100).toFixed(2)}% (الحد: ${MAX_PRICE_IMPACT * 100}%)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility: 0,
        };
      }

      const volatility = Math.abs(token.priceChange.h24) / 100;
      if (volatility > MAX_VOLATILITY) {
        return {
          shouldBuy: false,
          reason: `⚠️ التقلبات عالية: ${(volatility * 100).toFixed(2)}% (الحد: ${MAX_VOLATILITY * 100}%)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility,
        };
      }

      const priceChange = ((currentPrice - token.priceUsd) / token.priceUsd) * 100;
      if (Math.abs(priceChange) > 10) {
        return {
          shouldBuy: false,
          reason: `⚠️ تغير السعر ${priceChange.toFixed(2)}% خلال 5 دقائق (غير مستقر)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility,
        };
      }

      const volumeChange = ((currentVolume - token.volume24h) / token.volume24h) * 100;
      if (volumeChange < -70) {
        return {
          shouldBuy: false,
          reason: `⚠️ انخفض الحجم ${Math.abs(volumeChange).toFixed(2)}% (ضعف النشاط)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility,
        };
      }

      const liquidityChange = ((currentLiquidity - token.liquidityUsd) / token.liquidityUsd) * 100;
      if (liquidityChange < -50) {
        return {
          shouldBuy: false,
          reason: `⚠️ انخفضت السيولة ${Math.abs(liquidityChange).toFixed(2)}% (سحب سيولة)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility,
        };
      }

      return {
        shouldBuy: true,
        reason: '✅ جميع المعايير مستقرة - فرصة شراء جيدة',
        currentPrice,
        currentVolume,
        currentLiquidity,
        priceChange5m,
        priceImpact,
        volatility,
      };

    } catch (error) {
      return {
        shouldBuy: false,
        reason: `❌ فشل التحقق: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        currentPrice: token.priceUsd,
        currentVolume: token.volume24h,
        currentLiquidity: token.liquidityUsd,
        priceChange5m: 0,
        priceImpact: 0,
        volatility: 0,
      };
    }
  }

  // ============================================================
  // 📊 حساب حجم الصفقة الديناميكي
  // ============================================================

  private async calculateDynamicPositionSize(
    token: DiscoveredToken,
    entryPrice: number,
    stopLossPrice: number
  ): Promise<number> {
    try {
      const tradingAmount = this.config.tradingAmount || 100;
      const balanceUsd = tradingAmount;
      
      const positionSize = calculatePositionSize(
        balanceUsd,
        RISK_PER_TRADE,
        entryPrice,
        stopLossPrice
      );
      
      const minSize = 1;
      const maxSize = this.config.maxPositionUsd || tradingAmount;
      
      return Math.max(minSize, Math.min(positionSize, maxSize));
    } catch {
      return this.config.tradingAmount || 100;
    }
  }

  // ============================================================
  // ✅ تنفيذ الشراء مع إعادة المحاولة
  // ============================================================

  private async executeBuyWithRetry(params: {
    tokenAddress: string;
    amountInSol: number;
    slippage: number;
    password: string;
    maxRetries: number;
    retryDelay: number;
    network: ChainId;
    tokenSymbol: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string; amount: number; tokenAddress: string; price?: number }> {
    const key = `${params.tokenAddress}-${Date.now()}`;
    let lastError: string | null = null;
    
    this.pendingTrades.set(key, {
      tokenAddress: params.tokenAddress,
      amount: params.amountInSol,
      attempt: 0,
      lastAttempt: Date.now(),
      status: 'pending'
    });

    for (let attempt = 1; attempt <= params.maxRetries; attempt++) {
      const pending = this.pendingTrades.get(key);
      if (pending?.status === 'completed') {
        return {
          success: true,
          amount: params.amountInSol,
          tokenAddress: params.tokenAddress,
        };
      }

      if (pending?.status === 'failed') {
        return {
          success: false,
          error: 'تم إلغاء الصفقة بسبب timeout',
          amount: params.amountInSol,
          tokenAddress: params.tokenAddress,
        };
      }

      try {
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `🔄 محاولة ${attempt}/${params.maxRetries} لشراء ${params.tokenSymbol}`,
        });
        
        await this.sendNotification('info', `🔄 جاري شراء ${params.tokenSymbol} (محاولة ${attempt}/${params.maxRetries})`);
        
        this.pendingTrades.set(key, {
          ...pending!,
          status: 'processing',
          attempt: attempt,
          lastAttempt: Date.now()
        });

        const result = await executeTradeViaWorker({
          side: 'buy',
          network: params.network,
          tokenAddress: params.tokenAddress,
          amountUsd: params.amountInSol * 100,
          pairAddress: params.tokenAddress,
          userId: this.userId,
          botId: this.botId,
        });

        if (result.error) {
          lastError = result.error;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'warning',
            message: `⚠️ المحاولة ${attempt} فشلت: ${lastError}`,
          });
          await this.sendNotification('warning', `⚠️ محاولة ${attempt} فشلت لـ ${params.tokenSymbol}: ${lastError}`);

          if (attempt < params.maxRetries) {
            this.onLog({
              id: generateId(),
              timestamp: Date.now(),
              level: 'info',
              message: `⏳ انتظار ${params.retryDelay/1000} ثانية قبل المحاولة ${attempt + 1}...`,
            });
            await new Promise(resolve => setTimeout(resolve, params.retryDelay));
          }
          continue;
        }

        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'success',
          message: `✅ تم الشراء بنجاح في المحاولة ${attempt}`,
        });
        
        await this.sendNotification('success', `✅ تم شراء ${params.tokenSymbol} بنجاح بمبلغ $${(params.amountInSol * 100).toFixed(2)}`);
        
        this.pendingTrades.set(key, {
          ...pending!,
          status: 'completed',
          lastAttempt: Date.now()
        });
        setTimeout(() => this.pendingTrades.delete(key), 5000);
        
        return {
          success: true,
          txHash: result.txHash || undefined,
          price: result.price || undefined,
          amount: params.amountInSol,
          tokenAddress: params.tokenAddress,
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'خطأ غير معروف';
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: `❌ المحاولة ${attempt} فشلت: ${lastError}`,
        });
        await this.sendNotification('error', `❌ محاولة ${attempt} فشلت لـ ${params.tokenSymbol}: ${lastError}`);
        
        if (attempt < params.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, params.retryDelay));
        }
      }
    }

    await this.sendNotification('error', `❌ فشل شراء ${params.tokenSymbol} بعد ${params.maxRetries} محاولات`);

    this.pendingTrades.delete(key);
    return {
      success: false,
      error: `فشل بعد ${params.maxRetries} محاولات: ${lastError}`,
      amount: params.amountInSol,
      tokenAddress: params.tokenAddress,
    };
  }

  // ============================================================
  // ✅ تنفيذ البيع مع إعادة المحاولة
  // ============================================================

  private async executeSellWithRetry(
    token: DiscoveredToken,
    network: ChainId,
    buyTrade: Trade,
    initialSellPrice: number,
    reason: string,
    isPriceCritical: boolean = false
  ): Promise<void> {
    let lastError: string | null = null;
    let sellPrice = initialSellPrice;

    for (let attempt = 1; attempt <= MAX_SELL_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          const response = await fetch(`${WORKER_URL}/dex-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokenAddress: token.tokenAddress,
              network: network,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.price) {
              const newPrice = data.data.price;
              if (newPrice > sellPrice) {
                sellPrice = newPrice;
                this.onLog({
                  id: generateId(),
                  timestamp: Date.now(),
                  level: 'info',
                  message: `🔄 تحديث سعر البيع: $${sellPrice.toFixed(6)} (أفضل)`,
                });
                await this.sendNotification('info', `🔄 تحديث سعر بيع ${token.symbol}: $${sellPrice.toFixed(6)}`);
              } else if (newPrice < sellPrice * 0.98 && isPriceCritical) {
                sellPrice = newPrice;
                this.onLog({
                  id: generateId(),
                  timestamp: Date.now(),
                  level: 'warning',
                  message: `⚠️ السعر ينخفض بسرعة! البيع عند $${sellPrice.toFixed(6)}`,
                });
                await this.sendNotification('warning', `⚠️ ${token.symbol}: السعر ينخفض! البيع عند $${sellPrice.toFixed(6)}`);
              }
            }
          }
        }

        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `🔄 محاولة البيع ${attempt}/${MAX_SELL_RETRIES} لـ ${token.symbol} عند $${sellPrice.toFixed(6)}`,
        });
        await this.sendNotification('info', `🔄 محاولة بيع ${token.symbol} ${attempt}/${MAX_SELL_RETRIES}`);

        const result = await executeTradeViaWorker({
          side: 'sell',
          network: network,
          tokenAddress: token.tokenAddress,
          amountUsd: sellPrice * buyTrade.quantity,
          pairAddress: token.pairAddress,
          userId: this.userId,
          botId: this.botId,
        });

        if (result.error) {
          lastError = result.error;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'warning',
            message: `⚠️ محاولة ${attempt} فشلت: ${result.error}`,
          });
          await this.sendNotification('warning', `⚠️ محاولة بيع ${token.symbol} ${attempt} فشلت: ${result.error}`);

          if (attempt < MAX_SELL_RETRIES) {
            this.onLog({
              id: generateId(),
              timestamp: Date.now(),
              level: 'info',
              message: `⏳ انتظار ${SELL_RETRY_DELAY/1000} ثانية قبل المحاولة ${attempt+1}...`,
            });
            await new Promise(resolve => setTimeout(resolve, SELL_RETRY_DELAY));
          }
          continue;
        }

        const pnl = (sellPrice - buyTrade.priceUsd) * buyTrade.quantity;
        
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'success',
          message: `✅ بيع ${token.symbol} بنجاح بعد ${attempt} محاولة!`,
        });
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'success',
          message: `📊 السعر: $${sellPrice.toFixed(6)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        });

        const pnlMsg = pnl >= 0 ? `ربح $${pnl.toFixed(2)}` : `خسارة $${Math.abs(pnl).toFixed(2)}`;
        await this.sendNotification(
          pnl >= 0 ? 'success' : 'error',
          `✅ بيع ${token.symbol} - ${pnlMsg} (${pnl >= 0 ? '+' : ''}${((pnl / (buyTrade.amountUsd || 1)) * 100).toFixed(2)}%)`
        );

        const sellTrade: Trade = {
          id: generateId(),
          timestamp: Date.now(),
          network,
          tokenSymbol: token.symbol,
          tokenAddress: token.tokenAddress,
          pairAddress: token.pairAddress,
          side: 'sell',
          amountUsd: sellPrice * buyTrade.quantity,
          priceUsd: sellPrice,
          quantity: buyTrade.quantity,
          status: 'executed',
          reason: `${reason} (${attempt} محاولات)`,
          pnl,
          txHash: result.txHash ?? undefined,
        };

        this.activePositions.delete(`${network}-${token.tokenAddress}`);
        this.highestPrices.delete(`${network}-${token.tokenAddress}`);

        await saveTrade({
          token: sellTrade.tokenSymbol,
          tokenAddress: sellTrade.tokenAddress,
          network: sellTrade.network,
          amount: sellTrade.amountUsd,
          price: sellTrade.priceUsd,
          type: 'SELL',
          status: 'EXECUTED',
          timestamp: getTimestamp(),
          txHash: sellTrade.txHash,
          pnl: pnl,
          pnlPercent: (pnl / (buyTrade.amountUsd || 1)) * 100,
        });

        this.onTrade(sellTrade);
        return;

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'خطأ غير معروف';
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: `❌ محاولة ${attempt} فشلت: ${lastError}`,
        });
        await this.sendNotification('error', `❌ محاولة بيع ${token.symbol} ${attempt} فشلت: ${lastError}`);

        if (attempt < MAX_SELL_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, SELL_RETRY_DELAY));
        }
      }
    }

    const msg = `🚨 فشل بيع ${token.symbol} بعد ${MAX_SELL_RETRIES} محاولات!`;
    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'error',
      message: msg,
    });
    await this.sendNotification('error', msg);

    const failedTrade: Trade = {
      id: generateId(),
      timestamp: Date.now(),
      network,
      tokenSymbol: token.symbol,
      tokenAddress: token.tokenAddress,
      pairAddress: token.pairAddress,
      side: 'sell',
      amountUsd: sellPrice * buyTrade.quantity,
      priceUsd: sellPrice,
      quantity: buyTrade.quantity,
      status: 'failed',
      reason: `فشل البيع بعد ${MAX_SELL_RETRIES} محاولات: ${lastError}`,
      pnl: 0,
    };

    this.activePositions.delete(`${network}-${token.tokenAddress}`);
    this.highestPrices.delete(`${network}-${token.tokenAddress}`);

    await saveTrade({
      token: failedTrade.tokenSymbol,
      tokenAddress: failedTrade.tokenAddress,
      network: failedTrade.network,
      amount: failedTrade.amountUsd,
      price: failedTrade.priceUsd,
      type: 'SELL',
      status: 'FAILED',
      timestamp: getTimestamp(),
      pnl: 0,
      pnlPercent: 0,
    });

    this.onTrade(failedTrade);
  }

  // ============================================================
  // 📊 تحديث إعدادات البوت
  // ============================================================

  updateConfig(config: BotConfig): void {
    this.config = config;
    
    if (config.status === 'running') {
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.runCycle(true);
      if (this.autoScanIntervalId !== null) {
        this.stopAutoScan();
        this.startAutoScan();
      }
      
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `🔄 تم تحديث إعدادات البوت (الشبكات: ${config.networks.join(', ')})`,
      });
      this.sendNotification('info', `🔄 تم تحديث إعدادات البوت (الشبكات: ${config.networks.join(', ')})`);
    } else if (config.status !== 'running' && this.intervalId !== null) {
      this.stop();
    }
  }

  // ============================================================
  // 🚀 تشغيل البوت
  // ============================================================
  start(): void {
    if (this.intervalId !== null) return;

    console.log('🔴🔴🔴 start() is running!');
    this.sendNotification('info', '🧪 اختبار إشعار من البوت');

    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `🤖 Bot started in ${this.config.mode} mode on ${this.config.networks.length} networks`,
    });
    this.sendNotification('success', `🚀 تم تشغيل البوت (${this.config.mode}) على ${this.config.networks.length} شبكات`);
    this.runCycle();
  }

  // ============================================================
  // ⏹️ إيقاف البوت
  // ============================================================

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: '⏹️ Bot stopped',
    });
    this.sendNotification('warning', '⏹️ تم إيقاف البوت');
  }

  // ============================================================
  // ⏱️ التحكم بالمسح التلقائي (معدل)
  // ============================================================

  startAutoScan(): void {
    if (this.autoScanIntervalId !== null) {
      console.log(`⚠️ [${this.botId || 'BOT'}] المسح التلقائي يعمل بالفعل`);
      return;
    }
    
    const intervalMs = this.scanIntervalMinutes * 60 * 1000;
    console.log(`🔄 [${this.botId || 'BOT'}] بدأ المسح التلقائي كل ${this.scanIntervalMinutes} دقيقة`);
    
    // ✅ إشعار ببدء المسح التلقائي
    this.sendNotification('success', `▶️ بدأ المسح التلقائي كل ${this.scanIntervalMinutes} دقيقة`);
    
    // ✅ تشغيل المسح التلقائي
    this.autoScanIntervalId = setInterval(() => {
      console.log(`🔄 [${this.botId || 'BOT'}] تنفيذ دورة مسح تلقائي (كل ${this.scanIntervalMinutes} دقيقة)`);
      this.runCycle(true); // صامت
    }, intervalMs);
    
    // ✅ تنفيذ دورة فورية عند البدء
    setTimeout(() => {
      this.runCycle(true);
    }, 1000);
  }

  stopAutoScan(): void {
    if (this.autoScanIntervalId !== null) {
      clearInterval(this.autoScanIntervalId);
      this.autoScanIntervalId = null;
      console.log(`⏹️ [${this.botId || 'BOT'}] تم إيقاف المسح التلقائي`);
      
      // ✅ إشعار بإيقاف المسح التلقائي
      this.sendNotification('warning', '⏹️ تم إيقاف المسح التلقائي');
    } else {
      console.log(`⚠️ [${this.botId || 'BOT'}] المسح التلقائي غير نشط`);
    }
  }

  setScanInterval(minutes: number): void {
    // ✅ تأكد من أن القيمة بين 1 و 60 دقيقة
    const oldInterval = this.scanIntervalMinutes;
    this.scanIntervalMinutes = Math.max(1, Math.min(60, minutes));
    
    console.log(`⏱️ [${this.botId || 'BOT'}] تغيير وقت المسح: ${oldInterval} → ${this.scanIntervalMinutes} دقيقة`);
    
    // ✅ إشعار بتغيير الوقت
    this.sendNotification('info', `⏱️ تم تغيير وقت المسح إلى ${this.scanIntervalMinutes} دقيقة`);
    
    // ✅ إذا كان المسح التلقائي نشطاً، أعد تشغيله بالوقت الجديد
    if (this.autoScanIntervalId !== null) {
      console.log(`🔄 [${this.botId || 'BOT'}] إعادة تشغيل المسح التلقائي بالوقت الجديد`);
      this.stopAutoScan();
      this.startAutoScan();
    }
  }

  getAutoScanStatus(): { active: boolean; interval: number } {
    return {
      active: this.autoScanIntervalId !== null,
      interval: this.scanIntervalMinutes,
    };
  }

  // ============================================================
  // 🔄 مسح يدوي
  // ============================================================

  async runManualScan(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 بدء المسح اليدوي للشبكات...');
      await this.sendNotification('info', '🔄 بدء المسح اليدوي...');
      await this.runCycle(false);
      console.log('✅ انتهى المسح اليدوي بنجاح');
      await this.sendNotification('success', '✅ انتهى المسح اليدوي بنجاح');
      return { success: true, message: '✅ تم مسح الشبكات بنجاح' };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'خطأ غير معروف';
      console.error('❌ فشل المسح اليدوي:', errorMsg);
      await this.sendNotification('error', `❌ فشل المسح اليدوي: ${errorMsg}`);
      return { success: false, message: `❌ فشل المسح: ${errorMsg}` };
    }
  }

  // ============================================================
  // 🔍 التحقق من الصفقات المعلقة
  // ============================================================

  private async checkPendingTrades(): Promise<void> {
    const now = Date.now();
    const TIMEOUT = 120000;

    for (const [key, pending] of this.pendingTrades) {
      if (now - pending.lastAttempt > TIMEOUT && pending.status === 'pending') {
        pending.status = 'failed';
        const msg = `⏰ انتهى وقت ${pending.tokenAddress.slice(0, 8)}... (${TIMEOUT/1000}s)`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: msg,
        });
        await this.sendNotification('error', msg);
        this.pendingTrades.delete(key);
        continue;
      }

      if (pending.status === 'processing' && now - pending.lastAttempt > 30000) {
        pending.status = 'completed';
        const msg = `✅ تم تأكيد تنفيذ ${pending.tokenAddress.slice(0, 8)}...`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'success',
          message: msg,
        });
        await this.sendNotification('success', msg);
        this.pendingTrades.delete(key);
      }
    }
  }

  // ============================================================
  // 🔄 دورة المسح الرئيسية
  // ============================================================

  private async runCycle(silent: boolean = false): Promise<void> {
    await this.checkPendingTrades();
    if (!silent) {
      await this.sendNotification('info', `🔄 بدء دورة مسح (${this.config.networks.join(', ')})`);
    }

    for (const network of this.config.networks) {
      try {
        if (!silent) {
          await this.sendNotification('info', `🔍 مسح الشبكة: ${getNetworkName(network)}`);
        }
        
        const result = await discoverAllPairs(network);
        
        if (result.error) {
          const msg = `${getNetworkName(network)}: ${result.error}`;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'error',
            message: msg,
          });
          if (!silent) await this.sendNotification('error', msg);
          continue;
        }
        
        if (result.pairs.length === 0) {
          const msg = `${getNetworkName(network)}: no pairs from any source`;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'warning',
            message: msg,
          });
          if (!silent) await this.sendNotification('warning', msg);
          continue;
        }

        const sourceStr = result.sources
          .map((s) => `${s.name}:${s.count}${s.error ? '!' : ''}`)
          .join(' | ');
        
        const pairsMsg = `${getNetworkName(network)}: ${result.pairs.length} pairs [${sourceStr}]`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: pairsMsg,
        });
        if (!silent) {
          await this.sendNotification('info', `📦 ${pairsMsg}`);
        }

        const filters: HunterFilters = {
          minLiquidityUsd: Math.min(this.config.minLiquidityUsd || 15000, 15000),
          minVolume24h: Math.min(this.config.minVolume24h || 30000, 30000),
          minPriceChange24h: this.config.minPriceChange24h || 0,
        };

        let huntResult;
        try {
          huntResult = runBotAnalysis(result.pairs, network, filters);
        } catch (analysisError) {
          console.error('❌ runBotAnalysis فشل:', analysisError);
          huntResult = {
            tokens: [],
            stats: {
              totalPairs: 0,
              uniqueTokens: 0,
              afterSecurity: 0,
              afterLiquidity: 0,
              afterVolume: 0,
              candidates: 0,
              watchlist: 0,
              rejected: 0,
              lastUpdate: Date.now(),
              error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
            },
            recommendations: [],
          };
        }

        const safeStats = {
          totalPairs: huntResult?.stats?.totalPairs || 0,
          uniqueTokens: huntResult?.stats?.uniqueTokens || 0,
          afterSecurity: huntResult?.stats?.afterSecurity || 0,
          afterLiquidity: huntResult?.stats?.afterLiquidity || 0,
          afterVolume: huntResult?.stats?.afterVolume || 0,
          candidates: huntResult?.stats?.candidates || 0,
          watchlist: huntResult?.stats?.watchlist || 0,
          rejected: huntResult?.stats?.rejected || 0,
          lastUpdate: Date.now(),
          error: null,
        };

        const statsMsg = `${getNetworkName(network)}: ${safeStats.totalPairs} pairs -> ${safeStats.uniqueTokens} tokens -> ${safeStats.candidates} candidates`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: statsMsg,
        });
        if (!silent) {
          await this.sendNotification('info', `📊 ${statsMsg}`);
        }

        const tokens = huntResult?.tokens || [];
        if (tokens.length === 0) {
          const msg = `${getNetworkName(network)}: no tokens met criteria this cycle`;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: msg,
          });
          if (!silent) await this.sendNotification('info', msg);
          continue;
        }

        if (this.config.mode === 'auto') {
          await this.processAutoTrades(tokens, network, silent);
        } else {
          const candidates = getTopRecommendations(huntResult, 5);
          const msg = `${getNetworkName(network)}: ${candidates.length} opportunities found (manual review)`;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: msg,
          });
          if (!silent) await this.sendNotification('info', msg);
        }

      } catch (e) {
        if (e instanceof Error && e.message?.includes('totalPairs')) {
          console.warn('⚠️ stats غير مكتملة، تخطي الإشعار');
          continue;
        }
        const msg = `Cycle error on ${getNetworkName(network)}: ${e instanceof Error ? e.message : 'unknown'}`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: msg,
        });
        if (!silent) await this.sendNotification('error', msg);
      }
    }

    if (!silent) {
      await this.sendNotification('info', `✅ انتهت دورة المسح (${this.activePositions.size} صفقة مفتوحة)`);
    } else {
      console.log(`✅ [SILENT] انتهى مسح ${this.botId || 'BOT'}`);
    }
  }

  // ============================================================
  // 📊 معالجة الصفقات التلقائية
  // ============================================================

  private async processAutoTrades(tokens: DiscoveredToken[], network: ChainId, silent: boolean = false): Promise<void> {
    if (!(await this.canExecuteTrade())) {
      const msg = `⏸️ توقف الشراء: تم الوصول للحد اليومي (${this.dynamicMaxTrades})`;
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: msg,
      });
      await this.sendNotification('warning', msg);
      return;
    }

    const sortedTokens = [...tokens].sort((a, b) => {
      const momentumA = a.priceChange.h1 + a.priceChange.h6;
      const momentumB = b.priceChange.h1 + b.priceChange.h6;
      return momentumB - momentumA;
    });

    for (const token of sortedTokens) {
      if (token.status === 'reject') continue;

      const priceUsd = token.priceUsd;
      if (priceUsd <= 0) continue;

      if (!(await this.canExecuteTrade())) {
        const msg = `⏸️ توقف الشراء: تم الوصول للحد اليومي (${this.dynamicMaxTrades})`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: msg,
        });
        await this.sendNotification('warning', msg);
        return;
      }

      await this.sendNotification('info', `🧠 تحليل ${token.symbol} (نقاط: ${token.score}/100)`);

      let shouldBuy = token.status === 'candidate';
      let reason = `Hunter score ${token.score}/100 — ${token.status} (${token.strategy})`;
      let aiConfidence = 50;
      let aiDecision = 'hold';

      if (this.config.aiAssist && token.status === 'candidate') {
        try {
          const analysis = await analyzeToken(token);
          aiDecision = analysis.recommendation;
          aiConfidence = analysis.confidence;
          shouldBuy = analysis.recommendation === 'strong_buy' || analysis.recommendation === 'buy';
          reason = `AI: ${analysis.recommendation} (${analysis.confidence}%) — ${analysis.summary.slice(0, 80)}`;
          await this.sendNotification('info', `📊 ${token.symbol}: AI ${analysis.recommendation} (${analysis.confidence}%)`);
        } catch {
          reason = `Hunter score ${token.score}/100 (AI unavailable)`;
          await this.sendNotification('warning', `⚠️ ${token.symbol}: AI غير متاح، استخدام Hunter فقط`);
        }
      }

      const technicalScore = calculateTechnicalScore(token);
      const finalScore = (technicalScore * 0.60) + (aiConfidence * 0.40);

      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `📊 ${token.symbol}: Technical=${technicalScore}, AI Confidence=${aiConfidence}, Final=${finalScore.toFixed(0)}`,
      });

      if (!shouldBuy || finalScore < 55) {
        const msg = `⏭️ تخطي ${token.symbol}: ${reason} (Final Score: ${finalScore.toFixed(0)})`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: msg,
        });
        await this.sendNotification('warning', msg);
        continue;
      }

      const selectionMsg = `🎯 تم اختيار ${token.symbol} للتداول (النقاط: ${finalScore.toFixed(0)}/100)`;
      await this.sendNotification('info', selectionMsg);

      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `🔍 التحقق من وضع ${token.symbol}...`,
      });
      await this.sendNotification('info', `🔍 التحقق من وضع ${token.symbol}...`);
      
      const verification = await this.verifyTradeOpportunity(token, network);

      if (!verification.shouldBuy) {
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'warning',
          message: `⛔ ${token.symbol}: ${verification.reason}`,
        });
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `   📊 السعر الحالي: $${verification.currentPrice.toFixed(6)}`,
        });
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `   📊 الانزلاق: ${(verification.priceImpact * 100).toFixed(2)}%`,
        });
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `   📊 التقلبات: ${(verification.volatility * 100).toFixed(2)}%`,
        });
        await this.sendNotification('warning', `⛔ ${token.symbol}: ${verification.reason}`);
        continue;
      }

      const stopLossPrice = verification.currentPrice * (1 - this.config.stopLossPct / 100);
      const positionSize = await this.calculateDynamicPositionSize(
        token,
        verification.currentPrice,
        stopLossPrice
      );

      const amountUsd = Math.min(positionSize, this.config.maxPositionUsd);
      const amountInSol = amountUsd / 100;

      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'success',
        message: `✅ ${token.symbol}: ${verification.reason}`,
      });
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `   📊 السعر الحالي: $${verification.currentPrice.toFixed(6)}`,
      });
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `   📊 حجم الصفقة: $${amountUsd.toFixed(2)} (${RISK_PER_TRADE}% مخاطرة)`,
      });
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'info',
        message: `   📊 النقاط النهائية: ${finalScore.toFixed(0)}/100`,
      });

      await this.sendNotification('success', `✅ ${token.symbol}: ${verification.reason}`);
      await this.sendNotification('info', `💰 حجم الصفقة: $${amountUsd.toFixed(2)} | النقاط: ${finalScore.toFixed(0)}/100`);

      const balance = await this.wallet.refreshBalance(network);
      await this.sendNotification('info', `💰 رصيد ${getNetworkName(network)}: $${balance.toFixed(2)}`);

      if (balance < amountUsd) {
        const msg = `⚠️ ${token.symbol}: الرصيد غير كافٍ ($${balance.toFixed(2)} < $${amountUsd.toFixed(2)})`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'warning',
          message: msg,
        });
        await this.sendNotification('warning', msg);
        continue;
      }

      const result = await this.executeBuyWithRetry({
        tokenAddress: token.tokenAddress,
        amountInSol: amountInSol,
        slippage: 0.01,
        password: "SecureMasterPassword123!@#",
        maxRetries: 3,
        retryDelay: 30000,
        network: network,
        tokenSymbol: token.symbol,
      });

      const status = result.success ? 'executed' : 'failed';
      const trade: Trade = {
        id: generateId(),
        timestamp: Date.now(),
        network,
        tokenSymbol: token.symbol,
        tokenAddress: token.tokenAddress,
        pairAddress: token.pairAddress,
        side: 'buy',
        amountUsd,
        priceUsd: verification.currentPrice,
        quantity: amountUsd / verification.currentPrice,
        status,
        reason: `${reason} | Final Score: ${finalScore.toFixed(0)}`,
        txHash: result.txHash,
      };

      if (result.error) {
        const msg = `❌ BUY ${token.symbol} FAILED: ${result.error}`;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: msg,
        });
        await this.sendNotification('error', msg);
      } else {
        this.dailyTrades++;
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `📊 الصفقة ${this.dailyTrades}/${this.dynamicMaxTrades} اليوم`,
        });
        await this.sendNotification('success', `✅ تم شراء ${token.symbol} بمبلغ $${amountUsd.toFixed(2)}`);
        
        this.highestPrices.set(`${network}-${token.tokenAddress}`, verification.currentPrice);
        this.activePositions.set(`${network}-${token.tokenAddress}`, trade);
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'success',
          message: `✅ REAL BUY ${token.symbol} on ${getNetworkName(network)} @ $${verification.currentPrice.toFixed(6)} — tx: ${result.txHash?.slice(0, 16)}... — ${reason}`,
        });
        await this.sendNotification('info', `📈 ${token.symbol} @ $${verification.currentPrice.toFixed(6)} | التجزئة: ${result.txHash?.slice(0, 16)}...`);
        
        this.scheduleSellCheck(token, network, trade);
      }
      await saveTrade({
        token: trade.tokenSymbol,
        tokenAddress: trade.tokenAddress,
        network: trade.network,
        amount: trade.amountUsd,
        price: trade.priceUsd,
        type: 'BUY',
        status: status === 'executed' ? 'EXECUTED' : 'FAILED',
        timestamp: getTimestamp(),
        txHash: trade.txHash,
        pnl: 0,
        pnlPercent: 0,
      });
      this.onTrade(trade);
    }
  }

  // ============================================================
  // 📊 مراقبة السعر للبيع
  // ============================================================

  private scheduleSellCheck(token: DiscoveredToken, network: ChainId, buyTrade: Trade): void {
    const takeProfit = buyTrade.priceUsd * (1 + this.config.takeProfitPct / 100);
    const stopLoss = buyTrade.priceUsd * (1 - this.config.stopLossPct / 100);
    const positionKey = `${network}-${token.tokenAddress}`;
    let highestPrice = buyTrade.priceUsd;

    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `📈 مراقبة ${token.symbol}: TP $${takeProfit.toFixed(6)} | SL $${stopLoss.toFixed(6)} | Trailing Stop: ${TRAILING_STOP_PERCENT}%`,
    });
    this.sendNotification('info', `📈 مراقبة ${token.symbol}: TP $${takeProfit.toFixed(6)} | SL $${stopLoss.toFixed(6)}`);

    const checkId = setInterval(async () => {
      if (this.config.status !== 'running') {
        clearInterval(checkId);
        return;
      }

      try {
        const response = await fetch(`${WORKER_URL}/dex-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: token.tokenAddress,
            network: network,
          }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data.success || !data.data?.price) return;

        const currentPrice = data.data.price;
        const profitPercent = ((currentPrice - buyTrade.priceUsd) / buyTrade.priceUsd) * 100;

        if (currentPrice > highestPrice) {
          highestPrice = currentPrice;
          this.highestPrices.set(positionKey, highestPrice);
        }

        let sellReason: string | null = null;
        let sellPrice = currentPrice;
        let isPriceCritical = false;

        if (currentPrice <= stopLoss) {
          sellReason = `Stop loss -${this.config.stopLossPct}%`;
          isPriceCritical = true;
        }
        else if (currentPrice >= takeProfit) {
          sellReason = `Take profit +${this.config.takeProfitPct}%`;
          isPriceCritical = false;
        }
        else {
          const trailingStopPrice = highestPrice * (1 - TRAILING_STOP_PERCENT / 100);
          if (currentPrice <= trailingStopPrice && highestPrice > buyTrade.priceUsd * 1.05) {
            sellReason = `Trailing stop: انخفض ${TRAILING_STOP_PERCENT}% من أعلى سعر ($${highestPrice.toFixed(6)})`;
            isPriceCritical = true;
          }
        }

        if (!sellReason) {
          const positionAge = Date.now() - buyTrade.timestamp;
          if (positionAge > MAX_POSITION_TIME) {
            sellReason = `Time exit: انتهت ${MAX_POSITION_TIME / (60 * 60 * 1000)} ساعات`;
            isPriceCritical = true;
          }
        }

        if (sellReason) {
          clearInterval(checkId);
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: `🔴 ${token.symbol}: ${sellReason}`,
          });
          await this.sendNotification('error', `🔴 ${token.symbol}: ${sellReason}`);
          await this.executeSellWithRetry(
            token,
            network,
            buyTrade,
            sellPrice,
            sellReason,
            isPriceCritical
          );
          return;
        }

      } catch {
        // تجاهل الأخطاء
      }
    }, 15000);
  }

  // ============================================================
  // 🔴 تنفيذ البيع (واجهة)
  // ============================================================

  private async executeSell(
    token: DiscoveredToken,
    network: ChainId,
    buyTrade: Trade,
    sellPrice: number,
    reason: string
  ): Promise<void> {
    await this.executeSellWithRetry(
      token,
      network,
      buyTrade,
      sellPrice,
      reason,
      true
    );
  }

  // ============================================================
  // 🖐️ تنفيذ صفقة يدوية
  // ============================================================

  async executeManualTrade(token: DiscoveredToken, side: 'buy' | 'sell', amountUsd: number): Promise<Trade> {
    const priceUsd = token.priceUsd;
    const quantity = amountUsd / priceUsd;

    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `🖐️ Executing MANUAL ${side.toUpperCase()} ${token.symbol} via worker...`,
    });
    await this.sendNotification('info', `🖐️ تنفيذ ${side.toUpperCase()} يدوي لـ ${token.symbol} بمبلغ $${amountUsd}`);

    const result = await executeTradeViaWorker({
      side,
      network: token.chainId,
      tokenAddress: token.tokenAddress,
      amountUsd,
      pairAddress: token.pairAddress,
      userId: this.userId,
      botId: this.botId,
    });

    const trade: Trade = {
      id: generateId(),
      timestamp: Date.now(),
      network: token.chainId,
      tokenSymbol: token.symbol,
      tokenAddress: token.tokenAddress,
      pairAddress: token.pairAddress,
      side,
      amountUsd,
      priceUsd,
      quantity,
      status: result.error ? 'failed' : 'executed',
      reason: 'Manual trade',
      txHash: result.txHash ?? undefined,
    };

    await saveTrade({
      token: trade.tokenSymbol,
      tokenAddress: trade.tokenAddress,
      network: trade.network,
      amount: trade.amountUsd,
      price: trade.priceUsd,
      type: side === 'buy' ? 'BUY' : 'SELL',
      status: result.error ? 'FAILED' : 'EXECUTED',
      timestamp: getTimestamp(),
      txHash: trade.txHash,
      pnl: 0,
      pnlPercent: 0,
    });
    
    this.onTrade(trade);
    
    if (result.error) {
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'error',
        message: `🖐️ MANUAL ${side.toUpperCase()} ${token.symbol} FAILED: ${result.error}`,
      });
      await this.sendNotification('error', `❌ فشل ${side} يدوي لـ ${token.symbol}: ${result.error}`);
    } else {
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'success',
        message: `🖐️ MANUAL ${side.toUpperCase()} ${token.symbol} @ $${priceUsd.toFixed(6)}`,
      });
      await this.sendNotification('success', `✅ تم ${side === 'buy' ? 'شراء' : 'بيع'} ${token.symbol} يدوياً @ $${priceUsd.toFixed(6)}`);
    }
    
    return trade;
  }
}
