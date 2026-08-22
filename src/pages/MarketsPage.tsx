// src/pages/MarketsPage.tsx

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useApp } from '../context/AppContext';
import { NETWORKS, getNetworkColor, getNetworkName } from '../config/networks';
import { discoverAllPairs, type MultiSourceResult } from '../lib/discovery';
import { runBotAnalysis, type BotAnalysisConfig } from '../lib/hunterEngine'; // ✅ تغيير الاستيراد
import { searchPairs, getPairsByToken } from '../lib/dexscreener';
import type { DiscoveredToken, PipelineStats, ChainId, TokenPair } from '../types';
import { formatUsd, formatPrice, formatPct, timeAgo, formatDateTime } from '../lib/format';
import {
  Search, Loader2, RefreshCw, BrainCircuit, ChevronDown, ChevronRight,
  AlertCircle, Filter, Zap, ShieldCheck, Droplets, BarChart3, Trophy,
  Eye, XCircle, Clock, ExternalLink, Radar, Layers, Flame, TrendingUp, Building2,
  Copy, CheckCircle, TrendingDown,
} from 'lucide-react';

interface MarketsPageProps {
  onAnalyzeToken: (token: DiscoveredToken) => void;
}

type StatusFilter = 'all' | 'candidate' | 'watch' | 'reject';
type SortBy = 'score' | 'volume' | 'liquidity' | 'change' | 'age';
type StrategyFilter = 'all' | 'new-listing' | 'momentum' | 'established';

const STATUS_CONFIG = {
  candidate: { label: 'Candidate', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', icon: Trophy },
  watch: { label: 'Watch', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', icon: Eye },
  reject: { label: 'Reject', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', icon: XCircle },
} as const;

const STRATEGY_CONFIG = {
  'new-listing': { label: 'New', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  'momentum': { label: 'Momentum', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'established': { label: 'Established', icon: Building2, color: 'text-teal-400', bg: 'bg-teal-500/10' },
} as const;

// ============ ✅ مكون الرسم البياني البسيط ============
function Sparkline({ data, width = 60, height = 20, color = '#10b981' }: { 
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

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="0" cy={height - ((data[0] - min) / range) * height} r="1.5" fill={strokeColor} />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="1.5" fill={strokeColor} />
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

  // ============ دالة النسخ ============
  const copyToClipboard = (text: string, label: string = 'العنوان') => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    addLog('SUCCESS', `✅ تم نسخ ${label}: ${text.slice(0, 10)}...`);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

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

  // ============ تحويل TokenPair إلى DiscoveredToken ============
  const pairToDiscoveredToken = (pair: TokenPair): DiscoveredToken => {
    const priceUsd = parseFloat(pair.priceUsd || '0');
    const volume24h = pair.volume?.h24 || 0;
    const liquidityUsd = pair.liquidity?.usd || 0;

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
      score: 70,
      status: 'candidate',
      securityFlags: [],
      source: 'dexscreener',
      strategy: 'established',
    };
  };

  // ============ باقي الكود ============

  useEffect(() => {
    if (botConfig?.networks && botConfig.networks.length > 0) {
      setSelectedNetwork(botConfig.networks[0] as ChainId);
    }
  }, [botConfig]);

  const activeNetwork = selectedNetwork ?? 'solana';
  const minLiquidityUsd = botConfig?.minLiquidity || 50000;
  const minVolume24h = botConfig?.minVolume || 100000;
  const minPriceChange24h = 0;

  // ============================================================
  // ✅ دالة تشغيل التحليل (معدلة لاستخدام runBotAnalysis)
  // ============================================================
  const runPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverAllPairs(activeNetwork);
      setSources(result.sources);

      if (result.error) {
        setError(result.error);
        setTokens([]);
        setStats(null);
        return;
      }

      // ✅ بناء إعدادات البوت الجديدة
      const botConfigForAnalysis: BotAnalysisConfig = {
        botType: 'hunter',  // استخدام Hunter لعرض الأسواق
        minLiquidityUsd: bypassFilters ? 0 : minLiquidityUsd,
        minVolume24h: bypassFilters ? 0 : minVolume24h,
        minScore: 0,  // لا نريد فلترة حسب النقاط في صفحة الأسواق
        maxPositionUsd: 100,
        takeProfitPct: 30,
        stopLossPct: 10,
        networks: [activeNetwork],
        // إعدادات Hunter المحددة
        minSmartWallets: 0,
        smartWalletConfidence: 50,
        allowNewListings: true,
        minBuyRatio: 0,
      };

      // ✅ استدعاء الدالة الجديدة (مع await لأنها أصبحت async)
      const huntResult = await runBotAnalysis(result.pairs, activeNetwork, botConfigForAnalysis);

      if (mountedRef.current) {
        setTokens(huntResult.tokens);
        setStats(huntResult.stats);
        setLastUpdate(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline failed');
      setTokens([]);
      setStats(null);
    }
    setLoading(false);
  }, [activeNetwork, minLiquidityUsd, minVolume24h, minPriceChange24h, bypassFilters]);

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
  // عرض الجدول (باقي الكود كما هو)
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

      {/* شبكات */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {botConfig.networks.map((id) => {
          const net = NETWORKS.find((n) => n.id === id);
          if (!net) return null;
          const active = activeNetwork === id;
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

      {/* مصادر البيانات */}
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
            {/* ✅ زر التحليل في بداية الجدول */}
            <th className="text-center px-3 py-3 font-medium w-20">تحليل</th>
            <th className="text-left px-3 py-3 font-medium">العملة</th>
            <th className="text-right px-3 py-3 font-medium">السعر</th>
            <th className="text-right px-3 py-3 font-medium">5د</th>
            <th className="text-right px-3 py-3 font-medium">1س</th>
            <th className="text-right px-3 py-3 font-medium">6س</th>
            <th className="text-right px-3 py-3 font-medium">24س</th>
            <th className="text-right px-3 py-3 font-medium">الحجم</th>
            <th className="text-right px-3 py-3 font-medium">السيولة</th>
            <th className="text-right px-3 py-3 font-medium">MCap</th>
            <th className="text-right px-3 py-3 font-medium">FDV</th>
            <th className="text-right px-3 py-3 font-medium">العمر</th>
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
            const ageStr = token.pairCreatedAt
              ? timeAgo(token.pairCreatedAt)
              : '—';

            return (
              <Fragment key={tokenId}>
                <tr
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => setExpandedToken(isExpanded ? null : tokenId)}
                >
                  <td className="px-4 py-3 text-slate-500">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </td>
                  
                  {/* ✅ زر التحليل في بداية الصف (مرئي دائماً) */}
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
                        <p className="text-xs text-slate-500 truncate max-w-[140px]">{token.name}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="text-right px-3 py-3 text-sm text-white font-mono">{formatPrice(token.priceUsd)}</td>
                  <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.m5 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.m5)}</td>
                  <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h1)}</td>
                  <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h6 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h6)}</td>
                  <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h24)}</td>
                  <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.volume24h)}</td>
                  <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.liquidityUsd)}</td>
                  <td className="text-right px-3 py-3 text-sm text-slate-300">{token.marketCap ? formatUsd(token.marketCap) : '—'}</td>
                  <td className="text-right px-3 py-3 text-sm text-slate-300">{token.fdv ? formatUsd(token.fdv) : '—'}</td>
                  <td className="text-right px-3 py-3 text-sm text-slate-400">{ageStr}</td>
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
                
                {/* ✅ تفاصيل التوسيع (بدون زر التحليل هنا) */}
                {isExpanded && (
                  <tr className="bg-slate-950/50">
                    <td colSpan={17} className="px-6 py-4">
                      <div className="space-y-3">
                        {/* ... تفاصيل العملة ... */}
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