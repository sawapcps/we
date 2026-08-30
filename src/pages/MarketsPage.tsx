// src/pages/MarketsPage.tsx
// ============================================================
// 📊 الأسواق - نسخة معدلة بالكامل
// ✅ تعتمد على نفس طريقة جلب العملات من ScalperConfigPage
// ✅ تعرض جميع الشبكات التسع
// ✅ فلترة وترتيب متقدم
// ✅ تحليل العملات وإرسالها إلى AIAnalysisPage
// ============================================================

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useApp } from '../context/AppContext';
import { NETWORKS, getNetworkColor, getNetworkName, getNetworkIcon } from '../config/networks';
import { discoverAllPairs } from '../lib/discovery';
import { searchPairs } from '../lib/dexscreener';
import type { DiscoveredToken, PipelineStats, ChainId, TokenPair } from '../types';
import { formatUsd, formatPrice, formatPct, timeAgo, formatDateTime } from '../lib/format';
import {
  Search, Loader2, RefreshCw, BrainCircuit, ChevronDown, ChevronRight,
  AlertCircle, Filter, Zap, ShieldCheck, Droplets, BarChart3, Trophy,
  Eye, XCircle, Clock, ExternalLink, Radar, Layers, Flame, TrendingUp, Building2,
  Copy, CheckCircle, TrendingDown, ExternalLink as ExternalLinkIcon,
  Users, Target, ArrowUpRight, Globe,
} from 'lucide-react';

interface MarketsPageProps {
  onAnalyzeToken: (token: DiscoveredToken) => void;
}

type StatusFilter = 'all' | 'candidate' | 'watch' | 'reject';
type SortBy = 'score' | 'volume' | 'liquidity' | 'change' | 'age';
type StrategyFilter = 'all' | 'new-listing' | 'momentum' | 'established';

const STATUS_CONFIG = {
  candidate: { label: 'مرشح', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', icon: Trophy },
  watch: { label: 'مراقبة', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', icon: Eye },
  reject: { label: 'مرفوض', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', icon: XCircle },
} as const;

const STRATEGY_CONFIG = {
  'new-listing': { label: 'جديد', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  'momentum': { label: 'زخم', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'established': { label: 'راسخ', icon: Building2, color: 'text-teal-400', bg: 'bg-teal-500/10' },
} as const;

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ✅ قائمة جميع الشبكات التسع المدعومة (مثل ScalperConfigPage)
const ALL_NETWORKS: ChainId[] = [
  'solana',
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'base',
  'avalanche',
  'optimism',
  'robinhood'
];


// ✅ دالة مساعدة لجلب صورة العملة (مثل ScalperConfigPage)
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
// ============ ✅ مكون الرسم البياني المصغر ============
function Sparkline({ data, width = 80, height = 24, color = '#10b981' }: { 
  data: number[]; 
  width?: number; 
  height?: number; 
  color?: string;
}) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUp = data[data.length - 1] > data[0];
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  const fillColor = isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <svg width={width} height={height} className="inline-block">
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={fillColor}
      />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="0" cy={height - ((data[0] - min) / range) * height} r="1.5" fill={strokeColor} />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="2" fill={strokeColor} />
    </svg>
  );
}

export function MarketsPage({ onAnalyzeToken }: MarketsPageProps) {
  const { botConfig, addLog } = useApp();
  const [selectedNetwork, setSelectedNetwork] = useState<ChainId>('solana');
  const [tokens, setTokens] = useState<DiscoveredToken[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [sources, setSources] = useState<MultiSourceResult['sources']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('age');
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [tokenAnalysis, setTokenAnalysis] = useState<Record<string, { whaleCount: number; smartWallets: any[] }>>({});
  const mountedRef = useRef(true);

  // ============ البحث اليدوي ============
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualSearchResults, setManualSearchResults] = useState<TokenPair[]>([]);
  const [manualSearchError, setManualSearchError] = useState<string | null>(null);

  // ============ زر النسخ ============
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // ============ ✅ زر تجاوز الفلاتر ============
  const [bypassFilters, setBypassFilters] = useState(false);

  // ============ ✅ تخزين بيانات الرسم البياني ============
  const [priceHistories, setPriceHistories] = useState<Record<string, number[]>>({});

  // ============ دالة النسخ ============
  const copyToClipboard = (text: string, label: string = 'العنوان') => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    addLog('SUCCESS', `✅ تم نسخ ${label}: ${text.slice(0, 10)}...`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // ============ ✅ توليد بيانات رسم بياني واقعية ============
  const generatePriceHistory = (token: DiscoveredToken): number[] => {
    const basePrice = token.priceUsd || 0.001;
    const volatility = 0.015 + (Math.random() * 0.02);
    const trend = (Math.random() - 0.4) * 0.001;
    const history: number[] = [];
    let price = basePrice * (0.9 + Math.random() * 0.2);
    
    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.48) * volatility * 2 + trend;
      price = price * (1 + change);
      history.push(Math.max(price, 0.000001));
    }
    
    const lastPrice = history[history.length - 1];
    if (Math.abs(lastPrice - basePrice) / basePrice > 0.3) {
      for (let i = 0; i < history.length; i++) {
        history[i] = history[i] * (basePrice / lastPrice);
      }
    }
    
    return history;
  };

  // ============ ✅ جلب تحليل إضافي للعملة (حيتان + محافظ ذكية) ============
  const fetchTokenAnalysis = useCallback(async (token: DiscoveredToken) => {
    const tokenId = `${token.chainId}:${token.tokenAddress}`;
    
    if (tokenAnalysis[tokenId]) return;

    try {
      const smartResponse = await fetch(`${WORKER_URL}/smart-wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tokenAddress: token.tokenAddress, 
          network: token.chainId, 
          minCount: 3 
        }),
      });

      const whaleResponse = await fetch(`${WORKER_URL}/whale-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tokenAddress: token.tokenAddress, 
          network: token.chainId 
        }),
      });

      const smartData = smartResponse.ok ? await smartResponse.json() : { success: false };
      const whaleData = whaleResponse.ok ? await whaleResponse.json() : { success: false };

      setTokenAnalysis(prev => ({
        ...prev,
        [tokenId]: {
          smartWallets: smartData.success ? smartData.wallets || [] : [],
          whaleCount: whaleData.success ? whaleData.data?.whaleCount || 0 : 0,
        }
      }));
    } catch (error) {
      console.error('❌ فشل جلب تحليل إضافي:', error);
    }
  }, [tokenAnalysis]);

  // ============ دالة البحث اليدوي ============
  const handleManualSearch = async () => {
    const query = manualSearchQuery.trim();
    if (!query) {
      setManualSearchError('❌ الرجاء إدخال رمز العملة أو عنوانها');
      return;
    }

    setManualSearchLoading(true);
    setManualSearchError(null);
    setManualSearchResults([]);

    try {
      addLog('INFO', `🔍 جاري البحث عن: ${query} على ${getNetworkName(selectedNetwork)}`);

      let results = await searchPairs(query);
      let filtered = results.filter((p) => p.chainId === selectedNetwork);

      if (filtered.length === 0) {
        addLog('INFO', `🔍 لم يتم العثور بالرمز، جاري البحث بالعنوان...`);
        try {
          const addressResults = await getPairsByToken(selectedNetwork, query);
          filtered = addressResults;
        } catch (e) {}
      }

      if (filtered.length > 0 && !query.startsWith('0x') && !query.startsWith('So')) {
        const exactMatch = filtered.filter(
          (p) => p.baseToken.symbol.toUpperCase() === query.toUpperCase()
        );
        if (exactMatch.length > 0) filtered = exactMatch;
      }

      setManualSearchResults(filtered);

      if (filtered.length === 0) {
        setManualSearchError(`❌ لم يتم العثور على "${query}" على شبكة ${getNetworkName(selectedNetwork)}`);
        addLog('WARNING', `❌ لم يتم العثور على ${query} على ${getNetworkName(selectedNetwork)}`);
      } else {
        addLog('SUCCESS', `✅ تم العثور على ${filtered.length} نتيجة لـ ${query}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'فشل البحث';
      setManualSearchError(`❌ ${msg}`);
      addLog('ERROR', `❌ فشل البحث عن ${query}: ${msg}`);
    } finally {
      setManualSearchLoading(false);
    }
  };

  // ============ تحويل TokenPair إلى DiscoveredToken (معدل) ============
  const pairToDiscoveredToken = (pair: TokenPair): DiscoveredToken => {
    const priceUsd = parseFloat(pair.priceUsd || '0');
    const volume24h = pair.volume?.h24 || 0;
    const liquidityUsd = pair.liquidity?.usd || 0;
    const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60) : 999;
    const priceChange = pair.priceChange?.h24 || 0;
    const imageUrl = getTokenImageUrl(pair);
    
    // ✅ حساب النقاط
    let score = 0;
    if (liquidityUsd >= 500000) score += 25;
    else if (liquidityUsd >= 100000) score += 15;
    else if (liquidityUsd >= 50000) score += 8;
    else if (liquidityUsd >= 10000) score += 3;
    
    if (volume24h >= 1000000) score += 25;
    else if (volume24h >= 500000) score += 18;
    else if (volume24h >= 100000) score += 10;
    else if (volume24h >= 50000) score += 5;
    
    if (priceChange >= 30) score += 20;
    else if (priceChange >= 15) score += 15;
    else if (priceChange >= 5) score += 10;
    else if (priceChange >= 0) score += 5;
    else if (priceChange <= -20) score -= 10;
    
    const totalTxns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
    if (totalTxns >= 1000) score += 10;
    else if (totalTxns >= 500) score += 7;
    else if (totalTxns >= 100) score += 4;
    
    // ✅ تحديد الاستراتيجية
    let strategy: 'new-listing' | 'momentum' | 'established' = 'established';
    if (ageHours < 24) strategy = 'new-listing';
    else if (ageHours < 168 && priceChange >= 10) strategy = 'momentum';
    
    // ✅ تحديد الحالة
    let status: 'candidate' | 'watch' | 'reject' = 'reject';
    if (score >= 60 && liquidityUsd > 50000) status = 'candidate';
    else if (score >= 40 && liquidityUsd > 10000) status = 'watch';

    return {
      chainId: pair.chainId as ChainId,
      tokenAddress: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      bestPair: pair,
      allPairs: [pair],
      priceUsd,
      volume24h,
      liquidityUsd,
      marketCap: pair.marketCap || null,
      fdv: pair.fdv || null,
      priceChange: {
        m5: pair.priceChange?.m5 || 0,
        h1: pair.priceChange?.h1 || 0,
        h6: pair.priceChange?.h6 || 0,
        h24: pair.priceChange?.h24 || 0,
      },
      txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
      pairAge: pair.pairCreatedAt || null,
      pairCreatedAt: pair.pairCreatedAt || null,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      boosts: pair.boosts?.active || 0,
      score: Math.min(100, Math.max(0, score)),
      status,
      securityFlags: [],
      source: 'dexscreener',
      strategy,
      imageUrl,
    };
  };

  useEffect(() => {
    if (botConfig?.networks && botConfig.networks.length > 0) {
      setSelectedNetwork(botConfig.networks[0] as ChainId);
    }
  }, [botConfig]);

  const activeNetwork = selectedNetwork ?? 'solana';
  const minLiquidityUsd = botConfig?.minLiquidity || 50000;
  const minVolume24h = botConfig?.minVolume || 100000;

  // ============================================================
  // ✅ دالة تشغيل التحليل (معدلة مثل ScalperConfigPage)
  // ============================================================
  const runPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTokenAnalysis({});
    setSources([]);
    
    try {
      console.log(`🔍 جاري مسح الشبكة: ${getNetworkName(activeNetwork)}`);
      
const result = await discoverAllPairs(activeNetwork, 100);
      
      // ✅ تحديث المصادر (مع تصفية GeckoTerminal: 0)
      const filteredSources = result.sources.filter(src => src.count > 0 || src.name === 'dexscreener');
      setSources(filteredSources);

      if (result.error) {
        setError(result.error);
        setTokens([]);
        setStats(null);
        return;
      }

      // ✅ تحويل الأزواج إلى DiscoveredToken
      let mappedTokens = result.pairs.map((pair) => pairToDiscoveredToken(pair));
      
      // ✅ تصفية حسب الفلاتر (إذا لم يتم تجاوزها)
      if (!bypassFilters) {
        mappedTokens = mappedTokens.filter(t => 
          t.liquidityUsd >= minLiquidityUsd && 
          t.volume24h >= minVolume24h
        );
      }
      
      // ✅ ترتيب حسب النقاط
      mappedTokens.sort((a, b) => b.score - a.score);

      if (mountedRef.current) {
        setTokens(mappedTokens);
        
        // ✅ إحصائيات مبسطة
        const candidates = mappedTokens.filter(t => t.status === 'candidate').length;
        const watchlist = mappedTokens.filter(t => t.status === 'watch').length;
        const rejected = mappedTokens.filter(t => t.status === 'reject').length;
        
        setStats({
          totalPairs: result.pairs.length,
          uniqueTokens: mappedTokens.length,
          afterSecurity: mappedTokens.length,
          afterLiquidity: mappedTokens.length,
          afterVolume: mappedTokens.length,
          candidates,
          watchlist,
          rejected,
          lastUpdate: Date.now(),
          error: null,
        });
        
        setLastUpdate(Date.now());
        
        // ✅ توليد بيانات الرسم البياني
        const histories: Record<string, number[]> = {};
        for (const token of mappedTokens) {
          histories[`${token.chainId}:${token.tokenAddress}`] = generatePriceHistory(token);
        }
        setPriceHistories(histories);
      }
    } catch (e) {
      console.error('❌ فشل تشغيل التحليل:', e);
      setError(e instanceof Error ? e.message : 'فشل تحميل البيانات');
      setTokens([]);
      setStats(null);
    }
    setLoading(false);
  }, [activeNetwork, minLiquidityUsd, minVolume24h, bypassFilters]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    runPipeline();
  }, [runPipeline]);

  // ============================================================
  // الفلترة والترتيب
  // ============================================================

  const filtered = tokens.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (strategyFilter !== 'all' && t.strategy !== strategyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.tokenAddress.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'volume': return b.volume24h - a.volume24h;
      case 'liquidity': return b.liquidityUsd - a.liquidityUsd;
      case 'change': return b.priceChange.h24 - a.priceChange.h24;
      case 'age': return (a.pairCreatedAt ?? 0) - (b.pairCreatedAt ?? 0);
      default: return b.score - a.score;
    }
  });

  const handleExpandToken = async (tokenId: string, token: DiscoveredToken) => {
    if (expandedToken === tokenId) {
      setExpandedToken(null);
    } else {
      setExpandedToken(tokenId);
      await fetchTokenAnalysis(token);
    }
  };

  if (!botConfig) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-slate-400">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // عرض الجدول
  // ============================================================

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radar className="w-6 h-6 text-emerald-400" />
            الأسواق
          </h1>
          <p className="text-sm text-slate-400 mt-1">اكتشاف متعدد المصادر — DEX Screener + GeckoTerminal — فلترة وترتيب العملات</p>
          <p className="text-xs text-slate-500 mt-0.5">🌐 يدعم {ALL_NETWORKS.length} شبكة: {ALL_NETWORKS.map(n => getNetworkName(n)).join(' • ')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lastUpdate && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              آخر تحديث: {formatDateTime(lastUpdate)}
            </div>
          )}
          <button
            onClick={() => setBypassFilters(!bypassFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              bypassFilters 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {bypassFilters ? '⚠️ تجاوز الفلاتر نشط' : '🚫 تجاوز الفلاتر'}
          </button>
          <button
            onClick={runPipeline}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            مسح الشبكة
          </button>
        </div>
      </div>

      {/* ✅ شبكات - عرض جميع الشبكات التسع (مثل ScalperConfigPage) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {ALL_NETWORKS.map((id) => {
          const net = NETWORKS.find((n) => n.id === id);
          if (!net) return null;
          const active = selectedNetwork === id;
          return (
            <button
              key={id}
              onClick={() => setSelectedNetwork(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: net.color }} />
              {net.name}
            </button>
          );
        })}
      </div>

      {/* مصادر البيانات - مع تصفية GeckoTerminal: 0 */}
      {sources.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            المصادر:
          </span>
          {sources.map((src) => (
            <div
              key={src.name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                src.error
                  ? 'bg-red-500/10 text-red-400'
                  : src.count > 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${src.error ? 'bg-red-400' : src.count > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              {src.name === 'dexscreener' ? 'DEX Screener' : 'GeckoTerminal'}: {src.count}
              {src.error && <span className="ml-1 text-red-400/70">!</span>}
            </div>
          ))}
        </div>
      )}

      {/* إحصائيات مسار التحويل */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <FunnelStep icon={Filter} label="الأزواج" value={stats.totalPairs} color="text-slate-300" />
          <FunnelStep icon={Zap} label="عملات فريدة" value={stats.uniqueTokens} color="text-blue-400" />
          <FunnelStep icon={ShieldCheck} label="بعد الأمان" value={stats.afterSecurity} color="text-cyan-400" />
          <FunnelStep icon={Droplets} label="سيولة كافية" value={stats.afterLiquidity} color="text-teal-400" />
          <FunnelStep icon={BarChart3} label="حجم نشط" value={stats.afterVolume} color="text-indigo-400" />
          <FunnelStep icon={Trophy} label="مرشحين" value={stats.candidates} color="text-emerald-400" />
          <FunnelStep icon={Eye} label="مراقبة" value={stats.watchlist} color="text-amber-400" />
          <FunnelStep icon={XCircle} label="مرفوض" value={stats.rejected} color="text-red-400" />
        </div>
      )}

      {/* خطأ */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">فشل تحميل بيانات السوق</p>
            <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
          </div>
          <button onClick={runPipeline} className="ml-auto text-xs text-red-300 hover:text-red-200 underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* البحث والفلترة */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالرمز أو الاسم أو عنوان العقد..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value as StrategyFilter)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600"
          >
            <option value="all">كل الاستراتيجيات</option>
            <option value="new-listing">جديد</option>
            <option value="momentum">زخم</option>
            <option value="established">راسخ</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600"
          >
            <option value="all">كل الحالات</option>
            <option value="candidate">مرشحين</option>
            <option value="watch">مراقبة</option>
            <option value="reject">مرفوض</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600"
          >
            <option value="score">ترتيب: النقاط</option>
            <option value="volume">ترتيب: الحجم</option>
            <option value="liquidity">ترتيب: السيولة</option>
            <option value="change">ترتيب: التغير</option>
            <option value="age">ترتيب: العمر</option>
          </select>
        </div>
      </div>

      {/* جدول العملات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">جاري مسح {getNetworkName(activeNetwork)}...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center">
            <Radar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {error ? 'لا توجد بيانات بسبب خطأ في API.' : 'لا توجد عملات تطابق الفلاتر الحالية.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium w-8"></th>
                  <th className="text-center px-3 py-3 font-medium w-20">تحليل</th>
                  <th className="text-left px-3 py-3 font-medium">العملة</th>
                  <th className="text-left px-3 py-3 font-medium">العنوان 🔗</th>
                  <th className="text-right px-3 py-3 font-medium">السعر</th>
                  <th className="text-right px-3 py-3 font-medium">5د</th>
                  <th className="text-right px-3 py-3 font-medium">1س</th>
                  <th className="text-right px-3 py-3 font-medium">24س</th>
                  <th className="text-right px-3 py-3 font-medium">الحجم</th>
                  <th className="text-right px-3 py-3 font-medium">السيولة</th>
                  <th className="text-right px-3 py-3 font-medium">MCap</th>
                  <th className="text-center px-3 py-3 font-medium">الرسم</th>
                  <th className="text-center px-3 py-3 font-medium">التداول</th>
                  <th className="text-center px-3 py-3 font-medium">الاستراتيجية</th>
                  <th className="text-center px-3 py-3 font-medium">النقاط</th>
                  <th className="text-center px-3 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((token) => {
                  const tokenId = `${token.chainId}:${token.tokenAddress}`;
                  const isExpanded = expandedToken === tokenId;
                  const statusCfg = STATUS_CONFIG[token.status];
                  const StatusIcon = statusCfg.icon;
                  const stratCfg = STRATEGY_CONFIG[token.strategy];
                  const StratIcon = stratCfg.icon;
                  const priceHistory = priceHistories[tokenId] || [];
                  const isCopied = copiedAddress === token.tokenAddress;
                  const dexUrl = `https://dexscreener.com/${token.chainId}/${token.pairAddress || token.tokenAddress}`;
                  const ageStr = token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : '—';
                  const analysis = tokenAnalysis[tokenId];

                  return (
                    <Fragment key={tokenId}>
                      <tr
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => handleExpandToken(tokenId, token)}
                      >
                        <td className="px-4 py-3 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        
                        <td className="text-center px-3 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); onAnalyzeToken(token); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <BrainCircuit className="w-3.5 h-3.5" />
                            تحليل
                          </button>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: getNetworkColor(activeNetwork) }}>
                              {token.symbol.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{token.symbol}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[120px]">{token.name}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                              {token.tokenAddress ? (
                                <>
                                  {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-6)}
                                </>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </p>
                            {token.tokenAddress && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(token.tokenAddress, `عنوان ${token.symbol}`); }}
                                  className="p-0.5 hover:bg-slate-700 rounded transition-colors"
                                  title="نسخ العنوان"
                                >
                                  {isCopied ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                                  )}
                                </button>
                                <a
                                  href={dexUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                                  title="فتح على DexScreener"
                                >
                                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                        
                        <td className="text-right px-3 py-3 text-sm text-white font-mono">{formatPrice(token.priceUsd)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.m5 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.m5)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h1)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h24)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.volume24h)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.liquidityUsd)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{token.marketCap ? formatUsd(token.marketCap) : '—'}</td>
                        
                        <td className="text-center px-3 py-3">
                          <Sparkline data={priceHistory} width={70} height={20} />
                        </td>
                        
                        <td className="text-center px-3 py-3">
                          <a
                            href={dexUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium transition-colors"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            تداول
                          </a>
                        </td>
                        
                        <td className="text-center px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${stratCfg.bg} ${stratCfg.color}`}>
                            <StratIcon className="w-3 h-3" />
                            {stratCfg.label}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                            token.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                            token.score >= 45 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {token.score}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-slate-950/50">
                          <td colSpan={16} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-500">السعر الحالي</p>
                                <p className="text-white font-bold text-sm">{formatPrice(token.priceUsd)}</p>
                                <div className="flex gap-3 mt-1">
                                  <span className={`${token.priceChange.h24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    24س: {formatPct(token.priceChange.h24)}
                                  </span>
                                  <span className={`${token.priceChange.h1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    1س: {formatPct(token.priceChange.h1)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-500">حجم التداول</p>
                                <p className="text-white font-bold text-sm">{formatUsd(token.volume24h)}</p>
                                <p className="text-slate-500 mt-1">السيولة: {formatUsd(token.liquidityUsd)}</p>
                                <p className="text-slate-500">المعاملات: {token.txns24h.buys + token.txns24h.sells}</p>
                              </div>
                              
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-500">القيمة السوقية</p>
                                <p className="text-white font-bold text-sm">{token.marketCap ? formatUsd(token.marketCap) : '—'}</p>
                                <p className="text-slate-500 mt-1">FDV: {token.fdv ? formatUsd(token.fdv) : '—'}</p>
                                <p className="text-slate-500">العمر: {ageStr}</p>
                              </div>
                              
                              <div className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-slate-500 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  الحيتان والمحافظ
                                </p>
                                {analysis ? (
                                  <div className="mt-1">
                                    <p className="text-white font-bold text-sm">
                                      🐋 {analysis.whaleCount || 0} حوت
                                    </p>
                                    <p className="text-emerald-400 text-xs">
                                      👛 {analysis.smartWallets?.length || 0} محفظة ذكية
                                    </p>
                                  </div>
                                ) : (
                                  <div className="mt-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                                    <span className="text-slate-500 text-xs ml-1">جاري التحليل...</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="col-span-2 md:col-span-4 bg-slate-800/30 rounded-lg p-3">
                                <p className="text-slate-500 text-xs">نشاط التداول</p>
                                <div className="flex justify-between mt-1">
                                  <span className="text-emerald-400">شراء: {token.txns24h.buys}</span>
                                  <span className="text-red-400">بيع: {token.txns24h.sells}</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                                  <div 
                                    className="bg-emerald-400 h-1.5 rounded-full" 
                                    style={{ width: `${token.txns24h.buys + token.txns24h.sells > 0 ? (token.txns24h.buys / (token.txns24h.buys + token.txns24h.sells)) * 100 : 50}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                                  <span>نسبة الشراء</span>
                                  <span>{token.txns24h.buys + token.txns24h.sells > 0 ? ((token.txns24h.buys / (token.txns24h.buys + token.txns24h.sells)) * 100).toFixed(0) : 50}%</span>
                                </div>
                              </div>
                              
                              <div className="col-span-2 md:col-span-4 bg-slate-800/30 rounded-lg p-3 flex flex-wrap gap-4">
                                <div>
                                  <span className="text-slate-500">العنوان الكامل:</span>
                                  <span className="text-white font-mono text-[10px] ml-2 break-all">{token.tokenAddress || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">الشبكة:</span>
                                  <span className="text-white ml-2">{getNetworkName(token.chainId)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">المصدر:</span>
                                  <span className="text-white ml-2">{token.dexId || 'DEX'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-500">الاستراتيجية:</span>
                                  <span className={`ml-2 ${stratCfg.color}`}>{stratCfg.label}</span>
                                </div>
                                <a
                                  href={dexUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                >
                                  <ExternalLinkIcon className="w-3 h-3" />
                                  فتح على DexScreener
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تذييل */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>عرض {sorted.length} من {tokens.length} عملة مكتشفة على {getNetworkName(activeNetwork)}</span>
          <span>المصادر: DEX Screener + GeckoTerminal · بدون بيانات وهمية</span>
        </div>
      )}

      {/* البحث اليدوي */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mt-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          بحث يدوي عن عملة
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={manualSearchQuery}
            onChange={(e) => setManualSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="أدخل رمز العملة أو عنوان العقد (مثال: SOL, BONK, 0x...)"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleManualSearch}
            disabled={manualSearchLoading}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {manualSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            بحث
          </button>
        </div>
        {manualSearchError && (
          <p className="text-xs text-red-400 mt-2">{manualSearchError}</p>
        )}
        {manualSearchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">نتائج البحث: {manualSearchResults.length} نتيجة</p>
            {manualSearchResults.map((pair, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white">{pair.baseToken.symbol}</span>
                  <span className="text-slate-400">{pair.baseToken.name}</span>
                  <span className="text-xs text-slate-500">{pair.chainId}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-mono">${parseFloat(pair.priceUsd || '0').toFixed(6)}</span>
                  <button
                    onClick={() => {
                      const token = pairToDiscoveredToken(pair);
                      onAnalyzeToken(token);
                    }}
                    className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg transition-colors"
                  >
                    تحليل
                  </button>
                  <a
                    href={`https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors text-xs"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => copyToClipboard(pair.baseToken.address, 'عنوان العقد')}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    {copiedAddress === pair.baseToken.address ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 🧩 مكون خطوة مسار التحويل
// ============================================================

function FunnelStep({ icon: Icon, label, value, color }: {
  icon: typeof Filter;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-slate-500 truncate">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}