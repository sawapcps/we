// src/pages/OpenTradesPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { XCircle, Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

export function OpenTradesPage() {
  const { addLog } = useApp();
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);

  // ✅ جلب الصفقات المفتوحة
  const fetchOpenTrades = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/open-trades`);
      const data = await res.json();
      if (data.success) {
        setOpenTrades(data.data || []);
      }
    } catch (error) {
      console.error('❌ فشل جلب الصفقات المفتوحة:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ إغلاق صفقة محددة (دون التأثير على الباقي)
  const closeTrade = async (tradeId: string) => {
    setClosingTradeId(tradeId);
    try {
      const res = await fetch(`${WORKER_URL}/close-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, closePrice: null }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('SUCCESS', `✅ تم إغلاق الصفقة ${tradeId}`);
        await fetchOpenTrades(); // تحديث القائمة
      } else {
        addLog('ERROR', `❌ فشل إغلاق الصفقة: ${data.error}`);
      }
    } catch (error: any) {
      addLog('ERROR', `❌ خطأ: ${error.message}`);
    } finally {
      setClosingTradeId(null);
    }
  };

  // تحميل البيانات عند فتح الصفحة
  useEffect(() => {
    fetchOpenTrades();
    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(fetchOpenTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalValue = openTrades.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📊 الصفقات المفتوحة</h1>
          <p className="text-gray-500 dark:text-gray-400">
            إدارة الصفقات النشطة - إغلاق صفقة دون التأثير على الباقي
          </p>
        </div>
        <button
          onClick={fetchOpenTrades}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">عدد الصفقات</p>
          <p className="text-2xl font-bold">{openTrades.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">إجمالي القيمة</p>
          <p className="text-2xl font-bold text-blue-500">{formatUsd(totalValue)}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">آخر تحديث</p>
          <p className="text-sm font-medium">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* قائمة الصفقات */}
      {openTrades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">📭 لا توجد صفقات مفتوحة</p>
          <p className="text-sm">سيتم عرض الصفقات النشطة هنا</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openTrades.map((trade) => (
            <div
              key={trade.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {trade.type === 'BUY' ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">{trade.token_symbol || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">
                      {trade.network} • {trade.type} • {new Date(trade.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatUsd(trade.amount)}</p>
                    <p className="text-sm text-gray-500">@{trade.price?.toFixed(4) || '0'}</p>
                  </div>
                  <button
                    onClick={() => closeTrade(trade.id)}
                    disabled={closingTradeId === trade.id}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {closingTradeId === trade.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* تعليمات */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">📌 كيفية العمل</h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
          <li>🔹 يمكنك إغلاق أي صفقة مفتوحة بشكل فردي</li>
          <li>🔹 إغلاق صفقة <span className="font-bold">لا يؤثر</span> على الصفقات الأخرى</li>
          <li>🔹 يتم تحديث القائمة تلقائياً كل 30 ثانية</li>
          <li>🔹 الصفقات المغلقة تنتقل إلى سجل الصفقات</li>
        </ul>
      </div>
    </div>
  );
}