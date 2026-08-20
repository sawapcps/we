// src/pages/WalletPage.tsx

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { BotWalletManager, BotWalletData } from "@/lib/wallet";
import { AccountManager } from "@/lib/accounts";
import { formatUsd } from "@/lib/format";
import { Copy, Check, Key, Eye, EyeOff, Coins, Loader2, RefreshCw, Users, DollarSign, TrendingUp, Shield, Wallet, ChevronDown, ChevronRight } from "lucide-react";

export function WalletPage() {
  const { addLog, botWallets, loadBotWallets, refreshBotBalance } = useApp();
  const [wallets, setWallets] = useState<BotWalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("solana");
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  
  // ✅ منع التحميل المتكرر
  const hasLoaded = useRef(false);
  const isLoadingData = useRef(false);

  // ✅ دالة تحميل البيانات مع حماية ضد التكرار
  const loadData = async () => {
    // ✅ منع التحميل المتزامن
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
      
      const stats = await AccountManager.getSystemStats();
      setSystemStats(stats);
    } catch (error) {
      console.error("خطأ في تحميل البيانات:", error);
    } finally {
      setIsLoading(false);
      isLoadingData.current = false;
    }
  };

  // ✅ تحميل البيانات مرة واحدة فقط
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

  const getNetworkIcon = (network: string): string => {
    const icons: Record<string, string> = {
      solana: "🟣",
      ethereum: "🔵",
      bsc: "🟡",
      polygon: "🟣",
      base: "🔷",
      arbitrum: "🔷",
      avalanche: "🔴",
      optimism: "🔴",
      robinhood: "🦊",
      ronin: "⚔️",
      sui: "🌊",
      ton: "💎",
      zksync: "🟪",
      linea: "⬛",
      fantom: "🔷",
      near: "🟢",
    };
    return icons[network] || "💳";
  };

  const getNetworkName = (network: string): string => {
    const names: Record<string, string> = {
      solana: "Solana",
      ethereum: "Ethereum",
      bsc: "BNB Chain",
      polygon: "Polygon",
      base: "Base",
      arbitrum: "Arbitrum",
      avalanche: "Avalanche",
      optimism: "Optimism",
      robinhood: "Robinhood",
      ronin: "Ronin",
      sui: "Sui",
      ton: "TON",
      zksync: "zkSync",
      linea: "Linea",
      fantom: "Fantom",
      near: "NEAR",
    };
    return names[network] || network;
  };

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">💰 محفظة البوت</h1>
        <p className="text-gray-500 dark:text-gray-400">المحفظة المركزية للبوت - تدير أموال جميع المستخدمين</p>
      </div>

      {/* نظام الأرباح */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-emerald-400">نظام الأرباح: 85% لك / 15% للخزانة</h3>
            <p className="text-sm text-gray-400">
              عند تحقيق أرباح، تحصل على <span className="text-emerald-400 font-bold">85%</span> من الربح، 
              و<span className="text-amber-400 font-bold">15%</span> تذهب لتطوير البوت والمنصة
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-400">85%</div>
            <div className="text-xs text-gray-500">صافي الربح</div>
          </div>
        </div>
      </div>

      {/* System Stats */}
      {systemStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500">
              <Users size={18} />
              <span className="text-sm">المستخدمين</span>
            </div>
            <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500">
              <DollarSign size={18} />
              <span className="text-sm">إجمالي الرصيد</span>
            </div>
            <div className="text-2xl font-bold text-green-500">${systemStats.totalBalance?.toFixed(2) || "0.00"}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500">
              <TrendingUp size={18} />
              <span className="text-sm">إجمالي الأرباح</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">${systemStats.totalProfit?.toFixed(2) || "0.00"}</div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-500">
              <Coins size={18} />
              <span className="text-sm">إجمالي العمولات</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">${systemStats.totalFees?.toFixed(2) || "0.00"}</div>
          </div>
        </div>
      )}

      {/* إجمالي الرصيد */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">إجمالي رصيد المحافظ</p>
            <p className="text-3xl font-bold">${totalBalance.toFixed(2)}</p>
            <p className="text-xs opacity-60 mt-1">{wallets.length} محافظ نشطة</p>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔄 تحديث الكل"}
          </button>
        </div>
      </div>

      {/* جميع المحافظ */}
      <div className="space-y-3">
        {wallets.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Wallet size={48} className="mx-auto mb-2 opacity-50" />
            <p>لا توجد محافظ بعد</p>
            <p className="text-sm">سيتم إنشاء المحافظ تلقائياً عند تفعيل الشبكات</p>
          </div>
        ) : (
          wallets.map((wallet) => {
            const isExpanded = expandedWallet === wallet.network;
            const icon = getNetworkIcon(wallet.network);
            const name = getNetworkName(wallet.network);

            return (
              <div
                key={wallet.network}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpandedWallet(isExpanded ? null : wallet.network)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatUsd(wallet.balance)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshBalance(wallet.network);
                      }}
                      disabled={isLoading}
                      className="text-xs px-3 py-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                      تحديث
                    </button>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">عنوان المحفظة</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-mono truncate">{wallet.address}</p>
                          <button
                            onClick={() => handleCopy(wallet.address)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">الشبكة</p>
                        <p className="text-sm font-medium mt-1">{name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">الرصيد</p>
                        <p className="text-sm font-bold text-green-500 mt-1">{formatUsd(wallet.balance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">تاريخ الإنشاء</p>
                        <p className="text-sm mt-1">{new Date(wallet.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* المفتاح الخاص (مشفر) */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key size={16} className="text-gray-500" />
                          <span className="text-sm font-medium">المفتاح الخاص (مشفر)</span>
                        </div>
                        <button
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          {showPrivateKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {showPrivateKey && (
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                          <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">
                            {wallet.encryptedPrivateKey || "غير متاح"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">⚠️ المفتاح مشفر. لا تشاركه مع أحد.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* تعليمات الإيداع */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📌 كيف يعمل النظام؟</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1️⃣ المستخدمون يرسلون أموالهم إلى عنوان المحفظة أعلاه</li>
          <li>2️⃣ يتم إضافة الرصيد تلقائياً إلى حساباتهم</li>
          <li>3️⃣ البوت يتداول باستخدام الأموال المجمعة</li>
          <li>4️⃣ <span className="font-bold text-emerald-400">85%</span> من الأرباح تذهب للمستخدم</li>
          <li>5️⃣ <span className="font-bold text-amber-400">15%</span> تذهب لتطوير المنصة (الخزانة)</li>
        </ul>
      </div>
    </div>
  );
}