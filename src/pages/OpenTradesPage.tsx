// src/pages/OpenTradesPage.tsx
// ============================================================
// 📊 صفحة الصفقات المفتوحة - نسخة معدلة بالكامل
// ✅ جميع الأزرار تعمل
// ✅ استخدام addLog بدلاً من toast
// ✅ تحديث لحظي للأسعار
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowUp,
  ArrowDown,
  X,
  RefreshCw,
  Send,
  TrendingUp,
  Clock,
  Copy,
  ExternalLink,
  Zap,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// ============================================================
// 📦 أنواع البيانات
// ============================================================
interface Trade {
  id: string;
  bot_id: string;
  user_id: string;
  token_address: string;
  token_symbol: string;
  network: string;
  amount: number;
  price: number;
  type: 'BUY' | 'SELL';
  status: string;
  is_open: number;
  created_at: string;
  close_price: number | null;
  closed_at: string | null;
  tx_hash: string | null;
  stop_loss?: number;
  take_profit?: number;
  leverage?: number;
  currentPrice?: number;
  profit?: number;
  profitPercentage?: number;
}

// ============================================================
// 🧩 مكونات UI
// ============================================================
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`relative overflow-hidden rounded-2xl 
    bg-[#14141e]/80 backdrop-blur-xl 
    border border-[#1e1e2f] 
    transition-all duration-300 hover:border-[#10b981]/30 hover:shadow-lg hover:shadow-[#10b981]/5 ${className}`}
  >
    {children}
  </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, icon }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-[#10b981]/20',
    secondary: 'bg-[#1e1e2f] hover:bg-[#2a2a3f] text-[#e2e8f0] border border-[#1e1e2f]',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-lg shadow-[#ef4444]/20',
    success: 'bg-[#059669] hover:bg-[#047857] text-white shadow-lg shadow-[#10b981]/20',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-lg shadow-[#f59e0b]/20',
    ghost: 'bg-transparent hover:bg-[#1e1e2f] text-[#94a3b8] hover:text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ============================================================
// 🧩 مكون بطاقة الصفقة
// ============================================================
const TradeCard: React.FC<{
  trade: Trade;
  onClose: (tradeId: string) => void;
  onEdit: (tradeId: string) => void;
  onWithdraw: (tradeId: string) => void;
  onCopyAddress: (address: string) => void;
  isClosing: boolean;
}> = ({ trade, onClose, onEdit, onWithdraw, onCopyAddress, isClosing }) => {
  const entryPrice = trade.price;
  const currentPrice = trade.currentPrice || entryPrice;
  const amount = trade.amount;
  const total = amount * entryPrice;
  const profit = (currentPrice - entryPrice) * amount;
  const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  const isProfit = profit >= 0;
  const isBuy = trade.type === 'BUY';

  const formatPrice = (price: number) => price.toFixed(6);
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercentage = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const explorerUrl = trade.network === 'solana' 
    ? `https://solscan.io/token/${trade.token_address}`
    : `https://etherscan.io/token/${trade.token_address}`;

  return (
    <GlassCard className="p-5 hover:border-[#10b981]/40 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isBuy ? 'bg-[#10b981]/10' : 'bg-[#ef4444]/10'}`}>
            {isBuy ? (
              <ArrowUp className="w-5 h-5 text-[#10b981]" />
            ) : (
              <ArrowDown className="w-5 h-5 text-[#ef4444]" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              {trade.token_symbol}
              <span className="text-xs font-normal text-[#64748b] bg-[#1e1e2f] px-2 py-0.5 rounded-full">
                {trade.network}
              </span>
            </h3>
            <p className="text-xs text-[#64748b] font-mono">
              {trade.token_address.slice(0, 8)}...{trade.token_address.slice(-6)}
            </p>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-xl ${isProfit ? 'bg-[#10b981]/10' : 'bg-[#ef4444]/10'}`}>
          <div className={`text-sm font-bold ${isProfit ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {formatCurrency(profit)}
          </div>
          <div className={`text-xs ${isProfit ? 'text-[#10b981]' : 'text-[#ef4444]'} opacity-80`}>
            {formatPercentage(profitPercent)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0a0a0f]/60 rounded-xl px-3 py-2">
          <p className="text-[10px] text-[#64748b]">سعر الدخول</p>
          <p className="text-sm font-medium text-white">{formatPrice(entryPrice)}</p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-xl px-3 py-2">
          <p className="text-[10px] text-[#64748b]">السعر الحالي</p>
          <p className={`text-sm font-medium ${currentPrice >= entryPrice ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {formatPrice(currentPrice)}
            <span className="text-xs ml-1 opacity-70">
              {currentPrice >= entryPrice ? '↑' : '↓'} {formatPercentage(profitPercent)}
            </span>
          </p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-xl px-3 py-2">
          <p className="text-[10px] text-[#64748b]">الكمية</p>
          <p className="text-sm font-medium text-white">{amount.toFixed(4)}</p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-xl px-3 py-2">
          <p className="text-[10px] text-[#64748b]">الإجمالي</p>
          <p className="text-sm font-medium text-white">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {trade.stop_loss && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-[#ef4444]/10 text-[#ef4444]">
            🛑 وقف: {formatPrice(trade.stop_loss)}
          </span>
        )}
        {trade.take_profit && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-[#10b981]/10 text-[#10b981]">
            🎯 جني: {formatPrice(trade.take_profit)}
          </span>
        )}
        {trade.leverage && trade.leverage > 1 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">
            ⚡ رافعة: {trade.leverage}x
          </span>
        )}
        <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e2f] text-[#64748b]">
          <Clock className="w-3 h-3 inline mr-1" />
          {new Date(trade.created_at).toLocaleString('ar-SA')}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-[#1e1e2f] flex flex-wrap gap-2">
        <Button 
          size="sm" 
          variant="danger" 
          icon={isClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} 
          onClick={() => onClose(trade.id)}
          disabled={isClosing}
        >
          {isClosing ? 'جاري...' : 'إغلاق الصفقة'}
        </Button>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => onEdit(trade.id)}>
          تعديل
        </Button>
        <Button size="sm" variant="warning" icon={<Send className="w-3.5 h-3.5" />} onClick={() => onWithdraw(trade.id)}>
          سحب أرباح
        </Button>
        <Button size="sm" variant="ghost" icon={<Copy className="w-3.5 h-3.5" />} onClick={() => onCopyAddress(trade.token_address)}>
          نسخ
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<ExternalLink className="w-3.5 h-3.5" />}
          className="ml-auto"
          onClick={() => window.open(explorerUrl, '_blank')}
        >
          استكشاف
        </Button>
      </div>
    </GlassCard>
  );
};

// ============================================================
// 📊 المكون الرئيسي
// ============================================================
export const OpenTradesPage: React.FC = () => {
  const { user, addLog } = useApp();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [searchSymbol, setSearchSymbol] = useState('');
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasFetched = useRef(false);
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

  const networks = ['all', 'solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];

  // ============================================================
  // ✅ دالة نسخ
  // ============================================================
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setSuccess(`✅ تم نسخ العنوان: ${address.slice(0, 10)}...`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // ============================================================
  // ✅ 1. جلب الصفقات المفتوحة
  // ============================================================
  const fetchTrades = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('📊 جلب الصفقات للمستخدم:', user.id);

      const response = await fetch(`${WORKER_URL}/open-trades?userId=${user.id}`);
      const result = await response.json();

      if (result.success && result.data) {
        const openTrades = result.data.filter((t: any) => t.is_open === 1);
        
        // ✅ جلب الأسعار الحالية
        const tradesWithPrices = await Promise.all(
          openTrades.map(async (trade: any) => {
            let currentPrice = trade.price;
            try {
              const dexRes = await fetch(`${WORKER_URL}/dex-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  tokenAddress: trade.token_address, 
                  network: trade.network 
                })
              });
              const dexData = await dexRes.json();
              if (dexData.success && dexData.data?.price) {
                currentPrice = dexData.data.price;
              }
            } catch (e) {
              console.warn(`⚠️ تعذر جلب السعر لـ ${trade.token_symbol}`);
            }
            return { ...trade, currentPrice };
          })
        );

        setTrades(tradesWithPrices);
        await addLog('SUCCESS', `📊 تم جلب ${tradesWithPrices.length} صفقة مفتوحة`);
      } else {
        setTrades([]);
      }
    } catch (error) {
      console.error('❌ fetchTrades Error:', error);
      setError(`❌ فشل جلب الصفقات: ${error}`);
      await addLog('ERROR', `❌ فشل جلب الصفقات: ${error}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, addLog, WORKER_URL]);

  // ============================================================
  // ✅ 2. إغلاق صفقة
  // ============================================================
  const handleCloseTrade = async (tradeId: string) => {
    if (!user?.id) return;
    
    if (!window.confirm('⚠️ هل أنت متأكد من إغلاق هذه الصفقة؟')) return;

    setClosingTradeId(tradeId);
    setError(null);
    setSuccess(null);
    
    try {
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) {
        setError('❌ الصفقة غير موجودة');
        return;
      }

      const currentPrice = trade.currentPrice || trade.price;
      const pnl = (currentPrice - trade.price) * trade.amount;
      const pnlPercent = ((currentPrice - trade.price) / trade.price) * 100;

      const response = await fetch(`${WORKER_URL}/close-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: tradeId,
          closePrice: currentPrice,
          pnl: pnl,
          pnlPercent: pnlPercent,
          closeReason: 'Manual close by user'
        })
      });

      const result = await response.json();

      if (result.success) {
        setTrades(prev => prev.filter(t => t.id !== tradeId));
        const profitText = pnl >= 0 ? `ربح $${pnl.toFixed(2)}` : `خسارة $${Math.abs(pnl).toFixed(2)}`;
        setSuccess(`✅ تم إغلاق الصفقة ${trade.token_symbol} - ${profitText}`);
        await addLog('SUCCESS', `✅ تم إغلاق الصفقة ${trade.token_symbol} بسعر $${currentPrice.toFixed(6)}`);
      } else {
        setError(`❌ فشل إغلاق الصفقة: ${result.error || 'خطأ غير معروف'}`);
        await addLog('ERROR', `❌ فشل إغلاق الصفقة: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ handleCloseTrade Error:', error);
      setError(`❌ فشل إغلاق الصفقة: ${error}`);
      await addLog('ERROR', `❌ فشل إغلاق الصفقة: ${error}`);
    } finally {
      setClosingTradeId(null);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  // ============================================================
  // ✅ 3. تحديث يدوي
  // ============================================================
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrades();
  };

  // ============================================================
  // ✅ 4. تحميل عند تحميل الصفحة
  // ============================================================
  useEffect(() => {
    if (user?.id && !hasFetched.current) {
      hasFetched.current = true;
      fetchTrades();
    }
    if (!user?.id) {
      setLoading(false);
    }
  }, [user?.id, fetchTrades]);

  // ============================================================
  // ✅ 5. تحديث الأسعار كل 30 ثانية
  // ============================================================
  useEffect(() => {
    if (trades.length === 0) return;

    const interval = setInterval(async () => {
      const updatedTrades = await Promise.all(
        trades.map(async (trade) => {
          let currentPrice = trade.price;
          try {
            const dexRes = await fetch(`${WORKER_URL}/dex-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                tokenAddress: trade.token_address, 
                network: trade.network 
              })
            });
            const dexData = await dexRes.json();
            if (dexData.success && dexData.data?.price) {
              currentPrice = dexData.data.price;
            }
          } catch (e) {
            console.warn(`⚠️ تعذر تحديث السعر لـ ${trade.token_symbol}`);
          }
          return { ...trade, currentPrice };
        })
      );
      setTrades(updatedTrades);
    }, 30000);

    return () => clearInterval(interval);
  }, [trades.length, WORKER_URL]);

  // ============================================================
  // 📊 إحصائيات
  // ============================================================
  const stats = trades.reduce((acc, trade) => {
    const currentPrice = trade.currentPrice || trade.price;
    const profit = (currentPrice - trade.price) * trade.amount;
    acc.totalTrades++;
    acc.totalProfit += profit;
    acc.totalValue += trade.amount * trade.price;
    if (profit >= 0) acc.winningTrades++;
    else acc.losingTrades++;
    return acc;
  }, { totalTrades: 0, totalProfit: 0, winningTrades: 0, losingTrades: 0, totalValue: 0 });

  const winRate = stats.totalTrades > 0 ? (stats.winningTrades / stats.totalTrades) * 100 : 0;

  // ============================================================
  // 🎯 تصفية
  // ============================================================
  const filteredTrades = trades.filter((trade) => {
    const matchesNetwork = selectedNetwork === 'all' || trade.network === selectedNetwork;
    const matchesSearch = trade.token_symbol.toLowerCase().includes(searchSymbol.toLowerCase());
    return matchesNetwork && matchesSearch;
  });

  // ============================================================
  // 🖥️ العرض
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#10b981]" />
            الصفقات المفتوحة
            <span className="text-sm font-normal text-[#64748b]">({filteredTrades.length})</span>
          </h2>
          <p className="text-sm text-[#64748b] mt-1">تحديث لحظي للأسعار والأرباح</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
        >
          {refreshing ? 'جاري التحديث...' : 'تحديث'}
        </Button>
      </div>

      {/* رسائل الخطأ والنجاح */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-400 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span className="text-emerald-400 text-sm flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300 text-sm">✕</button>
        </div>
      )}

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">عدد الصفقات</p>
          <p className="text-2xl font-bold text-white">{stats.totalTrades}</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">إجمالي الأرباح</p>
          <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            ${stats.totalProfit.toFixed(2)}
          </p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">الصفقات الرابحة</p>
          <p className="text-2xl font-bold text-[#10b981]">{stats.winningTrades}</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">الصفقات الخاسرة</p>
          <p className="text-2xl font-bold text-[#ef4444]">{stats.losingTrades}</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">نسبة الفوز</p>
          <p className="text-2xl font-bold text-white">{winRate.toFixed(1)}%</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-xs text-[#64748b]">القيمة الإجمالية</p>
          <p className="text-2xl font-bold text-white">${stats.totalValue.toFixed(2)}</p>
        </GlassCard>
      </div>

      {/* فلاتر */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="🔍 بحث عن عملة..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white placeholder-[#64748b] focus:outline-none focus:border-[#10b981] transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {networks.map((network) => (
            <button
              key={network}
              onClick={() => setSelectedNetwork(network)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedNetwork === network ? 'bg-[#10b981] text-white' : 'bg-[#1e1e2f] text-[#64748b] hover:text-white'
              }`}
            >
              {network === 'all' ? 'الكل' : network.charAt(0).toUpperCase() + network.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* قائمة الصفقات */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
          <span className="text-[#64748b] ml-3">جاري تحميل الصفقات...</span>
        </div>
      ) : filteredTrades.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <TrendingUp className="w-12 h-12 text-[#64748b] mx-auto mb-4 opacity-50" />
          <p className="text-[#94a3b8] text-sm">لا توجد صفقات مفتوحة</p>
          <p className="text-[#64748b] text-xs mt-1">قم بإنشاء صفقة جديدة من لوحة التحكم</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTrades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              onClose={handleCloseTrade}
              onEdit={(id) => {
                addLog('INFO', `📝 تعديل الصفقة ${id} قيد التطوير`);
                setSuccess(`📝 تعديل الصفقة ${trade.token_symbol} قيد التطوير`);
                setTimeout(() => setSuccess(null), 3000);
              }}
              onWithdraw={(id) => {
                addLog('INFO', `💰 سحب أرباح الصفقة ${id} قيد التطوير`);
                setSuccess(`💰 سحب أرباح ${trade.token_symbol} قيد التطوير`);
                setTimeout(() => setSuccess(null), 3000);
              }}
              onCopyAddress={handleCopyAddress}
              isClosing={closingTradeId === trade.id}
            />
          ))}
        </div>
      )}

      {/* إعدادات الإشعارات */}
      <div className="mt-6 p-4 bg-[#1e1e2f]/30 rounded-xl border border-[#1e1e2f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#f59e0b]" />
            <span className="text-sm text-white font-medium">إعدادات الإشعارات</span>
          </div>
          <Button size="sm" variant="secondary" icon={<ExternalLink className="w-3.5 h-3.5" />}>
            إعدادات Webhook
          </Button>
        </div>
        <p className="text-xs text-[#64748b] mt-2">
          يتم إرسال إشعارات لكل شبكة عند فتح أو إغلاق صفقة أو تغير السعر بشكل كبير
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {networks.filter(n => n !== 'all').map((network) => (
            <div key={network} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0a0a0f]/60 border border-[#1e1e2f]">
              <span className="text-xs text-[#64748b]">{network}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpenTradesPage;