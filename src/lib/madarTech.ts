// src/lib/madarTech.ts
// ============================================================
// 📦 مكتبة MadarTech الأساسية - متكاملة مع D1 و Cloudflare Workers
// ✅ تدعم 4 بوتات + محافظ متعددة + محافظ ذكية
// ✅ تم إصلاح جميع أخطاء D1_TYPE_ERROR
// ✅ جميع الكائنات تُحوّل إلى JSON String قبل الحفظ
// ============================================================

// ============================================================
// 🔧 الإعدادات الأساسية
// ============================================================
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';
const API_KEY = import.meta.env.VITE_API_KEY || 'madartech-2024-secure-key';
const DB_ID = import.meta.env.VITE_DB_ID || 'madartech-db';

// ============================================================
// 📦 أنواع البيانات الأساسية
// ============================================================
export interface MadarTechResponse<T = any> {
  success: boolean;
  data?: T | T[];
  error?: string;
  message?: string;
}

export interface BotInstanceData {
  id: string;
  user_id: string;
  bot_type: 'hunter' | 'signal' | 'manual' | 'scalper';
  name: string;
  description: string;
  status: 'running' | 'paused' | 'stopped';
  mode: 'auto' | 'manual';
  networks: string;
  paper_trading: number;
  max_position_size: number;
  take_profit: number;
  stop_loss: number;
  min_score: number;
  max_open_positions: number;
  auto_execute: number;
  min_smart_wallets: number;
  smart_wallets: string | null;
  indicator_type: string;
  rsi_oversold: number;
  rsi_overbought: number;
  total_trades: number;
  winning_trades: number;
  total_pnl: number;
  today_pnl: number;
  trading_amount: number;
  config?: string;
  created_at: string;
  updated_at: string;
}

export interface BotWalletData {
  id: string;
  bot_id: string;
  network: string;
  address: string;
  encrypted_private_key: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface SmartWalletData {
  id: string;
  address: string;
  network: string;
  winRate: number;
  totalProfit: number;
  tradesCount: number;
  lastActive: string;
  created_at: string;
  updated_at: string;
}

export interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  network: string;
  balance: number;
  createdAt: string;
}

export interface BotConfigData {
  id?: string;
  mode: string;
  networks: string[];
  minLiquidity: number;
  minVolume: number;
  maxPositionSize: number;
  takeProfit: number;
  stopLoss: number;
  scanInterval: number;
  maxTradesPerDay: number;
}

export interface LogData {
  id: string | number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface TradeData {
  id: string;
  botId: string;
  userId: string;
  side: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  price: number;
  total: number;
  network: string;
  status: 'open' | 'closed' | 'pending' | 'failed';
  profit?: number;
  profitPercentage?: number;
  openedAt: string;
  closedAt?: string;
  txHash?: string;
}

export interface AnalysisData {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  network: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  summary: string;
  signals: string; // JSON string
  priceTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: string;
  botDecision?: string; // JSON string
  additionalAnalysis?: string; // JSON string
}

export interface DiscoveredTokenData {
  id: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  network: string;
  price: number;
  volume24h: number;
  liquidity: number;
  marketCap?: number;
  score: number;
  status: 'candidate' | 'watch' | 'reject';
  timestamp: string;
}

// ============================================================
// 🛠️ دوال مساعدة
// ============================================================
export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

// ✅ دالة مساعدة لتحويل الكائنات إلى JSON String
function safeStringify(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================
// 📝 دوال CRUD الأساسية
// ============================================================

// ✅ CREATE - إدراج بيانات
export async function madarCreate<T>(
  table: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    // ✅ تنظيف البيانات من الكائنات
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        cleanData[key] = null;
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // ✅ تحويل الكائنات إلى JSON String
        cleanData[key] = JSON.stringify(value);
      } else {
        cleanData[key] = value;
      }
    }

    const keys = Object.keys(cleanData);
    const values = Object.values(cleanData);
    
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    console.log('📝 madarCreate SQL:', sql);
    console.log('📦 madarCreate Values:', values);
    console.log('🔢 عدد المعاملات:', values.length);
    
    const response = await fetch(`${WORKER_URL}/sql`, {
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Worker Response Error:', response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      };
    }
    
    const result = await response.json();
    console.log('📤 madarCreate Result:', result);
    
    if (result.success) {
      return { 
        success: true, 
        data: { id: data.id, ...data } as T 
      };
    }
    
    return result;
  } catch (error) {
    console.error('❌ madarCreate Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ READ - قراءة البيانات
export async function madarRead<T>(
  table: string,
  options?: {
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
  }
): Promise<MadarTechResponse<T>> {
  try {
    let sql = `SELECT * FROM ${table}`;
    const params: any[] = [];
    
    if (options?.where) {
      const keys = Object.keys(options.where);
      const conditions = keys.map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${conditions}`;
      params.push(...Object.values(options.where));
    }
    
    if (options?.orderBy) {
      const [key, direction] = Object.entries(options.orderBy)[0];
      sql += ` ORDER BY ${key} ${direction.toUpperCase()}`;
    }
    
    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    if (options?.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }
    
    console.log('📝 madarRead SQL:', sql);
    console.log('📦 madarRead Params:', params);
    
    const response = await fetch(`${WORKER_URL}/sql`, {
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
    console.log('📤 madarRead Result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ madarRead Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ UPDATE - تحديث بيانات
export async function madarUpdate<T>(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    // ✅ تنظيف البيانات من الكائنات
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        cleanData[key] = null;
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleanData[key] = JSON.stringify(value);
      } else {
        cleanData[key] = value;
      }
    }
    
    const updateData = {
      ...cleanData,
      updated_at: getTimestamp()
    };
    
    const updateKeys = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateKeys.map(key => `${key} = ?`).join(', ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    const params = [...updateValues, id];
    
    console.log('📝 madarUpdate SQL:', sql);
    console.log('📦 madarUpdate Params:', params);
    console.log('🔢 عدد المعاملات:', params.length);
    
    const response = await fetch(`${WORKER_URL}/sql`, {
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
    console.log('📤 madarUpdate Result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ madarUpdate Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ DELETE - حذف بيانات
export async function madarDelete(
  table: string,
  id: string
): Promise<MadarTechResponse<any>> {
  try {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const params = [id];
    
    console.log('📝 madarDelete SQL:', sql);
    console.log('📦 madarDelete Params:', params);
    
    const response = await fetch(`${WORKER_URL}/sql`, {
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
    console.log('📤 madarDelete Result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ madarDelete Error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 🤖 دوال البوتات (4 أنواع)
// ============================================================

// ✅ إنشاء بوت جديد
export async function createBotInstance(
  userId: string,
  botType: 'hunter' | 'signal' | 'manual' | 'scalper',
  name: string,
  tradingAmount: number = 100,
  description?: string,
  networks?: string[]
): Promise<{ success: boolean; botId?: string; error?: string }> {
  try {
    const botId = generateId();
    const now = getTimestamp();
    
    let networksJson = JSON.stringify(['solana']);
    if (networks && Array.isArray(networks) && networks.length > 0) {
      networksJson = JSON.stringify(networks.map(n => String(n)));
    } else if (typeof networks === 'string') {
      networksJson = JSON.stringify([networks]);
    }
    
    const data = {
      id: botId,
      user_id: userId,
      bot_type: botType,
      name: name,
      description: description || '',
      status: 'stopped',
      mode: 'auto',
      networks: networksJson, // ✅ String وليس Object
      paper_trading: 1,
      max_position_size: tradingAmount,
      take_profit: 30,
      stop_loss: 10,
      min_score: 60,
      max_open_positions: 3,
      auto_execute: 0,
      min_smart_wallets: 3,
      smart_wallets: null,
      indicator_type: 'rsi',
      rsi_oversold: 30,
      rsi_overbought: 70,
      total_trades: 0,
      winning_trades: 0,
      total_pnl: 0,
      today_pnl: 0,
      trading_amount: tradingAmount,
      created_at: now,
      updated_at: now,
    };
    
    console.log('📦 createBotInstance - Data:', data);
    console.log('🔢 عدد الحقول:', Object.keys(data).length);
    
    const result = await madarCreate('bot_instances', data);
    
    console.log('📤 createBotInstance - Result:', result);
    
    if (result.success) {
      return { success: true, botId };
    }
    
    return { success: false, error: result.error || 'فشل إنشاء البوت' };
  } catch (error) {
    console.error('❌ createBotInstance Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ جلب بوتات المستخدم
export async function getUserBots(userId: string): Promise<BotInstanceData[]> {
  try {
    console.log('🔄 getUserBots - جلب بوتات المستخدم:', userId);
    
    const result = await madarRead<BotInstanceData>('bot_instances', {
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });
    
    console.log('📦 getUserBots - Result:', result);
    
    if (result.success && result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    
    return [];
  } catch (error) {
    console.error('❌ getUserBots Error:', error);
    return [];
  }
}

// ✅ تشغيل البوت
export async function startBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('▶️ startBotInstance - تشغيل البوت:', botId);
    
    const result = await madarUpdate('bot_instances', botId, {
      status: 'running'
    });
    
    console.log('📦 startBotInstance - Result:', result);
    
    if (result.success) {
      return { success: true, message: 'تم تشغيل البوت' };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ startBotInstance Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ إيقاف البوت
export async function stopBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('⏸️ stopBotInstance - إيقاف البوت:', botId);
    
    const result = await madarUpdate('bot_instances', botId, {
      status: 'stopped'
    });
    
    console.log('📦 stopBotInstance - Result:', result);
    
    if (result.success) {
      return { success: true, message: 'تم إيقاف البوت' };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ stopBotInstance Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ حذف البوت
export async function deleteBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('🗑️ deleteBotInstance - حذف البوت:', botId);
    
    const checkResult = await madarRead('bot_instances', {
      where: { id: botId, user_id: userId }
    });
    
    if (!checkResult.success || !checkResult.data) {
      return { success: false, error: 'البوت غير موجود أو لا تملك صلاحية حذفه' };
    }
    
    const result = await madarDelete('bot_instances', botId);
    
    console.log('📦 deleteBotInstance - Result:', result);
    
    if (result.success) {
      return { success: true, message: 'تم حذف البوت' };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ deleteBotInstance Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ تحديث إعدادات البوت
export async function updateBotConfigRemote(
  botId: string,
  userId: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('💾 updateBotConfigRemote - تحديث البوت:', botId, data);
    
    // ✅ تنظيف البيانات من الكائنات
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        cleanData[key] = null;
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleanData[key] = JSON.stringify(value);
      } else {
        cleanData[key] = value;
      }
    }
    
    const response = await fetch(`${WORKER_URL}/bots/${botId}/config?userId=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(cleanData)
    });
    
    const result = await response.json();
    console.log('📦 updateBotConfigRemote - Result:', result);
    
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error || 'فشل تحديث البوت' };
  } catch (error) {
    console.error('❌ updateBotConfigRemote Error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 💰 دوال محافظ البوت
// ============================================================

// ✅ إنشاء محفظة للبوت
export async function createBotWallet(
  botId: string,
  userId: string,
  network: string,
  userAddress: string,
  encryptedPrivateKey: string
): Promise<{ success: boolean; error?: string; data?: BotWalletData }> {
  try {
    console.log('💰 createBotWallet - إنشاء محفظة للبوت:', botId, network);
    
    const walletData = {
      id: generateId(),
      bot_id: botId,
      network: network,
      address: userAddress,
      encrypted_private_key: encryptedPrivateKey,
      balance: 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };
    
    const result = await madarCreate('bot_wallet', walletData);
    
    console.log('📦 createBotWallet - Result:', result);
    
    if (result.success) {
      await madarUpdate('bot_instances', botId, {
        networks: JSON.stringify([network]),
        updated_at: getTimestamp()
      });
      
      return { success: true, data: walletData as BotWalletData };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ createBotWallet Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ جلب محفظة البوت
export async function getBotWallet(
  botId: string,
  userId: string
): Promise<BotWalletData | null> {
  try {
    console.log('🔍 getBotWallet - جلب محفظة البوت:', botId);
    
    const result = await madarRead<BotWalletData>('bot_wallet', {
      where: { bot_id: botId }
    });
    
    console.log('📦 getBotWallet - Result:', result);
    
    if (result.success && result.data) {
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return data as BotWalletData;
    }
    
    return null;
  } catch (error) {
    console.error('❌ getBotWallet Error:', error);
    return null;
  }
}

// ✅ تنفيذ صفقة باستخدام محفظة البوت
export async function executeTradeWithBotWallet(params: {
  botId: string;
  userId: string;
  side: 'buy' | 'sell';
  tokenAddress: string;
  amountUsd: number;
  tokenSymbol: string;
  network: string;
}): Promise<{ success: boolean; tradeId?: string; txHash?: string; error?: string }> {
  try {
    console.log('📊 executeTradeWithBotWallet - تنفيذ صفقة:', params);
    
    const response = await fetch(`${WORKER_URL}/bots/${params.botId}/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        userId: params.userId,
        side: params.side,
        tokenAddress: params.tokenAddress,
        amountUsd: params.amountUsd,
        tokenSymbol: params.tokenSymbol,
        network: params.network,
      }),
    });
    
    const result = await response.json();
    console.log('📦 executeTradeWithBotWallet - Result:', result);
    
    if (result.success) {
      const tradeData: TradeData = {
        id: result.tradeId || generateId(),
        botId: params.botId,
        userId: params.userId,
        side: params.side,
        tokenAddress: params.tokenAddress,
        tokenSymbol: params.tokenSymbol,
        amount: params.amountUsd,
        price: result.price || 0,
        total: params.amountUsd,
        network: params.network,
        status: 'open',
        openedAt: getTimestamp(),
        txHash: result.txHash,
      };
      
      await saveTrade(tradeData);
      
      return { 
        success: true, 
        tradeId: tradeData.id, 
        txHash: result.txHash 
      };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ executeTradeWithBotWallet Error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 🔥 دوال المحافظ الذكية
// ============================================================

// ✅ مسح المحافظ الذكية لعملة معينة
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
    console.log('🔍 scanSmartWallets - مسح المحافظ الذكية:', tokenAddress, network);
    
    const response = await fetch(`${WORKER_URL}/smart-wallets/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        tokenAddress,
        network,
        minCount,
      }),
    });
    
    const result = await response.json();
    console.log('📦 scanSmartWallets - Result:', result);
    
    if (result.success) {
      for (const wallet of (result.wallets || [])) {
        await saveSmartWallet({
          id: generateId(),
          address: wallet.address,
          network: network,
          winRate: wallet.winRate || 0,
          totalProfit: wallet.totalProfit || 0,
          tradesCount: wallet.tradesCount || 0,
          lastActive: getTimestamp(),
          created_at: getTimestamp(),
          updated_at: getTimestamp(),
        });
      }
      
      return {
        success: true,
        wallets: result.wallets,
        totalProfit: result.totalProfit,
        avgWinRate: result.avgWinRate,
      };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ scanSmartWallets Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ جلب المحافظ الذكية من قاعدة البيانات
export async function getSmartWalletsFromDB(
  network?: string,
  limit?: number,
  minWinRate?: number
): Promise<{ success: boolean; data?: SmartWalletData[]; error?: string }> {
  try {
    console.log('📊 getSmartWalletsFromDB - جلب المحافظ الذكية');
    
    const where: Record<string, any> = {};
    if (network) where.network = network;
    if (minWinRate) where.winRate = { '>=': minWinRate };
    
    const result = await madarRead<SmartWalletData>('smart_wallets', {
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { totalProfit: 'desc' },
      limit: limit || 100,
    });
    
    console.log('📦 getSmartWalletsFromDB - Result:', result);
    
    if (result.success && result.data) {
      const data = Array.isArray(result.data) ? result.data : [result.data];
      return { success: true, data: data as SmartWalletData[] };
    }
    
    return { success: true, data: [] };
  } catch (error) {
    console.error('❌ getSmartWalletsFromDB Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ تحليل عملة باستخدام الذكاء الاصطناعي
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
  analysis?: AnalysisData; 
  error?: string;
}> {
  try {
    console.log('🤖 analyzeTokenWithAI - تحليل العملة:', params.symbol);
    
    const response = await fetch(`${WORKER_URL}/ai/analyze-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(params),
    });
    
    const result = await response.json();
    console.log('📦 analyzeTokenWithAI - Result:', result);
    
    if (result.success) {
      const analysis: AnalysisData = {
        id: generateId(),
        tokenAddress: params.tokenAddress,
        tokenSymbol: params.symbol,
        network: params.network,
        recommendation: result.recommendation || 'hold',
        confidence: result.confidence || 0,
        summary: result.summary || '',
        signals: safeStringify(result.signals || []),
        priceTarget: result.priceTarget || 0,
        riskLevel: result.riskLevel || 'medium',
        timestamp: getTimestamp(),
        botDecision: safeStringify(result.botDecision || {}),
        additionalAnalysis: safeStringify(result.additionalAnalysis || {}),
      };
      
      await saveAnalysis(analysis);
      
      return { success: true, analysis };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ analyzeTokenWithAI Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ مسح جميع العملات
export async function scanAllTokens(
  network: string,
  minCount: number = 3
): Promise<{ 
  success: boolean; 
  tokens?: DiscoveredTokenData[]; 
  error?: string;
}> {
  try {
    console.log('🔄 scanAllTokens - مسح جميع العملات:', network);
    
    const response = await fetch(`${WORKER_URL}/tokens/scan-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        network,
        minCount,
      }),
    });
    
    const result = await response.json();
    console.log('📦 scanAllTokens - Result:', result);
    
    if (result.success) {
      for (const token of (result.tokens || [])) {
        await saveDiscoveredToken({
          id: generateId(),
          tokenAddress: token.address,
          symbol: token.symbol,
          name: token.name || token.symbol,
          network: network,
          price: token.price || 0,
          volume24h: token.volume24h || 0,
          liquidity: token.liquidity || 0,
          marketCap: token.marketCap,
          score: token.score || 0,
          status: token.status || 'candidate',
          timestamp: getTimestamp(),
        });
      }
      
      return { success: true, tokens: result.tokens };
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    console.error('❌ scanAllTokens Error:', error);
    return { success: false, error: String(error) };
  }
}

// ✅ حفظ محفظة ذكية
export async function saveSmartWallet(wallet: SmartWalletData): Promise<void> {
  try {
    await madarCreate('smart_wallets', wallet);
  } catch (error) {
    console.error('❌ saveSmartWallet Error:', error);
  }
}

// ============================================================
// 📦 دوال البيانات الأساسية (CRUD)
// ============================================================

// ✅ حفظ محفظة
export async function saveWallet(wallet: WalletData): Promise<void> {
  try {
    await madarCreate('wallets', wallet);
  } catch (error) {
    console.error('❌ saveWallet Error:', error);
  }
}

// ✅ جلب محفظة
export async function getWallet(address: string): Promise<MadarTechResponse<WalletData>> {
  return madarRead<WalletData>('wallets', { where: { address } });
}

// ✅ حفظ إعدادات البوت
export async function saveBotConfig(config: BotConfigData): Promise<void> {
  try {
    // ✅ تحويل networks إلى JSON String
    const cleanConfig = {
      ...config,
      networks: safeStringify(config.networks || ['solana'])
    };
    await madarCreate('bot_configs', cleanConfig);
  } catch (error) {
    console.error('❌ saveBotConfig Error:', error);
  }
}

// ✅ جلب إعدادات البوت
export async function getBotConfig(): Promise<MadarTechResponse<BotConfigData>> {
  return madarRead<BotConfigData>('bot_configs', { orderBy: { created_at: 'desc' }, limit: 1 });
}

// ✅ حفظ سجل
export async function saveLog(log: LogData): Promise<void> {
  try {
    const numericId = Date.now() + Math.floor(Math.random() * 1000);
    
    await madarCreate('logs', {
      id: numericId,
      level: log.level,
      message: log.message,
      created_at: log.timestamp || getTimestamp(),
      context: log.context ? safeStringify(log.context) : '',
    });
  } catch (error) {
    console.error('❌ saveLog Error:', error);
  }
}

// ✅ جلب السجلات
export async function getLogs(filters?: Record<string, any>): Promise<MadarTechResponse<LogData>> {
  return madarRead<LogData>('logs', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ✅ حفظ صفقة
export async function saveTrade(trade: TradeData): Promise<void> {
  try {
    await madarCreate('trades', trade);
  } catch (error) {
    console.error('❌ saveTrade Error:', error);
  }
}

// ✅ جلب الصفقات
export async function getTrades(filters?: Record<string, any>): Promise<MadarTechResponse<TradeData>> {
  return madarRead<TradeData>('trades', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ✅ حفظ تحليل (مُعدَّل - مع تحويل الكائنات)
export async function saveAnalysis(analysis: AnalysisData): Promise<void> {
  try {
    // ✅ تحويل جميع الكائنات إلى JSON String
    const cleanAnalysis = {
      ...analysis,
      signals: safeStringify(analysis.signals),
      botDecision: safeStringify((analysis as any).botDecision || {}),
      additionalAnalysis: safeStringify((analysis as any).additionalAnalysis || {}),
    };
    await madarCreate('analyses', cleanAnalysis);
  } catch (error) {
    console.error('❌ saveAnalysis Error:', error);
  }
}

// ✅ جلب التحليلات
export async function getAnalyses(filters?: Record<string, any>): Promise<MadarTechResponse<AnalysisData>> {
  return madarRead<AnalysisData>('analyses', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 50
  });
}

// ✅ حفظ عملة مكتشفة
export async function saveDiscoveredToken(token: DiscoveredTokenData): Promise<void> {
  try {
    await madarCreate('discovered_tokens', token);
  } catch (error) {
    console.error('❌ saveDiscoveredToken Error:', error);
  }
}

// ✅ جلب العملات المكتشفة
export async function getDiscoveredTokens(filters?: Record<string, any>): Promise<MadarTechResponse<DiscoveredTokenData>> {
  return madarRead<DiscoveredTokenData>('discovered_tokens', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ============================================================
// 📤 تصدير جميع الدوال
// ============================================================
export default {
  madarCreate,
  madarRead,
  madarUpdate,
  madarDelete,
  generateId,
  getTimestamp,
  safeStringify,
  createBotInstance,
  getUserBots,
  startBotInstance,
  stopBotInstance,
  deleteBotInstance,
  updateBotConfigRemote,
  createBotWallet,
  getBotWallet,
  executeTradeWithBotWallet,
  scanSmartWallets,
  getSmartWalletsFromDB,
  analyzeTokenWithAI,
  scanAllTokens,
  saveSmartWallet,
  saveWallet,
  getWallet,
  saveBotConfig,
  getBotConfig,
  saveLog,
  getLogs,
  saveTrade,
  getTrades,
  saveAnalysis,
  getAnalyses,
  saveDiscoveredToken,
  getDiscoveredTokens,
};