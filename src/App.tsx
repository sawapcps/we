// src/App.tsx

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { BotControlPage } from './pages/BotControlPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketsPage } from './pages/MarketsPage';
import { AIAnalysisPage } from './pages/AIAnalysisPage';
import { WalletPage } from './pages/WalletPage';
import { MyWalletPage } from './pages/MyWalletPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { madarCreate } from './lib/madarTech';
import type { DiscoveredToken } from './types';

function Navigation() {
  const { isRunning, user, isAdmin, logout } = useApp();

  if (!user) return null;

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <span className="font-bold text-white">CryptoBot</span>
            {isRunning && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                LIVE
              </span>
            )}
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white">
                👑 ADMIN
              </span>
            )}
          </div>
          <div className="flex gap-1 items-center">
            <Link to="/" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              📊 لوحة التحكم
            </Link>
            <Link to="/bot" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              🤖 البوت
            </Link>
            <Link to="/markets" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              📈 الأسواق
            </Link>
            <Link to="/ai" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              🧠 AI
            </Link>
            <Link to="/wallet" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              💰 محفظة البوت
            </Link>
            <Link to="/my-wallet" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              💳 محفظتي
            </Link>
            {isAdmin && (
              <Link to="/admin" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-purple-400 hover:text-purple-300 text-sm transition-all">
                👑 إدارة
              </Link>
            )}
            <Link to="/settings" className="px-3 py-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white text-sm transition-all">
              ⚙️ الإعدادات
            </Link>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm transition-all"
            >
              🚪 خروج
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { user } = useApp();
  const [pendingAnalysis, setPendingAnalysis] = useState<{ token: DiscoveredToken } | null>(null);

  const handleAnalyzeToken = async (token: DiscoveredToken) => {
    console.log('🔍 تحليل العملة:', token.symbol);
    
    // ✅ تخزين في localStorage
    localStorage.setItem('pendingAnalysis', JSON.stringify({ token }));
    
    // ✅ تخزين في قاعدة البيانات السحابية
    if (user?.id) {
      try {
        await madarCreate('pending_analyses', {
          userId: user.id,
          tokenAddress: token.tokenAddress,
          tokenData: JSON.stringify(token),
          status: 'pending',
        });
        console.log('✅ تم تخزين العملة في قاعدة البيانات');
      } catch (error) {
        console.error('❌ خطأ في تخزين العملة:', error);
      }
    }
    
    // ✅ تحديث state
    setPendingAnalysis({ token });
    
    // ✅ الانتقال إلى صفحة AI
    window.location.href = '/ai';
  };

  const handleConsumePending = () => {
    setPendingAnalysis(null);
  };

  if (!user) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/bot" element={<BotControlPage />} />
          <Route path="/markets" element={<MarketsPage onAnalyzeToken={handleAnalyzeToken} />} />
          <Route path="/ai" element={<AIAnalysisPage pendingAnalysis={pendingAnalysis} onConsumePending={handleConsumePending} />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/my-wallet" element={<MyWalletPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;