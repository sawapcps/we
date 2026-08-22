// src/pages/TradeHistoryPage.tsx
// ============================================================
// سجل الصفقات الكامل - يعرض جميع الصفقات مع تفاصيلها
// ============================================================

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  RefreshCw, Loader2, Search, Download, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, XCircle, CheckCircle
} from 'lucide-react';
import { formatPrice, formatUsd, formatDateTime, timeAgo } from '../lib/format';
import { getNetworkName } from '../config/networks';

interface TradeHistory {
  id: string;
  user_id: string;
  user_email?: string;
  bot_id?: string;
  bot_name?: string;
  bot_type?: string;
  token_symbol: string;
  token_address: string;
  network: string;
  amount: number;
  price: number;
  type: 'BUY' | 'SELL';
  status: 'PENDING' | 'EXECUTED' | 'CLOSED' | 'FAILED';
  tx_hash?: string;
  is_open: number;
  pnl?: number;
  pnl_percent?: number;
  close_price?: number;
  close_reason?: string;
  created_at: string;
  closed_at?: string;
}

type FilterType = 'all' | 'open' | 'closed' | 'failed';
type TradeType = 'all' | 'BUY' | 'SELL';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

export function TradeHistoryPage() {
  const { user, isAdmin, addLog } = useApp();
  const [trades, setTrades] = useState<TradeHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [filterType, setFilterType] = useState<TradeType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<TradeHistory | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [isClosing, setIsClosing] = useState(false);

  // ============ جلب سجل الصفقات ============
  const loadTradeHistory = async (resetOffset = true) => {
    setLoading(true);
    try {
      const offset = resetOffset ? 0 : pagination.offset;
      const url = new URL(`${WORKER_URL}/trade-history`);
      
      if (user?.id && !isAdmin) {
        url.searchParams.append('userId', user.id);
      }
      if (isAdmin) {
        url.searchParams.append('admin', 'true');
      }
      if (filterType !== 'all') {
        url.searchParams.append('type', filterType);
      }
      if (filterStatus !== 'all') {
        url.searchParams.append('status', filterStatus);
      }
      if (selectedNetwork !== 'all') {
        url.searchParams.append('network', selectedNetwork);
      }
      if (searchQuery) {
        url.searchParams.append('token', searchQuery);
      }
      url.searchParams.append('limit', String(pagination.limit));
      url.searchParams.append('offset', String(offset));

      const response = await fetch(url.toString());
      const result = await response.json();
      
      if (result.success) {
        setTrades(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
          offset: offset,
        }));
      } else {
        addLog('ERROR', `❌ فشل تحميل السجل: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ فشل جلب السجل:', error);
      addLog('ERROR', `❌ فشل جلب السجل: ${error}`);
    }
    setLoading(false);
  };

  // ============ إغلاق صفقة ============
  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm('⚠️ هل أنت متأكد من إغلاق هذه الصفقة؟')) return;

    setIsClosing(true);
    try {
      const response = await fetch(`${WORKER_URL}/close-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tradeId, 
          closeReason: 'manual' 
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        addLog('SUCCESS', `✅ تم إغلاق الصفقة - P&L: $${result.data?.pnl?.toFixed(2) || 0}`);
        await loadTradeHistory(false);
        setShowDetails(false);
      } else {
        addLog('ERROR', `❌ فشل إغلاق الصفقة: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ فشل إغلاق الصفقة:', error);
      addLog('ERROR', `❌ فشل إغلاق الصفقة: ${error}`);
    }
    setIsClosing(false);
  };

  // ============ التحميل التلقائي ============
  useEffect(() => {
    loadTradeHistory();
    const interval = setInterval(() => loadTradeHistory(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // ============ الشبكات المتاحة ============
  const networks = ['all', 'solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];

  // ============ إحصائيات ============
  const stats = {
    total: trades.length,
    open: trades.filter(t => t.is_open === 1).length,
    closed: trades.filter(t => t.status === 'CLOSED').length,
    failed: trades.filter(t => t.status === 'FAILED').length,
    totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    totalVolume: trades.reduce((sum, t) => sum + (t.amount * t.price), 0),
    winRate: trades.filter(t => t.pnl && t.pnl > 0).length / (trades.filter(t => t.pnl !== undefined && t.pnl !== null).length || 1) * 100,
  };

  // ============ ألوان الحالة ============
  const getStatusColor = (status: string, isOpen: number) => {
    if (isOpen === 1) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    switch (status) {
      case 'EXECUTED': return 'bg-emerald-500/20 text-emerald-400';
      case 'CLOSED': return 'bg-slate-500/20 text-slate-400';
      case 'FAILED': return 'bg-red-500/20 text-red-400';
      case 'PENDING': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusLabel = (status: string, isOpen: number) => {
    if (isOpen === 1) return '🟢 مفتوحة';
    switch (status) {
      case 'EXECUTED': return '✅ منفذة';
      case 'CLOSED': return '🔒 مغلقة';
      case 'FAILED': return '❌ فاشلة';
      case 'PENDING': return '⏳ معلقة';
      default: return status;
    }
  };

  const getCloseReasonLabel = (reason?: string) => {
    const reasons: Record<string, string> = {
      take_profit: '🎯 جني ربح',
      stop_loss: '🛑 وقف خسارة',
      manual: '✋ يدوي',
      auto: '🤖 تلقائي',
      expired: '⏰ انتهاء المدة',
    };
    return reasons[reason || ''] || reason || '—';
  };

  const getTypeColor = (type: string) => {
    return type === 'BUY' ? 'text-emerald-400' : 'text-red-400';
  };

  const getTypeIcon = (type: string) => {
    return type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  // ============ التنقل بين الصفحات ============
  const nextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      loadTradeHistory(false);
    }
  };

  const prevPage = () => {
    if (pagination.offset - pagination.limit >= 0) {
      loadTradeHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 سجل الصفقات
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                👑 ADMIN
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">جميع الصفقات المنفذة مع التفاصيل الكاملة</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadTradeHistory(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            تحديث
          </button>
          <button
            onClick={() => {
              const headers = ['التاريخ', 'العملة', 'النوع', 'السعر', 'الكمية', 'P&L', 'الحالة'];
              const rows = trades.map(t => [
                formatDateTime(new Date(t.created_at).getTime()),
                t.token_symbol,
                t.type,
                t.price,
                t.amount,
                t.pnl?.toFixed(2) || '0',
                getStatusLabel(t.status, t.is_open),
              ]);
              const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير
          </button>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="الإجمالي" value={stats.total} color="text-white" />
        <StatCard label="🟢 مفتوحة" value={stats.open} color="text-emerald-400" />
        <StatCard label="🔒 مغلقة" value={stats.closed} color="text-slate-400" />
        <StatCard label="❌ فاشلة" value={stats.failed} color="text-red-400" />
        <StatCard label="📈 نسبة النجاح" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard label="💰 إجمالي P&L" value={`${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}`} color={stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard label="💵 الحجم" value={`${(stats.totalVolume / 1000).toFixed(1)}K`} color="text-blue-400" />
      </div>

      {/* الفلاتر والبحث */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadTradeHistory(true)}
            placeholder="ابحث بالعملة..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterType)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">📊 الكل</option>
            <option value="open">🟢 مفتوحة</option>
            <option value="closed">🔒 مغلقة</option>
            <option value="failed">❌ فاشلة</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TradeType)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">📈 الكل</option>
            <option value="BUY">📈 شراء</option>
            <option value="SELL">📉 بيع</option>
          </select>
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">🌐 كل الشبكات</option>
            {networks.filter(n => n !== 'all').map(n => (
              <option key={n} value={n}>{getNetworkName(n)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* جدول الصفقات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400 ml-3">جاري تحميل السجل...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-sm text-slate-400">لا توجد صفقات</p>
            <p className="text-xs text-slate-500 mt-1">سجل الصفقات فارغ حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-left px-4 py-3 font-medium">العملة</th>
                  <th className="text-left px-4 py-3 font-medium">الشبكة</th>
                  <th className="text-center px-4 py-3 font-medium">النوع</th>
                  <th className="text-right px-4 py-3 font-medium">السعر</th>
                  <th className="text-right px-4 py-3 font-medium">الكمية</th>
                  <th className="text-right px-4 py-3 font-medium">القيمة</th>
                  <th className="text-right px-4 py-3 font-medium">P&L</th>
                  <th className="text-center px-4 py-3 font-medium">الحالة</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium">المستخدم</th>}
                  <th className="text-center px-4 py-3 font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => {
                  const isOpen = trade.is_open === 1;
                  const pnlValue = trade.pnl || 0;
                  
                  return (
                    <tr 
                      key={trade.id} 
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${isOpen ? 'bg-emerald-500/5' : ''}`}
                      onClick={() => { setSelectedTrade(trade); setShowDetails(true); }}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500">{pagination.offset + index + 1}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDateTime(new Date(trade.created_at).getTime())}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{trade.token_symbol}</span>
                        {trade.bot_name && (
                          <span className="text-[10px] text-slate-500 block">{trade.bot_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{getNetworkName(trade.network)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 ${getTypeColor(trade.type)}`}>
                          {getTypeIcon(trade.type)}
                          {trade.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono text-sm">
                        ${trade.price.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{trade.amount}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        ${(trade.amount * trade.price).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pnlValue > 0 ? 'text-emerald-400' : pnlValue < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {isOpen ? '—' : `${pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)}%`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trade.status, trade.is_open)}`}>
                          {getStatusLabel(trade.status, trade.is_open)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {trade.user_email || '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-xs transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedTrade(trade); setShowDetails(true); }}
                          >
                            👁️
                          </button>
                          {isOpen && (
                            <button 
                              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleCloseTrade(trade.id); }}
                              disabled={isClosing}
                            >
                              🔒
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {trades.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            عرض {pagination.offset + 1} - {Math.min(pagination.offset + trades.length, pagination.total)} من {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={prevPage}
              disabled={pagination.offset === 0 || loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextPage}
              disabled={pagination.offset + pagination.limit >= pagination.total || loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ✅ مودال تفاصيل الصفقة */}
      {showDetails && selectedTrade && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📋 تفاصيل الصفقة
                <span className="text-sm font-normal text-slate-400">#{selectedTrade.id.slice(0, 8)}</span>
              </h3>
              <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="العملة" value={selectedTrade.token_symbol} />
              <DetailItem label="الشبكة" value={getNetworkName(selectedTrade.network)} />
              <DetailItem label="النوع" value={selectedTrade.type} color={getTypeColor(selectedTrade.type)} />
              <DetailItem label="سعر الدخول" value={`$${selectedTrade.price.toFixed(6)}`} />
              {selectedTrade.close_price && (
                <DetailItem label="سعر الخروج" value={`$${selectedTrade.close_price.toFixed(6)}`} />
              )}
              <DetailItem label="الكمية" value={selectedTrade.amount.toString()} />
              <DetailItem label="القيمة" value={`$${(selectedTrade.amount * selectedTrade.price).toFixed(2)}`} />
              <DetailItem label="P&L" value={selectedTrade.pnl ? `${selectedTrade.pnl >= 0 ? '+' : ''}${selectedTrade.pnl.toFixed(2)}%` : '—'} color={selectedTrade.pnl && selectedTrade.pnl > 0 ? 'text-emerald-400' : selectedTrade.pnl && selectedTrade.pnl < 0 ? 'text-red-400' : 'text-slate-400'} />
              <DetailItem label="الحالة" value={getStatusLabel(selectedTrade.status, selectedTrade.is_open)} />
              {selectedTrade.close_reason && (
                <DetailItem label="سبب الإغلاق" value={getCloseReasonLabel(selectedTrade.close_reason)} />
              )}
              <DetailItem label="التاريخ" value={formatDateTime(new Date(selectedTrade.created_at).getTime())} />
              {selectedTrade.closed_at && (
                <DetailItem label="تاريخ الإغلاق" value={formatDateTime(new Date(selectedTrade.closed_at).getTime())} />
              )}
              {selectedTrade.tx_hash && (
                <DetailItem label="TX Hash" value={selectedTrade.tx_hash.slice(0, 16) + '...'} />
              )}
              {selectedTrade.bot_name && (
                <DetailItem label="البوت" value={selectedTrade.bot_name} />
              )}
              {isAdmin && selectedTrade.user_email && (
                <DetailItem label="المستخدم" value={selectedTrade.user_email} />
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex gap-3">
              <button onClick={() => setShowDetails(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                ✕ إغلاق
              </button>
              {selectedTrade.is_open === 1 && (
                <button 
                  className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  onClick={() => handleCloseTrade(selectedTrade.id)}
                  disabled={isClosing}
                >
                  {isClosing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : '🔒 إغلاق الصفقة'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 🧩 مكونات مساعدة
// ============================================================

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-medium ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}