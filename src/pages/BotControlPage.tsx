// src/pages/BotControlPage.tsx

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NetworkSelector } from '../components/NetworkSelector';
import { TradingModeSelector } from '../components/TradingModeSelector';
import { generateId, getTimestamp } from '../lib/madarTech';

// ✅ عنوان الـ Worker
const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

export function BotControlPage() {
  const {
    botConfig,
    setBotConfig,
    addLog,
    trades,
    discoveredTokens,
    addDiscoveredToken,
    addTrade,
    isLoading,
    setIsLoading,
  } = useApp();

  const [isRunning, setIsRunning] = useState(false);
  
  // ✅ تهيئة selectedNetworks من localStorage أولاً (الأولوية القصوى)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(() => {
    // 1️⃣ محاولة استعادة من localStorage
    const saved = localStorage.getItem('selectedNetworks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    
    // 2️⃣ إذا لم يوجد في localStorage، استخدم botConfig
    if (botConfig?.networks) {
      if (typeof botConfig.networks === 'string') {
        try {
          const parsed = JSON.parse(botConfig.networks);
          return Array.isArray(parsed) ? parsed : ['solana'];
        } catch {
          return ['solana'];
        }
      }
      if (Array.isArray(botConfig.networks)) {
        return botConfig.networks;
      }
    }
    return ['solana'];
  });
  
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>(botConfig?.mode || 'AUTO');
  const [scanCount, setScanCount] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [buySignals, setBuySignals] = useState<number>(0);

  // ✅ حفظ الشبكات في localStorage عند التغيير
  useEffect(() => {
    localStorage.setItem('selectedNetworks', JSON.stringify(selectedNetworks));
  }, [selectedNetworks]);

  // ✅ تحديث botConfig عند تغيير الشبكات
  useEffect(() => {
    if (botConfig) {
      const updatedConfig = {
        ...botConfig,
        networks: selectedNetworks,
        mode: mode,
      };
      setBotConfig(updatedConfig);
    }
  }, [selectedNetworks, mode]);

  // ✅ تحديث selectedNetworks من botConfig فقط إذا لم يكن هناك قيمة في localStorage
  useEffect(() => {
    // ✅ لا تحديث إذا كان هناك قيمة محفوظة في localStorage
    const saved = localStorage.getItem('selectedNetworks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // إذا كانت الشبكات المحفوظة مختلفة عن botConfig، استخدم المحفوظة
          const savedNetworks = parsed;
          if (JSON.stringify(savedNetworks) !== JSON.stringify(selectedNetworks)) {
            setSelectedNetworks(savedNetworks);
          }
          return;
        }
      } catch (e) {}
    }
    
    // ✅ فقط إذا لم يكن هناك قيمة في localStorage، استخدم botConfig
    if (botConfig?.networks) {
      let networks: string[] = ['solana'];
      if (typeof botConfig.networks === 'string') {
        try {
          networks = JSON.parse(botConfig.networks);
        } catch {
          networks = ['solana'];
        }
      } else if (Array.isArray(botConfig.networks)) {
        networks = botConfig.networks;
      }
      if (JSON.stringify(networks) !== JSON.stringify(selectedNetworks)) {
        setSelectedNetworks(networks);
        localStorage.setItem('selectedNetworks', JSON.stringify(networks));
      }
    }
  }, [botConfig]);

  // ✅ جلب حالة البوت من الـ Worker عند تحميل الصفحة
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/status`);
        const data = await res.json();
        setIsRunning(data.isRunning);
        if (data.isRunning) {
          addLog('INFO', '🤖 البوت يعمل بالفعل (تم استعادة الحالة)');
        }
      } catch (error) {
        console.error('❌ فشل جلب حالة البوت:', error);
      }
    };
    checkStatus();
  }, []);

  // ✅ عند تغيير الشبكات، أوقف البوت ثم أعد تشغيله
  useEffect(() => {
    if (isRunning && botConfig) {
      const restartBot = async () => {
        await handleStop();
        const updatedConfig = {
          ...botConfig,
          networks: selectedNetworks,
        };
        setBotConfig(updatedConfig);
        setTimeout(() => {
          handleStart();
        }, 1500);
      };
      restartBot();
    }
  }, [selectedNetworks]);

  // ============ SIMULATE BOT SCAN ============

  const performScan = async () => {
    if (!isRunning) return;

    setIsLoading(true);

    try {
      const networkList = Array.isArray(selectedNetworks) ? selectedNetworks : ['solana'];
      
      const mockTokens = generateMockTokens(networkList);
      setDiscoveredCount(mockTokens.length);

      const analyzed = mockTokens.filter(t => t.score > 60);
      const buyCandidates = analyzed.filter(t => t.recommendation === 'BUY');

      setBuySignals(buyCandidates.length);

      for (const token of mockTokens) {
        await addDiscoveredToken({
          id: generateId(),
          tokenAddress: token.address,
          network: token.network,
          name: token.name,
          symbol: token.symbol,
          price: token.price,
          liquidity: token.liquidity,
          volume24h: token.volume24h,
          priceChange24h: token.priceChange24h,
          age: token.age,
          score: token.score,
          status: token.score > 60 ? 'ANALYZED' : 'REJECTED',
          discoveredAt: getTimestamp(),
        });
      }

      if (mode === 'AUTO' && buyCandidates.length > 0) {
        const topTrades = buyCandidates.slice(0, 3);
        for (const trade of topTrades) {
          await addTrade({
            id: generateId(),
            token: trade.symbol,
            tokenAddress: trade.address,
            network: trade.network,
            amount: 50 + Math.random() * 50,
            price: trade.price,
            type: 'BUY',
            status: 'EXECUTED',
            timestamp: getTimestamp(),
            txHash: `0x${generateId()}`,
          });
        }
        await addLog('SUCCESS', `تم تنفيذ ${topTrades.length} صفقات في الوضع التلقائي`);
      }

      if (mode === 'MANUAL' && buyCandidates.length > 0) {
        await addLog('INFO', `تم العثور على ${buyCandidates.length} فرصة. انتظر اختيارك.`);
      }

      setScanCount(prev => prev + 1);
      setLastScan(new Date().toLocaleTimeString());

    } catch (error) {
      await addLog('ERROR', `خطأ في المسح: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ============ GENERATE MOCK TOKENS ============

  const generateMockTokens = (networks: string[]) => {
    const tokens: any[] = [];
    const names = ['BONK', 'PEPE', 'WIF', 'DOGE', 'SHIB', 'FLOKI', 'BABYDOGE', 'MOON', 'STAR', 'NOVA'];
    const symbols = ['BONK', 'PEPE', 'WIF', 'DOGE', 'SHIB', 'FLOKI', 'BABY', 'MOON', 'STAR', 'NOVA'];
    
    const networkList = Array.isArray(networks) && networks.length > 0 ? networks : ['solana'];
    
    for (let i = 0; i < 20; i++) {
      const network = networkList[Math.floor(Math.random() * networkList.length)];
      const isGood = Math.random() > 0.6;
      tokens.push({
        address: `0x${generateId()}${generateId()}`,
        network,
        name: names[Math.floor(Math.random() * names.length)] + (i > 5 ? ` ${i}` : ''),
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        price: 0.0001 + Math.random() * 0.01,
        liquidity: 10000 + Math.random() * 500000,
        volume24h: 50000 + Math.random() * 2000000,
        priceChange24h: isGood ? 5 + Math.random() * 50 : -5 - Math.random() * 20,
        age: Math.floor(Math.random() * 48),
        score: isGood ? 60 + Math.random() * 35 : 20 + Math.random() * 40,
        recommendation: isGood ? 'BUY' : 'HOLD',
      });
    }
    return tokens;
  };

  // ============ HANDLERS ============

  // ✅ تشغيل البوت عبر Worker
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode === 'AUTO' ? 'normal-bot' : 'manual' }),
      });
      const data = await res.json();
      if (data.success) {
        setIsRunning(true);
        await addLog('SUCCESS', `🤖 تم تشغيل البوت في وضع ${mode === 'AUTO' ? 'تلقائي' : 'يدوي'} على الشبكات: ${selectedNetworks.join(', ')}`);
        await performScan();
      } else {
        await addLog('ERROR', `❌ فشل تشغيل البوت: ${data.message}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ خطأ: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ إيقاف البوت عبر Worker
  const handleStop = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsRunning(false);
        await addLog('INFO', '⏹️ تم إيقاف البوت');
      } else {
        await addLog('ERROR', `❌ فشل إيقاف البوت: ${data.message}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ خطأ: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ دالة موحدة للزر
  const handleStartStop = async () => {
    if (isRunning) {
      await handleStop();
    } else {
      await handleStart();
    }
  };

  // Auto-scan loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(performScan, 300000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, mode, selectedNetworks]);

  // ============ RENDER ============

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🤖 التحكم في البوت</h1>
        <p className="text-gray-500 dark:text-gray-400">تحكم في إعدادات البوت وشغله أو أوقفه</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-2xl font-bold">{scanCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">عدد المسحات</div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-2xl font-bold">{discoveredCount}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">عملات مكتشفة</div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-2xl font-bold text-green-500">{buySignals}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">إشارات شراء</div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="text-2xl font-bold">{trades.filter(t => t.status === 'EXECUTED').length}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">صفقات منفذة</div>
        </div>
      </div>

      {/* Network Selector */}
      <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <NetworkSelector
          selectedNetworks={selectedNetworks}
          onNetworkChange={setSelectedNetworks}
        />
      </div>

      {/* Mode Selector */}
      <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <TradingModeSelector
          mode={mode}
          onModeChange={setMode}
          isRunning={isRunning}
          onStartStop={handleStartStop}
          disabled={isLoading}
        />
      </div>

      {/* Status */}
      {lastScan && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          ⏱️ آخر مسح: {lastScan}
        </div>
      )}

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium mb-3">📊 آخر الصفقات</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trades.slice(0, 5).map(trade => (
              <div key={trade.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="flex items-center gap-2">
                  <span className={trade.type === 'BUY' ? 'text-green-500' : 'text-red-500'}>
                    {trade.type === 'BUY' ? '📈' : '📉'}
                  </span>
                  <span className="font-medium">{trade.token}</span>
                  <span className="text-gray-500 text-xs">{trade.network}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>${trade.amount.toFixed(2)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    trade.status === 'EXECUTED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                    trade.status === 'FAILED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {trade.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
