// src/pages/WalletPage.tsx
// ============================================================
// 💰 محفظة البوت المركزية - تدير أموال جميع المستخدمين
// ✅ تظهر محافظ المستخدمين العاديين
// ✅ معمارية سحب صحيحة
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { BotWalletManager, BotWalletData } from "../lib/wallet";
import { AccountManager, UserWallet } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { 
  Copy, Check, Key, Eye, EyeOff, Coins, Loader2, RefreshCw, 
  Users, DollarSign, TrendingUp, Shield, Wallet, ChevronDown, 
  ChevronRight, Sparkles, BarChart3, Activity, Zap,
  Globe, Link2, Unlink, Clock, ArrowUpRight
} from "lucide-react";
import { NETWORKS, getNetworkName, getNetworkColor, getNetworkIcon } from "../config/networks";

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
// 🧩 مكون عرض خزانة المدير
// ============================================================
const AdminTreasuryCard: React.FC = () => {
  const { user, addLog } = useApp();
  const [treasuryStats, setTreasuryStats] = useState<{
    totalCollected: number;
    currentBalance: number;
    totalTrades: number;
    averageCommission: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadTreasury = async () => {
    if (!user?.isAdmin) return;
    setIsLoading(true);
    try {
      const stats = await AccountManager.getTreasuryStats();
      setTreasuryStats(stats);
    } catch (error) {
      console.error('❌ فشل جلب خزانة المدير:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      loadTreasury();
    }
  }, [user?.isAdmin]);

  if (!user?.isAdmin || !treasuryStats) return null;

  return (
    <GlassCard className="p-5 border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-400 flex items-center gap-2">
              👑 خزانة المدير
            </h3>
            <p className="text-xs text-gray-400">العمولات المجمعة من جميع الصفقات</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={loadTreasury} disabled={isLoading} icon={<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />}>
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-[#0a0a0f]/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">إجمالي العمولات</p>
          <p className="text-lg font-bold text-amber-400">${treasuryStats.totalCollected.toFixed(2)}</p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">الرصيد الحالي</p>
          <p className="text-lg font-bold text-emerald-400">${treasuryStats.currentBalance.toFixed(2)}</p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">عدد الصفقات</p>
          <p className="text-lg font-bold text-blue-400">{treasuryStats.totalTrades}</p>
        </div>
        <div className="bg-[#0a0a0f]/60 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400">متوسط العمولة</p>
          <p className="text-lg font-bold text-purple-400">${treasuryStats.averageCommission.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="warning" size="sm" icon={<ArrowUpRight className="w-3 h-3" />}>
          💸 سحب من الخزانة
        </Button>
        <Button variant="secondary" size="sm" icon={<BarChart3 className="w-3 h-3" />}>
          📊 تقرير مفصل
        </Button>
      </div>
    </GlassCard>
  );
};

// ============================================================
// 📄 الصفحة الرئيسية
// ============================================================

export function WalletPage() {
  const { 
    addLog, 
    botWallets, 
    loadBotWallets, 
    refreshBotBalance, 
    user, 
    transferFromBot, 
    loadUserWallets,
    userWallets,  // ✅ تأكد من وجودها
    loadUserWalletsForce, // ✅ دالة إعادة التحميل الإجبارية
  } = useApp();
  
  const [wallets, setWallets] = useState<(BotWalletData | UserWallet)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const hasLoaded = useRef(false);
  const isLoadingData = useRef(false);

  // ============================================================
  // ✅ دالة تحميل البيانات المحسنة
  // ============================================================
  
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    if (isLoadingData.current && !forceRefresh) {
      console.log("⏳ جاري التحميل بالفعل، تخطي...");
      return;
    }
    
    isLoadingData.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 جاري تحميل محافظ البوت${forceRefresh ? ' (إجباري)' : ''}...`);
      
      let allWallets: (BotWalletData | UserWallet)[] = [];
      
      // ✅ 1. تحميل محافظ البوت (للأدمن)
      await loadBotWallets();
      const botWallet = BotWalletManager.getInstance();
      const botWalletsList = botWallet.getAllWallets();
      
      // ✅ 2. تحميل محافظ المستخدمين
      let userWalletsList: UserWallet[] = [];
      
      if (user) {
        if (forceRefresh || !userWallets || userWallets.length === 0) {
          // ✅ إذا كان forceRefresh = true، استخدم الدالة الإجبارية
          if (loadUserWalletsForce) {
            userWalletsList = await loadUserWalletsForce();
          } else {
            await loadUserWallets();
            userWalletsList = userWallets || [];
          }
        } else {
          userWalletsList = userWallets;
        }
      }
      
      console.log(`📊 محافظ البوت: ${botWalletsList.length}`);
      console.log(`📊 محافظ المستخدم: ${userWalletsList.length}`);
      
      // ✅ 3. دمج المحافظ حسب صلاحية المستخدم
      if (user?.isAdmin) {
        // ✅ الأدمن يرى كل شيء: محافظ البوت + محافظ المستخدمين
        allWallets = [...botWalletsList, ...userWalletsList];
        console.log(`👑 الأدمن يرى ${allWallets.length} محفظة (${botWalletsList.length} بوت + ${userWalletsList.length} مستخدم)`);
      } else if (user) {
        // ✅ المستخدم العادي يرى محافظه فقط (محافظ البوت الخاصة به)
        // ✅ نأخذ محافظ المستخدم من userWallets
        allWallets = userWalletsList;
        console.log(`👤 المستخدم يرى ${allWallets.length} محفظة`);
      } else {
        // ✅ لا يوجد مستخدم
        allWallets = botWalletsList;
        console.log(`👤 لا يوجد مستخدم، عرض محافظ البوت فقط (${allWallets.length})`);
      }
      
      // ✅ 4. إزالة المكررات (حسب الشبكة)
      const uniqueWallets = allWallets.reduce((acc, current) => {
        const network = (current as any).network;
        const exists = acc.find(item => (item as any).network === network);
        if (!exists) {
          acc.push(current);
        } else {
          // ✅ إذا كان هناك مكرر، احتفظ بالأحدث
          const existingIndex = acc.indexOf(exists);
          const currentDate = new Date((current as any).created_at || (current as any).createdAt || 0);
          const existsDate = new Date((exists as any).created_at || (exists as any).createdAt || 0);
          if (currentDate > existsDate) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      }, [] as (BotWalletData | UserWallet)[]);
      
      setWallets(uniqueWallets);
      
      // ✅ 5. حساب إجمالي الرصيد
      const total = uniqueWallets.reduce((sum, w) => sum + ((w as any).balance || 0), 0);
      setTotalBalance(total);
      
      // ✅ 6. جلب إحصائيات النظام
      const stats = await AccountManager.getSystemStats();
      setSystemStats(stats);
      
      console.log(`✅ تم تحميل ${uniqueWallets.length} محفظة`);
      console.log(`💰 إجمالي الرصيد: $${total.toFixed(2)}`);
      
      // ✅ عرض تفاصيل المحافظ للتصحيح
      uniqueWallets.forEach(w => {
        const network = (w as any).network;
        const address = (w as any).address;
        const balance = (w as any).balance || 0;
        const type = (w as any).bot_id ? 'بوت' : 'مستخدم';
        console.log(`  - ${type}: ${network} | ${address?.slice(0, 8)}... ($${balance})`);
      });
      
    } catch (error) {
      console.error("❌ خطأ في تحميل البيانات:", error);
      setError("❌ فشل تحميل المحافظ");
    } finally {
      setIsLoading(false);
      isLoadingData.current = false;
    }
  }, [user, loadBotWallets, loadUserWallets, loadUserWalletsForce, userWallets]);

  // ============================================================
  // ✅ تحميل عند تغيير المستخدم
  // ============================================================
  
  useEffect(() => {
    if (!hasLoaded.current || user) {
      hasLoaded.current = true;
      loadData(true);
    }
  }, [user?.id, loadData]);

  // ============================================================
  // ✅ تحديث الرصيد
  // ============================================================
  
  const refreshBalance = async (network: string) => {
    setIsLoading(true);
    try {
      const newBalance = await refreshBotBalance(network);
      addLog("SUCCESS", `✅ تم تحديث رصيد ${network}: $${newBalance.toFixed(2)}`);
      await loadData(true);
    } catch (error) {
      addLog("ERROR", `❌ فشل تحديث الرصيد: ${String(error)}`);
      setError("❌ فشل تحديث الرصيد");
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // ✅ دالة سحب من البوت إلى المستخدم (معمارية صحيحة)
  // ============================================================
  
  const handleTransferFromBot = async (wallet: BotWalletData | UserWallet) => {
    if (!user) {
      setError("❌ الرجاء تسجيل الدخول أولاً");
      return;
    }

    const balance = (wallet as any).balance || 0;
    const network = (wallet as any).network;
    const address = (wallet as any).address;
    
    if (balance <= 0) {
      setError("❌ الرصيد صفر. لا يمكن السحب");
      return;
    }

    const amount = prompt(`💰 أدخل المبلغ المراد سحبه من البوت\nالرصيد المتاح: $${balance.toFixed(2)}\nالشبكة: ${getNetworkName(network)}`);
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("❌ مبلغ غير صحيح");
      return;
    }
    
    if (numAmount > balance) {
      setError(`❌ الرصيد غير كافٍ. المتاح: $${balance.toFixed(2)}`);
      return;
    }
    
    try {
      // ✅ الحصول على bot_id من المحفظة
      let botId = (wallet as any).bot_id || (wallet as any).id;
      
      // ✅ إذا كانت محفظة مستخدم، نحتاج إلى إيجاد البوت المرتبط
      if (!botId) {
        // ✅ محاولة إيجاد البوت من bot_instances
        const botResult = await AccountManager.getUserBots(user.id);
        if (botResult && botResult.length > 0) {
          botId = botResult[0].id;
        } else {
          setError("❌ لا يوجد بوت مرتبط بهذه المحفظة");
          return;
        }
      }

      console.log(`🔄 جاري سحب ${numAmount} من البوت ${botId} على ${network}`);
      
      const result = await transferFromBot(botId, numAmount, network);
      
      if (result.success) {
        setSuccess(result.message || `✅ تم سحب $${numAmount.toFixed(2)} من البوت بنجاح`);
        await loadData(true);
        await loadUserWallets();
        addLog("SUCCESS", `✅ سحب $${numAmount.toFixed(2)} من البوت إلى المستخدم على ${getNetworkName(network)}`);
      } else {
        setError(result.message || "❌ فشل السحب");
      }
    } catch (error) {
      console.error("❌ فشل السحب:", error);
      setError(`❌ فشل السحب: ${error}`);
    }
  };

  // ============================================================
  // ✅ دوال مساعدة
  // ============================================================
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePrivateKey = (network: string) => {
    setShowPrivateKey(showPrivateKey === network ? null : network);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const totalProfit = systemStats?.totalProfit || 0;
  const totalFees = systemStats?.totalFees || 0;
  const totalUsers = systemStats?.totalUsers || 0;

  // ============================================================
  // 📄 العرض
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#10b981]" />
          💰 محفظة البوت
        </h1>
        <p className="text-sm text-[#64748b] mt-1">
          المحفظة المركزية للبوت - تدير أموال جميع المستخدمين
        </p>
        {user && !user.isAdmin && (
          <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            👤 تعرض محافظك الشخصية فقط
          </p>
        )}
        {user?.isAdmin && (
          <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            👑 عرض جميع المحافظ (بوت + مستخدمين)
          </p>
        )}
      </div>

      {/* رسائل الخطأ والنجاح */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-400 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 flex items-start gap-3">
          <span className="text-emerald-400 text-sm flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300 text-sm">✕</button>
        </div>
      )}

      {/* 👑 خزانة المدير */}
      <AdminTreasuryCard />

      {/* نظام الأرباح */}
      <GlassCard glow className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#10b981]/10 rounded-xl">
            <Shield className="w-6 h-6 text-[#10b981]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-lg">نظام الأرباح: 85% لك / 15% للخزانة</h3>
            <p className="text-sm text-[#94a3b8]">
              عند تحقيق أرباح، تحصل على <span className="text-[#10b981] font-bold">85%</span> من الربح، 
              و<span className="text-[#f59e0b] font-bold">15%</span> تذهب لتطوير البوت والمنصة
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#10b981]">85%</div>
            <div className="text-xs text-[#64748b]">صافي الربح</div>
          </div>
        </div>
      </GlassCard>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Users className="w-4 h-4" />
            <span className="text-xs">المستخدمين</span>
          </div>
          <div className="text-2xl font-bold text-white">{totalUsers}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">إجمالي الرصيد</span>
          </div>
          <div className="text-2xl font-bold text-[#10b981]">${totalBalance.toFixed(2)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">إجمالي الأرباح</span>
          </div>
          <div className="text-2xl font-bold text-[#3b82f6]">${totalProfit.toFixed(2)}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 text-[#64748b]">
            <Coins className="w-4 h-4" />
            <span className="text-xs">إجمالي العمولات</span>
          </div>
          <div className="text-2xl font-bold text-[#f59e0b]">${totalFees.toFixed(2)}</div>
        </GlassCard>
      </div>

      {/* إجمالي الرصيد */}
      <GlassCard glow className="p-6 bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 border-[#10b981]/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#94a3b8]">إجمالي رصيد المحافظ</p>
            <p className="text-3xl font-bold text-white">${totalBalance.toFixed(2)}</p>
            <p className="text-xs text-[#64748b] mt-1 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {wallets.length} محافظ نشطة
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isLoading}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            {isLoading ? 'جاري التحديث...' : 'تحديث الكل'}
          </Button>
        </div>
      </GlassCard>

      {/* جميع المحافظ */}
      <div className="space-y-3">
        {isLoading && wallets.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
            <span className="text-[#64748b] ml-3">جاري تحميل المحافظ...</span>
          </div>
        ) : wallets.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <Wallet className="w-12 h-12 text-[#64748b] mx-auto mb-4 opacity-50" />
            <p className="text-[#94a3b8] text-sm">لا توجد محافظ بعد</p>
            <p className="text-[#64748b] text-xs mt-1">سيتم إنشاء المحافظ تلقائياً عند إنشاء المستخدمين</p>
          </GlassCard>
        ) : (
          wallets.map((wallet) => {
            const isExpanded = expandedWallet === (wallet as any).network;
            const showKey = showPrivateKey === (wallet as any).network;
            const network = (wallet as any).network;
            const address = (wallet as any).address;
            const balance = (wallet as any).balance || 0;
            const createdAt = (wallet as any).created_at || (wallet as any).createdAt;
            const botId = (wallet as any).bot_id || (wallet as any).id;
            const isBotWallet = !!(wallet as any).bot_id;
            
            const networkInfo = NETWORKS.find(n => n.id === network);
            const icon = networkInfo?.icon || getNetworkIcon(network);
            const name = networkInfo?.name || getNetworkName(network);
            const color = networkInfo?.color || '#64748b';

            return (
              <GlassCard key={`${network}-${address?.slice(0, 10) || Date.now()}`} hover className="overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1e1e2f]/50 transition-colors"
                  onClick={() => setExpandedWallet(isExpanded ? null : network)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" 
                      style={{ backgroundColor: `${color}20` }}
                    >
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{name}</p>
                        {isBotWallet ? (
                          <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">بوت</span>
                        ) : (
                          <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">مستخدم</span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-[#10b981]">{formatUsd(balance)}</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                        {address?.slice(0, 8)}...{address?.slice(-6) || ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* ✅ زر سحب من البوت (للمستخدمين فقط) */}
                    {user && balance > 0 && isBotWallet && (
                      <Button
                        size="sm"
                        variant="wallet"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTransferFromBot(wallet);
                        }}
                        icon={<ArrowUpRight className="w-3 h-3" />}
                      >
                        سحب
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshBalance(network);
                      }}
                      disabled={isLoading}
                      icon={<RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />}
                    >
                      تحديث
                    </Button>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-[#64748b]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[#64748b]" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-[#1e1e2f] bg-[#0a0a0f]/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-[#64748b]">عنوان المحفظة</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-mono text-white truncate">{address}</p>
                          <button
                            onClick={() => handleCopy(address)}
                            className="p-1 hover:bg-[#1e1e2f] rounded transition-colors"
                          >
                            {copied ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4 text-[#64748b]" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748b]">الشبكة</p>
                        <p className="text-sm font-medium text-white mt-1 flex items-center gap-2">
                          <span>{icon}</span>
                          {name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748b]">الرصيد</p>
                        <p className="text-sm font-bold text-[#10b981] mt-1">{formatUsd(balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#64748b]">تاريخ الإنشاء</p>
                        <p className="text-sm text-[#94a3b8] mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* المفتاح الخاص */}
                    <div className="mt-3 pt-3 border-t border-[#1e1e2f]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-[#64748b]" />
                          <span className="text-sm font-medium text-[#94a3b8]">المفتاح الخاص (مشفر)</span>
                        </div>
                        <button
                          onClick={() => togglePrivateKey(network)}
                          className="text-[#64748b] hover:text-white transition-colors"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {showKey && (
                        <div className="mt-2 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2f]">
                          <p className="text-xs font-mono break-all text-[#94a3b8]">
                            {(wallet as any).encryptedPrivateKey || "غير متاح"}
                          </p>
                          <p className="text-xs text-[#ef4444] mt-1 flex items-center gap-1">
                            ⚠️ المفتاح مشفر. لا تشاركه مع أحد.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </div>

      {/* تعليمات النظام */}
      <GlassCard className="p-5 border-[#10b981]/10">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#10b981]" />
          📌 كيف يعمل النظام؟
        </h3>
        <ul className="text-sm text-[#94a3b8] space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">1️⃣</span>
            المستخدمون يرسلون أموالهم إلى عنوان المحفظة أعلاه
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">2️⃣</span>
            يتم إضافة الرصيد تلقائياً إلى حساباتهم
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">3️⃣</span>
            البوت يتداول باستخدام الأموال المجمعة
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">4️⃣</span>
            <span className="text-[#10b981] font-bold">85%</span> من الأرباح تذهب للمستخدم
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">5️⃣</span>
            <span className="text-[#f59e0b] font-bold">15%</span> تذهب لتطوير المنصة (الخزانة)
          </li>
          <li className="flex items-start gap-2 text-emerald-400">
            <span className="text-[#10b981] font-bold">➕</span>
            <span className="text-[#10b981]">يمكنك سحب الأموال من البوت إلى محفظتك باستخدام زر "سحب"</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}

export default WalletPage;