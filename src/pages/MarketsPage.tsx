// src/pages/MarketsPage.tsx

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useApp } from '../context/AppContext';
import { NETWORKS, getNetworkColor, getNetworkName } from '../config/networks';
import { discoverAllPairs, type MultiSourceResult } from '../lib/discovery';
import { runHunterPipeline, type HunterFilters } from '../lib/hunterEngine';
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
      {/* ✅ نقطة البداية */}
      <circle cx="0" cy={height - ((data[0] - min) / range) * height} r="1.5" fill={strokeColor} />
      {/* ✅ نقطة النهاية */}
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
  const [sortBy, setSortBy] = useState<SortBy>('age'); // ✅ الافتراضي: الأحدث
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

      const filters: HunterFilters = {
        minLiquidityUsd: bypassFilters ? 0 : minLiquidityUsd,
        minVolume24h: bypassFilters ? 0 : minVolume24h,
        minPriceChange24h: bypassFilters ? -100 : minPriceChange24h,
      };

      const huntResult = runHunterPipeline(result.pairs, activeNetwork, filters);

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
      case 'age': return (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0); // ✅ الأحدث أولاً
      default: return b.score - a.score;
    }
  });

  const networkList = botConfig.networks || ['solana'];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* ============ HEADER ============ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radar className="w-6 h-6 text-emerald-400" />
            الأسواق
          </h1>
          <p className="text-sm text-slate-400 mt-1">اكتشاف متعدد المصادر - DEX Screener + GeckoTerminal</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              آخر تحديث: {formatDateTime(lastUpdate)}
            </div>
          )}
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

      {/* ============ NETWORK TABS ============ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {networkList.map((id) => {
          const net = NETWORKS.find((n) => n.id === id);
          if (!net) return null;
          const active = activeNetwork === id;
          return (
            <button
              key={id}
              onClick={() => setSelectedNetwork(id as ChainId)}
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

      {/* ============ SOURCES ============ */}
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

      {/* ============ STATS ============ */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <FunnelStep icon={Filter} label="المجموعات" value={stats.totalPairs} color="text-slate-300" />
          <FunnelStep icon={Zap} label="العملات الفريدة" value={stats.uniqueTokens} color="text-blue-400" />
          <FunnelStep icon={ShieldCheck} label="بعد الأمان" value={stats.afterSecurity} color="text-cyan-400" />
          <FunnelStep icon={Droplets} label="سيولة كافية" value={stats.afterLiquidity} color="text-teal-400" />
          <FunnelStep icon={BarChart3} label="حجم نشط" value={stats.afterVolume} color="text-indigo-400" />
          <FunnelStep icon={Trophy} label="مرشحين" value={stats.candidates} color="text-emerald-400" />
          <FunnelStep icon={Eye} label="قائمة مراقبة" value={stats.watchlist} color="text-amber-400" />
          <FunnelStep icon={XCircle} label="مرفوضين" value={stats.rejected} color="text-red-400" />
        </div>
      )}

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

      {/* ============ FILTERS ============ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالرمز، الاسم، أو عنوان العملة..."
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
            <option value="new-listing">الإدراج الجديد</option>
            <option value="momentum">الزخم</option>
            <option value="established">المستقرة</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600"
          >
            <option value="all">كل الحالات</option>
            <option value="candidate">مرشحين</option>
            <option value="watch">مراقبة</option>
            <option value="reject">مرفوضين</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-slate-600"
          >
            <option value="age">🆕 الأحدث</option>
            <option value="score">🏆 النتيجة</option>
            <option value="volume">📊 الحجم</option>
            <option value="liquidity">💧 السيولة</option>
            <option value="change">📈 التغيير</option>
          </select>

          {/* ✅ زر تجاوز الفلاتر */}
          <button
            onClick={() => setBypassFilters(!bypassFilters)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              bypassFilters 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {bypassFilters ? '🔓 الفلاتر معطلة' : '🔒 تجاوز الفلاتر'}
          </button>
        </div>
      </div>

      {/* ============ 🆕 MANUAL SEARCH ============ */}
      <div className="bg-gradient-to-r from-emerald-500/5 to-blue-500/5 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">🔍 بحث يدوي عن أي عملة</span>
          <span className="text-xs text-slate-500">(ابحث بالرمز أو العنوان)</span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-slate-900 rounded-lg px-3 border border-slate-700 focus-within:border-emerald-500 transition-colors">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={manualSearchQuery}
              onChange={(e) => setManualSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              placeholder="أدخل رمز العملة (مثل: BONK, PEPE, WIF) أو العنوان..."
              className="flex-1 bg-transparent py-2.5 text-white placeholder-slate-500 outline-none text-sm"
            />
            {manualSearchQuery && (
              <button
                onClick={() => setManualSearchQuery('')}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleManualSearch}
            disabled={manualSearchLoading || !manualSearchQuery.trim()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {manualSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            بحث
          </button>
        </div>
        {manualSearchError && (
          <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {manualSearchError}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1.5">
          💡 يمكنك البحث عن أي عملة على شبكة {getNetworkName(selectedNetwork)}. سيتم عرض النتائج مباشرة مع زر التحليل.
        </p>
      </div>

      {/* ============ MANUAL SEARCH RESULTS ============ */}
      {manualSearchResults.length > 0 && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <Search className="w-4 h-4" />
              نتائج البحث عن "{manualSearchQuery}"
              <span className="text-xs text-slate-400 font-normal">({manualSearchResults.length} نتيجة)</span>
            </h3>
            <button onClick={() => setManualSearchResults([])} className="text-xs text-slate-400 hover:text-white">
              ✕ إغلاق
            </button>
          </div>
          <div className="divide-y divide-slate-800">
            {manualSearchResults.map((pair, i) => {
              const price = parseFloat(pair.priceUsd || '0');
              const volume = pair.volume?.h24 || 0;
              const liquidity = pair.liquidity?.usd || 0;
              const change24 = pair.priceChange?.h24 || 0;
              const address = pair.baseToken.address;
              const isCopied = copiedAddress === address;

              return (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: getNetworkColor(selectedNetwork) }}>
                      {pair.baseToken.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{pair.baseToken.symbol}</span>
                        <span className="text-xs text-slate-500">/ {pair.quoteToken.symbol}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{pair.dexId}</span>
                      </div>
                      <p className="text-xs text-slate-400">{pair.baseToken.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 bg-slate-800/50 rounded-lg px-2 py-0.5 max-w-[280px]">
                        <span className="text-[10px] font-mono text-slate-400 truncate">{address}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(address, `عنوان ${pair.baseToken.symbol}`); }} className="p-0.5 hover:bg-slate-700 rounded transition-colors flex-shrink-0" title="نسخ العنوان">
                          {isCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <p className="text-sm font-mono text-white">${price.toFixed(6)}</p>
                      <p className={`text-xs font-medium ${change24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{change24 >= 0 ? '+' : ''}{change24.toFixed(2)}%</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">الحجم</p>
                      <p className="text-sm text-slate-300">{formatUsd(volume)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500">السيولة</p>
                      <p className="text-sm text-slate-300">{formatUsd(liquidity)}</p>
                    </div>
                    <button onClick={() => { const token = pairToDiscoveredToken(pair); onAnalyzeToken(token); setManualSearchResults([]); setManualSearchQuery(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors">
                      <BrainCircuit className="w-3.5 h-3.5" /> تحليل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ TOKENS TABLE ============ */}
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
              {error ? 'لا توجد بيانات بسبب خطأ في API.' : 'لا توجد عملات تطابق الفلاتر. حاول تعديل الفلاتر أو إعادة المسح.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium w-8"></th>
                  <th className="text-left px-3 py-3 font-medium">العملة</th>
                  <th className="text-right px-3 py-3 font-medium">السعر</th>
                  <th className="text-center px-3 py-3 font-medium">الاتجاه</th>
                  <th className="text-right px-3 py-3 font-medium">5د</th>
                  <th className="text-right px-3 py-3 font-medium">1س</th>
                  <th className="text-right px-3 py-3 font-medium">6س</th>
                  <th className="text-right px-3 py-3 font-medium">24س</th>
                  <th className="text-right px-3 py-3 font-medium">الحجم</th>
                  <th className="text-right px-3 py-3 font-medium">السيولة</th>
                  <th className="text-right px-3 py-3 font-medium">القيمة</th>
                  <th className="text-right px-3 py-3 font-medium">FDV</th>
                  <th className="text-right px-3 py-3 font-medium">الإنشاء</th>
                  <th className="text-right px-3 py-3 font-medium">العمر</th>
                  <th className="text-right px-3 py-3 font-medium">شراء</th>
                  <th className="text-right px-3 py-3 font-medium">بيع</th>
                  <th className="text-center px-3 py-3 font-medium">الاستراتيجية</th>
                  <th className="text-center px-3 py-3 font-medium">النتيجة</th>
                  <th className="text-center px-3 py-3 font-medium">الحالة</th>
                  <th className="text-center px-3 py-3 font-medium">الإجراء</th>
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
                  const ageStr = token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : '—';
                  const isCopied = copiedAddress === token.tokenAddress;

                  // ✅ بيانات الرسم البياني (من التغيرات السعرية)
                  const sparklineData = [
                    token.priceChange.m5,
                    token.priceChange.h1,
                    token.priceChange.h6,
                    token.priceChange.h24,
                  ].filter(v => v !== 0 && !isNaN(v));

                  return (
                    <Fragment key={tokenId}>
                      <tr
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedToken(isExpanded ? null : tokenId)}
                      >
                        <td className="px-4 py-3 text-slate-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        
                        {/* ✅ عمود العملة مع زر نسخ */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: getNetworkColor(activeNetwork) }}>
                              {token.symbol.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{token.symbol}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[100px]">{token.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                                  {token.tokenAddress.slice(0, 8)}...{token.tokenAddress.slice(-6)}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(token.tokenAddress, `عنوان ${token.symbol}`); }} className="p-0.5 hover:bg-slate-700 rounded transition-colors flex-shrink-0" title={`نسخ عنوان ${token.symbol}`}>
                                  {isCopied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500 hover:text-white" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="text-right px-3 py-3 text-sm text-white font-mono">{formatPrice(token.priceUsd)}</td>
                        
                        {/* ✅ عمود الرسم البياني */}
                        <td className="text-center px-3 py-3">
                          <Sparkline 
                            data={sparklineData.length >= 2 ? sparklineData : [0, token.priceChange.h24 || 0]} 
                            width={50} 
                            height={18}
                            color={token.priceChange.h24 >= 0 ? '#10b981' : '#ef4444'}
                          />
                        </td>
                        
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.m5 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.m5)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h1 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h1)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h6 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h6)}</td>
                        <td className={`text-right px-3 py-3 text-sm font-mono ${token.priceChange.h24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(token.priceChange.h24)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.volume24h)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{formatUsd(token.liquidityUsd)}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{token.marketCap ? formatUsd(token.marketCap) : '—'}</td>
                        <td className="text-right px-3 py-3 text-sm text-slate-300">{token.fdv ? formatUsd(token.fdv) : '—'}</td>
                        
                        {/* ✅ عمود الإنشاء */}
                        <td className="text-right px-3 py-3 text-xs text-slate-400">
                          {token.pairCreatedAt ? formatDateTime(token.pairCreatedAt) : '—'}
                        </td>
                        
                        {/* ✅ عمود العمر */}
                        <td className="text-right px-3 py-3 text-sm text-slate-400">
                          {token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : '—'}
                        </td>
                        
                        <td className="text-right px-3 py-3 text-sm text-emerald-400">{token.txns24h.buys.toLocaleString()}</td>
                        <td className="text-right px-3 py-3 text-sm text-red-400">{token.txns24h.sells.toLocaleString()}</td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${stratCfg.bg} ${stratCfg.color}`}>
                            <StratIcon className="w-3 h-3" /> {stratCfg.label}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${token.score >= 70 ? 'bg-emerald-500/20 text-emerald-400' : token.score >= 45 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                            {token.score}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                          </span>
                        </td>
                        <td className="text-center px-3 py-3">
                          <button onClick={(e) => { e.stopPropagation(); onAnalyzeToken(token); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors">
                            <BrainCircuit className="w-3.5 h-3.5" /> تحليل
                          </button>
                        </td>
                      </tr>
                      
                      {/* ============ EXPANDED DETAILS ============ */}
                      {isExpanded && (
                        <tr className="bg-slate-950/50">
                          <td colSpan={20} className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5">
                                  <span className="text-xs text-slate-400">عنوان العملة:</span>
                                  <span className="text-xs font-mono text-slate-300 break-all max-w-[300px]">{token.tokenAddress}</span>
                                  <button onClick={(e) => { e.stopPropagation(); copyToClipboard(token.tokenAddress, `عنوان ${token.symbol}`); }} className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0" title="نسخ العنوان">
                                    {isCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />}
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">DEX:</span>
                                  <span className="text-xs text-slate-300">{token.dexId}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">أفضل زوج:</span>
                                  <span className="text-xs font-mono text-slate-300">{token.pairAddress.slice(0, 16)}...{token.pairAddress.slice(-6)}</span>
                                </div>
                                {token.securityFlags.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">تنبيهات:</span>
                                    {token.securityFlags.map((flag) => (<span key={flag} className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{flag}</span>))}
                                  </div>
                                )}
                                <a href={token.bestPair.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                                  <ExternalLink className="w-3 h-3" /> عرض في DEX
                                </a>
                              </div>

                              <div className="flex items-center gap-2 bg-slate-800/30 rounded-lg px-3 py-2">
                                <span className="text-xs text-slate-500">📋 العنوان الكامل:</span>
                                <span className="text-xs font-mono text-emerald-300 break-all flex-1">{token.tokenAddress}</span>
                                <button onClick={(e) => { e.stopPropagation(); copyToClipboard(token.tokenAddress, `عنوان ${token.symbol}`); }} className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0" title="نسخ العنوان">
                                  {isCopied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400 hover:text-white" />}
                                </button>
                              </div>

                              {/* ✅ معلومات الإنشاء */}
                              <div className="flex items-center gap-4 flex-wrap bg-slate-800/20 rounded-lg px-3 py-2">
                                <span className="text-xs text-slate-500">🕐 وقت الإنشاء:</span>
                                <span className="text-xs font-mono text-slate-300">{token.pairCreatedAt ? formatDateTime(token.pairCreatedAt) : 'غير معروف'}</span>
                                <span className="text-xs text-slate-500">|</span>
                                <span className="text-xs text-slate-500">⏳ العمر:</span>
                                <span className="text-xs font-medium text-emerald-400">{token.pairCreatedAt ? timeAgo(token.pairCreatedAt) : 'غير معروف'}</span>
                              </div>

                              <div>
                                <p className="text-xs text-slate-500 mb-2">جميع الأزواج ({token.allPairs.length})</p>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {token.allPairs.map((pair, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs bg-slate-900/50 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono text-slate-500">{pair.dexId}</span>
                                        <span className="text-white">{pair.baseToken.symbol}/{pair.quoteToken.symbol}</span>
                                        <span className="text-slate-500 font-mono">{pair.pairAddress.slice(0, 12)}...</span>
                                      </div>
                                      <div className="flex items-center gap-4 text-slate-400">
                                        <span>{formatPrice(pair.priceUsd)}</span>
                                        <span>الحجم: {formatUsd(pair.volume?.h24 ?? 0)}</span>
                                        <span>السيولة: {formatUsd(pair.liquidity?.usd ?? 0)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
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

      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>عرض {sorted.length} من {tokens.length} عملة مكتشفة على {getNetworkName(activeNetwork)}</span>
          <span>مصادر البيانات: DEX Screener + GeckoTerminal</span>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

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
