// src/pages/ManualTradesPage.tsx
// Full-width trading terminal with DexScreener links + COMMISSION 15%

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatUsd } from '../lib/format';
import { BotWalletManager } from '../lib/wallet';
import { AccountManager, BotToken, COMMISSION_RATE } from '../lib/accounts';
import { discoverAllPairs } from '../lib/discovery';
import { NETWORKS, getNetworkName } from '../config/networks';
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
  Filter,
  Globe,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
  ArrowRight,
  Coins,
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
}

interface TokenMetricProps {
  icon: React.ReactNode;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info';
  title: string;
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

function Metric({ icon, value, tone = 'neutral', title }: TokenMetricProps) {
  return (
    <span
      title={title}
      className={`inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] ${toneClass[tone]}`}
    >
      {icon}
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
        className="h-12 w-12 shrink-0 rounded-lg border border-slate-700 bg-slate-900 object-cover shadow-lg"
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
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-gradient-to-br ${colors[colorIndex]} text-sm font-bold text-white shadow-lg`}>
      {signal.tokenSymbol?.slice(0, 1)?.toUpperCase() || '?'}
    </div>
  );
}

// ============================================================
// ✅ TokenCard المعدل - يعرض العملة الأساسية للشبكة
// ============================================================

function TokenCard({
  signal,
  onBuy,
  onSell,
  onCopy,
  copied,
  showAI,
}: {
  signal: Signal;
  onBuy: () => void;
  onSell: () => void;
  onCopy: () => void;
  copied: boolean;
  showAI: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const nativeToken = NATIVE_TOKENS[signal.network] || NATIVE_TOKENS.solana;

  const sellPressure =
    signal.sells > 0 && signal.buys > 0
      ? Math.round((signal.sells / (signal.buys + signal.sells)) * 100)
      : 0;

  const priceTone =
    signal.priceChange24h > 0
      ? 'text-emerald-400'
      : signal.priceChange24h < 0
        ? 'text-red-400'
        : 'text-slate-400';

  const riskTone =
    signal.score >= 75
      ? 'positive'
      : signal.score >= 55
        ? 'warning'
        : 'negative';

  const dexUrl = signal.dexUrl || `https://dexscreener.com/${signal.network}/${signal.pairAddress || signal.tokenAddress}`;

  return (
    <article
      className="group relative rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 transition hover:border-slate-600 hover:bg-slate-800/60 cursor-pointer"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start gap-3">
        <TokenAvatar signal={signal} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-white truncate">
              {signal.tokenSymbol}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {signal.tokenName}
            </span>
            {/* ✅ عرض العملة الأساسية للشبكة */}
            <span className="text-[8px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full font-medium">
              {nativeToken.symbol}
            </span>
            {signal.paid && (
              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                Paid
              </span>
            )}
            {signal.liquidityLocked && (
              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                🔒 Locked
              </span>
            )}
            <span className={`text-[10px] font-mono font-semibold ${priceTone}`}>
              {signal.priceChange24h >= 0 ? '+' : ''}{signal.priceChange24h.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
            <span className="font-mono">{ageText(signal.ageInSeconds)}</span>
            <span className="text-slate-700">•</span>
            <span>{signal.dexName || signal.network}</span>
            <span className="text-slate-700">•</span>
            <span className="text-cyan-400">💰 {nativeToken.symbol}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 pt-1.5 border-t border-slate-800/60">
            <Metric icon={<Users size={9} className="text-slate-400" />} value={compactNumber(signal.holders)} tone="neutral" title="Holders" />
            <Metric icon={<TrendingUp size={9} className="text-emerald-400" />} value={compactNumber(signal.buys)} tone="positive" title="Buys" />
            <Metric
              icon={<TrendingDown size={9} className={sellPressure > 60 ? 'text-red-400' : sellPressure > 40 ? 'text-amber-400' : 'text-emerald-400'} />}
              value={`${sellPressure}%`}
              tone={sellPressure > 60 ? 'negative' : sellPressure > 40 ? 'warning' : 'positive'}
              title="Sell pressure"
            />
            <Metric icon={<Droplets size={9} className="text-slate-400" />} value={`$${compactNumber(signal.liquidity)}`} tone="neutral" title="Liquidity" />
            <Metric
              icon={<Eye size={9} className="text-slate-400" />}
              value={`${Math.round(signal.whaleActivity || 0)}%`}
              tone={(signal.whaleActivity || 0) >= 60 ? 'positive' : 'neutral'}
              title="Whale activity"
            />
            <Metric
              icon={<ShieldCheck size={9} className={signal.score >= 70 ? 'text-emerald-400' : signal.score >= 50 ? 'text-amber-400' : 'text-red-400'} />}
              value={`${signal.score}`}
              tone={riskTone}
              title="Score"
            />
            <Metric icon={<BarChart3 size={9} className="text-slate-400" />} value={`$${compactNumber(signal.marketCap)}`} tone="neutral" title="Market Cap" />
          </div>

          <div className="flex items-center gap-3 text-[9px] text-slate-500 mt-1">
            <span className="font-mono">TX {compactNumber(signal.txCount)}</span>
            <span className="font-mono">F {priceText(signal.price)}</span>
            {showAI && <span className="text-violet-400/80 font-medium">AI {signal.confidence}%</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-[70px]">
          <div className="text-right">
            <div className="text-[9px] text-slate-500 font-medium">V</div>
            <div className="text-[11px] font-bold text-white">${compactNumber(signal.volume)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-500 font-medium">MC</div>
            <div className="text-[11px] font-bold text-white">${compactNumber(signal.marketCap)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className="mt-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 px-2.5 py-1 text-[9px] font-bold text-emerald-400 transition-all duration-200"
          >
            <Zap size={10} className="text-emerald-400" /> Buy {nativeToken.symbol}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-800/60 text-[8px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>FDV: ${compactNumber(signal.fdv)}</span>
          <span className="text-slate-700">|</span>
          <span>Holders: {compactNumber(signal.holders)}</span>
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ExternalLink size={10} />
            <span>Chart</span>
          </a>
        </div>

        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onSell(); }}
            className="px-1.5 py-0.5 text-red-400 hover:bg-red-500/10 rounded transition-all"
          >
            Sell {nativeToken.symbol}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="p-0.5 text-slate-500 hover:text-slate-300 rounded transition-all"
          >
            {copied ? <CheckCircle size={9} className="text-emerald-400" /> : <Copy size={9} />}
          </button>
          {expanded ? <ChevronDown size={9} className="text-slate-500" /> : <ChevronRight size={9} className="text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-800/60 grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[9px]" onClick={(e) => e.stopPropagation()}>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Address</div>
            <div className="truncate font-mono text-slate-300">{signal.tokenAddress}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Network</div>
            <div className="text-slate-300">{signal.network}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Native</div>
            <div className="text-cyan-400">{nativeToken.symbol}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Holders</div>
            <div className="text-slate-300">{compactNumber(signal.holders)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Top 10</div>
            <div className="text-slate-300">{Math.round(signal.top10Percent || 0)}%</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">Creator</div>
            <div className="text-slate-300">{Math.round(signal.creatorPercent || 0)}%</div>
          </div>
          <div className="col-span-2 md:col-span-3 bg-slate-800/50 rounded-lg p-1.5">
            <div className="text-slate-500 text-[8px]">DexScreener</div>
            <a
              href={dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 text-[10px] flex items-center gap-1 truncate"
            >
              <ExternalLink size={10} />
              {dexUrl}
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

// ============================================================
// ✅ Column المعدل
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
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/30 backdrop-blur-sm">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${accent} shadow-lg`} />
            <h2 className="text-[13px] font-bold tracking-wide text-white">{title}</h2>
            <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[8px] font-medium text-slate-400">
              {count}
            </span>
          </div>
        </div>
        <div className="text-[8px] text-slate-500 mt-0.5 font-medium">{subtitle}</div>
      </div>

      <div className="min-h-[620px] space-y-1.5 overflow-y-auto p-2 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        {signals.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center text-center text-[10px] text-slate-500">
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
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// ✅ الصفحة الرئيسية المعدلة
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
  const [amount, setAmount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAI, setShowAI] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('solana');
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
  const [botTokenInfo, setBotTokenInfo] = useState<BotToken | null>(null);
  const [userWallet, setUserWallet] = useState<any>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string } | null>(null);
  const mountedRef = useRef(true);

  const activeNetworks = botConfig?.networks || ['solana'];
  const availableNetworks = NETWORKS.filter(n => activeNetworks.includes(n.id));

  const nativeToken = selectedSignal ? NATIVE_TOKENS[selectedSignal.network] || NATIVE_TOKENS.solana : null;

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

  const loadUserWalletAndToken = async () => {
    if (!user) return;

    setIsLoadingWallet(true);
    try {
      let wallet = await AccountManager.getUserWallet(user.id, selectedNetwork);

      if (!wallet) {
        wallet = await AccountManager.createUserWallet(user.id, selectedNetwork);
        addLog('SUCCESS', `تم إنشاء محفظة ${getNetworkName(selectedNetwork)}`);
      }

      setUserWallet(wallet);

      let token = await AccountManager.getBotToken(user.id, selectedNetwork);

      if (!token) {
        token = await AccountManager.createBotToken(
          user.id,
          wallet.id!,
          selectedNetwork
        );
      }

      setBotTokenInfo(token);
    } catch (error: any) {
      addLog('ERROR', `فشل تحميل المحفظة: ${error?.message || String(error)}`);
    } finally {
      setIsLoadingWallet(false);
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

    const dexUrl = `https://dexscreener.com/${pair?.chainId || selectedNetwork}/${pair?.pairAddress || pair?.baseToken?.address || ''}`;

    return {
      id: pair?.pairAddress || pair?.baseToken?.address || `${pair?.chainId}-${pair?.baseToken?.symbol}-${Math.random()}`,
      tokenAddress: pair?.baseToken?.address || '',
      tokenSymbol: pair?.baseToken?.symbol || 'UNKNOWN',
      tokenName: pair?.baseToken?.name || pair?.baseToken?.symbol || 'Unknown',
      network: pair?.chainId || selectedNetwork,
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
    };
  };

  // ============================================================
  // جلب البيانات
  // ============================================================

  const fetchAllPairs = async (network: string, reset = true) => {
    if (reset) {
      setAllPairs([]);
      setSignals([]);
      setPage(1);
      setHasMore(true);
    }

    setIsSearching(true);

    try {
      const result = await discoverAllPairs(network as any);
      const pairs = result?.pairs || [];

      if (!pairs.length) {
        addLog('WARNING', `لا توجد بيانات على ${getNetworkName(network)}`);
        setAllPairs([]);
        setSignals([]);
        setHasMore(false);
        return;
      }

      setAllPairs(pairs);

      const firstPage = pairs.slice(0, ITEMS_PER_PAGE).map(dexPairToSignal);
      setSignals(firstPage);
      setHasMore(pairs.length > ITEMS_PER_PAGE);

      addLog(
        'SUCCESS',
        `تم تحميل ${firstPage.length} من ${pairs.length} زوجًا على ${getNetworkName(network)}`
      );
    } catch (error: any) {
      addLog('ERROR', `فشل جلب البيانات: ${error?.message || String(error)}`);
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
      await fetchAllPairs(selectedNetwork, true);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      const pairs = (data?.pairs || []).filter(
        (p: any) => p.chainId === selectedNetwork
      );

      const result = pairs.map(dexPairToSignal);
      setSignals(result);
      setAllPairs(pairs);
      setHasMore(false);

      addLog('SUCCESS', `نتائج البحث: ${result.length}`);
    } catch (error: any) {
      addLog('ERROR', `فشل البحث: ${error?.message || String(error)}`);
      setSignals([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================================
  // ✅ تنفيذ الصفقة مع العمولة 15%
  // ============================================================

  const executeTrade = async (signal: Signal, action: TradeAction) => {
    // ✅ إعادة تعيين حالة النتيجة
    setTradeResult(null);

    if (!signal.tokenAddress) {
      addLog('ERROR', 'عنوان العملة غير موجود');
      return;
    }

    if (!user) {
      addLog('ERROR', 'الرجاء تسجيل الدخول أولًا');
      return;
    }

    if (!botTokenInfo || botTokenInfo.status !== 'active') {
      await loadUserWalletAndToken();
      addLog('ERROR', 'لا يوجد رمز بوت نشط');
      return;
    }

    setExecuting(true);
    setIsLoading(true);

    try {
      const wallet = await AccountManager.getUserWallet(
        user.id,
        signal.network
      );

      if (!wallet) {
        throw new Error('لا توجد محفظة على هذه الشبكة');
      }

      // ✅ جلب الرصيد الحقيقي
      const balance = await AccountManager.getUserWalletBalance(
        user.id,
        signal.network
      );

      if (action === 'BUY' && balance < amount) {
        throw new Error(
          `الرصيد غير كافٍ: $${balance.toFixed(2)} / المطلوب $${amount}`
        );
      }

      const canTrade = await AccountManager.canUserTrade(user.id);

      if (!canTrade) {
        const remaining = await AccountManager.getRemainingTrades(user.id);
        throw new Error(`تم تجاوز الحد اليومي. المتبقي: ${remaining}`);
      }

      const validToken = await AccountManager.verifyBotToken(
        botTokenInfo.token,
        user.id
      );

      if (!validToken) {
        throw new Error('رمز البوت غير صالح');
      }

      const manager = BotWalletManager.getInstance();
      const masterPassword = import.meta.env.VITE_MASTER_PASSWORD;

      if (!masterPassword) {
        throw new Error(
          'VITE_MASTER_PASSWORD غير مضبوط'
        );
      }

      // ✅ حفظ سعر الدخول لحساب الربح
      const entryPrice = signal.price;

      // ✅ تنفيذ الصفقة
      const result =
        action === 'BUY'
          ? await manager.executeBuyForUser({
              userId: user.id,
              tokenAddress: signal.tokenAddress,
              amount,
              slippage: 0.5,
              password: masterPassword,
              network: signal.network,
            })
          : await manager.executeSellForUser({
              userId: user.id,
              tokenAddress: signal.tokenAddress,
              amount,
              slippage: 0.5,
              password: masterPassword,
              network: signal.network,
            });

      if (!result.success) {
        throw new Error(result.error || 'فشل تنفيذ الصفقة');
      }

      // ✅ حساب الربح وتطبيق العمولة (فقط عند البيع)
      let profitMessage = '';
      let commissionAmount = 0;

      if (action === 'SELL' && result.price && entryPrice) {
        const grossProfit = (result.price - entryPrice) * amount;
        if (grossProfit > 0) {
          // ✅ تطبيق العمولة 15%
          const commission = grossProfit * COMMISSION_RATE;
          commissionAmount = commission;
          const netProfit = grossProfit - commission;

          // ✅ تحديث رصيد المستخدم وإضافة العمولة
          await AccountManager.addProfit(user.id, grossProfit, {
            token: signal.tokenSymbol,
            amount,
            price: result.price,
            txHash: result.txHash!,
            network: signal.network,
          });

          profitMessage = `💰 ربح: $${grossProfit.toFixed(2)} | العمولة (15%): $${commission.toFixed(2)} | صافي: $${netProfit.toFixed(2)}`;
          addLog('SUCCESS', profitMessage);
        } else if (grossProfit < 0) {
          profitMessage = `📉 خسارة: $${Math.abs(grossProfit).toFixed(2)}`;
          addLog('WARNING', profitMessage);
        } else {
          profitMessage = `⚖️ لا ربح ولا خسارة`;
          addLog('INFO', profitMessage);
        }
      }

      await AccountManager.incrementUserTrades(user.id);
      await AccountManager.updateBotTokenLastUsed(botTokenInfo.id);

      // ✅ تسجيل الصفقة في قاعدة البيانات
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
        botToken: botTokenInfo.token,
      });

      // ✅ عرض نتيجة الصفقة للمستخدم
      const nativeSymbol = NATIVE_TOKENS[signal.network]?.symbol || 'TOKEN';
      const actionText = action === 'BUY' ? 'شراء' : 'بيع';
      setTradeResult({
        success: true,
        message: `✅ تم ${actionText} ${signal.tokenSymbol} بـ ${amount} ${nativeSymbol} بنجاح!${profitMessage ? `\n${profitMessage}` : ''}`,
      });

      // ✅ إغلاق المودال بعد 3 ثوان
      setTimeout(() => {
        setSelectedSignal(null);
        setTradeResult(null);
      }, 4000);

      setTimeout(() => {
        if (mountedRef.current && !searchQuery.trim()) {
          fetchAllPairs(selectedNetwork, true);
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
  // Effects
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (user) loadUserWalletAndToken();
  }, [user, selectedNetwork]);

  useEffect(() => {
    fetchAllPairs(selectedNetwork, true);

    const interval = window.setInterval(() => {
      if (!searchQuery.trim()) {
        fetchAllPairs(selectedNetwork, true);
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [selectedNetwork]);

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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">🖐️ تداول يدوي</span>
            <span className="text-xs text-slate-500">|</span>
            <span className="text-xs text-slate-400">{getNetworkName(selectedNetwork)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-1.5">
              <Search size={13} className="text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDirectSearch(); }}
                placeholder="بحث..."
                className="w-36 bg-transparent text-[11px] outline-none placeholder:text-slate-600"
              />
            </div>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-lg p-2 transition-all ${showAI ? 'bg-violet-500/20 text-violet-400' : 'text-slate-500'} hover:bg-slate-800`}
            >
              <Sparkles size={14} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg p-2 transition-all ${showFilters ? 'bg-slate-800 text-white' : 'text-slate-500'} hover:bg-slate-800`}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => fetchAllPairs(selectedNetwork, true)}
              disabled={isSearching}
              className="rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 px-3 py-1.5 text-[10px] font-bold text-cyan-400 transition-all disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : 'تحديث'}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-12 pt-2">
        {/* Pulse toolbar */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">Pulse</span>
            <select
              value={selectedNetwork}
              onChange={e => setSelectedNetwork(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1 text-[9px] text-slate-300 outline-none"
            >
              {availableNetworks.map(network => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              ['all', 'الكل'],
              ['new', 'جديد'],
              ['final', 'نهائي'],
              ['migrated', 'مهاجر'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveColumn(id as ColumnId | 'all')}
                className={`rounded-md px-2 py-1 text-[9px] transition-all ${
                  activeColumn === id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-2 rounded-xl border border-slate-800 bg-slate-900/30 p-2.5">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-[8px] text-slate-600">سيولة ≥</label>
                <input
                  type="number"
                  value={minLiquidity}
                  onChange={e => setMinLiquidity(Number(e.target.value))}
                  className="w-28 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[9px] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[8px] text-slate-600">حجم ≥</label>
                <input
                  type="number"
                  value={minVolume}
                  onChange={e => setMinVolume(Number(e.target.value))}
                  className="w-28 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[9px] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[8px] text-slate-600">نتيجة ≥</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[9px] outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[8px] text-slate-600">العمر الأقصى</label>
                <select
                  value={maxAge ?? ''}
                  onChange={e => setMaxAge(e.target.value ? Number(e.target.value) : null)}
                  className="w-28 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-[9px] outline-none"
                >
                  <option value="">أي</option>
                  <option value="60">1 د</option>
                  <option value="300">5 د</option>
                  <option value="1800">30 د</option>
                  <option value="3600">1 س</option>
                  <option value="21600">6 س</option>
                  <option value="86400">24 س</option>
                </select>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-[9px] text-slate-400 hover:text-white"
              >
                إعادة تعيين
              </button>
              <div className="ml-auto flex items-center gap-3 text-[9px] text-slate-600">
                <span>العملات <b className="text-slate-300">{filteredSignals.length}</b></span>
                <span>شراء <b className="text-emerald-400">{buyCount}</b></span>
                <span>متوسط <b className="text-slate-300">{avgScore.toFixed(0)}</b></span>
              </div>
            </div>
          </div>
        )}

        {/* Wallet strip */}
        {user && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-1.5">
            <div className="flex items-center gap-2 text-[9px]">
              <KeyRound size={11} className="text-violet-400" />
              <span className="text-slate-500">حالة البوت</span>
              <span className={botTokenInfo?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}>
                {botTokenInfo?.status === 'active' ? '✅ نشط' : '⚠️ غير نشط'}
              </span>
              {userWallet && (
                <span className="font-mono text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded">
                  {userWallet.address?.slice(0, 8)}...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[8px] text-slate-600">
              <ShieldCheck size={10} className="text-emerald-500" />
              المفاتيح الخاصة غير مكشوفة
            </div>
          </div>
        )}

        {/* Three columns */}
        {isSearching && signals.length === 0 ? (
          <div className="flex min-h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/30">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 animate-spin text-cyan-400" size={30} />
              <p className="text-[11px] text-slate-500">جاري تحميل البيانات من {getNetworkName(selectedNetwork)}...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Column
              id="new"
              title="جديد"
              subtitle="أزواج جديدة • 0–1 س"
              count={newPairs.length}
              accent="bg-emerald-400"
              signals={visibleNew}
              onBuy={signal => setSelectedSignal({ ...signal, recommendation: 'BUY' })}
              onSell={signal => setSelectedSignal({ ...signal, recommendation: 'SELL' })}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
            />
            <Column
              id="final"
              title="المرحلة النهائية"
              subtitle="أزواج نشطة • 1–24 س"
              count={finalStretch.length}
              accent="bg-amber-400"
              signals={visibleFinal}
              onBuy={signal => setSelectedSignal({ ...signal, recommendation: 'BUY' })}
              onSell={signal => setSelectedSignal({ ...signal, recommendation: 'SELL' })}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
            />
            <Column
              id="migrated"
              title="مهاجر"
              subtitle="أزواج مهاجرة / ناضجة"
              count={migrated.length}
              accent="bg-blue-400"
              signals={visibleMigrated}
              onBuy={signal => setSelectedSignal({ ...signal, recommendation: 'BUY' })}
              onSell={signal => setSelectedSignal({ ...signal, recommendation: 'SELL' })}
              onCopy={copyToClipboard}
              copiedAddress={copiedAddress}
              showAI={showAI}
            />
          </div>
        )}

        {hasMore && !searchQuery.trim() && (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-[9px] text-slate-400 hover:text-white disabled:opacity-50"
            >
              {isLoadingMore && <Loader2 size={11} className="animate-spin" />}
              تحميل المزيد
            </button>
          </div>
        )}
      </main>

      {/* ============================================================
          ✅ Trade Modal المعدل - يعرض العملة الأساسية
          ============================================================ */}
      {selectedSignal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => !executing && !tradeResult && setSelectedSignal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500">
                  {selectedSignal.recommendation === 'BUY' ? 'أمر شراء' : 'أمر بيع'}
                </div>
                <h2 className="mt-1 text-lg font-bold text-white">{selectedSignal.tokenSymbol}</h2>
                <div className="text-[8px] text-cyan-400 font-mono">
                  الشبكة: {selectedSignal.network} | العملة: {NATIVE_TOKENS[selectedSignal.network]?.symbol || 'TOKEN'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => !executing && !tradeResult && setSelectedSignal(null)}
                disabled={executing}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg bg-slate-800/50 p-2">
                <div className="text-slate-500">السعر</div>
                <div className="mt-1 text-slate-200">{priceText(selectedSignal.price)}</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-2">
                <div className="text-slate-500">القيمة السوقية</div>
                <div className="mt-1 text-slate-200">${compactNumber(selectedSignal.marketCap)}</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-2">
                <div className="text-slate-500">السيولة</div>
                <div className="mt-1 text-slate-200">${compactNumber(selectedSignal.liquidity)}</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-2">
                <div className="text-slate-500">النتيجة</div>
                <div className="mt-1 text-emerald-400">{selectedSignal.score}/100</div>
              </div>
            </div>

            {/* ✅ عرض العملة الأساسية للشبكة */}
            <div className="mt-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-2">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400">💰 العملة المستخدمة للشراء</span>
                <span className="text-cyan-400 font-bold">
                  {NATIVE_TOKENS[selectedSignal.network]?.symbol || 'TOKEN'}
                  <span className="text-slate-500 text-[8px] ml-1">
                    ({NATIVE_TOKENS[selectedSignal.network]?.name || ''})
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-[9px] text-slate-500">
                المبلغ ({NATIVE_TOKENS[selectedSignal.network]?.symbol || 'USD'})
              </label>
              <input
                type="number"
                min={1}
                max={100000}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </div>

            {/* ✅ عرض العمولة المتوقعة */}
            {selectedSignal.recommendation === 'SELL' && (
              <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
                <div className="flex items-center justify-between text-[8px]">
                  <span className="text-slate-400">💰 العمولة المتوقعة (15%)</span>
                  <span className="text-amber-400">
                    ~${(amount * 0.15).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {tradeResult && (
              <div className={`mt-3 rounded-lg p-3 ${tradeResult.success ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <p className={`text-[10px] ${tradeResult.success ? 'text-emerald-400' : 'text-red-400'} whitespace-pre-line`}>
                  {tradeResult.message}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={executing || !botTokenInfo || !!tradeResult}
                onClick={() => executeTrade(selectedSignal, selectedSignal.recommendation === 'BUY' ? 'BUY' : 'SELL')}
                className={`flex-1 rounded-lg py-2.5 text-[11px] font-bold ${
                  selectedSignal.recommendation === 'BUY'
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'bg-red-500 text-white hover:bg-red-400'
                } disabled:opacity-50`}
              >
                {executing ? (
                  <Loader2 size={14} className="mx-auto animate-spin" />
                ) : tradeResult ? (
                  'تم التنفيذ ✓'
                ) : (
                  `تأكيد ${selectedSignal.recommendation === 'BUY' ? 'شراء' : 'بيع'}`
                )}
              </button>
              <button
                type="button"
                disabled={executing}
                onClick={() => setSelectedSignal(null)}
                className="rounded-lg bg-slate-800 px-4 py-2.5 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </button>
            </div>

            {!botTokenInfo && (
              <p className="mt-3 text-center text-[9px] text-amber-400">البوت غير نشط. يرجى تفعيله أولاً.</p>
            )}
          </div>
        </div>
      )}

      {/* Bottom status bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 flex h-7 items-center justify-between border-t border-slate-800 bg-slate-950 px-3 text-[8px]">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            مستقر
          </span>
          <span>Pulse</span>
          <span>الماسح</span>
          <span>المتتبع</span>
          <span>التنبيهات</span>
        </div>
        <div className="flex items-center gap-3 text-slate-600">
          <span>{getNetworkName(selectedNetwork)}</span>
          <span className="text-slate-400">{filteredSignals.length} عملة</span>
          <span className="text-emerald-400">النتيجة {avgScore.toFixed(0)}</span>
        </div>
      </footer>
    </div>
  );
}

export default ManualTradesPage;