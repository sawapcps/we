// src/pages/DashboardPage.tsx

import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export function DashboardPage() {
  const {
    trades,
    discoveredTokens,
    analyses,
    logs,
    isLoading,
    loadTrades,
    loadDiscoveredTokens,
    loadAnalyses,
    loadLogs,
  } = useApp();

  useEffect(() => {
    loadTrades();
    loadDiscoveredTokens();
    loadAnalyses();
    loadLogs();
  }, []);

  // حساب الإحصائيات بأمان
  const totalTrades = trades?.length || 0;
  const executedTrades = trades?.filter(t => t.status === 'EXECUTED').length || 0;
  const pendingTrades = trades?.filter(t => t.status === 'PENDING').length || 0;
  const failedTrades = trades?.filter(t => t.status === 'FAILED').length || 0;
  
  const totalDiscovered = discoveredTokens?.length || 0;
  const analyzedTokens = discoveredTokens?.filter(t => t.status === 'ANALYZED').length || 0;
  const boughtTokens = discoveredTokens?.filter(t => t.status === 'BOUGHT').length || 0;
  
  const buySignals = analyses?.filter(a => a.recommendation === 'BUY').length || 0;
  const sellSignals = analyses?.filter(a => a.recommendation === 'SELL').length || 0;
  const holdSignals = analyses?.filter(a => a.recommendation === 'HOLD').length || 0;

  // حساب P&L من الصفقات المنفذة
  const totalPnl = trades?.filter(t => t.status === 'EXECUTED')
    .reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;

  const winRate = executedTrades > 0 
    ? Math.round((trades?.filter(t => t.status === 'EXECUTED' && (t.pnl || 0) > 0).length || 0) / executedTrades * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 لوحة التحكم</h1>
        <p className="text-gray-500 dark:text-gray-400">نظرة عامة على أداء البوت</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">جاري التحميل...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-500">${totalPnl.toFixed(2)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">إجمالي الأرباح/الخسائر</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold">{winRate}%</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">نسبة النجاح</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold">{totalTrades}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">إجمالي الصفقات</div>
            </div>
            <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold">{totalDiscovered}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">عملات مكتشفة</div>
            </div>
          </div>

          {/* Trade Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">{executedTrades}</div>
              <div className="text-sm text-green-600 dark:text-green-400">✅ منفذة</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600">{pendingTrades}</div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">⏳ معلقة</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600">{failedTrades}</div>
              <div className="text-sm text-red-600 dark:text-red-400">❌ فاشلة</div>
            </div>
          </div>

          {/* AI Signals */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium mb-3">🧠 إشارات الذكاء الاصطناعي</h3>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold text-green-500">{buySignals}</span>
                <span className="text-sm text-gray-500 ml-2">شراء</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-red-500">{sellSignals}</span>
                <span className="text-sm text-gray-500 ml-2">بيع</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-gray-500">{holdSignals}</span>
                <span className="text-sm text-gray-500 ml-2">احتفاظ</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-500">{analyzedTokens}</span>
                <span className="text-sm text-gray-500 ml-2">محللة</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium mb-3">📋 آخر النشاطات</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {logs && logs.length > 0 ? (
                logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      log.level === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-700' :
                      log.level === 'ERROR' ? 'bg-red-100 dark:bg-red-900/30 text-red-700' :
                      log.level === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                    }`}>
                      {log.level}
                    </span>
                    <span className="flex-1 text-gray-700 dark:text-gray-300">{log.message}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد سجلات بعد</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}