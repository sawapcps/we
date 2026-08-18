// src/pages/LoginPage.tsx

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AccountManager } from '../lib/accounts';

export function LoginPage() {
  const { setUser, setIsAdmin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // بيانات الأدمن
  const ADMIN_EMAIL = 'admin@cryptobot.com';
  const ADMIN_PASSWORD = '12345678910';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // ============ تسجيل دخول الأدمن ============
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        setUser({ id: 'admin', email: ADMIN_EMAIL, isAdmin: true });
        setIsAdmin(true);
        localStorage.setItem('user', JSON.stringify({ id: 'admin', email: ADMIN_EMAIL, isAdmin: true }));
        window.location.href = '/';
        return;
      }

      if (isLogin) {
        // ============ تسجيل دخول مستخدم عادي ============
        const user = await AccountManager.verifyPassword(email, password);
        if (!user) {
          setError('❌ البريد الإلكتروني أو كلمة المرور غير صحيحة');
          return;
        }
        setUser({ ...user, isAdmin: false });
        setIsAdmin(false);
        localStorage.setItem('user', JSON.stringify({ ...user, isAdmin: false }));
        window.location.href = '/';
      } else {
        // ============ إنشاء حساب جديد ============
        if (!walletAddress) {
          setError('❌ الرجاء إدخال عنوان محفظتك');
          return;
        }
        if (password.length < 6) {
          setError('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          return;
        }
        const newUser = await AccountManager.createAccount(email, password, walletAddress);
        setUser({ ...newUser, isAdmin: false });
        setIsAdmin(false);
        localStorage.setItem('user', JSON.stringify({ ...newUser, isAdmin: false }));
        window.location.href = '/';
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl w-[420px] border border-slate-700 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-3xl font-bold text-white">CryptoBot</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? '🔐 تسجيل الدخول إلى حسابك' : '📝 إنشاء حساب جديد'}
          </p>
        </div>

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

          <div className="border-t border-slate-700 pt-4 mt-2">
            <p className="text-xs text-slate-500 text-center">
              🔒 جميع البيانات مشفرة ومخزنة في سحابة MadarTech
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;