// src/pages/BotControlPage.tsx
// ============================================================
// 🎮 واجهة التحكم في البوت - النسخة النهائية الكاملة
// ✅ تعتمد على بيانات حقيقية من الـ Worker
// ✅ تدعم التداول الحقيقي
// ✅ تعرض البوتات وإحصائياتها
// ✅ واجهة مستخدم متكاملة
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { NetworkSelector } from '../components/NetworkSelector';
import { TradingModeSelector } from '../components/TradingModeSelector';
import { generateId, getTimestamp } from '../lib/madarTech';
import { discoverAllPairs } from '../lib/discovery';
import { runBotAnalysis, getTopRecommendations } from '../lib/hunterEngine';
import type { DiscoveredToken, TokenPair } from '../types';
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Target,
  TrendingUp,
  BrainCircuit,
  Zap,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Settings,
  Trash2,
  Wallet,
  BarChart3,
  Sparkles,
  Globe,
  Shield,
  LayoutDashboard,
  TrendingDown,
  Users,
  DollarSign,
  Coins,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Link2,
  Unlink,
  History,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';

// ============================================================
// 🔗 Worker URL
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============================================================
// 🧩 مكونات مساعدة
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

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'scalper' | 'wallet' | 'outline';
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
    outline: 'bg-transparent border border-[#1e1e2f] hover:border-[#10b981]/30 text-[#94a3b8] hover:text-white',
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

const StatusBadge: React.FC<{ status: 'running' | 'paused' | 'stopped' }> = ({ status }) => {
  const config = {
    running: { label: 'يعمل', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', dot: 'bg-[#10b981] animate-pulse' },
    paused: { label: 'متوقف مؤقتاً', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', dot: 'bg-[#f59e0b]' },
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
// 📄 الصفحة الرئيسية
// ============================================================

export function BotControlPage() {
  const {
    botConfig,
    setBotConfig,
    addLog,
    trades,
    discoveredTokens,
    addDiscoveredToken,
    addTrade,
    isLoading,
    setIsLoading,
    isRunning,
    setIsRunning,
    updateBotState,
    refreshData,
    botInstances,
    loadBotInstances,
    createBot,
    startBot,
    stopBot,
    deleteBot,
    user,
  } = useApp();

  // ============================================================
  // 📊 الحالات
  // ============================================================

  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(() => {
    const saved = localStorage.getItem('selectedNetworks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    
    if (botConfig?.networks) {
      if (typeof botConfig.networks === 'string') {
        try {
          const parsed = JSON.parse(botConfig.networks);
          return Array.isArray(parsed) ? parsed : ['solana'];
        } catch {
          return ['solana'];
        }
      }
      if (Array.isArray(botConfig.networks)) {
        return botConfig.networks;
      }
    }
    return ['solana'];
  });
  
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>(botConfig?.mode || 'AUTO');
  const [scanCount, setScanCount] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [buySignals, setBuySignals] = useState<number>(0);
  const [scanning, setScanning] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [botName, setBotName] = useState('');
  const [botType, setBotType] = useState<'hunter' | 'signal' | 'manual' | 'scalper'>('hunter');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isRestarting = useRef(false);
  const isInitialLoad = useRef(true);

  // ============================================================
  // 🚀 تشغيل البوت
  // ============================================================

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: mode === 'AUTO' ? 'normal-bot' : 'manual',
          networks: selectedNetworks
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsRunning(true);
        localStorage.setItem('isRunning', JSON.stringify(true));
        
        await fetch(`${WORKER_URL}/networks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ networks: selectedNetworks }),
        });
        
        await addLog('SUCCESS', `✅ تم تشغيل البوت في وضع ${mode === 'AUTO' ? 'تلقائي' : 'يدوي'} على الشبكات: ${selectedNetworks.join(', ')}`);
        
        // ✅ تحديث البوتات
        if (user?.id) {
          await loadBotInstances(user.id);
        }
        
        setTimeout(() => performScan(), 1000);
      } else {
        await addLog('ERROR', `❌ فشل تشغيل البوت: ${data.message || data.error}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ خطأ: ${error instanceof Error ? error.message : 'غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // ⏹️ إيقاف البوت
  // ============================================================

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsRunning(false);
        localStorage.setItem('isRunning', JSON.stringify(false));
        await addLog('INFO', '⏹️ تم إيقاف البوت');
      } else {
        await addLog('ERROR', `❌ فشل إيقاف البوت: ${data.message || data.error}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ خطأ: ${error instanceof Error ? error.message : 'غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // 🔄 تشغيل/إيقاف
  // ============================================================

  const handleStartStop = async () => {
    if (isRunning) {
      await handleStop();
    } else {
      await handleStart();
    }
  };

  // ============================================================
  // 🔍 مسح حقيقي
  // ============================================================

  const performScan = useCallback(async () => {
    if (!isRunning || scanning) return;

    setScanning(true);
    setIsLoading(true);

    try {
      const networkList = Array.isArray(selectedNetworks) ? selectedNetworks : ['solana'];
      let totalDiscovered = 0;
      let totalBuySignals = 0;

      for (const network of networkList) {
        try {
          const result = await discoverAllPairs(network as any);
          
          if (result.error || result.pairs.length === 0) {
            await addLog('WARNING', `⚠️ لا توجد بيانات على ${network}`);
            continue;
          }

          const config = {
            botType: 'hunter' as const,
            minLiquidityUsd: 50000,
            minVolume24h: 100000,
            minScore: 50,
            maxPositionUsd: 1000,
            takeProfitPct: 20,
            stopLossPct: 10,
            networks: [network],
            minSmartWallets: 2,
            smartWalletConfidence: 60,
            allowNewListings: true,
            minBuyRatio: 0.55,
          };

          const analysis = await runBotAnalysis(result.pairs, network as any, config);

          for (const token of analysis.tokens) {
            await addDiscoveredToken({
              id: generateId(),
              tokenAddress: token.tokenAddress,
              network: token.chainId,
              name: token.name,
              symbol: token.symbol,
              price: token.priceUsd,
              liquidity: token.liquidityUsd,
              volume24h: token.volume24h,
              priceChange24h: token.priceChange.h24,
              age: token.pairAge || 0,
              score: token.score,
              status: token.status === 'candidate' ? 'ANALYZED' : 'REJECTED',
              discoveredAt: getTimestamp(),
            });
            totalDiscovered++;
          }

          const buyRecommendations = analysis.recommendations.filter(r => r.action === 'BUY');
          totalBuySignals += buyRecommendations.length;

          if (mode === 'AUTO' && buyRecommendations.length > 0) {
            const topTrades = buyRecommendations.slice(0, 3);
            for (const rec of topTrades) {
              const token = rec.token;
              const amount = Math.min(100, token.liquidityUsd * 0.01);
              
              await addTrade({
                id: generateId(),
                token: token.symbol,
                tokenAddress: token.tokenAddress,
                network: token.chainId,
                amount: amount,
                price: token.priceUsd,
                type: 'BUY',
                status: 'PENDING',
                timestamp: getTimestamp(),
                txHash: `pending_${generateId()}`,
              });
            }
            await addLog('SUCCESS', `✅ تم تنفيذ ${topTrades.length} صفقات في الوضع التلقائي على ${network}`);
          }

          if (mode === 'MANUAL' && buyRecommendations.length > 0) {
            await addLog('INFO', `📊 تم العثور على ${buyRecommendations.length} فرصة على ${network}. انتظر اختيارك.`);
          }

        } catch (error) {
          await addLog('ERROR', `❌ خطأ في مسح ${network}: ${error instanceof Error ? error.message : 'غير معروف'}`);
        }
      }

      setDiscoveredCount(totalDiscovered);
      setBuySignals(totalBuySignals);
      setScanCount(prev => prev + 1);
      setLastScan(new Date().toLocaleTimeString());

      await refreshData();

    } catch (error) {
      await addLog('ERROR', `❌ خطأ في المسح: ${error instanceof Error ? error.message : 'غير معروف'}`);
    } finally {
      setIsLoading(false);
      setScanning(false);
    }
  }, [isRunning, scanning, selectedNetworks, mode, addLog, addDiscoveredToken, addTrade, refreshData, setIsLoading]);

  // ============================================================
  // 📊 إنشاء بوت جديد
  // ============================================================

  const handleCreateBot = async () => {
    if (!user?.id) {
      await addLog('ERROR', '❌ يجب تسجيل الدخول أولاً');
      return;
    }

    if (!botName.trim()) {
      await addLog('ERROR', '❌ يرجى إدخال اسم البوت');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createBot(botType, botName.trim(), user.id, 100);
      
      if (result.success) {
        await addLog('SUCCESS', `✅ تم إنشاء البوت ${botName} (${botType}) بنجاح`);
        setShowCreateModal(false);
        setBotName('');
        
        if (user.id) {
          await loadBotInstances(user.id);
        }
      } else {
        await addLog('ERROR', `❌ فشل إنشاء البوت: ${result.error}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ فشل إنشاء البوت: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  // ============================================================
  // 🔄 تأثيرات (useEffect)
  // ============================================================

  useEffect(() => {
    localStorage.setItem('isRunning', JSON.stringify(isRunning));
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('selectedNetworks', JSON.stringify(selectedNetworks));
  }, [selectedNetworks]);

  useEffect(() => {
    if (botConfig) {
      setBotConfig({
        ...botConfig,
        networks: selectedNetworks,
        mode: mode,
      });
    }
  }, [selectedNetworks, mode, botConfig, setBotConfig]);

  useEffect(() => {
    const savedNetworks = localStorage.getItem('selectedNetworks');
    if (savedNetworks) {
      try {
        const parsed = JSON.parse(savedNetworks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedNetworks(parsed);
          return;
        }
      } catch (e) {}
    }
    
    if (botConfig?.networks) {
      let networks: string[] = ['solana'];
      if (typeof botConfig.networks === 'string') {
        try {
          networks = JSON.parse(botConfig.networks);
        } catch {
          networks = ['solana'];
        }
      } else if (Array.isArray(botConfig.networks)) {
        networks = botConfig.networks;
      }
      setSelectedNetworks(networks);
      localStorage.setItem('selectedNetworks', JSON.stringify(networks));
    }
  }, [botConfig]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/status`);
        const data = await res.json();
        setIsRunning(data.isRunning);
        localStorage.setItem('isRunning', JSON.stringify(data.isRunning));
        if (data.isRunning) {
          await addLog('INFO', '✅ البوت يعمل بالفعل (تم استعادة الحالة)');
          if (data.networks && data.networks.length > 0) {
            setSelectedNetworks(data.networks);
            localStorage.setItem('selectedNetworks', JSON.stringify(data.networks));
          }
          setTimeout(() => performScan(), 1000);
        }
      } catch (error) {
        console.error('❌ فشل جلب حالة البوت:', error);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadBotInstances(user.id);
    }
  }, [user?.id, loadBotInstances]);

  useEffect(() => {
    if (isRunning && botConfig && !isRestarting.current && !isInitialLoad.current) {
      isRestarting.current = true;
      const restartBot = async () => {
        await fetch(`${WORKER_URL}/stop`, { method: 'POST' });
        
        setBotConfig({
          ...botConfig,
          networks: selectedNetworks,
        });
        
        await fetch(`${WORKER_URL}/networks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ networks: selectedNetworks }),
        });
        
        setTimeout(async () => {
          const res = await fetch(`${WORKER_URL}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              mode: mode === 'AUTO' ? 'normal-bot' : 'manual',
              networks: selectedNetworks 
            }),
          });
          const data = await res.json();
          if (data.success) {
            setIsRunning(true);
            await addLog('SUCCESS', `🔄 تم إعادة تشغيل البوت على الشبكات: ${selectedNetworks.join(', ')}`);
            setTimeout(() => performScan(), 1000);
          }
          setTimeout(() => {
            isRestarting.current = false;
          }, 2000);
        }, 1500);
      };
      restartBot();
    }
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  }, [selectedNetworks, mode, isRunning, botConfig, setBotConfig, addLog, performScan, setIsRunning]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(performScan, 300000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, mode, selectedNetworks, performScan]);

  // ============================================================
  // 🎨 العرض
  // ============================================================

  // أنواع البوتات
  const BOT_TYPES = {
    hunter: { label: 'Hunter Alpha', icon: Target, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
    signal: { label: 'Signal Pro', icon: TrendingUp, color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10' },
    manual: { label: 'Manual Desk', icon: Activity, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10' },
    scalper: { label: 'Scalper X', icon: Zap, color: 'text-[#f97316]', bg: 'bg-[#f97316]/10' },
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* ✅ Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#10b981]" />
            🤖 التحكم في البوتات
            <span className="text-sm font-normal text-[#64748b]">({botInstances?.length || 0})</span>
          </h1>
          <p className="text-sm text-[#64748b] mt-1">تحكم في إعدادات البوتات وشغلها أو أوقفها</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              if (user?.id) {
                loadBotInstances(user.id).finally(() => setIsRefreshing(false));
              }
            }}
            disabled={isRefreshing}
            icon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            إنشاء بوت
          </Button>
        </div>
      </div>

      {/* ✅ حالة البوت الرئيسي */}
      <GlassCard className={`p-4 border ${isRunning ? 'border-[#10b981]/30 bg-[#10b981]/5' : 'border-[#64748b]/30 bg-[#64748b]/5'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isRunning ? 'bg-[#10b981]/20' : 'bg-[#64748b]/20'}`}>
              {isRunning ? <Play className="w-5 h-5 text-[#10b981]" /> : <Pause className="w-5 h-5 text-[#64748b]" />}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {isRunning ? '🟢 البوت يعمل' : '🔴 البوت متوقف'}
              </p>
              <p className="text-xs text-[#64748b]">
                {isRunning ? `يعمل في وضع ${mode === 'AUTO' ? 'تلقائي' : 'يدوي'}` : 'اضغط "تشغيل" لبدء التداول'}
              </p>
            </div>
          </div>
          <Button
            variant={isRunning ? 'warning' : 'primary'}
            size="sm"
            onClick={handleStartStop}
            disabled={isLoading}
            icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isLoading ? 'جاري...' : isRunning ? 'إيقاف' : 'تشغيل'}
          </Button>
        </div>
      </GlassCard>

      {/* ✅ إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Activity className="w-4 h-4" />
            <span className="text-xs">عدد المسحات</span>
          </div>
          <div className="text-2xl font-bold text-white">{scanCount}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Coins className="w-4 h-4" />
            <span className="text-xs">عملات مكتشفة</span>
          </div>
          <div className="text-2xl font-bold text-[#10b981]">{discoveredCount}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">إشارات شراء</span>
          </div>
          <div className="text-2xl font-bold text-[#3b82f6]">{buySignals}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs">صفقات منفذة</span>
          </div>
          <div className="text-2xl font-bold text-[#f59e0b]">{trades?.filter(t => t.status === 'EXECUTED').length || 0}</div>
        </GlassCard>
      </div>

      {/* ✅ زر مسح يدوي */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={performScan}
          disabled={scanning || !isRunning}
          icon={scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        >
          {scanning ? 'جاري المسح...' : '🔍 مسح الآن'}
        </Button>
      </div>

      {/* ✅ اختيار الشبكات */}
      <GlassCard className="p-4">
        <NetworkSelector
          selectedNetworks={selectedNetworks}
          onNetworkChange={setSelectedNetworks}
        />
      </GlassCard>

      {/* ✅ وضع التداول */}
      <GlassCard className="p-4">
        <TradingModeSelector
          mode={mode}
          onModeChange={setMode}
          isRunning={isRunning}
          onStartStop={handleStartStop}
          disabled={isLoading}
        />
      </GlassCard>

      {/* ✅ عرض البوتات */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#10b981]" />
          البوتات
        </h2>
        <div className="space-y-3">
          {botInstances?.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Bot className="w-12 h-12 text-[#64748b] mx-auto mb-3 opacity-50" />
              <p className="text-[#94a3b8] text-sm">لا توجد بوتات</p>
              <p className="text-[#64748b] text-xs mt-1">أنشئ بوتك الأول من الأعلى</p>
            </GlassCard>
          ) : (
            botInstances?.map((bot) => {
              const typeInfo = BOT_TYPES[bot.bot_type as keyof typeof BOT_TYPES] || BOT_TYPES.hunter;
              const Icon = typeInfo.icon;
              const isRunning = bot.status === 'running';
              
              return (
                <GlassCard key={bot.id} hover className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${typeInfo.bg}`}>
                        <Icon className={`w-5 h-5 ${typeInfo.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-white">{bot.name}</p>
                        <p className="text-xs text-[#64748b]">{typeInfo.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={bot.status} />
                      <div className="flex gap-1">
                        {isRunning ? (
                          <Button
                            size="sm"
                            variant="warning"
                            icon={<Pause className="w-3 h-3" />}
                            onClick={() => stopBot(bot.id, user?.id)}
                          >
                            إيقاف
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Play className="w-3 h-3" />}
                            onClick={() => startBot(bot.id, user?.id)}
                          >
                            تشغيل
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 className="w-3 h-3" />}
                          onClick={() => deleteBot(bot.id, user?.id)}
                        >
                          حذف
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#0a0a0f]/60 rounded-lg px-3 py-2">
                      <span className="text-[#64748b]">P&L</span>
                      <p className={`font-medium ${(bot.today_pnl || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {(bot.today_pnl || 0) >= 0 ? '+' : ''}{(bot.today_pnl || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f]/60 rounded-lg px-3 py-2">
                      <span className="text-[#64748b]">صفقات</span>
                      <p className="font-medium text-white">{bot.total_trades || 0}</p>
                    </div>
                    <div className="bg-[#0a0a0f]/60 rounded-lg px-3 py-2">
                      <span className="text-[#64748b]">الشبكة</span>
                      <p className="font-medium text-white truncate">
                        {bot.networks ? JSON.parse(bot.networks)[0] || 'solana' : 'solana'}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>
      </div>

      {/* ✅ آخر مسح */}
      {lastScan && (
        <div className="text-sm text-[#64748b] text-center">
          ⏱️ آخر مسح: {lastScan}
        </div>
      )}

      {/* ✅ آخر الصفقات */}
      {trades && trades.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="font-medium text-white mb-3">📊 آخر الصفقات</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trades.slice(0, 5).map(trade => (
              <div key={trade.id} className="flex items-center justify-between text-sm p-2 bg-[#0a0a0f]/60 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={trade.type === 'BUY' ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                    {trade.type === 'BUY' ? '📈' : '📉'}
                  </span>
                  <span className="font-medium text-white">{trade.token}</span>
                  <span className="text-[#64748b] text-xs">{trade.network}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white">${trade.amount?.toFixed(2) || '0'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    trade.status === 'EXECUTED' ? 'bg-[#10b981]/20 text-[#10b981]' :
                    trade.status === 'FAILED' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                    'bg-[#f59e0b]/20 text-[#f59e0b]'
                  }`}>
                    {trade.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ✅ حالة التحميل */}
      {isLoading && (
        <div className="text-center text-sm text-[#64748b]">
          ⏳ جاري التحميل...
        </div>
      )}

      {/* ✅ نافذة إنشاء بوت جديد */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">إنشاء بوت جديد</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#64748b] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
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
                <label className="text-sm text-[#94a3b8] block mb-2">نوع البوت</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BOT_TYPES).map(([key, value]) => {
                    const Icon = value.icon;
                    const isSelected = botType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setBotType(key as any)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          isSelected
                            ? `border-[#10b981] bg-[#10b981]/10`
                            : 'border-[#1e1e2f] hover:border-[#64748b]'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-[#10b981]' : 'text-[#64748b]'}`} />
                        <span className={`text-xs ${isSelected ? 'text-white' : 'text-[#64748b]'}`}>{value.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleCreateBot}
                  disabled={isCreating || !botName.trim()}
                >
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
}

export default BotControlPage;