
// ============================================================
// 📊 Scalper X - تداول سريع آلي + يدوي (صفقات متعددة)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Zap, Save, Play, Pause, RefreshCw, AlertCircle, CheckCircle, 
  Search, ExternalLink, X, Loader2, TrendingUp, Droplets, BarChart3, Copy,
  BrainCircuit, TrendingDown, Globe, Filter, ChevronDown, ChevronRight,
  Sparkles, Clock, DollarSign, Activity, Info, Layers, Users, Eye,
  Bot, Settings2, Shield, Cpu, LineChart, Wallet, ArrowUpRight, ArrowDownRight,
  Plus, History, ListOrdered, Hash
} from 'lucide-react';
import { NETWORKS, getNetworkName, getNetworkColor, getNetworkIcon } from '../config/networks';
import { discoverAllPairs } from '../lib/discovery';

// ============================================================
// 🧩 مكونات مساعدة
// ============================================================

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`
    relative overflow-hidden rounded-2xl 
    bg-[#14141e]/80 backdrop-blur-xl 
    border border-[#1e1e2f] 
    ${className}
  `}>
    {children}
  </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning' | 'scalper' | 'ai' | 'manual';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  icon
}) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-[#10b981]/20',
    secondary: 'bg-[#1e1e2f] hover:bg-[#2a2a3f] text-[#e2e8f0] border border-[#1e1e2f]',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white',
    ghost: 'bg-transparent hover:bg-[#1e1e2f] text-[#94a3b8] hover:text-white',
    success: 'bg-[#059669] hover:bg-[#047857] text-white',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] text-white',
    scalper: 'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-lg shadow-[#f97316]/20',
    ai: 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-lg shadow-[#8b5cf6]/20 hover:shadow-[#8b5cf6]/30',
    manual: 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-lg shadow-[#3b82f6]/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ============================================================
// 📊 صفحة Scalper X الرئيسية
// ============================================================

export function ScalperConfigPage() {
  const { user, botInstances, loadBotInstances, updateBotConfig, addLog, startBot, stopBot, createWalletForBot } = useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // ============================================================
  // 🔥 وضع التحكم (AI / يدوي)
  // ============================================================
  const [controlMode, setControlMode] = useState<'ai' | 'manual'>('ai');

  // ✅ وضع التداول (آلي حسب الشروط / يدوي فوري)
  const [tradeMode, setTradeMode] = useState<'auto' | 'manual'>('auto');
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  const [manualTradeAmount, setManualTradeAmount] = useState(50);
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // ============================================================
  // 🔍 حالات البحث عن العملات
  // ============================================================
  const [showTokenSearch, setShowTokenSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState('all');
  const [isNetworkFilterOpen, setIsNetworkFilterOpen] = useState(false);
  const [allFetchedTokens, setAllFetchedTokens] = useState<any[]>([]);
  
  // ✅ فلتر العملات
  const [tokenFilter, setTokenFilter] = useState<'all' | 'good' | 'new' | 'volume' | 'liquid' | 'momentum'>('all');

  // ============================================================
  // 🧠 حالات تحليل Gemini AI
  // ============================================================
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ============================================================
  // 🐋 حالات بيانات الحيتان
  // ============================================================
  const [whaleData, setWhaleData] = useState<any>(null);
  const [whaleLoading, setWhaleLoading] = useState(false);
  const [whaleError, setWhaleError] = useState<string | null>(null);

  // ============================================================
  // 🌐 الشبكات المدعومة (9 شبكات)
  // ============================================================
  const networkOptions = NETWORKS.map(n => {
    const networkId = String(n.id).toLowerCase();
    const networkName = getNetworkName(networkId) || n.name || networkId;
    const networkIcon = getNetworkIcon(networkId) || n.icon || '🌐';
    const networkColor = getNetworkColor(networkId) || n.color || '#64748b';

    return {
      value: networkId,
      label: `${networkIcon} ${networkName}`,
      name: networkName,
      color: networkColor,
      icon: networkIcon,
    };
  });

  // ============================================================
  // 🖼️ الصورة الحقيقية للعملة
  // DEX Screener يرسل صورة الـ pair في info.imageUrl عند توفرها.
  // لا ننشئ صورة وهمية: إذا لم توجد صورة نعرض اختصار الرمز فقط.
  // ============================================================
  const getTokenImageUrl = (pair: any): string => {
    const imageUrl =
      pair?.info?.imageUrl ||
      pair?.baseToken?.logoURI ||
      pair?.baseToken?.logoUrl ||
      '';

    return typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)
      ? imageUrl
      : '';
  };

  // ============================================================
  // ✅ العملات المقترحة (بدون عملات مستقرة)
  // ============================================================
  const SUGGESTED_TOKENS: Record<string, Array<{ value: string; label: string; address: string }>> = {
    solana: [
      { value: 'SOL', label: 'Solana (SOL)', address: 'So11111111111111111111111111111111111111112' },
      { value: 'BONK', label: 'Bonk (BONK)', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
      { value: 'JUP', label: 'Jupiter (JUP)', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
      { value: 'WIF', label: 'Dogwifhat (WIF)', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
      { value: 'RAY', label: 'Raydium (RAY)', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
    ],
    ethereum: [
      { value: 'ETH', label: 'Ethereum (ETH/WETH)', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
      { value: 'LINK', label: 'Chainlink (LINK)', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
      { value: 'AAVE', label: 'Aave (AAVE)', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
    ],
    bsc: [
      { value: 'BNB', label: 'BNB (WBNB)', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
      { value: 'CAKE', label: 'PancakeSwap (CAKE)', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
    ],
    polygon: [
      { value: 'POL', label: 'Polygon (POL/WMATIC)', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
    ],
    arbitrum: [
      { value: 'ETH', label: 'Arbitrum ETH (WETH)', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
      { value: 'ARB', label: 'Arbitrum (ARB)', address: '0x912CE59144191C1204E64559FE8253a0b49C6549' },
    ],
    base: [
      { value: 'ETH', label: 'Base ETH (WETH)', address: '0x4200000000000000000000000000000000000006' },
    ],
    avalanche: [
      { value: 'AVAX', label: 'Avalanche (AVAX/WAVAX)', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7' },
    ],
    optimism: [
      { value: 'ETH', label: 'Optimism ETH (WETH)', address: '0x4200000000000000000000000000000000000006' },
      { value: 'OP', label: 'Optimism (OP)', address: '0x4200000000000000000000000000000000000042' },
    ],
    robinhood: [
      { value: 'ETH', label: 'Robinhood ETH (WETH)', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    ],
  };

  // ============================================================
  // 🔧 إعدادات البوت
  // ============================================================
  const [config, setConfig] = useState({
    targetToken: '',
    targetTokenAddress: '',
    targetTokenImageUrl: '',
    totalAmountUsd: 1000,
    amountPerTrade: 50,
    maxOpenTrades: 5,
    buyThreshold: -2.0,
    takeProfit: 3.0,
    stopLoss: -1.5,
    trailingStop: 0.5,
    minTradeInterval: 2,
    maxTradeDuration: 24,
    network: 'solana',
    isManualToken: false,
  });

  // ============================================================
  // 📊 حساب المؤشرات الفنية
  // ============================================================
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [technicalIndicators, setTechnicalIndicators] = useState<any>(null);

  const calculateIndicators = (prices: number[]) => {
    if (prices.length < 20) return null;
    const rsi = calculateRSI(prices);
    const ma20 = calculateMA(prices, 20);
    const ma50 = calculateMA(prices, 50);
    const { support, resistance } = calculateSupportResistance(prices);
    const volatility = calculateVolatility(prices);
    return { rsi, ma20, ma50, support, resistance, volatility };
  };

  const calculateRSI = (prices: number[], period: number = 14): number => {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const calculateMA = (prices: number[], period: number): number => {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  const calculateSupportResistance = (prices: number[]) => {
    const recent = prices.slice(-50);
    const sorted = [...recent].sort((a, b) => a - b);
    const supportIndex = Math.floor(sorted.length * 0.1);
    const resistanceIndex = Math.floor(sorted.length * 0.9);
    return { support: sorted[supportIndex], resistance: sorted[resistanceIndex] };
  };

  const calculateVolatility = (prices: number[]): number => {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
  };

  // ============================================================
  // 🔍 جلب بيانات العملة من DEX Screener
  // ============================================================
  const fetchTokenData = async (tokenSymbol: string, network: string) => {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${tokenSymbol}`
      );
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs.find((p: any) => p.chainId === network);
        if (pair) {
          const price = parseFloat(pair.priceUsd || 0);
          setPriceHistory(prev => {
            const newHistory = [...prev, price];
            if (newHistory.length > 100) newHistory.shift();
            return newHistory;
          });
          if (priceHistory.length > 20) {
            const indicators = calculateIndicators(priceHistory);
            setTechnicalIndicators(indicators);
          }
          return {
            price,
            volume: pair.volume?.h24 || 0,
            liquidity: pair.liquidity?.usd || 0,
            priceChange: pair.priceChange?.h24 || 0,
            buys: pair.txns?.h24?.buys || 0,
            sells: pair.txns?.h24?.sells || 0,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('❌ فشل جلب بيانات العملة:', error);
      return null;
    }
  };

  // ============================================================
  // 🐋 جلب بيانات الحيتان
  // ============================================================
  const fetchWhaleData = async (tokenAddress: string) => {
    if (!tokenAddress) return;
    setWhaleLoading(true);
    setWhaleError(null);
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
      const response = await fetch(`${WORKER_URL}/solana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccounts',
          params: [tokenAddress, { limit: 100 }]
        }),
      });
      const data = await response.json();
      if (data.result) {
        const accounts = data.result;
        const largeWallets = accounts.filter((a: any) => a.balance > 100000);
        const totalBalance = accounts.reduce((sum: number, a: any) => sum + a.balance, 0);
        setWhaleData({
          totalWhales: largeWallets.length,
          whalePercentage: (largeWallets.length / accounts.length) * 100,
          totalWhaleBalance: largeWallets.reduce((sum: number, a: any) => sum + a.balance, 0),
          topWhaleBalance: largeWallets[0]?.balance || 0,
          totalBalance,
          accounts: accounts.length,
        });
      }
    } catch (error) {
      console.error('❌ فشل جلب بيانات الحيتان:', error);
      setWhaleError('فشل جلب بيانات الحيتان');
    } finally {
      setWhaleLoading(false);
    }
  };

  // ============================================================
  // 🔍 البحث عن العملات (معدل)
  // ============================================================
  const fetchAllTokens = async (networkFilter: string = selectedNetworkFilter) => {
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const networksToFetch = networkFilter === 'all'
        ? networkOptions
        : networkOptions.filter(n => n.value === networkFilter);

      if (networksToFetch.length === 0) {
        setSearchError('❌ الشبكة المحددة غير موجودة');
        return;
      }

      const results = await Promise.all(
        networksToFetch.map(async (network) => {
          try {
            const result = await discoverAllPairs(network.value as any);
            const pairs = Array.isArray(result?.pairs) ? result.pairs : [];
            return pairs
              .filter((p: any) => {
                if (!p?.baseToken?.address) return false;
                return String(p.chainId || '').toLowerCase() === network.value.toLowerCase();
              })
              .map((p: any) => {
                const chainId = String(p.chainId || network.value).toLowerCase();
                const networkOption = networkOptions.find(n => n.value === chainId) || network;
                const symbol = String(p.baseToken?.symbol || 'UNKNOWN').trim();
                const rawName = String(p.baseToken?.name || '').trim();
                const networkName = networkOption.name || getNetworkName(chainId);
                const name = rawName && rawName.toLowerCase() !== String(networkName).toLowerCase()
                  ? rawName
                  : symbol;
                return {
                  symbol,
                  name,
                  address: String(p.baseToken.address),
                  imageUrl: getTokenImageUrl(p),
                  price: Number.parseFloat(p.priceUsd || '0') || 0,
                  priceDisplay: `$${(Number.parseFloat(p.priceUsd || '0') || 0).toFixed(6)}`,
                  change: Number.parseFloat(p.priceChange?.h24 || '0') || 0,
                  changeDisplay: `${(Number.parseFloat(p.priceChange?.h24 || '0') || 0).toFixed(2)}%`,
                  liquidity: Number(p.liquidity?.usd || 0),
                  volume: Number(p.volume?.h24 || 0),
                  dexId: p.dexId || '',
                  url: p.url || '',
                  network: chainId,
                  networkName: networkOption.name || getNetworkName(chainId) || chainId,
                  networkIcon: networkOption.icon || getNetworkIcon(chainId) || '🌐',
                  networkColor: networkOption.color || getNetworkColor(chainId) || '#64748b',
                  pairCreatedAt: p.pairCreatedAt || Date.now(),
                  pairAddress: p.pairAddress || '',
                };
              });
          } catch (error) {
            console.warn(`⚠️ تعذر اكتشاف أزواج ${network.name}:`, error);
            return [];
          }
        })
      );

      const discoveredTokens = results.flat();

      const uniqueTokens = discoveredTokens.reduce((acc: any[], token: any) => {
        const key = `${token.network}:${String(token.address).toLowerCase()}`;
        const existingIndex = acc.findIndex(
          t => `${t.network}:${String(t.address).toLowerCase()}` === key
        );
        if (existingIndex === -1) {
          acc.push(token);
        } else {
          const existing = acc[existingIndex];
          if (token.liquidity > existing.liquidity) {
            acc[existingIndex] = token;
          }
        }
        return acc;
      }, []);

      const filteredTokens = applyTokenFilter(uniqueTokens);
      setSearchResults(filteredTokens.slice(0, 200));
      setAllFetchedTokens(filteredTokens);

      if (filteredTokens.length === 0) {
        setSearchError(
          networkFilter === 'all'
            ? '❌ لم يتم العثور على عملات في الشبكات المتاحة'
            : `❌ لا توجد عملات على ${networkOptions.find(n => n.value === networkFilter)?.name || getNetworkName(networkFilter)}`
        );
      } else {
        const networkLabel = networkFilter === 'all'
          ? 'جميع الشبكات'
          : (networkOptions.find(n => n.value === networkFilter)?.name || getNetworkName(networkFilter));
        await addLog('SUCCESS', `✅ تم اكتشاف ${filteredTokens.length} عملة حقيقية من ${networkLabel}`);
      }
    } catch (error) {
      console.error('❌ فشل اكتشاف العملات:', error);
      setSearchError(`❌ فشل اكتشاف العملات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchTokens = async (networkFilter: string = selectedNetworkFilter) => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('❌ الرجاء إدخال رمز أو عنوان العملة');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const pairs = Array.isArray(data.pairs) ? data.pairs : [];

      const filtered = networkFilter === 'all'
        ? pairs
        : pairs.filter((p: any) =>
            String(p.chainId || '').toLowerCase() === networkFilter.toLowerCase()
          );

      const results = filtered
        .filter((p: any) => p.baseToken?.address)
        .map((p: any) => {
          const chainId = String(p.chainId || 'unknown').toLowerCase();
          const networkOption = networkOptions.find(n => n.value === chainId);
          return {
            symbol: p.baseToken.symbol || 'UNKNOWN',
            name: (p.baseToken.name &&
              p.baseToken.name.toLowerCase() !== getNetworkName(chainId).toLowerCase())
              ? p.baseToken.name
              : (p.baseToken.symbol || 'Unknown'),
            address: p.baseToken.address || '',
            price: parseFloat(p.priceUsd || 0),
            priceDisplay: `$${parseFloat(p.priceUsd || 0).toFixed(6)}`,
            change: parseFloat(p.priceChange?.h24 || 0),
            changeDisplay: `${parseFloat(p.priceChange?.h24 || 0).toFixed(2)}%`,
            liquidity: Number(p.liquidity?.usd || 0),
            volume: Number(p.volume?.h24 || 0),
            dexId: p.dexId || '',
            url: p.url || '',
            network: chainId,
            networkName: networkOption?.name || getNetworkName(chainId) || chainId,
            networkIcon: networkOption?.icon || getNetworkIcon(chainId) || '🌐',
            networkColor: networkOption?.color || getNetworkColor(chainId) || '#64748b',
            pairCreatedAt: p.pairCreatedAt || Date.now(),
          };
        });

      const uniqueResults = results.reduce((acc: any[], token: any) => {
        const key = `${token.network}:${token.address.toLowerCase()}`;
        const existingIndex = acc.findIndex(
          t => `${t.network}:${String(t.address).toLowerCase()}` === key
        );
        if (existingIndex === -1) {
          acc.push(token);
        } else if (token.liquidity > acc[existingIndex].liquidity) {
          acc[existingIndex] = token;
        }
        return acc;
      }, []);

      const filteredResults = applyTokenFilter(uniqueResults);
      setSearchResults(filteredResults);
      setAllFetchedTokens(filteredResults);

      if (filteredResults.length > 0) {
        const networkLabel = networkFilter === 'all'
          ? 'جميع الشبكات'
          : (networkOptions.find(n => n.value === networkFilter)?.name || getNetworkName(networkFilter));
        await addLog('SUCCESS', `✅ تم العثور على ${filteredResults.length} عملة على ${networkLabel}`);
      } else {
        setSearchError(
          networkFilter === 'all'
            ? `❌ لم يتم العثور على "${query}"`
            : `❌ لم يتم العثور على "${query}" على ${getNetworkName(networkFilter)}`
        );
      }
    } catch (error) {
      console.error('❌ فشل البحث:', error);
      setSearchError(`❌ فشل البحث: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const applyTokenFilter = (tokens: any[]) => {
    const uniqueTokens = [...tokens];
    switch (tokenFilter) {
      case 'good':
        return uniqueTokens.filter(t =>
          t.liquidity > 50000 && t.change > 0 && t.volume > 100000
        );
      case 'new': {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return uniqueTokens.filter(t => t.pairCreatedAt > oneDayAgo);
      }
      case 'volume':
        return [...uniqueTokens].sort((a, b) => b.volume - a.volume);
      case 'liquid':
        return [...uniqueTokens].sort((a, b) => b.liquidity - a.liquidity);
      case 'momentum':
        return uniqueTokens
          .filter(t => t.change > 10 && t.volume > 50000 && t.liquidity > 20000)
          .sort((a, b) => b.change - a.change);
      default:
        return uniqueTokens;
    }
  };

  // ============================================================
  // 🧠 تحليل Gemini AI (معدل)
  // ============================================================
  const handleAIAnalysis = async () => {
    if (!config.targetToken || !config.targetTokenAddress) {
      setAiError('❌ الرجاء اختيار عملة أولاً');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);

    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
      
      // ✅ استخدم العنوان مباشرة بدلاً من الرمز
      const dexResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${config.targetTokenAddress}`
      );
      const dexData = await dexResponse.json();
      
      let tokenData = null;
      if (dexData.pairs && dexData.pairs.length > 0) {
        const pair = dexData.pairs.find((p: any) => p.chainId === config.network);
        if (pair) {
          tokenData = {
            price: parseFloat(pair.priceUsd || 0),
            imageUrl: getTokenImageUrl(pair),
            liquidity: pair.liquidity?.usd || 0,
            volume: pair.volume?.h24 || 0,
            priceChange: pair.priceChange?.h24 || 0,
          };
        }
      }

      if (!tokenData) {
        setAiError('❌ لا توجد بيانات كافية للتحليل');
        setAiLoading(false);
        return;
      }

      const response = await fetch(`${WORKER_URL}/analyze-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: config.targetTokenAddress,
          network: config.network,
          symbol: config.targetToken,
          name: config.targetToken,
          price: tokenData.price,
          liquidity: tokenData.liquidity,
          volume24h: tokenData.volume,
          priceChange24h: tokenData.priceChange,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setAiAnalysis(result.analysis);
        await addLog('SUCCESS', `🧠 تم تحليل ${config.targetToken} بواسطة Gemini AI`);
      } else {
        setAiError(`❌ فشل التحليل: ${result.error}`);
      }
    } catch (error) {
      setAiError(`❌ خطأ في الاتصال: ${error}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleFullAnalysis = async () => {
    await Promise.all([
      handleAIAnalysis(),
      fetchWhaleData(config.targetTokenAddress),
    ]);
  };

  // ============================================================
  // 📝 اختيار عملة من نتائج البحث
  // ============================================================
  const selectTokenFromSearch = (token: any) => {
    const network = String(token.network || config.network).toLowerCase();
    
    setConfig({
      ...config,
      targetToken: token.symbol,
      targetTokenAddress: token.address,
      targetTokenImageUrl: token.imageUrl || '',
      network: network,
      isManualToken: false,
    });
    setCustomTokenInput(token.symbol);
    setShowTokenSearch(false);
    setSearchResults([]);
    setSearchQuery('');
    setAiAnalysis(null);
    setAiError(null);
    setWhaleData(null);
    
    // ✅ إنشاء محفظة للشبكة المختارة تلقائياً
    if (scalperBot) {
      createWalletForBot(scalperBot.id, network, user?.id || '')
        .then(result => {
          if (result.success) {
            addLog('SUCCESS', `💰 تم إنشاء محفظة لـ ${getNetworkName(network)} تلقائياً`);
          }
        })
        .catch(() => {});
    }
    
    addLog('SUCCESS', `✅ تم اختيار العملة ${token.symbol} على ${getNetworkName(network)}`);
  };

  // ============================================================
  // 📋 دالة النسخ
  // ============================================================
  const copyToClipboard = (text: string, label: string = 'العنوان') => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    addLog('SUCCESS', `✅ تم نسخ ${label}: ${text.slice(0, 10)}...`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // ============================================================
  // 💾 حفظ الإعدادات (مع إنشاء محفظة تلقائي)
  // ============================================================
  const handleSave = async () => {
    if (!user?.id || !scalperBot) {
      await addLog('ERROR', '❌ لا يوجد بوت Scalper لتحرير الإعدادات');
      return;
    }

    if (!config.targetToken.trim()) {
      await addLog('ERROR', '❌ الرجاء إدخال رمز العملة');
      return;
    }

    if (config.isManualToken && !config.targetTokenAddress.trim()) {
      await addLog('ERROR', '❌ الرجاء إدخال عنوان العقد للعملة المخصصة');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateBotConfig(scalperBot.id, {
        ...scalperBot,
        config: JSON.stringify({
          ...config,
          controlMode,
          tradeMode,
        }),
      }, user.id);

      // ✅ إنشاء محفظة للشبكة المختارة تلقائياً
      try {
        const walletResult = await createWalletForBot(scalperBot.id, config.network, user.id);
        if (walletResult.success) {
          await addLog('SUCCESS', `💰 تم إنشاء محفظة لـ ${getNetworkName(config.network)} تلقائياً`);
        } else {
          await addLog('INFO', `ℹ️ محفظة ${getNetworkName(config.network)} موجودة مسبقاً`);
        }
      } catch (walletError) {
        console.warn('⚠️ فشل إنشاء المحفظة التلقائية:', walletError);
      }

      setSaveSuccess(true);
      await addLog('SUCCESS', `✅ تم حفظ إعدادات Scalper X للعملة ${config.targetToken} على ${getNetworkName(config.network)}`);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      await addLog('ERROR', `❌ فشل حفظ الإعدادات: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // ▶️ تشغيل/إيقاف البوت
  // ============================================================
  const handleStartStop = async () => {
    if (!user?.id || !scalperBot) return;

    try {
      if (isRunning) {
        await stopBot(scalperBot.id, user.id);
        setIsRunning(false);
        await addLog('INFO', '⏸️ تم إيقاف Scalper X');
      } else {
        await startBot(scalperBot.id, user.id);
        setIsRunning(true);
        await addLog('SUCCESS', '▶️ تم تشغيل Scalper X');
      }
    } catch (error) {
      await addLog('ERROR', `❌ فشل تغيير حالة البوت: ${error}`);
    }
  };

  // ============================================================
  // 🖐️ تنفيذ صفقة يدوية فورية (شراء/بيع)
  // ============================================================
  const handleManualTrade = async (side: 'buy' | 'sell') => {
    if (!user?.id || !scalperBot) {
      await addLog('ERROR', '❌ لا يوجد بوت Scalper');
      return;
    }

    if (!config.targetToken || !config.targetTokenAddress) {
      await addLog('ERROR', '❌ الرجاء اختيار عملة أولاً');
      return;
    }

    const amount = manualTradeAmount || config.amountPerTrade || 50;
    
    setIsExecutingTrade(true);
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
      
      const response = await fetch(`${WORKER_URL}/execute-trade?userId=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: scalperBot.id,
          side: side,
          tokenAddress: config.targetTokenAddress,
          amountUsd: amount,
          tokenSymbol: config.targetToken,
          network: config.network,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await addLog('SUCCESS', `✅ تم ${side === 'buy' ? 'شراء' : 'بيع'} ${amount}$ من ${config.targetToken} بنجاح`);
        // تحديث قائمة الصفقات المفتوحة
        await loadOpenTrades();
      } else {
        await addLog('ERROR', `❌ فشل ${side === 'buy' ? 'الشراء' : 'البيع'}: ${result.error}`);
      }
    } catch (error) {
      await addLog('ERROR', `❌ فشل تنفيذ الصفقة: ${error}`);
    } finally {
      setIsExecutingTrade(false);
    }
  };

  // ============================================================
  // 📊 جلب الصفقات المفتوحة
  // ============================================================
  const loadOpenTrades = async () => {
    if (!user?.id || !scalperBot) return;
    
    setLoadingTrades(true);
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
      const response = await fetch(`${WORKER_URL}/open-trades?botId=${scalperBot.id}&userId=${user.id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setOpenTrades(result.data.filter((t: any) => t.is_open === 1));
      }
    } catch (error) {
      console.error('❌ فشل جلب الصفقات المفتوحة:', error);
    } finally {
      setLoadingTrades(false);
    }
  };

  // ============================================================
  // 🔄 تحميل البوت
  // ============================================================
  const scalperBot = botInstances.find(b => b.bot_type === 'scalper');

  useEffect(() => {
    if (user?.id) {
      loadBotInstances(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (scalperBot?.config) {
      try {
        const savedConfig = JSON.parse(scalperBot.config);
        setConfig(prev => ({ ...prev, ...savedConfig }));
        setIsRunning(scalperBot.status === 'running');
        if (savedConfig.controlMode) setControlMode(savedConfig.controlMode);
        if (savedConfig.tradeMode) setTradeMode(savedConfig.tradeMode);
      } catch { /* استخدام الإعدادات الافتراضية */ }
    }
  }, [scalperBot]);

  useEffect(() => {
    if (scalperBot && user?.id) {
      loadOpenTrades();
    }
  }, [scalperBot, user]);

  // ============================================================
  // 📥 جلب العملات عند تغيير الشبكة أو الفلتر
  // ============================================================
  useEffect(() => {
    if (showTokenSearch) {
      fetchAllTokens(selectedNetworkFilter);
    }
  }, [selectedNetworkFilter, tokenFilter, showTokenSearch]);

  // ============================================================
  // 📊 تحديث البيانات عند تغيير العملة
  // ============================================================
  useEffect(() => {
    if (config.targetToken && config.targetTokenAddress) {
      handleFullAnalysis();
    }
  }, [config.targetToken, config.targetTokenAddress, config.network]);

  // ============================================================
  // 🖥️ العرض
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-7 h-7 text-[#f97316]" />
            Scalper X
            <span className="text-sm font-normal text-[#64748b]">تداول سريع ذكي</span>
          </h2>
          <p className="text-sm text-[#64748b] mt-1">
            تداول سريع على <span className="text-[#f97316] font-medium">أي عملة</span> من الشبكات المتاحة مع صفقات متعددة
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scalperBot && (
            <span className={`text-xs px-3 py-1.5 rounded-full ${
              scalperBot.status === 'running' 
                ? 'bg-[#10b981]/20 text-[#10b981]' 
                : 'bg-[#64748b]/20 text-[#64748b]'
            }`}>
              {scalperBot.status === 'running' ? '🟢 يعمل' : '🔴 متوقف'}
            </span>
          )}
          <Button 
            variant={isRunning ? 'warning' : 'scalper'} 
            size="sm"
            onClick={handleStartStop}
            icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isRunning ? 'إيقاف' : 'تشغيل'}
          </Button>
        </div>
      </div>

      {/* ✅ تنبيه: يجب إنشاء البوت أولاً */}
      {!scalperBot && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">⚠️ لم يتم العثور على بوت Scalper</p>
            <p className="text-xs text-[#94a3b8]">
              يرجى الذهاب إلى <span className="text-white font-medium">صفحة البوتات</span> 
              وإنشاء بوت من نوع <span className="text-[#f97316] font-medium">Scalper X</span> أولاً.
            </p>
          </div>
          <Button 
            variant="scalper" 
            size="sm"
            onClick={() => window.location.href = '/bots'}
            icon={<Plus className="w-4 h-4" />}
          >
            إنشاء بوت
          </Button>
        </div>
      )}

      {/* ✅ أزرار التحكم (AI / يدوي) */}
      {scalperBot && (
        <div className="flex gap-3">
          <button 
            onClick={() => setControlMode('ai')}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              controlMode === 'ai' 
                ? 'bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/20' 
                : 'bg-[#1e1e2f] text-[#94a3b8] hover:text-white'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
            🧠 وضع الذكاء الاصطناعي
            <span className="text-xs opacity-60">(Gemini AI)</span>
          </button>
          <button 
            onClick={() => setControlMode('manual')}
            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              controlMode === 'manual' 
                ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20' 
                : 'bg-[#1e1e2f] text-[#94a3b8] hover:text-white'
            }`}
          >
            <Settings2 className="w-5 h-5" />
            🖐️ وضع يدوي
            <span className="text-xs opacity-60">(تحكم كامل)</span>
          </button>
        </div>
      )}

      {/* حالة البوت */}
      {scalperBot && (
        <GlassCard className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-[#64748b]">اسم البوت</p>
                <p className="text-sm font-medium text-white">{scalperBot.name}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">العملة المستهدفة</p>
                <p className="text-sm font-medium text-[#f97316]">{config.targetToken || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">الشبكة</p>
                <p className="text-sm font-medium text-white">{getNetworkName(config.network)}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">صفقات اليوم</p>
                <p className="text-sm font-medium text-white">{scalperBot.total_trades || 0}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">P&L اليوم</p>
                <p className={`text-sm font-medium ${(scalperBot.today_pnl || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {(scalperBot.today_pnl || 0) >= 0 ? '+' : ''}{(scalperBot.today_pnl || 0).toFixed(2)}%
                </p>
              </div>
            </div>
            {saveSuccess && (
              <div className="flex items-center gap-2 text-[#10b981] text-sm">
                <CheckCircle className="w-4 h-4" />
                تم الحفظ بنجاح
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ============================================================
          🎯 اختيار العملة (نسخة مبسطة)
      ============================================================ */}
      {scalperBot && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-[#f97316]" />
              <h3 className="text-sm font-semibold text-white">🎯 اختيار العملة المستهدفة</h3>
              <span className="text-xs text-[#64748b]">(اختر من الشبكات المتاحة)</span>
            </div>
            <Button 
              variant="scalper" 
              size="sm"
              icon={<Globe className="w-4 h-4" />}
              onClick={() => setShowTokenSearch(true)}
            >
              🔍 تصفح العملات
            </Button>
          </div>

          {/* عرض العملة المختارة (بدون قوائم) */}
          {config.targetToken && config.targetTokenAddress ? (
            <div className="p-4 bg-[#0a0a0f] rounded-xl border border-[#f97316]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0d151c] border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {config.targetTokenImageUrl ? (
                      <img
                        src={config.targetTokenImageUrl}
                        alt={config.targetToken}
                        className="w-full h-full object-cover"
                        loading="eager"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-[#f97316]">{config.targetToken.slice(0, 3)}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      العملة المختارة: <span className="text-[#f97316]">{config.targetToken}</span>
                      <span className="text-xs text-[#64748b] ml-2">({getNetworkName(config.network)})</span>
                    </p>
                    {config.targetTokenAddress && (
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] font-mono text-[#64748b] truncate max-w-[200px]">
                          {config.targetTokenAddress.slice(0, 12)}...{config.targetTokenAddress.slice(-8)}
                        </p>
                        <button 
                          onClick={() => copyToClipboard(config.targetTokenAddress, `عنوان ${config.targetToken}`)}
                          className="p-0.5 hover:bg-slate-700 rounded transition-colors"
                        >
                          {copiedAddress === config.targetTokenAddress ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-500 hover:text-white" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowTokenSearch(true)}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  تغيير
                </Button>
              </div>

              {/* 🧠 تحليل Gemini */}
              {aiLoading && (
                <div className="mt-3 p-3 bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 rounded-xl flex items-center justify-center gap-3">
                  <Loader2 className="w-4 h-4 text-[#8b5cf6] animate-spin" />
                  <p className="text-xs text-[#94a3b8]">🧠 Gemini AI يحلل {config.targetToken}...</p>
                </div>
              )}

              {aiError && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{aiError}</p>
                </div>
              )}

              {aiAnalysis && (
                <div className="mt-3 p-3 bg-[#8b5cf6]/5 border border-[#8b5cf6]/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-[#8b5cf6]" />
                      <h4 className="text-xs font-semibold text-white">🧠 تحليل الذكاء الاصطناعي</h4>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      aiAnalysis.recommendation === 'strong_buy' || aiAnalysis.recommendation === 'buy' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : aiAnalysis.recommendation === 'sell' || aiAnalysis.recommendation === 'strong_sell'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {aiAnalysis.recommendation === 'strong_buy' ? '🟢 شراء قوي' :
                       aiAnalysis.recommendation === 'buy' ? '🟢 شراء' :
                       aiAnalysis.recommendation === 'hold' ? '🟡 احتفاظ' :
                       aiAnalysis.recommendation === 'sell' ? '🔴 بيع' : '🔴 بيع قوي'}
                    </span>
                  </div>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">{aiAnalysis.summary}</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[8px] text-[#64748b]">الثقة</p>
                      <p className="text-xs font-bold text-[#8b5cf6]">{aiAnalysis.confidence}%</p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[8px] text-[#64748b]">المخاطرة</p>
                      <p className={`text-xs font-bold ${
                        aiAnalysis.riskLevel === 'low' ? 'text-emerald-400' :
                        aiAnalysis.riskLevel === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {aiAnalysis.riskLevel === 'low' ? 'منخفضة' :
                         aiAnalysis.riskLevel === 'medium' ? 'متوسطة' : 'عالية'}
                      </p>
                    </div>
                    <div className="bg-[#0a0a0f] rounded-lg p-2 text-center">
                      <p className="text-[8px] text-[#64748b]">السعر المستهدف</p>
                      <p className="text-xs font-bold text-white">${aiAnalysis.priceTarget?.toFixed(6) || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[#0a0a0f] rounded-xl border border-dashed border-[#1e1e2f] text-center">
              <p className="text-sm text-[#64748b]">⚠️ لم يتم اختيار عملة بعد</p>
              <Button 
                variant="scalper" 
                size="sm"
                className="mt-2"
                onClick={() => setShowTokenSearch(true)}
                icon={<Search className="w-4 h-4" />}
              >
                🔍 تصفح العملات
              </Button>
            </div>
          )}
        </GlassCard>
      )}

      {/* ============================================================
          🔄 تبديل وضع التداول (آلي / يدوي فوري)
      ============================================================ */}
      {scalperBot && (
        <div className="flex items-center gap-4 p-4 bg-[#0a0a0f] rounded-xl border border-[#1e1e2f]">
          <span className="text-sm text-[#94a3b8]">📊 وضع التداول:</span>
          <button
            onClick={() => setTradeMode('auto')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tradeMode === 'auto'
                ? 'bg-[#f97316] text-white shadow-lg shadow-[#f97316]/20'
                : 'bg-[#1e1e2f] text-[#94a3b8] hover:text-white'
            }`}
          >
            🤖 آلي (حسب الشروط)
          </button>
          <button
            onClick={() => setTradeMode('manual')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tradeMode === 'manual'
                ? 'bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20'
                : 'bg-[#1e1e2f] text-[#94a3b8] hover:text-white'
            }`}
          >
            🖐️ يدوي (فوري)
          </button>
        </div>
      )}

      {/* ============================================================
          🖐️ أزرار الشراء والبيع (تظهر فقط في الوضع اليدوي)
      ============================================================ */}
      {scalperBot && tradeMode === 'manual' && (
        <div className="space-y-3">
          <div className="flex gap-3 p-4 bg-[#0a0a0f] rounded-xl border border-[#3b82f6]/30">
            <div className="flex-1">
              <label className="text-xs text-[#94a3b8] block mb-1">💰 المبلغ لكل صفقة ($)</label>
              <input
                type="number"
                value={manualTradeAmount}
                onChange={(e) => setManualTradeAmount(Number(e.target.value))}
                min="1"
                step="5"
                className="w-full bg-[#1e1e2f] border border-[#2a2a3f] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
              />
            </div>
            <div className="flex-1 flex items-end gap-2">
              <Button
                variant="success"
                size="lg"
                className="flex-1"
                onClick={() => handleManualTrade('buy')}
                disabled={isExecutingTrade || !config.targetTokenAddress}
                icon={isExecutingTrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              >
                {isExecutingTrade ? 'جاري...' : '🟢 شراء'}
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="flex-1"
                onClick={() => handleManualTrade('sell')}
                disabled={isExecutingTrade || !config.targetTokenAddress}
                icon={isExecutingTrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
              >
                {isExecutingTrade ? 'جاري...' : '🔴 بيع'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-[#64748b] text-center">
            💡 يمكنك فتح <span className="text-white font-medium">أكثر من صفقة</span> في نفس الوقت، كل ضغطة على "شراء" تنشئ صفقة جديدة مستقلة
          </p>
        </div>
      )}

      {/* ============================================================
          📊 الصفقات المفتوحة (عددها + عرض سريع)
      ============================================================ */}
      {scalperBot && (
        <div className="flex items-center gap-4 p-3 bg-[#0a0a0f] rounded-xl border border-[#1e1e2f]">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#f97316]" />
            <span className="text-sm text-[#94a3b8]">الصفقات المفتوحة:</span>
            <span className="text-sm font-bold text-white">{openTrades.length}</span>
          </div>
          <button
            onClick={loadOpenTrades}
            className="text-xs text-[#64748b] hover:text-white transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingTrades ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          {openTrades.length > 0 && (
            <div className="text-xs text-[#64748b] flex-1 text-left truncate">
              آخر صفقة: {openTrades[0]?.token_symbol || '—'} | 
              السعر: ${openTrades[0]?.price?.toFixed(4) || '—'} | 
              الكمية: {openTrades[0]?.amount?.toFixed(2) || '—'}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          ⚙️ الإعدادات الأخرى
      ============================================================ */}
      {scalperBot && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">المبلغ الإجمالي ($)</label>
            <input
              type="number"
              value={config.totalAmountUsd}
              onChange={(e) => setConfig({ ...config, totalAmountUsd: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">المبلغ الكامل المخصص للتداول</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">المبلغ لكل صفقة ($)</label>
            <input
              type="number"
              value={config.amountPerTrade}
              onChange={(e) => setConfig({ ...config, amountPerTrade: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">المبلغ المستخدم في كل صفقة</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">أقصى صفقات مفتوحة</label>
            <input
              type="number"
              value={config.maxOpenTrades}
              onChange={(e) => setConfig({ ...config, maxOpenTrades: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">عدد الصفقات التي يمكن فتحها معاً</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">نسبة الانخفاض للشراء (%)</label>
            <input
              type="number"
              step="0.1"
              value={config.buyThreshold}
              onChange={(e) => setConfig({ ...config, buyThreshold: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">مثال: -2% يعني شراء عند انخفاض 2%</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">نسبة الربح المستهدف (%)</label>
            <input
              type="number"
              step="0.1"
              value={config.takeProfit}
              onChange={(e) => setConfig({ ...config, takeProfit: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">يغلق الصفقة عند تحقيق هذه النسبة</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">وقف الخسارة (%)</label>
            <input
              type="number"
              step="0.1"
              value={config.stopLoss}
              onChange={(e) => setConfig({ ...config, stopLoss: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">يغلق الصفقة عند هذه الخسارة</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">وقف متحرك (%)</label>
            <input
              type="number"
              step="0.1"
              value={config.trailingStop}
              onChange={(e) => setConfig({ ...config, trailingStop: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">يتبع السعر عند الارتفاع لحماية الأرباح</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">مدة الصفقة القصوى (ساعات)</label>
            <input
              type="number"
              value={config.maxTradeDuration}
              onChange={(e) => setConfig({ ...config, maxTradeDuration: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">تغلق الصفقة تلقائياً بعد هذه المدة</p>
          </GlassCard>

          <GlassCard className="p-4">
            <label className="text-sm text-[#94a3b8] block mb-1">الفاصل بين الصفقات (دقائق)</label>
            <input
              type="number"
              value={config.minTradeInterval}
              onChange={(e) => setConfig({ ...config, minTradeInterval: Number(e.target.value) })}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2f] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <p className="text-[10px] text-[#64748b] mt-1">أقل فترة بين صفقتين متتاليتين</p>
          </GlassCard>
        </div>
      )}

      {/* ============================================================
          🚀 أزرار الإجراء
      ============================================================ */}
      {scalperBot && (
        <div className="flex flex-wrap gap-4">
          <Button 
            variant="scalper" 
            size="lg"
            onClick={handleSave}
            disabled={isSaving}
            icon={isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          >
            {isSaving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
          </Button>

          <Button 
            variant={isRunning ? 'danger' : 'success'} 
            size="lg"
            onClick={handleStartStop}
            icon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isRunning ? '⏹️ إيقاف البوت' : '▶️ تشغيل البوت'}
          </Button>
        </div>
      )}

      {/* ============================================================
          ℹ️ معلومات إضافية
      ============================================================ */}
      {scalperBot && (
        <GlassCard className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-[#f97316]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">كيف يعمل Scalper X؟</p>
              <ul className="text-xs text-[#64748b] mt-1 space-y-1 list-disc list-inside">
                <li>يراقب سعر <span className="text-[#f97316] font-medium">{config.targetToken || 'العملة المختارة'}</span> على شبكة <span className="text-white font-medium">{getNetworkName(config.network)}</span></li>
                <li>يشتري عند انخفاض السعر بنسبة <span className="text-white">{Math.abs(config.buyThreshold)}%</span></li>
                <li>يبيع عند تحقيق ربح <span className="text-[#10b981]">{config.takeProfit}%</span> أو خسارة <span className="text-[#ef4444]">{Math.abs(config.stopLoss)}%</span></li>
                <li>يمكن فتح <span className="text-white">{config.maxOpenTrades}</span> صفقات على نفس العملة</li>
                <li>يغلق الصفقات تلقائياً بعد <span className="text-white">{config.maxTradeDuration}</span> ساعة</li>
              </ul>
              <p className="text-[10px] text-[#64748b] mt-2">
                🔄 البوت يعمل كل 30 ثانية لاكتشاف فرص جديدة
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ============================================================
          🔍 مودال البحث عن العملات (مبسط)
      ============================================================ */}
      {showTokenSearch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#14141e] border border-[#1e1e2f] rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1e1e2f]">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-[#f97316]" />
                <h3 className="text-lg font-bold text-white">🔍 تصفح العملات</h3>
                <span className="text-xs text-[#64748b]">من الشبكات المتاحة</span>
              </div>
              <button 
                onClick={() => {
                  setShowTokenSearch(false);
                  setIsNetworkFilterOpen(false);
                }}
                className="text-[#64748b] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-[#1e1e2f]">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchTokens()}
                    placeholder="ابحث باسم أو رمز العملة..."
                    className="w-full bg-[#1e1e2f] border border-[#2a2a3f] rounded-xl px-4 py-2.5 text-white placeholder-[#94a3b8] focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
                
                <div className="relative min-w-[190px]">
                  <button
                    type="button"
                    onClick={() => setIsNetworkFilterOpen(prev => !prev)}
                    className="w-full bg-[#2a2a3f] hover:bg-[#3a3a4f] border border-[#3a3a5f] rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-[#f97316] transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {selectedNetworkFilter === 'all' ? (
                        <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      ) : (
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              networkOptions.find(n => n.value === selectedNetworkFilter)?.color || '#64748b'
                          }}
                        />
                      )}
                      <span className="truncate text-sm">
                        {selectedNetworkFilter === 'all'
                          ? 'جميع الشبكات'
                          : networkOptions.find(n => n.value === selectedNetworkFilter)?.name || getNetworkName(selectedNetworkFilter)}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#94a3b8] transition-transform ${isNetworkFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isNetworkFilterOpen && (
                    <div className="absolute top-full right-0 left-0 mt-2 z-[70] bg-[#202033] border border-[#3a3a5f] rounded-xl shadow-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNetworkFilter('all');
                          setIsNetworkFilterOpen(false);
                          if (searchQuery.trim()) {
                            handleSearchTokens('all');
                          }
                        }}
                        className={`w-full px-3 py-2.5 flex items-center gap-2 text-right text-sm transition-colors ${
                          selectedNetworkFilter === 'all'
                            ? 'bg-[#f97316]/20 text-white'
                            : 'text-[#e2e8f0] hover:bg-[#2a2a3f]'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span>جميع الشبكات</span>
                        {selectedNetworkFilter === 'all' && <CheckCircle className="w-3.5 h-3.5 mr-auto text-[#f97316]" />}
                      </button>

                      {networkOptions.map((n) => (
                        <button
                          type="button"
                          key={n.value}
                          onClick={() => {
                            setSelectedNetworkFilter(n.value);
                            setIsNetworkFilterOpen(false);
                            if (searchQuery.trim()) {
                              handleSearchTokens(n.value);
                            }
                          }}
                          className={`w-full px-3 py-2.5 flex items-center gap-2 text-right text-sm transition-colors ${
                            selectedNetworkFilter === n.value
                              ? 'bg-[#f97316]/20 text-white'
                              : 'text-[#e2e8f0] hover:bg-[#2a2a3f]'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                            style={{ backgroundColor: n.color }}
                          />
                          <span className="flex-1">{n.name}</span>
                          <span className="text-xs opacity-70">{n.icon}</span>
                          {selectedNetworkFilter === n.value && (
                            <CheckCircle className="w-3.5 h-3.5 text-[#f97316]" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <Button 
                  variant="scalper"
                  onClick={() => handleSearchTokens()}
                  disabled={searchLoading}
                  icon={searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                >
                  {searchLoading ? 'جاري...' : 'بحث'}
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => fetchAllTokens()}
                  disabled={searchLoading}
                  icon={<RefreshCw className={`w-4 h-4 ${searchLoading ? 'animate-spin' : ''}`} />}
                >
                  تحديث
                </Button>
              </div>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-[#64748b] flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  فلتر:
                </span>
                <button
                  onClick={() => setTokenFilter('all')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'all' 
                      ? 'bg-[#f97316] text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  📊 الكل
                </button>
                <button
                  onClick={() => setTokenFilter('good')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'good' 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  ⭐ جيدة
                </button>
                <button
                  onClick={() => setTokenFilter('new')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'new' 
                      ? 'bg-cyan-500 text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  🆕 جديدة
                </button>
                <button
                  onClick={() => setTokenFilter('volume')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'volume' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  📈 حجم
                </button>
                <button
                  onClick={() => setTokenFilter('liquid')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'liquid' 
                      ? 'bg-purple-500 text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  💧 سيولة
                </button>
                <button
                  onClick={() => setTokenFilter('momentum')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    tokenFilter === 'momentum' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-[#1e1e2f] text-[#94a3b8] hover:bg-[#2a2a3f]'
                  }`}
                >
                  ⚡ زخم
                </button>
              </div>
              
              <div className="flex items-center gap-4 mt-2">
                <p className="text-xs text-[#94a3b8]">
                  {searchResults.length > 0 ? `🟢 ${searchResults.length} عملة فريدة` : '🔍 ابحث عن عملة'}
                </p>
                {selectedNetworkFilter !== 'all' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#f97316]/20 text-[#f97316]">
                    {networkOptions.find(n => n.value === selectedNetworkFilter)?.label}
                  </span>
                )}
              </div>
              {searchError && (
                <p className="text-xs text-red-400 mt-2">{searchError}</p>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {searchResults.length === 0 && !searchLoading && !searchError && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-[#64748b] mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-[#64748b]">ابحث عن عملة أو استعرض الشبكات</p>
                  <p className="text-xs text-[#64748b] mt-1">يمكنك البحث بالرمز أو الاسم</p>
                </div>
              )}

              {searchLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#f97316]" />
                  <p className="text-sm text-[#64748b] ml-3">جاري التحميل...</p>
                </div>
              )}

              {searchResults.map((token, index) => {
                const networkColor = token.networkColor || getNetworkColor(token.network) || '#64748b';
                const networkName = token.networkName || getNetworkName(token.network) || token.network;
                const networkIcon = token.networkIcon || getNetworkIcon(token.network) || '🌐';
                const isPositive = token.change >= 0;
                const isGood = token.liquidity > 50000 && token.change > 0 && token.volume > 100000;
                const isNew = token.pairCreatedAt > Date.now() - 24 * 60 * 60 * 1000;
                const isMomentum = token.change > 10 && token.volume > 50000 && token.liquidity > 20000;
                
                return (
                  <div 
                    key={`${token.network}:${token.address}-${index}`}
                    onClick={() => selectTokenFromSearch(token)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors border ${
                      isGood && tokenFilter === 'good'
                        ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                        : isNew && tokenFilter === 'new'
                        ? 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20'
                        : isMomentum && tokenFilter === 'momentum'
                        ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'
                        : 'bg-[#0a0a0f] border-transparent hover:bg-[#1e1e2f] hover:border-[#f97316]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 text-white font-bold text-xs border border-white/10 bg-[#101923]"
                        style={{ boxShadow: `0 0 0 1px ${networkColor}20` }}
                      >
                        {token.imageUrl ? (
                          <img
                            src={token.imageUrl}
                            alt={token.symbol || 'token'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                parent.textContent = (token.symbol?.slice(0, 2) || '??').toUpperCase();
                              }
                            }}
                          />
                        ) : (
                          <span>{token.symbol?.slice(0, 2) || '??'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-white text-sm">{token.symbol}</p>
                          <p className="text-xs text-[#94a3b8] truncate max-w-[150px]">{token.name}</p>
                          <span className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                                style={{ backgroundColor: `${networkColor}30`, color: networkColor }}>
                            {networkIcon} {networkName}
                          </span>
                          {isGood && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">⭐ جيدة</span>
                          )}
                          {isNew && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">🆕 جديدة</span>
                          )}
                          {isMomentum && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">⚡ زخم</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#94a3b8]">💰 ${(token.liquidity / 1000).toFixed(1)}K</span>
                          <span className="text-[10px] text-[#94a3b8]">📊 ${(token.volume / 1000).toFixed(1)}K</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(token.address, `عنوان ${token.symbol}`); }}
                            className="p-0.5 hover:bg-slate-700 rounded transition-colors"
                          >
                            {copiedAddress === token.address ? (
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500 hover:text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-sm font-mono text-white">{token.priceDisplay || '—'}</p>
                      <p className={`text-xs font-medium ${isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                        {token.changeDisplay || '0.00%'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-[#1e1e2f] text-xs text-[#64748b] text-center">
              💡 اضغط على أي عملة لاختيارها كهدف للبوت
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScalperConfigPage;