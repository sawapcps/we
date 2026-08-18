// src/pages/AdminPage.tsx

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AccountManager } from '../lib/accounts';
import { BotWalletManager } from '../lib/wallet';
import { madarRead, madarCreate, madarUpdate } from '../lib/madarTech';

export function AdminPage() {
  const { user, isAdmin, addLog } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminWallets, setAdminWallets] = useState<Record<string, string>>({
    solana: '',
    ethereum: '',
    bsc: '',
    polygon: '',
    arbitrum: '',
    base: '',
    avalanche: '',
    optimism: '',
  });
  const [isEditingWallets, setIsEditingWallets] = useState(false);
  const [walletSaved, setWalletSaved] = useState(false);

  useEffect(() => {
    loadData();
    loadAdminWallets();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allUsers = await AccountManager.getAllUsers();
      setUsers(allUsers);
      
      const systemStats = await AccountManager.getSystemStats();
      setStats(systemStats);
      
      const botWallet = BotWalletManager.getInstance();
      const allWallets = botWallet.getAllWallets();
      setWallets(allWallets);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminWallets = async () => {
    try {
      const result = await madarRead('admin_settings', {});
      if (result.success && result.data && result.data.length > 0) {
        const settings = result.data[0];
        if (settings.wallets) {
          try {
            const parsed = JSON.parse(settings.wallets);
            setAdminWallets({ ...adminWallets, ...parsed });
          } catch {
            // إذا كان التنسيق القديم (محفظة واحدة)
            if (settings.walletAddress) {
              setAdminWallets({ ...adminWallets, solana: settings.walletAddress });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading admin wallets:', error);
    }
  };

  const saveAdminWallets = async () => {
    // التحقق من وجود محفظة واحدة على الأقل
    const hasWallet = Object.values(adminWallets).some(w => w && w.trim() !== '');
    if (!hasWallet) {
      alert("❌ الرجاء إدخال عنوان محفظة واحدة على الأقل");
      return;
    }

    try {
      const result = await madarRead('admin_settings', {});
      const data = {
        wallets: JSON.stringify(adminWallets),
        updatedAt: new Date().toISOString()
      };

      if (result.success && result.data && result.data.length > 0) {
        await madarUpdate('admin_settings', result.data[0].id, data);
      } else {
        await madarCreate('admin_settings', data);
      }
      
      setWalletSaved(true);
      setIsEditingWallets(false);
      addLog('SUCCESS', '✅ تم حفظ محافظ الأدمن بنجاح');
      alert('✅ تم حفظ محافظ الأدمن بنجاح');
      
      setTimeout(() => setWalletSaved(false), 5000);
    } catch (error) {
      alert('❌ فشل حفظ المحافظ: ' + String(error));
      addLog('ERROR', '❌ فشل حفظ محافظ الأدمن: ' + String(error));
    }
  };

  // التحقق من صلاحية الأدمن
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-white">غير مصرح</h1>
          <p className="text-slate-400">هذه الصفحة مخصصة للأدمن فقط</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-slate-400">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const networkLabels: Record<string, { icon: string; name: string }> = {
    solana: { icon: '🟣', name: 'Solana' },
    ethereum: { icon: '🔵', name: 'Ethereum' },
    bsc: { icon: '🟡', name: 'BNB Chain' },
    polygon: { icon: '🟣', name: 'Polygon' },
    arbitrum: { icon: '🔷', name: 'Arbitrum' },
    base: { icon: '🔷', name: 'Base' },
    avalanche: { icon: '🔴', name: 'Avalanche' },
    optimism: { icon: '🔴', name: 'Optimism' },
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">👑 لوحة التحكم الإدارية</h1>
          <p className="text-slate-400 text-sm">إدارة المستخدمين والإحصائيات والأرباح</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
        >
          🔄 تحديث
        </button>
      </div>

      {/* محافظ الأدمن (متعددة) */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <span className="text-2xl">💰</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-400">محافظ الأدمن (للأرباح 15%)</h3>
            <p className="text-sm text-slate-400">
              سيتم تحويل <span className="text-amber-400 font-bold">15%</span> من الأرباح تلقائياً إلى المحفظة المناسبة لكل شبكة
            </p>
          </div>
        </div>
        
        <div className="mt-3">
          {isEditingWallets ? (
            <div className="space-y-2">
              {Object.entries(adminWallets).map(([network, address]) => {
                const label = networkLabels[network];
                if (!label) return null;
                return (
                  <div key={network} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-28">{label.icon} {label.name}</span>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAdminWallets({ ...adminWallets, [network]: e.target.value })}
                      placeholder={`عنوان محفظة ${label.name}`}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={saveAdminWallets}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition-colors"
                >
                  💾 حفظ الكل
                </button>
                <button
                  onClick={() => {
                    setIsEditingWallets(false);
                    loadAdminWallets();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
                >
                  ❌ إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {Object.entries(adminWallets).map(([network, address]) => {
                  const label = networkLabels[network];
                  if (!label) return null;
                  return (
                    <div key={network} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/30 rounded-lg">
                      <span className="text-sm font-medium w-28 text-slate-400">{label.icon} {label.name}</span>
                      <p className="text-sm font-mono text-white truncate flex-1">
                        {address || <span className="text-slate-500">غير محددة</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setIsEditingWallets(true)}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
              >
                ✏️ تعديل المحافظ
              </button>
            </>
          )}
        </div>
        
        {walletSaved && (
          <div className="mt-3 p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
            <p className="text-emerald-400 text-sm">✅ تم حفظ محافظ الأدمن بنجاح!</p>
          </div>
        )}
        
        <div className="mt-2 text-xs text-slate-500">
          💡 سيتم تحويل 15% من أرباح كل شبكة تلقائياً إلى المحفظة المخصصة لها
        </div>
      </div>

      {/* محافظ البوت */}
      <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
        <h3 className="text-sm font-semibold text-white mb-3">🏦 محافظ البوت</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {wallets.length === 0 ? (
            <p className="text-slate-400 text-sm">لا توجد محافظ</p>
          ) : (
            wallets.map((w) => (
              <div key={w.network} className="bg-slate-700/30 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {networkLabels[w.network]?.icon || '💳'} {networkLabels[w.network]?.name || w.network}
                  </span>
                  <span className="text-sm text-emerald-400">${w.balance?.toFixed(2) || '0.00'}</span>
                </div>
                <p className="text-xs font-mono text-slate-400 truncate">{w.address}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">👥 إجمالي المستخدمين</p>
          <p className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">💰 إجمالي الرصيد</p>
          <p className="text-2xl font-bold text-green-500">${stats?.totalBalance?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">📈 إجمالي الأرباح</p>
          <p className="text-2xl font-bold text-blue-500">${stats?.totalProfit?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">🏦 إجمالي العمولات (15%)</p>
          <p className="text-2xl font-bold text-amber-500">${stats?.totalFees?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">🏦 إجمالي محافظ البوت</p>
          <p className="text-2xl font-bold text-purple-500">{wallets.length}</p>
        </div>
      </div>

      {/* قائمة المستخدمين */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">👥 قائمة المستخدمين</h2>
          <p className="text-sm text-slate-400">عدد المستخدمين: {users.length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700 bg-slate-800/50">
                <th className="text-left p-4">#</th>
                <th className="text-left p-4">البريد الإلكتروني</th>
                <th className="text-left p-4">الرصيد</th>
                <th className="text-left p-4">الأرباح</th>
                <th className="text-left p-4">العمولات (15%)</th>
                <th className="text-left p-4">الصفقات</th>
                <th className="text-left p-4">الحالة</th>
                <th className="text-left p-4">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-slate-400">
                    لا يوجد مستخدمين بعد
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-slate-400">{index + 1}</td>
                    <td className="p-4 text-white">{user.email}</td>
                    <td className="p-4 text-green-400">${user.balance?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-blue-400">${user.totalProfit?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-amber-400">${user.totalFees?.toFixed(2) || '0.00'}</td>
                    <td className="p-4 text-white">{user.totalTrades || 0}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.status === 'active' 
                          ? 'bg-green-500/20 text-green-400' 
                          : user.status === 'suspended' 
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {user.status === 'active' ? '✅ نشط' : user.status === 'suspended' ? '⛔ موقوف' : '⏳ معلق'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ملخص سريع */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <h3 className="text-emerald-400 font-semibold">📊 ملخص الأرباح</h3>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-slate-300">إجمالي أرباح المستخدمين: <span className="text-emerald-400">${stats?.totalProfit?.toFixed(2) || '0.00'}</span></p>
            <p className="text-slate-300">إجمالي العمولات (15%): <span className="text-amber-400">${stats?.totalFees?.toFixed(2) || '0.00'}</span></p>
            <p className="text-slate-300">عدد الصفقات المنفذة: <span className="text-white">{stats?.activeTrades || 0}</span></p>
          </div>
        </div>
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <h3 className="text-blue-400 font-semibold">🔐 معلومات الأمان</h3>
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-slate-300">🔒 المفتاح الخاص: <span className="text-emerald-400">مشفر</span></p>
            <p className="text-slate-300">🛡️ قاعدة البيانات: <span className="text-emerald-400">Cloudflare D1</span></p>
            <p className="text-slate-300">👑 حساب الأدمن: <span className="text-emerald-400">مفعل</span></p>
            <p className="text-slate-300">💰 محافظ الأدمن: <span className={Object.values(adminWallets).some(w => w && w.trim() !== '') ? "text-emerald-400" : "text-red-400"}>
              {Object.values(adminWallets).some(w => w && w.trim() !== '') ? "✅ محددة" : "❌ غير محددة"}
            </span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;