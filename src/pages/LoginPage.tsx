// src/pages/LoginPage.tsx
// ============================================================
// ✅ تسجيل الدخول عبر المحفظة فقط (Phantom, MetaMask, WalletConnect)
// ❌ لا يوجد بريد إلكتروني أو كلمة مرور
// ✅ جميع البيانات في localStorage فقط
// ============================================================

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Wallet, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export function LoginPage() {
  console.log('🔍 LoginPage: تم تحميل الصفحة!');

  const { 
    connectWallet, 
    isWalletConnected, 
    walletAddress, 
    user, 
    setUser, 
    addNotification,
    walletProviders 
  } = useApp();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // ✅ التحقق من اتصال المحفظة تلقائياً
  useEffect(() => {
    if (isWalletConnected && walletAddress && !user) {
      handleWalletLogin();
    }
  }, [isWalletConnected, walletAddress]);

  // ✅ تسجيل الدخول عبر المحفظة
  const handleWalletLogin = async () => {
    if (!walletAddress) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // ✅ إنشاء مستخدم من عنوان المحفظة
      const userData = {
        id: walletAddress,
        email: `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`,
        username: `Wallet ${walletAddress.slice(0, 6)}`,
        walletAddress: walletAddress,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        balance: 0,
        status: 'active',
      };
      
      // ✅ حفظ في localStorage فقط
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      addNotification('success', `✅ تم تسجيل الدخول بنجاح عبر المحفظة`);
      console.log('✅ تم تسجيل الدخول عبر المحفظة:', walletAddress);
      
      // ✅ التوجيه إلى الصفحة الرئيسية
      window.location.href = '/';
    } catch (error) {
      setError('فشل تسجيل الدخول عبر المحفظة');
      addNotification('error', '❌ فشل تسجيل الدخول عبر المحفظة');
      console.error('❌ فشل تسجيل الدخول:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // ✅ ربط المحفظة
  const handleConnectWallet = async (providerId: string) => {
    setIsConnecting(true);
    setConnectingProvider(providerId);
    setError(null);
    
    try {
      await connectWallet(providerId);
      // ✅ سيتم تسجيل الدخول تلقائياً في useEffect
    } catch (error) {
      const providerName = providerId === 'phantom' ? 'Phantom' :
                          providerId === 'metamask' ? 'MetaMask' : 'WalletConnect';
      setError(`فشل ربط ${providerName}`);
      addNotification('error', `❌ فشل ربط ${providerName}`);
      console.error('❌ فشل ربط المحفظة:', error);
    } finally {
      setIsConnecting(false);
      setConnectingProvider(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-lg shadow-[#10b981]/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mt-4">
            Madar<span className="text-[#10b981]">Tech</span>
          </h1>
          <p className="text-[#64748b] text-sm mt-2">تسجيل الدخول عبر المحفظة</p>
        </div>

        {/* ✅ بطاقة ربط المحفظة */}
        <div className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#10b981]" />
            ربط المحفظة
          </h2>
          
          <p className="text-sm text-[#64748b] mb-6">
            قم بربط محفظتك للوصول إلى لوحة التحكم وإدارة البوتات
          </p>

          {/* ✅ أزرار ربط المحفظة */}
          <div className="space-y-3">
            {/* Phantom */}
            <button
              onClick={() => handleConnectWallet('phantom')}
              disabled={isConnecting}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 text-[#8b5cf6] font-medium transition-all duration-200 border border-[#8b5cf6]/20 hover:border-[#8b5cf6]/40 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🟣</span>
                <span>Phantom Wallet</span>
              </span>
              {isConnecting && connectingProvider === 'phantom' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            {/* MetaMask */}
            <button
              onClick={() => handleConnectWallet('metamask')}
              disabled={isConnecting}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 text-[#f59e0b] font-medium transition-all duration-200 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🦊</span>
                <span>MetaMask</span>
              </span>
              {isConnecting && connectingProvider === 'metamask' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              )}
            </button>

            {/* WalletConnect */}
            <button
              onClick={() => handleConnectWallet('walletconnect')}
              disabled={isConnecting}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-xl bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 text-[#3b82f6] font-medium transition-all duration-200 border border-[#3b82f6]/20 hover:border-[#3b82f6]/40 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🔗</span>
                <span>WalletConnect</span>
              </span>
              {isConnecting && connectingProvider === 'walletconnect' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>

          {/* ✅ حالة الاتصال */}
          {isConnecting && !connectingProvider && (
            <div className="mt-4 text-center text-[#10b981] text-sm">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              جاري ربط المحفظة...
            </div>
          )}

          {/* ✅ عرض الخطأ */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ✅ عرض عنوان المحفظة المتصل */}
          {isWalletConnected && walletAddress && (
            <div className="mt-4 p-4 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-sm text-center">
              ✅ متصل: <span className="font-mono">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
            </div>
          )}
        </div>

        {/* ✅ معلومات إضافية */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-[#64748b] text-xs">
            🔒 يتم تسجيل الدخول عبر المحفظة فقط، لا حاجة لبريد إلكتروني أو كلمة مرور
          </p>
          <p className="text-[#64748b] text-xs">
            💾 جميع البيانات مخزنة محلياً في متصفحك (localStorage)
          </p>
          <p className="text-[#10b981] text-xs">
            🚀 الصفقات فقط تُحفظ في قاعدة البيانات السحابية
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;