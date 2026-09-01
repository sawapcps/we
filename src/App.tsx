// src/App.tsx
// ============================================================
// تطبيق MadarTech Trading System - يدعم 4 بوتات و 9 شبكات
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { madarCreate, generateId, getTimestamp } from './lib/madarTech';
import { AccountManager } from './lib/accounts';
import type { DiscoveredToken } from './types';
import type { BotInstanceData } from './lib/madarTech';

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
  Bell,
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
  Loader2,
  XCircle,
  FlaskConical,
  ShieldCheck,
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
// 🧠 مكون إدارة البوتات الأربعة (النسخة النهائية مع تحكم المسح)
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
    user,
    updateBotConfig,
    runManualScan,          // دالة المسح اليدوي
    startAutoScan,          // تشغيل المسح التلقائي
    stopAutoScan,           // إيقاف المسح التلقائي
    setScanInterval,        // تعيين الفاصل الزمني
    getAutoScanStatus,      // جلب الحالة الحالية
  } = useApp();

  // ============================================================
  // ✅ دالة مساعدة لاستخراج الشبكات من البوت
  // ============================================================
  const getBotNetworks = (bot: any): string[] => {
    if (!bot.networks) return ['solana'];
    if (typeof bot.networks === 'string') {
      try {
        const parsed = JSON.parse(bot.networks);
        return Array.isArray(parsed) ? parsed : ['solana'];
      } catch {
        return ['solana'];
      }
    }
    if (Array.isArray(bot.networks)) return bot.networks;
    return ['solana'];
  };

  // ============================================================
  // حالات المودال
  // ============================================================
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotInstanceData | null>(null);
  const [selectedType, setSelectedType] = useState<'hunter' | 'signal' | 'manual' | 'scalper'>('hunter');
  const [botName, setBotName] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('solana');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isTogglingPaper, setIsTogglingPaper] = useState(false);

  // ============================================================
  // ✅ حالات المسح (جديدة)
  // ============================================================
  const [isScanning, setIsScanning] = useState(false);
  const [scanIntervalInput, setScanIntervalInput] = useState<Record<string, string>>({});

  // ============================================================
  // ✅ حالات الإنشاء (لكل نوع بوت)
  // ============================================================
  const [createAmount, setCreateAmount] = useState(100);
  const [createTakeProfit, setCreateTakeProfit] = useState(30);
  const [createStopLoss, setCreateStopLoss] = useState(10);
  const [createMaxTrades, setCreateMaxTrades] = useState(5);
  const [createMinScore, setCreateMinScore] = useState(60);
  const [createSmartWallets, setCreateSmartWallets] = useState(3);
  const [createIndicatorType, setCreateIndicatorType] = useState('rsi');
  const [createRsiOversold, setCreateRsiOversold] = useState(30);
  const [createRsiOverbought, setCreateRsiOverbought] = useState(70);
  const [createBuyThreshold, setCreateBuyThreshold] = useState(-2);
  const [createTrailingStop, setCreateTrailingStop] = useState(0.5);
  const [createMinTradeInterval, setCreateMinTradeInterval] = useState(2);
  const [createDisplayAll, setCreateDisplayAll] = useState(false);
  const [createShowDetailed, setCreateShowDetailed] = useState(false);

  // ============================================================
  // حالات التعديل
  // ============================================================
  const [editAmount, setEditAmount] = useState(100);
  const [editTakeProfit, setEditTakeProfit] = useState(30);
  const [editStopLoss, setEditStopLoss] = useState(10);
  const [editNetwork, setEditNetwork] = useState('solana');
  const [editMaxTrades, setEditMaxTrades] = useState(5);
  const [editMinScore, setEditMinScore] = useState(60);

  // ============================================================
  // تحميل البوتات عند تغيير المستخدم
  // ============================================================
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 BotsManager: تحميل البوتات للمستخدم:', user.id);
      loadBotInstances(user.id);
    }
  }, [user?.id]);

  // ============================================================
  // تحديث القائمة
  // ============================================================
  const handleRefresh = async () => {
    if (!user?.id) {
      console.warn('⚠️ لا يوجد مستخدم');
      return;
    }
    setIsRefreshing(true);
    try {
      console.log('🔄 جاري تحديث قائمة البوتات...');
      await loadBotInstances(user.id);
      console.log('✅ تم تحديث قائمة البوتات، العدد:', botInstances.length);
      await addLog('SUCCESS', '🔄 تم تحديث قائمة البوتات');
    } catch (error) {
      console.error('❌ فشل تحديث البوتات:', error);
      await addLog('ERROR', `❌ فشل تحديث البوتات: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ============================================================
  // ✅ دالة مساعدة لإنشاء محفظة للبوت (مع التحقق من الوجود)
  // ============================================================
  const ensureWalletForBot = async (botId: string, network: string) => {
    if (!user?.id) return;
    try {
      const result = await createWalletForBot(botId, network, user.id);
      if (result.success) {
        console.log(`💰 تم إنشاء محفظة لـ ${network} تلقائياً`);
        return true;
      } else {
        if (result.error?.includes('already exists')) {
          console.log(`✅ محفظة ${network} موجودة بالفعل`);
          return true;
        }
        console.warn(`⚠️ فشل إنشاء محفظة ${network}:`, result.error);
        return false;
      }
    } catch (e) {
      console.warn(`⚠️ فشل إنشاء محفظة ${network}:`, e);
      return false;
    }
  };

  // ============================================================
  // ✅ إنشاء بوت جديد (مع إنشاء محفظة تلقائياً)
  // ============================================================
  const handleCreateBot = async () => {
    if (!botName.trim() || !user?.id) {
      await addLog('ERROR', '❌ اسم البوت أو المستخدم مفقود');
      return;
    }
    
    setIsCreating(true);
    try {
      console.log('🚀 بدء إنشاء البوت:', {
        type: selectedType,
        name: botName,
        userId: user.id,
        amount: createAmount,
      });
      
      const result = await createBot(selectedType, botName.trim(), user.id, createAmount);
      console.log('📦 نتيجة createBot:', result);
      
      if (!result.success || !result.botId) {
        throw new Error(result.error || 'فشل إنشاء البوت');
      }
      
      console.log('✅ تم إنشاء البوت بنجاح، ID:', result.botId);
      
      const config: any = {
        maxPositionSize: createAmount,
        takeProfit: createTakeProfit,
        stopLoss: createStopLoss,
        maxOpenTrades: createMaxTrades,
        networks: [selectedNetwork],
      };

      if (selectedType === 'hunter') {
        config.minScore = createMinScore;
        config.minSmartWallets = createSmartWallets;
      }
      if (selectedType === 'signal') {
        config.indicatorType = createIndicatorType;
        config.rsiOversold = createRsiOversold;
        config.rsiOverbought = createRsiOverbought;
      }
      if (selectedType === 'scalper') {
        config.buyThreshold = createBuyThreshold;
        config.trailingStop = createTrailingStop;
        config.minTradeInterval = createMinTradeInterval;
      }
      if (selectedType === 'manual') {
        config.displayAllCandidates = createDisplayAll;
        config.showDetailedAnalysis = createShowDetailed;
      }

      console.log('⚙️ جاري تحديث الإعدادات:', config);
      
      const updateResult = await updateBotConfig(result.botId, config, user.id);
      console.log('📦 نتيجة updateBotConfig:', updateResult);
      
      // ✅ إنشاء محفظة للشبكة المختارة تلقائياً
      await ensureWalletForBot(result.botId, selectedNetwork);
      
      console.log('🔄 جاري تحديث قائمة البوتات...');
      await loadBotInstances(user.id);
      console.log('✅ تم تحديث قائمة البوتات');
      
      setShowCreateModal(false);
      setBotName('');
      resetCreateForm();
      
      await addLog('SUCCESS', `✅ تم إنشاء البوت ${botName} (${selectedType}) بمبلغ $${createAmount}`);
      
    } catch (error) {
      console.error('❌ فشل إنشاء البوت:', error);
      await addLog('ERROR', `❌ فشل إنشاء البوت: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // ============================================================
  // إعادة تعيين نموذج الإنشاء
  // ============================================================
  const resetCreateForm = () => {
    setCreateAmount(100);
    setCreateTakeProfit(30);
    setCreateStopLoss(10);
    setCreateMaxTrades(5);
    setCreateMinScore(60);
    setCreateSmartWallets(3);
    setCreateIndicatorType('rsi');
    setCreateRsiOversold(30);
    setCreateRsiOverbought(70);
    setCreateBuyThreshold(-2);
    setCreateTrailingStop(0.5);
    setCreateMinTradeInterval(2);
    setCreateDisplayAll(false);
    setCreateShowDetailed(false);
  };

  // ============================================================
  // تشغيل البوت
  // ============================================================
  const handleStartBot = async (botId: string) => {
    if (!user?.id) {
      console.warn('⚠️ لا يوجد مستخدم');
      return;
    }
    setIsStarting(true);
    try {
      console.log('▶️ جاري تشغيل البوت:', botId);
      const result = await startBot(botId, user.id);
      console.log('📦 نتيجة startBot:', result);
      
      if (result.success) {
        await loadBotInstances(user.id);
        await addLog('SUCCESS', `▶️ تم تشغيل البوت`);
        console.log('✅ تم تشغيل البوت بنجاح');
      } else {
        await addLog('ERROR', `❌ فشل تشغيل البوت: ${result.message || 'خطأ غير معروف'}`);
        console.error('❌ فشل التشغيل:', result.message);
      }
    } catch (error) {
      console.error('❌ فشل تشغيل البوت:', error);
      await addLog('ERROR', `❌ فشل تشغيل البوت: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsStarting(false);
    }
  };

  // ============================================================
  // إيقاف البوت
  // ============================================================
  const handleStopBot = async (botId: string) => {
    if (!user?.id) {
      console.warn('⚠️ لا يوجد مستخدم');
      return;
    }
    setIsStopping(true);
    try {
      console.log('⏸️ جاري إيقاف البوت:', botId);
      const result = await stopBot(botId, user.id);
      console.log('📦 نتيجة stopBot:', result);
      
      if (result.success) {
        await loadBotInstances(user.id);
        await addLog('INFO', `⏸️ تم إيقاف البوت`);
        console.log('✅ تم إيقاف البوت بنجاح');
      } else {
        await addLog('ERROR', `❌ فشل إيقاف البوت: ${result.message || 'خطأ غير معروف'}`);
        console.error('❌ فشل الإيقاف:', result.message);
      }
    } catch (error) {
      console.error('❌ فشل إيقاف البوت:', error);
      await addLog('ERROR', `❌ فشل إيقاف البوت: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsStopping(false);
    }
  };

  // ============================================================
  // حذف البوت
  // ============================================================
  const handleDeleteBot = async (botId: string, botName: string) => {
    if (!user?.id) return;
    
    if (!window.confirm(`⚠️ هل أنت متأكد من حذف البوت "${botName}"؟\nسيتم حذف جميع البيانات المرتبطة به ولا يمكن التراجع.`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log('🗑️ جاري حذف البوت:', botId, botName);
      const result = await deleteBot(botId, user.id);
      console.log('📦 نتيجة deleteBot:', result);
      
      if (result.success) {
        await loadBotInstances(user.id);
        await addLog('SUCCESS', `🗑️ تم حذف البوت ${botName}`);
        console.log('✅ تم حذف البوت بنجاح');
      } else {
        await addLog('ERROR', `❌ فشل حذف البوت: ${result.message || 'خطأ غير معروف'}`);
        console.error('❌ فشل الحذف:', result.message);
      }
    } catch (error) {
      console.error('❌ فشل حذف البوت:', error);
      await addLog('ERROR', `❌ فشل حذف البوت: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================
  // فتح مودال التعديل
  // ============================================================
  const openEditModal = (bot: BotInstanceData) => {
    setSelectedBot(bot);
    try {
      const config = bot.config ? JSON.parse(bot.config) : {};
      setEditAmount(config.maxPositionSize || bot.max_position_size || 100);
      setEditTakeProfit(config.takeProfit || bot.take_profit || 30);
      setEditStopLoss(config.stopLoss || bot.stop_loss || 10);
      setEditMaxTrades(config.maxOpenTrades || 5);
      setEditMinScore(config.minScore || 60);
      
      try {
        const networks = bot.networks ? JSON.parse(bot.networks) : ['solana'];
        setEditNetwork(networks[0] || 'solana');
      } catch {
        setEditNetwork('solana');
      }
    } catch {
      setEditAmount(bot.max_position_size || 100);
      setEditTakeProfit(bot.take_profit || 30);
      setEditStopLoss(bot.stop_loss || 10);
      setEditMaxTrades(5);
      setEditMinScore(60);
      setEditNetwork('solana');
    }
    setShowEditModal(true);
  };

  // ============================================================
  // حفظ تعديلات البوت (مع إنشاء محافظ تلقائياً للشبكات الجديدة)
  // ============================================================
  const handleSaveEdit = async () => {
    if (!selectedBot || !user?.id) {
      await addLog('ERROR', '❌ لا يوجد بوت محدد أو مستخدم');
      return;
    }
    
    setIsSavingEdit(true);
    try {
      console.log('💾 جاري حفظ التعديلات للبوت:', selectedBot.id);
      
   const updatedConfig = {
    maxPositionSize: editAmount,
    max_position_size: editAmount,
    takeProfit: editTakeProfit,
    stopLoss: editStopLoss,
    maxOpenTrades: editMaxTrades,
    minScore: editMinScore,
    networks: [editNetwork],
};
      
      console.log('📦 الإعدادات الجديدة:', updatedConfig);
      
      const result = await updateBotConfig(selectedBot.id, updatedConfig, user.id);
      console.log('📦 نتيجة updateBotConfig:', result);
      
      if (result.success) {
        setShowEditModal(false);
        await addLog('SUCCESS', `✅ تم تحديث إعدادات البوت ${selectedBot.name}`);
        console.log('✅ تم حفظ التعديلات بنجاح');
        
        setTimeout(async () => {
          await loadBotInstances(user.id);
          console.log('🔄 تم إعادة تحميل البوتات');
        }, 500);
      } else {
        await addLog('ERROR', `❌ فشل تحديث الإعدادات: ${result.error}`);
        console.error('❌ فشل التحديث:', result.error);
      }
    } catch (error) {
      console.error('❌ فشل حفظ التعديلات:', error);
      await addLog('ERROR', `❌ فشل حفظ التعديلات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsSavingEdit(false);
    }
};

  // ============================================================
  // إنشاء محفظة للبوت (باستخدام الشبكة الأولى المختارة)
  // ============================================================
  const handleCreateWallet = async (botId: string) => {
    if (!user?.id) return;
    
    const bot = botInstances.find(b => b.id === botId);
    let network = 'solana';
    if (bot) {
      try {
        const networks = JSON.parse(bot.networks || '["solana"]');
        network = networks[0] || 'solana';
      } catch { network = 'solana'; }
    }
    
    try {
      const result = await createWalletForBot(botId, network, user.id);
      if (result.success) {
        await addLog('SUCCESS', `💰 تم إنشاء محفظة لـ ${network}`);
        await loadBotInstances(user.id);
      } else {
        await addLog('ERROR', `❌ فشل إنشاء المحفظة: ${result.error}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ فشل إنشاء المحفظة: ${error}`);
    }
  };

  // ============================================================
  // 🔄 تبديل وضع التداول (ورقي / حقيقي)
  // ============================================================
  const handleTogglePaperTrading = async (botId: string, currentMode: number) => {
    if (!user?.id) return;
    
    const newMode = currentMode === 1 ? 0 : 1;
    const modeText = newMode === 1 ? 'تجريبي (ورقي)' : 'حقيقي';
    const confirmMsg = `⚠️ هل أنت متأكد من تحويل البوت إلى الوضع ${modeText}؟\n${
      newMode === 1 
        ? 'سيتم استخدام رصيد وهمي للاختبار (لن يتم تنفيذ صفقات حقيقية).' 
        : 'سيتم تنفيذ صفقات حقيقية على البلوكتشين. تأكد من وجود رصيد كافٍ ومفاتيح API صحيحة.'
    }`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setIsTogglingPaper(true);
    try {
      console.log(`🔄 تحويل البوت ${botId} إلى الوضع ${modeText}`);
      const result = await updateBotConfig(botId, { paper_trading: newMode }, user.id);
      if (result.success) {
        await loadBotInstances(user.id);
        await addLog('SUCCESS', `🔄 تم تحويل البوت إلى الوضع ${modeText}`);
        console.log(`✅ تم التبديل إلى ${modeText}`);
      } else {
        await addLog('ERROR', `❌ فشل تبديل الوضع: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ فشل تبديل الوضع:', error);
      await addLog('ERROR', `❌ فشل تبديل الوضع: ${error}`);
    } finally {
      setIsTogglingPaper(false);
    }
  };

  // ============================================================
  // 🔄 مسح يدوي (جديد)
  // ============================================================
  const handleManualScan = async (botId: string) => {
    if (!user?.id) return;
    setIsScanning(true);
    try {
      const result = await runManualScan(botId);
      if (result.success) {
        await addLog('SUCCESS', result.message);
        await loadBotInstances(user.id);
      } else {
        await addLog('ERROR', result.message);
      }
    } catch (error) {
      await addLog('ERROR', `❌ فشل المسح: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // ============================================================
  // إغلاق جميع صفقات البوت
  // ============================================================
  const handleCloseAllTrades = async (botId: string, botName: string) => {
    if (!user?.id) return;
    
    if (!window.confirm(`⚠️ هل أنت متأكد من إغلاق جميع صفقات البوت "${botName}"؟\nسيتم إغلاقها بسعر السوق الحالي.`)) {
      return;
    }
    
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
      
      const tradesRes = await fetch(`${WORKER_URL}/open-trades?botId=${botId}&userId=${user.id}`);
      const tradesData = await tradesRes.json();
      
      if (!tradesData.success || !tradesData.data || tradesData.data.length === 0) {
        await addLog('INFO', `ℹ️ لا توجد صفقات مفتوحة للبوت ${botName}`);
        return;
      }
      
      const openTrades = tradesData.data;
      let closedCount = 0;
      let failedCount = 0;
      
      for (const trade of openTrades) {
        try {
          let closePrice = trade.price * 0.98;
          try {
            const dexRes = await fetch(`${WORKER_URL}/dex-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tokenAddress: trade.token_address, network: trade.network })
            });
            const dexData = await dexRes.json();
            if (dexData.success && dexData.data?.price) {
              closePrice = dexData.data.price;
            }
          } catch (e) {
            console.warn('⚠️ تعذر جلب السعر من DexScreener، استخدام سعر تقديري');
          }
          
          const pnl = (closePrice - trade.price) * (trade.amount / trade.price);
          const pnlPercent = ((closePrice - trade.price) / trade.price) * 100;
          
          const closeRes = await fetch(`${WORKER_URL}/close-trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tradeId: trade.id,
              closePrice: closePrice,
              pnl: pnl,
              pnlPercent: pnlPercent,
              closeReason: `Closed all trades for bot ${botName}`
            })
          });
          const closeData = await closeRes.json();
          if (closeData.success) {
            closedCount++;
          } else {
            failedCount++;
            console.error(`❌ فشل إغلاق الصفقة ${trade.id}:`, closeData.error);
          }
        } catch (err) {
          failedCount++;
          console.error(`❌ خطأ في إغلاق الصفقة ${trade.id}:`, err);
        }
      }
      
      if (failedCount === 0 && closedCount > 0) {
        await addLog('SUCCESS', `✅ تم إغلاق ${closedCount} صفقة للبوت ${botName}`);
      } else if (closedCount > 0 && failedCount > 0) {
        await addLog('WARNING', `⚠️ تم إغلاق ${closedCount} صفقة، وفشل ${failedCount} صفقة للبوت ${botName}`);
      } else {
        await addLog('ERROR', `❌ فشل إغلاق جميع الصفقات للبوت ${botName}`);
      }
      
      await loadBotInstances(user.id);
    } catch (error) {
      console.error('❌ فشل إغلاق الصفقات:', error);
      await addLog('ERROR', `❌ فشل إغلاق الصفقات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  // ============================================================
  // أنواع البوتات
  // ============================================================
  const BOT_TYPES = {
    hunter: {
      label: 'Hunter Alpha',
      icon: Target,
      color: 'text-[#10b981]',
      bg: 'bg-[#10b981]/10',
      desc: 'صائد العملات الجديدة والمحافظ الذكية',
      badge: 'صيد',
    },
    signal: {
      label: 'Signal Pro',
      icon: TrendingUp,
      color: 'text-[#3b82f6]',
      bg: 'bg-[#3b82f6]/10',
      desc: 'محلل الإشارات الفنية والزخم',
      badge: 'تحليل',
    },
    manual: {
      label: 'Manual Desk',
      icon: User,
      color: 'text-[#8b5cf6]',
      bg: 'bg-[#8b5cf6]/10',
      desc: 'لوحة تحكم يدوية متقدمة',
      badge: 'يدوي',
    },
    scalper: {
      label: 'Scalper X',
      icon: Zap,
      color: 'text-[#f97316]',
      bg: 'bg-[#f97316]/10',
      desc: 'تداول سريع على عملة محددة بصفقات متعددة',
      badge: 'سريع',
    },
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#10b981]" />
            البوتات الذكية
            <span className="text-sm font-normal text-[#64748b]">({botInstances.length})</span>
          </h2>
          <p className="text-sm text-[#64748b] mt-1">
            4 أنواع من البوتات، كل بوت يعمل على شبكة أو أكثر من 9 شبكات
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            بوت جديد
          </Button>
        </div>
      </div>

      {/* قائمة البوتات */}
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
            const botName = bot.name || 'بوت';
            const isPaperTrading = bot.paper_trading === 1;
            const autoStatus = getAutoScanStatus(bot.id);
            const intervalValue = scanIntervalInput[bot.id] || autoStatus.interval || 5;

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
                  <button
                    onClick={() => handleTogglePaperTrading(bot.id, bot.paper_trading ?? 1)}
                    disabled={isTogglingPaper}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                      isPaperTrading
                        ? 'bg-[#f59e0b]/20 text-[#f59e0b] hover:bg-[#f59e0b]/30'
                        : 'bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30'
                    }`}
                  >
                    {isPaperTrading ? '🧪 تجريبي' : '🔴 حقيقي'}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-[#0a0a0f]/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-[#64748b]">المبلغ</span>
                  <p className="text-white font-medium text-[10px]">
    ${(() => {
        try {
            const config = bot.config ? JSON.parse(bot.config) : {};
            return config.maxPositionSize || bot.max_position_size || 100;
        } catch {
            return bot.max_position_size || 100;
        }
    })()}
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

                {/* ============================================================
                    أزرار التحكم (مع إضافة أزرار المسح)
                ============================================================ */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-[#1e1e2f]">
                  {/* تشغيل / إيقاف */}
                  {isRunning ? (
                    <Button
                      size="sm"
                      variant="warning"
                      icon={<Pause className="w-3 h-3" />}
                      onClick={() => handleStopBot(bot.id)}
                      disabled={isStopping}
                    >
                      {isStopping ? 'جاري...' : 'إيقاف'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={bot.bot_type === 'scalper' ? 'scalper' : 'primary'}
                      icon={<Play className="w-3 h-3" />}
                      onClick={() => handleStartBot(bot.id)}
                      disabled={isStarting}
                    >
                      {isStarting ? 'جاري...' : 'تشغيل'}
                    </Button>
                  )}
                  
                  {/* محفظة */}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Wallet className="w-3 h-3" />}
                    onClick={() => handleCreateWallet(bot.id)}
                  >
                    محفظة
                  </Button>

                  {/* ✅ زر مسح يدوي */}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="w-3 h-3" />}
                    onClick={() => handleManualScan(bot.id)}
                    disabled={isScanning}
                  >
                    {isScanning ? 'جاري...' : 'مسح الآن'}
                  </Button>

                  {/* ✅ تحكم المسح التلقائي */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={intervalValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScanIntervalInput(prev => ({ ...prev, [bot.id]: val }));
                      }}
                      className="w-12 bg-[#0a0a0f] border border-[#1e1e2f] rounded-lg px-1 py-1 text-white text-xs text-center"
                    />
                    <span className="text-[10px] text-[#64748b]">دقيقة</span>
                    <Button
                      size="sm"
                      variant={autoStatus.active ? 'warning' : 'primary'}
                      onClick={() => {
                        const interval = parseInt(scanIntervalInput[bot.id]) || 5;
                        if (autoStatus.active) {
                          stopAutoScan(bot.id);
                        } else {
                          setScanInterval(bot.id, interval);
                          startAutoScan(bot.id);
                        }
                      }}
                    >
                      {autoStatus.active ? 'إيقاف المسح' : 'بدء التلقائي'}
                    </Button>
                  </div>

                  {/* تعديل */}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Settings className="w-3 h-3" />}
                    onClick={() => openEditModal(bot)}
                  >
                    تعديل
                  </Button>

                  {/* إغلاق الصفقات */}
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<XCircle className="w-3 h-3" />}
                    onClick={() => handleCloseAllTrades(bot.id, botName)}
                  >
                    إغلاق الصفقات
                  </Button>

                  {/* حذف */}
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="w-3 h-3" />}
                    onClick={() => handleDeleteBot(bot.id, botName)}
                    disabled={isDeleting}
                    className="ml-auto"
                  >
                    {isDeleting ? 'جاري...' : 'حذف'}
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ============================================================
          مودال إنشاء بوت (نفس الكود السابق)
      ============================================================ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#14141e] py-2">
              <h3 className="text-lg font-bold text-white">🚀 إنشاء بوت جديد</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#64748b] hover:text-white transition-colors"
              >
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
                        onClick={() => {
                          setSelectedType(key as any);
                          resetCreateForm();
                        }}
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
                <label className="text-sm text-[#94a3b8] block mb-1">🌐 الشبكة الافتراضية</label>
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
              </div>

              <div className="border-t border-[#1e1e2f] pt-4">
                <p className="text-xs text-[#64748b] mb-3">⚙️ الإعدادات المشتركة</p>
                
                <div className="grid grid-cols-2 gap-3">
                  
              <div>
    <label className="text-sm text-[#94a3b8] block mb-1">💰 المبلغ ($)</label>
                    <input
                        type="number"
                        value={createAmount}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateAmount(val);
                            }
                        }}
                        min="1"
                        step="10"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#94a3b8] block mb-1">📊 أقصى صفقات</label>
                    <input
                      type="number"
                      value={createMaxTrades}
                      onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val > 0) {
                              setCreateMaxTrades(val);
                          }
                      }}
                      min="1"
                      max="20"
                      dir="ltr"
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-sm text-[#94a3b8] block mb-1">📈 جني الربح (%)</label>
                    <input
                      type="number"
                      value={createTakeProfit}
                      onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val > 0) {
                              setCreateTakeProfit(val);
                          }
                      }}
                      min="1"
                      max="100"
                      step="0.5"
                      dir="ltr"
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#94a3b8] block mb-1">🛑 وقف الخسارة (%)</label>
                    <input
                      type="number"
                      value={createStopLoss}
                      onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val > 0) {
                              setCreateStopLoss(val);
                          }
                      }}
                      min="1"
                      max="50"
                      step="0.5"
                      dir="ltr"
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                    />
                  </div>
                </div>
              </div>

              {selectedType === 'hunter' && (
                <div className="border-t border-[#10b981]/20 pt-4 bg-[#10b981]/5 rounded-xl p-3">
                  <p className="text-xs text-[#10b981] mb-3">🎯 إعدادات Hunter Alpha</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">⭐ الحد الأدنى للنقاط</label>
                      <input
                        type="number"
                        value={createMinScore}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateMinScore(val);
                            }
                        }}
                        min="20"
                        max="90"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">👛 عدد المحافظ الذكية</label>
                      <input
                        type="number"
                        value={createSmartWallets}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateSmartWallets(val);
                            }
                        }}
                        min="1"
                        max="20"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#10b981] transition-colors text-sm text-left"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedType === 'signal' && (
                <div className="border-t border-[#3b82f6]/20 pt-4 bg-[#3b82f6]/5 rounded-xl p-3">
                  <p className="text-xs text-[#3b82f6] mb-3">📊 إعدادات Signal Pro</p>
                  <div>
                    <label className="text-sm text-[#94a3b8] block mb-1">📈 نوع المؤشر</label>
                    <select
                      value={createIndicatorType}
                      onChange={(e) => setCreateIndicatorType(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#3b82f6] transition-colors text-sm"
                    >
                      <option value="rsi">RSI</option>
                      <option value="stochastic">Stochastic</option>
                      <option value="macd">MACD</option>
                      <option value="combined">مدمج</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">🔻 RSI تشبع بيعي</label>
                      <input
                        type="number"
                        value={createRsiOversold}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateRsiOversold(val);
                            }
                        }}
                        min="10"
                        max="40"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#3b82f6] transition-colors text-sm text-left"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">🔺 RSI تشبع شرائي</label>
                      <input
                        type="number"
                        value={createRsiOverbought}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateRsiOverbought(val);
                            }
                        }}
                        min="60"
                        max="90"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#3b82f6] transition-colors text-sm text-left"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedType === 'scalper' && (
                <div className="border-t border-[#f97316]/20 pt-4 bg-[#f97316]/5 rounded-xl p-3">
                  <p className="text-xs text-[#f97316] mb-3">⚡ إعدادات Scalper X</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">📉 حد الشراء (%)</label>
                      <input
                        type="number"
                        value={createBuyThreshold}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val)) {
                                setCreateBuyThreshold(val);
                            }
                        }}
                        step="0.5"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#f97316] transition-colors text-sm text-left"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#94a3b8] block mb-1">🔄 وقف متحرك (%)</label>
                      <input
                        type="number"
                        value={createTrailingStop}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val) && val > 0) {
                                setCreateTrailingStop(val);
                            }
                        }}
                        step="0.1"
                        min="0.1"
                        max="10"
                        dir="ltr"
                        className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#f97316] transition-colors text-sm text-left"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-sm text-[#94a3b8] block mb-1">⏱️ الفاصل بين الصفقات (دقائق)</label>
                    <input
                      type="number"
                      value={createMinTradeInterval}
                      onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val) && val > 0) {
                              setCreateMinTradeInterval(val);
                          }
                      }}
                      min="1"
                      max="60"
                      dir="ltr"
                      className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#f97316] transition-colors text-sm text-left"
                    />
                  </div>
                </div>
              )}

              {selectedType === 'manual' && (
                <div className="border-t border-[#8b5cf6]/20 pt-4 bg-[#8b5cf6]/5 rounded-xl p-3">
                  <p className="text-xs text-[#8b5cf6] mb-3">🖐️ إعدادات Manual Desk</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createDisplayAll}
                      onChange={(e) => setCreateDisplayAll(e.target.checked)}
                      className="w-4 h-4 accent-[#8b5cf6]"
                    />
                    <span className="text-sm text-[#94a3b8]">عرض جميع المرشحين</span>
                  </label>
                  <label className="flex items-center gap-3 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createShowDetailed}
                      onChange={(e) => setCreateShowDetailed(e.target.checked)}
                      className="w-4 h-4 accent-[#8b5cf6]"
                    />
                    <span className="text-sm text-[#94a3b8]">تحليل مفصل</span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreateBot}
                  disabled={isCreating || !botName.trim()}
                >
                  {isCreating ? 'جاري الإنشاء...' : '🚀 إنشاء'}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          مودال تعديل البوت (نفس الكود السابق)
      ============================================================ */}
      {showEditModal && selectedBot && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#14141e] py-2">
              <h3 className="text-lg font-bold text-white">
                تعديل البوت: <span className="text-[#10b981]">{selectedBot.name}</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-[#64748b] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">🌐 الشبكة</label>
                <select
                  value={editNetwork}
                  onChange={(e) => setEditNetwork(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  {NETWORK_OPTIONS.map((net) => (
                    <option key={net.value} value={net.value}>
                      {net.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">💰 المبلغ ($)</label>
                <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val) && val > 0) {
                            setEditAmount(val);
                        }
                    }}
                    min="1"
                    step="10"
                    dir="ltr"
                    className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors text-left"
                />
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">📈 جني الربح (%)</label>
                <input
                  type="number"
                  value={editTakeProfit}
                  onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val > 0) {
                          setEditTakeProfit(val);
                      }
                  }}
                  min="1"
                  max="100"
                  step="0.5"
                  dir="ltr"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors text-left"
                />
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">🛑 وقف الخسارة (%)</label>
                <input
                  type="number"
                  value={editStopLoss}
                  onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val > 0) {
                          setEditStopLoss(val);
                      }
                  }}
                  min="1"
                  max="50"
                  step="0.5"
                  dir="ltr"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors text-left"
                />
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">📊 أقصى صفقات مفتوحة</label>
                <input
                  type="number"
                  value={editMaxTrades}
                  onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val > 0) {
                          setEditMaxTrades(val);
                      }
                  }}
                  min="1"
                  max="20"
                  dir="ltr"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors text-left"
                />
              </div>

              <div>
                <label className="text-sm text-[#94a3b8] block mb-1">⭐ الحد الأدنى للنقاط</label>
                <input
                  type="number"
                  value={editMinScore}
                  onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!isNaN(val) && val > 0) {
                          setEditMinScore(val);
                      }
                  }}
                  min="20"
                  max="90"
                  dir="ltr"
                  className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors text-left"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                                   {isSavingEdit ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowEditModal(false)}>
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
// 🧩 شريط التنقل الجانبي
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
    notifications,
  } = useApp();

  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (isWalletConnected && activeWallet) {
      getWalletBalance().then(setBalance).catch(() => setBalance(0));
    }
  }, [isWalletConnected, activeWallet]);

  if (!user) return <>{children}</>;
const isActive = (path: string) => location.pathname === path;

const navItems = [
    { path: '/notifications', label: 'الإشعارات', icon: Bell, badge: notifications.length },
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

          <div className="px-4 py-4 border-t border-[#1e1e2f] space-y-3">
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
<div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1e1e2f]/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user.email || 'مستخدم'}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${botInstances.some(b => b.status === 'running') ? 'text-[#10b981]' : 'text-[#64748b]'}`}>
                    {botInstances.some(b => b.status === 'running') ? `● ${botInstances.filter(b => b.status === 'running').length} بوتات تعمل` : '● البوتات متوقفة'}
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
// 🔔 مكون الإشعارات
// ============================================================
const Notifications: React.FC = () => {
    const { notifications, removeNotification } = useApp();
    const [showHistory, setShowHistory] = useState(false);
    
    if (notifications.length === 0) return null;
    
    const latestNotification = notifications[notifications.length - 1];
    
    return (
        <>
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-none">
                <div
                    className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-xl ${
                        latestNotification.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]' :
                        latestNotification.type === 'error' ? 'bg-[#ef4444]/20 border-[#ef4444]/40 text-[#ef4444]' :
                        latestNotification.type === 'warning' ? 'bg-[#f59e0b]/20 border-[#f59e0b]/40 text-[#f59e0b]' :
                        'bg-[#3b82f6]/20 border-[#3b82f6]/40 text-[#3b82f6]'
                    }`}
                >
                    <span className="text-sm font-medium">{latestNotification.message}</span>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-current opacity-50 hover:opacity-100"
                    >
                        <Bell className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => removeNotification(latestNotification.id)}
                        className="text-current opacity-50 hover:opacity-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {showHistory && (
                    <div className="pointer-events-auto mt-2 bg-[#14141e] border border-[#1e1e2f] rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                        <div className="p-3 border-b border-[#1e1e2f] flex justify-between items-center">
                            <span className="text-sm font-bold text-white">📋 سجل الإشعارات</span>
                            <button onClick={() => setShowHistory(false)} className="text-gray-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {notifications.slice().reverse().map(notification => (
                            <div
                                key={notification.id}
                                className={`flex items-start gap-2 px-4 py-2.5 border-b border-[#1e1e2f] last:border-b-0 ${
                                    notification.type === 'success' ? 'text-[#10b981]' :
                                    notification.type === 'error' ? 'text-[#ef4444]' :
                                    notification.type === 'warning' ? 'text-[#f59e0b]' :
                                    'text-[#3b82f6]'
                                }`}
                            >
                                <span className="text-xs mt-0.5">
                                    {notification.type === 'success' ? '✅' :
                                     notification.type === 'error' ? '❌' :
                                     notification.type === 'warning' ? '⚠️' : 'ℹ️'}
                                </span>
                                <div className="flex-1">
                                    <p className="text-xs font-medium">{notification.message}</p>
                                    <p className="text-[10px] text-gray-500">{notification.timestamp}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

const NotificationsPage: React.FC = () => {
    const { notifications, removeNotification, clearAllNotifications } = useApp();
    const [isClearing, setIsClearing] = useState(false);

    const handleClearAll = async () => {
        if (!window.confirm('⚠️ هل أنت متأكد من مسح جميع الإشعارات نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }
        setIsClearing(true);
        try {
            await clearAllNotifications();
        } catch (error) {
            console.error('❌ فشل المسح:', error);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Bell className="w-6 h-6 text-[#10b981]" />
                    الإشعارات
                    <span className="text-sm text-[#64748b]">({notifications.length})</span>
                </h2>
                {notifications.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        disabled={isClearing}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isClearing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        مسح الكل
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-12 text-[#64748b]">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>لا توجد إشعارات</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.slice().reverse().map(notification => (
                        <div
                            key={notification.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border ${
                                notification.type === 'success' ? 'bg-[#10b981]/10 border-[#10b981]/30' :
                                notification.type === 'error' ? 'bg-[#ef4444]/10 border-[#ef4444]/30' :
                                notification.type === 'warning' ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30' :
                                'bg-[#3b82f6]/10 border-[#3b82f6]/30'
                            }`}
                        >
                            <span className="text-lg">
                                {notification.type === 'success' ? '✅' :
                                 notification.type === 'error' ? '❌' :
                                 notification.type === 'warning' ? '⚠️' : 'ℹ️'}
                            </span>
                            <div className="flex-1">
                                <p className="text-sm text-white">{notification.message}</p>
                                <p className="text-xs text-[#64748b] mt-1">
                                    {new Date(notification.timestamp).toLocaleString('ar-EG')}
                                </p>
                            </div>
                            <button
                                onClick={() => removeNotification(notification.id)}
                                className="text-[#64748b] hover:text-[#ef4444]"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================
// 🚀 التطبيق الرئيسي (AppContent)
// ============================================================
function AppContent() {
  const { user, addNotification, notifications } = useApp();
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

  const notificationsRef = useRef(notifications);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

   const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) {
        console.debug('ℹ️ VITE_WORKER_URL غير موجود');
        return;
      }
      
      const response = await fetch(
        `${workerUrl}/notifications?app_id=hunter&userId=${user.id}`
      );
      
      if (!response.ok) {
        console.debug(`ℹ️ فشل جلب الإشعارات: ${response.status}`);
        return;
      }
      
      const text = await response.text();
      
      try {
        const data = JSON.parse(text);
        if (data.success && data.data) {
          data.data.forEach((notif: any) => {
            const exists = notificationsRef.current.some(n => n.id === notif.id);
            if (!exists) {
              addNotification(notif.type || 'info', notif.message);
            }
          });
        }
      } catch (e) {
        console.debug('ℹ️ استجابة غير JSON (طبيعي)');
      }
    } catch (error) {
      console.debug('ℹ️ فشل جلب الإشعارات (طبيعي)');
    }
  }, [user?.id, addNotification]);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id, fetchNotifications]);

  if (!user) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Notifications />
      <Sidebar>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
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
  console.log('🌐 VITE_WORKER_URL:', import.meta.env.VITE_WORKER_URL);

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;