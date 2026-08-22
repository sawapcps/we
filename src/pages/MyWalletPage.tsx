// src/pages/MyWalletPage.tsx

import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { AccountManager } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { NETWORKS, getNetworkName } from "../config/networks";
import { 
  Wallet, Copy, Check, TrendingUp, Coins, DollarSign, 
  ArrowUpRight, History, Shield, Save, AlertCircle, Trash2,
  Plus, Loader2, RefreshCw
} from "lucide-react";

export function MyWalletPage() {
  const { 
    user, 
    userWallets, 
    loadUserWallets, 
    createUserWallet, 
    refreshUserBalance,
    userStats,
    transactions,
    addLog,
    isLoading 
  } = useApp();
  
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("solana");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserWallets();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
        <p className="text-gray-400">الرجاء تسجيل الدخول لعرض محفظتك</p>
        <p className="text-sm text-gray-500 mt-2">المستخدم غير موجود أو لم يتم تسجيل الدخول</p>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleCreateWallet = async () => {
    if (!selectedNetwork) {
      setError("❌ الرجاء اختيار شبكة");
      return;
    }

    const existing = userWallets.find(w => w.network === selectedNetwork);
    if (existing) {
      setError(`❌ توجد محفظة بالفعل لشبكة ${getNetworkName(selectedNetwork)}`);
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const wallet = await createUserWallet(selectedNetwork);
      setSuccess(`✅ تم إنشاء محفظة على ${getNetworkName(selectedNetwork)}`);
      addLog("SUCCESS", `✅ تم إنشاء محفظة ${getNetworkName(selectedNetwork)}: ${wallet.address}`);
      setShowCreateWallet(false);
      await loadUserWallets();
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      setError(error.message || "❌ فشل إنشاء المحفظة");
      addLog("ERROR", `❌ فشل إنشاء المحفظة: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefreshBalance = async (network: string) => {
    try {
      const balance = await refreshUserBalance(network);
      addLog("SUCCESS", `✅ تم تحديث رصيد ${getNetworkName(network)}: $${balance.toFixed(2)}`);
    } catch (error: any) {
      addLog("ERROR", `❌ فشل تحديث الرصيد: ${error.message}`);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError("❌ الرجاء إدخال مبلغ صحيح");
      return;
    }

    const wallet = userWallets.find(w => w.network === selectedNetwork);
    if (!wallet) {
      setError("❌ لا توجد محفظة للشبكة المحددة");
      return;
    }

    if (wallet.balance < amount) {
      setError(`❌ الرصيد غير كافٍ. الرصيد المتاح: $${wallet.balance.toFixed(2)}`);
      return;
    }

    setIsWithdrawing(true);
    setError(null);
    setSuccess(null);

    try {
      const password = prompt("🔐 أدخل كلمة المرور لتأكيد السحب");
      if (!password) {
        setIsWithdrawing(false);
        return;
      }

      await AccountManager.withdraw(user.id, amount, password);
      
      setSuccess(`✅ تم سحب $${amount.toFixed(2)} بنجاح`);
      setWithdrawAmount("");
      setShowWithdraw(false);
      await loadUserWallets();
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      setError(error.message || "❌ فشل السحب");
      addLog("ERROR", `❌ فشل السحب: ${error.message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const totalBalance = userWallets.reduce((sum, w) => sum + w.balance, 0);
  const totalProfit = userStats?.totalProfit || 0;
  const totalFees = userStats?.totalFees || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">💳 محفظتي</h1>
        <p className="text-gray-400 text-sm mt-1">إدارة محافظك الشخصية وعمليات السحب</p>
        <p className="text-xs text-emerald-400 mt-1">👤 المستخدم: {user.email}</p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-medium text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-sm">✕</button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 flex items-start gap-3">
          <span className="text-emerald-400 text-sm flex-1">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300 text-sm">✕</button>
        </div>
      )}

      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-400">نظام الأرباح: 85% لك</h3>
            <p className="text-sm text-gray-400">من كل ربح، تحصل على 85% فوراً، و15% تذهب لتطوير المنصة</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <DollarSign size={18} />
            <span className="text-sm">إجمالي الرصيد</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{formatUsd(totalBalance)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <TrendingUp size={18} />
            <span className="text-sm">إجمالي الأرباح</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">{formatUsd(totalProfit)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <Coins size={18} />
            <span className="text-sm">العمولات (15%)</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">{formatUsd(totalFees)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <Wallet size={18} />
            <span className="text-sm">المحافظ</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{userWallets.length}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowCreateWallet(!showCreateWallet)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          إنشاء محفظة جديدة
        </button>
        <button
          onClick={() => setShowWithdraw(!showWithdraw)}
          disabled={userWallets.length === 0 || totalBalance === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ArrowUpRight size={18} />
          سحب الأرباح
        </button>
      </div>

      {showCreateWallet && (
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <h3 className="font-semibold text-white mb-3">➕ إنشاء محفظة جديدة</h3>
          <div className="flex gap-3">
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:outline-none focus:border-emerald-500"
            >
              {NETWORKS.map((net) => (
                <option key={net.id} value={net.id}>{net.icon} {net.name}</option>
              ))}
            </select>
            <button
              onClick={handleCreateWallet}
              disabled={isCreating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={18} />}
              إنشاء
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">💡 يمكنك إنشاء محفظة واحدة لكل شبكة</p>
        </div>
      )}

      {showWithdraw && userWallets.length > 0 && (
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <h3 className="font-semibold text-white mb-3">📤 سحب الأرباح</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-1">اختر المحفظة</label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:outline-none focus:border-emerald-500"
              >
                {userWallets.map((w) => (
                  <option key={w.id} value={w.network}>
                    {NETWORKS.find(n => n.id === w.network)?.icon} {getNetworkName(w.network)} - {formatUsd(w.balance)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">المبلغ ($)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWithdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight size={18} />}
                تأكيد السحب
              </button>
              <button
                onClick={() => setShowWithdraw(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
            <p className="text-xs text-gray-400">⚠️ الحد الأدنى: $10 | الحد الأقصى: $10,000</p>
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Wallet size={18} />
          محافظي ({userWallets.length})
          <button
            onClick={() => {
              userWallets.forEach(w => handleRefreshBalance(w.network));
            }}
            className="ml-auto text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <RefreshCw size={14} />
            تحديث الكل
          </button>
        </h3>

        {userWallets.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wallet size={48} className="mx-auto mb-3 opacity-50" />
            <p>لا توجد محافظ</p>
            <p className="text-sm">أنشئ محفظتك الأولى أعلاه</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userWallets.map((wallet) => {
              const network = NETWORKS.find(n => n.id === wallet.network);
              const isCopied = copiedAddress === wallet.address;
              
              return (
                <div
                  key={wallet.id}
                  className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{network?.icon || '💳'}</span>
                      <div>
                        <p className="font-medium text-white">{network?.name || wallet.network}</p>
                        <p className="text-sm text-emerald-400">{formatUsd(wallet.balance)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRefreshBalance(wallet.network)}
                        className="p-1.5 hover:bg-slate-600 rounded-lg transition-colors"
                        title="تحديث الرصيد"
                      >
                        <RefreshCw size={16} className="text-gray-400 hover:text-white" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2 bg-slate-800/50 rounded-lg p-2">
                    <p className="text-xs font-mono text-gray-300 truncate flex-1">
                      {wallet.address}
                    </p>
                    <button
                      onClick={() => copyToClipboard(wallet.address)}
                      className="p-1 hover:bg-slate-600 rounded transition-colors"
                    >
                      {isCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-gray-400 hover:text-white" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <History size={18} />
          آخر المعاملات ({transactions?.length || 0})
        </h3>
        {!transactions || transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>
                    {tx.type === "PROFIT" && "📈"}
                    {tx.type === "WITHDRAW" && "💸"}
                    {tx.type === "DEPOSIT" && "💰"}
                    {tx.type === "COMMISSION" && "🏦"}
                    {tx.type === "TRADE_BUY" && "🟢"}
                    {tx.type === "TRADE_SELL" && "🔴"}
                  </span>
                  <span className="text-gray-300">{tx.description}</span>
                </div>
                <span className={tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}$
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📌 كيف يعمل نظام المحفظة الفردية؟</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1️⃣ لكل مستخدم محافظه الخاصة</li>
          <li>2️⃣ أنت الوحيد الذي يملك المفاتيح الخاصة</li>
          <li>3️⃣ البوت يتداول نيابة عنك باستخدام محفظتك</li>
          <li>4️⃣ 85% من الأرباح تذهب إليك</li>
          <li>5️⃣ 15% تذهب لتطوير المنصة</li>
        </ul>
      </div>
    </div>
  );
}

export default MyWalletPage;