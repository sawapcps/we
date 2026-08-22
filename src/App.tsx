// src/App.tsx
// ============================================================
// تطبيق MadarTech Trading System - يدعم 4 بوتات و 9 شبكات
// ============================================================

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { BotControlPage } from './pages/BotControlPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketsPage } from './pages/MarketsPage';
import { AIAnalysisPage } from './pages/AIAnalysisPage';
import { WalletPage } from './pages/WalletPage';
import MyWalletPage from './pages/MyWalletPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { OpenTradesPage } from './pages/OpenTradesPage';
import { ManualTradesPage } from './pages/ManualTradesPage';
import { ScalperConfigPage } from './pages/ScalperConfigPage';
import { TradeHistoryPage } from './pages/TradeHistoryPage';
import { madarCreate } from './lib/madarTech';
import type { DiscoveredToken } from './types';

// ============================================================
// 🎨 أيقونات Lucide
// ============================================================
import {
  LayoutDashboard,
  Bot,
  Target,
  BrainCircuit,
  TrendingUp,
  Wallet,
  Settings,
  Activity,
  Sparkles,
  Menu,
  X,
  LogOut,
  User,
  Plus,
  Play,
  Pause,
  Trash2,
  Shield,
  BarChart3,
  Zap,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Link2,
  Unlink,
  History,
} from 'lucide-react';

// ============================================================
// 🌐 قائمة الشبكات التسع
// ============================================================
const NETWORK_OPTIONS = [
  { value: 'solana', label: '🟣 Solana' },
  { value: 'ethereum', label: '🔵 Ethereum' },
  { value: 'bsc', label: '🟡 BSC' },
  { value: 'polygon', label: '🟢 Polygon' },
  { value: 'arbitrum', label: '🔷 Arbitrum' },
  { value: 'base', label: '🔷 Base' },
  { value: 'avalanche', label: '🔴 Avalanche' },
  { value: 'optimism', label: '🟠 Optimism' },
  { value: 'robinhood', label: '🟩 Robinhood' },
];

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
// 🧩 زر أنيق
// ============================================================
const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'scalper' | 'wallet';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  icon
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-[#10b981]/20 hover:shadow-[#10b981]/30 focus:ring-[#10b981]',
    secondary: 'bg-[#1e1e2f] hover:bg-[#2a2a3f] text-[#e2e8f0] border border-[#1e1e2f] hover:border-[#10b981]/30',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-lg shadow-[#ef4444]/20 focus:ring-[#ef4444]',
    ghost: 'bg-transparent hover:bg-[#1e1e2f] text-[#94a3b8] hover:text-white',
    success: 'bg-[#059669] hover:bg-[#047857] text-white shadow-lg shadow-[#10b981]/20',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-lg shadow-[#f59e0b]/20',
    scalper: 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-lg shadow-[#f97316]/20 hover:shadow-[#f97316]/30 focus:ring-[#f97316]',
    wallet: 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-lg shadow-[#8b5cf6]/20 hover:shadow-[#8b5cf6]/30 focus:ring-[#8b5cf6]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ============================================================
// 🧩 شارة الحالة
// ============================================================
const StatusBadge: React.FC<{ status: 'running' | 'paused' | 'stopped' }> = ({ status }) => {
  const config = {
    running: { label: 'يعمل', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', dot: 'bg-[#10b981] animate-pulse' },
    paused: { label: 'متوقف مؤقت', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', dot: 'bg-[#f59e0b]' },
    stopped: { label: 'متوقف', color: 'text-[#64748b]', bg: 'bg-[#1e1e2f]', dot: 'bg-[#64748b]' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

// ============================================================
// 🧠 مكون إدارة البوتات الأربعة
// ============================================================
const BotsManager: React.FC = () => {
  const { 
    botInstances = [], 
    loadBotInstances, 
    createBot, 
    startBot, 
    stopBot, 
    deleteBot, 
    createWalletForBot, 
    addLog, 
    user 
  } = useApp();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'hunter' | 'signal' | 'manual' | 'scalper'>('hunter');
  const [botName, setBotName] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('solana');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadBotInstances(user.id);
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    try {
      await loadBotInstances(user.id);
      await addLog('SUCCESS', '🔄 تم تحديث قائمة البوتات');
    } catch (error) {
      await addLog('ERROR', `❌ فشل تحديث البوتات: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateBot = async () => {
    if (!botName.trim() || !user?.id) return;
    setIsCreating(true);
    try {
      await createBot(selectedType, botName.trim(), user.id);
      setShowCreateModal(false);
      setBotName('');
      await loadBotInstances(user.id);
    } catch (error) {
      await addLog('ERROR', `❌ فشل إنشاء البوت: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const BOT_TYPES = {
    hunter: {
      label: 'Hunter Alpha',
      icon: Target,
      color: 'text-[#10b981]',
      bg: 'bg-[#10b981]/10',
      desc: 'صائد العملات الجديدة والمحافظ الذكية',
      badge: 'صيد'
    },
    signal: {
      label: 'Signal Pro',
      icon: TrendingUp,
      color: 'text-[#3b82f6]',
      bg: 'bg-[#3b82f6]/10',
      desc: 'محلل الإشارات الفنية والزخم',
      badge: 'تحليل'
    },
    manual: {
      label: 'Manual Desk',
      icon: User,
      color: 'text-[#8b5cf6]',
      bg: 'bg-[#8b5cf6]/10',
      desc: 'لوحة تحكم يدوية متقدمة',
      badge: 'يدوي'
    },
    scalper: {
      label: 'Scalper X',
      icon: Zap,
      color: 'text-[#f97316]',
      bg: 'bg-[#f97316]/10',
      desc: 'تداول سريع على عملة محددة بصفقات متعددة',
      badge: 'سريع'
    },
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#10b981]" />
            البوتات الذكية
            <span className="text-sm font-normal text-[#64748b]">({botInstances.length})</span>
          </h2>
          <p className="text-sm text-[#64748b] mt-1">4 أنواع من البوتات، كل بوت يعمل على شبكة أو أكثر من 9 شبكات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isRefreshing} icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}>
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            بوت جديد
          </Button>
        </div>
      </div>

      {botInstances.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Bot className="w-12 h-12 text-[#64748b] mx-auto mb-4 opacity-50" />
          <p className="text-[#94a3b8] text-sm">لا توجد بوتات بعد</p>
          <p className="text-[#64748b] text-xs mt-1">أنشئ بوتك الأول للبدء</p>
          <Button className="mt-4" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            إنشاء بوت
          </Button>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {botInstances.map((bot) => {
            const type = BOT_TYPES[bot.bot_type as keyof typeof BOT_TYPES] || BOT_TYPES.hunter;
            const Icon = type.icon;
            const isRunning = bot.status === 'running';

            return (
              <GlassCard key={bot.id} hover glow className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${type.bg}`}>
                      <Icon className={`w-5 h-5 ${type.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{bot.name}</h3>
                      <p className="text-xs text-[#64748b]">{type.desc}</p>
                    </div>
                  </div>
                  <StatusBadge status={bot.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${type.bg} ${type.color}`}>
                    {type.badge}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2f] text-[#64748b]">
                    {bot.mode === 'auto' ? 'تلقائي' : 'يدوي'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-[#0a0a0f]/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-[#64748b]">الشبكات</span>
                    <p className="text-white font-medium truncate text-[10px]">
                      {bot.networks ? bot.networks.split(',').map(n => n.trim()).slice(0, 2).join(', ') : 'solana'}
                      {bot.networks && bot.networks.split(',').length > 2 && '...'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0f]/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-[#64748b]">صفقات اليوم</span>
                    <p className="text-white font-medium text-[10px]">{bot.total_trades || 0}</p>
                  </div>
                  <div className="bg-[#0a0a0f]/60 rounded-lg px-2.5 py-1.5 col-span-2">
                    <span className="text-[#64748b]">P&L اليوم</span>
                    <p className={`font-medium text-[10px] ${(bot.today_pnl || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {(bot.today_pnl || 0) >= 0 ? '+' : ''}{(bot.today_pnl || 0).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#1e1e2f]">
                  {isRunning ? (
                    <Button size="sm" variant="warning" icon={<Pause className="w-3 h-3" />} onClick={() => stopBot(bot.id, user.id)}>
                      إيقاف
                    </Button>
                  ) : (
                    <Button size="sm" variant={bot.bot_type === 'scalper' ? 'scalper' : 'primary'} icon={<Play className="w-3 h-3" />} onClick={() => startBot(bot.id, user.id)}>
                      تشغيل
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={<Wallet className="w-3 h-3" />} onClick={() => createWalletForBot(bot.id, selectedNetwork, user.id)}>
                    محفظة
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-3 h-3" />} onClick={() => deleteBot(bot.id, user.id)} className="ml-auto" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* مودال إنشاء بوت */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">إنشاء بوت جديد</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#64748b] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#94a3b8] block mb-2">نوع البوت</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BOT_TYPES).map(([key, val]) => {
                    const Icon = val.icon;
                    const isSelected = selectedType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedType(key as any)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          isSelected
                            ? `border-[#10b981] bg-[#10b981]/10 shadow-lg shadow-[#10b981]/5`
                            : 'border-[#1e1e2f] hover:border-[#64748b]'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-[#10b981]' : 'text-[#64748b]'}`} />
                        <span className={`text-xs ${isSelected ? 'text-white' : 'text-[#64748b]'}`}>{val.label}</span>
                        <p className="text-[9px] text-[#64748b] mt-0.5">{val.desc.slice(0, 20)}...</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">اسم البوت</label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="مثال: Scalper Pro"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white placeholder-[#64748b] focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">الشبكة الافتراضية</label>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  {NETWORK_OPTIONS.map((net) => (
                    <option key={net.value} value={net.value}>
                      {net.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#64748b] mt-1">🌐 يمكن إضافة شبكات أخرى لاحقاً</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="primary" className="flex-1" onClick={handleCreateBot} disabled={isCreating || !botName.trim()}>
                  {isCreating ? 'جاري الإنشاء...' : 'إنشاء'}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 🧩 شريط التنقل الجانبي (مع دعم Web3Modal)
// ============================================================
const Sidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const location = useLocation();
  const { 
    isRunning, 
    user, 
    isAdmin, 
    logout, 
    botInstances,
    walletProviders,
    activeWallet,
    walletAddress,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    getWalletBalance,
    walletNetwork,
  } = useApp();

  // ✅ Web3Modal - زر الاتصال (تم إزالته)
  // const { open } = useWeb3Modal();

  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (isWalletConnected && activeWallet) {
      getWalletBalance().then(setBalance).catch(() => setBalance(0));
    }
  }, [isWalletConnected, activeWallet]);

  if (!user) return <>{children}</>;

  const isActive = (path: string) => location.pathname === path;

  // ✅ قائمة التنقل مع سجل الصفقات
  const navItems = [
    { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
    { path: '/bots', label: 'البوتات', icon: Bot, badge: botInstances.filter(b => b.status === 'running').length },
    { path: '/markets', label: 'الأسواق', icon: TrendingUp },
    { path: '/ai', label: 'الذكاء الاصطناعي', icon: BrainCircuit },
    { path: '/wallet', label: 'محفظة البوت', icon: Wallet },
    { path: '/my-wallet', label: 'محفظتي', icon: Wallet },
    { path: '/open-trades', label: 'صفقات مفتوحة', icon: BarChart3 },
    { path: '/manual-trades', label: 'تداول يدوي', icon: Activity },
    { path: '/trade-history', label: 'سجل الصفقات', icon: History },
    { path: '/scalper', label: 'Scalper X', icon: Zap, badge: botInstances.filter(b => b.bot_type === 'scalper' && b.status === 'running').length },
    ...(isAdmin ? [{ path: '/admin', label: 'إدارة', icon: Shield }] : []),
    { path: '/settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <aside className={`
        fixed lg:sticky top-0 z-40 h-screen w-72 
        bg-[#0a0a0f]/95 backdrop-blur-xl border-l border-[#1e1e2f]
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 h-20 border-b border-[#1e1e2f]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-lg shadow-[#10b981]/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Madar<span className="text-[#10b981]">Tech</span></h1>
                <p className="text-[10px] text-[#64748b] tracking-wider">TRADING SYSTEM</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden text-[#64748b] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const isScalper = item.path === '/scalper';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${active
                      ? isScalper
                        ? 'bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 shadow-lg shadow-[#f97316]/5'
                        : 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 shadow-lg shadow-[#10b981]/5'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[#1e1e2f] border border-transparent'
                    }
                  `}
                >
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#10b981]/20 text-[#10b981] text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ✅ Footer - معلومات المستخدم + المحافظ المتعددة */}
          <div className="px-4 py-4 border-t border-[#1e1e2f] space-y-3">
            
            {/* ✅ المحافظ المتعددة (خارجية) - بدون Web3Modal */}
            <div className="relative">
              {isWalletConnected && activeWallet ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e1e2f]/50">
                  <span className="text-lg">{activeWallet.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#94a3b8] truncate">{activeWallet.name}</p>
                    <p className="text-[10px] font-mono text-[#64748b] truncate">
                      {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    </p>
                    <p className="text-[10px] text-[#10b981]">💰 {balance.toFixed(4)} {activeWallet.getNetwork().toUpperCase()}</p>
                  </div>
                  <button 
                    onClick={disconnectWallet}
                    className="text-[#64748b] hover:text-[#ef4444] transition-colors"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  {/* ✅ زر ربط المحفظة (النظام القديم) */}
                  <button
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 text-[#8b5cf6] text-sm font-medium transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    ربط المحفظة
                    <ChevronDown className={`w-4 h-4 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showWalletDropdown && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#14141e] border border-[#1e1e2f] rounded-xl shadow-2xl p-2 space-y-1">
                      {walletProviders.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => {
                            connectWallet(provider.id).catch(() => {});
                            setShowWalletDropdown(false);
                          }}
                          disabled={!provider.installed && provider.id !== 'walletconnect'}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            provider.installed || provider.id === 'walletconnect'
                              ? 'hover:bg-[#1e1e2f] text-[#94a3b8] hover:text-white'
                              : 'opacity-50 cursor-not-allowed text-[#64748b]'
                          }`}
                        >
                          <span className="text-lg">{provider.icon}</span>
                          <span className="flex-1 text-left">{provider.name}</span>
                          {!provider.installed && provider.id !== 'walletconnect' && (
                            <span className="text-[8px] text-[#ef4444]">غير مثبت</span>
                          )}
                          {provider.id === 'walletconnect' && (
                            <span className="text-[8px] text-[#8b5cf6]">QR</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ✅ معلومات المستخدم */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1e1e2f]/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.email || 'مستخدم'}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${isRunning ? 'text-[#10b981]' : 'text-[#64748b]'}`}>
                    {isRunning ? '● البوت يعمل' : '● البوت متوقف'}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] text-[#8b5cf6]">👑</span>
                  )}
                </div>
              </div>
              <button onClick={logout} className="text-[#64748b] hover:text-[#ef4444] transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <main className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-[#1e1e2f] px-4 h-16 flex items-center">
          <button onClick={() => setIsOpen(true)} className="p-2 text-[#94a3b8] hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mr-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">MadarTech</span>
          </div>
          {isRunning && (
            <span className="mr-auto text-xs px-2 py-0.5 rounded-full bg-[#10b981] text-white animate-pulse">
              LIVE
            </span>
          )}
        </header>

        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// ============================================================
// 🚀 التطبيق الرئيسي
// ============================================================
function AppContent() {
  const { user } = useApp();
  const [pendingAnalysis, setPendingAnalysis] = useState<{ token: DiscoveredToken } | null>(null);

  const handleAnalyzeToken = async (token: DiscoveredToken) => {
    console.log('🔍 تحليل العملة:', token.symbol);
    localStorage.setItem('pendingAnalysis', JSON.stringify({ token }));
    if (user?.id) {
      try {
        await madarCreate('pending_analyses', {
          userId: user.id,
          tokenAddress: token.tokenAddress,
          tokenData: JSON.stringify(token),
          status: 'pending',
        });
        console.log('✅ تم تخزين العملة في قاعدة البيانات');
      } catch (error) {
        console.error('❌ خطأ في تخزين العملة:', error);
      }
    }
    setPendingAnalysis({ token });
    window.location.href = '/ai';
  };

  const handleConsumePending = () => {
    setPendingAnalysis(null);
  };

  if (!user) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Sidebar>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/bots" element={<BotsManager />} />
          <Route path="/markets" element={<MarketsPage onAnalyzeToken={handleAnalyzeToken} />} />
          <Route path="/ai" element={<AIAnalysisPage pendingAnalysis={pendingAnalysis} onConsumePending={handleConsumePending} />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/my-wallet" element={<MyWalletPage />} />
          <Route path="/open-trades" element={<OpenTradesPage />} />
          <Route path="/manual-trades" element={<ManualTradesPage />} />
          <Route path="/scalper" element={<ScalperConfigPage />} />
          <Route path="/trade-history" element={<TradeHistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Sidebar>
    </BrowserRouter>
  );
}

// ============================================================
// 🚀 التطبيق الرئيسي
// ============================================================
function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;