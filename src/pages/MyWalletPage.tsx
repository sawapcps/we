// src/pages/MyWalletPage.tsx

import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { AccountManager } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { Wallet, Copy, Check, TrendingUp, Coins, DollarSign, ArrowUpRight, History, Shield } from "lucide-react";

export function MyWalletPage() {
  const { user, addLog } = useApp();
  const [balance, setBalance] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ✅ إذا كان المستخدم أدمن مدمج (غير موجود في قاعدة البيانات)
      if (user.email === 'admin@cryptobot.com') {
        setBalance(0);
        setTotalProfit(0);
        setTotalFees(0);
        setTotalDeposited(0);
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      // ✅ للمستخدمين العاديين (الموجودين في قاعدة البيانات)
      const stats = await AccountManager.getUserStats(user.id);
      setBalance(stats.netBalance || 0);
      setTotalProfit(stats.totalProfit || 0);
      setTotalFees(stats.totalFees || 0);
      setTotalDeposited(stats.totalDeposited || 0);

      const txs = await AccountManager.getTransactions(user.id);
      setTransactions(txs.slice(0, 10));
    } catch (error) {
      console.error("خطأ في تحميل البيانات:", error);
      setError("فشل تحميل بيانات المحفظة");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError("الرجاء إدخال مبلغ صحيح");
      return;
    }
    if (amount > balance) {
      setError("الرصيد غير كافٍ");
      return;
    }
    if (!withdrawAddress) {
      setError("الرجاء إدخال عنوان محفظتك الشخصية");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const password = prompt("أدخل كلمة المرور لتأكيد السحب");
      if (!password) return;

      await AccountManager.withdraw(user.id, amount, password);
      addLog("SUCCESS", `✅ تم سحب $${amount.toFixed(2)}`);
      setWithdrawAmount("");
      await loadUserData();
    } catch (error) {
      setError(String(error));
      addLog("ERROR", "❌ فشل السحب: " + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">الرجاء تسجيل الدخول لعرض محفظتك</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-bold">💰 محفظتي</h1>
        <p className="text-gray-500 dark:text-gray-400">إدارة أرباحك وعمليات السحب</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <p className="text-red-400 text-sm">❌ {error}</p>
        </div>
      )}

      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-400">نظام الأرباح: 85% لك</h3>
            <p className="text-sm text-gray-400">
              من كل ربح، تحصل على <span className="text-emerald-400 font-bold">85%</span> فوراً، 
              و<span className="text-amber-400 font-bold">15%</span> تذهب لتطوير المنصة
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500">
            <DollarSign size={18} />
            <span className="text-sm">الرصيد المتاح</span>
          </div>
          <div className="text-2xl font-bold text-green-500">${balance.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={18} />
            <span className="text-sm">إجمالي الأرباح</span>
          </div>
          <div className="text-2xl font-bold text-blue-500">${totalProfit.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500">
            <Coins size={18} />
            <span className="text-sm">العمولات (15%)</span>
          </div>
          <div className="text-2xl font-bold text-amber-500">${totalFees.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-500">
            <Wallet size={18} />
            <span className="text-sm">إجمالي الإيداع</span>
          </div>
          <div className="text-2xl font-bold text-purple-500">${totalDeposited.toFixed(2)}</div>
        </div>
      </div>

      <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-4">📤 سحب الأرباح</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">عنوان محفظتك الشخصية</label>
            <input
              type="text"
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              placeholder="0x... أو Solana address"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-white mt-1"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-500">المبلغ ($)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-white mt-1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleWithdraw}
                disabled={isLoading || balance === 0}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowUpRight size={18} />
                {isLoading ? "جاري..." : "سحب"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            الحد الأدنى للسحب: $10 | الحد الأقصى: $10,000
          </p>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <History size={18} />
          آخر المعاملات
        </h3>
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-sm">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                <div className="flex items-center gap-2">
                  <span className={
                    tx.type === "PROFIT" ? "text-green-500" :
                    tx.type === "COMMISSION" ? "text-amber-500" :
                    tx.type === "DEPOSIT" ? "text-blue-500" :
                    tx.type === "WITHDRAW" ? "text-red-500" :
                    "text-gray-500"
                  }>
                    {tx.type === "PROFIT" && "📈"}
                    {tx.type === "COMMISSION" && "🏦"}
                    {tx.type === "DEPOSIT" && "💰"}
                    {tx.type === "WITHDRAW" && "💸"}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{tx.description}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={
                    tx.amount > 0 ? "text-green-500" : "text-red-500"
                  }>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}$
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📌 كيف يعمل السحب؟</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1️⃣ أدخل عنوان محفظتك الشخصية (Phantom / MetaMask)</li>
          <li>2️⃣ حدد المبلغ الذي تريد سحبه</li>
          <li>3️⃣ سيتم خصم المبلغ من رصيدك</li>
          <li>4️⃣ ستصل الأموال إلى محفظتك خلال دقائق</li>
        </ul>
      </div>
    </div>
  );
}

export default MyWalletPage;