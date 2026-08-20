// src/pages/ManualTradesPage.tsx

import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { AccountManager, BotToken } from '../lib/accounts';
import { discoverAllPairs } from '../lib/discovery';
import { NETWORKS, getNetworkColor, getNetworkName } from '../config/networks';
import { 
  TrendingUp, TrendingDown, Loader2, XCircle, Search, 
  Plus, Minus, Sparkles, Globe, Filter, Clock, Star,
  Zap, Droplets, BarChart3, ShieldCheck, Trophy, Eye,
  Sliders, DollarSign, AlertCircle, Copy, CheckCircle,
  Network, RefreshCw, Key
} from 'lucide-react';

const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

interface Signal {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  network: string;
  price: number;
  score: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  aiOpinion?: string;
  createdAt: string;
  ageInSeconds?: number;
  isNew?: boolean;
  liquidity?: number;
  volume?: number;
  priceChange24h?: number;
  confidence?: number;
}

type FilterType = 'all' | 'good' | 'new' | 'old' | 'high_volume' | 'high_liquidity' | 'momentum';

export function ManualTradesPage() {
  const { 
    addLog, 
    trades, 
    addTrade, 
    isLoading, 
    setIsLoading, 
    botConfig,
    user
  } = useApp();
  
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filteredSignals, setFilteredSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [executing, setExecuting] = useState(false);
  const [amount, setAmount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIOpinions, setShowAIOpinions] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [ageFilter, setAgeFilter] = useState<number | null>(null);
  const [minLiquidityFilter, setMinLiquidityFilter] = useState<number>(0);
  const [minVolumeFilter, setMinVolumeFilter] = useState<number>(0);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('solana');
  const [allPairs, setAllPairs] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // ✅ حالات رمز البوت والمحفظة
  const [botTokenInfo, setBotTokenInfo] = useState<BotToken | null>(null);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [showTokenInfo, setShowTokenInfo] = useState(false);
  const [userWallet, setUserWallet] = useState<any>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  
  const activeNetworks = botConfig?.networks || ['solana'];
  const mountedRef = useRef(true);
  const ITEMS_PER_PAGE = 20;

  // ✅ نسخ العنوان
  const copyToClipboard = (text: string, label: string = 'العنوان') => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    addLog('SUCCESS', `✅ تم نسخ ${label}: ${text.slice(0, 10)}...`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // ============================================================
  // ✅ دالة جلب محفظة المستخدم ورمز البوت الخاص به
  // ============================================================
  
  const loadUserWalletAndToken = async () => {
    if (!user) {
      addLog('WARNING', '⚠️ الرجاء تسجيل الدخول أولاً');
      return;
    }

    setIsLoadingWallet(true);
    try {
      // 1️⃣ جلب محفظة المستخدم
      let wallet = await AccountManager.getUserWallet(user.id, selectedNetwork);
      
      if (!wallet) {
        addLog('INFO', `💡 لا توجد محفظة للمستخدم على ${getNetworkName(selectedNetwork)}، جاري إنشاء محفظة جديدة...`);
        wallet = await AccountManager.createUserWallet(user.id, selectedNetwork);
        addLog('SUCCESS', `✅ تم إنشاء محفظة جديدة للمستخدم: ${wallet.address.slice(0, 10)}...`);
      }
      
      setUserWallet(wallet);

      // 2️⃣ جلب رمز البوت الخاص بالمستخدم
      const tokenResult = await AccountManager.getBotToken(user.id, selectedNetwork);
      
      if (tokenResult) {
        setBotTokenInfo(tokenResult);
        addLog('INFO', `🔑 رمز البوت الخاص بك: ${tokenResult.token}`);
      } else {
        // إنشاء رمز بوت جديد للمستخدم
        addLog('INFO', '🔑 جاري إنشاء رمز بوت خاص بك...');
        const newToken = await AccountManager.createBotToken(
          user.id,
          wallet.id!,
          selectedNetwork
        );
        setBotTokenInfo(newToken);
        addLog('SUCCESS', `✅ تم إنشاء رمز بوت خاص: ${newToken.token}`);
      }
      
    } catch (error: any) {
      addLog('ERROR', `❌ فشل تحميل المحفظة: ${error.message}`);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  // ✅ إنشاء رمز بوت جديد
  const handleCreateNewToken = async () => {
    if (!user || !userWallet) {
      addLog('ERROR', '❌ لا يوجد مستخدم أو محفظة');
      return;
    }

    setIsCreatingToken(true);
    try {
      const newToken = await AccountManager.createBotToken(
        user.id,
        userWallet.id!,
        selectedNetwork
      );
      setBotTokenInfo(newToken);
      addLog('SUCCESS', `✅ تم إنشاء رمز بوت جديد: ${newToken.token}`);
      addLog('INFO', `🔑 المفتاح السري: ${newToken.secretKey} (احتفظ به آمنًا!)`);
      setShowTokenInfo(true);
    } catch (error: any) {
      addLog('ERROR', `❌ فشل إنشاء رمز البوت: ${error.message}`);
    } finally {
      setIsCreatingToken(false);
    }
  };

  // ✅ إلغاء رمز البوت الحالي
  const handleRevokeToken = async () => {
    if (!botTokenInfo) return;
    
    if (!confirm('⚠️ هل أنت متأكد من إلغاء رمز البوت؟ سيتم إيقاف جميع عمليات التداول بهذا الرمز.')) return;
    
    try {
      await AccountManager.revokeBotToken(botTokenInfo.id);
      setBotTokenInfo(null);
      addLog('WARNING', `⚠️ تم إلغاء رمز البوت: ${botTokenInfo.token}`);
    } catch (error: any) {
      addLog('ERROR', `❌ فشل إلغاء رمز البوت: ${error.message}`);
    }
  };

  // ✅ عرض معلومات رمز البوت
  const handleShowTokenInfo = () => {
    setShowTokenInfo(!showTokenInfo);
  };

  // ✅ تحويل بيانات DEX إلى Signal
  const dexPairToSignal = (pair: any): Signal => {
    if (!pair || !pair.baseToken) {
      return {
        id: Math.random().toString(),
        tokenAddress: '',
        tokenSymbol: 'Unknown',
        network: 'solana',
        price: 0,
        score: 0,
        recommendation: 'HOLD',
        reason: '⚠️ بيانات غير مكتملة',
        aiOpinion: '🧠 Gemini AI: لا توجد بيانات كافية',
        createdAt: new Date().toISOString(),
        ageInSeconds: 0,
        isNew: false,
        liquidity: 0,
        volume: 0,
        priceChange24h: 0,
        confidence: 0,
      };
    }

    const price = parseFloat(pair.priceUsd || '0');
    const volume = pair.volume?.h24 || 0;
    const liquidity = pair.liquidity?.usd || 0;
    const change24 = pair.priceChange?.h24 || 0;
    
    let score = 40;
    if (volume > 100000) score += 10;
    if (volume > 500000) score += 5;
    if (liquidity > 50000) score += 10;
    if (liquidity > 200000) score += 5;
    if (change24 > 10) score += 10;
    if (change24 > 50) score += 5;
    if (change24 > 100) score += 5;
    score = Math.min(100, score);
    
    const rec = score >= 70 ? 'BUY' : (score >= 50 ? 'HOLD' : 'SELL');
    
    let ageInSeconds = 0;
    let isNew = false;
    if (pair.pairCreatedAt) {
      const created = new Date(pair.pairCreatedAt).getTime();
      const now = Date.now();
      ageInSeconds = Math.floor((now - created) / 1000);
      isNew = ageInSeconds < 3600;
    }

    let confidence = 50;
    if (liquidity > 100000) confidence += 15;
    if (volume > 500000) confidence += 15;
    if (change24 > 20) confidence += 10;
    if (score > 70) confidence += 10;
    confidence = Math.min(100, confidence);

    return {
      id: pair.baseToken.address || pair.pairAddress || Math.random().toString(),
      tokenAddress: pair.baseToken.address || pair.pairAddress || '',
      tokenSymbol: pair.baseToken.symbol || 'Unknown',
      network: pair.chainId || 'solana',
      price: price,
      score: score,
      recommendation: rec,
      reason: rec === 'BUY' ? '✅ فرصة تداول ممتازة' : (rec === 'SELL' ? '⚠️ مخاطرة عالية' : '⏳ مراقبة'),
      aiOpinion: rec === 'BUY' 
        ? '🧠 Gemini AI: فرصة شراء قوية - حجم وسيولة ممتازة' 
        : (rec === 'SELL' 
          ? '🧠 Gemini AI: انخفاض في السيولة - تجنب' 
          : '🧠 Gemini AI: انتظار تأكيد الاتجاه'),
      createdAt: pair.pairCreatedAt || new Date().toISOString(),
      ageInSeconds: ageInSeconds,
      isNew: isNew,
      liquidity: liquidity,
      volume: volume,
      priceChange24h: change24,
      confidence: confidence,
    };
  };

  // ✅ جلب جميع العملات من الشبكة
  const fetchAllPairs = async (network: string, reset: boolean = true) => {
    if (reset) {
      setAllPairs([]);
      setPage(1);
      setHasMore(true);
    }

    setIsSearching(true);
    try {
      const result = await discoverAllPairs(network as any);
      
      if (!result || !result.pairs || result.pairs.length === 0) {
        addLog('WARNING', `❌ لا توجد بيانات على ${getNetworkName(network)}`);
        setAllPairs([]);
        setHasMore(false);
        return;
      }

      const pairs = result.pairs;
      setAllPairs(pairs);
      
      const limitedPairs = pairs.slice(0, ITEMS_PER_PAGE);
      const signalsData = limitedPairs.map(dexPairToSignal);
      setSignals(signalsData);
      applyFilters(signalsData);
      setHasMore(pairs.length > ITEMS_PER_PAGE);
      
      addLog('SUCCESS', `✅ تم جلب ${pairs.length} عملة من ${getNetworkName(network)}`);
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل جلب البيانات';
      addLog('ERROR', `❌ فشل جلب البيانات: ${msg}`);
      setAllPairs([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  // ✅ تحميل المزيد من العملات
  const loadMore = () => {
    if (!hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const start = (nextPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const morePairs = allPairs.slice(start, end);
    
    if (morePairs.length === 0) {
      setHasMore(false);
      setIsLoadingMore(false);
      return;
    }
    
    const newSignals = morePairs.map(dexPairToSignal);
    setSignals(prev => [...prev, ...newSignals]);
    setPage(nextPage);
    setHasMore(end < allPairs.length);
    setIsLoadingMore(false);
    addLog('SUCCESS', `✅ تم تحميل ${morePairs.length} عملة إضافية`);
  };

  // ✅ جلب العملات من البوت
  const fetchSignals = async () => {
    try {
      const res = await fetch(`${WORKER_URL}/tokens`);
      const data = await res.json();
      
      let tokensData = [];
      if (data.success && data.data && data.data.length > 0) {
        tokensData = data.data;
      } else {
        const now = Date.now();
        tokensData = [
          { symbol: 'BONK', network: 'solana', price: 0.0000345, score: 85, address: '0x123...', createdAt: new Date(now - 10000).toISOString(), volume_24h: 1500000, liquidity: 500000 },
          { symbol: 'PEPE', network: 'ethereum', price: 0.0000123, score: 72, address: '0x234...', createdAt: new Date(now - 300000).toISOString(), volume_24h: 2000000, liquidity: 800000 },
        ];
      }

      const signalsData = tokensData.map((token: any) => {
        const score = token.score || 50;
        const volume = token.volume_24h || 0;
        const liquidity = token.liquidity || 0;
        let ageInSeconds = 0;
        let isNew = false;
        if (token.createdAt) {
          const created = new Date(token.createdAt).getTime();
          const now = Date.now();
          ageInSeconds = Math.floor((now - created) / 1000);
          isNew = ageInSeconds < 3600;
        }
        
        let confidence = 50;
        if (liquidity > 100000) confidence += 15;
        if (volume > 500000) confidence += 15;
        if (score > 70) confidence += 10;
        confidence = Math.min(100, confidence);
        
        return {
          id: token.id || token.address || token.symbol,
          tokenAddress: token.address || '0x...',
          tokenSymbol: token.symbol || 'Unknown',
          network: token.network || 'solana',
          price: token.price || 0,
          score: score,
          recommendation: score >= 70 ? 'BUY' : (score >= 50 ? 'HOLD' : 'SELL'),
          reason: score >= 70 ? '✅ درجة عالية' : (score >= 50 ? '⏳ درجة متوسطة' : '⚠️ درجة منخفضة'),
          aiOpinion: score >= 70 ? '🧠 Gemini AI: فرصة شراء قوية' : (score >= 50 ? '🧠 Gemini AI: مراقبة' : '🧠 Gemini AI: مخاطرة عالية'),
          createdAt: token.createdAt || token.discovered_at || new Date().toISOString(),
          ageInSeconds: ageInSeconds,
          isNew: isNew,
          liquidity: liquidity,
          volume: volume,
          priceChange24h: token.priceChange?.h24 || 0,
          confidence: confidence,
        };
      });

      if (mountedRef.current) {
        setSignals(signalsData);
        applyFilters(signalsData);
        addLog('SUCCESS', `📊 تم جلب ${signalsData.length} إشارة`);
      }
      
    } catch (error) {
      console.error('❌ فشل جلب الإشارات:', error);
      addLog('ERROR', `❌ فشل جلب الإشارات: ${String(error)}`);
    }
  };

  // ✅ البحث المباشر
  const handleDirectSearch = async () => {
    const query = searchQuery.trim();
    
    if (query) {
      setIsSearching(true);
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!data.pairs || data.pairs.length === 0) {
          addLog('WARNING', `❌ لم يتم العثور على "${query}"`);
          setSignals([]);
          setFilteredSignals([]);
          setIsSearching(false);
          return;
        }

        const filtered = data.pairs.filter((p: any) => p.chainId === selectedNetwork);
        if (filtered.length === 0) {
          addLog('WARNING', `❌ لم يتم العثور على "${query}" على ${getNetworkName(selectedNetwork)}`);
          setSignals([]);
          setFilteredSignals([]);
          setIsSearching(false);
          return;
        }

        const signalsData = filtered.map(dexPairToSignal);
        setSignals(signalsData);
        applyFilters(signalsData);
        addLog('SUCCESS', `✅ تم العثور على ${signalsData.length} نتيجة لـ ${query}`);
        
      } catch (error) {
        addLog('ERROR', `❌ فشل البحث: ${error}`);
      } finally {
        setIsSearching(false);
      }
    } else {
      await fetchAllPairs(selectedNetwork, true);
    }
  };

  // ✅ تطبيق الفلاتر
  const applyFilters = (data: Signal[]) => {
    let filtered = [...data];

    if (activeFilter === 'good') {
      filtered = filtered.filter(s => s.score >= 60);
    } else if (activeFilter === 'new') {
      filtered = filtered.filter(s => s.isNew === true);
    } else if (activeFilter === 'old') {
      filtered = filtered.filter(s => s.isNew === false);
    } else if (activeFilter === 'high_volume') {
      filtered = filtered.filter(s => (s.volume || 0) > 500000);
    } else if (activeFilter === 'high_liquidity') {
      filtered = filtered.filter(s => (s.liquidity || 0) > 200000);
    } else if (activeFilter === 'momentum') {
      filtered = filtered.filter(s => (s.priceChange24h || 0) > 20);
    }

    if (ageFilter !== null) {
      filtered = filtered.filter(s => (s.ageInSeconds || 0) <= ageFilter);
    }

    if (minLiquidityFilter > 0) {
      filtered = filtered.filter(s => (s.liquidity || 0) >= minLiquidityFilter);
    }

    if (minVolumeFilter > 0) {
      filtered = filtered.filter(s => (s.volume || 0) >= minVolumeFilter);
    }

    if (minScoreFilter > 0) {
      filtered = filtered.filter(s => s.score >= minScoreFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.tokenSymbol.toLowerCase().includes(q) ||
        s.tokenAddress.toLowerCase().includes(q)
      );
    }

    setFilteredSignals(filtered);
  };

  // ============================================================
  // ✅ ✅ ✅ تنفيذ صفقة باستخدام محفظة المستخدم ورمز البوت الخاص به
  // ============================================================
  const executeTrade = async (signal: Signal, action: 'BUY' | 'SELL') => {
    if (!signal.tokenAddress || signal.tokenAddress === '0x...' || signal.tokenAddress === '') {
      addLog('ERROR', '❌ عنوان العملة غير صحيح');
      return;
    }

    // ✅ التحقق من وجود المستخدم
    if (!user) {
      addLog('ERROR', '❌ الرجاء تسجيل الدخول أولاً');
      return;
    }

    // ✅ التحقق من وجود رمز بوت خاص بالمستخدم
    if (!botTokenInfo || botTokenInfo.status !== 'active') {
      addLog('ERROR', '❌ لا يوجد رمز بوت نشط للمستخدم. الرجاء إنشاء رمز بوت أولاً');
      addLog('INFO', '💡 سيتم إنشاء رمز بوت تلقائياً...');
      await loadUserWalletAndToken();
      if (!botTokenInfo || botTokenInfo.status !== 'active') {
        addLog('ERROR', '❌ فشل إنشاء رمز البوت');
        return;
      }
    }

    setExecuting(true);
    setIsLoading(true);

    try {
      // ✅ جلب محفظة المستخدم (وليست محفظة الأدمن!)
      const userWallet = await AccountManager.getUserWallet(user.id, signal.network);
      if (!userWallet) {
        addLog('ERROR', `❌ لا توجد محفظة للمستخدم على شبكة ${signal.network}`);
        addLog('INFO', '💡 أنشئ محفظة أولاً من صفحة "محفظتي"');
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      // ✅ التحقق من الرصيد
      const balance = await AccountManager.getUserWalletBalance(user.id, signal.network);
      if (balance < amount) {
        addLog('ERROR', `❌ رصيد غير كافٍ. الرصيد: $${balance.toFixed(2)}، المبلغ المطلوب: $${amount}`);
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      // ✅ التحقق من الحد اليومي للصفقات
      const canTrade = await AccountManager.canUserTrade(user.id);
      if (!canTrade) {
        const remaining = await AccountManager.getRemainingTrades(user.id);
        addLog('ERROR', `❌ تجاوزت الحد اليومي للصفقات. المتبقي: ${remaining} صفقة`);
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      // ✅ التحقق من صلاحية رمز البوت
      const isTokenValid = await AccountManager.verifyBotToken(botTokenInfo.token, user.id);
      if (!isTokenValid) {
        addLog('ERROR', '❌ رمز البوت غير صالح أو تم إلغاؤه');
        addLog('INFO', '💡 سيتم إنشاء رمز جديد...');
        const newToken = await AccountManager.createBotToken(
          user.id,
          userWallet.id!,
          signal.network
        );
        setBotTokenInfo(newToken);
        addLog('SUCCESS', `✅ تم إنشاء رمز بوت جديد: ${newToken.token}`);
        setExecuting(false);
        setIsLoading(false);
        return;
      }

      addLog('INFO', `🔄 جاري تنفيذ صفقة ${action} لـ ${signal.tokenSymbol}...`);
      addLog('INFO', `🔑 باستخدام رمز البوت: ${botTokenInfo.token}`);

      const manager = BotWalletManager.getInstance();
      const masterPassword = import.meta.env.VITE_MASTER_PASSWORD || 'default_master_password_please_change';

      // ✅ ✅ ✅ استخدام executeBuyForUser (محفظة المستخدم وليس الأدمن!)
      const result = action === 'BUY' 
        ? await manager.executeBuyForUser({
            userId: user.id,                    // ✅ محفظة المستخدم
            tokenAddress: signal.tokenAddress,
            amount: amount,
            slippage: 0.5,
            password: masterPassword,
            network: signal.network,
          })
        : await manager.executeSellForUser({
            userId: user.id,                    // ✅ محفظة المستخدم
            tokenAddress: signal.tokenAddress,
            amount: amount,
            slippage: 0.5,
            password: masterPassword,
            network: signal.network,
          });

      if (result.success) {
        // ✅ تحديث عدد الصفقات اليومية للمستخدم
        await AccountManager.incrementUserTrades(user.id);
        
        // ✅ تحديث آخر استخدام لرمز البوت
        await AccountManager.updateBotTokenLastUsed(botTokenInfo.id);
        
        // ✅ تسجيل الصفقة باسم المستخدم ورمزه
        await addTrade({
          id: `manual-${Date.now()}`,
          token: signal.tokenSymbol,
          tokenAddress: signal.tokenAddress,
          network: signal.network,
          amount: result.amount || amount,
          price: signal.price,
          type: action,
          status: 'EXECUTED',
          timestamp: new Date().toISOString(),
          txHash: result.txHash || `0x${Date.now()}`,
          userId: user.id,           // ✅ ربط الصفقة بالمستخدم
          botToken: botTokenInfo.token, // ✅ ربط الصفقة برمز البوت
        });

        addLog('SUCCESS', `✅ تم تنفيذ صفقة ${action} لـ ${signal.tokenSymbol} بنجاح!`);
        addLog('INFO', `🔑 باستخدام رمز البوت: ${botTokenInfo.token}`);
        
        setSelectedSignal(null);
        setAmount(50);
        setTimeout(() => {
          fetchSignals();
          if (!searchQuery.trim()) {
            fetchAllPairs(selectedNetwork, true);
          }
        }, 2000);
      } else {
        addLog('ERROR', `❌ فشل التنفيذ: ${result.error}`);
      }
    } catch (error: any) {
      addLog('ERROR', `❌ خطأ: ${error.message}`);
    } finally {
      setExecuting(false);
      setIsLoading(false);
    }
  };

  // ============================================================
  // ✅ useEffect - تحميل محفظة المستخدم ورمز البوت عند التحميل
  // ============================================================
  useEffect(() => {
    if (user) {
      loadUserWalletAndToken();
    }
  }, [user, selectedNetwork]);

  useEffect(() => {
    applyFilters(signals);
  }, [signals, activeFilter, ageFilter, minLiquidityFilter, minVolumeFilter, minScoreFilter, searchQuery]);

  useEffect(() => {
    if (mountedRef.current) {
      fetchAllPairs(selectedNetwork, true);
    }
    const interval = setInterval(() => {
      if (!searchQuery.trim()) {
        fetchAllPairs(selectedNetwork, false);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedNetwork]);

  const buySignals = filteredSignals.filter(s => s.recommendation === 'BUY');
  const holdSignals = filteredSignals.filter(s => s.recommendation === 'HOLD');
  const sellSignals = filteredSignals.filter(s => s.recommendation === 'SELL');

  const ageFilterOptions = [
    { label: 'الكل', value: null },
    { label: 'ثانية', value: 1 },
    { label: '5 ثواني', value: 5 },
    { label: '10 ثواني', value: 10 },
    { label: '30 ثانية', value: 30 },
    { label: 'دقيقة', value: 60 },
    { label: '5 دقائق', value: 300 },
    { label: '10 دقائق', value: 600 },
    { label: '30 دقيقة', value: 1800 },
    { label: 'ساعة', value: 3600 },
    { label: '6 ساعات', value: 21600 },
    { label: '12 ساعة', value: 43200 },
    { label: 'يوم', value: 86400 },
  ];

  const filterStats = {
    total: filteredSignals.length,
    buy: buySignals.length,
    hold: holdSignals.length,
    sell: sellSignals.length,
    avgScore: filteredSignals.reduce((acc, s) => acc + s.score, 0) / (filteredSignals.length || 1),
    avgLiquidity: filteredSignals.reduce((acc, s) => acc + (s.liquidity || 0), 0) / (filteredSignals.length || 1),
    avgVolume: filteredSignals.reduce((acc, s) => acc + (s.volume || 0), 0) / (filteredSignals.length || 1),
  };

  const availableNetworks = NETWORKS.filter(n => activeNetworks.includes(n.id));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">🖐️ التداول اليدوي</h1>
          <p className="text-gray-500 dark:text-gray-400">
            اختر الإشارات المناسبة أو ابحث عن أي عملة للتداول
          </p>
          <p className="text-xs text-gray-400 mt-1">
            🌐 الشبكات النشطة: {activeNetworks.join(', ')}
          </p>
          {user && (
            <p className="text-xs text-emerald-400 mt-1">
              👤 المستخدم: {user.email}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchAllPairs(selectedNetwork, true)}
          disabled={isSearching}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          تحديث
        </button>
      </div>

      {/* ============================================================ */}
      {/* ✅ ✅ ✅ بطاقة رمز البوت الخاص بالمستخدم */}
      {/* ============================================================ */}
      {user && (
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Key className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-sm">🔑 رمز البوت الخاص بك</h3>
                {isLoadingWallet ? (
                  <p className="text-xs text-gray-400">جاري تحميل رمز البوت...</p>
                ) : botTokenInfo ? (
                  <div>
                    <p className="text-xs font-mono text-purple-400">
                      {botTokenInfo.token}
                      <button
                        onClick={() => copyToClipboard(botTokenInfo.token, 'رمز البوت')}
                        className="ml-2 p-0.5 hover:bg-purple-500/20 rounded transition-colors"
                      >
                        {copiedAddress === botTokenInfo.token ? 
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : 
                          <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                        }
                      </button>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        botTokenInfo.status === 'active' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {botTokenInfo.status === 'active' ? '✅ نشط' : '⛔ غير نشط'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        الصلاحيات: {botTokenInfo.permissions.join(', ')}
                      </span>
                      {botTokenInfo.lastUsed && (
                        <span className="text-[10px] text-gray-500">
                          آخر استخدام: {new Date(botTokenInfo.lastUsed).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-yellow-400">⚠️ لا يوجد رمز بوت. سيتم إنشاؤه تلقائياً عند التداول.</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {botTokenInfo && (
                <>
                  <button
                    onClick={handleShowTokenInfo}
                    className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-xs transition-colors"
                  >
                    {showTokenInfo ? 'إخفاء' : 'عرض المفتاح السري'}
                  </button>
                  <button
                    onClick={handleRevokeToken}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-colors"
                  >
                    إلغاء الرمز
                  </button>
                </>
              )}
              <button
                onClick={handleCreateNewToken}
                disabled={isCreatingToken || !userWallet}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {isCreatingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                إنشاء رمز جديد
              </button>
            </div>
          </div>
          {showTokenInfo && botTokenInfo && (
            <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-purple-500/20">
              <p className="text-xs text-gray-400">🔑 المفتاح السري (احتفظ به آمنًا!):</p>
              <p className="text-xs font-mono text-amber-400 break-all">{botTokenInfo.secretKey}</p>
              <p className="text-[10px] text-yellow-500 mt-1">⚠️ لا تشارك هذا المفتاح مع أي شخص!</p>
            </div>
          )}
          {!userWallet && !isLoadingWallet && (
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ لا توجد محفظة للمستخدم. سيتم إنشاؤها تلقائياً عند التداول.
            </p>
          )}
        </div>
      )}

      {/* اختيار الشبكة */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">اختر الشبكة للبحث:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableNetworks.length > 0 ? (
            availableNetworks.map((network) => (
              <button
                key={network.id}
                onClick={() => setSelectedNetwork(network.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedNetwork === network.id
                    ? 'bg-blue-500 text-white shadow-lg scale-105'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: network.color }} />
                {network.name}
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500">لا توجد شبكات نشطة. قم بتحديد شبكات في إعدادات البوت.</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          🔍 جاري البحث على: <span className="font-medium text-white">{getNetworkName(selectedNetwork)}</span>
          {allPairs.length > 0 && ` (${allPairs.length} عملة)`}
        </p>
      </div>

      {/* مربع البحث */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDirectSearch()}
            placeholder={`🔍 ابحث عن أي عملة على ${getNetworkName(selectedNetwork)} (مثل: BONK, PEPE, SOL)...`}
            className="flex-1 min-w-[200px] p-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleDirectSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            بحث
          </button>
          <button
            onClick={() => setShowAIOpinions(!showAIOpinions)}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${
              showAIOpinions 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${
              showFilters 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
            }`}
          >
            <Sliders className="w-4 h-4" />
            فلاتر
          </button>
        </div>
      </div>

      {/* الفلاتر */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">الفلاتر المتقدمة:</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>📋 الكل</button>
            <button onClick={() => setActiveFilter('good')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'good' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}><Star className="w-3 h-3 inline mr-1" /> جيدة (≥ 60)</button>
            <button onClick={() => setActiveFilter('new')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'new' ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>🆕 جديدة (&lt; ساعة)</button>
            <button onClick={() => setActiveFilter('old')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'old' ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>📅 قديمة (&gt; ساعة)</button>
            <button onClick={() => setActiveFilter('high_volume')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'high_volume' ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}><BarChart3 className="w-3 h-3 inline mr-1" /> حجم عالي</button>
            <button onClick={() => setActiveFilter('high_liquidity')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'high_liquidity' ? 'bg-cyan-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}><Droplets className="w-3 h-3 inline mr-1" /> سيولة عالية</button>
            <button onClick={() => setActiveFilter('momentum')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'momentum' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}><Zap className="w-3 h-3 inline mr-1" /> زخم قوي</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> العمر</label>
              <select value={ageFilter ?? ''} onChange={(e) => setAgeFilter(e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500">
                {ageFilterOptions.map((opt) => (<option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> السيولة ≥</label>
              <input type="number" value={minLiquidityFilter} onChange={(e) => setMinLiquidityFilter(Number(e.target.value))} placeholder="0" className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> الحجم ≥</label>
              <input type="number" value={minVolumeFilter} onChange={(e) => setMinVolumeFilter(Number(e.target.value))} placeholder="0" className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><Star className="w-3 h-3" /> الدرجة ≥</label>
              <input type="number" value={minScoreFilter} onChange={(e) => setMinScoreFilter(Number(e.target.value))} placeholder="0" min="0" max="100" className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs border border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span>📊 المعروض: <span className="font-bold text-white">{filterStats.total}</span></span>
            <span>📈 شراء: <span className="font-bold text-green-500">{filterStats.buy}</span></span>
            <span>⏳ مراقبة: <span className="font-bold text-yellow-500">{filterStats.hold}</span></span>
            <span>📉 بيع: <span className="font-bold text-red-500">{filterStats.sell}</span></span>
            <span>⭐ متوسط الدرجة: <span className="font-bold text-white">{filterStats.avgScore.toFixed(1)}</span></span>
            <span>💧 متوسط السيولة: <span className="font-bold text-white">${filterStats.avgLiquidity.toFixed(0)}</span></span>
            <span>📊 متوسط الحجم: <span className="font-bold text-white">${filterStats.avgVolume.toFixed(0)}</span></span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setActiveFilter('all'); setAgeFilter(null); setMinLiquidityFilter(0); setMinVolumeFilter(0); setMinScoreFilter(0); }} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"><XCircle className="w-3 h-3 inline mr-1" /> إعادة تعيين الكل</button>
            {ageFilter !== null && (<button onClick={() => setAgeFilter(null)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">✕ إلغاء فلتر العمر</button>)}
          </div>
        </div>
      )}

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">📈 إشارات شراء</p>
          <p className="text-2xl font-bold text-green-500">{buySignals.length}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">⏳ مراقبة</p>
          <p className="text-2xl font-bold text-yellow-500">{holdSignals.length}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">📉 بيع</p>
          <p className="text-2xl font-bold text-red-500">{sellSignals.length}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500">⭐ متوسط الدرجة</p>
          <p className="text-2xl font-bold text-white">{filterStats.avgScore.toFixed(1)}</p>
        </div>
      </div>

      {/* قائمة الإشارات */}
      {isSearching && signals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-lg text-gray-500">جاري تحميل العملات من {getNetworkName(selectedNetwork)}...</p>
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-lg">📭 لا توجد إشارات تطابق الفلاتر على {getNetworkName(selectedNetwork)}</p>
          <p className="text-sm">جرب تغيير الفلاتر أو ابحث عن عملة</p>
          <button onClick={() => { setActiveFilter('all'); setAgeFilter(null); setMinLiquidityFilter(0); setMinVolumeFilter(0); setMinScoreFilter(0); }} className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">إعادة تعيين الفلاتر</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSignals.map((signal) => {
            const isBuy = signal.recommendation === 'BUY';
            const isSell = signal.recommendation === 'SELL';
            const isHold = signal.recommendation === 'HOLD';
            const isCopied = copiedAddress === signal.tokenAddress;
            const ageDisplay = signal.ageInSeconds !== undefined 
              ? signal.ageInSeconds < 60 ? `${signal.ageInSeconds}ث` : signal.ageInSeconds < 3600 ? `${Math.floor(signal.ageInSeconds / 60)}د` : signal.ageInSeconds < 86400 ? `${Math.floor(signal.ageInSeconds / 3600)}س` : `${Math.floor(signal.ageInSeconds / 86400)}ي`
              : '—';
            
            return (
              <div key={signal.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-4 transition-all hover:shadow-lg ${isBuy ? 'border-green-200 dark:border-green-800' : isSell ? 'border-red-200 dark:border-red-800' : 'border-yellow-200 dark:border-yellow-800'}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isBuy ? <TrendingUp className="w-5 h-5 text-green-500" /> : isSell ? <TrendingDown className="w-5 h-5 text-red-500" /> : <Eye className="w-5 h-5 text-yellow-500" />}
                      <p className="font-medium">{signal.tokenSymbol}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isBuy ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : isSell ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>{signal.recommendation}</span>
                      {signal.isNew && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">🆕 جديد</span>}
                      <span className="text-[10px] text-gray-400">⏱️ {ageDisplay}</span>
                      <span className="text-[10px] text-gray-400">⭐ {signal.score}/100</span>
                      {signal.confidence && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${signal.confidence >= 70 ? 'bg-emerald-500/20 text-emerald-400' : signal.confidence >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>🧠 {signal.confidence}%</span>}
                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(signal.tokenAddress, `عنوان ${signal.tokenSymbol}`); }} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors" title="نسخ العنوان">
                        {isCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 mt-1">
                      <span>{signal.network}</span>
                      <span>💰 {formatUsd(signal.price)}</span>
                      {signal.liquidity && <span>💧 {formatUsd(signal.liquidity)}</span>}
                      {signal.volume && <span>📊 {formatUsd(signal.volume)}</span>}
                      {signal.priceChange24h !== undefined && <span className={signal.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}>{signal.priceChange24h >= 0 ? '+' : ''}{signal.priceChange24h.toFixed(2)}% 24س</span>}
                    </div>
                    {showAIOpinions && signal.aiOpinion && <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">{signal.aiOpinion}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSignal({ ...signal, recommendation: 'BUY' })}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                    >
                      شراء
                    </button>
                    <button
                      onClick={() => setSelectedSignal({ ...signal, recommendation: 'SELL' })}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                    >
                      بيع
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* زر تحميل المزيد */}
      {hasMore && allPairs.length > ITEMS_PER_PAGE && !searchQuery.trim() && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : '📥 تحميل المزيد'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            عرض {signals.length} من {allPairs.length} عملة
          </p>
        </div>
      )}

      {/* نافذة تنفيذ الصفقة */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                تنفيذ صفقة {selectedSignal.recommendation === 'BUY' ? 'شراء' : 'بيع'}
              </h2>
              <button
                onClick={() => setSelectedSignal(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">العملة</span>
                <span className="font-medium">{selectedSignal.tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">السعر</span>
                <span className="font-medium">{formatUsd(selectedSignal.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الشبكة</span>
                <span className="font-medium">{selectedSignal.network}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الدرجة</span>
                <span className="font-medium">{selectedSignal.score}/100</span>
              </div>
              {selectedSignal.aiOpinion && (
                <div className="flex justify-between">
                  <span className="text-gray-500">رأي AI</span>
                  <span className="text-purple-600 dark:text-purple-400 text-sm">{selectedSignal.aiOpinion}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">المبلغ (USD)</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-24 p-1 border border-gray-300 dark:border-gray-600 rounded bg-transparent text-right"
                />
              </div>
              <div className="text-xs text-gray-400 text-center">
                💰 رصيد المحفظة: سيتم التحقق منه قبل التنفيذ
              </div>
              {botTokenInfo && (
                <div className="text-xs text-purple-400 text-center">
                  🔑 باستخدام رمز البوت: {botTokenInfo.token}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation as 'BUY' | 'SELL')}
                disabled={executing || !botTokenInfo}
                className={`flex-1 py-2 rounded-lg text-white transition-colors ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                } disabled:opacity-50 flex items-center justify-center`}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ تأكيد التنفيذ'}
              </button>
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                إلغاء
              </button>
            </div>
            {!botTokenInfo && (
              <p className="text-xs text-yellow-400 text-center mt-2">
                ⚠️ لا يوجد رمز بوت. سيتم إنشاؤه تلقائياً عند التداول.
              </p>
            )}
          </div>
        </div>
      )}

      {/* تعليمات */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">📌 كيفية التداول اليدوي</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1️⃣ اختر الشبكة التي تريد البحث عليها من الأعلى</li>
          <li>2️⃣ ابحث عن أي عملة في مربع البحث أو انتظر تحميل جميع العملات</li>
          <li>3️⃣ استخدم الفلاتر المتقدمة لتصفية العملات (جيدة / جديدة / قديمة / حجم / سيولة / زخم)</li>
          <li>4️⃣ اضغط "شراء" أو "بيع" لفتح نافذة التنفيذ</li>
          <li>5️⃣ حدد المبلغ المناسب واضغط "تأكيد التنفيذ"</li>
          <li>🔑 سيتم استخدام رمز البوت الخاص بك تلقائياً</li>
          <li>💰 سيتم التداول من محفظتك الشخصية وليس من محفظة الأدمن</li>
        </ul>
      </div>
    </div>
  );
}
