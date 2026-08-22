// src/pages/LoginPage.tsx

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AccountManager } from '../lib/accounts';

export function LoginPage() {
    console.log('🔍 LoginPage: تم تحميل الصفحة!');

  const { setUser, setIsAdmin, connectWallet, walletProviders, addLog } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  // ============================================================
  // ✅ تسجيل الدخول بالبريد وكلمة المرور
  // ============================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // ✅ تسجيل الدخول
        const user = await AccountManager.verifyPassword(email, password);
        
        if (!user) {
          setError('❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
          return;
        }
        
        const isAdmin = user.isAdmin || false;
        const userData = {
          id: String(user.id),
          email: user.email,
          username: user.username || user.email?.split('@')[0] || '',
          isAdmin: isAdmin,
          balance: user.balance || 0,
          walletAddress: user.walletAddress || '',
          status: user.status || 'active',
        };
        
        setUser(userData);
        setIsAdmin(isAdmin);
        localStorage.setItem('user', JSON.stringify(userData));
        
        window.location.href = '/';
      } else {
        // ✅ إنشاء حساب جديد
        if (!walletAddress) {
          setError('❌ الرجاء إدخال عنوان محفظتك');
          return;
        }
        if (password.length < 6) {
          setError('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          return;
        }
        
        const newUser = await AccountManager.createAccount(email, password, walletAddress);
        
        const userData = {
          id: String(newUser.id),
          email: newUser.email,
          username: newUser.username || email.split('@')[0],
          isAdmin: false,
          balance: newUser.balance || 0,
          walletAddress: newUser.walletAddress || '',
          status: newUser.status || 'active',
        };
        
        setUser(userData);
        setIsAdmin(false);
        localStorage.setItem('user', JSON.stringify(userData));
        
        window.location.href = '/';
      }
    } catch (err) {
      console.error('❌ خطأ في تسجيل الدخول:', err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // 🔥 تسجيل الدخول بالمحفظة (جديد)
  // ============================================================

  const handleWalletLogin = async (providerId: string) => {
    setError('');
    setIsWalletLoading(true);

    try {
      // 1. ربط المحفظة
      const address = await connectWallet(providerId);
      if (!address) {
        setError('❌ فشل ربط المحفظة');
        return;
      }

      await addLog('INFO', `🔑 محاولة الدخول بالمحفظة: ${address.slice(0, 8)}...`);

      // 2. البحث عن المستخدم بعنوان المحفظة
      const user = await AccountManager.findUserByWallet(address);
      
      let userData;
      
      if (user) {
        // ✅ مستخدم موجود
        await addLog('SUCCESS', `✅ تسجيل الدخول بالمحفظة: ${address.slice(0, 8)}...`);
        
        const isAdmin = user.isAdmin || false;
        userData = {
          id: String(user.id),
          email: user.email,
          username: user.username || user.email?.split('@')[0] || '',
          isAdmin: isAdmin,
          balance: user.balance || 0,
          walletAddress: user.walletAddress || address,
          status: user.status || 'active',
        };
      } else {
        // ❌ مستخدم جديد → إنشاء حساب تلقائي
        await addLog('INFO', `🆕 مستخدم جديد بالمحفظة: ${address.slice(0, 8)}...`);
        
        // إنشاء حساب جديد
        const newUser = await AccountManager.createAccountFromWallet(
          address,
          providerId
        );
        
        await addLog('SUCCESS', `✅ تم إنشاء حساب جديد للمحفظة: ${address.slice(0, 8)}...`);
        
        userData = {
          id: String(newUser.id),
          email: newUser.email,
          username: newUser.username || `wallet_${address.slice(0, 8)}`,
          isAdmin: false,
          balance: newUser.balance || 0,
          walletAddress: newUser.walletAddress || address,
          status: newUser.status || 'active',
        };
      }

      // 3. تسجيل الدخول
      setUser(userData);
      setIsAdmin(userData.isAdmin || false);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 4. الانتقال للصفحة الرئيسية
      window.location.href = '/';
      
    } catch (err) {
      console.error('❌ فشل الدخول بالمحفظة:', err);
      setError(String(err));
    } finally {
      setIsWalletLoading(false);
    }
  };

  // ============================================================
  // 🎨 واجهة الدخول المزدوج
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl w-[440px] border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-3xl font-bold text-white">CryptoBot</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? '🔐 تسجيل الدخول إلى حسابك' : '📝 إنشاء حساب جديد'}
          </p>
        </div>

        {/* ============================================================
            🔥 قسم الدخول بالمحفظة (جديد)
            ============================================================ */}
        <div className="mb-6">
          <p className="text-sm text-slate-400 text-center mb-3">🔑 أو ادخل بمحفظتك</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {walletProviders.map((provider) => {
              if (provider.id === 'walletconnect') return null;
              return (
                <button
                  key={provider.id}
                  onClick={() => handleWalletLogin(provider.id)}
                  disabled={isWalletLoading}
                  className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                    provider.installed
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                  }`}
                  title={provider.installed ? `دخول بـ ${provider.name}` : `${provider.name} غير مثبتة`}
                >
                  <span>{provider.icon}</span>
                  <span className="text-sm">{provider.name}</span>
                  {!provider.installed && (
                    <span className="text-xs text-slate-500">⚠️</span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => handleWalletLogin('walletconnect')}
              disabled={isWalletLoading}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2"
            >
              <span>🔗</span>
              <span className="text-sm">WalletConnect</span>
            </button>
          </div>
          {isWalletLoading && (
            <p className="text-center text-sm text-emerald-400 mt-2">
              ⏳ جاري ربط المحفظة...
            </p>
          )}
          <p className="text-xs text-slate-500 text-center mt-2">
            💡 سيتم إنشاء حساب تلقائياً إذا لم يكن موجوداً
          </p>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-slate-800 text-slate-500">أو</span>
          </div>
        </div>

        {/* ============================================================
            📧 قسم تسجيل الدخول بالبريد
            ============================================================ */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">عنوان محفظتك (للسحب)</label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x... أو Solana address"
                className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                required
              />
              <p className="text-xs text-slate-500 mt-1">⚠️ عنوان محفظتك الشخصية لاستلام الأرباح</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري...
              </>
            ) : (
              isLogin ? '🚀 دخول' : '✨ إنشاء حساب'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="w-full text-sm text-slate-400 hover:text-white transition-colors mt-2"
          >
            {isLogin ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ سجل دخول'}
          </button>
        </form>

        <div className="border-t border-slate-700 pt-4 mt-4">
          <p className="text-xs text-slate-500 text-center">
            🔒 جميع البيانات مشفرة ومخزنة في سحابة MadarTech
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;