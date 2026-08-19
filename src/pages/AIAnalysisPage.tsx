// src/pages/AIAnalysisPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { madarRead, madarUpdate } from '../lib/madarTech';
import { analyzeToken } from '../lib/gemini';
import { getNetworkName, NETWORKS } from '../config/networks';
import type { DiscoveredToken, AIAnalysis } from '../types';
import { formatPrice, formatUsd, timeAgo } from '../lib/format';
import { BrainCircuit, Loader2, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Wallet, DollarSign, Info } from 'lucide-react';
import { BotWalletManager } from '../lib/wallet';

interface AIAnalysisPageProps {
  pendingAnalysis: { token: DiscoveredToken } | null;
  onConsumePending: () => void;
}

// ✅ الحد الأدنى للشراء حسب الشبكة
const MIN_BUY_AMOUNTS: Record<string, number> = {
  solana: 0.01,
  ethereum: 0.0005,
  bsc: 0.005,
  polygon: 0.05,
  arbitrum: 0.0005,
  base: 0.0005,
  avalanche: 0.01,
  optimism: 0.0005,
  robinhood: 0.0005,
  ronin: 0.01,
  sui: 0.05,
  ton: 0.05,
  tron: 5,
  fantom: 0.5,
  near: 0.5,
  aptos: 0.5,
  blast: 0.0005,
  scroll: 0.0005,
  zksync: 0.0005,
  linea: 0.0005,
  opbnb: 0.005,
  celo: 0.5,
  worldchain: 0.0005,
  hyperevm: 0.0005,
  mantle: 0.005,
  cronos: 0.5,
  monad: 0.0005,
  hyperliquid: 0.0005,
  abstract: 0.0005,
  sonic: 0.0005,
  hedera: 5,
  multiversx: 0.5,
  polkadot: 0.5,
  sei: 0.5,
  starknet: 0.5,
  unichain: 0.0005,
  cardano: 5,
  injective: 0.5,
  beam: 0.5,
  taiko: 0.0005,
  movement: 0.0005,
  vana: 0.0005,
  zkfair: 0.0005,
  neon: 0.0005,
  mode: 0.0005,
};

// ✅ رمز العملة الأصلية حسب الشبكة
const NATIVE_SYMBOLS: Record<string, string> = {
  solana: 'SOL',
  ethereum: 'ETH',
  bsc: 'BNB',
  polygon: 'MATIC',
  arbitrum: 'ETH',
  base: 'ETH',
  avalanche: 'AVAX',
  optimism: 'ETH',
  robinhood: 'ETH',
  ronin: 'RON',
  sui: 'SUI',
  ton: 'TON',
  tron: 'TRX',
  fantom: 'FTM',
  near: 'NEAR',
  aptos: 'APT',
  blast: 'ETH',
  scroll: 'ETH',
  zksync: 'ETH',
  linea: 'ETH',
  opbnb: 'BNB',
  celo: 'CELO',
  worldchain: 'ETH',
  hyperevm: 'ETH',
  mantle: 'MNT',
  cronos: 'CRO',
  monad: 'MON',
  hyperliquid: 'HYPE',
  abstract: 'ETH',
  sonic: 'SONIC',
  hedera: 'HBAR',
  multiversx: 'EGLD',
  polkadot: 'DOT',
  sei: 'SEI',
  starknet: 'STRK',
  unichain: 'UNI',
  cardano: 'ADA',
  injective: 'INJ',
  beam: 'BEAM',
  taiko: 'TAI',
  movement: 'MOVE',
  vana: 'VANA',
  zkfair: 'ZKF',
  neon: 'NEON',
  mode: 'MODE',
};

// ✅ أزرار النسبة المئوية السريعة
const QUICK_AMOUNTS = [25, 50, 75, 100];

// ✅ دالة الحصول على تفسير نسبة الثقة
const getConfidenceLabel = (confidence: number): { label: string; color: string; emoji: string } => {
  if (confidence >= 80) {
    return { label: 'ثقة عالية جداً', color: 'text-emerald-400', emoji: '🟢' };
  } else if (confidence >= 60) {
    return { label: 'ثقة جيدة', color: 'text-amber-400', emoji: '🟡' };
  } else if (confidence >= 40) {
    return { label: 'ثقة متوسطة', color: 'text-orange-400', emoji: '🟠' };
  } else {
    return { label: 'ثقة منخفضة', color: 'text-red-400', emoji: '🔴' };
  }
};

export function AIAnalysisPage({ pendingAnalysis, onConsumePending }: AIAnalysisPageProps) {
  const { analyses, addAnalysis, user, addLog, refreshBotBalance } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [currentToken, setCurrentToken] = useState<DiscoveredToken | null>(null);
  const [executing, setExecuting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('solana');
  
  // ✅ حالة المبلغ
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null);

  // ✅ دوال مساعدة للشبكة
  const getMinBuy = (network: string): number => {
    return MIN_BUY_AMOUNTS[network] || 0.01;
  };

  const getNativeSymbol = (network: string): string => {
    return NATIVE_SYMBOLS[network] || network.toUpperCase().slice(0, 4);
  };

  // ============ جلب الرصيد ============
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const botWallet = BotWalletManager.getInstance();
        const allWallets = botWallet.getAllWallets();
        if (allWallets.length > 0) {
          const wallet = allWallets.find(w => w.network === selectedNetwork) || allWallets[0];
          setBalance(wallet.balance);
          setSelectedNetwork(wallet.network);
        }
      } catch (e) {
        console.error('❌ فشل جلب الرصيد:', e);
      }
    };
    fetchBalance();
  }, [selectedNetwork]);

  // ============ تحديث الرصيد ============
  const updateBalance = async () => {
    try {
      const newBalance = await refreshBotBalance(selectedNetwork);
      setBalance(newBalance);
      const nativeSymbol = getNativeSymbol(selectedNetwork);
      addLog('SUCCESS', `✅ تم تحديث الرصيد: ${newBalance.toFixed(4)} ${nativeSymbol}`);
    } catch (e) {
      addLog('ERROR', `❌ فشل تحديث الرصيد: ${e}`);
    }
  };

  // ============ تعيين المبلغ كنسبة مئوية ============
  const setAmountPercentage = (percent: number) => {
    if (!balance || balance === 0) {
      setError('❌ لا يوجد رصيد كافٍ');
      return;
    }
    const amount = balance * (percent / 100);
    setTradeAmount(amount.toFixed(4));
    setSelectedPercent(percent);
  };

  // ============ دالة التحليل ============
  const runAnalysis = async (token: DiscoveredToken) => {
    console.log('🔍 بدء تحليل العملة:', token.symbol);
    setLoading(true);
    setError(null);
    setCurrentToken(token);
    setSelectedNetwork(token.chainId);
    try {
      const result = await analyzeToken(token);
      console.log('✅ تم استلام التحليل:', result);
      setCurrentAnalysis(result);
      await addAnalysis(result);
    } catch (e) {
      console.error('❌ فشل التحليل:', e);
      setError(e instanceof Error ? e.message : 'Analysis failed');
    }
    setLoading(false);
  };

  // ============ دالة الشراء ============
  const handleBuy = async () => {
    if (!currentToken) return;
    
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0) {
      setError('❌ الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    setExecuting(true);
    setError(null);

    try {
      const botWallet = BotWalletManager.getInstance();
      const wallet = botWallet.getWallet(selectedNetwork);
      if (!wallet) {
        throw new Error(`❌ محفظة ${getNetworkName(selectedNetwork)} غير موجودة`);
      }

      const currentBalance = await refreshBotBalance(selectedNetwork);
      setBalance(currentBalance);
      
      const minBuy = getMinBuy(selectedNetwork);
      const nativeSymbol = getNativeSymbol(selectedNetwork);
      
      if (currentBalance < minBuy) {
        throw new Error(`❌ الرصيد غير كافٍ. الرصيد: ${currentBalance.toFixed(4)} ${nativeSymbol} (الحد الأدنى: ${minBuy})`);
      }
      
      if (amount > currentBalance) {
        throw new Error(`❌ المبلغ أكبر من الرصيد (${currentBalance.toFixed(4)} ${nativeSymbol})`);
      }
      if (amount < minBuy) {
        throw new Error(`❌ المبلغ أقل من الحد الأدنى (${minBuy} ${nativeSymbol})`);
      }

      const confirmMsg = confirm(
        `🟢 تأكيد شراء ${currentToken.symbol}\n` +
        `المبلغ: ${amount.toFixed(4)} ${nativeSymbol}\n` +
        `الشبكة: ${getNetworkName(selectedNetwork)}\n` +
        `السعر: $${currentToken.priceUsd.toFixed(6)}`
      );
      
      if (!confirmMsg) {
        addLog('INFO', `⏹️ تم إلغاء شراء ${currentToken.symbol}`);
        setExecuting(false);
        return;
      }

      addLog('SUCCESS', `🟢 شراء ${currentToken.symbol} - جاري التنفيذ... (${amount.toFixed(4)} ${nativeSymbol})`);

      const tradeResult = await botWallet.executeBuy({
        tokenAddress: currentToken.tokenAddress,
        amount: amount,
        slippage: 0.01,
        password: 'master_password',
        network: selectedNetwork,
      });

      if (tradeResult.success) {
        addLog('SUCCESS', `✅ تم شراء ${currentToken.symbol} بنجاح!`);
        alert(`✅ تم شراء ${currentToken.symbol} بنجاح!\nالمبلغ: ${amount.toFixed(4)} ${nativeSymbol}`);
        const newBalance = await refreshBotBalance(selectedNetwork);
        setBalance(newBalance);
        setTradeAmount('');
        setSelectedPercent(null);
      } else {
        throw new Error(tradeResult.error || 'فشل تنفيذ الصفقة');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل الشراء';
      setError(`❌ ${msg}`);
      addLog('ERROR', `❌ ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  // ============ دالة البيع ============
  const handleSell = async () => {
    if (!currentToken) return;
    
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0) {
      setError('❌ الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    setExecuting(true);
    setError(null);

    try {
      const botWallet = BotWalletManager.getInstance();
      const wallet = botWallet.getWallet(selectedNetwork);
      if (!wallet) {
        throw new Error(`❌ محفظة ${getNetworkName(selectedNetwork)} غير موجودة`);
      }

      const currentBalance = await refreshBotBalance(selectedNetwork);
      setBalance(currentBalance);
      const nativeSymbol = getNativeSymbol(selectedNetwork);
      
      if (amount > currentBalance) {
        throw new Error(`❌ المبلغ أكبر من الرصيد (${currentBalance.toFixed(4)} ${nativeSymbol})`);
      }

      const confirmMsg = confirm(
        `🔴 تأكيد بيع ${currentToken.symbol}\n` +
        `المبلغ: ${amount.toFixed(4)} ${nativeSymbol}\n` +
        `الشبكة: ${getNetworkName(selectedNetwork)}\n` +
        `السعر: $${currentToken.priceUsd.toFixed(6)}`
      );
      
      if (!confirmMsg) {
        addLog('INFO', `⏹️ تم إلغاء بيع ${currentToken.symbol}`);
        setExecuting(false);
        return;
      }

      addLog('SUCCESS', `🔴 بيع ${currentToken.symbol} - جاري التنفيذ... (${amount.toFixed(4)} ${nativeSymbol})`);

      const tradeResult = await botWallet.executeSell({
        tokenAddress: currentToken.tokenAddress,
        amount: amount,
        slippage: 0.01,
        password: 'master_password',
        network: selectedNetwork,
      });

      if (tradeResult.success) {
        addLog('SUCCESS', `✅ تم بيع ${currentToken.symbol} بنجاح!`);
        alert(`✅ تم بيع ${currentToken.symbol} بنجاح!\nالمبلغ: ${amount.toFixed(4)} ${nativeSymbol}`);
        const newBalance = await refreshBotBalance(selectedNetwork);
        setBalance(newBalance);
        setTradeAmount('');
        setSelectedPercent(null);
      } else {
        throw new Error(tradeResult.error || 'فشل تنفيذ الصفقة');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل البيع';
      setError(`❌ ${msg}`);
      addLog('ERROR', `❌ ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  // ============ قراءة العملة من المصادر ============
  useEffect(() => {
    const fetchPendingAnalysis = async () => {
      let token = pendingAnalysis?.token;

      if (!token) {
        const stored = localStorage.getItem('pendingAnalysis');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            token = parsed.token;
            localStorage.removeItem('pendingAnalysis');
            console.log('✅ تم قراءة العملة من localStorage:', token?.symbol);
          } catch (e) {
            console.error('❌ خطأ في قراءة localStorage:', e);
          }
        }
      }

      if (!token && user?.id) {
        try {
          const result = await madarRead('pending_analyses', { 
            userId: user.id, 
            status: 'pending' 
          });
          
          if (result.success && result.data && result.data.length > 0) {
            const pending = result.data[0];
            token = JSON.parse(pending.tokenData);
            
            await madarUpdate('pending_analyses', pending.id, { 
              status: 'processing' 
            });
            console.log('✅ تم قراءة العملة من قاعدة البيانات:', token.symbol);
          }
        } catch (e) {
          console.error('❌ خطأ في قراءة pending_analyses:', e);
        }
      }

      if (token && !loading) {
        onConsumePending();
        await runAnalysis(token);
        
        if (user?.id) {
          try {
            const result = await madarRead('pending_analyses', { 
              userId: user.id, 
              status: 'processing' 
            });
            if (result.success && result.data && result.data.length > 0) {
              await madarUpdate('pending_analyses', result.data[0].id, { 
                status: 'completed' 
              });
            }
          } catch (e) {
            console.error('❌ خطأ في تحديث الحالة:', e);
          }
        }
      }
    };

    fetchPendingAnalysis();
  }, [pendingAnalysis, user]);

  // ============ أنماط التوصيات ============
  const recColors: Record<string, string> = {
    strong_buy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    buy: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    hold: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    sell: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    strong_sell: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  };

  // ============ متغيرات العرض ============
  const nativeSymbol = getNativeSymbol(selectedNetwork);
  const minBuy = getMinBuy(selectedNetwork);

  // ✅ تفسير نسبة الثقة
  const confidenceInfo = currentAnalysis ? getConfidenceLabel(currentAnalysis.confidence) : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">🧠 AI Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">تحليل معمق باستخدام Gemini AI لعملاء Hunter Engine</p>
      </div>

      {/* ============ عرض الرصيد ============ */}
      {showBalance && balance !== null && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-400">💰 رصيد المحفظة:</span>
          <span className="text-sm font-bold text-emerald-400">
            {balance.toFixed(4)} {nativeSymbol}
          </span>
          <span className="text-xs text-slate-500">({getNetworkName(selectedNetwork)})</span>
          <button
            onClick={updateBalance}
            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
          >
            🔄 تحديث
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <BrainCircuit className="w-12 h-12 text-emerald-400" />
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin absolute inset-0" />
          </div>
          <p className="text-sm text-slate-400">جاري تحليل {currentToken?.symbol} بواسطة Gemini AI...</p>
        </div>
      )}

      {/* ============ عرض التحليل ============ */}
      {currentToken && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{currentToken.symbol}</h2>
                <p className="text-sm text-slate-500">{currentToken.name} · {getNetworkName(currentToken.chainId)}</p>
              </div>
            </div>
            {currentAnalysis && (
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${recColors[currentAnalysis.recommendation]}`}>
                {currentAnalysis.recommendation.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>

          {/* بيانات Hunter */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DataMetric label="نقاط Hunter" value={`${currentToken.score}/100`} />
            <DataMetric label="السعر" value={formatPrice(currentToken.priceUsd)} />
            <DataMetric label="الحجم 24س" value={formatUsd(currentToken.volume24h)} />
            <DataMetric label="السيولة" value={formatUsd(currentToken.liquidityUsd)} />
            <DataMetric label="القيمة السوقية" value={currentToken.marketCap ? formatUsd(currentToken.marketCap) : '—'} />
            <DataMetric label="FDV" value={currentToken.fdv ? formatUsd(currentToken.fdv) : '—'} />
            <DataMetric label="مشتريات 24س" value={currentToken.txns24h.buys.toLocaleString()} />
            <DataMetric label="مبيعات 24س" value={currentToken.txns24h.sells.toLocaleString()} />
          </div>

          {/* التغيرات السعرية */}
          <div className="grid grid-cols-4 gap-3">
            <PriceChangeMetric label="5د" value={currentToken.priceChange.m5} />
            <PriceChangeMetric label="1س" value={currentToken.priceChange.h1} />
            <PriceChangeMetric label="6س" value={currentToken.priceChange.h6} />
            <PriceChangeMetric label="24س" value={currentToken.priceChange.h24} />
          </div>

          {currentAnalysis && (
            <>
              {/* ============ نسبة الثقة مع التفسير ============ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-400">نسبة الثقة</span>
                    {/* ✅ Tooltip مع تفسير */}
                    <div className="relative group">
                      <Info className="w-3.5 h-3.5 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                        <p className="font-medium text-white mb-1">🧠 ماذا تعني نسبة الثقة؟</p>
                        <p className="text-slate-400 text-[11px] mb-1.5">مدى ثقة الذكاء الاصطناعي في قراره:</p>
                        <ul className="space-y-0.5 text-[11px]">
                          <li>🟢 <span className="text-emerald-400">80-100%</span> ثقة عالية جداً</li>
                          <li>🟡 <span className="text-amber-400">60-79%</span> ثقة جيدة</li>
                          <li>🟠 <span className="text-orange-400">40-59%</span> ثقة متوسطة</li>
                          <li>🔴 <span className="text-red-400">0-39%</span> ثقة منخفضة</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${confidenceInfo?.color || 'text-white'}`}>
                      {currentAnalysis.confidence}%
                    </span>
                    <span className={`text-[10px] font-medium ${confidenceInfo?.color || 'text-slate-400'}`}>
                      {confidenceInfo?.emoji} {confidenceInfo?.label}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      currentAnalysis.confidence >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                      currentAnalysis.confidence >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                      currentAnalysis.confidence >= 40 ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
                      'bg-gradient-to-r from-red-500 to-orange-400'
                    }`}
                    style={{ width: `${currentAnalysis.confidence}%` }}
                  />
                </div>
              </div>

              {/* الملخص */}
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{currentAnalysis.summary}</p>
              </div>

              {/* الإشارات */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">إشارات التداول</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {currentAnalysis.signals.map((sig, i) => (
                    <div key={i} className="bg-slate-800/30 rounded-xl p-3 border border-slate-800">
                      <div className="flex items-center gap-1.5 mb-1">
                        {sig.bullish ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-xs text-slate-500">{sig.label}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{sig.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* السعر المستهدف + المخاطرة */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-slate-800/30 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">السعر المستهدف</p>
                  <p className="text-lg font-bold text-white">{formatPrice(currentAnalysis.priceTarget)}</p>
                </div>
                <div className="flex-1 bg-slate-800/30 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">مستوى المخاطرة</p>
                  <p className={`text-lg font-bold capitalize ${riskColors[currentAnalysis.riskLevel]}`}>
                    {currentAnalysis.riskLevel === 'low' ? 'منخفضة' : 
                     currentAnalysis.riskLevel === 'medium' ? 'متوسطة' : 'عالية'}
                  </p>
                </div>
              </div>

              {/* ============ ✅ حقل إدخال المبلغ ============ */}
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">المبلغ المراد تداوله</span>
                  <span className="text-xs text-slate-500">
                    (الرصيد: {balance?.toFixed(4) || '0'} {nativeSymbol})
                  </span>
                </div>
                
                {/* أزرار النسبة المئوية */}
                <div className="flex gap-2 mb-3">
                  {QUICK_AMOUNTS.map((percent) => (
                    <button
                      key={percent}
                      onClick={() => setAmountPercentage(percent)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedPercent === percent
                          ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                {/* حقل الإدخال */}
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => {
                      setTradeAmount(e.target.value);
                      setSelectedPercent(null);
                    }}
                    placeholder={`المبلغ بـ ${nativeSymbol}`}
                    className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    step="0.0001"
                    min={minBuy}
                  />
                  <button
                    onClick={() => {
                      if (balance) {
                        setTradeAmount(balance.toFixed(4));
                        setSelectedPercent(100);
                      }
                    }}
                    className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Max
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  ⚡ الحد الأدنى: {minBuy} {nativeSymbol} | الحد الأقصى: {balance?.toFixed(4) || '0'} {nativeSymbol}
                </p>
              </div>

              {/* ============ ✅ أزرار التداول المعدلة ============ */}
              <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-slate-800">
                {(currentAnalysis.recommendation === 'buy' || currentAnalysis.recommendation === 'strong_buy') && (
                  <button
                    onClick={handleBuy}
                    disabled={executing || !tradeAmount || parseFloat(tradeAmount) <= 0}
                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {executing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    🟢 شراء {tradeAmount ? `(${tradeAmount} ${nativeSymbol})` : ''}
                  </button>
                )}

                {(currentAnalysis.recommendation === 'sell' || currentAnalysis.recommendation === 'strong_sell') && (
                  <button
                    onClick={handleSell}
                    disabled={executing || !tradeAmount || parseFloat(tradeAmount) <= 0}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {executing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    🔴 بيع {tradeAmount ? `(${tradeAmount} ${nativeSymbol})` : ''}
                  </button>
                )}

                {(currentAnalysis.recommendation === 'hold') && (
                  <button
                    disabled
                    className="flex-1 px-6 py-3 bg-slate-600 text-slate-300 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    ⏸️ انتظار (HOLD)
                  </button>
                )}

                <button
                  onClick={() => {
                    setCurrentToken(null);
                    setCurrentAnalysis(null);
                    setTradeAmount('');
                    setSelectedPercent(null);
                  }}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  ✕ إغلاق
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ سجل التحليلات ============ */}
      {analyses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">سجل التحليلات</h2>
          <div className="space-y-2">
            {analyses.slice(0, 10).map((a, i) => (
              <div
                key={i}
                className="w-full flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/50 rounded-lg px-4 py-3 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${recColors[a.recommendation]}`}>
                    {a.recommendation.replace('_', ' ').toUpperCase()}
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

      {!loading && !currentToken && analyses.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <BrainCircuit className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-sm text-slate-400">
            اضغط على زر "تحليل" في صفحة الأسواق لإرسال العملة إلى Gemini AI
          </p>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

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
