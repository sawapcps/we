// src/lib/madarTech.ts
// بديل Supabase - استخدام MadarTech API فقط

const API_BASE = import.meta.env.VITE_MADARTECH_API_URL || 'https://cloud.madartech.uk/api/v1';
const DB_ID = import.meta.env.VITE_MADARTECH_DB_ID || 'mt_live_AZyHOq0IztD6H5gsSafGbpjo00kDcKAPRDh0Gcob';
const API_KEY = 'mt_live_uqkE8sldXpFASeV51lIyVghJQKs4hZTheAbyAaJh';

export interface MadarTechResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ GENERIC CRUD (باستخدام /api/v1/sql) ============

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
      // جلب السجل المُدرَج
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
      return { success: false, error: result.error };
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
      // جلب السجل المُحدّث
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

// ============ TABLES ============

export const Tables = {
  WALLET: 'wallet',
  TRADES: 'trades',
  BOT_CONFIG: 'bot_config',
  ANALYSES: 'analyses',
  LOGS: 'logs',
  DISCOVERED_TOKENS: 'discovered_tokens',
} as const;

// ============ WALLET ============

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

// ============ TRADES ============

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

// ============ BOT CONFIG ============

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
// src/lib/madarTech.ts

export async function saveBotConfig(config: BotConfigData) {
  // ✅ تحويل networks إلى JSON string قبل التخزين
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
    // ✅ تحويل networks من JSON string إلى مصفوفة
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
  // ✅ إذا كان networks موجوداً، حوله إلى JSON string
  const configToUpdate = { ...config };
  if (configToUpdate.networks) {
    configToUpdate.networks = JSON.stringify(configToUpdate.networks) as any;
  }
  return madarUpdate<BotConfigData>(Tables.BOT_CONFIG, id, configToUpdate);
}
// ============ ANALYSES ============

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

// ============ DISCOVERED TOKENS ============

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

// ============ LOGS ============

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

// ============ UTILITY ============

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getTimestamp(): string {
  return new Date().toISOString();
}