// src/pages/LoginPage.tsx
// ✅ نسخة مبسطة - فقط تسجيل الدخول بالبريد وكلمة المرور
// ✅ بدون الدخول بالمحفظة

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AccountManager } from '../lib/accounts';

export function LoginPage() {
  console.log('🔍 LoginPage: تم تحميل الصفحة!');

  const { setUser, setIsAdmin, addLog } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ============================================================
  // ✅ دالة تسجيل الدخول / إنشاء حساب
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
        
        await addLog('SUCCESS', `✅ تسجيل دخول: ${email}`);
        window.location.href = '/';
      } else {
        // ✅ إنشاء حساب جديد
        if (password.length < 6) {
          setError('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          return;
        }
        
        // ✅ إنشاء عنوان محفظة افتراضي تلقائياً
        const defaultWalletAddress = `user_${Date.now()}`;
        const newUser = await AccountManager.createAccount(email, password, defaultWalletAddress);
        
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
        
        await addLog('SUCCESS', `✅ حساب جديد: ${email}`);
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
  // 🎨 واجهة تسجيل الدخول
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-slate-800/80 backdrop-blur-sm p-8 rounded-2xl w-[420px] border border-slate-700 shadow-2xl">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-3xl font-bold text-white">MadarTech</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? '🔐 تسجيل الدخول إلى حسابك' : '📝 إنشاء حساب جديد'}
          </p>
        </div>

        {/* ✅ نموذج تسجيل الدخول (بدون محفظة) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">📧 البريد الإلكتروني</label>
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
            <label className="text-sm text-slate-400 block mb-1">🔒 كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              required
              minLength={6}
            />
            {!isLogin && (
              <p className="text-xs text-slate-500 mt-1">📌 كلمة المرور يجب أن تكون 6 أحرف على الأقل</p>
            )}
          </div>

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

        {/* ✅ معلومات إضافية */}
        <div className="border-t border-slate-700 pt-4 mt-4">
          <p className="text-xs text-slate-500 text-center">
            🔒 جميع البيانات مشفرة ومخزنة في سحابة MadarTech
          </p>
          <p className="text-xs text-emerald-400 text-center mt-1">
            💡 يمكنك إنشاء محفظتك بعد تسجيل الدخول من صفحة "محفظتي"
          </p>
        </div>

        {/* ✅ زر الضيف (اختياري) */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={async () => {
              try {
                const guestEmail = `guest_${Date.now()}@temp.com`;
                const guestPassword = 'guest123';
                const defaultWalletAddress = `guest_${Date.now()}`;
                const newUser = await AccountManager.createAccount(guestEmail, guestPassword, defaultWalletAddress);
                
                const userData = {
                  id: String(newUser.id),
                  email: newUser.email,
                  username: 'زائر',
                  isAdmin: false,
                  balance: 0,
                  walletAddress: newUser.walletAddress || '',
                  status: 'active',
                };
                
                setUser(userData);
                setIsAdmin(false);
                localStorage.setItem('user', JSON.stringify(userData));
                
                await addLog('SUCCESS', '👤 دخول كضيف');
                window.location.href = '/';
              } catch (err) {
                console.error('❌ فشل دخول الضيف:', err);
                setError('❌ فشل الدخول كضيف');
              }
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            👤 الدخول كضيف (تجريبي)
          </button>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
