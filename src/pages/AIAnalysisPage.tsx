// src/pages/AIAnalysisPage.tsx
// ============================================================
// 🤖 صفحة تحليل الذكاء الاصطناعي - مستقلة تماماً عن البوت
// ✅ تعمل بدون تشغيل البوت
// ✅ التداول اليدوي متاح دائماً
// ✅ تعرض الكمية المتوقعة مع حساب صحيح
// ✅ تعرض صورة العملة ورمزها
// ✅ تجلب سعر العملة الأساسية من DexScreener (مع تصفية الشبكة)
// ✅ حقل المبلغ يدعم الأصفار والأرقام العشرية
// ✅ إمكانية اختيار المحفظة (عند وجود عدة محافظ على نفس الشبكة)
// ============================================================
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { analyzeToken, quickAnalysis } from '../lib/gemini';
import { getNetworkName, getNativeToken, NETWORKS } from '../config/networks';
import { BotWalletManager } from '../lib/wallet';
import { AccountManager } from '../lib/accounts';
import { detectSmartWalletHovering } from '../lib/hunterEngine';
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
  RefreshCw,
  BarChart3,
  Shield,
  Users,
  Target,
  Clock,
  Zap,
  AlertCircle,
  Play,
  Pause,
  Copy,
  ChevronDown,
} from 'lucide-react';

// ============================================================
// 🏷️ الترجمات
// ============================================================

type Language = 'ar' | 'en';

const translations = {
  ar: {
    title: 'تحليل الذكاء الاصطناعي',
    subtitle: 'تحليل متقدم باستخدام Gemini AI مع بيانات حقيقية',
    hunterScore: 'نقاط Hunter',
    price: 'السعر',
    volume: 'حجم التداول 24 ساعة',
    liquidity: 'السيولة',
    marketCap: 'القيمة السوقية',
    fdv: 'القيمة المخففة',
    buys: 'مشتريات',
    sells: 'مبيعات',
    confidence: 'الثقة',
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
    amountToTrade: 'المبلغ للتداول',
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
    goToMarkets: '➡️ اذهب إلى الأسواق للتحليل',
    hovering: 'المحافظ الذكية',
    whaleActivity: 'نشاط الحيتان',
    smartWallets: 'المحافظ الذكية',
    winRate: 'نسبة الربح',
    totalProfit: 'إجمالي الربح',
    activeWallets: 'محافظ نشطة',
    lastUpdate: 'آخر تحديث',
    refresh: 'تحديث',
    analyzing: 'جاري التحليل...',
    tradeAmount: 'مبلغ التداول',
    estimatedReturn: 'العائد المتوقع',
    stopLoss: 'وقف الخسارة',
    takeProfit: 'جني الربح',
    riskRewardRatio: 'نسبة المخاطرة/المكافأة',
    quickAnalysis: 'تحليل سريع',
    aiAnalysis: 'تحليل الذكاء الاصطناعي',
    noData: 'لا توجد بيانات',
    loadingData: 'جاري تحميل البيانات...',
    buySignal: 'إشارة شراء',
    sellSignal: 'إشارة بيع',
    neutralSignal: 'إشارة محايدة',
    tradingMode: 'وضع التداول',
    tradingEnabled: '✅ التداول مفعل',
    tradingDisabled: '❌ التداول معطل',
    enableTrading: 'تفعيل التداول',
    disableTrading: 'تعطيل التداول',
    tradeManually: 'تداول يدوي (مستقل عن البوت)',
    botStatus: 'حالة البوت',
    botRunning: '🟢 البوت يعمل',
    botStopped: '🔴 البوت متوقف',
    independentMode: 'وضع مستقل - لا يعتمد على البوت',
    selectWallet: 'اختر المحفظة',
  },
  en: {
    title: 'AI Analysis',
    subtitle: 'Gemini-powered deep analysis with real data',
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
    goToMarkets: '➡️ Go to Markets for Analysis',
    hovering: 'Smart Wallet Hovering',
    whaleActivity: 'Whale Activity',
    smartWallets: 'Smart Wallets',
    winRate: 'Win Rate',
    totalProfit: 'Total Profit',
    activeWallets: 'Active Wallets',
    lastUpdate: 'Last Update',
    refresh: 'Refresh',
    analyzing: 'Analyzing...',
    tradeAmount: 'Trade Amount',
    estimatedReturn: 'Estimated Return',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    riskRewardRatio: 'Risk/Reward Ratio',
    quickAnalysis: 'Quick Analysis',
    aiAnalysis: 'AI Analysis',
    noData: 'No Data',
    loadingData: 'Loading data...',
    buySignal: 'Buy Signal',
    sellSignal: 'Sell Signal',
    neutralSignal: 'Neutral Signal',
    tradingMode: 'Trading Mode',
    tradingEnabled: '✅ Trading Enabled',
    tradingDisabled: '❌ Trading Disabled',
    enableTrading: 'Enable Trading',
    disableTrading: 'Disable Trading',
    tradeManually: 'Manual Trading (Independent from Bot)',
    botStatus: 'Bot Status',
    botRunning: '🟢 Bot Running',
    botStopped: '🔴 Bot Stopped',
    independentMode: 'Independent Mode - Does not depend on Bot',
    selectWallet: 'Select Wallet',
  },
};

// ============================================================
// 🧩 المكونات المساعدة
// ============================================================

interface AIAnalysisPageProps {
  pendingAnalysis: { token: DiscoveredToken } | null;
  onConsumePending: () => void;
}

// ============================================================
// 📄 الصفحة الرئيسية
// ============================================================

export function AIAnalysisPage({ pendingAnalysis, onConsumePending }: AIAnalysisPageProps) {
  const { 
    analyses, 
    addAnalysis, 
    addLog, 
    user, 
    addTrade, 
    refreshUserBalance,
    discoveredTokens,
    loadDiscoveredTokens,
    isRunning,
  } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [currentToken, setCurrentToken] = useState<DiscoveredToken | null>(null);
  const [language, setLanguage] = useState<Language>('ar');
  const [amount, setAmount] = useState(50);
  const [executing, setExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [hoveringData, setHoveringData] = useState<any>(null);
  const [loadingHovering, setLoadingHovering] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'ai' | 'quick'>('ai');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tradingEnabled, setTradingEnabled] = useState(true);
  const [nativePrice, setNativePrice] = useState(0);
  const [copied, setCopied] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  // ✅ حالات جديدة لاختيار المحفظة
  const [userWalletsList, setUserWalletsList] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const t = (key: keyof typeof translations.ar) => translations[language][key] || key;

  // ============================================================
  // ✅ جلب سعر العملة الأساسية (محسّن مع تصفية الشبكة)
  // ============================================================
  
const fetchNativePrice = useCallback(async (network: string) => {
  try {
    const WORKER_URL = import.meta.env.VITE_WORKER_URL;
    // 1️⃣ حاول عبر Worker
    if (WORKER_URL) {
      const nativeToken = getNativeToken(network);
      const response = await fetch(`${WORKER_URL}/dex-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: nativeToken.address,
          network,
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.price) {
        console.log(`💱 سعر ${nativeToken.symbol} من Worker: $${data.data.price}`);
        return data.data.price;
      }
    }

    // 2️⃣ إذا فشل Worker، استخدم DexScreener مع تصفية دقيقة
    const nativeSymbol = getNativeToken(network).symbol;
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${nativeSymbol}`);
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      // ✅ البحث عن زوج على نفس الشبكة مع USDC أو USDT
      const pair = data.pairs.find((p: any) =>
        p.chainId === network &&
        (p.quoteToken?.symbol === 'USDC' || p.quoteToken?.symbol === 'USDT')
      );
      if (pair) {
        const price = parseFloat(pair.priceUsd || 0);
        console.log(`💱 سعر ${nativeSymbol} من DexScreener (${network}): $${price}`);
        return price;
      }
      
      // ❌ إذا لم نجد الزوج المطلوب، لا ترجع أي سعر (تجنب السعر الخاطئ)
      console.warn(`⚠️ لم يتم العثور على سعر لـ ${nativeSymbol} على شبكة ${network}`);
      return 0; // بدلاً من return data.pairs[0].priceUsd
    }
    return 0;
  } catch (error) {
    console.error('❌ فشل جلب السعر:', error);
    return 0;
  }
}, []);
  // ============================================================
  // 📊 جلب الرصيد وقائمة المحافظ
  // ============================================================

  const fetchBalanceAndWallets = async () => {
    if (!user || !currentToken) return;
    try {
      // ✅ جلب جميع محافظ المستخدم على هذه الشبكة
      const allWallets = await AccountManager.getAllUserWallets(user.id);
      const filtered = allWallets.filter(w => w.network === currentToken.chainId);
      setUserWalletsList(filtered);
      
      // ✅ اختيار المحفظة الأولى افتراضياً (أو المحفظة المخزنة سابقاً)
      if (filtered.length > 0) {
        // إذا كان هناك محفظة محددة مسبقاً ولا تزال موجودة، استخدمها
        if (selectedWalletId && filtered.some(w => w.id === selectedWalletId)) {
          const wallet = filtered.find(w => w.id === selectedWalletId);
          setUserBalance(wallet ? wallet.balance : 0);
        } else {
          // وإلا استخدم الأولى
          setSelectedWalletId(filtered[0].id);
          setUserBalance(filtered[0].balance);
        }
      } else {
        // لا توجد محافظ، أنشئ واحدة
        const newWallet = await AccountManager.createUserWallet(user.id, currentToken.chainId);
        setUserWalletsList([newWallet]);
        setSelectedWalletId(newWallet.id);
        setUserBalance(newWallet.balance);
      }
      
      // ✅ جلب سعر العملة الأساسية
      const price = await fetchNativePrice(currentToken.chainId);
      setNativePrice(price);
      console.log(`💱 سعر ${getNativeToken(currentToken.chainId).symbol}: $${price}`);
      
    } catch (e) {
      console.error('❌ فشل جلب الرصيد والمحافظ:', e);
    }
  };

  const fetchHoveringData = async () => {
    if (!currentToken) return;
    setLoadingHovering(true);
    try {
      const data = await detectSmartWalletHovering(currentToken.tokenAddress, currentToken.chainId);
      setHoveringData(data);
    } catch (e) {
      console.warn('⚠️ فشل جلب بيانات المحافظ الذكية:', e);
    } finally {
      setLoadingHovering(false);
    }
  };

  useEffect(() => {
    if (user && currentToken) {
      fetchBalanceAndWallets();
      fetchHoveringData();
    }
  }, [user, currentToken, selectedWalletId]); // إعادة التحميل عند تغيير المحفظة المختارة

  // ============================================================
  // 🔍 تشغيل التحليل
  // ============================================================

  const runAnalysis = async (token: DiscoveredToken, useQuick: boolean = false) => {
    console.log('🤖 بدء التحليل:', token.symbol);
    console.log('🖼️ صورة العملة:', token.imageUrl);
    
    setLoading(true);
    setError(null);
    setCurrentToken(token);
    setTradeResult(null);
    setSelectedTab(useQuick ? 'quick' : 'ai');
    
    try {
      let result: AIAnalysis;
      
      if (useQuick) {
        result = quickAnalysis(token);
        await addLog('INFO', `⚡ تحليل سريع لـ ${token.symbol}`);
      } else {
        result = await analyzeToken(token);
        await addLog('SUCCESS', `🤖 تم التحليل ${token.symbol} باستخدام Gemini AI`);
      }
      
      setCurrentAnalysis(result);
      await addAnalysis(result);
      await fetchBalanceAndWallets(); // تحديث الرصيد والمحافظ
      await fetchHoveringData();
      
    } catch (e) {
      console.error('❌ فشل التحليل:', e);
      setError(e instanceof Error ? e.message : 'فشل التحليل');
      await addLog('ERROR', `❌ فشل تحليل ${token.symbol}`);
    }
    setLoading(false);
  };

  // ============================================================
  // 📥 معالجة التحليل المعلق
  // ============================================================

  useEffect(() => {
    if (pendingAnalysis && !loading && !currentToken) {
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
  // 📊 حساب النسب المئوية للمبلغ
  // ============================================================

  const setPercentageAmount = (percentage: number) => {
    if (userBalance <= 0) {
      setTradeResult({
        success: false,
        message: `⚠️ ${t('insufficientBalance')} (الرصيد: ${userBalance.toFixed(4)} ${nativeToken?.symbol})`,
      });
      setAmount(0);
      setAmountInput('');
      return;
    }
    const calculatedAmount = (userBalance * percentage) / 100;
    setAmount(calculatedAmount);
    setAmountInput(String(calculatedAmount));
    setTradeResult(null);
  };

  // ============================================================
  // 💰 تنفيذ الصفقة (باستخدام المحفظة المختارة)
  // ============================================================

  const executeTrade = async (action: 'BUY' | 'SELL') => {
    console.log('🔄 تنفيذ الصفقة:', action);
    
    if (!tradingEnabled) {
      setTradeResult({ 
        success: false, 
        message: '⚠️ التداول معطل حالياً. فعّل التداول أولاً.' 
      });
      return;
    }
    
    if (!currentToken) {
      setTradeResult({ success: false, message: '⚠️ لا توجد عملة للتحليل' });
      return;
    }
    
    if (!user) {
      setTradeResult({ success: false, message: '⚠️ الرجاء تسجيل الدخول أولاً' });
      return;
    }

    if (amount <= 0) {
      setTradeResult({ success: false, message: `⚠️ ${t('insufficientBalance')} (الرصيد: ${userBalance.toFixed(4)} ${nativeToken?.symbol})` });
      return;
    }

    // ✅ التحقق من اختيار المحفظة
    if (!selectedWalletId) {
      setTradeResult({ success: false, message: '⚠️ الرجاء اختيار محفظة' });
      return;
    }

    // ✅ جلب المحفظة المختارة
    const selectedWallet = userWalletsList.find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      setTradeResult({ success: false, message: '⚠️ المحفظة المختارة غير موجودة' });
      return;
    }

    const balance = selectedWallet.balance;

    if (action === 'BUY' && amount > balance) {
      setTradeResult({ 
        success: false, 
        message: `⚠️ ${t('insufficientBalance')} (الرصيد: ${balance.toFixed(4)} ${nativeToken?.symbol}، المطلوب: ${amount.toFixed(4)} ${nativeToken?.symbol})` 
      });
      return;
    }

    setExecuting(true);
    setTradeResult(null);

    try {
      // ✅ تحديث الرصيد قبل التنفيذ للتأكد
      const freshBalance = await AccountManager.getUserWalletBalance(user.id, currentToken.chainId, selectedWallet.address);
      if (action === 'BUY' && freshBalance < amount) {
        throw new Error(`الرصيد غير كافٍ: ${freshBalance.toFixed(4)} ${nativeToken?.symbol} / المطلوب ${amount.toFixed(4)} ${nativeToken?.symbol}`);
      }

      const canTrade = await AccountManager.canUserTrade(user.id);
      if (!canTrade) {
        const remaining = await AccountManager.getRemainingTrades(user.id);
        throw new Error(`تم الوصول للحد اليومي. المتبقي: ${remaining} صفقة`);
      }
// ✅ استخدام كلمة مرور ثابتة (تجاوز مشكلة المتغير)
const masterPassword = "SecureMasterPassword123!@#";
console.log('🔑 [AIAnalysisPage] باستخدام كلمة مرور ثابتة للتنفيذ');

      const manager = BotWalletManager.getInstance();
      // ✅ استخدام المحفظة المختارة
      const result = action === 'BUY'
        ? await manager.executeBuyForUser({
            userId: user.id,
            tokenAddress: currentToken.tokenAddress,
            amount,
            slippage: 0.5,
            password: masterPassword,
            network: currentToken.chainId,
            walletAddress: selectedWallet.address, // تمرير العنوان المختار
          })
        : await manager.executeSellForUser({
            userId: user.id,
            tokenAddress: currentToken.tokenAddress,
            amount,
            slippage: 0.5,
            password: masterPassword,
            network: currentToken.chainId,
            walletAddress: selectedWallet.address,
          });

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

      await addTrade({
        id: `ai-${Date.now()}`,
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
      await fetchBalanceAndWallets(); // تحديث البيانات

      const nativeToken = getNativeToken(currentToken.chainId);
      const actionText = action === 'BUY' ? t('buyAction') : t('sellAction');
      setTradeResult({
        success: true,
        message: `✅ تم ${actionText} ${currentToken.symbol} بمبلغ ${amount.toFixed(4)} ${nativeToken.symbol} من المحفظة ${selectedWallet.address.slice(0, 8)}...${selectedWallet.address.slice(-6)} بنجاح!\n${profitMessage}`,
        txHash: result.txHash,
      });

      addLog('SUCCESS', `✅ تم ${actionText} ${currentToken.symbol} (تحليل مستقل)${profitMessage ? ` | ${profitMessage}` : ''}`);

      setTimeout(() => setTradeResult(null), 8000);

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
  // 🎨 دوال مساعدة للعرض
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

  const handleReanalyze = async () => {
    if (currentToken) {
      await runAnalysis(currentToken, selectedTab === 'quick');
    }
  };

  // ============================================================
  // 📄 العرض الرئيسي
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
          <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('independentMode')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span className="text-xs font-medium">{language === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}</span>
          </button>
          <button
            onClick={() => window.location.href = '/markets'}
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 flex items-center gap-2"
          >
            ➡️ {t('goToMarkets')}
          </button>
        </div>
      </div>

      {/* ✅ وضع التداول المستقل */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${tradingEnabled ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {tradingEnabled ? (
                <Play className="w-5 h-5 text-emerald-400" />
              ) : (
                <Pause className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{t('tradingMode')}</p>
              <p className="text-xs text-slate-400">
                {tradingEnabled ? t('tradingEnabled') : t('tradingDisabled')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-slate-400">
                {isRunning ? t('botRunning') : t('botStopped')}
              </span>
            </div>
            
            <button
              onClick={() => setTradingEnabled(!tradingEnabled)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tradingEnabled 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {tradingEnabled ? t('disableTrading') : t('enableTrading')}
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
          <Zap className="w-3 h-3 text-emerald-400" />
          {t('tradeManually')}
        </div>
      </div>

      {/* Status Bar */}
      {isRunning && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
          <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm text-emerald-400">🟢 البوت يعمل - التحليل والتداول اليدوي مستقلان</span>
        </div>
      )}

      {!isRunning && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-400">🔴 البوت متوقف - التحليل والتداول اليدوي لا يزالان يعملان</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={handleReanalyze} className="ml-auto text-xs text-red-300 hover:text-red-200 underline">
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
          <p className="text-sm text-slate-400">{t('analyzing')}</p>
        </div>
      )}

      {/* Current Analysis */}
      {currentToken && !loading && currentAnalysis && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          
          {/* ============================================================
              ✅ Token Header - مع صورة العملة ورمزها
              ============================================================ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              
              {/* ✅ صورة العملة */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0 border border-[#1e1e2f]">
                {currentToken?.imageUrl ? (
                  <img 
                    src={currentToken.imageUrl} 
                    alt={currentToken.symbol}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.className = 'w-14 h-14 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center flex-shrink-0';
                        parent.innerHTML = `<span class="text-lg font-bold text-white">${currentToken.symbol.slice(0, 2)}</span>`;
                      }
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-white">
                      {currentToken.symbol.slice(0, 2)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* ✅ اسم العملة ورمزها */}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{currentToken.symbol}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {currentToken.chainId}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {currentToken.name}
                </p>
                
                {/* ✅ عرض رمز العملة (العنوان) مع زر نسخ */}
                {currentToken?.tokenAddress && (
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                      {currentToken.tokenAddress.slice(0, 8)}...{currentToken.tokenAddress.slice(-6)}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentToken.tokenAddress);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                        addLog('SUCCESS', `✅ تم نسخ عنوان ${currentToken.symbol}`);
                      }}
                      className="p-0.5 hover:bg-slate-700 rounded transition-colors"
                      title="نسخ العنوان"
                    >
                      {copied ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getRecommendationColor(currentAnalysis.recommendation)}`}>
                {getRecommendationLabel(currentAnalysis.recommendation)}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                {t('hunterScore')} {currentToken.score}/100
              </span>
              <button
                onClick={handleReanalyze}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hovering Data */}
          {hoveringData && (
            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">{t('hovering')}</span>
                <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                  hoveringData.isHovering ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                }`}>
                  {hoveringData.isHovering ? `✅ ${hoveringData.level}` : '❌ لا يوجد تداخل'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{hoveringData.details.smartWalletsCount}</div>
                  <div className="text-xs text-slate-500">{t('smartWallets')}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{hoveringData.details.avgWinRate.toFixed(1)}%</div>
                  <div className="text-xs text-slate-500">{t('winRate')}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">${hoveringData.details.totalProfit.toFixed(0)}</div>
                  <div className="text-xs text-slate-500">{t('totalProfit')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Network & Balance Info */}
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
              <span className="text-sm font-bold text-emerald-400">{userBalance.toFixed(4)} {nativeToken?.symbol}</span>
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">{t('lastUpdate')}:</span>
              <span className="text-xs text-slate-500">{new Date().toLocaleTimeString()}</span>
            </div>
            {nativePrice > 0 && (
              <>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">💱 سعر {nativeToken?.symbol}:</span>
                  <span className="text-sm font-bold text-yellow-400">${nativePrice.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DataMetric label={t('price')} value={`$${currentToken.priceUsd.toFixed(8)}`} />
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

          {/* Price Target + Risk + Stop Loss */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('priceTarget')}</p>
              <p className="text-lg font-bold text-white">{formatPrice(currentAnalysis.priceTarget)}</p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('riskLevel')}</p>
              <p className={`text-lg font-bold capitalize ${getRiskColor(currentAnalysis.riskLevel)}`}>
                {getRiskLabel(currentAnalysis.riskLevel)}
              </p>
            </div>
            <div className="bg-slate-800/30 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('stopLoss')}</p>
              <p className="text-lg font-bold text-red-400">{formatPrice(currentToken.priceUsd * 0.9)}</p>
            </div>
          </div>

          {/* ============================================================
              ✅ Trade Amount - مع حساب الكمية الصحيح + دعم الأصفار
              ============================================================ */}
          <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">{t('amountToTrade')}</p>
              <p className="text-xs text-slate-500">
                {t('balance')}: <span className={userBalance > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {userBalance.toFixed(4)} {nativeToken?.symbol}
                </span>
              </p>
            </div>

           {/* ✅ اختيار المحفظة (يظهر دائماً عند وجود محفظة واحدة على الأقل) */}
{userWalletsList.length > 0 && (
  <div className="flex items-center gap-2 mb-3">
    <Wallet className="w-4 h-4 text-slate-400" />
    <span className="text-xs text-slate-400">{t('selectWallet')}:</span>
    <div className="relative flex-1">
      <select
        value={selectedWalletId || ''}
        onChange={(e) => {
          const walletId = e.target.value;
          setSelectedWalletId(walletId);
          const wallet = userWalletsList.find(w => w.id === walletId);
          if (wallet) {
            setUserBalance(wallet.balance);
            // إعادة تعيين المبلغ إذا كان أكبر من الرصيد الجديد
            if (amount > wallet.balance) {
              setAmount(0);
              setAmountInput('');
            }
          }
        }}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6] appearance-none"
      >
        {userWalletsList.map(w => (
          <option key={w.id} value={w.id}>
            {w.address.slice(0, 8)}...{w.address.slice(-6)} (رصيد: {w.balance.toFixed(4)} {nativeToken?.symbol})
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  </div>
)}
            {/* ✅ أزرار النسب المئوية */}
            <div className="flex gap-2 mb-3">
              {['25%', '50%', '75%', '100%'].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const percentage = parseInt(pct, 10);
                    const calculatedAmount = (userBalance * percentage) / 100;
                    setAmount(calculatedAmount);
                    setAmountInput(String(calculatedAmount));
                    setTradeResult(null);
                  }}
                  className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  {pct}
                </button>
              ))}
            </div>
            
            {/* ✅ حقل الإدخال المعدل - يدعم الأصفار والأرقام العشرية */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  let rawValue = e.target.value;

                  // السماح بالحقل الفارغ
                  if (rawValue === '') {
                    setAmountInput('');
                    setAmount(0);
                    setTradeResult(null);
                    return;
                  }

                  // تحويل الفاصلة إلى نقطة
                  rawValue = rawValue.replace(/,/g, '.');

                  // السماح فقط بالأرقام والنقطة
                  if (!/^\d*\.?\d*$/.test(rawValue)) {
                    return;
                  }

                  // حفظ النص كما كتبه المستخدم
                  setAmountInput(rawValue);

                  // السماح بكتابة: . أو 0.
                  if (rawValue === '.' || rawValue === '0.') {
                    setAmount(0);
                    setTradeResult(null);
                    return;
                  }

                  const val = Number(rawValue);

                  if (Number.isNaN(val) || val < 0) {
                    return;
                  }

                  // منع تجاوز الرصيد
                  if (userBalance === 0 || val <= userBalance) {
                    setAmount(val);
                    setTradeResult(null);
                  } else {
                    setTradeResult({
                      success: false,
                      message: `⚠️ ${t('insufficientBalance')} (الرصيد: ${userBalance.toFixed(4)} ${nativeToken?.symbol})`,
                    });
                  }
                }}
                onBlur={() => {
                  if (amountInput === '' || amountInput === '.') {
                    setAmountInput('');
                    setAmount(0);
                  }
                }}
                placeholder="0.001"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8b5cf6]"
              />
              <span className="text-sm font-bold text-cyan-400 min-w-[50px]">{nativeToken?.symbol}</span>
            </div>

            {/* ✅ عرض الكمية المتوقعة مع حساب صحيح */}
            {amount > 0 && currentToken && nativeToken && nativePrice > 0 && (
              <div className="mt-3 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2f]">
                {(() => {
                  const usdValue = amount * nativePrice;
                  const quantity = usdValue / currentToken.priceUsd;
                  return (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#64748b]">📈 الكمية المتوقعة:</span>
                        <span className="text-emerald-400 font-bold text-sm">
                          {quantity.toFixed(6)} {currentToken.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-[#64748b] mt-0.5">
                        <span>💰 سعر {currentToken.symbol}: ${currentToken.priceUsd.toFixed(8)}</span>
                        <span>💵 القيمة: ${usdValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-[#64748b] mt-0.5 pt-0.5 border-t border-[#1e1e2f]">
                        <span>📊 المبلغ المستخدم:</span>
                        <span className="text-white">{amount.toFixed(4)} {nativeToken.symbol} (≈ ${usdValue.toFixed(2)})</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-[#64748b] mt-0.5">
                        <span>💱 سعر {nativeToken.symbol}:</span>
                        <span className="text-yellow-400">${nativePrice.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ✅ إذا لم يتمكن من جلب السعر */}
            {amount > 0 && currentToken && nativeToken && nativePrice === 0 && (
              <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  ⏳ جاري جلب سعر {nativeToken.symbol}...
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate-500">
                💰 الحد الأدنى: 0.001 {nativeToken?.symbol} | الحد الأقصى: {userBalance.toFixed(4)} {nativeToken?.symbol}
              </p>
              <p className="text-[10px] text-slate-500">
                📈 العائد المتوقع: ${(amount * nativePrice * (currentAnalysis?.priceTarget / currentToken?.priceUsd - 1 || 0)).toFixed(2)}
              </p>
            </div>
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
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => executeTrade('BUY')}
              disabled={executing || !user || !tradingEnabled || !selectedWalletId}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                executing ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 
                !tradingEnabled || !selectedWalletId ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🚀'}
              {t('buyAction')} {nativeToken?.symbol}
            </button>
            <button
              onClick={() => executeTrade('SELL')}
              disabled={executing || !user || !tradingEnabled || !selectedWalletId}
              className={`flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                executing ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 
                !tradingEnabled || !selectedWalletId ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '📉'}
              {t('sellAction')} {nativeToken?.symbol}
            </button>
            <button
              onClick={() => {
                setCurrentToken(null);
                setCurrentAnalysis(null);
                setTradeResult(null);
                setHoveringData(null);
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
            >
              ✕ {t('closeAction')}
            </button>
          </div>

          {!user && (
            <p className="text-center text-xs text-amber-400">⚠️ الرجاء تسجيل الدخول لتنفيذ الصفقات</p>
          )}
          {!tradingEnabled && user && (
            <p className="text-center text-xs text-amber-400">⚠️ التداول معطل. فعّل التداول أولاً.</p>
          )}
          {!selectedWalletId && user && tradingEnabled && (
            <p className="text-center text-xs text-amber-400">⚠️ الرجاء اختيار محفظة للشراء</p>
          )}
        </div>
      )}

      {/* Analysis History */}
      {analyses && analyses.length > 0 && (
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
      {!loading && !currentToken && analyses && analyses.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">{t('noAnalysis')}</p>
          <p className="text-xs text-slate-500 mt-2">{t('goToMarkets')}</p>
          
          <button
            onClick={() => window.location.href = '/markets'}
            className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ➡️ {t('goToMarkets')}
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

export default AIAnalysisPage;
