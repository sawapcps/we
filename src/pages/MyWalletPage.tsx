// src/pages/MyWalletPage.tsx

import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { AccountManager } from "../lib/accounts";
import { formatUsd } from "../lib/format";
import { 
  Wallet, Copy, Check, TrendingUp, Coins, DollarSign, 
  ArrowUpRight, History, Shield, Save, AlertCircle, Trash2 
} from "lucide-react";

// ✅ ثوابت MadarTech API
const MADARTECH_API_URL = import.meta.env.VITE_MADARTECH_API_URL || 'https://cloud.madartech.uk/api/v1';
const MADARTECH_DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';
const MADARTECH_API_KEY = 'mt_live_uqkE8sldXpFASeV51lIyVghJQKs4hZTheAbyAaJh';
// ✅ قائمة الشبكات المدعومة
const SUPPORTED_NETWORKS = [
  { id: 'solana', name: 'Solana', icon: '🟣' },
  { id: 'ethereum', name: 'Ethereum', icon: '🔵' },
  { id: 'bsc', name: 'BNB Chain', icon: '🟡' },
  { id: 'polygon', name: 'Polygon', icon: '🟣' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔷' },
  { id: 'base', name: 'Base', icon: '🔷' },
  { id: 'avalanche', name: 'Avalanche', icon: '🔴' },
  { id: 'optimism', name: 'Optimism', icon: '🔴' },
  { id: 'robinhood', name: 'Robinhood', icon: '🦊' },
];

export function MyWalletPage() {
  const { user, addLog } = useApp();
  const [balance, setBalance] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("solana");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadUserWallets();
    }
  }, [user]);

  // ✅ جلب userId من قاعدة البيانات
  const getUserId = async (): Promise<string | null> => {
    try {
      const email = user?.email || 'admin@cryptobot.com';
      const result = await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT id FROM users WHERE email = ?`,
          dbId: MADARTECH_DB_ID,
          params: [email]
        })
      });
      const data = await result.json();
      
      if (data.success && data.data && data.data.length > 0) {
        const userId = String(data.data[0].id);
        console.log('✅ userId المستخدم:', userId);
        return userId;
      }
      
      console.log('⚠️ لم يتم العثور على المستخدم');
      return null;
    } catch (error) {
      console.error("خطأ في جلب userId:", error);
      return null;
    }
  };

  // ✅ جلب محافظ المستخدم
  const loadUserWallets = async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        console.log('⚠️ لا يوجد userId، لا يمكن جلب المحافظ');
        setUserWallets([]);
        return;
      }

      const result = await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT * FROM user_wallets WHERE userId = ? ORDER BY createdAt DESC`,
          dbId: MADARTECH_DB_ID,
          params: [userId]
        })
      });
      const data = await result.json();
      
      console.log('📋 محافظ المستخدم:', data);
      
      if (data.success && data.data) {
        setUserWallets(data.data);
        if (data.data.length > 0) {
          const defaultWallet = data.data[0];
          setWithdrawAddress(defaultWallet.address);
          setSelectedNetwork(defaultWallet.network);
        }
      } else {
        setUserWallets([]);
      }
    } catch (error) {
      console.error("فشل جلب محافظ المستخدم:", error);
      setUserWallets([]);
    }
  };

  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const userId = await getUserId();
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const result = await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT balance, totalProfit, totalFees, totalDeposited FROM users WHERE id = ?`,
          dbId: MADARTECH_DB_ID,
          params: [userId]
        })
      });
      const data = await result.json();
      
      if (data.success && data.data && data.data.length > 0) {
        const userData = data.data[0];
        setBalance(userData.balance || 0);
        setTotalProfit(userData.totalProfit || 0);
        setTotalFees(userData.totalFees || 0);
        setTotalDeposited(userData.totalDeposited || 0);
      }

      const txsResult = await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 10`,
          dbId: MADARTECH_DB_ID,
          params: [userId]
        })
      });
      const txsData = await txsResult.json();
      if (txsData.success && txsData.data) {
        setTransactions(txsData.data);
      }
    } catch (error) {
      console.error("خطأ في تحميل البيانات:", error);
      setError("فشل تحميل بيانات المحفظة");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ حفظ عنوان المحفظة
  const saveWithdrawAddress = async () => {
    if (!withdrawAddress || withdrawAddress.trim() === "") {
      setError("❌ الرجاء إدخال عنوان محفظتك");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('لا يمكن تحديد هوية المستخدم');
      }

      console.log('✅ حفظ المحفظة للمستخدم:', userId);

      const checkResult = await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT * FROM user_wallets WHERE userId = ? AND network = ?`,
          dbId: MADARTECH_DB_ID,
          params: [userId, selectedNetwork]
        })
      });
      const checkData = await checkResult.json();
      
      if (checkData.success && checkData.data && checkData.data.length > 0) {
        setError(`❌ توجد محفظة بالفعل لشبكة ${selectedNetwork}`);
        setIsLoading(false);
        return;
      }

      await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `INSERT INTO user_wallets (userId, network, address, encryptedPrivateKey, balance, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
          dbId: MADARTECH_DB_ID,
          params: [
            userId, 
            selectedNetwork, 
            withdrawAddress,
            'encrypted_' + Date.now()
          ]
        })
      });

      await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `UPDATE users SET walletAddress = ? WHERE id = ?`,
          dbId: MADARTECH_DB_ID,
          params: [withdrawAddress, userId]
        })
      });

      setSuccess(`✅ تم حفظ محفظة ${selectedNetwork} بنجاح!`);
      addLog("SUCCESS", `✅ تم حفظ محفظة ${selectedNetwork}: ${withdrawAddress}`);
      
      await loadUserWallets();
      setWithdrawAddress("");
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(String(error));
      addLog("ERROR", "❌ فشل حفظ المحفظة: " + String(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ حذف محفظة
  const deleteWallet = async (walletId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المحفظة؟")) return;

    setIsLoading(true);
    try {
      await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `DELETE FROM user_wallets WHERE id = ?`,
          dbId: MADARTECH_DB_ID,
          params: [walletId]
        })
      });

      setSuccess("✅ تم حذف المحفظة بنجاح");
      await loadUserWallets();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError("❌ الرجاء إدخال مبلغ صحيح");
      return;
    }
    if (amount > balance) {
      setError(`❌ الرصيد غير كافٍ. الرصيد المتاح: $${balance.toFixed(2)}`);
      return;
    }
    if (!withdrawAddress) {
      setError("❌ الرجاء اختيار محفظة للسحب");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const password = prompt("🔐 أدخل كلمة المرور لتأكيد السحب");
      if (!password) {
        setIsLoading(false);
        return;
      }

      const userId = await getUserId();
      if (!userId) {
        throw new Error('لا يمكن تحديد هوية المستخدم');
      }

      await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `UPDATE users SET balance = balance - ? WHERE id = ?`,
          dbId: MADARTECH_DB_ID,
          params: [amount, userId]
        })
      });

      await fetch(`${MADARTECH_API_URL}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MADARTECH_API_KEY}`
        },
        body: JSON.stringify({
          sql: `INSERT INTO transactions (id, userId, type, amount, balanceAfter, description, status, createdAt) 
                VALUES (?, ?, 'WITHDRAW', ?, ?, ?, 'completed', datetime('now'))`,
          dbId: MADARTECH_DB_ID,
          params: [
            'tx_' + Date.now(),
            userId,
            amount,
            balance - amount,
            `💸 سحب $${amount.toFixed(2)} إلى ${selectedNetwork}`
          ]
        })
      });

      setSuccess(`✅ تم سحب $${amount.toFixed(2)} بنجاح إلى ${selectedNetwork}`);
      setWithdrawAmount("");
      await loadUserData();
      setTimeout(() => setSuccess(null), 5000);
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
        <h1 className="text-2xl font-bold text-white">💰 محفظتي</h1>
        <p className="text-gray-400 text-sm mt-1">إدارة محافظك وعمليات السحب</p>
      </div>

      {/* ✅ رسائل الخطأ والنجاح */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-medium text-sm">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500 rounded-xl p-4 flex items-start gap-3">
          <span className="text-emerald-400 text-sm flex-1">{success}</span>
          <button 
            onClick={() => setSuccess(null)}
            className="text-emerald-400 hover:text-emerald-300 text-sm"
          >
            ✕
          </button>
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
            <span className="text-sm">الرصيد المتاح</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">${balance.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <TrendingUp size={18} />
            <span className="text-sm">إجمالي الأرباح</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">${totalProfit.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <Coins size={18} />
            <span className="text-sm">العمولات (15%)</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">${totalFees.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-gray-400">
            <Wallet size={18} />
            <span className="text-sm">إجمالي الإيداع</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">${totalDeposited.toFixed(2)}</div>
        </div>
      </div>

      {/* ✅ إضافة محفظة جديدة */}
      <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-4">➕ إضافة محفظة جديدة</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">اختر الشبكة</label>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:outline-none focus:border-emerald-500"
            >
              {SUPPORTED_NETWORKS.map((net) => (
                <option key={net.id} value={net.id}>{net.icon} {net.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">عنوان المحفظة</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="أدخل عنوان المحفظة..."
                className="flex-1 px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={saveWithdrawAddress}
                disabled={isLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={18} />
                {isLoading ? "جاري..." : "حفظ"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">💡 يمكنك إضافة محفظة لكل شبكة على حدة</p>
          </div>
        </div>
      </div>

      {/* ✅ قائمة المحافظ المسجلة */}
      <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Wallet size={18} />
          محافظي ({userWallets.length})
        </h3>
        {userWallets.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد محافظ مسجلة بعد</p>
        ) : (
          <div className="space-y-2">
            {userWallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {SUPPORTED_NETWORKS.find(n => n.id === w.network)?.icon} {w.network}
                    </span>
                    <span className="text-xs text-emerald-400">${w.balance?.toFixed(2) || '0.00'}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-400 truncate max-w-[200px]">{w.address}</p>
                </div>
                <button
                  onClick={() => deleteWallet(w.id)}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ سحب الأرباح */}
      <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-4">📤 سحب الأرباح</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">اختر محفظة للسحب</label>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white focus:outline-none focus:border-emerald-500"
            >
              {userWallets.length === 0 ? (
                <option value="">لا توجد محافظ - أضف محفظة أولاً</option>
              ) : (
                userWallets.map((w) => (
                  <option key={w.id} value={w.network}>
                    {SUPPORTED_NETWORKS.find(n => n.id === w.network)?.icon} {w.network} - {w.address.slice(0, 10)}...
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-400 block mb-1">المبلغ ($)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleWithdraw}
                disabled={isLoading || balance === 0 || userWallets.length === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <ArrowUpRight size={18} />
                {isLoading ? "جاري..." : "سحب"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">⚠️ الحد الأدنى للسحب: $10 | الحد الأقصى: $10,000</p>
        </div>
      </div>

      {/* ✅ آخر المعاملات */}
      <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <History size={18} />
          آخر المعاملات
        </h3>
        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={tx.amount > 0 ? "text-emerald-400" : "text-red-400"}>
                    {tx.type === "PROFIT" && "📈"}
                    {tx.type === "WITHDRAW" && "💸"}
                    {tx.type === "DEPOSIT" && "💰"}
                    {tx.type === "COMMISSION" && "🏦"}
                  </span>
                  <span className="text-gray-300">{tx.description}</span>
                </div>
                <span className={tx.amount > 0 ? "text-emerald-400" : "text-red-400"}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}$
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyWalletPage;
