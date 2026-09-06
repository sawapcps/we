// src/lib/botTrading.ts
// ============================================================
// 🤖 نظام التداول الرئيسي - النسخة المعدلة بالكامل
// ✅ يدعم: تداول حقيقي عبر Jupiter + 1inch
// ✅ يدعم: التحليل الذكي (Gemini + Hunter)
// ✅ يدعم: إدارة المخاطر المتقدمة
// ✅ يدعم: إشعارات فورية لكل تحركات البوت (حتى في حال نقص الرصيد)
// ✅ لا يحتوي على أي بيانات وهمية
// ============================================================

import { BotWalletManager } from './wallet';
import { AccountManager } from './accounts';
import { discoverAllPairs } from './discovery';
import { runBotAnalysis, getTopRecommendations, type HunterFilters } from './hunterEngine';
import { analyzeToken, quickAnalysis } from './gemini';
import { saveTrade, saveLog, generateId, getTimestamp } from './madarTech';
import { getNetworkName } from '@/config/networks';
import type { ChainId, DiscoveredToken, Trade, BotLogEntry } from '@/types';

// ============================================================
// 🔗 Worker URL
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
const DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';

// ============================================================
// 📊 إعدادات المخاطر
// ============================================================

const RISK_CONFIG = {
  MAX_POSITION_SIZE_USD: 1000,
  MIN_POSITION_SIZE_USD: 10,
  MAX_OPEN_POSITIONS: 5,
  MAX_DAILY_TRADES: 10,
  STOP_LOSS_PERCENT: 10,
  TAKE_PROFIT_PERCENT: 20,
  TRAILING_STOP_PERCENT: 5,
  MAX_SLIPPAGE_PERCENT: 1,
  MIN_LIQUIDITY_USD: 50000,
  MIN_VOLUME_USD: 100000,
  MAX_PRICE_IMPACT: 2,
};

// ============================================================
// 📊 واجهة قرار التداول
// ============================================================

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'REJECT';
  token: DiscoveredToken;
  amount: number;
  price: number;
  reason: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  stopLoss: number;
  takeProfit: number;
}

// ============================================================
// 🤖 نظام التداول الرئيسي
// ============================================================

export class BotTradingSystem {
  private static instance: BotTradingSystem;
  private isRunning: boolean = false;
  private wallet: BotWalletManager;
  private activeTrades: Map<string, Trade> = new Map();
  private dailyTrades: number = 0;
  private lastResetDate: string = '';
  private userId: string;
  private botId?: string;

  private constructor() {
    this.wallet = BotWalletManager.getInstance();
    this.userId = '';
  }

  static getInstance(): BotTradingSystem {
    if (!BotTradingSystem.instance) {
      BotTradingSystem.instance = new BotTradingSystem();
    }
    return BotTradingSystem.instance;
  }

  // ============================================================
  // 📢 إرسال إشعار للمستخدم عبر الـ Worker
  // ============================================================

 private async sendNotification(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string
): Promise<void> {
  try {
    // ✅ حفظ في قاعدة البيانات
    await saveLog({
      level: type.toUpperCase(),
      message,
      timestamp: getTimestamp(),
      context: { userId: this.userId, botId: this.botId }
    });

    // ✅ إرسال إلى Worker (سيظهر في الإشعارات 🔔)
    await fetch(`${WORKER_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: 'hunter',  // 👈 أضف هذا السطر للفصل بين التطبيقات
        userId: this.userId,
        type,
        message,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {}); // تجاهل أخطاء الشبكة

    console.log(`📢 [${type}] ${message}`);
  } catch (error) {
    console.warn('⚠️ فشل إرسال الإشعار:', error);
  }
}

  // ============================================================
  // 🚀 تشغيل دورة التداول
  // ============================================================

  async runTradingCycle(
    networks: ChainId[],
    password: string,
    userId: string,
    botId?: string
  ): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ البوت يعمل بالفعل');
      await this.sendNotification('warning', '⚠️ البوت يعمل بالفعل');
      return;
    }

    this.isRunning = true;
    this.userId = userId;
    this.botId = botId;
    console.log('🔄 بدء دورة التداول...');
    await this.sendNotification('info', '🔄 بدء دورة التداول...');

    try {
      // ✅ التحقق من الحد اليومي
      if (!(await this.canTradeToday())) {
        const msg = '⏸️ تم الوصول للحد اليومي للصفقات';
        console.log(msg);
        await this.sendNotification('warning', msg);
        return;
      }

      for (const network of networks) {
        await this.scanAndTrade(network, password);
      }
    } catch (error) {
      const msg = `❌ خطأ في دورة التداول: ${error instanceof Error ? error.message : 'غير معروف'}`;
      console.error(msg);
      await this.sendNotification('error', msg);
      await this.logError(msg);
    } finally {
      this.isRunning = false;
    }
  }

  // ============================================================
  // 🔍 المسح والتداول على شبكة محددة
  // ============================================================

  private async scanAndTrade(network: ChainId, password: string): Promise<void> {
    console.log(`🔍 مسح الشبكة: ${getNetworkName(network)}`);

    try {
      // ✅ 1. جلب جميع الأزواج
      const result = await discoverAllPairs(network);
      
      if (result.error || result.pairs.length === 0) {
        console.log(`⚠️ لا توجد أزواج على ${getNetworkName(network)}`);
        return;
      }

      console.log(`✅ تم العثور على ${result.pairs.length} زوج على ${getNetworkName(network)}`);

      // ✅ 2. تشغيل تحليل Hunter
      const filters: HunterFilters = {
        minLiquidityUsd: RISK_CONFIG.MIN_LIQUIDITY_USD,
        minVolume24h: RISK_CONFIG.MIN_VOLUME_USD,
        minPriceChange24h: 0,
      };

      const huntResult = runBotAnalysis(result.pairs, network, {
        botType: 'hunter',
        minLiquidityUsd: RISK_CONFIG.MIN_LIQUIDITY_USD,
        minVolume24h: RISK_CONFIG.MIN_VOLUME_USD,
        minScore: 50,
        maxPositionUsd: RISK_CONFIG.MAX_POSITION_SIZE_USD,
        takeProfitPct: RISK_CONFIG.TAKE_PROFIT_PERCENT,
        stopLossPct: RISK_CONFIG.STOP_LOSS_PERCENT,
        networks: [network],
        minSmartWallets: 2,
        smartWalletConfidence: 60,
        allowNewListings: true,
        minBuyRatio: 0.55,
      });

      const candidates = huntResult.tokens
        .filter(t => t.status === 'candidate')
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (candidates.length === 0) {
        console.log(`❌ لا توجد مرشحين على ${getNetworkName(network)}`);
        return;
      }

      console.log(`✅ تم العثور على ${candidates.length} مرشح على ${getNetworkName(network)}`);

      // ✅ 3. معالجة كل مرشح
      for (const token of candidates) {
        await this.processCandidate(token, network, password);
      }
    } catch (error) {
      const msg = `❌ خطأ في مسح ${getNetworkName(network)}: ${error instanceof Error ? error.message : 'غير معروف'}`;
      console.error(msg);
      await this.sendNotification('error', msg);
      await this.logError(msg);
    }
  }

  // ============================================================
  // 📊 معالجة مرشح فردي
  // ============================================================

  private async processCandidate(
    token: DiscoveredToken,
    network: ChainId,
    password: string
  ): Promise<void> {
    console.log(`🧠 تحليل ${token.symbol}...`);

    try {
      // ✅ 1. التحقق من الصفقات المفتوحة
      if (this.activeTrades.size >= RISK_CONFIG.MAX_OPEN_POSITIONS) {
        const msg = `⚠️ تم الوصول للحد الأقصى للصفقات المفتوحة (${RISK_CONFIG.MAX_OPEN_POSITIONS})`;
        console.log(msg);
        await this.sendNotification('warning', msg);
        return;
      }

      // ✅ 2. التحقق من الحد اليومي
      if (!(await this.canTradeToday())) {
        const msg = '⏸️ تم الوصول للحد اليومي للصفقات';
        console.log(msg);
        await this.sendNotification('warning', msg);
        return;
      }

      // ✅ 3. تحليل Gemini (أو تحليل سريع)
      let analysis;
      try {
        analysis = await analyzeToken(token, 'hunter');
        console.log(`✅ تحليل Gemini لـ ${token.symbol}: ${analysis.recommendation} (${analysis.confidence}%)`);
      } catch (error) {
        console.warn(`⚠️ فشل تحليل Gemini، استخدام تحليل سريع:`, error);
        analysis = quickAnalysis(token);
        console.log(`✅ تحليل سريع لـ ${token.symbol}: ${analysis.recommendation} (${analysis.confidence}%)`);
      }

      // ✅ 4. اتخاذ القرار
      const decision = this.makeTradeDecision(token, analysis);
      console.log(`📊 قرار التداول لـ ${token.symbol}: ${decision.action} (الثقة: ${decision.confidence}%)`);

      if (decision.action === 'REJECT' || decision.action === 'HOLD') {
        console.log(`⏭️ تخطي ${token.symbol}: ${decision.reason}`);
        return;
      }

      // ✅ 5. التحقق من الرصيد
      const wallet = this.wallet.getWallet(network);
      if (!wallet) {
        const msg = `❌ لا توجد محفظة على ${getNetworkName(network)}`;
        console.log(msg);
        await this.sendNotification('error', msg);
        return;
      }

      const balance = await this.wallet.refreshBalance(network);
      if (balance < decision.amount) {
        const msg = `⚠️ الرصيد غير كافٍ: $${balance.toFixed(2)} متاح، المطلوب: $${decision.amount.toFixed(2)}`;
        console.log(msg);
        await this.sendNotification('warning', msg);
        return;
      }

      // ✅ 6. تنفيذ الصفقة
      if (decision.action === 'BUY') {
        await this.executeBuy(token, network, decision, password);
      } else if (decision.action === 'SELL') {
        await this.executeSell(token, network, decision, password);
      }
    } catch (error) {
      const msg = `❌ خطأ في معالجة ${token.symbol}: ${error instanceof Error ? error.message : 'غير معروف'}`;
      console.error(msg);
      await this.sendNotification('error', msg);
      await this.logError(msg);
    }
  }

  // ============================================================
  // 📊 اتخاذ قرار التداول
  // ============================================================

  private makeTradeDecision(
    token: DiscoveredToken,
    analysis: any
  ): TradeDecision {
    const price = token.priceUsd;
    const score = token.score || 0;
    const liq = token.liquidityUsd || 0;
    const vol = token.volume24h || 0;
    const change24 = token.priceChange?.h24 || 0;

    // ✅ حساب حجم الصفقة
    let amount = 0;
    let action: 'BUY' | 'SELL' | 'HOLD' | 'REJECT' = 'HOLD';
    let reason = '';
    let confidence = 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    // ✅ فحص السيولة
    if (liq < RISK_CONFIG.MIN_LIQUIDITY_USD) {
      return {
        action: 'REJECT',
        token,
        amount: 0,
        price,
        reason: `السيولة منخفضة: $${liq.toLocaleString()} < $${RISK_CONFIG.MIN_LIQUIDITY_USD.toLocaleString()}`,
        confidence: 0,
        riskLevel: 'high',
        stopLoss: price * 0.9,
        takeProfit: price * 1.2,
      };
    }

    // ✅ فحص الحجم
    if (vol < RISK_CONFIG.MIN_VOLUME_USD) {
      return {
        action: 'REJECT',
        token,
        amount: 0,
        price,
        reason: `حجم التداول منخفض: $${vol.toLocaleString()} < $${RISK_CONFIG.MIN_VOLUME_USD.toLocaleString()}`,
        confidence: 0,
        riskLevel: 'medium',
        stopLoss: price * 0.9,
        takeProfit: price * 1.2,
      };
    }

    // ✅ قرار الشراء
    const isStrongBuy = analysis.recommendation === 'strong_buy' || analysis.recommendation === 'buy';
    const isGoodScore = score >= 60;
    const isGoodVolume = vol > 200000;
    const isPositiveChange = change24 > 0;
    const isGoodLiquidity = liq > 100000;

    if (isStrongBuy && isGoodScore && isGoodVolume && isGoodLiquidity) {
      action = 'BUY';
      // ✅ حجم الصفقة يعتمد على الثقة والسيولة
      const baseAmount = Math.min(200, liq * 0.01);
      const confidenceMultiplier = 0.5 + (analysis.confidence / 200);
      amount = Math.min(
        baseAmount * confidenceMultiplier,
        RISK_CONFIG.MAX_POSITION_SIZE_USD
      );
      amount = Math.max(amount, RISK_CONFIG.MIN_POSITION_SIZE_USD);
      confidence = Math.min(95, 50 + (score * 0.3) + (analysis.confidence * 0.2));
      reason = `تحليل قوي: نقاط ${score}/100، ثقة AI ${analysis.confidence}%، حجم جيد`;
      riskLevel = liq > 200000 ? 'low' : 'medium';
    } else if (isStrongBuy && isGoodScore) {
      action = 'BUY';
      amount = Math.min(100, liq * 0.005);
      amount = Math.max(amount, RISK_CONFIG.MIN_POSITION_SIZE_USD);
      confidence = Math.min(80, 40 + (score * 0.3) + (analysis.confidence * 0.1));
      reason = `تحليل جيد: نقاط ${score}/100، ثقة AI ${analysis.confidence}%`;
      riskLevel = 'medium';
    } else if (analysis.recommendation === 'hold' && score >= 40) {
      action = 'HOLD';
      confidence = 30;
      reason = `مراقبة: نقاط ${score}/100، يحتاج مزيد من الإشارات`;
      riskLevel = 'medium';
    } else {
      action = 'REJECT';
      confidence = 10;
      reason = `لا توجد إشارات شراء كافية: نقاط ${score}/100، توصية ${analysis.recommendation}`;
      riskLevel = 'high';
    }

    return {
      action,
      token,
      amount,
      price,
      reason,
      confidence,
      riskLevel,
      stopLoss: price * (1 - (RISK_CONFIG.STOP_LOSS_PERCENT / 100)),
      takeProfit: price * (1 + (RISK_CONFIG.TAKE_PROFIT_PERCENT / 100)),
    };
  }

  // ============================================================
  // 💰 تنفيذ الشراء
  // ============================================================

  private async executeBuy(
    token: DiscoveredToken,
    network: ChainId,
    decision: TradeDecision,
    password: string
  ): Promise<void> {
    console.log(`🚀 تنفيذ شراء ${token.symbol} بمبلغ $${decision.amount.toFixed(2)}`);

    try {
      // ✅ تنفيذ الشراء عبر المحفظة
      const result = await this.wallet.executeBuy({
        tokenAddress: token.tokenAddress,
        amount: decision.amount / 100, // تحويل إلى SOL
        slippage: RISK_CONFIG.MAX_SLIPPAGE_PERCENT / 100,
        password,
        network,
      });

      if (!result.success) {
        const msg = `❌ فشل شراء ${token.symbol}: ${result.error}`;
        console.error(msg);
        await this.sendNotification('error', msg);
        await this.logError(msg);
        return;
      }

      // ✅ تسجيل الصفقة
      const trade: Trade = {
        id: generateId(),
        timestamp: Date.now(),
        network,
        tokenSymbol: token.symbol,
        tokenAddress: token.tokenAddress,
        pairAddress: token.pairAddress,
        side: 'buy',
        amountUsd: decision.amount,
        priceUsd: decision.price,
        quantity: decision.amount / decision.price,
        status: 'executed',
        reason: decision.reason,
        txHash: result.txHash,
        userId: this.userId,
        botId: this.botId,
        isOpen: true,
      };

      // ✅ حفظ الصفقة
      this.activeTrades.set(`${network}-${token.tokenAddress}`, trade);
      this.dailyTrades++;

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
        userId: this.userId,
        botId: this.botId,
      });

      // ✅ إشعار نجاح الشراء
      await this.sendNotification('success', `✅ تم شراء ${token.symbol} بمبلغ $${decision.amount.toFixed(2)}`);

      console.log(`✅ شراء ${token.symbol} بنجاح!`);
      console.log(`   📊 السعر: $${decision.price.toFixed(6)}`);
      console.log(`   📊 الكمية: ${trade.quantity.toFixed(4)}`);
      console.log(`   📊 التجزئة: ${result.txHash?.slice(0, 16)}...`);

      // ✅ بدء مراقبة الصفقة
      this.scheduleTradeMonitoring(token, network, trade);

    } catch (error) {
      const msg = `❌ خطأ في شراء ${token.symbol}: ${error instanceof Error ? error.message : 'غير معروف'}`;
      console.error(msg);
      await this.sendNotification('error', msg);
      await this.logError(msg);
    }
  }

  // ============================================================
  // 💰 تنفيذ البيع
  // ============================================================

  private async executeSell(
    token: DiscoveredToken,
    network: ChainId,
    decision: TradeDecision,
    password: string
  ): Promise<void> {
    console.log(`🚀 تنفيذ بيع ${token.symbol} بمبلغ $${decision.amount.toFixed(2)}`);

    try {
      // ✅ تنفيذ البيع عبر المحفظة
      const result = await this.wallet.executeSell({
        tokenAddress: token.tokenAddress,
        amount: decision.amount / decision.price,
        slippage: RISK_CONFIG.MAX_SLIPPAGE_PERCENT / 100,
        password,
        network,
      });

      if (!result.success) {
        const msg = `❌ فشل بيع ${token.symbol}: ${result.error}`;
        console.error(msg);
        await this.sendNotification('error', msg);
        await this.logError(msg);
        return;
      }

      // ✅ حساب الربح/الخسارة
      const buyTrade = this.activeTrades.get(`${network}-${token.tokenAddress}`);
      let pnl = 0;
      let pnlPercent = 0;

      if (buyTrade) {
        pnl = (decision.price - buyTrade.priceUsd) * buyTrade.quantity;
        pnlPercent = ((decision.price - buyTrade.priceUsd) / buyTrade.priceUsd) * 100;
      }

      // ✅ تسجيل الصفقة
      const trade: Trade = {
        id: generateId(),
        timestamp: Date.now(),
        network,
        tokenSymbol: token.symbol,
        tokenAddress: token.tokenAddress,
        pairAddress: token.pairAddress,
        side: 'sell',
        amountUsd: decision.amount,
        priceUsd: decision.price,
        quantity: decision.amount / decision.price,
        status: 'executed',
        reason: decision.reason,
        txHash: result.txHash,
        userId: this.userId,
        botId: this.botId,
        isOpen: false,
        pnl,
        pnlPercent,
      };

      // ✅ إزالة من الصفقات المفتوحة
      this.activeTrades.delete(`${network}-${token.tokenAddress}`);

      await saveTrade({
        token: trade.tokenSymbol,
        tokenAddress: trade.tokenAddress,
        network: trade.network,
        amount: trade.amountUsd,
        price: trade.priceUsd,
        type: 'SELL',
        status: 'EXECUTED',
        timestamp: getTimestamp(),
        txHash: trade.txHash,
        userId: this.userId,
        botId: this.botId,
        pnl,
        pnlPercent,
      });

      // ✅ إشعار نجاح البيع مع الربح/الخسارة
      const pnlMsg = pnl >= 0 ? `ربح $${pnl.toFixed(2)}` : `خسارة $${Math.abs(pnl).toFixed(2)}`;
      await this.sendNotification(
        pnl >= 0 ? 'success' : 'error',
        `✅ تم بيع ${token.symbol} - ${pnlMsg} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`
      );

      console.log(`✅ بيع ${token.symbol} بنجاح!`);
      console.log(`   📊 السعر: $${decision.price.toFixed(6)}`);
      console.log(`   📊 P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);

    } catch (error) {
      const msg = `❌ خطأ في بيع ${token.symbol}: ${error instanceof Error ? error.message : 'غير معروف'}`;
      console.error(msg);
      await this.sendNotification('error', msg);
      await this.logError(msg);
    }
  }

  // ============================================================
  // 📊 مراقبة الصفقات المفتوحة
  // ============================================================

  private scheduleTradeMonitoring(
    token: DiscoveredToken,
    network: ChainId,
    trade: Trade
  ): void {
    console.log(`📈 بدء مراقبة ${token.symbol}...`);

    const checkInterval = setInterval(async () => {
      try {
        // ✅ جلب السعر الحالي
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
        const changePercent = ((currentPrice - trade.priceUsd) / trade.priceUsd) * 100;

        // ✅ التحقق من وقف الخسارة
        if (changePercent <= -RISK_CONFIG.STOP_LOSS_PERCENT) {
          const msg = `🔴 وقف الخسارة لـ ${token.symbol}: ${changePercent.toFixed(2)}%`;
          console.log(msg);
          await this.sendNotification('error', msg);
          clearInterval(checkInterval);

          // ✅ بيع تلقائي
          const decision: TradeDecision = {
            action: 'SELL',
            token,
            amount: currentPrice * trade.quantity,
            price: currentPrice,
            reason: `وقف الخسارة: ${changePercent.toFixed(2)}%`,
            confidence: 100,
            riskLevel: 'high',
            stopLoss: 0,
            takeProfit: 0,
          };

          await this.executeSell(token, network, decision, import.meta.env.VITE_MASTER_PASSWORD || '');
          return;
        }

        // ✅ التحقق من جني الأرباح
        if (changePercent >= RISK_CONFIG.TAKE_PROFIT_PERCENT) {
          const msg = `🟢 جني الأرباح لـ ${token.symbol}: ${changePercent.toFixed(2)}%`;
          console.log(msg);
          await this.sendNotification('success', msg);
          clearInterval(checkInterval);

          const decision: TradeDecision = {
            action: 'SELL',
            token,
            amount: currentPrice * trade.quantity,
            price: currentPrice,
            reason: `جني الأرباح: ${changePercent.toFixed(2)}%`,
            confidence: 100,
            riskLevel: 'low',
            stopLoss: 0,
            takeProfit: 0,
          };

          await this.executeSell(token, network, decision, import.meta.env.VITE_MASTER_PASSWORD || '');
          return;
        }

        // ✅ تحديث السعر في الذاكرة
        const updatedTrade = { ...trade, priceUsd: currentPrice };
        this.activeTrades.set(`${network}-${token.tokenAddress}`, updatedTrade);

      } catch (error) {
        console.error(`❌ خطأ في مراقبة ${token.symbol}:`, error);
      }
    }, 15000); // كل 15 ثانية

    // ✅ إيقاف المراقبة بعد 24 ساعة
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log(`⏹️ توقف مراقبة ${token.symbol} (انتهى الوقت)`);
    }, 24 * 60 * 60 * 1000);
  }

  // ============================================================
  // 📊 التحقق من الحد اليومي
  // ============================================================

  private async canTradeToday(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    if (this.lastResetDate !== today) {
      this.dailyTrades = 0;
      this.lastResetDate = today;
    }

    return this.dailyTrades < RISK_CONFIG.MAX_DAILY_TRADES;
  }

  // ============================================================
  // 📝 تسجيل الأخطاء
  // ============================================================

  private async logError(message: string): Promise<void> {
    await saveLog({
      level: 'ERROR',
      message,
      timestamp: getTimestamp(),
      context: { userId: this.userId, botId: this.botId },
    });
  }

  // ============================================================
  // 🛑 إيقاف البوت
  // ============================================================

  stop(): void {
    this.isRunning = false;
    console.log('⏹️ تم إيقاف البوت');
    this.sendNotification('info', '⏹️ تم إيقاف البوت');
  }

  // ============================================================
  // 📊 الحالة
  // ============================================================

  getStatus(): {
    isRunning: boolean;
    activeTrades: number;
    dailyTrades: number;
    maxDailyTrades: number;
  } {
    return {
      isRunning: this.isRunning,
      activeTrades: this.activeTrades.size,
      dailyTrades: this.dailyTrades,
      maxDailyTrades: RISK_CONFIG.MAX_DAILY_TRADES,
    };
  }

  // ============================================================
  // 📊 الحصول على الصفقات المفتوحة
  // ============================================================

  getActiveTrades(): Trade[] {
    return Array.from(this.activeTrades.values());
  }

  // ============================================================
  // 📊 إغلاق صفقة يدوياً
  // ============================================================

  async closeTradeManually(
    tokenAddress: string,
    network: ChainId,
    password: string
  ): Promise<boolean> {
    const key = `${network}-${tokenAddress}`;
    const trade = this.activeTrades.get(key);

    if (!trade) {
      console.log(`❌ لا توجد صفقة مفتوحة لـ ${tokenAddress}`);
      await this.sendNotification('error', `❌ لا توجد صفقة مفتوحة لـ ${tokenAddress.slice(0, 8)}...`);
      return false;
    }

    // ✅ جلب السعر الحالي
    const response = await fetch(`${WORKER_URL}/dex-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenAddress,
        network,
      }),
    });

    if (!response.ok) {
      console.log(`❌ فشل جلب السعر الحالي`);
      await this.sendNotification('error', `❌ فشل جلب السعر الحالي لـ ${tokenAddress.slice(0, 8)}...`);
      return false;
    }

    const data = await response.json();
    if (!data.success || !data.data?.price) {
      console.log(`❌ لا توجد بيانات سعر`);
      await this.sendNotification('error', `❌ لا توجد بيانات سعر لـ ${tokenAddress.slice(0, 8)}...`);
      return false;
    }

    const currentPrice = data.data.price;
    const token: DiscoveredToken = {
      tokenAddress,
      chainId: network,
      symbol: trade.tokenSymbol,
      name: trade.tokenSymbol,
      priceUsd: currentPrice,
      liquidityUsd: 0,
      volume24h: 0,
      priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
      txns24h: { buys: 0, sells: 0 },
      score: 0,
      status: 'candidate',
      securityFlags: [],
      source: 'manual',
      strategy: 'established',
      allPairs: [],
      bestPair: null as any,
      marketCap: null,
      fdv: null,
      pairAge: 0,
      pairCreatedAt: 0,
      dexId: '',
      pairAddress: '',
      boosts: 0,
    };

    const decision: TradeDecision = {
      action: 'SELL',
      token,
      amount: currentPrice * trade.quantity,
      price: currentPrice,
      reason: 'إغلاق يدوي',
      confidence: 100,
      riskLevel: 'low',
      stopLoss: 0,
      takeProfit: 0,
    };

    await this.executeSell(token, network, decision, password);
    return true;
  }
}

// ============================================================
// 🚀 تصدير نسخة جاهزة للاستخدام
// ============================================================

export const botTrading = BotTradingSystem.getInstance();