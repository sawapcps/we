// src/lib/madarTech.ts
// بديل Supabase - استخدام MadarTech API فقط
// ============================================================
// يدعم: CRUD عام + محافظ البوت + البوتات المتعددة (Hunter, Signal, Manual, Scalper) + المحافظ الذكية
// ============================================================

const API_BASE = import.meta.env.VITE_MADARTECH_API_URL || 'https://cloud.madartech.uk/api/v1';
const DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';
const API_KEY = 'mt_live_uqkE8sldXpFASeV51lIyVghJQKs4hZTheAbyAaJh';
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

export interface MadarTechResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// 🔗 دوال Worker API (البوتات المتعددة)
// ============================================================

export interface BotInstanceData {
  id: string;
  user_id: string;
  bot_type: 'hunter' | 'signal' | 'manual' | 'scalper';
  name: string;
  description: string;
  status: 'running' | 'paused' | 'stopped';
  mode: 'auto' | 'manual';
  networks: string;
  paper_trading: boolean;
  max_position_size: number;
  take_profit: number;
  stop_loss: number;
  min_score: number;
  max_open_positions: number;
  auto_execute: boolean;
  min_smart_wallets: number;
  smart_wallets: string;
  indicator_type: string;
  rsi_oversold: number;
  rsi_overbought: number;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  today_pnl: number;
  config?: string;
  created_at: string;
  updated_at: string;
}

export interface BotWalletData {
  id: string;
  bot_id: string;
  address: string;
  encryptedPrivateKey: string;
  network: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 🔥 المحافظ الذكية (جديدة)
// ============================================================

export interface SmartWalletData {
  id: string;
  address: string;
  network: string;
  win_rate: number;
  total_profit_usd: number;
  total_trades: number;
  last_active: string;
  updated_at: string;
  is_active: number;
  created_at: string;
}

export interface SmartWalletAnalysis {
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  summary: string;
  signals: Array<{
    label: string;
    value: string;
    bullish: boolean;
  }>;
  priceTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  catalysts: string[];
  risks: string[];
}

// ============================================================
// 📡 دوال المحافظ الذكية (جديدة)
// ============================================================

export async function scanSmartWallets(
  tokenAddress: string,
  network: string,
  minCount: number = 3
): Promise<{
  success: boolean;
  wallets?: SmartWalletData[];
  totalProfit?: number;
  avgWinRate?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${WORKER_URL}/smart-wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network, minCount }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getSmartWalletsFromDB(
  network?: string,
  limit: number = 50,
  minWinRate: number = 40
): Promise<{
  success: boolean;
  data?: SmartWalletData[];
  count?: number;
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (network) params.append('network', network);
    params.append('limit', String(limit));
    params.append('minWinRate', String(minWinRate));
    
    const response = await fetch(`${WORKER_URL}/smart-wallets-db?${params}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function analyzeTokenWithAI(params: {
  tokenAddress: string;
  network: string;
  symbol: string;
  name?: string;
  price?: number;
  liquidity?: number;
  volume24h?: number;
  priceChange24h?: number;
}): Promise<{
  success: boolean;
  analysis?: SmartWalletAnalysis;
  error?: string;
}> {
  try {
    const response = await fetch(`${WORKER_URL}/analyze-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function scanAllTokens(
  network: string,
  minCount: number = 3
): Promise<{
  success: boolean;
  network?: string;
  totalTokens?: number;
  results?: Array<{
    symbol: string;
    address: string;
    wallets: number;
    totalProfit: number;
    avgWinRate: number;
    error?: string;
  }>;
  totalWalletsFound?: number;
  allWallets?: SmartWalletData[];
  timestamp?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${WORKER_URL}/scan-all-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network, minCount }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 📡 دوال Worker API (البوتات المتعددة)
// ============================================================

export async function getUserBots(userId: string): Promise<BotInstanceData[]> {
  try {
    const response = await fetch(`${WORKER_URL}/bots?userId=${userId}`);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('❌ فشل جلب البوتات:', error);
    return [];
  }
}

export async function createBotInstance(
  userId: string,
  botType: 'hunter' | 'signal' | 'manual' | 'scalper',
  name: string,
  description?: string
): Promise<{ success: boolean; botId?: string; error?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, bot_type: botType, name, description: description || '' }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function startBotInstance(botId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/start?userId=${userId}`, { method: 'POST' });
    return await response.json();
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

export async function stopBotInstance(botId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/stop?userId=${userId}`, { method: 'POST' });
    return await response.json();
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

export async function deleteBotInstance(botId: string, userId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/delete?userId=${userId}`, { method: 'DELETE' });
    return await response.json();
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

export async function createBotWallet(
  botId: string,
  userId: string,
  network: string
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/wallet/create?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getBotWallet(botId: string, userId: string): Promise<BotWalletData | null> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/wallet?userId=${userId}`);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('❌ فشل جلب محفظة البوت:', error);
    return null;
  }
}

export async function executeTradeWithBotWallet(params: {
  botId: string;
  userId: string;
  side: 'buy' | 'sell';
  tokenAddress: string;
  amountUsd: number;
  tokenSymbol: string;
  network: string;
}): Promise<{ success: boolean; tradeId?: string; txHash?: string; price?: number; error?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/execute-trade?userId=${params.userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function updateBotConfigRemote(
  botId: string,
  userId: string,
  config: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${WORKER_URL}/bots/${botId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, config }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 🗄️ GENERIC CRUD (باستخدام /api/v1/sql)
// ============================================================

export async function madarCreate<T>(
  table: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    const response = await fetch(`${API_BASE}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ 
        sql: sql,
        dbId: DB_ID,
        params: values
      }),
    });
    
    const result = await response.json();
    if (result.success) {
      const selectResponse = await fetch(`${API_BASE}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT * FROM ${table} WHERE rowid = last_insert_rowid()`,
          dbId: DB_ID
        }),
      });
      const selectResult = await selectResponse.json();
      return { 
        success: true, 
        data: selectResult.success && selectResult.data && selectResult.data.length > 0 
          ? selectResult.data[0] 
          : { ...data, id: Date.now() }
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function madarRead<T>(
  table: string,
  filters?: Record<string, any>
): Promise<MadarTechResponse<T[]>> {
  try {
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];
    
    if (filters && Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
    }
    
    const response = await fetch(`${API_BASE}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ 
        sql: sql,
        dbId: DB_ID,
        params: params
      }),
    });
    
    const result = await response.json();
    if (result.success) {
      return { success: true, data: result.data || [] };
    } else {
      return { success: false, error: result.error, data: [] };
    }
  } catch (error) {
    return { success: false, error: String(error), data: [] };
  }
}

export async function madarUpdate<T>(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), id];
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    
    const response = await fetch(`${API_BASE}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ 
        sql: sql,
        dbId: DB_ID,
        params: values
      }),
    });
    
    const result = await response.json();
    if (result.success) {
      const selectResponse = await fetch(`${API_BASE}/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          sql: `SELECT * FROM ${table} WHERE id = ?`,
          dbId: DB_ID,
          params: [id]
        }),
      });
      const selectResult = await selectResponse.json();
      return { 
        success: true, 
        data: selectResult.success && selectResult.data && selectResult.data.length > 0 
          ? selectResult.data[0] 
          : { ...data, id }
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function madarDelete(
  table: string,
  id: string
): Promise<MadarTechResponse<boolean>> {
  try {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    
    const response = await fetch(`${API_BASE}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ 
        sql: sql,
        dbId: DB_ID,
        params: [id]
      }),
    });
    
    const result = await response.json();
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 📋 TABLES
// ============================================================

export const Tables = {
  WALLET: 'wallet',
  TRADES: 'trades',
  BOT_CONFIG: 'bot_config',
  ANALYSES: 'analyses',
  LOGS: 'logs',
  DISCOVERED_TOKENS: 'discovered_tokens',
  SCALPER_CONFIGS: 'scalper_configs',
  SCALPER_TRADES: 'scalper_trades',
} as const;

// ============================================================
// 💰 WALLET
// ============================================================

export interface WalletData {
  id?: string;
  address: string;
  encryptedPrivateKey: string;
  network: string;
  balance?: number;
  createdAt?: string;
}

export async function saveWallet(wallet: WalletData) {
  return madarCreate<WalletData>(Tables.WALLET, wallet);
}

export async function getWallet(address: string) {
  const result = await madarRead<WalletData>(Tables.WALLET, { address });
  return result;
}

export async function updateWalletBalance(address: string, balance: number) {
  return madarUpdate<WalletData>(Tables.WALLET, address, { balance });
}

// ============================================================
// 📊 TRADES
// ============================================================

export interface TradeData {
  id?: string;
  token: string;
  tokenAddress: string;
  network: string;
  amount: number;
  price: number;
  type: 'BUY' | 'SELL';
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'CLOSED';
  timestamp: string;
  txHash?: string;
  pnl?: number;
  pnlPercent?: number;
}

export async function saveTrade(trade: TradeData) {
  return madarCreate<TradeData>(Tables.TRADES, trade);
}

export async function getTrades(filters?: Record<string, any>) {
  return madarRead<TradeData>(Tables.TRADES, filters);
}

// ============================================================
// 🤖 BOT CONFIG
// ============================================================

export interface BotConfigData {
  id?: string;
  mode: 'AUTO' | 'MANUAL';
  networks: string[];
  minLiquidity: number;
  minVolume: number;
  maxPositionSize: number;
  takeProfit: number;
  stopLoss: number;
  scanInterval: number;
  maxTradesPerDay: number;
  updatedAt?: string;
}

export async function saveBotConfig(config: BotConfigData) {
  const configToSave = {
    ...config,
    networks: JSON.stringify(config.networks),
  };
  return madarCreate<BotConfigData>(Tables.BOT_CONFIG, configToSave);
}

export async function getBotConfig() {
  const result = await madarRead<BotConfigData>(Tables.BOT_CONFIG);
  if (result.success && result.data && result.data.length > 0) {
    const config = result.data[0];
    if (typeof config.networks === 'string') {
      try {
        config.networks = JSON.parse(config.networks);
      } catch {
        config.networks = ['solana'];
      }
    }
    return { ...result, data: [config] };
  }
  return result;
}

export async function updateBotConfig(id: string, config: Partial<BotConfigData>) {
  const configToUpdate = { ...config };
  if (configToUpdate.networks) {
    configToUpdate.networks = JSON.stringify(configToUpdate.networks) as any;
  }
  return madarUpdate<BotConfigData>(Tables.BOT_CONFIG, id, configToUpdate);
}

// ============================================================
// 🧠 ANALYSES
// ============================================================

export interface AnalysisData {
  id?: string;
  token: string;
  tokenAddress: string;
  network: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  priceTarget: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: string;
  score?: number;
}

export async function saveAnalysis(analysis: AnalysisData) {
  return madarCreate<AnalysisData>(Tables.ANALYSES, analysis);
}

export async function getAnalyses(filters?: Record<string, any>) {
  return madarRead<AnalysisData>(Tables.ANALYSES, filters);
}

// ============================================================
// 🔍 DISCOVERED TOKENS
// ============================================================

export interface DiscoveredTokenData {
  id?: string;
  tokenAddress: string;
  network: string;
  name: string;
  symbol: string;
  price: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  age: number;
  score: number;
  status: 'PENDING' | 'ANALYZED' | 'BOUGHT' | 'SOLD' | 'REJECTED';
  discoveredAt: string;
  holders?: number;
  deployer?: string;
}

export async function saveDiscoveredToken(token: DiscoveredTokenData) {
  return madarCreate<DiscoveredTokenData>(Tables.DISCOVERED_TOKENS, token);
}

export async function getDiscoveredTokens(filters?: Record<string, any>) {
  return madarRead<DiscoveredTokenData>(Tables.DISCOVERED_TOKENS, filters);
}

// ============================================================
// 📝 LOGS
// ============================================================

export interface LogData {
  id?: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

export async function saveLog(log: LogData) {
  return madarCreate<LogData>(Tables.LOGS, log);
}

export async function getLogs(filters?: Record<string, any>) {
  return madarRead<LogData>(Tables.LOGS, filters);
}

// ============================================================
// ⚡ SCALPER (البوت الرابع)
// ============================================================

export interface ScalperConfigData {
  id?: string;
  bot_id: string;
  user_id: string;
  target_token: string;
  target_token_address: string;
  total_amount_usd: number;
  amount_per_trade: number;
  max_open_trades: number;
  buy_threshold: number;
  buy_interval: number;
  take_profit: number;
  stop_loss: number;
  trailing_stop: number;
  min_trade_interval: number;
  max_trade_duration: number;
  network: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ScalperTradeData {
  id?: string;
  bot_id: string;
  user_id: string;
  token_symbol: string;
  token_address: string;
  network: string;
  side: 'buy' | 'sell';
  entry_price: number;
  exit_price?: number;
  amount_usd: number;
  quantity?: number;
  pnl?: number;
  pnl_percent?: number;
  status: 'open' | 'closed' | 'failed';
  opened_at?: string;
  closed_at?: string;
  tx_hash?: string;
}

export async function saveScalperConfig(config: ScalperConfigData) {
  return madarCreate<ScalperConfigData>(Tables.SCALPER_CONFIGS, config);
}

export async function getScalperConfig(botId: string) {
  return madarRead<ScalperConfigData>(Tables.SCALPER_CONFIGS, { bot_id: botId });
}

export async function updateScalperConfig(botId: string, data: Partial<ScalperConfigData>) {
  return madarUpdate<ScalperConfigData>(Tables.SCALPER_CONFIGS, botId, data);
}

export async function saveScalperTrade(trade: ScalperTradeData) {
  return madarCreate<ScalperTradeData>(Tables.SCALPER_TRADES, trade);
}

export async function getScalperTrades(filters?: Record<string, any>) {
  return madarRead<ScalperTradeData>(Tables.SCALPER_TRADES, filters);
}

// ============================================================
// 🛠️ UTILITY
// ============================================================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getTimestamp(): string {
  return new Date().toISOString();
}