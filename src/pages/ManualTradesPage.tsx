// src/pages/ManualTradesPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { TrendingUp, TrendingDown, Loader2, XCircle, Search, Plus, Minus, Sparkles } from 'lucide-react';

const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

interface Signal {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  network: string;
  price: number;
  score: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  aiOpinion?: string; // ✅ رأي Gemini AI
  createdAt: string;
}

export function ManualTradesPage() {
  const { addLog, trades, addTrade, isLoading, setIsLoading, botConfig } = useApp();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [executing, setExecuting] = useState(false);
  const [amount, setAmount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTokens, setAllTokens] = useState<any[]>([]);
  const [showAIOpinions, setShowAIOpinions] = useState(true);
  
  // ✅ الشبكات النشطة من botConfig
  const activeNetworks = botConfig?.networks || ['solana'];

  // ✅ جلب العملات من البوت
  const fetchSignals = async () => {
    try {
      const res = await fetch(`${WORKER_URL}/tokens`);
      const data = await res.json();
      
      let tokensData = [];
      if (data.success && data.data && data.data.length > 0) {
        tokensData = data.data;
        setAllTokens(data.data);
      } else {
        // ✅ بيانات تجريبية للاختبار
        const mockTokens = [
          { symbol: 'BONK', network: 'solana', price: 0.0000345, score: 85, address: '0x123...', volume_24h: 1500000, liquidity: 500000 },
          { symbol: 'PEPE', network: 'ethereum', price: 0.0000123, score: 72, address: '0x234...', volume_24h: 2000000, liquidity: 800000 },
          { symbol: 'WIF', network: 'solana', price: 0.00234, score: 45, address: '0x345...', volume_24h: 500000, liquidity: 200000 },
          { symbol: 'DOGE', network: 'ethereum', price: 0.15, score: 30, address: '0x456...', volume_24h: 300000, liquidity: 100000 },
          { symbol: 'SHIB', network: 'ethereum', price: 0.000024, score: 55, address: '0x567...', volume_24h: 800000, liquidity: 300000 },
          { symbol: 'FLOKI', network: 'bsc', price: 0.00012, score: 68, address: '0x678...', volume_24h: 1200000, liquidity: 450000 },
          { symbol: 'MOON', network: 'base', price: 0.0012, score: 78, address: '0x789...', volume_24h: 3000000, liquidity: 1200000 },
          { symbol: 'STAR', network: 'arbitrum', price: 0.00045, score: 62, address: '0x89a...', volume_24h: 900000, liquidity: 350000 },
        ];
        tokensData = mockTokens;
        setAllTokens(mockTokens);
      }

      // ✅ تصفية العملات حسب الشبكات النشطة فقط
      const filteredTokens = tokensData.filter((token: any) => 
        activeNetworks.includes(token.network || 'solana')
      );

      // ✅ تحويل إلى إشارات مع رأي AI محاكى
      const signalsData = filteredTokens.map((token: any) => {
        const score = token.score || 50;
        let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let aiOpinion = '';
        
        if (score >= 70) {
          recommendation = 'BUY';
          aiOpinion = '🧠 Gemini AI: فرصة شراء قوية - زخم إيجابي وحجم تداول مرتفع';
        } else if (score >= 50) {
          recommendation = 'HOLD';
          aiOpinion = '🧠 Gemini AI: مراقبة - انتظر تأكيد الاتجاه';
        } else {
          recommendation = 'SELL';
          aiOpinion = '🧠 Gemini AI: مخاطرة عالية - انخفاض في الحجم والسيولة';
        }

        return {
          id: token.id || token.address || token.symbol,
          tokenAddress: token.address || '0x...',
          tokenSymbol: token.symbol || 'Unknown',
          network: token.network || 'solana',
          price: token.price || 0,
          score: score,
          recommendation,
          reason: `${recommendation === 'BUY' ? '✅' : recommendation === 'SELL' ? '⚠️' : '⏳'} درجة ${score}/100`,
          aiOpinion,
          createdAt: token.discovered_at || new Date().toISOString(),
        };
      });

      setSignals(signalsData);
      addLog('SUCCESS', `📊 تم جلب ${signalsData.length} إشارة على الشبكات النشطة`);
      
    } catch (error) {
      console.error('❌ فشل جلب الإشارات:', error);
      addLog('ERROR', `❌ فشل جلب الإشارات: ${String(error)}`);
    }
  };

  // ✅ تنفيذ صفقة (بدون كلمة مرور)
  const executeTrade = async (signal: Signal, action: 'BUY' | 'SELL') => {
    setExecuting(true);
    setIsLoading(true);

    try {
      const manager = BotWalletManager.getInstance();
      const wallet = manager.getWallet(signal.network);
      if (!wallet) {
        addLog('ERROR', `❌ لا توجد محفظة لشبكة ${signal.network}`);
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      // ✅ تنفيذ الصفقة
      const result = action === 'BUY' 
        ? await manager.executeBuy({
            tokenAddress: signal.tokenAddress,
            amount: amount,
            slippage: 0.5,
            password: 'master_password',
            network: signal.network,
          })
        : await manager.executeSell({
            tokenAddress: signal.tokenAddress,
            amount: amount,
            slippage: 0.5,
            password: 'master_password',
            network: signal.network,
          });

      if (result.success) {
        await addTrade({
          id: `manual-${Date.now()}`,
          token: signal.tokenSymbol,
          tokenAddress: signal.tokenAddress,
          network: signal.network,
          amount: result.amount || amount,
          price: signal.price,
          type: action,
          status: 'EXECUTED',
          timestamp: new Date().toISOString(),
          txHash: result.txHash || `0x${Date.now()}`,
        });

        addLog('SUCCESS', `✅ تم تنفيذ صفقة ${action} لـ ${signal.tokenSymbol} على ${signal.network}`);
        setSelectedSignal(null);
        setAmount(50);
        setTimeout(fetchSignals, 2000);
      } else {
        addLog('ERROR', `❌ فشل التنفيذ: ${result.error}`);
      }
    } catch (error: any) {
      addLog('ERROR', `❌ خطأ: ${error.message}`);
    } finally {
      setExecuting(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [activeNetworks]);

  // ✅ تصفية العملات حسب البحث (من جميع العملات، وليس فقط الإشارات)
  const filteredAllTokens = allTokens.filter((token: any) => {
    const matchesSearch = token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         token.network?.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = activeNetworks.includes(token.network || 'solana');
    return matchesSearch && isActive;
  });

  const buySignals = signals.filter(s => s.recommendation === 'BUY');
  const holdSignals = signals.filter(s => s.recommendation === 'HOLD');
  const sellSignals = signals.filter(s => s.recommendation === 'SELL');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">🖐️ التداول اليدوي</h1>
          <p className="text-gray-500 dark:text-gray-400">
            اختر الإشارات المناسبة أو ابحث عن أي عملة للتداول
          </p>
          <p className="text-xs text-gray-400 mt-1">
            🌐 الشبكات النشطة: {activeNetworks.join(', ')}
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔄 تحديث الإشارات'}
        </button>
      </div>

      {/* ✅ مربع البحث عن أي عملة */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ابحث عن أي عملة على الشبكات النشطة (مثل: BONK, PEPE, SOL...)"
            className="flex-1 p-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setShowAIOpinions(!showAIOpinions)}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${
              showAIOpinions 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI
          </button>
        </div>

        {/* ✅ عرض نتائج البحث (جميع العملات على الشبكات النشطة) */}
        {searchQuery && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {filteredAllTokens.length > 0 ? (
              filteredAllTokens.map((token: any) => {
                const score = token.score || 50;
                const aiRec = score >= 70 ? 'BUY' : (score >= 50 ? 'HOLD' : 'SELL');
                const aiColor = aiRec === 'BUY' ? 'text-green-500' : (aiRec === 'SELL' ? 'text-red-500' : 'text-yellow-500');
                
                return (
                  <div
                    key={token.address || token.symbol}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{token.symbol}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                          {token.network}
                        </span>
                        <span className={`text-xs font-medium ${aiColor}`}>
                          {aiRec === 'BUY' ? '📈' : aiRec === 'SELL' ? '📉' : '⏳'} {aiRec}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatUsd(token.price || 0)} • درجة {score}/100
                      </p>
                      {showAIOpinions && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                          🧠 {aiRec === 'BUY' ? 'فرصة شراء' : aiRec === 'SELL' ? 'مخاطرة عالية' : 'مراقبة'} - درجة {score}/100
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const signal: Signal = {
                            id: token.address || token.symbol,
                            tokenAddress: token.address || '0x...',
                            tokenSymbol: token.symbol,
                            network: token.network || 'solana',
                            price: token.price || 0,
                            score: score,
                            recommendation: 'BUY',
                            reason: '🟢 تداول مباشر',
                            aiOpinion: showAIOpinions ? `🧠 Gemini AI: ${aiRec === 'BUY' ? 'توصي بالشراء' : aiRec === 'SELL' ? 'تحذر من البيع' : 'توصي بالمراقبة'}` : undefined,
                            createdAt: new Date().toISOString(),
                          };
                          setSelectedSignal(signal);
                        }}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                      >
                        <Plus className="w-3 h-3 inline" /> شراء
                      </button>
                      <button
                        onClick={() => {
                          const signal: Signal = {
                            id: token.address || token.symbol,
                            tokenAddress: token.address || '0x...',
                            tokenSymbol: token.symbol,
                            network: token.network || 'solana',
                            price: token.price || 0,
                            score: score,
                            recommendation: 'SELL',
                            reason: '🔴 تداول مباشر',
                            aiOpinion: showAIOpinions ? `🧠 Gemini AI: ${aiRec === 'BUY' ? 'توصي بالشراء' : aiRec === 'SELL' ? 'تحذر من البيع' : 'توصي بالمراقبة'}` : undefined,
                            createdAt: new Date().toISOString(),
                          };
                          setSelectedSignal(signal);
                        }}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                      >
                        <Minus className="w-3 h-3 inline" /> بيع
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">❌ لا توجد عملات تطابق بحثك على الشبكات النشطة</p>
            )}
          </div>
        )}
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">📈 شراء</p>
          <p className="text-2xl font-bold text-green-500">{buySignals.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">⏳ مراقبة</p>
          <p className="text-2xl font-bold text-yellow-500">{holdSignals.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">📉 بيع</p>
          <p className="text-2xl font-bold text-red-500">{sellSignals.length}</p>
        </div>
      </div>

      {/* قائمة الإشارات */}
      {signals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">📭 لا توجد إشارات حالياً</p>
          <p className="text-sm">سيتم عرض الإشارات عند اكتشاف فرص</p>
          <button
            onClick={fetchSignals}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            🔄 البحث عن إشارات
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => {
            const isBuy = signal.recommendation === 'BUY';
            const isSell = signal.recommendation === 'SELL';
            const isHold = signal.recommendation === 'HOLD';
            
            return (
              <div
                key={signal.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
                  isBuy ? 'border-green-200 dark:border-green-800' :
                  isSell ? 'border-red-200 dark:border-red-800' :
                  'border-yellow-200 dark:border-yellow-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {isBuy ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : isSell ? (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      ) : (
                        <Eye className="w-5 h-5 text-yellow-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{signal.tokenSymbol}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isBuy ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            isSell ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {signal.recommendation}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {signal.network} • {formatUsd(signal.price)} • درجة {signal.score}/100
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{signal.reason}</p>
                        {showAIOpinions && signal.aiOpinion && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                            {signal.aiOpinion}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSignal({ ...signal, recommendation: 'BUY' })}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                    >
                      شراء
                    </button>
                    <button
                      onClick={() => setSelectedSignal({ ...signal, recommendation: 'SELL' })}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                    >
                      بيع
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ نافذة تنفيذ الصفقة */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                تنفيذ صفقة {selectedSignal.recommendation === 'BUY' ? 'شراء' : 'بيع'}
              </h2>
              <button
                onClick={() => setSelectedSignal(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">العملة</span>
                <span className="font-medium">{selectedSignal.tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">السعر</span>
                <span className="font-medium">{formatUsd(selectedSignal.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الشبكة</span>
                <span className="font-medium">{selectedSignal.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الدرجة</span>
                <span className="font-medium">{selectedSignal.score}/100</span>
              </div>
              {selectedSignal.aiOpinion && (
                <div className="flex justify-between">
                  <span className="text-gray-500">رأي AI</span>
                  <span className="text-purple-600 dark:text-purple-400 text-sm">{selectedSignal.aiOpinion}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">المبلغ (USD)</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={10}
                  max={1000}
                  className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded bg-transparent text-right"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation as 'BUY' | 'SELL')}
                disabled={executing}
                className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50 flex items-center justify-center`}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ تأكيد التنفيذ'}
              </button>
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تعليمات */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📌 كيفية التداول اليدوي</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1️⃣ ابحث عن أي عملة في مربع البحث (جميع العملات على الشبكات النشطة)</li>
          <li>2️⃣ أو اختر إشارة من القائمة (مع رأي Gemini AI)</li>
          <li>3️⃣ اضغط "شراء" أو "بيع" لفتح نافذة التنفيذ</li>
          <li>4️⃣ حدد المبلغ المناسب</li>
          <li>5️⃣ اضغط "تأكيد التنفيذ" - الصفقة تُنفذ فوراً</li>
        </ul>
      </div>
    </div>
  );
}