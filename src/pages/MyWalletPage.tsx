// src/pages/MyWalletPage.tsx
// ============================================================
// 💰 محفظتي - محفظة المستخدم الفردية (نسخة نهائية كاملة)
// ✅ يدعم: إنشاء محفظة، عرض المحافظ، تحديث الرصيد
// ✅ يدعم: إيداع (عرض العنوان)، سحب (تحويل حقيقي)
// ✅ يدعم: عرض المفتاح الخاص (مشفر)، نسخ العنوان
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { AccountManager, UserWallet } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { 
  Copy, Check, Key, Eye, EyeOff, Loader2, RefreshCw, 
  Wallet, ChevronDown, ChevronRight, Clock, Plus, Globe,
  AlertCircle, ArrowUpRight, ArrowDown, Zap, Link2, ExternalLink
} from "lucide-react";
import { NETWORKS, getNetworkName, getNetworkColor, getNetworkIcon } from "../config/networks";

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

// ============================================================
// 📄 الصفحة الرئيسية
// ============================================================

export function MyWalletPage() {
  const { 
    user, 
    addLog, 
    loadUserWallets, 
    userWallets, 
    refreshUserBalance,
    addTransaction 
  } = useApp();
  
  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('solana');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

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
    
    if (!user) {
      console.log("⚠️ لا يوجد مستخدم");
      return;
    }
    
    isLoadingData.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 جاري تحميل محافظ المستخدم${forceRefresh ? ' (إجباري)' : ''}...`);
      
      let walletList: UserWallet[] = [];
      
      if (forceRefresh) {
        walletList = await AccountManager.getAllUserWallets(user.id);
        console.log(`📊 تم جلب ${walletList.length} محفظة من قاعدة البيانات (مباشر)`);
      } else {
        await loadUserWallets();
        walletList = userWallets;
        console.log(`📊 تم جلب ${walletList.length} محفظة من السياق`);
      }
      
      const walletsArray = Array.isArray(walletList) ? walletList : [];
      setWallets(walletsArray);
      
      const total = walletsArray.reduce((sum, w) => sum + (w.balance || 0), 0);
      setTotalBalance(total);
      
      console.log(`✅ تم تحميل ${walletsArray.length} محفظة`);
      console.log(`💰 إجمالي الرصيد: $${total.toFixed(2)}`);
      
      if (walletsArray.length > 0) {
        walletsArray.forEach(w => {
          console.log(`  - ${w.network}: ${w.address?.slice(0, 8)}... ($${w.balance || 0})`);
        });
      }
      
    } catch (error) {
      console.error("❌ خطأ في تحميل البيانات:", error);
      setError("❌ فشل تحميل المحافظ");
    } finally {
      setIsLoading(false);
      isLoadingData.current = false;
    }
  }, [user, loadUserWallets, userWallets]);

  // ============================================================
  // ✅ تحميل عند تغيير المستخدم
  // ============================================================
  
  useEffect(() => {
    if (user) {
      hasLoaded.current = false;
      loadData(true);
    }
  }, [user?.id, loadData]);

  // ============================================================
  // ✅ مراقبة التغييرات في userWallets من السياق
  // ============================================================
  
  useEffect(() => {
    if (user && userWallets && userWallets.length > 0) {
      console.log(`📊 تحديث userWallets من السياق: ${userWallets.length} محفظة`);
      setWallets(userWallets);
      const total = userWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
      setTotalBalance(total);
    }
  }, [userWallets, user]);

  // ============================================================
  // ✅ دالة تحديث الرصيد
  // ============================================================
  
  const refreshBalance = async (network: string) => {
    if (!user) return;
    
    try {
      const newBalance = await refreshUserBalance(network);
      setSuccess(`✅ تم تحديث رصيد ${getNetworkName(network)}: $${newBalance.toFixed(2)}`);
      await loadData(true);
      addLog("SUCCESS", `✅ تم تحديث رصيد ${getNetworkName(network)}: $${newBalance.toFixed(2)}`);
    } catch (error) {
      setError(`❌ فشل تحديث الرصيد: ${error}`);
      addLog("ERROR", `❌ فشل تحديث الرصيد ${getNetworkName(network)}: ${error}`);
    }
  };

  // ============================================================
  // ✅ دالة إنشاء المحفظة
  // ============================================================
  
  const handleCreateWallet = async () => {
    if (!user) {
      setError("❌ الرجاء تسجيل الدخول أولاً");
      return;
    }

    const network = selectedNetwork;
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`💳 بدء إنشاء محفظة على ${network}...`);
      
      const existing = await AccountManager.getUserWallet(user.id, network);
      if (existing) {
        setSuccess(`✅ المحفظة موجودة بالفعل على ${getNetworkName(network)}`);
        await loadData(true);
        setIsCreating(false);
        return;
      }

      const wallet = await AccountManager.createUserWallet(user.id, network);
      console.log(`✅ تم إنشاء محفظة جديدة:`, wallet);
      
      if (wallet) {
        setSuccess(`✅ تم إنشاء محفظة ${getNetworkName(network)} بنجاح`);
        await loadData(true);
        setWallets(prev => {
          const exists = prev.some(w => w.network === network);
          if (!exists) {
            return [...prev, wallet];
          }
          return prev;
        });
        addLog("SUCCESS", `✅ تم إنشاء محفظة ${getNetworkName(network)}`);
      } else {
        setError(`❌ فشل إنشاء محفظة ${getNetworkName(network)}`);
      }
    } catch (error: any) {
      console.error('❌ خطأ في إنشاء المحفظة:', error);
      if (error.message?.includes('المستخدم غير موجود')) {
        setError(`❌ يرجى تسجيل الخروج والدخول مرة أخرى لتحديث بيانات المستخدم`);
      } else {
        setError(`❌ فشل إنشاء المحفظة: ${error.message || error}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // ============================================================
  // ✅ دالة الإيداع - تعرض عنوان المحفظة
  // ============================================================
  
  const handleDeposit = useCallback(async (wallet: UserWallet) => {
    if (!user) {
      setError("❌ الرجاء تسجيل الدخول أولاً");
      return;
    }

    const network = wallet.network;
    const address = wallet.address;
    
    // ✅ عرض معلومات الإيداع
    const depositMessage = `
💰 إيداع على شبكة ${getNetworkName(network)}

📍 عنوان المحفظة:
${address}

⚠️ أرسل العملة المناسبة (${network.toUpperCase()}) إلى هذا العنوان.
سيتم تحديث الرصيد تلقائياً بعد وصول الأموال.

🔗 رابط الشبكة: https://explorer.solana.com/address/${address}
    `;
    
    setSuccess(depositMessage);
    
    // ✅ نسخ العنوان تلقائياً
    await handleCopy(address);
    
    addLog("INFO", `💰 طلب إيداع على ${getNetworkName(network)}: ${address.slice(0, 10)}...`);
    
    // ✅ فتح الرابط في متصفح جديد
    if (window.confirm('📋 تم نسخ العنوان. هل تريد فتح مستكشف الشبكة؟')) {
      window.open(`https://explorer.solana.com/address/${address}`, '_blank');
    }
  }, [user, addLog]);

  // ============================================================
  // ✅ دالة السحب - تحويل إلى محفظة خارجية (حقيقي)
  // ============================================================
  
  const handleWithdraw = useCallback(async (wallet: UserWallet) => {
    if (!user) {
      setError("❌ الرجاء تسجيل الدخول أولاً");
      return;
    }

    const network = wallet.network;
    const balance = wallet.balance || 0;
    
    if (balance <= 0) {
      setError("❌ الرصيد صفر. لا يمكن السحب");
      return;
    }

    setIsWithdrawing(true);

    try {
      // ✅ 1. طلب عنوان المحفظة الخارجية
      const externalAddress = prompt(
        `💰 سحب من ${getNetworkName(network)}\n` +
        `الرصيد المتاح: $${balance.toFixed(2)}\n\n` +
        `أدخل عنوان المحفظة الخارجية (الوجهة):\n` +
        `(لـ ${network === 'solana' ? 'Solana' : 'EVM'})`
      );
      
      if (!externalAddress || externalAddress.trim() === '') {
        setError("❌ لم يتم إدخال عنوان المحفظة");
        setIsWithdrawing(false);
        return;
      }

      // ✅ 2. التحقق من صحة العنوان حسب الشبكة
      let isValid = false;
      if (network === 'solana') {
        isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(externalAddress.trim());
      } else {
        isValid = /^0x[a-fA-F0-9]{40}$/.test(externalAddress.trim());
      }
      
      if (!isValid) {
        setError(`❌ عنوان ${getNetworkName(network)} غير صحيح. تأكد من التنسيق.`);
        setIsWithdrawing(false);
        return;
      }

      // ✅ 3. طلب المبلغ
      const amountStr = prompt(
        `💰 أدخل المبلغ المراد سحبه\n` +
        `الرصيد المتاح: $${balance.toFixed(2)}\n` +
        `الحد الأدنى: $10\n` +
        `الحد الأقصى: $${balance.toFixed(2)}`
      );
      
      if (!amountStr) {
        setIsWithdrawing(false);
        return;
      }
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        setError("❌ مبلغ غير صحيح");
        setIsWithdrawing(false);
        return;
      }
      
      if (amount < 10) {
        setError("❌ الحد الأدنى للسحب هو $10");
        setIsWithdrawing(false);
        return;
      }
      
      if (amount > balance) {
        setError(`❌ الرصيد غير كافٍ. المتاح: $${balance.toFixed(2)}`);
        setIsWithdrawing(false);
        return;
      }

      // ✅ 4. تأكيد السحب
      const confirmMsg = 
`⚠️ تأكيد السحب

الشبكة: ${getNetworkName(network)}
المبلغ: $${amount.toFixed(2)}
العنوان: ${externalAddress.slice(0, 10)}...${externalAddress.slice(-6)}

هل أنت متأكد؟`;

      if (!window.confirm(confirmMsg)) {
        setIsWithdrawing(false);
        return;
      }

      // ✅ 5. تنفيذ السحب عبر AccountManager
      const result = await AccountManager.withdrawToExternalWallet(
        user.id,
        network,
        amount,
        externalAddress.trim()
      );
      
      if (result.success) {
        setSuccess(`✅ تم سحب $${amount.toFixed(2)} إلى ${externalAddress.slice(0, 10)}... بنجاح`);
        addLog("SUCCESS", `✅ سحب $${amount.toFixed(2)} من ${getNetworkName(network)} إلى ${externalAddress.slice(0, 10)}...`);
        
        // ✅ إضافة معاملة
        if (addTransaction) {
          await addTransaction({
            userId: user.id,
            type: 'WITHDRAW',
            amount,
            balanceAfter: balance - amount,
            txHash: result.txHash || `withdraw_${Date.now()}`,
            description: `سحب $${amount.toFixed(2)} من ${getNetworkName(network)}`,
            status: 'completed',
            metadata: {
              network,
              externalAddress,
            },
          });
        }
        
        // ✅ تحديث الرصيد
        await refreshUserBalance(network);
        await loadData(true);
        
        // ✅ عرض رابط المعاملة
        if (result.txHash) {
          const explorerUrl = network === 'solana' 
            ? `https://solscan.io/tx/${result.txHash}`
            : `https://etherscan.io/tx/${result.txHash}`;
          
          setTimeout(() => {
            if (window.confirm(`🔗 هل تريد عرض المعاملة على المستكشف؟`)) {
              window.open(explorerUrl, '_blank');
            }
          }, 1000);
        }
        
      } else {
        setError(`❌ فشل السحب: ${result.error || 'خطأ غير معروف'}`);
        addLog("ERROR", `❌ فشل سحب $${amount.toFixed(2)} من ${getNetworkName(network)}: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ فشل السحب:', error);
      setError(`❌ فشل السحب: ${error.message || error}`);
      addLog("ERROR", `❌ فشل سحب: ${error}`);
    } finally {
      setIsWithdrawing(false);
    }
  }, [user, addLog, addTransaction, refreshUserBalance, loadData]);

  // ============================================================
  // ✅ دالة ربط محفظة خارجية
  // ============================================================
  
  const handleLinkExternalWallet = useCallback(async (network: string) => {
    if (!user) {
      setError("❌ الرجاء تسجيل الدخول أولاً");
      return;
    }

    const address = prompt(
      `🔗 ربط محفظة خارجية على ${getNetworkName(network)}\n\n` +
      `أدخل عنوان المحفظة الخارجية (للسحب إليها):\n` +
      `(لـ ${network === 'solana' ? 'Solana' : 'EVM'})`
    );
    
    if (!address || address.trim() === '') {
      setError("❌ لم يتم إدخال العنوان");
      return;
    }

    // ✅ التحقق من صحة العنوان
    let isValid = false;
    if (network === 'solana') {
      isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
    } else {
      isValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim());
    }
    
    if (!isValid) {
      setError(`❌ عنوان ${getNetworkName(network)} غير صحيح.`);
      return;
    }

    try {
      const result = await AccountManager.linkExternalWallet(
        user.id,
        network,
        address.trim()
      );
      
      if (result.success) {
        setSuccess(`✅ تم ربط المحفظة الخارجية على ${getNetworkName(network)} بنجاح`);
        addLog("SUCCESS", `✅ ربط محفظة خارجية على ${getNetworkName(network)}: ${address.slice(0, 10)}...`);
      } else {
        setError(`❌ فشل ربط المحفظة: ${result.error}`);
      }
    } catch (error: any) {
      setError(`❌ فشل ربط المحفظة: ${error.message || error}`);
    }
  }, [user, addLog]);

  // ============================================================
  // ✅ دوال مساعدة
  // ============================================================
  
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ✅ نسخ احتياطي
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

  // ============================================================
  // 📄 العرض
  // ============================================================
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#10b981]" />
          💰 محفظتي
        </h1>
        <p className="text-sm text-[#64748b] mt-1">
          محفظتك الشخصية - يمكنك إدارة أموالك وسحب الأرباح
        </p>
      </div>

      {/* رسائل الخطأ والنجاح */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-400 text-sm flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 flex items-start gap-3 whitespace-pre-line">
          <span className="text-emerald-400 text-sm flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300 text-sm">✕</button>
        </div>
      )}

      {/* إجمالي الرصيد */}
      <GlassCard glow className="p-6 bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 border-[#10b981]/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#94a3b8]">إجمالي رصيد محفظتي</p>
            <p className="text-3xl font-bold text-white">${totalBalance.toFixed(2)}</p>
            <p className="text-xs text-[#64748b] mt-1 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {wallets.length} محافظ نشطة
            </p>
          </div>
          <div className="flex gap-2">
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
        </div>
      </GlassCard>

      {/* إنشاء محفظة جديدة */}
      <GlassCard className="p-4 border-[#10b981]/20 bg-[#10b981]/5">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#10b981]/20 rounded-xl">
            <Plus className="w-5 h-5 text-[#10b981]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">إنشاء محفظة جديدة</h3>
            <p className="text-xs text-[#64748b]">أضف محفظة لشبكة جديدة</p>
          </div>
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            className="bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#10b981]"
          >
            {NETWORKS.map((net) => (
              <option key={net.id} value={net.id}>
                {net.icon} {net.name}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateWallet}
            disabled={isCreating}
            icon={<Plus className="w-4 h-4" />}
          >
            {isCreating ? 'جاري...' : 'إنشاء'}
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
            <p className="text-[#64748b] text-xs mt-1">أنشئ محفظتك الأولى من الأعلى</p>
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
                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                        {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6) || ''}
                      </p>
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
                          {formatDate(wallet.created_at || wallet.createdAt)}
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

                    {/* ✅ أزرار الإجراءات - سحب وإيداع وربط */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-[#1e1e2f]">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleDeposit(wallet)}
                        icon={<ArrowDown className="w-3 h-3" />}
                      >
                        إيداع
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="wallet"
                        onClick={() => handleWithdraw(wallet)}
                        disabled={wallet.balance <= 0 || isWithdrawing}
                        icon={isWithdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
                      >
                        {isWithdrawing ? 'جاري...' : 'سحب'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLinkExternalWallet(wallet.network)}
                        icon={<Link2 className="w-3 h-3" />}
                      >
                        ربط
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const explorerUrl = wallet.network === 'solana' 
                            ? `https://solscan.io/address/${wallet.address}`
                            : `https://etherscan.io/address/${wallet.address}`;
                          window.open(explorerUrl, '_blank');
                        }}
                        icon={<ExternalLink className="w-3 h-3" />}
                      >
                        استكشاف
                      </Button>
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
          📌 كيف تعمل محفظتي؟
        </h3>
        <ul className="text-sm text-[#94a3b8] space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">1️⃣</span>
            أنشئ محفظة لأي شبكة تدعمها المنصة
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">2️⃣</span>
            اضغط <span className="text-emerald-400">"إيداع"</span> لعرض عنوان محفظتك وإرسال الأموال
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">3️⃣</span>
            الأموال تظهر تلقائياً في رصيدك بعد وصولها
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">4️⃣</span>
            اضغط <span className="text-purple-400">"سحب"</span> لتحويل الأموال إلى محفظة خارجية
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#10b981] font-bold">5️⃣</span>
            جميع المعاملات مشفرة وآمنة
          </li>
          <li className="flex items-start gap-2 text-emerald-400">
            <span className="text-[#10b981] font-bold">➕</span>
            <span>يمكنك ربط محفظة خارجية لتسهيل السحب</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}

export default MyWalletPage;