// src/lib/botEngine.ts

import type { BotConfig, Trade, ChainId, BotLogEntry, DiscoveredToken } from '@/types';
import { discoverAllPairs } from '@/lib/discovery';
import { runHunterPipeline, getTopCandidates, type HunterFilters } from '@/lib/hunterEngine';
import { analyzeToken } from '@/lib/gemini';
import { saveTrade, saveLog, generateId, getTimestamp } from '@/lib/madarTech';
import { getNetworkName } from '@/config/networks';
import { BotWalletManager } from '@/lib/wallet';

type LogCallback = (log: BotLogEntry) => void;
type TradeCallback = (trade: Trade) => void;

const EDGE_FUNCTION_URL = import.meta.env.VITE_MADARTECH_API_URL || 'https://cloud.madartech.uk/api';
const DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';

// ============ ثوابت إدارة المخاطر ============
const MAX_PRICE_IMPACT = 0.02; // 2% حد أقصى للانزلاق
const MAX_VOLATILITY = 0.30; // 30% حد أقصى للتقلب
const MAX_POSITION_TIME = 24 * 60 * 60 * 1000; // 24 ساعة كحد أقصى للصفقة
const TRAILING_STOP_PERCENT = 8; // 8% وقف متحرك من أعلى سعر
const RISK_PER_TRADE = 2; // 2% مخاطرة من المحفظة لكل صفقة
const MAX_SELL_RETRIES = 5; // 5 محاولات للبيع
const SELL_RETRY_DELAY = 15000; // 15 ثانية بين محاولات البيع

// ============ دالة حساب حجم الصفقة بناءً على المخاطرة ============
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

// ============ دالة حساب درجة الثقة التقنية ============
function calculateTechnicalScore(market: DiscoveredToken): number {
  let score = 0;
  
  // السيولة
  if (market.liquidityUsd >= 500_000) score += 20;
  else if (market.liquidityUsd >= 100_000) score += 15;
  else if (market.liquidityUsd >= 50_000) score += 10;
  
  // حجم التداول
  const volumeRatio = market.volume24h / Math.max(market.marketCap || 1, 1);
  if (volumeRatio >= 0.30) score += 20;
  else if (volumeRatio >= 0.15) score += 10;
  
  // الزخم (التغيرات السعرية)
  if (market.priceChange.m5 > 1) score += 10;
  if (market.priceChange.h1 > 3) score += 15;
  if (market.priceChange.h6 > 5) score += 10;
  
  // نشاط السوق
  const totalTxns = market.txns24h.buys + market.txns24h.sells;
  if (totalTxns >= 1000) score += 15;
  else if (totalTxns >= 500) score += 10;
  else if (totalTxns >= 100) score += 5;
  
  // نسبة الشراء/البيع
  const buyRatio = market.txns24h.buys / Math.max(totalTxns, 1);
  if (buyRatio > 0.65) score += 10;
  else if (buyRatio > 0.55) score += 5;
  
  return Math.min(score, 100);
}

// ============ دالة تنفيذ الصفقة عبر Edge ============
async function executeTradeViaEdge(params: {
  side: 'buy' | 'sell';
  network: ChainId;
  tokenAddress: string;
  amountUsd: number;
  pairAddress: string;
}): Promise<{ txHash: string | null; error: string | null }> {
  try {
    const res = await fetch(`${EDGE_FUNCTION_URL}/execute-trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DB-ID': DB_ID,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { txHash: null, error: `Edge function ${res.status}: ${errBody}` };
    }

    const data = await res.json();
    return { txHash: data.txHash ?? null, error: data.error ?? null };
  } catch (e) {
    return { txHash: null, error: e instanceof Error ? e.message : 'Edge function failed' };
  }
}

// ============ كلاس TradingBot المطور بالكامل ============
export class TradingBot {
  private config: BotConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onLog: LogCallback;
  private onTrade: TradeCallback;
  private activePositions: Map<string, Trade> = new Map();
  private wallet: BotWalletManager;
  
  // ✅ إدارة الصفقات اليومية
  private dailyTrades: number = 0;
  private lastResetDate: string = '';
  private dynamicMaxTrades: number = 5;
  
  // ✅ إدارة الصفقات المعلقة
  private pendingTrades: Map<string, {
    tokenAddress: string;
    amount: number;
    attempt: number;
    lastAttempt: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }> = new Map();

  // ✅ تتبع أعلى سعر لكل صفقة (لـ Trailing Stop)
  private highestPrices: Map<string, number> = new Map();

  constructor(config: BotConfig, onLog: LogCallback, onTrade: TradeCallback) {
    this.config = config;
    this.onLog = onLog;
    this.onTrade = onTrade;
    this.wallet = BotWalletManager.getInstance();
  }

  updateConfig(config: BotConfig): void {
    this.config = config;
    if (config.status === 'running' && this.intervalId === null) {
      this.start();
    } else if (config.status !== 'running' && this.intervalId !== null) {
      this.stop();
    }
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.log('info', `Bot started in ${this.config.mode} mode on ${this.config.networks.length} networks`);
    this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), this.config.tradeIntervalSec * 1000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.log('info', 'Bot stopped');
  }

  private log(level: BotLogEntry['level'], message: string): void {
    const entry: BotLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      message,
    };
    this.onLog(entry);
    saveLog({
      level: level === 'success' ? 'SUCCESS' : level.toUpperCase() as any,
      message,
      timestamp: getTimestamp(),
    }).catch(() => {});
  }

  // ============ حساب عامل المضاعفة بناءً على حجم المحفظة ============
  private getBalanceMultiplier(balance: number): number {
    // $50 → 0.3x, $200 → 0.7x, $500 → 1x, $1000 → 2x, $5000 → 5x
    return Math.max(0.3, Math.min(5, balance / 500));
  }

  // ============ تحليل السوق وجمع الإشارات ============
  private async analyzeMarketSignals(): Promise<{
    score: number;
    signals: string[];
    maxTrades: number;
  }> {
    try {
      const signals: string[] = [];
      let score = 0;

      // جلب بيانات السوق
      const result = await discoverAllPairs('solana');
      if (result.error || result.pairs.length === 0) {
        return { score: 30, signals: ['⚠️ لا توجد بيانات كافية'], maxTrades: 5 };
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

      // العملات الجديدة
      const newPairs = pairs.filter(p => {
        if (!p.pairCreatedAt) return false;
        return (Date.now() - p.pairCreatedAt) / (1000 * 60 * 60) < 24;
      });

      // 1️⃣ نسبة العملات الخضراء
      if (bullishRatio > 0.6) { score += 20; signals.push(`📈 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }
      else if (bullishRatio > 0.5) { score += 10; signals.push(`📊 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }
      else if (bullishRatio < 0.4) { score -= 10; signals.push(`📉 ${(bullishRatio * 100).toFixed(0)}% خضراء`); }
      else { signals.push(`⚖️ ${(bullishRatio * 100).toFixed(0)}% خضراء`); }

      // 2️⃣ حجم التداول
      if (volumeRatio > 1.5) { score += 20; signals.push(`📊 حجم مرتفع جداً`); }
      else if (volumeRatio > 1.2) { score += 15; signals.push(`📊 حجم مرتفع`); }
      else if (volumeRatio > 0.8) { signals.push(`📊 حجم متوسط`); }
      else { score -= 10; signals.push(`📊 حجم منخفض`); }

      // 3️⃣ نسبة الشراء/البيع
      if (buyRatio > 0.6) { score += 20; signals.push(`🟢 شراء ${(buyRatio * 100).toFixed(0)}%`); }
      else if (buyRatio > 0.55) { score += 10; signals.push(`🟢 شراء ${(buyRatio * 100).toFixed(0)}%`); }
      else if (buyRatio < 0.45) { score -= 10; signals.push(`🔴 شراء ${(buyRatio * 100).toFixed(0)}%`); }
      else { signals.push(`⚖️ شراء ${(buyRatio * 100).toFixed(0)}%`); }

      // 4️⃣ تغير السعر
      if (avgPriceChange > 5) { score += 20; signals.push(`📈 تغير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange > 2) { score += 10; signals.push(`📈 تغير +${avgPriceChange.toFixed(1)}%`); }
      else if (avgPriceChange < -3) { score -= 10; signals.push(`📉 تغير ${avgPriceChange.toFixed(1)}%`); }
      else { signals.push(`⚖️ تغير ${avgPriceChange.toFixed(1)}%`); }

      // 5️⃣ العملات الجديدة
      if (newPairs.length > 15) { score += 20; signals.push(`🆕 ${newPairs.length} جديد`); }
      else if (newPairs.length > 8) { score += 10; signals.push(`🆕 ${newPairs.length} جديد`); }
      else if (newPairs.length < 3) { score -= 10; signals.push(`🆕 ${newPairs.length} جديد`); }
      else { signals.push(`🆕 ${newPairs.length} جديد`); }

      // جلب رصيد المحفظة
      const wallet = this.wallet.getWallet('solana');
      const balance = wallet?.balance || 0;
      const balanceUsd = balance * 100;

      // حساب عدد الصفقات
      const multiplier = this.getBalanceMultiplier(balanceUsd);
      let baseTrades = 5;
      if (score >= 80) baseTrades = 10;
      else if (score >= 60) baseTrades = 8;
      else if (score >= 40) baseTrades = 6;
      else baseTrades = 5;

      let maxTrades = Math.round(baseTrades * multiplier);
      const maxLimit = Math.min(20, this.config.maxTradesPerDay || 10);
      maxTrades = Math.max(3, Math.min(maxTrades, maxLimit));

      this.log('info', `🧠 تحليل السوق: النقاط ${score}/100 | المحفظة: $${balanceUsd.toFixed(0)} | الصفقات: ${maxTrades}`);
      for (const signal of signals) {
        this.log('info', `   📊 ${signal}`);
      }

      return { score, signals, maxTrades };

    } catch (error) {
      this.log('warning', `⚠️ فشل تحليل السوق: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
      return { score: 40, signals: ['⚠️ تحليل السوق غير متاح'], maxTrades: 5 };
    }
  }

  // ============ التحقق من الحد اليومي (مع الديناميكي) ============
  private async canExecuteTrade(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.lastResetDate !== today) {
      this.dailyTrades = 0;
      this.lastResetDate = today;
      
      // ✅ تحديث الحد الديناميكي
      const analysis = await this.analyzeMarketSignals();
      this.dynamicMaxTrades = analysis.maxTrades;
      this.log('info', `📊 الحد الديناميكي اليومي: ${this.dynamicMaxTrades} صفقات`);
    }

    if (this.dailyTrades >= this.dynamicMaxTrades) {
      this.log('warning', `⚠️ تم الوصول للحد الديناميكي: ${this.dynamicMaxTrades} صفقات`);
      return false;
    }

    return true;
  }

  // ============ التحقق من وضع العملة قبل الشراء ============
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
      const latestPairs = await discoverAllPairs(network);
      const latestToken = latestPairs.pairs.find(
        (p) => p.baseToken.address === token.tokenAddress
      );

      if (!latestToken) {
        return {
          shouldBuy: false,
          reason: '❌ العملة غير موجودة حالياً',
          currentPrice: token.priceUsd,
          currentVolume: token.volume24h,
          currentLiquidity: token.liquidityUsd,
          priceChange5m: 0,
          priceImpact: 0,
          volatility: 0,
        };
      }

      const currentPrice = parseFloat(latestToken.priceUsd || '0');
      const currentVolume = latestToken.volume?.h24 || 0;
      const currentLiquidity = latestToken.liquidity?.usd || 0;
      const priceChange5m = latestToken.priceChange?.m5 || 0;

      // ✅ حساب الانزلاق السعري (Price Impact)
      const priceImpact = Math.abs(currentPrice - token.priceUsd) / token.priceUsd;
      if (priceImpact > MAX_PRICE_IMPACT) {
        return {
          shouldBuy: false,
          reason: `⚠️ الانزلاق السعري كبير: ${(priceImpact * 100).toFixed(2)}% (الحد الأقصى: ${MAX_PRICE_IMPACT * 100}%)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility: 0,
        };
      }

      // ✅ حساب التقلبات (Volatility)
      const volatility = Math.abs(token.priceChange.h24) / 100;
      if (volatility > MAX_VOLATILITY) {
        return {
          shouldBuy: false,
          reason: `⚠️ التقلبات عالية: ${(volatility * 100).toFixed(2)}% (الحد الأقصى: ${MAX_VOLATILITY * 100}%)`,
          currentPrice,
          currentVolume,
          currentLiquidity,
          priceChange5m,
          priceImpact,
          volatility,
        };
      }

      // ✅ التحقق من تغير السعر
      const priceChange = ((currentPrice - token.priceUsd) / token.priceUsd) * 100;
      if (Math.abs(priceChange) > 5) {
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

      // ✅ التحقق من الحجم
      const volumeChange = ((currentVolume - token.volume24h) / token.volume24h) * 100;
      if (volumeChange < -50) {
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

      // ✅ التحقق من السيولة
      const liquidityChange = ((currentLiquidity - token.liquidityUsd) / token.liquidityUsd) * 100;
      if (liquidityChange < -30) {
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

  // ============ حساب حجم الصفقة الديناميكي ============
  private async calculateDynamicPositionSize(
    token: DiscoveredToken,
    entryPrice: number,
    stopLossPrice: number
  ): Promise<number> {
    try {
      const wallet = this.wallet.getWallet('solana');
      if (!wallet) return this.config.maxPositionUsd;
      
      const balance = wallet.balance;
      const balanceUsd = balance * 100;
      
      const positionSize = calculatePositionSize(
        balanceUsd,
        RISK_PER_TRADE,
        entryPrice,
        stopLossPrice
      );
      
      const minSize = 1;
      const maxSize = this.config.maxPositionUsd;
      
      return Math.max(minSize, Math.min(positionSize, maxSize));
    } catch {
      return this.config.maxPositionUsd;
    }
  }

  // ============ تنفيذ الشراء مع إعادة المحاولة ============
  private async executeBuyWithRetry(params: {
    tokenAddress: string;
    amountInSol: number;
    slippage: number;
    password: string;
    maxRetries: number;
    retryDelay: number;
  }): Promise<{ success: boolean; txHash?: string; error?: string; amount: number; tokenAddress: string }> {
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
        this.log('info', `🔄 محاولة ${attempt}/${params.maxRetries} لشراء ${params.tokenAddress.slice(0, 8)}...`);
        this.pendingTrades.set(key, {
          ...pending!,
          status: 'processing',
          attempt: attempt,
          lastAttempt: Date.now()
        });

        const result = await this.wallet.executeBuy({
          tokenAddress: params.tokenAddress,
          amount: params.amountInSol,
          slippage: params.slippage,
          password: params.password,
        });

        if (result.success) {
          this.log('success', `✅ تم الشراء بنجاح في المحاولة ${attempt}`);
          this.pendingTrades.set(key, {
            ...pending!,
            status: 'completed',
            lastAttempt: Date.now()
          });
          setTimeout(() => this.pendingTrades.delete(key), 5000);
          return result;
        }

        lastError = result.error || 'فشل غير معروف';
        this.log('warning', `⚠️ المحاولة ${attempt} فشلت: ${lastError}`);

        if (attempt < params.maxRetries) {
          this.log('info', `⏳ انتظار ${params.retryDelay/1000} ثانية قبل المحاولة ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, params.retryDelay));
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'خطأ غير معروف';
        this.log('error', `❌ المحاولة ${attempt} فشلت: ${lastError}`);
        
        if (attempt < params.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, params.retryDelay));
        }
      }
    }

    this.pendingTrades.delete(key);
    return {
      success: false,
      error: `فشل بعد ${params.maxRetries} محاولات: ${lastError}`,
      amount: params.amountInSol,
      tokenAddress: params.tokenAddress,
    };
  }

  // ============ تنفيذ البيع مع إعادة المحاولة (5 مرات) ============
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
        // ✅ جلب السعر الحالي قبل كل محاولة
        if (attempt > 1) {
          const { getPairsByToken } = await import('@/lib/dexscreener');
          const latest = await getPairsByToken(network, token.tokenAddress);
          const current = latest.find((p) => p.pairAddress === token.pairAddress);
          if (current && current.priceUsd) {
            const newPrice = parseFloat(current.priceUsd);
            if (newPrice > sellPrice) {
              sellPrice = newPrice;
              this.log('info', `🔄 تحديث سعر البيع: $${sellPrice.toFixed(6)} (أفضل)`);
            } else if (newPrice < sellPrice * 0.98 && isPriceCritical) {
              this.log('warning', `⚠️ السعر ينخفض بسرعة! البيع عند $${newPrice.toFixed(6)}`);
              sellPrice = newPrice;
            }
          }
        }

        this.log('info', `🔄 محاولة البيع ${attempt}/${MAX_SELL_RETRIES} لـ ${token.symbol} عند $${sellPrice.toFixed(6)}`);

        const { txHash, error } = await executeTradeViaEdge({
          side: 'sell',
          network,
          tokenAddress: token.tokenAddress,
          amountUsd: sellPrice * buyTrade.quantity,
          pairAddress: token.pairAddress,
        });

        if (error) {
          lastError = error;
          this.log('warning', `⚠️ محاولة ${attempt} فشلت: ${error}`);

          if (attempt < MAX_SELL_RETRIES) {
            this.log('info', `⏳ انتظار ${SELL_RETRY_DELAY/1000} ثانية قبل المحاولة ${attempt+1}...`);
            await new Promise(resolve => setTimeout(resolve, SELL_RETRY_DELAY));
          }
          continue;
        }

        // ✅ نجحت الصفقة!
        const pnl = (sellPrice - buyTrade.priceUsd) * buyTrade.quantity;
        
        this.log('success', `✅ بيع ${token.symbol} بنجاح بعد ${attempt} محاولة!`);
        this.log('success', `📊 السعر: $${sellPrice.toFixed(6)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);

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
          txHash: txHash ?? undefined,
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
        this.log('error', `❌ محاولة ${attempt} فشلت: ${lastError}`);

        if (attempt < MAX_SELL_RETRIES) {
          this.log('info', `⏳ انتظار ${SELL_RETRY_DELAY/1000} ثانية قبل المحاولة ${attempt+1}...`);
          await new Promise(resolve => setTimeout(resolve, SELL_RETRY_DELAY));
        }
      }
    }

    // ❌ فشلت جميع المحاولات!
    this.log('error', `🚨 فشل بيع ${token.symbol} بعد ${MAX_SELL_RETRIES} محاولات!`);
    this.log('error', `📊 آخر خطأ: ${lastError}`);
    this.log('error', `📊 السعر الحالي: $${sellPrice.toFixed(6)}`);

    await saveLog({
      level: 'ERROR',
      message: `🚨 فشل بيع ${token.symbol} بعد ${MAX_SELL_RETRIES} محاولات: ${lastError}`,
      timestamp: getTimestamp(),
      context: {
        token: token.symbol,
        tokenAddress: token.tokenAddress,
        network,
        attempt: MAX_SELL_RETRIES,
        lastPrice: sellPrice,
        buyPrice: buyTrade.priceUsd,
        buyAmount: buyTrade.amountUsd,
      }
    });

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

  // ============ التحقق من الصفقات المعلقة ============
  private async checkPendingTrades(): Promise<void> {
    const now = Date.now();
    const TIMEOUT = 120000;

    for (const [key, pending] of this.pendingTrades) {
      if (now - pending.lastAttempt > TIMEOUT && pending.status === 'pending') {
        pending.status = 'failed';
        this.log('error', `⏰ انتهى وقت ${pending.tokenAddress.slice(0, 8)}... (${TIMEOUT/1000}s)`);
        this.pendingTrades.delete(key);
        continue;
      }

      if (pending.status === 'processing' && now - pending.lastAttempt > 30000) {
        pending.status = 'completed';
        this.log('success', `✅ تم تأكيد تنفيذ ${pending.tokenAddress.slice(0, 8)}...`);
        this.pendingTrades.delete(key);
      }
    }
  }

  // ============ دورة المسح الرئيسية ============
  private async runCycle(): Promise<void> {
    await this.checkPendingTrades();

    for (const network of this.config.networks) {
      try {
        const result = await discoverAllPairs(network);
        if (result.error) {
          this.log('error', `${getNetworkName(network)}: ${result.error}`);
          continue;
        }
        if (result.pairs.length === 0) {
          this.log('warning', `${getNetworkName(network)}: no pairs from any source`);
          continue;
        }

        const sourceStr = result.sources
          .map((s) => `${s.name}:${s.count}${s.error ? '!' : ''}`)
          .join(' | ');
        this.log('info', `${getNetworkName(network)}: ${result.pairs.length} pairs [${sourceStr}]`);

        const filters: HunterFilters = {
          minLiquidityUsd: this.config.minLiquidityUsd,
          minVolume24h: this.config.minVolume24h,
          minPriceChange24h: this.config.minPriceChange24h,
        };

        const huntResult = runHunterPipeline(result.pairs, network, filters);
        this.log('info', `${getNetworkName(network)}: ${huntResult.stats.totalPairs} pairs -> ${huntResult.stats.uniqueTokens} tokens -> ${huntResult.stats.candidates} candidates`);

        if (huntResult.tokens.length === 0) {
          this.log('info', `${getNetworkName(network)}: no tokens met criteria this cycle`);
          continue;
        }

        if (this.config.mode === 'auto') {
          await this.processAutoTrades(huntResult.tokens, network);
        } else {
          const candidates = getTopCandidates(huntResult.tokens, 5);
          this.log('info', `${getNetworkName(network)}: ${candidates.length} opportunities found (manual review)`);
        }
      } catch (e) {
        this.log('error', `Cycle error on ${getNetworkName(network)}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }
  }

  // ============ معالجة الصفقات التلقائية ============
  private async processAutoTrades(tokens: DiscoveredToken[], network: ChainId): Promise<void> {
    if (!(await this.canExecuteTrade())) {
      this.log('info', `⏸️ توقف الشراء: تم الوصول للحد اليومي (${this.dynamicMaxTrades})`);
      return;
    }

    const candidates = getTopCandidates(tokens, 3);

    for (const token of candidates) {
      if (token.status === 'reject') continue;

      const priceUsd = token.priceUsd;
      if (priceUsd <= 0) continue;

      if (!(await this.canExecuteTrade())) {
        this.log('info', `⏸️ توقف الشراء: تم الوصول للحد اليومي (${this.dynamicMaxTrades})`);
        return;
      }

      // ✅ 1. تحليل Gemini
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
        } catch {
          reason = `Hunter score ${token.score}/100 (AI unavailable)`;
        }
      }

      // ✅ 2. حساب النقاط التقنية
      const technicalScore = calculateTechnicalScore(token);

      // ✅ 3. دمج النقاط التقنية مع ثقة AI
      const finalScore = (technicalScore * 0.60) + (aiConfidence * 0.40);

      this.log('info', `📊 ${token.symbol}: Technical=${technicalScore}, AI Confidence=${aiConfidence}, Final=${finalScore.toFixed(0)}`);

      // ✅ 4. القرار النهائي
      if (!shouldBuy || finalScore < 60) {
        this.log('info', `⏭️ تخطي ${token.symbol}: ${reason} (Final Score: ${finalScore.toFixed(0)})`);
        continue;
      }

      // ✅ 5. التحقق من وضع العملة
      this.log('info', `🔍 التحقق من وضع ${token.symbol}...`);
      const verification = await this.verifyTradeOpportunity(token, network);

      if (!verification.shouldBuy) {
        this.log('warning', `⛔ ${token.symbol}: ${verification.reason}`);
        this.log('info', `   📊 السعر الحالي: $${verification.currentPrice.toFixed(6)}`);
        this.log('info', `   📊 الانزلاق: ${(verification.priceImpact * 100).toFixed(2)}%`);
        this.log('info', `   📊 التقلبات: ${(verification.volatility * 100).toFixed(2)}%`);
        continue;
      }

      // ✅ 6. حساب حجم الصفقة الديناميكي
      const stopLossPrice = verification.currentPrice * (1 - this.config.stopLossPct / 100);
      const positionSize = await this.calculateDynamicPositionSize(
        token,
        verification.currentPrice,
        stopLossPrice
      );

      const amountUsd = Math.min(positionSize, this.config.maxPositionUsd);
      const amountInSol = amountUsd / 100;

      this.log('success', `✅ ${token.symbol}: ${verification.reason}`);
      this.log('info', `   📊 السعر الحالي: $${verification.currentPrice.toFixed(6)}`);
      this.log('info', `   📊 حجم الصفقة: $${amountUsd.toFixed(2)} (${RISK_PER_TRADE}% مخاطرة)`);
      this.log('info', `   📊 النقاط النهائية: ${finalScore.toFixed(0)}/100`);

      // ✅ 7. تنفيذ الشراء
      const result = await this.executeBuyWithRetry({
        tokenAddress: token.tokenAddress,
        amountInSol: amountInSol,
        slippage: 0.01,
        password: this.config.password || 'default',
        maxRetries: 3,
        retryDelay: 30000,
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
        this.log('error', `BUY ${token.symbol} FAILED: ${result.error}`);
      } else {
        this.dailyTrades++;
        this.log('info', `📊 الصفقة ${this.dailyTrades}/${this.dynamicMaxTrades} اليوم`);
        
        this.highestPrices.set(`${network}-${token.tokenAddress}`, verification.currentPrice);
        this.activePositions.set(`${network}-${token.tokenAddress}`, trade);
        this.log('success', `✅ REAL BUY ${token.symbol} on ${getNetworkName(network)} @ $${verification.currentPrice.toFixed(6)} — tx: ${result.txHash?.slice(0, 16)}... — ${reason}`);
        
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

  // ============ مراقبة السعر للبيع ============
  private scheduleSellCheck(token: DiscoveredToken, network: ChainId, buyTrade: Trade): void {
    const takeProfit = buyTrade.priceUsd * (1 + this.config.takeProfitPct / 100);
    const stopLoss = buyTrade.priceUsd * (1 - this.config.stopLossPct / 100);
    const positionKey = `${network}-${token.tokenAddress}`;
    let highestPrice = buyTrade.priceUsd;

    this.log('info', `📈 مراقبة ${token.symbol}: TP $${takeProfit.toFixed(6)} | SL $${stopLoss.toFixed(6)} | Trailing Stop: ${TRAILING_STOP_PERCENT}%`);

    const checkId = setInterval(async () => {
      if (this.config.status !== 'running') {
        clearInterval(checkId);
        return;
      }

      try {
        const { getPairsByToken } = await import('@/lib/dexscreener');
        const latest = await getPairsByToken(network, token.tokenAddress);
        const current = latest.find((p) => p.pairAddress === token.pairAddress);
        if (!current || !current.priceUsd) return;

        const currentPrice = parseFloat(current.priceUsd);
        const profitPercent = ((currentPrice - buyTrade.priceUsd) / buyTrade.priceUsd) * 100;

        if (currentPrice > highestPrice) {
          highestPrice = currentPrice;
          this.highestPrices.set(positionKey, highestPrice);
        }

        // ✅ حالات البيع
        let sellReason: string | null = null;
        let sellPrice = currentPrice;
        let isPriceCritical = false;

        // 1️⃣ وقف الخسارة الثابت
        if (currentPrice <= stopLoss) {
          sellReason = `Stop loss -${this.config.stopLossPct}%`;
          isPriceCritical = true;
        }
        // 2️⃣ جني الأرباح
        else if (currentPrice >= takeProfit) {
          sellReason = `Take profit +${this.config.takeProfitPct}%`;
          isPriceCritical = false;
        }
        // 3️⃣ Trailing Stop
        else {
          const trailingStopPrice = highestPrice * (1 - TRAILING_STOP_PERCENT / 100);
          if (currentPrice <= trailingStopPrice && highestPrice > buyTrade.priceUsd * 1.05) {
            sellReason = `Trailing stop: انخفض ${TRAILING_STOP_PERCENT}% من أعلى سعر ($${highestPrice.toFixed(6)})`;
            isPriceCritical = true;
          }
        }

        // 4️⃣ Time Exit
        if (!sellReason) {
          const positionAge = Date.now() - buyTrade.timestamp;
          if (positionAge > MAX_POSITION_TIME) {
            sellReason = `Time exit: انتهت ${MAX_POSITION_TIME / (60 * 60 * 1000)} ساعات`;
            isPriceCritical = true;
          }
        }

        // ✅ تنفيذ البيع
        if (sellReason) {
          clearInterval(checkId);
          this.log('info', `🔴 ${token.symbol}: ${sellReason}`);
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
        // تجاهل الأخطاء مؤقتاً
      }
    }, 15000);
  }

  // ============ تنفيذ البيع (واجهة) ============
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

  // ============ تنفيذ صفقة يدوية ============
  async executeManualTrade(token: DiscoveredToken, side: 'buy' | 'sell', amountUsd: number): Promise<Trade> {
    const priceUsd = token.priceUsd;
    const quantity = amountUsd / priceUsd;

    this.log('info', `Executing MANUAL ${side.toUpperCase()} ${token.symbol} via edge function...`);

    const { txHash, error } = await executeTradeViaEdge({
      side,
      network: token.chainId,
      tokenAddress: token.tokenAddress,
      amountUsd,
      pairAddress: token.pairAddress,
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
      status: error ? 'failed' : 'executed',
      reason: 'Manual trade',
      txHash: txHash ?? undefined,
    };

    await saveTrade({
      token: trade.tokenSymbol,
      tokenAddress: trade.tokenAddress,
      network: trade.network,
      amount: trade.amountUsd,
      price: trade.priceUsd,
      type: side === 'buy' ? 'BUY' : 'SELL',
      status: error ? 'FAILED' : 'EXECUTED',
      timestamp: getTimestamp(),
      txHash: trade.txHash,
      pnl: 0,
      pnlPercent: 0,
    });
    this.onTrade(trade);
    this.log(error ? 'error' : 'success', `MANUAL ${side.toUpperCase()} ${token.symbol} ${error ? 'FAILED: ' + error : '@ $' + priceUsd.toFixed(6)}`);
    return trade;
  }
}