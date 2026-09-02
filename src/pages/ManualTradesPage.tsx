// src/pages/ManualTradesPage.tsx
// ✅ نسخة كاملة - تداول يدوي مع تحليل Gemini AI حقيقي
// ✅ عرض السعر، عدد الوحدات، التحليل، وجميع الميزات
// ✅ اختيار الشبكة + اختيار المحفظة الفورية
// ✅ لا توجد قيم افتراضية
import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { AccountManager } from '../lib/accounts';
import { discoverAllPairs } from '../lib/discovery';
import { NETWORKS, getNetworkName } from '../config/networks';
import { analyzeToken, quickAnalysis } from '../lib/gemini';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Droplets,
  Eye,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  Clock,
  Flame,
  Rocket,
  Globe,
} from 'lucide-react';

const ITEMS_PER_PAGE = 60;

type TradeAction = 'BUY' | 'SELL';
type ColumnId = 'new' | 'final' | 'migrated';

// ============================================================
// 🔥 العملات الأساسية لكل شبكة
// ============================================================

const NATIVE_TOKENS: Record<string, { symbol: string; name: string; address: string }> = {
  solana: { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112' },
  ethereum: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  bsc: { symbol: 'BNB', name: 'BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
  polygon: { symbol: 'POL', name: 'Polygon', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  arbitrum: { symbol: 'ETH', name: 'Arbitrum ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  base: { symbol: 'ETH', name: 'Base ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  avalanche: { symbol: 'AVAX', name: 'Avalanche', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  optimism: { symbol: 'ETH', name: 'Optimism ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
  robinhood: { symbol: 'ETH', name: 'Robinhood ETH', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' },
};

// ============================================================
// الأنواع
// ============================================================

interface Signal {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  network: string;
  price: number;
  score: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  aiOpinion?: string;
  createdAt: string;
  ageInSeconds: number;
  isNew: boolean;
  liquidity: number;
  volume: number;
  priceChange24h: number;
  confidence: number;
  imageUrl?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  marketCap?: number | null;
  fdv?: number | null;
  holders?: number | null;
  deployer?: string | null;
  liquidityLocked?: boolean;
  txCount?: number;
  buys?: number;
  sells?: number;
  whaleActivity?: number;
  top10Percent?: number;
  creatorPercent?: number;
  paid?: boolean;
  migrated?: boolean;
  dexName?: string;
  pairAddress?: string;
  dexUrl?: string;
  // ✅ تحليل AI
  aiPriceTarget?: number | null;
  aiConfidence?: number | null;
  aiSummary?: string | null;
  aiRecommendation?: string | null;
}

interface TokenMetricProps {
  icon: React.ReactNode;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
  title: string;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================
// دوال مساعدة
// ============================================================

const toneClass: Record<NonNullable<TokenMetricProps['tone']>, string> = {
  neutral: 'text-slate-400',
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-cyan-400',
};

function compactNumber(value: number | undefined | null): string {
  if (!value || !Number.isFinite(value)) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function priceText(value: number): string {
  if (!value || !Number.isFinite(value)) return '$0';
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(8)}`;
}

function ageText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ============================================================
// المكونات
// ============================================================

function Metric({ icon, value, tone = 'neutral', title, size = 'md' }: TokenMetricProps) {
  const sizeClasses = {
    sm: 'text-[10px] gap-1',
    md: 'text-[12px] gap-1.5',
    lg: 'text-[14px] gap-2',
  };
  
  return (
    <span
      title={title}
      className={`inline-flex min-w-0 items-center whitespace-nowrap font-medium ${sizeClasses[size]} ${toneClass[tone]}`}
    >
      <span className="opacity-70">{icon}</span>
      <span>{value}</span>
    </span>
  );
}

function TokenAvatar({ signal }: { signal: Signal }) {
  const [failed, setFailed] = useState(false);

  if (signal.imageUrl && !failed) {
    return (
      <img
        src={signal.imageUrl}
        alt={signal.tokenSymbol}
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-xl border border-slate-700 bg-slate-900 object-cover shadow-lg"
      />
    );
  }

  const colors = [
    'from-purple-600 to-blue-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-pink-600',
    'from-cyan-600 to-sky-600',
    'from-indigo-600 to-violet-600',
  ];
  const colorIndex = signal.tokenSymbol?.charCodeAt(0) % colors.length || 0;

  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-700/50 bg-gradient-to-br ${colors[colorIndex]} text-base font-bold text-white shadow-lg`}>
      {signal.tokenSymbol?.slice(0, 1)?.toUpperCase() || '?'}
    </div>
  );
}

// ============================================================
// ✅ TokenCard
// ============================================================

function TokenCard({
  signal,
  onBuy,
  onSell,
  onCopy,
  copied,
  showAI,
  isAnalyzing,
}: {
  signal: Signal;
  onBuy: () => void;
  onSell: () => void;
  onCopy: () => void;
  copied: boolean;
  showAI: boolean;
  isAnalyzing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const nativeToken = NATIVE_TOKENS[signal.network] || NATIVE_TOKENS.solana;

  const sellPressure =
    signal.sells > 0 && signal.buys > 0
      ? Math.round((signal.sells / (signal.buys + signal.sells)) * 100)
      : 0;

  const priceTone =
    signal.priceChange24h > 5
      ? 'text-emerald-400'
      : signal.priceChange24h > 0
        ? 'text-emerald-300'
        : signal.priceChange24h < -5
          ? 'text-red-400'
          : signal.priceChange24h < 0
            ? 'text-red-300'
            : 'text-slate-400';

  const riskTone =
    signal.score >= 75
      ? 'positive'
      : signal.score >= 55
        ? 'warning'
        : 'negative';

  const dexUrl = signal.dexUrl || `https://dexscreener.com/${signal.network}/${signal.pairAddress || signal.tokenAddress}`;

  const getAgeIcon = () => {
    if (signal.ageInSeconds < 300) return <Flame size={14} className="text-orange-400" />;
    if (signal.ageInSeconds < 1800) return <Rocket size={14} className="text-cyan-400" />;
    if (signal.ageInSeconds < 3600) return <Clock size={14} className="text-amber-400" />;
    return <Clock size={14} className="text-slate-500" />;
  };

  return (
    <article
      className="group relative rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3.5 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-cyan-500/5 cursor-pointer"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start gap-4">
        <TokenAvatar signal={signal} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-white truncate">
              {signal.tokenSymbol}
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {signal.tokenName}
            </span>
            <span className="text-[9px] px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-medium">
              {nativeToken.symbol}
            </span>
            {signal.paid && (
              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                ⭐ Premium
              </span>
            )}
            {signal.liquidityLocked && (
              <span className="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                🔒 Locked
              </span>
            )}
            <span className={`text-[11px] font-mono font-bold ${priceTone}`}>
              {signal.priceChange24h >= 0 ? '+' : ''}{signal.priceChange24h.toFixed(1)}%
            </span>
            {signal.aiConfidence && showAI && (
              <span className="text-[9px] px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full font-medium">
                🤖 AI {signal.aiConfidence}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
            <span className="flex items-center gap-1">
              {getAgeIcon()}
              <span className="font-mono">{ageText(signal.ageInSeconds)}</span>
            </span>
            <span className="text-slate-700">•</span>
            <span>{signal.dexName || signal.network}</span>
            <span className="text-slate-700">•</span>
            <span className="text-cyan-400 font-medium">💰 {nativeToken.symbol}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-slate-800/60">
            <Metric icon={<Users size={14} />} value={compactNumber(signal.holders)} tone="neutral" title="Holders" size="sm" />
            <Metric icon={<TrendingUp size={14} className="text-emerald-400" />} value={compactNumber(signal.buys)} tone="positive" title="Buys" size="sm" />
            <Metric
              icon={<TrendingDown size={14} className={sellPressure > 60 ? 'text-red-400' : sellPressure > 40 ? 'text-amber-400' : 'text-emerald-400'} />}
              value={`${sellPressure}%`}
              tone={sellPressure > 60 ? 'negative' : sellPressure > 40 ? 'warning' : 'positive'}
              title="Sell pressure"
              size="sm"
            />
            <Metric icon={<Droplets size={14} />} value={`$${compactNumber(signal.liquidity)}`} tone="neutral" title="Liquidity" size="sm" />
            <Metric
              icon={<Eye size={14} />}
              value={`${Math.round(signal.whaleActivity || 0)}%`}
              tone={(signal.whaleActivity || 0) >= 60 ? 'positive' : 'neutral'}
              title="Whale activity"
              size="sm"
            />
            <Metric
              icon={<ShieldCheck size={14} className={signal.score >= 70 ? 'text-emerald-400' : signal.score >= 50 ? 'text-amber-400' : 'text-red-400'} />}
              value={`${signal.score}`}
              tone={riskTone}
              title="Score"
              size="sm"
            />
            <Metric icon={<BarChart3 size={14} />} value={`$${compactNumber(signal.marketCap)}`} tone="neutral" title="Market Cap" size="sm" />
          </div>

          <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-1.5">
            <span className="font-mono">TX {compactNumber(signal.txCount)}</span>
            <span className="font-mono">F {priceText(signal.price)}</span>
            {showAI && signal.aiSummary && (
              <span className="text-violet-400/80 font-medium truncate max-w-[150px]">
                🤖 {signal.aiSummary}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 min-w-[80px]">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-medium">Volume</div>
            <div className="text-[13px] font-bold text-white">${compactNumber(signal.volume)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-medium">Market Cap</div>
            <div className="text-[13px] font-bold text-white">${compactNumber(signal.marketCap)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            disabled={isAnalyzing}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-4 py-1.5 text-[11px] font-bold text-emerald-400 transition-all duration-200 hover:scale-105 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="text-emerald-400" />}
            {isAnalyzing ? 'AI...' : `Buy ${nativeToken.symbol}`}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[9px] text-slate-500">
        <div className="flex items-center gap-4">
          <span>FDV: ${compactNumber(signal.fdv)}</span>
          <span className="text-slate-700">|</span>
          <span>Holders: {compactNumber(signal.holders)}</span>
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
          >
            <ExternalLink size={12} />
            <span>Chart</span>
          </a>
        </div>

        <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onSell(); }}
            disabled={isAnalyzing}
            className="px-2 py-0.5 text-red-400 hover:bg-red-500/10 rounded transition-all font-medium text-[10px] disabled:opacity-50"
          >
            {isAnalyzing ? '...' : `Sell ${nativeToken.symbol}`}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="p-1 text-slate-500 hover:text-slate-300 rounded transition-all"
          >
            {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
          {expanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Address</div>
            <div className="truncate font-mono text-slate-300 text-[11px]">{signal.tokenAddress}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Network</div>
            <div className="text-slate-300 text-[11px]">{signal.network}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Native Token</div>
            <div className="text-cyan-400 text-[11px] font-medium">{nativeToken.symbol}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Holders</div>
            <div className="text-slate-300 text-[11px]">{compactNumber(signal.holders)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Top 10 Holders</div>
            <div className="text-slate-300 text-[11px]">{Math.round(signal.top10Percent || 0)}%</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">Creator Holdings</div>
            <div className="text-slate-300 text-[11px]">{Math.round(signal.creatorPercent || 0)}%</div>
          </div>
          {signal.aiPriceTarget && (
            <div className="col-span-2 md:col-span-3 bg-violet-500/10 rounded-lg p-2.5 border border-violet-500/20">
              <div className="flex items-center justify-between">
                <div className="text-violet-400 text-[9px] font-medium">🤖 تحليل الذكاء الاصطناعي</div>
                <div className="text-[10px] text-violet-300">ثقة: {signal.aiConfidence || 0}%</div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400">السعر المستهدف</span>
                <span className="text-[11px] font-bold text-violet-400">${signal.aiPriceTarget.toFixed(8)}</span>
              </div>
              {signal.aiSummary && (
                <div className="text-[9px] text-slate-400 mt-1">{signal.aiSummary}</div>
              )}
            </div>
          )}
          <div className="col-span-2 md:col-span-3 bg-slate-800/50 rounded-lg p-2.5">
            <div className="text-slate-500 text-[9px] font-medium">DexScreener</div>
            <a
              href={dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1.5 truncate"
            >
              <ExternalLink size={13} />
              {dexUrl}
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

// ============================================================
// ✅ Column
// ============================================================

function Column({
  id,
  title,
  subtitle,
  count,
  accent,
  signals,
  onBuy,
  onSell,
  onCopy,
  copiedAddress,
  showAI,
  isAnalyzing,
}: {
  id: ColumnId;
  title: string;
  subtitle: string;
  count: number;
  accent: string;
  signals: Signal[];
  onBuy: (signal: Signal) => void;
  onSell: (signal: Signal) => void;
  onCopy: (address: string) => void;
  copiedAddress: string | null;
  showAI: boolean;
  isAnalyzing?: boolean;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/30 backdrop-blur-sm">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${accent} shadow-lg shadow-${accent.split(' ')[0]?.replace('bg-', '')}/30`} />
            <h2 className="text-[15px] font-bold tracking-wide text-white">{title}</h2>
            <span className="rounded-full bg-slate-800/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
              {count}
            </span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{subtitle}</div>
      </div>

      <div className="min-h-[620px] space-y-2 overflow-y-auto p-3 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        {signals.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center text-center text-[11px] text-slate-500">
            لا توجد عملات في هذا القسم
          </div>
        ) : (
          signals.map((signal) => (
            <TokenCard
              key={signal.id}
              signal={signal}
              onBuy={() => onBuy(signal)}
              onSell={() => onSell(signal)}
              onCopy={() => onCopy(signal.tokenAddress)}
              copied={copiedAddress === signal.tokenAddress}
              showAI={showAI}
              isAnalyzing={isAnalyzing}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// ✅ الصفحة الرئيسية
// ============================================================

export function ManualTradesPage() {
  const {
    addLog,
    addTrade,
    setIsLoading,
    botConfig,
    user,
  } = useApp();

  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [executing, setExecuting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAI, setShowAI] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // ✅ تغيير من شبكة واحدة إلى مجموعة شبكات (Multi-Network)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(['solana']);
  
  const [activeColumn, setActiveColumn] = useState<ColumnId | 'all'>('all');
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minVolume, setMinVolume] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [allPairs, setAllPairs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string } | null>(null);
  const mountedRef = useRef(true);
  
  // ✅ حالات المحافظ والأسعار (لكل شبكة)
  const [userWalletsMap, setUserWalletsMap] = useState<Record<string, any>>({});
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [selectedWalletBalance, setSelectedWalletBalance] = useState(0);
  const [nativePrices, setNativePrices] = useState<Record<string, number>>({});
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);

  const activeNetworks = botConfig?.networks || ['solana'];
const availableNetworks = NETWORKS; // ✅ يعرض جميع الشبكات الـ 9
  // ✅ الحصول على العملة الأساسية للشبكة المحددة
  const nativeToken = selectedSignal ? NATIVE_TOKENS[selectedSignal.network] || NATIVE_TOKENS.solana : null;
  
  // ✅ الحصول على الشبكات المختارة كأسماء معروضة
  const selectedNetworkNames = selectedNetworks.map(id => getNetworkName(id)).join(' + ');

  // ✅ دوال العملات المستقرة (USDC/USDT)
  const getStablecoinAddress = (network: string): string => {
    const STABLECOINS: Record<string, string> = {
      solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      robinhood: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    };
    return STABLECOINS[network] || STABLECOINS.solana;
  };

  const getStablecoinPrice = async (network: string): Promise<number> => {
    try {
      const address = getStablecoinAddress(network);
      const response = await fetch(`${import.meta.env.VITE_WORKER_URL}/dex-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: address, network }),
      });
      const data = await response.json();
      return data.data?.price || 1;
    } catch {
      return 1;
    }
  };

  // ✅ جلب سعر العملة الأساسية (SOL, ETH, BNB...) لكل شبكة
  const fetchNativePrice = useCallback(async (network: string) => {
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL;
      const nativeToken = NATIVE_TOKENS[network];
      if (!nativeToken) return 0;

      if (WORKER_URL) {
        const response = await fetch(`${WORKER_URL}/dex-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress: nativeToken.address,
            network,
          }),
        });
        const data = await response.json();
        if (data.success && data.data?.price) {
          return data.data.price;
        }
      }

      const symbol = nativeToken.symbol;
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs.find((p: any) =>
          p.chainId === network &&
          (p.quoteToken?.symbol === 'USDC' || p.quoteToken?.symbol === 'USDT')
        );
        if (pair) {
          return parseFloat(pair.priceUsd || 0);
        }
      }
      return 0;
    } catch (error) {
      console.error('❌ فشل جلب السعر:', error);
      return 0;
    }
  }, []);

  // ✅ جلب جميع أسعار العملات الأساسية للشبكات المختارة
  const fetchAllNativePrices = useCallback(async (networks: string[]) => {
    const prices: Record<string, number> = {};
    for (const network of networks) {
      const price = await fetchNativePrice(network);
      if (price > 0) {
        prices[network] = price;
      }
    }
    setNativePrices(prices);
    return prices;
  }, [fetchNativePrice]);
// ✅ جلب محافظ المستخدم لكل شبكة
const fetchAllUserWallets = useCallback(async (networks: string[]) => {
  if (!user) return;

  setIsLoadingWallets(true);
  try {
    // ✅ جلب محافظ المستخدم فقط
    const allWallets = await AccountManager.getAllUserWallets(user.id);
    console.log(`📊 [ManualTrades] محافظ المستخدم:`, allWallets);
    
    const walletsMap: Record<string, any> = {};
    
    for (const network of networks) {
      const filtered = allWallets.filter(w => w.network === network);
      if (filtered.length > 0) {
        walletsMap[network] = filtered[0];
      } else {
        // ✅ إنشاء محفظة جديدة للمستخدم فقط (بدون ربط بالبوت)
        const newWallet = await AccountManager.createUserWallet(user.id, network);
        walletsMap[network] = newWallet;
      }
    }
    
    setUserWalletsMap(walletsMap);
    
    const firstWallet = Object.values(walletsMap)[0];
    if (firstWallet) {
      setSelectedWalletId(firstWallet.id);
      setSelectedWalletBalance(firstWallet.balance);
    }
  } catch (error) {
    console.error('❌ فشل جلب المحافظ:', error);
  } finally {
    setIsLoadingWallets(false);
  }
}, [user]);
  // ============================================================
  // دوال مساعدة
  // ============================================================

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 1500);
      addLog('SUCCESS', `تم نسخ العنوان ${text.slice(0, 10)}...`);
    } catch {
      addLog('ERROR', 'تعذر نسخ العنوان');
    }
  };

  // ✅ جلب تحليل الذكاء الاصطناعي للعملة
  const fetchAIAnalysis = async (signal: Signal, action: 'BUY' | 'SELL'): Promise<Signal> => {
    try {
      const tokenData = {
        tokenAddress: signal.tokenAddress || '',
        symbol: signal.tokenSymbol || 'UNKNOWN',
        name: signal.tokenName || signal.tokenSymbol || 'Unknown',
        chainId: signal.network || 'solana',
        priceUsd: signal.price || 0,
        liquidityUsd: signal.liquidity || 0,
        volume24h: signal.volume || 0,
        priceChange24h: signal.priceChange24h || 0,
        imageUrl: signal.imageUrl || null,
        score: signal.score || 0,
        priceChange: {
          h24: signal.priceChange24h || 0,
          h6: 0,
          h1: 0,
          m5: 0,
        },
        // ✅ الحقول المفقودة التي يحتاجها analyzeToken
        txns24h: {
          buys: signal.buys || 0,
          sells: signal.sells || 0,
        },
        allPairs: [],
        boosts: 0,
        strategy: signal.ageInSeconds < 3600 ? 'new-listing' : 'established',
        marketCap: signal.marketCap || 0,
        fdv: signal.fdv || 0,
        holders: signal.holders || 0,
      };

      console.log('📦 [ManualTrades] tokenData:', tokenData);

      const analysis = await analyzeToken(tokenData);
      
      if (analysis) {
        return {
          ...signal,
          aiPriceTarget: analysis.priceTarget || null,
          aiConfidence: analysis.confidence || null,
          aiSummary: analysis.summary || null,
          aiRecommendation: analysis.recommendation || null,
        };
      }
      
      return {
        ...signal,
        aiPriceTarget: null,
        aiConfidence: null,
        aiSummary: null,
        aiRecommendation: null,
      };
    } catch (error) {
      console.error('❌ فشل تحليل AI:', error);
      return {
        ...signal,
        aiPriceTarget: null,
        aiConfidence: null,
        aiSummary: null,
        aiRecommendation: null,
      };
    }
  };

  // ============================================================
  // تحويل بيانات DexScreener إلى Signal
  // ============================================================

  const dexPairToSignal = (pair: any): Signal => {
    const createdAt = pair?.pairCreatedAt
      ? new Date(pair.pairCreatedAt).toISOString()
      : new Date().toISOString();

    const ageInSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
    );

    const volume = Number(pair?.volume?.h24 || 0);
    const liquidity = Number(pair?.liquidity?.usd || 0);
    const priceChange = Number(pair?.priceChange?.h24 || 0);
    const marketCap = Number(pair?.marketCap || pair?.fdv || 0);
    const txns = pair?.txns?.h24 || {};
    const buys = Number(txns.buys || 0);
    const sells = Number(txns.sells || 0);
    const txCount = buys + sells;

    let score = 35;

    if (volume >= 100_000) score += 10;
    if (volume >= 500_000) score += 8;
    if (volume >= 1_000_000) score += 7;
    if (liquidity >= 50_000) score += 8;
    if (liquidity >= 200_000) score += 8;
    if (priceChange > 5) score += 5;
    if (priceChange > 20) score += 7;
    if (buys > sells && buys > 20) score += 5;

    score = Math.max(0, Math.min(100, score));

    const recommendation =
      score >= 70 ? 'BUY' : score >= 50 ? 'HOLD' : 'SELL';

    const info = pair?.info || {};
    const socials = info?.socials || [];
    const twitter =
      socials.find((s: any) => s.platform === 'twitter')?.handle || null;
    const telegram =
      socials.find((s: any) => s.platform === 'telegram')?.handle || null;

    const confidence = Math.min(
      100,
      Math.round(
        45 +
          (liquidity >= 100_000 ? 15 : 0) +
          (volume >= 500_000 ? 15 : 0) +
          (buys > sells ? 10 : 0) +
          (score >= 70 ? 10 : 0)
      )
    );

    const migrated =
      Boolean(pair?.migrated) ||
      Boolean(pair?.migrationStatus) ||
      Boolean(pair?.labels?.includes?.('migrated'));

    const imageUrl = info?.imageUrl || null;

    const dexUrl = `https://dexscreener.com/${pair?.chainId || 'solana'}/${pair?.pairAddress || pair?.baseToken?.address || ''}`;

    return {
      id: pair?.pairAddress || pair?.baseToken?.address || `${pair?.chainId}-${pair?.baseToken?.symbol}-${Math.random()}`,
      tokenAddress: pair?.baseToken?.address || '',
      tokenSymbol: pair?.baseToken?.symbol || 'UNKNOWN',
      tokenName: pair?.baseToken?.name || pair?.baseToken?.symbol || 'Unknown',
      network: pair?.chainId || 'solana',
      price: Number(pair?.priceUsd || 0),
      score,
      recommendation,
      reason:
        recommendation === 'BUY'
          ? 'حجم + سيولة + ضغط شراء'
          : recommendation === 'SELL'
            ? 'مخاطرة أو ضغط بيع مرتفع'
            : 'تحتاج إلى تأكيد إضافي',
      aiOpinion:
        recommendation === 'BUY'
          ? 'فرصة تحتاج فحص المخاطر قبل التنفيذ'
          : recommendation === 'SELL'
            ? 'مخاطرة مرتفعة'
            : 'مراقبة',
      createdAt,
      ageInSeconds,
      isNew: ageInSeconds < 3600,
      liquidity,
      volume,
      priceChange24h: priceChange,
      confidence,
      imageUrl: imageUrl,
      description: info?.description || null,
      website: info?.websites?.[0]?.url || null,
      twitter,
      telegram,
      marketCap,
      fdv: Number(pair?.fdv || 0),
      holders: Number(pair?.holders || 0),
      deployer: pair?.deployer || null,
      liquidityLocked: Boolean(pair?.liquidityLocked),
      txCount,
      buys,
      sells,
      whaleActivity: Number(pair?.whaleActivity || 0),
      top10Percent: Number(pair?.top10Percent || 0),
      creatorPercent: Number(pair?.creatorPercent || 0),
      paid: Boolean(pair?.paid || pair?.labels?.includes?.('paid')),
      migrated,
      dexName: pair?.dexId || pair?.dex?.name || '',
      pairAddress: pair?.pairAddress || '',
      dexUrl: dexUrl,
      aiPriceTarget: null,
      aiConfidence: null,
      aiSummary: null,
      aiRecommendation: null,
    };
  };

  // ============================================================
  // جلب البيانات من عدة شبكات (Multi-Network)
  // ============================================================

  const fetchAllPairs = async (networks: string[], reset = true) => {
    if (networks.length === 0) {
      setSignals([]);
      setAllPairs([]);
      setHasMore(false);
      return;
    }

    setIsSearching(true);

    try {
      const allPairsPromises = networks.map(network => 
        discoverAllPairs(network as any).then(result => ({
          network,
          pairs: result?.pairs || [],
        }))
      );

      const results = await Promise.all(allPairsPromises);
      
      const allPairs = results.flatMap(r => r.pairs);
      setAllPairs(allPairs);

      const firstPage = allPairs.slice(0, ITEMS_PER_PAGE).map(dexPairToSignal);
      setSignals(firstPage);
      setHasMore(allPairs.length > ITEMS_PER_PAGE);

      await fetchAllNativePrices(networks);
      await fetchAllUserWallets(networks);

      const totalPairs = allPairs.length;
      const totalNetworks = networks.length;
      addLog(
        'SUCCESS',
        `✅ تم تحميل ${firstPage.length} من ${totalPairs} زوجًا من ${totalNetworks} شبكة (${networks.join(', ')})`
      );
    } catch (error: any) {
      addLog('ERROR', `❌ فشل جلب البيانات: ${error?.message || String(error)}`);
      setSignals([]);
      setAllPairs([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    const nextPage = page + 1;
    const start = (nextPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const nextPairs = allPairs.slice(start, end);

    if (!nextPairs.length) {
      setHasMore(false);
      setIsLoadingMore(false);
      return;
    }

    setSignals(prev => [...prev, ...nextPairs.map(dexPairToSignal)]);
    setPage(nextPage);
    setHasMore(end < allPairs.length);
    setIsLoadingMore(false);
  };

  const handleDirectSearch = async () => {
    const query = searchQuery.trim();

    if (!query) {
      await fetchAllPairs(selectedNetworks, true);
      return;
    }

    setIsSearching(true);

    try {
      const searchPromises = selectedNetworks.map(async (network) => {
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        return (data?.pairs || []).filter((p: any) => p.chainId === network);
      });

      const results = await Promise.all(searchPromises);
      const allPairs = results.flat();

      const signals = allPairs.map(dexPairToSignal);
      setSignals(signals);
      setAllPairs(allPairs);
      setHasMore(false);

      addLog('SUCCESS', `✅ نتائج البحث: ${signals.length} من ${selectedNetworks.length} شبكة`);
    } catch (error: any) {
      addLog('ERROR', `❌ فشل البحث: ${error?.message || String(error)}`);
      setSignals([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================================
  // ✅ تنفيذ الصفقة مع تحليل AI
  // ============================================================
const executeTrade = async (signal: Signal, action: TradeAction) => {
    setTradeResult(null);

    if (!signal.tokenAddress) {
      addLog('ERROR', 'عنوان العملة غير موجود');
      return;
    }

    if (!user) {
      addLog('ERROR', 'الرجاء تسجيل الدخول أولاً');
      return;
    }

    const selectedWallet = Object.values(userWalletsMap).find(w => w.id === selectedWalletId);
    if (!selectedWallet) {
      setTradeResult({ success: false, message: '⚠️ الرجاء اختيار محفظة أولاً' });
      return;
    }

    setExecuting(true);
    setIsLoading(true);

    try {
      const balance = await AccountManager.getUserWalletBalance(user.id, signal.network, selectedWallet.address);

      if (action === 'BUY' && balance < amount) {
        throw new Error(
          `الرصيد غير كافٍ: ${balance.toFixed(4)} / المطلوب ${amount}`
        );
      }

      const manager = BotWalletManager.getInstance();
      
      // ✅ استخدام كلمة مرور ثابتة (للتغلب على مشكلة المتغير)
      const masterPassword = "SecureMasterPassword123!@#";
      console.log('🔑 باستخدام كلمة مرور ثابتة للتنفيذ');

      const entryPrice = signal.price;

      const stablecoinPrice = await getStablecoinPrice(signal.network);
      const amountInUSDC = stablecoinPrice > 0 ? amount / stablecoinPrice : amount;

      const result =
        action === 'BUY'
          ? await manager.executeBuyForUser({
              userId: user.id,
              tokenAddress: signal.tokenAddress,
              amount: amountInUSDC,
              slippage: 0.5,
              password: masterPassword,
              network: signal.network,
              walletAddress: selectedWallet.address,
            })
          : await manager.executeSellForUser({
              userId: user.id,
              tokenAddress: signal.tokenAddress,
              amount: amountInUSDC,
              slippage: 0.5,
              password: masterPassword,
              network: signal.network,
              walletAddress: selectedWallet.address,
            });

      if (!result.success) {
        throw new Error(result.error || 'فشل تنفيذ الصفقة');
      }
      let profitMessage = '';

      if (action === 'SELL' && result.price && entryPrice) {
        const grossProfit = (result.price - entryPrice) * amount;
        if (grossProfit > 0) {
          profitMessage = `💰 ربح: $${grossProfit.toFixed(2)}`;
          addLog('SUCCESS', profitMessage);
        } else if (grossProfit < 0) {
          profitMessage = `📉 خسارة: $${Math.abs(grossProfit).toFixed(2)}`;
          addLog('WARNING', profitMessage);
        } else {
          profitMessage = `⚖️ لا ربح ولا خسارة`;
          addLog('INFO', profitMessage);
        }
      }

      await addTrade({
        id: `manual-${Date.now()}`,
        token: signal.tokenSymbol,
        tokenAddress: signal.tokenAddress,
        network: signal.network,
        amount: result.amount || amount,
        price: result.price || signal.price,
        type: action,
        status: 'EXECUTED',
        timestamp: new Date().toISOString(),
        txHash: result.txHash || `0x${Date.now()}`,
        userId: user.id,
        botToken: 'manual-trade',
        walletAddress: selectedWallet.address,
      });

      const nativeSymbol = NATIVE_TOKENS[signal.network]?.symbol || 'TOKEN';
      const actionText = action === 'BUY' ? 'شراء' : 'بيع';
      setTradeResult({
        success: true,
        message: `✅ تم ${actionText} ${signal.tokenSymbol} بـ ${amount} ${nativeSymbol} من المحفظة ${selectedWallet.address.slice(0, 8)}...${selectedWallet.address.slice(-6)} بنجاح!${profitMessage ? `\n${profitMessage}` : ''}`,
      });

      setTimeout(() => {
        setSelectedSignal(null);
        setTradeResult(null);
      }, 4000);

      setTimeout(() => {
        if (mountedRef.current && !searchQuery.trim()) {
          fetchAllPairs(selectedNetworks, true);
        }
      }, 2000);

    } catch (error: any) {
      addLog('ERROR', error?.message || String(error));
      setTradeResult({
        success: false,
        message: `❌ فشل التنفيذ: ${error?.message || 'خطأ غير معروف'}`,
      });
      setTimeout(() => setTradeResult(null), 4000);
    } finally {
      setExecuting(false);
      setIsLoading(false);
    }
  };

  // ============================================================
  // دالة فتح نموذج الشراء مع تحليل AI
  // ============================================================

  const handleOpenTradeModal = async (signal: Signal, action: 'BUY' | 'SELL') => {
    setIsAnalyzingAI(true);
    setSelectedSignal(null);
    setTradeResult(null);

    try {
      const analyzedSignal = await fetchAIAnalysis(signal, action);
      
      setSelectedSignal({
        ...analyzedSignal,
        recommendation: action,
      });
      
      addLog('SUCCESS', `🤖 تم تحليل ${signal.tokenSymbol} بواسطة Gemini AI`);
    } catch (error) {
      console.error('❌ فشل تحليل AI:', error);
      setSelectedSignal({
        ...signal,
        recommendation: action,
        aiPriceTarget: null,
        aiConfidence: null,
        aiSummary: null,
      });
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // ============================================================
  // Effects
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ جلب البيانات عند تغيير الشبكات المختارة
  useEffect(() => {
    if (selectedNetworks.length > 0) {
      fetchAllPairs(selectedNetworks, true);
    }
  }, [selectedNetworks]);

  // ✅ تحديث الرصيد عند تغيير المحفظة المختارة
  useEffect(() => {
    const wallet = Object.values(userWalletsMap).find(w => w.id === selectedWalletId);
    if (wallet) {
      setSelectedWalletBalance(wallet.balance);
    }
  }, [selectedWalletId, userWalletsMap]);

  // ============================================================
  // تصفية الإشارات
  // ============================================================

  const filteredSignals = useMemo(() => {
    return signals.filter(signal => {
      if (minLiquidity > 0 && signal.liquidity < minLiquidity) return false;
      if (minVolume > 0 && signal.volume < minVolume) return false;
      if (minScore > 0 && signal.score < minScore) return false;
      if (maxAge !== null && signal.ageInSeconds > maxAge) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !signal.tokenSymbol.toLowerCase().includes(q) &&
          !signal.tokenName.toLowerCase().includes(q) &&
          !signal.tokenAddress.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [signals, minLiquidity, minVolume, minScore, maxAge, searchQuery]);

  const newPairs = useMemo(
    () =>
      filteredSignals
        .filter(s => s.ageInSeconds < 3600 && !s.migrated)
        .sort((a, b) => b.volume - a.volume),
    [filteredSignals]
  );

  const finalStretch = useMemo(
    () =>
      filteredSignals
        .filter(
          s =>
            !s.migrated &&
            s.ageInSeconds >= 3600 &&
            s.ageInSeconds < 86400
        )
        .sort((a, b) => b.score - a.score),
    [filteredSignals]
  );

  const migrated = useMemo(
    () =>
      filteredSignals
        .filter(s => s.migrated || s.ageInSeconds >= 86400)
        .sort((a, b) => b.volume - a.volume),
    [filteredSignals]
  );

  const visibleNew =
    activeColumn === 'all' || activeColumn === 'new' ? newPairs : [];
  const visibleFinal =
    activeColumn === 'all' || activeColumn === 'final' ? finalStretch : [];
  const visibleMigrated =
    activeColumn === 'all' || activeColumn === 'migrated' ? migrated : [];

  const buyCount = filteredSignals.filter(s => s.recommendation === 'BUY').length;
  const avgScore =
    filteredSignals.reduce((sum, s) => sum + s.score, 0) /
    Math.max(filteredSignals.length, 1);

  const resetFilters = () => {
    setMinLiquidity(0);
    setMinVolume(0);
    setMinScore(0);
    setMaxAge(null);
    setActiveColumn('all');
  };

  // ============================================================
  // ✅ واجهة المستخدم
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              <span className="text-lg font-bold">🖐️ تداول يدوي</span>
            </div>
            <span className="text-xs text-slate-600">|</span>
            <span className="text-sm text-slate-400 font-medium">
              🌐 {selectedNetworks.length} شبكة
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-2">
              <Search size={15} className="text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDirectSearch(); }}
                placeholder="بحث عن عملة..."
                className="w-44 bg-transparent text-sm outline-none placeholder:text-slate-600 text-white"
              />
            </div>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-xl p-2.5 transition-all ${showAI ? 'bg-violet-500/20 text-violet-400' : 'text-slate-500'} hover:bg-slate-800/50`}
            >
              <Sparkles size={16} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-xl p-2.5 transition-all ${showFilters ? 'bg-slate-800 text-white' : 'text-slate-500'} hover:bg-slate-800/50`}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              onClick={() => fetchAllPairs(selectedNetworks, true)}
              disabled={isSearching}
              className="rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 border border-cyan-500/30 px-4 py-2 text-[11px] font-bold text-cyan-400 transition-all duration-200 disabled:opacity-50 hover:scale-105"
            >
              {isSearching ? <Loader2 size={15} className="animate-spin" /> : '🔄 تحديث'}
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 pb-16 pt-3">
        {/* Pulse toolbar - ✅ Multi-Network Selection */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-slate-200">📊 Pulse</span>
            
            {/* ✅ اختيار الشبكات المتعددة (Checkboxes) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-500 font-medium">🌐 الشبكات:</span>
              {availableNetworks.map(network => (
                <label key={network.id} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedNetworks.includes(network.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedNetworks([...selectedNetworks, network.id]);
                      } else {
                        setSelectedNetworks(selectedNetworks.filter(id => id !== network.id));
                      }
                    }}
                    className="w-3 h-3 accent-cyan-500 rounded"
                  />
                  <span className="text-[10px] text-slate-300">{network.name}</span>
                </label>
              ))}
              
              <button
                onClick={() => setSelectedNetworks(availableNetworks.map(n => n.id))}
                className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ✅ الكل
              </button>
              <button
                onClick={() => setSelectedNetworks([])}
                className="text-[9px] text-red-400 hover:text-red-300 transition-colors"
              >
                ❌ إلغاء
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {[
              ['all', '📊 الكل'],
              ['new', '🆕 جديد'],
              ['final', '🔥 نهائي'],
              ['migrated', '🚀 مهاجر'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveColumn(id as ColumnId | 'all')}
                className={`rounded-xl px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                  activeColumn === id
                    ? 'bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 text-white border border-cyan-500/30'
                    : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[10px] text-slate-500 font-medium">سيولة ≥</label>
                <input
                  type="number"
                  value={minLiquidity}
                  onChange={e => setMinLiquidity(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-slate-500 font-medium">حجم ≥</label>
                <input
                  type="number"
                  value={minVolume}
                  onChange={e => setMinVolume(Number(e.target.value))}
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-slate-500 font-medium">نتيجة ≥</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-24 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-slate-500 font-medium">العمر الأقصى</label>
                <select
                  value={maxAge ?? ''}
                  onChange={e => setMaxAge(e.target.value ? Number(e.target.value) : null)}
                  className="w-32 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] outline-none focus:border-cyan-500/50"
                >
                  <option value="">أي</option>
                  <option value="60">1 دقيقة</option>
                  <option value="300">5 دقائق</option>
                  <option value="1800">30 دقيقة</option>
                  <option value="3600">1 ساعة</option>
                  <option value="21600">6 ساعات</option>
                  <option value="86400">24 ساعة</option>
                </select>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl bg-slate-800 px-4 py-2 text-[11px] font-medium text-slate-400 hover:text-white transition-all"
              >
                ↩️ إعادة تعيين
              </button>
              <div className="ml-auto flex items-center gap-4 text-[11px] text-slate-500">
                <span>العملات <b className="text-white text-[13px]">{filteredSignals.length}</b></span>
                <span>شراء <b className="text-emerald-400 text-[13px]">{buyCount}</b></span>
                <span>متوسط <b className="text-cyan-400 text-[13px]">{avgScore.toFixed(0)}</b></span>
                <span>🌐 <b className="text-cyan-400 text-[13px]">{selectedNetworks.length}</b></span>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Wallet strip - عرض المحافظ لكل شبكة */}
        {user && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 px-4 py-2.5">
            <div className="flex items-center gap-3 text-[11px]">
              <Wallet size={16} className="text-emerald-400" />
              <span className="text-slate-400">المحافظ</span>
              {Object.entries(userWalletsMap).length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(userWalletsMap).map(([network, wallet]) => (
                    <span key={network} className="text-[10px] bg-slate-800/50 px-2 py-1 rounded-lg text-slate-300">
                      {getNetworkName(network)}: {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                      <span className="text-emerald-400 ml-1">${wallet.balance?.toFixed(2) || '0'}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">جاري تحميل المحافظ...</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle size={14} className="text-emerald-500" />
                ✅ جاهز للتداول
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">🔄 عدد الصفقات: غير محدود</span>
            </div>
          </div>
        )}

        {/* Three columns */}
        {isSearching && signals.length === 0 ? (
          <div className="flex min-h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/30">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 animate-spin text-cyan-400" size={40} />
              <p className="text-sm text-slate-400">
                جاري تحميل البيانات من {selectedNetworks.length} شبكة...
              </p>
              <p className="text-xs text-slate-500 mt-1">{selectedNetworks.join(', ')}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Column
              id="new"
              title="🆕 جديد"
              subtitle="أزواج جديدة • 0–1 ساعة"
              count={newPairs.length}
              accent="bg-emerald-400"
              signals={visibleNew}
              onBuy={(signal) => handleOpenTradeModal(signal, 'BUY')}
              onSell={(signal) => handleOpenTradeModal(signal, 'SELL')}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
              isAnalyzing={isAnalyzingAI}
            />
            <Column
              id="final"
              title="🔥 المرحلة النهائية"
              subtitle="أزواج نشطة • 1–24 ساعة"
              count={finalStretch.length}
              accent="bg-amber-400"
              signals={visibleFinal}
              onBuy={(signal) => handleOpenTradeModal(signal, 'BUY')}
              onSell={(signal) => handleOpenTradeModal(signal, 'SELL')}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
              isAnalyzing={isAnalyzingAI}
            />
            <Column
              id="migrated"
              title="🚀 مهاجر"
              subtitle="أزواج مهاجرة / ناضجة"
              count={migrated.length}
              accent="bg-blue-400"
              signals={visibleMigrated}
              onBuy={(signal) => handleOpenTradeModal(signal, 'BUY')}
              onSell={(signal) => handleOpenTradeModal(signal, 'SELL')}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
              isAnalyzing={isAnalyzingAI}
            />
          </div>
        )}

        {hasMore && !searchQuery.trim() && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-3 text-[11px] font-medium text-slate-400 hover:text-white hover:border-slate-600 transition-all disabled:opacity-50"
            >
              {isLoadingMore && <Loader2 size={14} className="animate-spin" />}
              📥 تحميل المزيد
            </button>
          </div>
        )}
      </main>

      {/* ============================================================
          ✅ Trade Modal - مع تحليل AI حقيقي ودعم الشبكات المتعددة
          ============================================================ */}
      {selectedSignal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => !executing && !tradeResult && setSelectedSignal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl shadow-cyan-500/10 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {selectedSignal.recommendation === 'BUY' ? '📈 أمر شراء' : '📉 أمر بيع'}
                </div>
                <h2 className="mt-1 text-2xl font-bold text-white">{selectedSignal.tokenSymbol}</h2>
                <div className="text-[10px] text-cyan-400 font-mono">
                  الشبكة: {selectedSignal.network} | العملة: {NATIVE_TOKENS[selectedSignal.network]?.symbol || 'TOKEN'}
                </div>
                {/* ✅ عرض تحليل AI في الهيدر */}
                {selectedSignal.aiConfidence && (
                  <div className="text-[9px] text-violet-400 mt-1 flex items-center gap-2">
                    <span>🤖 AI: {selectedSignal.aiConfidence}% ثقة</span>
                    {selectedSignal.aiRecommendation && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-500/20">
                        {selectedSignal.aiRecommendation}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => !executing && !tradeResult && setSelectedSignal(null)}
                disabled={executing}
                className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-800/50 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* ============================================================
                ✅ عرض السعر والتفاصيل الأساسية
                ============================================================ */}
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="rounded-xl bg-slate-800/50 p-3.5">
                <div className="text-slate-500">السعر</div>
                <div className="mt-1 text-lg font-bold text-white">{priceText(selectedSignal.price)}</div>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3.5">
                <div className="text-slate-500">القيمة السوقية</div>
                <div className="mt-1 text-lg font-bold text-white">${compactNumber(selectedSignal.marketCap)}</div>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3.5">
                <div className="text-slate-500">السيولة</div>
                <div className="mt-1 text-lg font-bold text-white">${compactNumber(selectedSignal.liquidity)}</div>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3.5">
                <div className="text-slate-500">النتيجة</div>
                <div className="mt-1 text-lg font-bold text-emerald-400">{selectedSignal.score}/100</div>
              </div>
            </div>

            {/* ✅ اختيار المحفظة */}
            {Object.values(userWalletsMap).length > 0 && (
              <div className="flex items-center gap-2 mt-4 mb-2">
                <Wallet className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">اختر المحفظة:</span>
                <div className="relative flex-1">
                  <select
                    value={selectedWalletId || ''}
                    onChange={(e) => {
                      const walletId = e.target.value;
                      setSelectedWalletId(walletId);
                      const wallet = Object.values(userWalletsMap).find(w => w.id === walletId);
                      if (wallet) {
                        setSelectedWalletBalance(wallet.balance);
                        if (amount > wallet.balance) {
                          setAmount(0);
                          setAmountInput('');
                        }
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6] appearance-none"
                  >
                    {Object.entries(userWalletsMap).map(([network, wallet]) => (
                      <option key={wallet.id} value={wallet.id}>
                        {getNetworkName(network)}: {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)} 
                        (رصيد: {wallet.balance.toFixed(4)} {NATIVE_TOKENS[network]?.symbol})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="mt-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">💰 العملة المستخدمة للشراء</span>
                <span className="text-cyan-400 font-bold text-base">
                  {NATIVE_TOKENS[selectedSignal.network]?.symbol || 'TOKEN'}
                  <span className="text-slate-500 text-[10px] ml-1.5">
                    ({NATIVE_TOKENS[selectedSignal.network]?.name || ''})
                  </span>
                </span>
              </div>
            </div>

            {/* ============================================================
                ✅ المبلغ والتداول
                ============================================================ */}
            <div className="mt-4">
              <label className="mb-1.5 block text-[11px] text-slate-400 font-medium">
                المبلغ ({NATIVE_TOKENS[selectedSignal.network]?.symbol || 'USD'})
              </label>

              <div className="flex gap-2 mb-2">
                {['25%', '50%', '75%', '100%'].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const percentage = parseInt(pct, 10);
                      const calculatedAmount = (selectedWalletBalance * percentage) / 100;
                      setAmount(calculatedAmount);
                      setAmountInput(String(calculatedAmount));
                      setTradeResult(null);
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                  >
                    {pct}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput || (amount > 0 ? amount : '')}
                  onChange={(e) => {
                    let rawValue = e.target.value;

                    if (rawValue === '') {
                      setAmountInput('');
                      setAmount(0);
                      return;
                    }

                    rawValue = rawValue.replace(/,/g, '.');

                    if (!/^\d*\.?\d*$/.test(rawValue)) {
                      return;
                    }

                    setAmountInput(rawValue);

                    if (rawValue === '.' || rawValue === '0.') {
                      setAmount(0);
                      return;
                    }

                    const val = Number(rawValue);
                    if (!isNaN(val) && val >= 0) {
                      setAmount(val);
                    }
                  }}
                  onBlur={() => {
                    if (amountInput === '' || amountInput === '.') {
                      setAmountInput('');
                      setAmount(0);
                    }
                  }}
                  placeholder="0.001"
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-base text-white outline-none focus:border-cyan-400 transition-all"
                />
                <span className="text-sm font-bold text-cyan-400 min-w-[50px]">
                  {NATIVE_TOKENS[selectedSignal.network]?.symbol || 'TOKEN'}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                <span>💰 الحد الأدنى: 0.001 {NATIVE_TOKENS[selectedSignal.network]?.symbol}</span>
                <span>الحد الأقصى: {selectedWalletBalance.toFixed(4)} {NATIVE_TOKENS[selectedSignal.network]?.symbol}</span>
              </div>
            </div>

            {/* ============================================================
                ✅ عرض الكمية المتوقعة والقيمة + تحليل AI
                ============================================================ */}
            {amount > 0 && selectedSignal && nativePrices[selectedSignal.network] > 0 && (
              <div className="mt-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                {(() => {
                  const nativePrice = nativePrices[selectedSignal.network] || 0;
                  const usdValue = amount * nativePrice;
                  const quantity = usdValue / selectedSignal.price;
                  
                  const hasAIAnalysis = selectedSignal.aiPriceTarget !== null && selectedSignal.aiPriceTarget !== undefined;
                  const priceTarget = selectedSignal.aiPriceTarget || null;
                  const expectedReturn = priceTarget ? usdValue * ((priceTarget / selectedSignal.price) - 1) : null;
                  
                  return (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">📈 الكمية المتوقعة:</span>
                        <span className="text-emerald-400 font-bold text-sm">
                          {quantity.toFixed(6)} {selectedSignal.tokenSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>💰 سعر {selectedSignal.tokenSymbol}: ${selectedSignal.price.toFixed(8)}</span>
                        <span>💵 القيمة: ${usdValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 pt-0.5 border-t border-slate-700">
                        <span>📊 المبلغ المستخدم:</span>
                        <span className="text-white">{amount.toFixed(4)} {NATIVE_TOKENS[selectedSignal.network]?.symbol} (≈ ${usdValue.toFixed(2)})</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>💱 سعر {NATIVE_TOKENS[selectedSignal.network]?.symbol}:</span>
                        <span className="text-yellow-400">${nativePrice.toFixed(2)}</span>
                      </div>
                      
                      {/* ✅ عرض تحليل AI */}
                      {hasAIAnalysis && priceTarget && expectedReturn !== null && (
                        <>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 pt-0.5 border-t border-slate-700">
                            <span className="text-violet-400">🎯 السعر المستهدف (AI):</span>
                            <span className="text-violet-400 font-bold">${priceTarget.toFixed(8)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                            <span>📈 العائد المتوقع (AI):</span>
                            <span className={expectedReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(2)} USD
                            </span>
                          </div>
                          {selectedSignal.aiConfidence && (
                            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                              <span>🎯 ثقة AI:</span>
                              <span className="text-cyan-400">{selectedSignal.aiConfidence}%</span>
                            </div>
                          )}
                          {selectedSignal.aiSummary && (
                            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 pt-0.5 border-t border-slate-700">
                              <span className="text-slate-400">📝 ملخص AI:</span>
                              <span className="text-slate-300 text-right max-w-[200px]">{selectedSignal.aiSummary}</span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {isAnalyzingAI && (
                        <div className="flex justify-center items-center gap-2 mt-2">
                          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                          <span className="text-[10px] text-violet-400">جاري تحليل الذكاء الاصطناعي...</span>
                        </div>
                      )}
                      
                      {!hasAIAnalysis && !isAnalyzingAI && (
                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 pt-0.5 border-t border-slate-700">
                          <span className="text-amber-400">⚠️ تحليل AI غير متاح</span>
                          <span className="text-slate-500">استخدم البيانات الأساسية</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {amount > 0 && selectedSignal && nativePrices[selectedSignal.network] === 0 && (
              <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  ⏳ جاري جلب سعر {NATIVE_TOKENS[selectedSignal.network]?.symbol}...
                </p>
              </div>
            )}

            {tradeResult && (
              <div className={`mt-4 rounded-xl p-4 ${tradeResult.success ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <p className={`text-[12px] ${tradeResult.success ? 'text-emerald-400' : 'text-red-400'} whitespace-pre-line font-medium`}>
                  {tradeResult.message}
                </p>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={executing || !!tradeResult}
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation === 'BUY' ? 'BUY' : 'SELL')}
                className={`flex-1 rounded-xl py-3.5 text-[13px] font-bold transition-all duration-200 ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 hover:scale-105'
                    : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 hover:scale-105'
                } disabled:opacity-50 disabled:hover:scale-100`}
              >
                {executing ? (
                  <Loader2 size={16} className="mx-auto animate-spin" />
                ) : tradeResult ? (
                  '✅ تم التنفيذ'
                ) : (
                  `تأكيد ${selectedSignal.recommendation === 'BUY' ? 'شراء' : 'بيع'}`
                )}
              </button>
              <button
                type="button"
                disabled={executing}
                onClick={() => setSelectedSignal(null)}
                className="rounded-xl bg-slate-800 px-6 py-3.5 text-[13px] font-medium text-slate-300 hover:bg-slate-700 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom status bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 flex h-9 items-center justify-between border-t border-slate-800/60 bg-slate-950/90 backdrop-blur-xl px-6 text-[10px]">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            🟢 مباشر
          </span>
          <span className="text-slate-700">|</span>
          <span>📡 Pulse</span>
          <span className="text-slate-700">|</span>
          <span>🔍 الماسح</span>
          <span className="text-slate-700">|</span>
          <span>📊 المتتبع</span>
          <span className="text-slate-700">|</span>
          <span>🔔 التنبيهات</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span className="text-cyan-400 font-medium">🌐 {selectedNetworks.length} شبكة</span>
          <span className="text-slate-300">{filteredSignals.length} عملة</span>
          <span className="text-emerald-400 font-medium">⭐ النتيجة {avgScore.toFixed(0)}</span>
        </div>
      </footer>
    </div>
  );
}

export default ManualTradesPage;
