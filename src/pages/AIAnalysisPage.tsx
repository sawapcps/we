// src/pages/AIAnalysisPage.tsx
// ============================================================
// صفحة تحليل الذكاء الاصطناعي - مع شراء/بيع فعلي
// ============================================================

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeToken } from '../lib/gemini';
import { getNetworkName, getNativeToken } from '../config/networks';
import { BotWalletManager } from '../lib/wallet';
import { AccountManager } from '../lib/accounts';
import type { DiscoveredToken, AIAnalysis } from '../types';
import { formatPrice, formatUsd, timeAgo } from '../lib/format';
import {
  BrainCircuit,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Globe,
  Wallet,
  Coins,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// ============================================================
// 🌐 دالة الترجمة
// ============================================================

type Language = 'ar' | 'en';

const translations = {
  ar: {
    title: 'تحليل الذكاء الاصطناعي',
    subtitle: 'تحليل متعمق بواسطة Gemini AI للمرشحين',
    hunterScore: 'نقاط Hunter',
    price: 'السعر',
    volume: 'الحجم 24 ساعة',
    liquidity: 'السيولة',
    marketCap: 'القيمة السوقية',
    fdv: 'القيمة المستقبلية',
    buys: 'مشتريات',
    sells: 'مبيعات',
    confidence: 'نسبة الثقة',
    tradingSignals: 'إشارات التداول',
    priceTarget: 'السعر المستهدف',
    riskLevel: 'مستوى المخاطرة',
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    buy: 'شراء',
    sell: 'بيع',
    hold: 'احتفاظ',
    strongBuy: 'شراء قوي',
    strongSell: 'بيع قوي',
    analysisHistory: 'سجل التحليلات',
    noAnalysis: 'لا توجد تحليلات سابقة',
    analyzeButton: 'تحليل',
    loading: 'جاري التحليل...',
    error: 'فشل التحليل',
    retry: 'إعادة المحاولة',
    amountToTrade: 'المبلغ المراد تداوله',
    balance: 'الرصيد',
    minAmount: 'الحد الأدنى',
    maxAmount: 'الحد الأقصى',
    close: 'إغلاق',
    executing: 'جاري التنفيذ...',
    success: 'تم التنفيذ بنجاح!',
    failed: 'فشل التنفيذ',
    nativeToken: 'العملة الأساسية',
    network: 'الشبكة',
    tradeExecuted: '✅ تم تنفيذ الصفقة',
    commissionApplied: 'تم تطبيق العمولة 15%',
    profit: 'الربح',
    loss: 'الخسارة',
    summary: 'الملخص',
    signals: 'الإشارات',
    priceTrend: 'اتجاه السعر',
    buySellRatio: 'نسبة الشراء/البيع',
    buyAction: 'شراء',
    sellAction: 'بيع',
    closeAction: 'إغلاق',
    insufficientBalance: '⚠️ الرصيد غير كافٍ',
    goToMarkets: '📊 اذهب إلى الأسواق للتحليل',
  },
  en: {
    title: 'AI Analysis',
    subtitle: 'Gemini-powered deep analysis of candidates',
    hunterScore: 'Hunter Score',
    price: 'Price',
    volume: '24h Volume',
    liquidity: 'Liquidity',
    marketCap: 'Market Cap',
    fdv: 'FDV',
    buys: 'Buys',
    sells: 'Sells',
    confidence: 'Confidence',
    tradingSignals: 'Trading Signals',
    priceTarget: 'Price Target',
    riskLevel: 'Risk Level',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    buy: 'Buy',
    sell: 'Sell',
    hold: 'Hold',
    strongBuy: 'Strong Buy',
    strongSell: 'Strong Sell',
    analysisHistory: 'Analysis History',
    noAnalysis: 'No previous analyses',
    analyzeButton: 'Analyze',
    loading: 'Analyzing...',
    error: 'Analysis failed',
    retry: 'Retry',
    amountToTrade: 'Amount to Trade',
    balance: 'Balance',
    minAmount: 'Minimum',
    maxAmount: 'Maximum',
    close: 'Close',
    executing: 'Executing...',
    success: 'Success!',
    failed: 'Failed',
    nativeToken: 'Native Token',
    network: 'Network',
    tradeExecuted: '✅ Trade executed',
    commissionApplied: '15% commission applied',
    profit: 'Profit',
    loss: 'Loss',
    summary: 'Summary',
    signals: 'Signals',
    priceTrend: 'Price Trend',
    buySellRatio: 'Buy/Sell Ratio',
    buyAction: 'Buy',
    sellAction: 'Sell',
    closeAction: 'Close',
    insufficientBalance: '⚠️ Insufficient balance',
    goToMarkets: '📊 Go to Markets for Analysis',
  },
};

// ============================================================
// 🎯 الصفحة الرئيسية
// ============================================================

interface AIAnalysisPageProps {
  pendingAnalysis: { token: DiscoveredToken } | null;
  onConsumePending: () => void;
}

export function AIAnalysisPage({ pendingAnalysis, onConsumePending }: AIAnalysisPageProps) {
  const { analyses, addAnalysis, addLog, user, addTrade, refreshUserBalance } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [currentToken, setCurrentToken] = useState<DiscoveredToken | null>(null);
  const [language, setLanguage] = useState<Language>('ar');
  const [amount, setAmount] = useState(50);
  const [executing, setExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);
  const [userBalance, setUserBalance] = useState(0);

  const t = (key: keyof typeof translations.ar) => translations[language][key] || key;

  // ============================================================
  // ✅ جلب رصيد المستخدم
  // ============================================================

  const fetchBalance = async () => {
    if (!user || !currentToken) return;
    try {
      const balance = await AccountManager.getUserWalletBalance(user.id, currentToken.chainId);
      setUserBalance(balance);
      if (balance === 0) {
        setAmount(0);
      }
    } catch (e) {
      console.error('❌ فشل جلب الرصيد:', e);
    }
  };

  useEffect(() => {
    if (user && currentToken) {
      fetchBalance();
    }
  }, [user, currentToken]);

  // ============================================================
  // ✅ تحليل العملة
  // ============================================================

  const runAnalysis = async (token: DiscoveredToken) => {
    console.log('🧠 بدء تحليل:', token.symbol);
    setLoading(true);
    setError(null);
    setCurrentToken(token);
    setTradeResult(null);
    
    try {
      const result = await analyzeToken(token);
      console.log('✅ اكتمل التحليل:', result);
      setCurrentAnalysis(result);
      await addAnalysis(result);
      await addLog('SUCCESS', `🧠 تم تحليل ${token.symbol} بواسطة Gemini AI`);
      await fetchBalance();
    } catch (e) {
      console.error('❌ فشل التحليل:', e);
      setError(e instanceof Error ? e.message : 'Analysis failed');
      await addLog('ERROR', `❌ فشل تحليل ${token.symbol}`);
    }
    setLoading(false);
  };

  // ============================================================
  // ✅ استهلاك التحليل المعلق
  // ============================================================

  useEffect(() => {
    console.log('🔍 AIAnalysisPage: pendingAnalysis =', pendingAnalysis);
    
    if (pendingAnalysis && !loading && !currentToken) {
      console.log('🚀 بدء التحليل من pendingAnalysis');
      localStorage.removeItem('pendingAnalysis');
      onConsumePending();
      runAnalysis(pendingAnalysis.token);
      return;
    }

    if (!pendingAnalysis) {
      const stored = localStorage.getItem('pendingAnalysis');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('📦 استعادة من localStorage:', parsed);
          if (parsed.token && !loading) {
            localStorage.removeItem('pendingAnalysis');
            onConsumePending();
            runAnalysis(parsed.token);
          }
        } catch (e) {
          console.error('❌ خطأ في قراءة localStorage:', e);
          localStorage.removeItem('pendingAnalysis');
        }
      }
    }
  }, [pendingAnalysis, loading, currentToken]);

  useEffect(() => {
    const stored = localStorage.getItem('pendingAnalysis');
    if (stored && !loading && !currentToken) {
      try {
        const parsed = JSON.parse(stored);
        console.log('📦 [mount] استعادة من localStorage:', parsed);
        if (parsed.token) {
          localStorage.removeItem('pendingAnalysis');
          onConsumePending();
          runAnalysis(parsed.token);
        }
      } catch (e) {
        console.error('❌ [mount] خطأ في قراءة localStorage:', e);
        localStorage.removeItem('pendingAnalysis');
      }
    }
  }, []);

  // ============================================================
  // ✅ دالة النسب المئوية
  // ============================================================

  const setPercentageAmount = (percentage: number) => {
    if (userBalance <= 0) {
      setTradeResult({
        success: false,
        message: `⚠️ ${t('insufficientBalance')} (الرصيد: $${userBalance.toFixed(2)})`,
      });
      setAmount(0);
      return;
    }
    const calculatedAmount = Math.round((userBalance * percentage / 100) * 100) / 100;
    setAmount(calculatedAmount);
    setTradeResult(null);
  };

  // ============================================================
  // ✅ تنفيذ الصفقة (شراء/بيع)
  // ============================================================

  const executeTrade = async (action: 'BUY' | 'SELL') => {
    console.log('🟢 زر الضغط:', action);
    console.log('📊 currentToken:', currentToken);
    console.log('👤 user:', user);
    console.log('💰 amount:', amount);
    
    const masterPassword = import.meta.env.VITE_MASTER_PASSWORD;
    console.log('🔑 VITE_MASTER_PASSWORD:', masterPassword ? '✅ موجود' : '❌ غير موجود');

    if (!currentToken) {
      console.log('❌ لا يوجد عملة حالية');
      setTradeResult({ success: false, message: '⚠️ لا توجد عملة للتحليل' });
      return;
    }
    
    if (!user) {
      console.log('❌ لا يوجد مستخدم');
      setTradeResult({ success: false, message: '⚠️ الرجاء تسجيل الدخول أولاً' });
      return;
    }

    if (amount <= 0) {
      console.log('❌ المبلغ غير صحيح');
      setTradeResult({ success: false, message: `⚠️ ${t('insufficientBalance')} (الرصيد: $${userBalance.toFixed(2)})` });
      return;
    }

    if (action === 'BUY' && amount > userBalance) {
      console.log(`❌ الرصيد غير كافٍ: $${userBalance} < $${amount}`);
      setTradeResult({ 
        success: false, 
        message: `⚠️ ${t('insufficientBalance')} (الرصيد: $${userBalance.toFixed(2)}، المطلوب: $${amount.toFixed(2)})` 
      });
      return;
    }

    setExecuting(true);
    setTradeResult(null);

    try {
      console.log('🔍 جلب محفظة المستخدم...');
      let wallet = await AccountManager.getUserWallet(user.id, currentToken.chainId);
      if (!wallet) {
        console.log(`🔄 لا توجد محفظة على ${currentToken.chainId}، جاري الإنشاء...`);
        wallet = await AccountManager.createUserWallet(user.id, currentToken.chainId);
        await addLog('SUCCESS', `✅ تم إنشاء محفظة على ${getNetworkName(currentToken.chainId)}`);
      }

      console.log('💰 جلب الرصيد...');
      const balance = await AccountManager.getUserWalletBalance(user.id, currentToken.chainId);
      setUserBalance(balance);
      console.log(`💰 الرصيد: $${balance}`);

      if (action === 'BUY' && balance < amount) {
        console.log(`❌ الرصيد غير كافٍ: $${balance} < $${amount}`);
        throw new Error(`الرصيد غير كافٍ: $${balance.toFixed(2)} / المطلوب $${amount.toFixed(2)}`);
      }

      console.log('📊 التحقق من الحد اليومي...');
      const canTrade = await AccountManager.canUserTrade(user.id);
      if (!canTrade) {
        const remaining = await AccountManager.getRemainingTrades(user.id);
        throw new Error(`تم تجاوز الحد اليومي. المتبقي: ${remaining} صفقة`);
      }

      console.log('🔑 التحقق من كلمة المرور...');
      if (!masterPassword) {
        console.error('❌ VITE_MASTER_PASSWORD غير مضبوط');
        throw new Error('VITE_MASTER_PASSWORD غير مضبوط في ملف .env');
      }

      console.log('🚀 تنفيذ الصفقة...');
      const manager = BotWalletManager.getInstance();

      const result = action === 'BUY'
        ? await manager.executeBuyForUser({
            userId: user.id,
            tokenAddress: currentToken.tokenAddress,
            amount,
            slippage: 0.5,
            password: masterPassword,
            network: currentToken.chainId,
          })
        : await manager.executeSellForUser({
            userId: user.id,
            tokenAddress: currentToken.tokenAddress,
            amount,
            slippage: 0.5,
            password: masterPassword,
            network: currentToken.chainId,
          });

      console.log('📊 نتيجة الصفقة:', result);

      if (!result.success) {
        throw new Error(result.error || 'فشل تنفيذ الصفقة');
      }

      let profitMessage = '';
      let pnl = 0;
      
      if (action === 'SELL' && result.price && currentToken.priceUsd) {
        pnl = (result.price - currentToken.priceUsd) * amount;
        if (pnl > 0) {
          const commission = pnl * 0.15;
          const netProfit = pnl - commission;
          profitMessage = `💰 الربح: $${pnl.toFixed(2)} | العمولة (15%): $${commission.toFixed(2)} | الصافي: $${netProfit.toFixed(2)}`;
          
          await AccountManager.addProfit(user.id, pnl, {
            token: currentToken.symbol,
            amount,
            price: result.price,
            txHash: result.txHash!,
            network: currentToken.chainId,
          });
        } else if (pnl < 0) {
          profitMessage = `📉 الخسارة: $${Math.abs(pnl).toFixed(2)}`;
        } else {
          profitMessage = `⚖️ لا ربح ولا خسارة`;
        }
      }

      console.log('💾 تسجيل الصفقة...');
      const tradeId = `ai-${Date.now()}`;
      await addTrade({
        id: tradeId,
        token: currentToken.symbol,
        tokenAddress: currentToken.tokenAddress,
        network: currentToken.chainId,
        amount: result.amount || amount,
        price: result.price || currentToken.priceUsd,
        type: action,
        status: 'EXECUTED',
        timestamp: new Date().toISOString(),
        txHash: result.txHash || `0x${Date.now()}`,
        userId: user.id,
        pnl: action === 'SELL' ? pnl : undefined,
        isOpen: action === 'BUY' ? true : false,
      });

      await AccountManager.incrementUserTrades(user.id);
      await refreshUserBalance(currentToken.chainId);
      await fetchBalance();

      const nativeToken = getNativeToken(currentToken.chainId);
      const actionText = action === 'BUY' ? t('buyAction') : t('sellAction');
      setTradeResult({
        success: true,
        message: `✅ تم ${actionText} ${currentToken.symbol} بـ ${amount} ${nativeToken.symbol} بنجاح!\n${profitMessage}`,
        txHash: result.txHash,
      });

      addLog('SUCCESS', `✅ تم ${actionText} ${currentToken.symbol} عبر AI Analysis${profitMessage ? ` | ${profitMessage}` : ''}`);

      setTimeout(() => {
        setTradeResult(null);
      }, 6000);

    } catch (error: any) {
      console.error('❌ فشل التنفيذ:', error);
      setTradeResult({
        success: false,
        message: `❌ فشل التنفيذ: ${error.message || 'خطأ غير معروف'}`,
      });
      addLog('ERROR', `❌ فشل تنفيذ الصفقة: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  // ============================================================
  // دوال مساعدة للعرض
  // ============================================================

  const getRecommendationColor = (rec: string) => {
    const colors: Record<string, string> = {
      strong_buy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      buy: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      hold: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      sell: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      strong_sell: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[rec] || 'bg-slate-500/20 text-slate-400';
  };

  const getRecommendationLabel = (rec: string) => {
    const labels: Record<string, string> = {
      strong_buy: t('strongBuy'),
      buy: t('buy'),
      hold: t('hold'),
      sell: t('sell'),
      strong_sell: t('strongSell'),
    };
    return labels[rec] || rec;
  };

  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      low: 'text-emerald-400',
      medium: 'text-amber-400',
      high: 'text-red-400',
    };
    return colors[level] || 'text-slate-400';
  };

  const getRiskLabel = (level: string) => {
    const labels: Record<string, string> = {
      low: t('low'),
      medium: t('medium'),
      high: t('high'),
    };
    return labels[level] || level;
  };

  // ============================================================
  // العرض
  // ============================================================

  const nativeToken = currentToken ? getNativeToken(currentToken.chainId) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-[#8b5cf6]" />
            {t('title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span className="text-xs font-medium">{language === 'ar' ? '🇸🇦 عربي' : '🇬🇧 English'}</span>
        </button>
      </div>

      {/* ✅ زر "اذهب إلى الأسواق" - يظهر دائماً */}
      <div className="mb-2">
        <button
          onClick={() => {
            window.location.href = '/markets';
          }}
          className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 flex items-center gap-2"
        >
          📊 {t('goToMarkets')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => currentToken && runAnalysis(currentToken)} className="ml-auto text-xs text-red-300 hover:text-red-200 underline">
            {t('retry')}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <BrainCircuit className="w-12 h-12 text-[#8b5cf6]" />
            <Loader2 className="w-12 h-12 text-[#8b5cf6] animate-spin absolute inset-0" />
          </div>
          <p className="text-sm text-slate-400">{t('loading')}</p>
        </div>
      )}

      {/* Current Analysis */}
      {currentToken && !loading && currentAnalysis && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {/* Token Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{currentToken.symbol}</h2>
                <p className="text-sm text-slate-500">
                  {currentToken.name} · {getNetworkName(currentToken.chainId)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getRecommendationColor(currentAnalysis.recommendation)}`}>
                {getRecommendationLabel(currentAnalysis.recommendation)}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                {t('hunterScore')} {currentToken.score}/100
              </span>
            </div>
          </div>

          {/* عرض العملة الأساسية والشبكة */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">{t('nativeToken')}:</span>
              <span className="text-sm font-bold text-cyan-400">{nativeToken?.symbol}</span>
              <span className="text-xs text-slate-500">({nativeToken?.name})</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">{t('balance')}:</span>
              <span className="text-sm font-bold text-emerald-400">${userBalance.toFixed(2)}</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DataMetric label={t('price')} value={formatPrice(currentToken.priceUsd)} />
            <DataMetric label={t('volume')} value={formatUsd(currentToken.volume24h)} />
            <DataMetric label={t('liquidity')} value={formatUsd(currentToken.liquidityUsd)} />
            <DataMetric label={t('marketCap')} value={currentToken.marketCap ? formatUsd(currentToken.marketCap) : '—'} />
          </div>

          {/* Price Changes */}
          <div className="grid grid-cols-4 gap-3">
            <PriceChangeMetric label="5m" value={currentToken.priceChange.m5} />
            <PriceChangeMetric label="1h" value={currentToken.priceChange.h1} />
            <PriceChangeMetric label="6h" value={currentToken.priceChange.h6} />
            <PriceChangeMetric label="24h" value={currentToken.priceChange.h24} />
          </div>

          {/* Confidence Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">{t('confidence')}</span>
              <span className="text-sm font-medium text-white">{currentAnalysis.confidence}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] rounded-full transition-all"
                style={{ width: `${currentAnalysis.confidence}%` }}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-800/30 rounded-xl p-4">
            <h4 className="text-xs text-slate-500 mb-1">{t('summary')}</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              {language === 'ar' ? currentAnalysis.summary_ar || currentAnalysis.summary : currentAnalysis.summary}
            </p>
          </div>

          {/* Trading Signals */}
          {currentAnalysis.signals && currentAnalysis.signals.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t('tradingSignals')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {currentAnalysis.signals.map((sig, i) => {
                  let labelKey = sig.label;
                  if (language === 'ar') {
                    if (sig.label === 'Liquidity') labelKey = t('liquidity');
                    else if (sig.label === 'Volume') labelKey = t('volume');
                    else if (sig.label === 'Price Trend') labelKey = t('priceTrend');
                    else if (sig.label === 'Buy/Sell Ratio') labelKey = t('buySellRatio');
                    else labelKey = sig.label;
                  }
                  
                  return (
                    <div key={i} className="bg-slate-800/30 rounded-xl p-3 border border-slate-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        {sig.bullish ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="text-xs text-slate-500">{labelKey}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{sig.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Target + Risk */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('priceTarget')}</p>
              <p className="text-lg font-bold text-white">{formatPrice(currentAnalysis.priceTarget)}</p>
            </div>
            <div className="flex-1 bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('riskLevel')}</p>
              <p className={`text-lg font-bold capitalize ${getRiskColor(currentAnalysis.riskLevel)}`}>
                {getRiskLabel(currentAnalysis.riskLevel)}
              </p>
            </div>
          </div>

          {/* Trade Amount */}
          <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">{t('amountToTrade')}</p>
              <p className="text-xs text-slate-500">
                {t('balance')}: <span className={userBalance > 0 ? 'text-emerald-400' : 'text-red-400'}>${userBalance.toFixed(2)}</span>
              </p>
            </div>
            <div className="flex gap-2 mb-3">
              {['25%', '50%', '75%', '100%'].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setPercentageAmount(parseFloat(pct))}
                  className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {pct}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={userBalance}
                value={amount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (val <= userBalance || userBalance === 0) {
                    setAmount(val);
                  } else {
                    setTradeResult({
                      success: false,
                      message: `⚠️ ${t('insufficientBalance')} (الرصيد: $${userBalance.toFixed(2)})`,
                    });
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8b5cf6]"
              />
              <span className="text-sm text-slate-400">{nativeToken?.symbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              💰 {t('minAmount')}: $1 | {t('maxAmount')}: ${userBalance.toFixed(2)}
            </p>
          </div>

          {/* Trade Result */}
          {tradeResult && (
            <div className={`rounded-lg p-3 ${tradeResult.success ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <div className="flex items-start gap-2">
                {tradeResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-xs ${tradeResult.success ? 'text-emerald-400' : 'text-red-400'} whitespace-pre-line`}>
                  {tradeResult.message}
                </p>
              </div>
              {tradeResult.txHash && (
                <p className="text-[8px] text-slate-500 mt-1 font-mono truncate">
                  TX: {tradeResult.txHash}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                console.log('🟢 زر شراء - تم الضغط');
                executeTrade('BUY');
              }}
              disabled={executing || !user}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                executing ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🟢'}
              {t('buyAction')} {nativeToken?.symbol}
            </button>
            <button
              onClick={() => {
                console.log('🔴 زر بيع - تم الضغط');
                executeTrade('SELL');
              }}
              disabled={executing || !user}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                executing ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔴'}
              {t('sellAction')} {nativeToken?.symbol}
            </button>
            <button
              onClick={() => {
                setCurrentToken(null);
                setCurrentAnalysis(null);
                setTradeResult(null);
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
            >
              ✕ {t('closeAction')}
            </button>
          </div>

          {!user && (
            <p className="text-center text-xs text-amber-400">⚠️ الرجاء تسجيل الدخول لتنفيذ الصفقات</p>
          )}
        </div>
      )}

      {/* Analysis History */}
      {analyses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">{t('analysisHistory')}</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {analyses.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/50 rounded-lg px-4 py-3 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRecommendationColor(a.recommendation)}`}>
                    {getRecommendationLabel(a.recommendation)}
                  </span>
                  <span className="text-sm font-medium text-white">{a.tokenSymbol}</span>
                  <span className="text-xs text-slate-500">{getNetworkName(a.network)}</span>
                </div>
                <span className="text-xs text-slate-500">{timeAgo(a.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !currentToken && analyses.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">{t('noAnalysis')}</p>
          <p className="text-xs text-slate-500 mt-2">{t('goToMarkets')}</p>
          
          <button
            onClick={() => {
              window.location.href = '/markets';
            }}
            className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            📊 {t('goToMarkets')}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 🧩 مكونات مساعدة
// ============================================================

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/30 rounded-xl p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function PriceChangeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800/30 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-mono font-medium ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </p>
    </div>
  );
}