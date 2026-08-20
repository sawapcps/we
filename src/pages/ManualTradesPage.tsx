// src/pages/ManualTradesPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { TrendingUp, TrendingDown, Loader2, XCircle, Eye, EyeOff } from 'lucide-react';

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
  createdAt: string;
}

export function ManualTradesPage() {
  const { addLog, trades, addTrade, isLoading, setIsLoading } = useApp();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [executing, setExecuting] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [amount, setAmount] = useState(50);

  // ✅ جلب الإشارات الحقيقية من البوت
  const fetchSignals = async () => {
    try {
      // جلب العملات المكتشفة من الـ Worker
      const res = await fetch(`${WORKER_URL}/tokens`);
      const data = await res.json();
      
      if (data.success && data.data && data.data.length > 0) {
        // تحويل العملات المكتشفة إلى إشارات
        const signalsData = data.data
          .filter((token: any) => token.score > 50) // فقط العملات ذات الدرجة الجيدة
          .map((token: any) => ({
            id: token.id || token.tokenAddress,
            tokenAddress: token.tokenAddress,
            tokenSymbol: token.symbol || 'Unknown',
            network: token.network || 'solana',
            price: token.price || 0,
            score: token.score || 0,
            recommendation: token.score > 60 ? 'BUY' : (token.score > 40 ? 'HOLD' : 'SELL'),
            reason: token.score > 60 
              ? `✅ درجة عالية (${token.score}/100) - حجم تداول: $${(token.volume_24h || 0).toLocaleString()}`
              : token.score > 40 
              ? `⏳ درجة متوسطة (${token.score}/100) - مراقبة`
              : `⚠️ درجة منخفضة (${token.score}/100) - تجنب`,
            createdAt: token.discovered_at || new Date().toISOString(),
          }));
        
        setSignals(signalsData);
        
        if (signalsData.length === 0) {
          addLog('INFO', '📭 لا توجد إشارات شراء حالياً');
        } else {
          addLog('SUCCESS', `📊 تم جلب ${signalsData.length} إشارة`);
        }
      } else {
        // ✅ إذا لم توجد بيانات حقيقية، استخدم بيانات تجريبية محسّنة
        const mockSignals: Signal[] = [
          {
            id: '1',
            tokenAddress: '0x1234567890123456789012345678901234567890',
            tokenSymbol: 'BONK',
            network: 'solana',
            price: 0.0000345,
            score: 85,
            recommendation: 'BUY',
            reason: '✅ درجة عالية (85/100) - حجم تداول مرتفع، سيولة جيدة',
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            tokenAddress: '0x2345678901234567890123456789012345678901',
            tokenSymbol: 'PEPE',
            network: 'ethereum',
            price: 0.0000123,
            score: 72,
            recommendation: 'BUY',
            reason: '✅ درجة جيدة (72/100) - زخم صاعد، توزيع جيد',
            createdAt: new Date().toISOString(),
          },
          {
            id: '3',
            tokenAddress: '0x3456789012345678901234567890123456789012',
            tokenSymbol: 'WIF',
            network: 'solana',
            price: 0.00234,
            score: 45,
            recommendation: 'HOLD',
            reason: '⏳ درجة متوسطة (45/100) - استقرار السعر، انتظار تأكيد',
            createdAt: new Date().toISOString(),
          },
          {
            id: '4',
            tokenAddress: '0x4567890123456789012345678901234567890123',
            tokenSymbol: 'DOGE',
            network: 'ethereum',
            price: 0.15,
            score: 30,
            recommendation: 'SELL',
            reason: '⚠️ درجة منخفضة (30/100) - انخفاض في الحجم، تجنب',
            createdAt: new Date().toISOString(),
          },
        ];
        setSignals(mockSignals);
        addLog('INFO', '📊 عرض إشارات تجريبية (لا توجد بيانات حقيقية)');
      }
    } catch (error) {
      console.error('❌ فشل جلب الإشارات:', error);
      addLog('ERROR', `❌ فشل جلب الإشارات: ${String(error)}`);
    }
  };

  // ✅ تنفيذ صفقة يدوية
  const executeTrade = async (signal: Signal, action: 'BUY' | 'SELL') => {
    if (!password) {
      addLog('ERROR', '⚠️ الرجاء إدخال كلمة المرور');
      return;
    }

    setExecuting(true);
    setIsLoading(true);

    try {
      const manager = BotWalletManager.getInstance();
      
      // ✅ البحث عن المحفظة الصحيحة للشبكة
      const wallet = manager.getWallet(signal.network);
      if (!wallet) {
        addLog('ERROR', `❌ لا توجد محفظة لشبكة ${signal.network}`);
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      // ✅ تنفيذ الصفقة
      let result;
      if (action === 'BUY') {
        result = await manager.executeBuy({
          tokenAddress: signal.tokenAddress,
          amount: amount,
          slippage: 0.5,
          password: password,
          network: signal.network,
        });
      } else {
        result = await manager.executeSell({
          tokenAddress: signal.tokenAddress,
          amount: amount,
          slippage: 0.5,
          password: password,
          network: signal.network,
        });
      }

      if (result.success) {
        // ✅ تسجيل الصفقة في السجل
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

        addLog('SUCCESS', `✅ تم تنفيذ صفقة ${action} يدوياً لـ ${signal.tokenSymbol} على ${signal.network}`);
        
        // إزالة الإشارة من القائمة
        setSignals(prev => prev.filter(s => s.id !== signal.id));
        setSelectedSignal(null);
        setPassword('');
        setAmount(50);
        
        // تحديث الإشارات
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

  // تحميل الإشارات عند فتح الصفحة
  useEffect(() => {
    fetchSignals();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  const buySignals = signals.filter(s => s.recommendation === 'BUY');
  const holdSignals = signals.filter(s => s.recommendation === 'HOLD');
  const sellSignals = signals.filter(s => s.recommendation === 'SELL');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🖐️ التداول اليدوي</h1>
          <p className="text-gray-500 dark:text-gray-400">
            اختر الإشارات المناسبة ونفذ الصفقات بنفسك
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

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إشارات شراء</p>
          <p className="text-2xl font-bold text-green-500">{buySignals.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إشارات مراقبة</p>
          <p className="text-2xl font-bold text-yellow-500">{holdSignals.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إشارات بيع</p>
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBuy && (
                      <button
                        onClick={() => setSelectedSignal(signal)}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                      >
                        شراء
                      </button>
                    )}
                    {isSell && (
                      <button
                        onClick={() => setSelectedSignal(signal)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                      >
                        بيع
                      </button>
                    )}
                    {isHold && (
                      <span className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-lg text-sm">
                        مراقبة
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تنفيذ الصفقة */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                تنفيذ صفقة {selectedSignal.recommendation === 'BUY' ? 'شراء' : 'بيع'}
              </h2>
              <button
                onClick={() => {
                  setSelectedSignal(null);
                  setPassword('');
                }}
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
              <div className="flex justify-between">
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور للمحفظة"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                💡 كلمة المرور الرئيسية للمحفظة (VITE_MASTER_PASSWORD)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation as 'BUY' | 'SELL')}
                disabled={executing || !password}
                className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50 flex items-center justify-center`}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد التنفيذ'}
              </button>
              <button
                onClick={() => {
                  setSelectedSignal(null);
                  setPassword('');
                }}
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
          <li>1️⃣ البوت يكتشف الفرص ويعرضها كإشارات (شراء/بيع/مراقبة)</li>
          <li>2️⃣ أنت تختار الإشارة المناسبة وتضغط على "شراء" أو "بيع"</li>
          <li>3️⃣ تدخل كلمة المرور لتأكيد التنفيذ</li>
          <li>4️⃣ الصفقة تُنفذ على الشبكة المحددة</li>
          <li>5️⃣ تظهر الصفقة في سجل الصفقات بعد التنفيذ</li>
        </ul>
      </div>
    </div>
  );
}