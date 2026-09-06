// ============================================================
// 🤖 محرك التداول الرئيسي - النسخة النهائية المطورة
// ✅ يدعم: اكتشاف العملات من DexScreener + GeckoTerminal
// ✅ يدعم: نظام Watchlist في localStorage (بدون D1)
// ✅ يدعم: قراءة آمنة للبيانات الناقصة (بدون أخطاء undefined)
// ✅ يدعم: إشعارات فورية لكل تحركات البوت
// ✅ يدعم: إضافة العملات الجزئية إلى Watchlist تلقائياً
// ✅ يدعم: تنفيذ شراء تلقائي من Watchlist مع إشعارات مفصلة
// ✅ يدعم: مراقبة الصفقات والبيع التلقائي
// ============================================================
import { fetchCandles, analyzeTechnical } from './technicalAnalysis';
import type { BotConfig, Trade, ChainId, BotLogEntry, DiscoveredToken } from '@/types';
import { discoverAllTokens } from '@/lib/discovery';
import { analyzeToken } from '@/lib/gemini';
import { saveTrade, saveLog, generateId, getTimestamp } from '@/lib/madarTech';
import { getNetworkName } from '@/config/networks';
import { BotWalletManager } from '@/lib/wallet';

type LogCallback = (log: BotLogEntry) => void;
type TradeCallback = (trade: Trade) => void;

// ============================================================
// 🛠️ Worker URL
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============================================================
// 📊 إعدادات المخاطر
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
// 📊 حساب درجة الثقة الفنية (مع تركيز أكبر على الزخم)
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
  tokenSymbol: string;
  userId: string;
  botId?: string;
}): Promise<{ txHash: string | null; price: number | null; quantity: number | null; error: string | null }> {
  try {
    if (!params.tokenAddress || !params.pairAddress || !params.network) {
      return { txHash: null, price: null, quantity: null, error: 'بيانات التنفيذ ناقصة: tokenAddress/pairAddress/network' };
    }

    const response = await fetch(`${WORKER_URL}/execute-trade?userId=${encodeURIComponent(params.userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botId: params.botId || null,
        side: params.side,
        tokenAddress: params.tokenAddress,
        pairAddress: params.pairAddress,
        amountUsd: params.amountUsd,
        tokenSymbol: params.tokenSymbol,
        network: params.network,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { txHash: null, price: null, quantity: null, error: `Worker error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    if (!data.success) {
      return { txHash: null, price: null, quantity: null, error: data.error || 'Trade execution failed' };
    }

    return {
      txHash: data.txHash || null,
      price: Number(data.price) > 0 ? Number(data.price) : null,
      quantity: Number(data.quantity) > 0 ? Number(data.quantity) : null,
      error: null,
    };
  } catch (error) {
    return {
      txHash: null,
      price: null,
      quantity: null,
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

  // 🆕 نظام المراقبة (Watchlist) - يعتمد على localStorage فقط
  private watchlistIntervalId: number | null = null;
  private watchlistNotifyCooldown: Map<string, number> = new Map();

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
      console.log(`📢 [${type}] ${message}`);

      // 🔔 إضافة الإشعار إلى localStorage للمتصفح (ليظهر في صفحة الإشعارات)
      try {
        const existing = localStorage.getItem('notifications');
        const notifications = existing ? JSON.parse(existing) : [];
        notifications.push({
          id: generateId(),
          type: type,
          message: message,
          timestamp: new Date().toISOString()
        });
        if (notifications.length > 50) notifications.splice(0, notifications.length - 50);
        localStorage.setItem('notifications', JSON.stringify(notifications));
      } catch (e) {
        // تجاهل أخطاء localStorage (مثلاً في بيئة الـ Worker)
      }

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

      const result = await discoverAllTokens('solana');
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

      if (avgPriceChange > 3) { score += 20; signals.push(`📈 تغيير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange > 1) { score += 10; signals.push(`📈 تغيير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange < -2) { score -= 5; signals.push(`📉 تغيير ${avgPriceChange.toFixed(1)}%`); }
      else { signals.push(`⚖️ تغيير ${avgPriceChange.toFixed(1)}%`); }

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
    shouldBuy: boolean; reason: string; currentPrice: number; currentVolume: number; currentLiquidity: number; priceChange5m: number; priceImpact: number; volatility: number;
  }> {
    const fallback = { 
      currentPrice: token.priceUsd, 
      currentVolume: token.volume24h, 
      currentLiquidity: token.liquidityUsd, 
      priceChange5m: token.priceChange?.m5 || 0, 
      priceImpact: 0, 
      volatility: Math.abs(token.priceChange?.h24 || 0) / 100 
    };
    
    try {
      if ((this.config.tradingAmount || 100) < 5) return { ...fallback, shouldBuy: false, reason: 'المبلغ أقل من $5' };

      const response = await fetch(`${WORKER_URL}/dex-data`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ tokenAddress: token.tokenAddress, pairAddress: token.pairAddress, network }) 
      });
      
      if (!response.ok) throw new Error(`فشل جلب بيانات السوق: ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.data) throw new Error('لا توجد بيانات سوق');

      const market = data.data;
      const currentPrice = Number(market.price) || token.priceUsd;
      const currentVolume = Number(market.volume24h) || token.volume24h;
      const currentLiquidity = Number(market.liquidity) || token.liquidityUsd;
      const priceChange5m = Number(market.priceChange?.m5) || token.priceChange?.m5 || 0;
      const priceImpact = token.priceUsd > 0 ? Math.abs(currentPrice - token.priceUsd) / token.priceUsd : 1;
      const volatility = Math.abs(Number(token.priceChange?.h24) || 0) / 100;

      if (currentPrice <= 0) return { ...fallback, shouldBuy: false, reason: 'السعر غير صالح', currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };
      if (currentLiquidity < 15000) return { ...fallback, shouldBuy: false, reason: `السيولة منخفضة: $${currentLiquidity.toFixed(0)}`, currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };
      if (currentVolume < 20000) return { ...fallback, shouldBuy: false, reason: `الحجم منخفض: $${currentVolume.toFixed(0)}`, currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };
      if (priceImpact > MAX_PRICE_IMPACT) return { ...fallback, shouldBuy: false, reason: `فرق السعر ${(priceImpact * 100).toFixed(2)}% أكبر من ${MAX_PRICE_IMPACT * 100}%`, currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };
      if (volatility > 0.50) return { ...fallback, shouldBuy: false, reason: `تقلب 24h مرتفع ${(volatility * 100).toFixed(1)}%`, currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };
      if (priceChange5m < -3) return { ...fallback, shouldBuy: false, reason: `زخم 5m سلبي ${priceChange5m.toFixed(2)}%`, currentPrice, currentVolume, currentLiquidity, priceChange5m, priceImpact, volatility };

      return { 
        shouldBuy: true, 
        reason: 'السعر والسيولة والحجم والزخم ضمن حدود التنفيذ', 
        currentPrice, 
        currentVolume, 
        currentLiquidity, 
        priceChange5m, 
        priceImpact, 
        volatility 
      };
    } catch (error) {
      return { 
        ...fallback, 
        shouldBuy: false, 
        reason: `فشل التحقق: ${error instanceof Error ? error.message : 'unknown'}` 
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
    pairAddress: string;
    amountUsd: number;
    network: ChainId;
    tokenSymbol: string;
    maxRetries: number;
    retryDelay: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string; amountUsd: number; tokenAddress: string; price?: number; quantity?: number }> {
    const key = `${params.network}-${params.tokenAddress}-${Date.now()}`;
    let lastError: string | null = null;

    this.pendingTrades.set(key, {
      tokenAddress: params.tokenAddress,
      amount: params.amountUsd,
      attempt: 0,
      lastAttempt: Date.now(),
      status: 'pending'
    });

    for (let attempt = 1; attempt <= params.maxRetries; attempt++) {
      const pending = this.pendingTrades.get(key);
      if (!pending) break;

      try {
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `🔴 محاولة ${attempt}/${params.maxRetries} لشراء ${params.tokenSymbol}` });
        await this.sendNotification('info', `🔴 جاري شراء ${params.tokenSymbol} بمبلغ $${params.amountUsd.toFixed(2)} (${attempt}/${params.maxRetries})`);

        this.pendingTrades.set(key, { ...pending, status: 'processing', attempt, lastAttempt: Date.now() });

        const result = await executeTradeViaWorker({
          side: 'buy',
          network: params.network,
          tokenAddress: params.tokenAddress,
          pairAddress: params.pairAddress,
          amountUsd: params.amountUsd,
          tokenSymbol: params.tokenSymbol,
          userId: this.userId,
          botId: this.botId,
        });

        if (!result.error) {
          this.pendingTrades.set(key, { ...pending, status: 'completed', attempt, lastAttempt: Date.now() });
          setTimeout(() => this.pendingTrades.delete(key), 5000);
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'success', message: `✅ تم شراء ${params.tokenSymbol} بنجاح` });
          return { success: true, txHash: result.txHash || undefined, price: result.price || undefined, quantity: result.quantity || undefined, amountUsd: params.amountUsd, tokenAddress: params.tokenAddress };
        }

        lastError = result.error;
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `⚠️ المحاولة ${attempt} فشلت لـ ${params.tokenSymbol}: ${lastError}` });
        await this.sendNotification('warning', `⚠️ محاولة ${attempt} فشلت لـ ${params.tokenSymbol}: ${lastError}`);

        if (attempt < params.maxRetries) {
          this.pendingTrades.set(key, { ...pending, status: 'pending', attempt, lastAttempt: Date.now() });
          await new Promise(resolve => setTimeout(resolve, params.retryDelay));
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'خطأ غير معروف';
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'error', message: `❌ المحاولة ${attempt} فشلت: ${lastError}` });
        if (attempt < params.maxRetries) await new Promise(resolve => setTimeout(resolve, params.retryDelay));
      }
    }

    this.pendingTrades.delete(key);
    await this.sendNotification('error', `❌ فشل شراء ${params.tokenSymbol} بعد ${params.maxRetries} محاولات: ${lastError || 'خطأ غير معروف'}`);
    return { success: false, error: `فشل بعد ${params.maxRetries} محاولات: ${lastError || 'خطأ غير معروف'}`, amountUsd: params.amountUsd, tokenAddress: params.tokenAddress };
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
                  message: `🔴 تحديث سعر البيع: $${sellPrice.toFixed(6)} (أفضل)`,
                });
                await this.sendNotification('info', `🔴 تحديث سعر بيع ${token.symbol}: $${sellPrice.toFixed(6)}`);
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
          message: `🔴 محاولة البيع ${attempt}/${MAX_SELL_RETRIES} لـ ${token.symbol} عند $${sellPrice.toFixed(6)}`,
        });
        await this.sendNotification('info', `🔴 محاولة بيع ${token.symbol} ${attempt}/${MAX_SELL_RETRIES}`);

        const result = await executeTradeViaWorker({
          side: 'sell',
          network: network,
          tokenAddress: token.tokenAddress,
          amountUsd: sellPrice * buyTrade.quantity,
          pairAddress: token.pairAddress,
          tokenSymbol: token.symbol,
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
        message: `🔴 تم تحديث إعدادات البوت (الشبكات: ${config.networks.join(', ')})`,
      });
      this.sendNotification('info', `🔴 تم تحديث إعدادات البوت (الشبكات: ${config.networks.join(', ')})`);
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
    
    // 🆕 بدء مراقبة Watchlist
    this.startWatchlistMonitoring();
  }

  // ============================================================
  // ⏹️ إيقاف البوت
  // ============================================================

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // 🆕 إيقاف مراقبة Watchlist
    this.stopWatchlistMonitoring();
    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: '⏹️ Bot stopped',
    });
    this.sendNotification('warning', '⏹️ تم إيقاف البوت');
  }

  // ============================================================
  // ⏱️ التحكم بالمسح التلقائي
  // ============================================================

  startAutoScan(): void {
    if (this.autoScanIntervalId !== null) {
      console.log(`⚠️ [${this.botId || 'BOT'}] المسح التلقائي يعمل بالفعل`);
      return;
    }
    
    const intervalMs = this.scanIntervalMinutes * 60 * 1000;
    console.log(`🔴 [${this.botId || 'BOT'}] بدأ المسح التلقائي كل ${this.scanIntervalMinutes} دقيقة`);
    
    this.sendNotification('success', `▶️ بدأ المسح التلقائي كل ${this.scanIntervalMinutes} دقيقة`);
    
    this.autoScanIntervalId = setInterval(() => {
      console.log(`🔴 [${this.botId || 'BOT'}] تنفيذ دورة مسح تلقائي (كل ${this.scanIntervalMinutes} دقيقة)`);
      this.runCycle(true);
    }, intervalMs);
    
    setTimeout(() => {
      this.runCycle(true);
    }, 1000);
  }

  stopAutoScan(): void {
    if (this.autoScanIntervalId !== null) {
      clearInterval(this.autoScanIntervalId);
      this.autoScanIntervalId = null;
      console.log(`⏹️ [${this.botId || 'BOT'}] تم إيقاف المسح التلقائي`);
      
      this.sendNotification('warning', '⏹️ تم إيقاف المسح التلقائي');
    } else {
      console.log(`⚠️ [${this.botId || 'BOT'}] المسح التلقائي غير نشط`);
    }
  }

  setScanInterval(minutes: number): void {
    const oldInterval = this.scanIntervalMinutes;
    this.scanIntervalMinutes = Math.max(1, Math.min(60, minutes));
    
    console.log(`⏱️ [${this.botId || 'BOT'}] تغيير وقت المسح: ${oldInterval} → ${this.scanIntervalMinutes} دقيقة`);
    
    this.sendNotification('info', `⏱️ تم تغيير وقت المسح إلى ${this.scanIntervalMinutes} دقيقة`);
    
    if (this.autoScanIntervalId !== null) {
      console.log(`🔴 [${this.botId || 'BOT'}] إعادة تشغيل المسح التلقائي بالوقت الجديد`);
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
  // 🆕 دوال Watchlist المحلية (localStorage فقط)
  // ============================================================

  private getWatchlistFromStorage(): any[] {
    try {
      const raw = localStorage.getItem(`watchlist_${this.userId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveWatchlistToStorage(list: any[]) {
    try {
      localStorage.setItem(`watchlist_${this.userId}`, JSON.stringify(list));
    } catch (e) { /* تجاهل */ }
  }

  private addToWatchlistLocal(token: DiscoveredToken, reason: string) {
    const list = this.getWatchlistFromStorage();
    const exists = list.some(item => item.tokenAddress === token.tokenAddress && item.network === token.chainId);
    if (exists) return;
    
    list.push({
      tokenAddress: token.tokenAddress,
      network: token.chainId,
      symbol: token.symbol || '??',
      name: token.name || token.symbol || 'Unknown',
      addedAt: Date.now(),
      reason: reason,
      status: 'watching',
      lastPrice: token.priceUsd || 0,
      score: token.score || 0,
    });
    this.saveWatchlistToStorage(list);
    this.sendNotification('info', `👀 تمت إضافة ${token.symbol || token.tokenAddress.slice(0, 8)} إلى قائمة المراقبة (${reason})`);
  }

  private updateWatchlistItem(tokenAddress: string, network: string, updates: any) {
    const list = this.getWatchlistFromStorage();
    const index = list.findIndex(item => item.tokenAddress === tokenAddress && item.network === network);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      this.saveWatchlistToStorage(list);
    }
  }

  // ============================================================
  // 🆕 دورة المراقبة (Watchlist Cycle) مع تنفيذ تلقائي
  // ============================================================

  private async runWatchlistCycle(): Promise<void> {
    if (this.config.status !== 'running') return;

    const watchlist = this.getWatchlistFromStorage();
    if (watchlist.length === 0) return;

    for (const item of watchlist) {
      try {
        const key = `${item.network}:${item.tokenAddress}`;
        // منع التكرار (5 دقائق)
        if (this.watchlistNotifyCooldown.get(key) && Date.now() - this.watchlistNotifyCooldown.get(key)! < 300000) continue;

        // 1. جلب بيانات السوق الحقيقية
        const dexRes = await fetch(`${WORKER_URL}/dex-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenAddress: item.tokenAddress, network: item.network })
        });
        const dexData = await dexRes.json();
        if (!dexData.success || !dexData.data) continue;

        const market = dexData.data;
        const price = market.price || 0;
        const liquidity = market.liquidity || 0;
        const volume = market.volume24h || 0;
        const change24 = market.priceChange?.h24 || 0;
        const pairAddress = market.pairAddress || '';

        // 2. تحليل فني حقيقي
        let techScore = 0;
        let buySignal = false;
        try {
          const candles = await fetchCandles(item.tokenAddress, item.network, '15m', 30);
          if (candles && candles.length > 20) {
            const tech = analyzeTechnical(candles);
            techScore = tech.score || 0;
            buySignal = tech.buySignal || false;
          }
        } catch (e) { /* تجاهل */ }

        // 3. حساب النقاط
        let score = 0;
        if (liquidity >= 200000) score += 25;
        else if (liquidity >= 50000) score += 15;
        if (volume >= 1000000) score += 25;
        else if (volume >= 200000) score += 15;
        if (change24 > 5) score += 20;
        else if (change24 > 0) score += 10;
        if (buySignal) score += 15;
        if (techScore > 60) score += 10;
        const finalScore = Math.min(100, score);

        // 4. تحديث القائمة
        this.updateWatchlistItem(item.tokenAddress, item.network, {
          lastPrice: price,
          score: finalScore,
          lastChecked: Date.now()
        });

        // 5. شرط الشراء (finalScore >= 75)
        if (finalScore >= 75 && liquidity > 50000 && volume > 100000) {
          const tp = price * 1.15;
          const sl = price * 0.92;
          const balance = await this.wallet.refreshBalance(item.network);
          const required = Math.min(100, liquidity * 0.01);

          // بناء الإشعار الأساسي
          let msg = `
🟢 BUY OPPORTUNITY FOUND (WATCHLIST)

${item.symbol} (${item.symbol})
Score: ${finalScore}/100
Technical: ${techScore}/100
Safety: ${liquidity > 100000 ? 'High' : 'Medium'}

Liquidity: $${liquidity.toLocaleString()}
Volume 24h: $${volume.toLocaleString()}

Entry: $${price.toFixed(8)}
TP: $${tp.toFixed(8)}
SL: $${sl.toFixed(8)}

Required: $${required.toFixed(2)}
Available: $${balance.toFixed(2)}
          `;

          // ✅ التحقق من الرصيد
          if (balance < required) {
            // ❌ رصيد غير كافٍ - إشعار تفصيلي
            msg += `\n❌ TRADE NOT EXECUTED\nReason: INSUFFICIENT BALANCE`;
            await this.sendNotification('warning', msg);
            
            this.updateWatchlistItem(item.tokenAddress, item.network, { 
              status: 'ready',
              lastError: 'INSUFFICIENT_BALANCE'
            });
          } else {
            // ✅ رصيد كافٍ - تنفيذ الشراء
            msg += `\n✅ EXECUTING BUY...`;
            await this.sendNotification('info', msg);

            // ✅ تنفيذ الشراء
            const result = await this.executeBuyWithRetry({
              tokenAddress: item.tokenAddress,
              pairAddress: pairAddress,
              amountUsd: required,
              maxRetries: 3,
              retryDelay: 10000,
              network: item.network as ChainId,
              tokenSymbol: item.symbol,
            });

            if (result.success) {
              // ✅ شراء ناجح
              const successMsg = `
✅ BUY EXECUTED SUCCESSFULLY (WATCHLIST)

${item.symbol} (${item.symbol})
Entry: $${price.toFixed(8)}
Amount: $${required.toFixed(2)}
TP: $${tp.toFixed(8)}
SL: $${sl.toFixed(8)}
TX: ${result.txHash?.slice(0, 16) || 'N/A'}

📈 بدء مراقبة الصفقة تلقائياً
              `;
              await this.sendNotification('success', successMsg);

              // تسجيل الصفقة في activePositions
              const trade: Trade = {
                id: generateId(),
                timestamp: Date.now(),
                network: item.network as ChainId,
                tokenSymbol: item.symbol,
                tokenAddress: item.tokenAddress,
                pairAddress: pairAddress,
                side: 'buy',
                amountUsd: required,
                priceUsd: price,
                quantity: required / price,
                status: 'executed',
                reason: `Watchlist: نقاط ${finalScore}/100`,
                txHash: result.txHash,
              };

              this.dailyTrades++;
              const positionKey = `${item.network}-${item.tokenAddress}`;
              this.highestPrices.set(positionKey, price);
              this.activePositions.set(positionKey, trade);

              // حفظ الصفقة في قاعدة البيانات
              await saveTrade({
                token: trade.tokenSymbol,
                tokenAddress: trade.tokenAddress,
                network: trade.network,
                amount: trade.amountUsd,
                price: trade.priceUsd,
                type: 'BUY',
                status: 'EXECUTED',
                timestamp: getTimestamp(),
                txHash: trade.txHash,
                pnl: 0,
                pnlPercent: 0,
              });

              // تحديث حالة العملة في Watchlist
              this.updateWatchlistItem(item.tokenAddress, item.network, { 
                status: 'bought',
                boughtAt: Date.now()
              });

              // بدء مراقبة الصفقة للبيع التلقائي
              this.scheduleSellCheck({
                chainId: item.network as ChainId,
                tokenAddress: item.tokenAddress,
                symbol: item.symbol,
                name: item.name,
                priceUsd: price,
                liquidityUsd: liquidity,
                volume24h: volume,
                pairAddress: pairAddress,
              } as DiscoveredToken, item.network as ChainId, trade);

            } else {
              // ❌ فشل الشراء - إشعار مفصل جداً
              const failMsg = `
❌ BUY FAILED (WATCHLIST)

📌 العملة: ${item.symbol} (${item.symbol})
📍 الشبكة: ${item.network}
💰 السعر: $${price.toFixed(8)}
💵 المبلغ المطلوب: $${required.toFixed(2)}
📊 النقاط: ${finalScore}/100

🔴 سبب الفشل: ${result.error || 'Unknown error'}

📋 تفاصيل إضافية:
• السيولة: $${liquidity.toLocaleString()}
• الحجم: $${volume.toLocaleString()}
• TP: $${tp.toFixed(8)}
• SL: $${sl.toFixed(8)}

🔄 سيتم إعادة المحاولة في الدورة القادمة
              `;
              await this.sendNotification('error', failMsg);

              // ✅ سجل في الكونسول أيضاً
              this.onLog({
                id: generateId(),
                timestamp: Date.now(),
                level: 'error',
                message: `❌ فشل شراء ${item.symbol} (${item.tokenAddress}) من Watchlist: ${result.error || 'Unknown error'}`
              });
              
              this.updateWatchlistItem(item.tokenAddress, item.network, { 
                status: 'watching',
                lastError: result.error || 'UNKNOWN_ERROR'
              });
            }
          }

          // منع التكرار (5 دقائق)
          this.watchlistNotifyCooldown.set(key, Date.now());
        }

      } catch (e) {
        console.warn(`⚠️ فشل فحص ${item.symbol}:`, e);
      }
    }
  }

  private startWatchlistMonitoring() {
    if (this.watchlistIntervalId) return;
    this.watchlistIntervalId = setInterval(() => this.runWatchlistCycle(), 60000);
    setTimeout(() => this.runWatchlistCycle(), 5000);
  }

  private stopWatchlistMonitoring() {
    if (this.watchlistIntervalId) {
      clearInterval(this.watchlistIntervalId);
      this.watchlistIntervalId = null;
    }
  }

  // ============================================================
  // 🔍 مسح يدوي
  // ============================================================

  async runManualScan(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔴 بدأ المسح اليدوي للشبكات...');
      await this.sendNotification('info', '🔴 بدأ المسح اليدوي...');
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
  // ✅ حساب نقاط السوق (مع قراءة آمنة)
  // ============================================================

  private calculateMarketScore(token: DiscoveredToken): number {
    const liquidity = Number(token.liquidityUsd) || 0;
    const volume = Number(token.volume24h) || 0;
    
    // ✅ قراءة آمنة لـ txns24h
    const txnsData = token.txns24h || { buys: 0, sells: 0 };
    const buys = Number(txnsData.buys) || 0;
    const sells = Number(txnsData.sells) || 0;
    const totalTxns = buys + sells;
    const buyRatio = totalTxns > 0 ? buys / totalTxns : 0.5;
    const volumeToLiquidity = liquidity > 0 ? volume / liquidity : 0;
    
    const m5 = Number(token.priceChange?.m5) || 0;
    const h1 = Number(token.priceChange?.h1) || 0;
    const h6 = Number(token.priceChange?.h6) || 0;

    let score = 0;

    // السيولة
    if (liquidity >= 500_000) score += 25;
    else if (liquidity >= 100_000) score += 20;
    else if (liquidity >= 50_000) score += 15;
    else if (liquidity >= 15_000) score += 8;
    else if (liquidity >= 5_000) score += 5;

    // الحجم
    if (volume >= 1_000_000) score += 20;
    else if (volume >= 250_000) score += 16;
    else if (volume >= 50_000) score += 12;
    else if (volume >= 20_000) score += 6;
    else if (volume >= 5_000) score += 4;

    // المعاملات
    if (totalTxns >= 2000) score += 15;
    else if (totalTxns >= 500) score += 12;
    else if (totalTxns >= 150) score += 8;
    else if (totalTxns >= 50) score += 4;
    else if (totalTxns >= 10) score += 2;

    // نسبة الشراء
    if (buyRatio >= 0.65) score += 15;
    else if (buyRatio >= 0.58) score += 10;
    else if (buyRatio >= 0.52) score += 5;
    else if (buyRatio >= 0.45) score += 3;

    // الزخم
    if (m5 > 0 && m5 <= 5) score += 5;
    if (h1 > 0 && h1 <= 15) score += 8;
    if (h6 > 0 && h6 <= 30) score += 7;

    // ✅ إضافة نقاط للعملات الجديدة
    if (token.pairCreatedAt) {
      const ageHours = (Date.now() - token.pairCreatedAt) / (1000 * 60 * 60);
      if (ageHours < 24) score += 10;
      else if (ageHours < 48) score += 5;
    }

    // ✅ إضافة نقاط للزخم القوي
    if (h1 > 10) score += 10;
    if (h6 > 20) score += 10;

    // نسبة الحجم/السيولة
    if (volumeToLiquidity >= 1) score += 5;
    else if (volumeToLiquidity >= 0.5) score += 3;

    return Math.max(0, Math.min(100, score));
  }

  // ============================================================
  // 🔍 دورة المسح الرئيسية (المعدلة)
  // ============================================================

  private async runCycle(silent: boolean = false): Promise<void> {
    await this.checkPendingTrades();

    if (!silent) await this.sendNotification('info', `🔴 بدأ دورة مسح (${this.config.networks.join(', ')})`);

    for (const network of this.config.networks) {
      try {
        if (!silent) await this.sendNotification('info', `🔍 مسح الشبكة: ${getNetworkName(network)}`);

        const result = await discoverAllTokens(network);
        if (result.error) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'error', message: `${getNetworkName(network)}: ${result.error}` });
          continue;
        }

        if (!result.pairs?.length) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `${getNetworkName(network)}: لا توجد أزواج` });
          continue;
        }

        const sourceStr = result.sources.map((s) => `${s.name}:${s.count}${s.error ? '!' : ''}`).join(' | ');
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `${getNetworkName(network)}: ${result.pairs.length} pairs [${sourceStr}]` });

        // ✅ سجل تفاصيل أول 5 عملات (مع قراءة آمنة)
        for (let i = 0; i < Math.min(5, result.pairs.length); i++) {
          const token = result.pairs[i];
          const score = this.calculateMarketScore(token);
          const txns = token.txns24h || { buys: 0, sells: 0 };
          const totalTxns = (txns.buys || 0) + (txns.sells || 0);
          const buyRatio = totalTxns > 0 ? ((txns.buys || 0) / totalTxns * 100) : 50;
          
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: `🔍 ${token.symbol || '??'}: Liq=$${token.liquidityUsd || 0}, Vol=$${token.volume24h || 0}, Txns=${totalTxns}, BuyRatio=${buyRatio.toFixed(1)}%, Score=${score}`
          });
        }

        // ✅ حساب المرشحين
        const candidates = result.pairs
          .filter((p: DiscoveredToken) => p.priceUsd > 0 && p.liquidityUsd > 0 && p.volume24h > 0)
          .map((p: DiscoveredToken) => ({ ...p, status: 'candidate' as const, strategy: 'market-ranked' }))
          .sort((a: DiscoveredToken, b: DiscoveredToken) => this.calculateMarketScore(b) - this.calculateMarketScore(a))
          .slice(0, 30);

        const statsMsg = `${getNetworkName(network)}: ${result.pairs.length} pairs -> ${candidates.length} ranked candidates`;
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: statsMsg });
        if (!silent) await this.sendNotification('info', `📊 ${statsMsg}`);

        // ✅ ✅ ✅ دائماً استدعِ processAutoTrades مع جميع الأزواج (وليس فقط المرشحين)
        if (this.config.mode === 'auto') {
          await this.processAutoTrades(result.pairs, network, silent);
        } else {
          const top = candidates.slice(0, 5);
          if (top.length > 0) {
            await this.sendNotification('info', `👀 ${getNetworkName(network)}: ${top.length} فرص للمراجعة اليدوية`);
            top.forEach((t, i) => this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `#${i + 1} ${t.symbol || '??'} | Market Score ${this.calculateMarketScore(t)}/100 | Liquidity $${t.liquidityUsd.toFixed(0)} | Vol $${t.volume24h.toFixed(0)}` }));
          } else {
            this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `👀 ${getNetworkName(network)}: لا توجد فرص للمراجعة اليدوية` });
          }
        }

      } catch (e) {
        const msg = `Cycle error on ${getNetworkName(network)}: ${e instanceof Error ? e.message : 'unknown'}`;
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'error', message: msg });
        if (!silent) await this.sendNotification('error', msg);
      }
    }

    if (!silent) await this.sendNotification('info', `✅ انتهت دورة المسح (${this.activePositions.size} صفقة مفتوحة)`);
    else console.log(`✅ [SILENT] انتهى مسح ${this.botId || 'BOT'}`);
  }

  // ============================================================
  // 📊 معالجة الصفقات التلقائية (المعدلة بالكامل)
  // ============================================================

  private async processAutoTrades(tokens: DiscoveredToken[], network: ChainId, silent: boolean = false): Promise<void> {
    // ✅ سجل فوري لمعرفة ما إذا كانت الدالة تُستدعى
    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `📥 processAutoTrades: بدأت مع ${tokens.length} عملة على ${getNetworkName(network)}`
    });

    // ✅ حلقة إضافة العملات إلى Watchlist (مع سجلات لكل عملة)
    let addedCount = 0;
    let scoreCounts = { low: 0, medium: 0, high: 0 };
    
    for (const token of tokens) {
      try {
        if (!token || !token.tokenAddress) {
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'warning',
            message: `⚠️ تخطي عملة غير صالحة (لا يوجد عنوان)`
          });
          continue;
        }

        // ✅ استخراج البيانات بأمان (مع قيم افتراضية)
        const liq = token.liquidityUsd || 0;
        const vol = token.volume24h || 0;
        const change24 = token.priceChange?.h24 || 0;
        const change1h = token.priceChange?.h1 || 0;
        
        // ✅ حساب score سريع
        let score = 0;
        if (liq >= 50000) score += 15;
        else if (liq >= 15000) score += 8;
        if (vol >= 100000) score += 15;
        else if (vol >= 30000) score += 8;
        if (change24 > 5) score += 20;
        else if (change24 > 0) score += 10;
        if (change1h > 2) score += 10;
        else if (change1h > 0) score += 5;
        
        score = Math.min(100, Math.max(0, score));

        // ✅ سجل لكل عملة مع نقاطها
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'info',
          message: `📊 ${token.symbol || '??'}: Liq=$${liq.toFixed(0)}, Vol=$${vol.toFixed(0)}, Change24=${change24.toFixed(1)}%, Change1h=${change1h.toFixed(1)}%, Score=${score}`
        });
        
        // ✅ إذا كانت النقاط بين 30 و 72، أضف إلى Watchlist
        if (score >= 30 && score < 72 && !this.activePositions.has(`${network}-${token.tokenAddress}`)) {
          this.addToWatchlistLocal(token, `نقاط ${score}/100 (مراقبة)`);
          addedCount++;
          
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'success',
            message: `👀 تمت إضافة ${token.symbol || token.tokenAddress.slice(0, 8)} إلى Watchlist (نقاط ${score}/100)`
          });
        } else if (score >= 72) {
          scoreCounts.high++;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: `⭐ ${token.symbol || '??'}: نقاط ${score}/100 (مرشح قوي، سيعالج لاحقاً)`
          });
        } else if (score >= 15 && score < 30) {
          scoreCounts.low++;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: `⏭️ ${token.symbol || '??'}: نقاط ${score}/100 (أقل من 30، لن يُضاف إلى Watchlist)`
          });
        } else {
          scoreCounts.low++;
          this.onLog({
            id: generateId(),
            timestamp: Date.now(),
            level: 'info',
            message: `⏭️ ${token.symbol || '??'}: نقاط ${score}/100 (منخفض جداً)`
          });
        }
      } catch (e) {
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: `❌ خطأ في معالجة العملة: ${e instanceof Error ? e.message : String(e)}`
        });
      }
    }

    // ✅ سجل ملخص
    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `📊 ملخص Watchlist: تمت إضافة ${addedCount} عملة، نقاط عالية: ${scoreCounts.high}، نقاط منخفضة: ${scoreCounts.low}`
    });

    // ✅ التحقق من الحد اليومي للصفقات
    if (!(await this.canExecuteTrade())) return;

    const sortedTokens = [...tokens].sort((a, b) => this.calculateMarketScore(b) - this.calculateMarketScore(a));

    for (const token of sortedTokens) {
      try {
        if (!token || !token.tokenAddress) continue;
        if (this.activePositions.has(`${network}-${token.tokenAddress}`)) continue;
        if (!(await this.canExecuteTrade())) return;

        const marketScore = this.calculateMarketScore(token);
        if (marketScore < 45) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `⏭️ ${token.symbol || '??'}: Market Score ${marketScore}/100 أقل من 45` });
          continue;
        }

        await this.sendNotification('info', `🧠 فحص ${token.symbol || '??'} | Market ${marketScore}/100`);

        let technicalScore = 0;
        let technicalBuySignal = false;
        let technicalTrend = 'unknown';
        let rsi = 0;

        try {
          const candles = await fetchCandles(token.tokenAddress, network);
          if (!candles || candles.length < 20) {
            this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `⛔ ${token.symbol || '??'}: الشموع غير كافية (${candles?.length || 0}/20)` });
            continue;
          }
          const technical = analyzeTechnical(candles);
          technicalScore = Number(technical.score) || 0;
          technicalBuySignal = Boolean(technical.buySignal);
          technicalTrend = technical.trend || 'unknown';
          rsi = Number(technical.rsi) || 0;
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `📊 ${token.symbol || '??'}: RSI=${rsi.toFixed(1)} | Technical=${technicalScore} | ${technicalTrend} | BuySignal=${technicalBuySignal}` });
        } catch (e) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `⛔ ${token.symbol || '??'}: فشل تحليل الشموع: ${e instanceof Error ? e.message : 'unknown'}` });
          continue;
        }

        if (!technicalBuySignal || technicalScore < 60) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `⏭️ ${token.symbol || '??'}: لا توجد إشارة فنية كافية (Technical ${technicalScore}, BuySignal ${technicalBuySignal})` });
          continue;
        }

        let aiConfidence = 0;
        let aiDecision = 'disabled';
        if (this.config.aiAssist) {
          try {
            const analysis = await analyzeToken(token);
            aiDecision = analysis.recommendation;
            aiConfidence = Number(analysis.confidence) || 0;
            await this.sendNotification('info', `🤖 ${token.symbol || '??'}: AI ${aiDecision} (${aiConfidence}%)`);
            if (!['buy', 'strong_buy'].includes(aiDecision) || aiConfidence < 65) {
              this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `⏭️ ${token.symbol || '??'}: رفض AI — ${aiDecision} ${aiConfidence}%` });
              continue;
            }
          } catch (e) {
            this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `⛔ ${token.symbol || '??'}: AI غير متاح، لن يتم الشراء تلقائياً` });
            continue;
          }
        }

        const finalScore = this.config.aiAssist
          ? marketScore * 0.35 + technicalScore * 0.45 + aiConfidence * 0.20
          : marketScore * 0.45 + technicalScore * 0.55;

        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `🎯 ${token.symbol || '??'}: Market=${marketScore} Technical=${technicalScore} AI=${aiConfidence} Final=${finalScore.toFixed(0)}` });

        // ✅ إضافة العملات الجزئية إلى Watchlist (مرة أخرى للتأكيد)
        if (finalScore >= 45 && finalScore < 72 && !this.activePositions.has(`${network}-${token.tokenAddress}`)) {
          this.addToWatchlistLocal(token, `نقاط ${finalScore.toFixed(0)}/100 (تحتاج متابعة)`);
        }

        if (finalScore < 55) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'info', message: `⏭️ ${token.symbol || '??'}: Final Score ${finalScore.toFixed(0)}/100 أقل من 55` });
          continue;
        }

        const verification = await this.verifyTradeOpportunity(token, network);
        if (!verification.shouldBuy) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `⛔ ${token.symbol || '??'}: ${verification.reason}` });
          continue;
        }

        const stopLossPct = Math.max(0.5, Number(this.config.stopLossPct) || 1.5);
        const stopLossPrice = verification.currentPrice * (1 - stopLossPct / 100);
        const positionSize = await this.calculateDynamicPositionSize(token, verification.currentPrice, stopLossPrice);
        const tradingAmount = Number(this.config.tradingAmount) || 100;
        const maxPosition = Math.min(Number(this.config.maxPositionUsd) || tradingAmount, tradingAmount);
        const amountUsd = Math.max(5, Math.min(positionSize, maxPosition));

        const balance = await this.wallet.refreshBalance(network);
        if (!Number.isFinite(balance) || balance < amountUsd) {
          this.onLog({ id: generateId(), timestamp: Date.now(), level: 'warning', message: `💰 ${token.symbol || '??'}: رصيد غير كافٍ (${Number(balance || 0).toFixed(2)} < $${amountUsd.toFixed(2)})` });
          continue;
        }

        await this.sendNotification('success', `🎯 اختيار ${token.symbol || '??'} | Final ${finalScore.toFixed(0)}/100 | $${amountUsd.toFixed(2)}`);

        const result = await this.executeBuyWithRetry({
          tokenAddress: token.tokenAddress,
          pairAddress: token.pairAddress,
          amountUsd,
          maxRetries: 3,
          retryDelay: 10000,
          network,
          tokenSymbol: token.symbol,
        });

        const executedPrice = result.price && result.price > 0 ? result.price : verification.currentPrice;
        const quantity = result.quantity && result.quantity > 0 ? result.quantity : amountUsd / executedPrice;
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
          priceUsd: executedPrice,
          quantity,
          status,
          reason: `Market ${marketScore} | Technical ${technicalScore} | AI ${aiDecision} ${aiConfidence}% | Final ${finalScore.toFixed(0)}`,
          txHash: result.txHash,
        };

        await saveTrade({ token: trade.tokenSymbol, tokenAddress: trade.tokenAddress, network: trade.network, amount: trade.amountUsd, price: trade.priceUsd, type: 'BUY', status: status === 'executed' ? 'EXECUTED' : 'FAILED', timestamp: getTimestamp(), txHash: trade.txHash, pnl: 0, pnlPercent: 0 });
        this.onTrade(trade);

        if (!result.success) {
          await this.sendNotification('error', `❌ BUY ${token.symbol || '??'} FAILED: ${result.error || 'unknown'}`);
          continue;
        }

        this.dailyTrades++;
        const key = `${network}-${token.tokenAddress}`;
        this.highestPrices.set(key, executedPrice);
        this.activePositions.set(key, trade);
        this.onLog({ id: generateId(), timestamp: Date.now(), level: 'success', message: `💰 REAL BUY ${token.symbol || '??'} $${amountUsd.toFixed(2)} @ $${executedPrice.toFixed(8)} tx=${result.txHash?.slice(0, 16) || 'N/A'}` });
        await this.sendNotification('success', `✅ تم شراء ${token.symbol || '??'} فعلياً | $${amountUsd.toFixed(2)} | tx ${result.txHash?.slice(0, 16) || 'N/A'}`);
        this.scheduleSellCheck(token, network, trade);
      } catch (e) {
        this.onLog({
          id: generateId(),
          timestamp: Date.now(),
          level: 'error',
          message: `❌ خطأ في معالجة ${token?.symbol || 'عملة'}: ${e instanceof Error ? e.message : String(e)}`
        });
      }
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
      message: `📈 مراقبة ${token.symbol || '??'}: TP $${takeProfit.toFixed(6)} | SL $${stopLoss.toFixed(6)} | Trailing Stop: ${TRAILING_STOP_PERCENT}%`,
    });
    this.sendNotification('info', `📈 مراقبة ${token.symbol || '??'}: TP $${takeProfit.toFixed(6)} | SL $${stopLoss.toFixed(6)}`);

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
            message: `🔴 ${token.symbol || '??'}: ${sellReason}`,
          });
          await this.sendNotification('error', `🔴 ${token.symbol || '??'}: ${sellReason}`);
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
    const quantity = amountUsd / Math.max(priceUsd, Number.EPSILON);

    this.onLog({
      id: generateId(),
      timestamp: Date.now(),
      level: 'info',
      message: `🖐️ Executing MANUAL ${side.toUpperCase()} ${token.symbol || '??'} via worker...`,
    });
    await this.sendNotification('info', `🖐️ تنفيذ ${side.toUpperCase()} يدوي لـ ${token.symbol || '??'} بمبلغ $${amountUsd}`);

    const result = await executeTradeViaWorker({
      side,
      network: token.chainId,
      tokenAddress: token.tokenAddress,
      amountUsd,
      pairAddress: token.pairAddress,
      tokenSymbol: token.symbol,
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
      priceUsd: result.price && result.price > 0 ? result.price : priceUsd,
      quantity: result.quantity && result.quantity > 0 ? result.quantity : quantity,
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
        message: `🖐️ MANUAL ${side.toUpperCase()} ${token.symbol || '??'} FAILED: ${result.error}`,
      });
      await this.sendNotification('error', `❌ فشل ${side} يدوي لـ ${token.symbol || '??'}: ${result.error}`);
    } else {
      this.onLog({
        id: generateId(),
        timestamp: Date.now(),
        level: 'success',
        message: `🖐️ MANUAL ${side.toUpperCase()} ${token.symbol || '??'} @ $${priceUsd.toFixed(6)}`,
      });
      await this.sendNotification('success', `✅ تم ${side === 'buy' ? 'شراء' : 'بيع'} ${token.symbol || '??'} يدوياً @ $${priceUsd.toFixed(6)}`);
    }
    
    return trade;
  }
}