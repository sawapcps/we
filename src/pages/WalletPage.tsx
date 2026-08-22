// src/pages/WalletPage.tsx
// ============================================================
// 💰 محفظة البوت المركزية - تدير أموال جميع المستخدمين
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { BotWalletManager, BotWalletData } from "../lib/wallet";
import { AccountManager } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { 
  Copy, Check, Key, Eye, EyeOff, Coins, Loader2, RefreshCw, 
  Users, DollarSign, TrendingUp, Shield, Wallet, ChevronDown, 
  ChevronRight, Sparkles, BarChart3, Activity, Zap,
  Globe, Link2, Unlink, Clock
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

export function WalletPage() {
  const { addLog, botWallets, loadBotWallets, refreshBotBalance } = useApp();
  const [wallets, setWallets] = useState<BotWalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  
  const hasLoaded = useRef(false);
  const isLoadingData = useRef(false);

  const loadData = async () => {
    if (isLoadingData.current) {
      console.log("⏳ جاري التحميل بالفعل، تخطي...");
      return;
    }
    
    isLoadingData.current = true;
    setIsLoading(true);
    try {
      await loadBotWallets();
      const botWallet = BotWalletManager.getInstance();
      const allWallets = botWallet.getAllWallets();
      setWallets(allWallets);
      
      const total = allWallets.reduce((sum, w) => sum + w.balance, 0);
      setTotalBalance(total);
      
      const stats = await AccountManager.getSystemStats();
      setSystemStats(stats);
    } catch (error) {
      console.error("خطأ في تحميل البيانات:", error);
    } finally {
      setIsLoading(false);
      isLoadingData.current = false;
    }
  };

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadData();
    }
  }, []);

  const refreshBalance = async (network: string) => {
    setIsLoading(true);
    try {
      const newBalance = await refreshBotBalance(network);
      addLog("SUCCESS", `✅ تم تحديث رصيد ${network}: $${newBalance.toFixed(2)}`);
      await loadData();
    } catch (error) {
      addLog("ERROR", `❌ فشل تحديث الرصيد: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

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
      </div>

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
            onClick={loadData}
            disabled={isLoading}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            {isLoading ? 'جاري التحديث...' : 'تحديث الكل'}
          </Button>
        </div>
      </GlassCard>

      {/* جميع المحافظ */}
      <div className="space-y-3">
        {wallets.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <Wallet className="w-12 h-12 text-[#64748b] mx-auto mb-4 opacity-50" />
            <p className="text-[#94a3b8] text-sm">لا توجد محافظ بعد</p>
            <p className="text-[#64748b] text-xs mt-1">سيتم إنشاء المحافظ تلقائياً عند تفعيل الشبكات</p>
          </GlassCard>
        ) : (
          wallets.map((wallet) => {
            const isExpanded = expandedWallet === wallet.network;
            const showKey = showPrivateKey === wallet.network;
            const network = NETWORKS.find(n => n.id === wallet.network);
            const icon = network?.icon || getNetworkIcon(wallet.network);
            const name = network?.name || getNetworkName(wallet.network);
            const color = network?.color || '#64748b';
            const balance = wallet.balance || 0;

            return (
              <GlassCard key={wallet.network} hover className="overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1e1e2f]/50 transition-colors"
                  onClick={() => setExpandedWallet(isExpanded ? null : wallet.network)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white">{name}</p>
                      <p className="text-sm font-mono text-[#10b981]">{formatUsd(balance)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshBalance(wallet.network);
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
                          <p className="text-sm font-mono text-white truncate">{wallet.address}</p>
                          <button
                            onClick={() => handleCopy(wallet.address)}
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
                          {formatDate(wallet.createdAt)}
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
                          onClick={() => togglePrivateKey(wallet.network)}
                          className="text-[#64748b] hover:text-white transition-colors"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {showKey && (
                        <div className="mt-2 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2f]">
                          <p className="text-xs font-mono break-all text-[#94a3b8]">
                            {wallet.encryptedPrivateKey || "غير متاح"}
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
        </ul>
      </GlassCard>
    </div>
  );
}

export default WalletPage;