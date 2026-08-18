// src/pages/AIAnalysisPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { madarRead, madarUpdate } from '../lib/madarTech';
import { analyzeToken } from '../lib/gemini';
import { getNetworkName } from '../config/networks';
import type { DiscoveredToken, AIAnalysis } from '../types';
import { formatPrice, formatUsd, timeAgo } from '../lib/format';
import { BrainCircuit, Loader2, TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react';
import { BotWalletManager } from '../lib/wallet';

interface AIAnalysisPageProps {
  pendingAnalysis: { token: DiscoveredToken } | null;
  onConsumePending: () => void;
}

export function AIAnalysisPage({ pendingAnalysis, onConsumePending }: AIAnalysisPageProps) {
  const { analyses, addAnalysis, user, addLog, refreshBotBalance } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);
  const [currentToken, setCurrentToken] = useState<DiscoveredToken | null>(null);
  const [executing, setExecuting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(true); // ✅ إضافة هذا
  const [selectedNetwork, setSelectedNetwork] = useState<string>('solana');

  // ✅ جلب الرصيد عند تحميل الصفحة
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

  // ✅ دالة تنفيذ الشراء
  const handleBuy = async () => {
    if (!currentToken) return;
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
      
      const MIN_BUY = 0.01;
      if (currentBalance < MIN_BUY) {
        throw new Error(`❌ الرصيد غير كافٍ. الرصيد: ${currentBalance.toFixed(4)} (الحد الأدنى: ${MIN_BUY})`);
      }

      const amount = parseFloat(prompt(`💰 أدخل المبلغ (بالـ ${wallet.network.toUpperCase()}):\nالرصيد: ${currentBalance.toFixed(4)}\nالشبكة: ${getNetworkName(selectedNetwork)}`, '0.01') || '0');
      if (isNaN(amount) || amount <= 0) throw new Error('❌ المبلغ غير صحيح');
      if (amount > currentBalance) throw new Error(`❌ المبلغ أكبر من الرصيد (${currentBalance.toFixed(4)})`);
      if (amount < MIN_BUY) throw new Error(`❌ المبلغ أقل من الحد الأدنى (${MIN_BUY})`);

      const confirmMsg = confirm(`🟢 تأكيد شراء ${currentToken.symbol}\nالمبلغ: ${amount} ${wallet.network.toUpperCase()}\nالشبكة: ${getNetworkName(selectedNetwork)}`);
      if (!confirmMsg) {
        addLog('INFO', `❌ تم إلغاء شراء ${currentToken.symbol}`);
        return;
      }

      addLog('SUCCESS', `🟢 شراء ${currentToken.symbol} - جاري التنفيذ... (${amount} ${wallet.network.toUpperCase()})`);

      const tradeResult = await botWallet.executeBuy({
        tokenAddress: currentToken.tokenAddress,
        amount: amount,
        slippage: 0.01,
        password: 'master_password',
        network: selectedNetwork,
      });

      if (tradeResult.success) {
        addLog('SUCCESS', `✅ تم شراء ${currentToken.symbol} بنجاح!`);
        alert(`✅ تم شراء ${currentToken.symbol} بنجاح!\nالمبلغ: ${amount} ${wallet.network.toUpperCase()}`);
        const newBalance = await refreshBotBalance(selectedNetwork);
        setBalance(newBalance);
      } else {
        throw new Error(tradeResult.error || 'فشل تنفيذ الصفقة');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل الشراء';
      setError(msg);
      addLog('ERROR', `❌ ${msg}`);
      alert(`❌ ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  // ✅ دالة تنفيذ البيع
  const handleSell = async () => {
    if (!currentToken) return;
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

      const amount = parseFloat(prompt(`🔴 أدخل المبلغ (بالـ ${wallet.network.toUpperCase()}):\nالرصيد: ${currentBalance.toFixed(4)}`, '0.01') || '0');
      if (isNaN(amount) || amount <= 0) throw new Error('❌ المبلغ غير صحيح');
      if (amount > currentBalance) throw new Error(`❌ المبلغ أكبر من الرصيد (${currentBalance.toFixed(4)})`);

      const confirmMsg = confirm(`🔴 تأكيد بيع ${currentToken.symbol}\nالمبلغ: ${amount} ${wallet.network.toUpperCase()}\nالشبكة: ${getNetworkName(selectedNetwork)}`);
      if (!confirmMsg) {
        addLog('INFO', `❌ تم إلغاء بيع ${currentToken.symbol}`);
        return;
      }

      addLog('SUCCESS', `🔴 بيع ${currentToken.symbol} - جاري التنفيذ... (${amount} ${wallet.network.toUpperCase()})`);

      const tradeResult = await botWallet.executeSell({
        tokenAddress: currentToken.tokenAddress,
        amount: amount,
        slippage: 0.01,
        password: 'master_password',
        network: selectedNetwork,
      });

      if (tradeResult.success) {
        addLog('SUCCESS', `✅ تم بيع ${currentToken.symbol} بنجاح!`);
        alert(`✅ تم بيع ${currentToken.symbol} بنجاح!\nالمبلغ: ${amount} ${wallet.network.toUpperCase()}`);
        const newBalance = await refreshBotBalance(selectedNetwork);
        setBalance(newBalance);
      } else {
        throw new Error(tradeResult.error || 'فشل تنفيذ الصفقة');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل البيع';
      setError(msg);
      addLog('ERROR', `❌ ${msg}`);
      alert(`❌ ${msg}`);
    } finally {
      setExecuting(false);
    }
  };

  // ✅ قراءة العملة من مصادر متعددة
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">🧠 AI Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">تحليل معمق باستخدام Gemini AI لعملاء Hunter Engine</p>
      </div>

      {/* عرض الرصيد */}
      {showBalance && balance !== null && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
          <span className="text-sm text-slate-400">💰 رصيد المحفظة:</span>
          <span className="text-sm font-bold text-emerald-400">{balance.toFixed(4)} {selectedNetwork.toUpperCase()}</span>
          <span className="text-xs text-slate-500">({getNetworkName(selectedNetwork)})</span>
          <button
            onClick={async () => {
              const newBalance = await refreshBotBalance(selectedNetwork);
              setBalance(newBalance);
            }}
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

      {currentToken && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          {/* Token header */}
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

          {/* Hunter Engine data */}
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

          {/* Price changes */}
          <div className="grid grid-cols-4 gap-3">
            <PriceChangeMetric label="5د" value={currentToken.priceChange.m5} />
            <PriceChangeMetric label="1س" value={currentToken.priceChange.h1} />
            <PriceChangeMetric label="6س" value={currentToken.priceChange.h6} />
            <PriceChangeMetric label="24س" value={currentToken.priceChange.h24} />
          </div>

          {currentAnalysis && (
            <>
              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">نسبة الثقة</span>
                  <span className="text-sm font-medium text-white">{currentAnalysis.confidence}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                    style={{ width: `${currentAnalysis.confidence}%` }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-800/30 rounded-xl p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{currentAnalysis.summary}</p>
              </div>

              {/* Signals */}
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

              {/* Price target + risk */}
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

              {/* ✅ أزرار التنفيذ */}
              <div className="flex gap-4 mt-6 pt-6 border-t border-slate-800">
                {currentAnalysis.recommendation === 'buy' || currentAnalysis.recommendation === 'strong_buy' ? (
                  <button
                    onClick={handleBuy}
                    disabled={executing}
                    className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing ? '⏳ جاري...' : '🟢 شراء'}
                  </button>
                ) : currentAnalysis.recommendation === 'sell' || currentAnalysis.recommendation === 'strong_sell' ? (
                  <button
                    onClick={handleSell}
                    disabled={executing}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing ? '⏳ جاري...' : '🔴 بيع'}
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 px-6 py-3 bg-slate-600 text-slate-300 rounded-lg font-medium cursor-not-allowed"
                  >
                    ⏸️ انتظار (HOLD)
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setCurrentToken(null);
                    setCurrentAnalysis(null);
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

      {/* History */}
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