// src/pages/OpenTradesPage.tsx

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { formatPrice, formatUsd, formatDateTime } from '../lib/format';

interface OpenTrade {
  id: string;
  tokenSymbol: string;
  tokenAddress: string;
  network: string;
  amount: number;
  price: number;
  type: 'BUY' | 'SELL';
  status: string;
  txHash: string;
  is_open: number;
  created_at: string;
  pnl?: number;
  pnlPercent?: number;
}

export function OpenTradesPage() {
  const { addLog } = useApp();
  const [trades, setTrades] = useState<OpenTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

  // ✅ جلب الصفقات المفتوحة
  const loadTrades = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${WORKER_URL}/open-trades`);
      const result = await response.json();
      
      if (result.success) {
        setTrades(result.data || []);
        const total = (result.data || []).reduce(
          (sum: number, t: OpenTrade) => sum + t.amount * t.price,
          0
        );
        setTotalValue(total);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('❌ فشل جلب الصفقات:', error);
      addLog('ERROR', `❌ فشل جلب الصفقات: ${error}`);
    }
    setLoading(false);
  };

  // ✅ إغلاق صفقة
  const closeTrade = async (tradeId: string) => {
    if (!confirm('⚠️ هل أنت متأكد من إغلاق هذه الصفقة؟')) return;

    try {
      const response = await fetch(`${WORKER_URL}/close-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId }),
      });
      
      const result = await response.json();
      if (result.success) {
        addLog('SUCCESS', `✅ تم إغلاق الصفقة بنجاح`);
        await loadTrades(); // تحديث القائمة
      } else {
        addLog('ERROR', `❌ فشل إغلاق الصفقة: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ فشل إغلاق الصفقة:', error);
      addLog('ERROR', `❌ فشل إغلاق الصفقة: ${error}`);
    }
  };

  // تحميل تلقائي عند فتح الصفحة
  useEffect(() => {
    loadTrades();
    
    // تحديث كل 30 ثانية
    const interval = setInterval(loadTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 الصفقات المفتوحة
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            إدارة الصفقات النشطة - إغلاق صفقة دون التأثير على الباقي
          </p>
        </div>
        <button
          onClick={loadTrades}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          تحديث
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">عدد الصفقات</p>
          <p className="text-2xl font-bold text-white">{trades.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">إجمالي القيمة</p>
          <p className="text-2xl font-bold text-emerald-400">${totalValue.toFixed(2)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">آخر تحديث</p>
          <p className="text-2xl font-bold text-white">{lastUpdate || '—'}</p>
        </div>
      </div>

      {/* جدول الصفقات */}
      {trades.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-sm text-slate-400">لا توجد صفقات مفتوحة</p>
          <p className="text-xs text-slate-500 mt-1">سيتم عرض الصفقات النشطة هنا</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">العملة</th>
                  <th className="text-left px-4 py-3 font-medium">الشبكة</th>
                  <th className="text-right px-4 py-3 font-medium">السعر</th>
                  <th className="text-right px-4 py-3 font-medium">الكمية</th>
                  <th className="text-right px-4 py-3 font-medium">القيمة</th>
                  <th className="text-right px-4 py-3 font-medium">P&L</th>
                  <th className="text-center px-4 py-3 font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{trade.tokenSymbol}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{trade.network}</td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      ${trade.price.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{trade.amount}</td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      ${(trade.amount * trade.price).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${trade.pnl && trade.pnl > 0 ? 'text-emerald-400' : trade.pnl && trade.pnl < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {trade.pnl ? `${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => closeTrade(trade.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        إغلاق
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* معلومات */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-white mb-2">📌 كيفية العمل</h3>
        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
          <li>🔹 يمكنك إغلاق أي صفقة مفتوحة بشكل فردي</li>
          <li>🔹 إغلاق صفقة لا يؤثر على الصفقات الأخرى</li>
          <li>🔹 يتم تحديث القائمة تلقائياً كل 30 ثانية</li>
          <li>🔹 الصفقات المغلقة تنتقل إلى سجل الصفقات</li>
        </ul>
      </div>
    </div>
  );
}