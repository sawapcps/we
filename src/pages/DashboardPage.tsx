// src/pages/DashboardPage.tsx
// ============================================================
// 📊 لوحة التحكم - نظرة عامة على أداء البوت
// ============================================================

import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  Brain,
  Target,
  BarChart3,
  Zap,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Wallet,
  Users,
  Coins,
} from 'lucide-react';

// ============================================================
// 🧩 مكون البطاقة الزجاجية
// ============================================================
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}> = ({ children, className = '', hover = false, glow = false }) => (
  <div className={`
    relative overflow-hidden rounded-2xl 
    bg-[#14141e]/80 backdrop-blur-xl 
    border border-[#1e1e2f] 
    transition-all duration-300
    ${hover ? 'hover:border-[#10b981]/30 hover:shadow-lg hover:shadow-[#10b981]/5 hover:-translate-y-0.5' : ''}
    ${glow ? 'shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]' : ''}
    ${className}
  `}>
    {children}
  </div>
);

// ============================================================
// 🧩 مكون الإحصائية
// ============================================================
const StatCard: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'cyan';
  trend?: number;
}> = ({ icon, value, label, color = 'emerald', trend }) => {
  const colors = {
    emerald: 'border-[#10b981]/20 bg-[#10b981]/5',
    blue: 'border-[#3b82f6]/20 bg-[#3b82f6]/5',
    amber: 'border-[#f59e0b]/20 bg-[#f59e0b]/5',
    purple: 'border-[#8b5cf6]/20 bg-[#8b5cf6]/5',
    rose: 'border-[#f43f5e]/20 bg-[#f43f5e]/5',
    cyan: 'border-[#06b6d4]/20 bg-[#06b6d4]/5',
  };
  const textColors = {
    emerald: 'text-[#10b981]',
    blue: 'text-[#3b82f6]',
    amber: 'text-[#f59e0b]',
    purple: 'text-[#8b5cf6]',
    rose: 'text-[#f43f5e]',
    cyan: 'text-[#06b6d4]',
  };

  return (
    <GlassCard className={`p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl bg-${color}-500/10 ${textColors[color]}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className={`text-2xl font-bold text-white ${textColors[color]}`}>{value}</div>
        <div className="text-sm text-[#64748b]">{label}</div>
      </div>
    </GlassCard>
  );
};

// ============================================================
// 🧩 مكون الحالة
// ============================================================
const StatusBadge: React.FC<{
  label: string;
  count: number;
  icon: React.ReactNode;
  color: 'green' | 'yellow' | 'red' | 'blue';
}> = ({ label, count, icon, color }) => {
  const colors = {
    green: 'border-[#10b981]/20 bg-[#10b981]/5 text-[#10b981]',
    yellow: 'border-[#f59e0b]/20 bg-[#f59e0b]/5 text-[#f59e0b]',
    red: 'border-[#f43f5e]/20 bg-[#f43f5e]/5 text-[#f43f5e]',
    blue: 'border-[#3b82f6]/20 bg-[#3b82f6]/5 text-[#3b82f6]',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[color]}`}>
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xl font-bold text-white">{count}</div>
        <div className="text-xs text-[#64748b]">{label}</div>
      </div>
    </div>
  );
};

// ============================================================
// 🎯 الصفحة الرئيسية
// ============================================================
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

  // آخر 5 سجلات
  const recentLogs = logs?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-[#10b981]" />
            لوحة التحكم
          </h1>
          <p className="text-sm text-[#64748b] mt-1">نظرة عامة على أداء البوت</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#64748b]">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-[#10b981]" />
            {totalTrades} صفقة
          </span>
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-[#f59e0b]" />
            {totalDiscovered} عملة
          </span>
        </div>
      </div>

      {isLoading ? (
        <GlassCard className="p-12 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 text-[#10b981] animate-spin mx-auto mb-4" />
            <p className="text-sm text-[#64748b]">جاري تحميل البيانات...</p>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* إحصائيات رئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              value={`$${totalPnl.toFixed(2)}`}
              label="إجمالي الأرباح/الخسائر"
              color="emerald"
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              value={`${winRate}%`}
              label="نسبة النجاح"
              color="blue"
              trend={winRate > 50 ? 15 : -10}
            />
            <StatCard
              icon={<BarChart3 className="w-5 h-5" />}
              value={totalTrades}
              label="إجمالي الصفقات"
              color="purple"
            />
            <StatCard
              icon={<Sparkles className="w-5 h-5" />}
              value={totalDiscovered}
              label="عملات مكتشفة"
              color="cyan"
            />
          </div>

          {/* حالات الصفقات */}
          <div className="grid grid-cols-3 gap-4">
            <StatusBadge
              label="منفذة"
              count={executedTrades}
              icon={<CheckCircle className="w-5 h-5" />}
              color="green"
            />
            <StatusBadge
              label="معلقة"
              count={pendingTrades}
              icon={<Clock className="w-5 h-5" />}
              color="yellow"
            />
            <StatusBadge
              label="فاشلة"
              count={failedTrades}
              icon={<XCircle className="w-5 h-5" />}
              color="red"
            />
          </div>

          {/* إشارات الذكاء الاصطناعي */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-[#8b5cf6]" />
              <h3 className="font-medium text-white">🧠 إشارات الذكاء الاصطناعي</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-xl bg-[#10b981]/5 border border-[#10b981]/20">
                <div className="text-2xl font-bold text-[#10b981]">{buySignals}</div>
                <div className="text-xs text-[#64748b]">🟢 شراء</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-[#f43f5e]/5 border border-[#f43f5e]/20">
                <div className="text-2xl font-bold text-[#f43f5e]">{sellSignals}</div>
                <div className="text-xs text-[#64748b]">🔴 بيع</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-[#64748b]/5 border border-[#64748b]/20">
                <div className="text-2xl font-bold text-[#94a3b8]">{holdSignals}</div>
                <div className="text-xs text-[#64748b]">⚪ احتفاظ</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-[#3b82f6]/5 border border-[#3b82f6]/20">
                <div className="text-2xl font-bold text-[#3b82f6]">{analyzedTokens}</div>
                <div className="text-xs text-[#64748b]">🔍 محللة</div>
              </div>
            </div>
          </GlassCard>

          {/* آخر النشاطات */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#10b981]" />
                <h3 className="font-medium text-white">📋 آخر النشاطات</h3>
              </div>
              <span className="text-xs text-[#64748b]">{recentLogs.length} سجل</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-[#0a0a0f] scrollbar-thumb-[#1e1e2f]">
              {recentLogs.length > 0 ? (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 text-sm p-2.5 rounded-xl bg-[#0a0a0f]/50 border border-[#1e1e2f] hover:border-[#10b981]/20 transition-colors"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      log.level === 'SUCCESS' ? 'bg-[#10b981]/20 text-[#10b981]' :
                      log.level === 'ERROR' ? 'bg-[#f43f5e]/20 text-[#f43f5e]' :
                      log.level === 'WARNING' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                      'bg-[#3b82f6]/20 text-[#3b82f6]'
                    }`}>
                      {log.level}
                    </span>
                    <span className="flex-1 text-[#94a3b8] truncate">{log.message}</span>
                    <span className="text-xs text-[#64748b] flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-[#64748b] mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-[#64748b]">لا توجد سجلات بعد</p>
                </div>
              )}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

export default DashboardPage;