// src/pages/ManualTradesPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { TrendingUp, TrendingDown, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';

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

  // ✅ جلب إشارات البوت (المكتشفة)
  const fetchSignals = async () => {
    try {
      // محاكاة جلب الإشارات من البوت
      const mockSignals: Signal[] = [
        {
          id: '1',
          tokenAddress: '0x123...',
          tokenSymbol: 'BONK',
          network: 'solana',
          price: 0.0000345,
          score: 85,
          recommendation: 'BUY',
          reason: 'حجم تداول مرتفع، سيولة جيدة',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          tokenAddress: '0x456...',
          tokenSymbol: 'PEPE',
          network: 'ethereum',
          price: 0.0000123,
          score: 72,
          recommendation: 'BUY',
          reason: 'زخم صاعد، توزيع جيد',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          tokenAddress: '0x789...',
          tokenSymbol: 'WIF',
          network: 'solana',
          price: 0.00234,
          score: 65,
          recommendation: 'HOLD',
          reason: 'استقرار السعر، انتظار تأكيد',
          createdAt: new Date().toISOString(),
        },
      ];
      setSignals(mockSignals);
    } catch (error) {
      console.error('❌ فشل جلب الإشارات:', error);
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
      
      // ✅ تنفيذ الصفقة
      const result = await manager.executeBuy({
        tokenAddress: signal.tokenAddress,
        amount: 50 + Math.random() * 50, // محاكاة
        slippage: 0.5,
        password: password,
        network: signal.network,
      });

      if (result.success) {
        await addTrade({
          id: `manual-${Date.now()}`,
          token: signal.tokenSymbol,
          tokenAddress: signal.tokenAddress,
          network: signal.network,
          amount: result.amount,
          price: signal.price,
          type: action,
          status: 'EXECUTED',
          timestamp: new Date().toISOString(),
          txHash: result.txHash || `0x${Date.now()}`,
        });

        addLog('SUCCESS', `✅ تم تنفيذ صفقة ${action} يدوياً لـ ${signal.tokenSymbol}`);
        
        // إزالة الإشارة من القائمة
        setSignals(prev => prev.filter(s => s.id !== signal.id));
        setSelectedSignal(null);
        setPassword('');
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🖐️ الصفقات اليدوية</h1>
          <p className="text-gray-500 dark:text-gray-400">
            اختر الإشارات المناسبة ونفذ الصفقات بنفسك
          </p>
        </div>
        <button
          onClick={fetchSignals}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔄 تحديث الإشارات'}
        </button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إشارات شراء</p>
          <p className="text-2xl font-bold text-green-500">
            {signals.filter(s => s.recommendation === 'BUY').length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إشارات بيع</p>
          <p className="text-2xl font-bold text-red-500">
            {signals.filter(s => s.recommendation === 'SELL').length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إجمالي الصفقات</p>
          <p className="text-2xl font-bold">{trades.filter(t => t.status === 'EXECUTED').length}</p>
        </div>
      </div>

      {/* قائمة الإشارات */}
      {signals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">📭 لا توجد إشارات حالياً</p>
          <p className="text-sm">سيتم عرض الإشارات عند اكتشاف فرص</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
                signal.recommendation === 'BUY' 
                  ? 'border-green-200 dark:border-green-800' 
                  : signal.recommendation === 'SELL'
                  ? 'border-red-200 dark:border-red-800'
                  : 'border-yellow-200 dark:border-yellow-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {signal.recommendation === 'BUY' ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : signal.recommendation === 'SELL' ? (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  ) : (
                    <Eye className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">{signal.tokenSymbol}</p>
                    <p className="text-sm text-gray-500">
                      {signal.network} • {formatUsd(signal.price)} • درجة {signal.score}
                    </p>
                    <p className="text-xs text-gray-400">{signal.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {signal.recommendation === 'BUY' && (
                    <button
                      onClick={() => setSelectedSignal(signal)}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                    >
                      شراء
                    </button>
                  )}
                  {signal.recommendation === 'SELL' && (
                    <button
                      onClick={() => setSelectedSignal(signal)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                    >
                      بيع
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نافذة تنفيذ الصفقة */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">تنفيذ صفقة {selectedSignal.recommendation}</h2>
            
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
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation as 'BUY' | 'SELL')}
                disabled={executing || !password}
                className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50`}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'تأكيد التنفيذ'}
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
          <li>1️⃣ البوت يكتشف الفرص ويعرضها كإشارات</li>
          <li>2️⃣ أنت تختار الإشارة المناسبة</li>
          <li>3️⃣ تدخل كلمة المرور لتأكيد التنفيذ</li>
          <li>4️⃣ الصفقة تُنفذ على الشبكة المحددة</li>
          <li>5️⃣ تظهر الصفقة في سجل الصفقات</li>
        </ul>
      </div>
    </div>
  );
}