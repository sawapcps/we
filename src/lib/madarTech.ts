// src/lib/madarTech.ts
// ============================================================
// 📦 مكتبة MadarTech - تخزين محلي فقط (localStorage)
// ✅ جميع البيانات في localStorage (متصفح المستخدم)
// ✅ لا تعتمد على Worker أو D1
// ✅ الصفقات فقط تُرسل إلى Worker للحفظ الدائم
// ✅ الإشعارات محلية فقط (لا تذهب إلى Worker)
// ============================================================

// ============================================================
// 🔗 Worker URL (للصفقات فقط)
// ============================================================
import { createWallet } from './wallet';
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

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
  signals: string;
  priceTarget: number;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: string;
  botDecision?: string;
  additionalAnalysis?: string;
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

function safeStringify(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================
// 📦 دوال localStorage الأساسية
// ============================================================

function getLocalKey(table: string, id?: string): string {
  return `madartech_${table}${id ? `_${id}` : ''}`;
}

function getAllLocalKeys(table: string): string[] {
  const prefix = `madartech_${table}_`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
}

function getLocalData<T>(table: string): T[] {
  try {
    const keys = getAllLocalKeys(table);
    const data: T[] = [];
    for (const key of keys) {
      const item = localStorage.getItem(key);
      if (item) {
        try {
          data.push(JSON.parse(item));
        } catch {}
      }
    }
    return data;
  } catch {
    return [];
  }
}

function getLocalItem<T>(table: string, id: string): T | null {
  try {
    const key = getLocalKey(table, id);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function setLocalItem(table: string, id: string, data: any): void {
  try {
    const key = getLocalKey(table, id);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('⚠️ فشل حفظ في localStorage:', error);
  }
}

function removeLocalItem(table: string, id: string): void {
  try {
    const key = getLocalKey(table, id);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('⚠️ فشل حذف من localStorage:', error);
  }
}

function clearLocalTable(table: string): void {
  try {
    const keys = getAllLocalKeys(table);
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('⚠️ فشل مسح الجدول:', error);
  }
}

// ============================================================
// 📝 دوال CRUD الأساسية (localStorage فقط)
// ============================================================

export async function madarCreate<T>(
  table: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    const id = data.id || generateId();
    const item = { ...data, id };
    setLocalItem(table, id, item);
    return { success: true, data: item as T };
  } catch (error) {
    console.error('❌ madarCreate Error:', error);
    return { success: false, error: String(error) };
  }
}

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
    let data = getLocalData<T>(table);

    if (options?.where) {
      const keys = Object.keys(options.where);
      data = data.filter(item => {
        return keys.every(key => (item as any)[key] === options.where![key]);
      });
    }

    if (options?.orderBy) {
      const [key, direction] = Object.entries(options.orderBy)[0];
      data = data.sort((a, b) => {
        const valA = (a as any)[key];
        const valB = (b as any)[key];
        if (direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
    }

    if (options?.limit) {
      data = data.slice(0, options.limit);
    }

    if (options?.offset) {
      data = data.slice(options.offset);
    }

    return { success: true, data: data as T[] };
  } catch (error) {
    console.error('❌ madarRead Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function madarUpdate<T>(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<MadarTechResponse<T>> {
  try {
    const existing = getLocalItem(table, id);
    if (!existing) {
      return { success: false, error: 'العنصر غير موجود' };
    }
    const updated = { ...existing, ...data, updated_at: getTimestamp() };
    setLocalItem(table, id, updated);
    return { success: true, data: updated as T };
  } catch (error) {
    console.error('❌ madarUpdate Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function madarDelete(
  table: string,
  id: string
): Promise<MadarTechResponse<any>> {
  try {
    const existing = getLocalItem(table, id);
    if (!existing) {
      return { success: false, error: 'العنصر غير موجود' };
    }
    removeLocalItem(table, id);
    return { success: true, message: 'تم الحذف' };
  } catch (error) {
    console.error('❌ madarDelete Error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 🤖 دوال البوتات (محلية فقط - localStorage)
// ============================================================

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
    }

    const data: BotInstanceData = {
      id: botId,
      user_id: userId,
      bot_type: botType,
      name: name,
      description: description || '',
      status: 'stopped',
      mode: 'auto',
      networks: networksJson,
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

    await madarCreate('bot_instances', data);
    return { success: true, botId };
  } catch (error) {
    console.error('❌ createBotInstance Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function getUserBots(userId: string): Promise<BotInstanceData[]> {
  try {
    const result = await madarRead<BotInstanceData>('bot_instances', {
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });
    
    if (result.success && result.data) {
      const bots = Array.isArray(result.data) ? result.data : [result.data];
      
      return bots.map(bot => {
        if (bot.networks && typeof bot.networks === 'string') {
          if (!bot.networks.startsWith('[')) {
            bot.networks = JSON.stringify([bot.networks]);
            try {
              localStorage.setItem(`madartech_bot_instances_${bot.id}`, JSON.stringify(bot));
            } catch (e) {
              console.warn('⚠️ فشل حفظ الإصلاح:', e);
            }
          }
        }
        return bot;
      });
    }
    return [];
  } catch (error) {
    console.error('❌ getUserBots Error:', error);
    return [];
  }
}

export async function startBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await madarUpdate('bot_instances', botId, { status: 'running' });
    return { success: true, message: 'تم تشغيل البوت' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function stopBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await madarUpdate('bot_instances', botId, { status: 'stopped' });
    return { success: true, message: 'تم إيقاف البوت' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deleteBotInstance(
  botId: string,
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await madarDelete('bot_instances', botId);
    return { success: true, message: 'تم حذف البوت' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function updateBotConfigRemote(
  botId: string,
  userId: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (data.networks) {
      if (Array.isArray(data.networks)) {
        data.networks = JSON.stringify(data.networks);
      } else if (typeof data.networks === 'string' && !data.networks.startsWith('[')) {
        data.networks = JSON.stringify([data.networks]);
      }
    }
    await madarUpdate('bot_instances', botId, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 💰 دوال محافظ البوت (محلية فقط)
// ============================================================

export async function createBotWallet(
  botId: string,
  userId: string,
  network: string,
  userAddress: string,
  encryptedPrivateKey: string
): Promise<{ success: boolean; error?: string; data?: BotWalletData }> {
  try {
    const walletData: BotWalletData = {
      id: generateId(),
      bot_id: botId,
      network: network,
      address: userAddress,
      encrypted_private_key: encryptedPrivateKey,
      balance: 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };
    await madarCreate('bot_wallet', walletData);
    return { success: true, data: walletData };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getBotWallet(
  botId: string,
  userId: string
): Promise<BotWalletData | null> {
  try {
    const result = await madarRead<BotWalletData>('bot_wallet', {
      where: { bot_id: botId }
    });
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

// ============================================================
// 🔥 دوال المحافظ الذكية (محاكاة)
// ============================================================
// ============================================================
// 💰 دوال محافظ البوت (محلية فقط)
// ============================================================


export async function createBotWallet(
  botId: string,
  userId: string,
  network: string,
  userAddress?: string,        // ✅ اجعلها اختيارية
  encryptedPrivateKey?: string // ✅ اجعلها اختيارية
): Promise<{ success: boolean; error?: string; data?: BotWalletData }> {
  try {
    let address = userAddress;
    let privKey = encryptedPrivateKey;

    // ✅ التحقق: إذا لم يكن هناك عنوان صالح، أنشئ واحداً
    const isValidAddress = address && !address.includes('-') && address.length > 20;
    
    if (!isValidAddress) {
      console.log(`🆕 إنشاء عنوان ${network} جديد (لأن العنوان الحالي غير صالح)...`);
      const newWallet = createWallet(network);
      address = newWallet.address;
      privKey = newWallet.privateKey;
      console.log(`✅ تم إنشاء عنوان ${network} صالح: ${address}`);
    }

    const walletData: BotWalletData = {
      id: generateId(),
      bot_id: botId,
      network: network,
      address: address!,
      encrypted_private_key: privKey || 'encrypted_fallback',
      balance: 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };
    
    await madarCreate('bot_wallet', walletData);
    return { success: true, data: walletData };
  } catch (error) {
    console.error('❌ createBotWallet Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function getBotWallet(
  botId: string,
  userId: string
): Promise<BotWalletData | null> {
  try {
    const result = await madarRead<BotWalletData>('bot_wallet', {
      where: { bot_id: botId }
    });
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
// ============================================================
// 💰 تنفيذ صفقة (تُرسل إلى Worker للحفظ الدائم)
// ============================================================

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
    console.log('📊 executeTradeWithBotWallet:', params);

    const tradeId = generateId();
    const txHash = `0x${generateId()}`;

    const tradeData: TradeData = {
      id: tradeId,
      botId: params.botId,
      userId: params.userId,
      side: params.side,
      tokenAddress: params.tokenAddress,
      tokenSymbol: params.tokenSymbol,
      amount: params.amountUsd,
      price: 0,
      total: params.amountUsd,
      network: params.network,
      status: 'pending',
      openedAt: getTimestamp(),
      txHash: txHash,
    };

    // ✅ حفظ في localStorage (كاش)
    await saveTrade(tradeData);

    // ✅ إرسال إلى Worker (للحفظ الدائم في قاعدة البيانات)
    try {
      const response = await fetch(`${WORKER_URL}/trades/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          tradeId,
          txHash,
          timestamp: getTimestamp(),
        }),
      });
      const result = await response.json();
      if (result.success) {
        console.log(`✅ تم حفظ الصفقة ${tradeId} في قاعدة البيانات`);
      } else {
        console.warn('⚠️ فشل حفظ الصفقة في Worker:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ فشل الاتصال بـ Worker:', error);
    }

    return {
      success: true,
      tradeId: tradeId,
      txHash: txHash,
    };
  } catch (error) {
    console.error('❌ executeTradeWithBotWallet Error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================
// 📦 دوال البيانات الأساسية (محلية فقط - localStorage)
// ============================================================

// ✅ محافظ المستخدم
export async function saveWallet(wallet: WalletData): Promise<void> {
  await madarCreate('wallets', wallet);
}

export async function getWallet(address: string): Promise<MadarTechResponse<WalletData>> {
  return madarRead<WalletData>('wallets', { where: { address } });
}

// ✅ إعدادات البوت
export async function saveBotConfig(config: BotConfigData): Promise<void> {
  const cleanConfig = {
    ...config,
    networks: safeStringify(config.networks || ['solana'])
  };
  await madarCreate('bot_configs', cleanConfig);
}

export async function getBotConfig(): Promise<MadarTechResponse<BotConfigData>> {
  return madarRead<BotConfigData>('bot_configs', { orderBy: { created_at: 'desc' }, limit: 1 });
}

// ✅ السجلات - فقط localStorage (لا تذهب إلى Worker)
export async function saveLog(log: LogData): Promise<void> {
  const numericId = Date.now() + Math.floor(Math.random() * 1000);
  await madarCreate('logs', {
    id: numericId,
    level: log.level,
    message: log.message,
    created_at: log.timestamp || getTimestamp(),
    context: log.context ? safeStringify(log.context) : '',
  });
  // ❌ لا ترسل إلى Worker
}

export async function getLogs(filters?: Record<string, any>): Promise<MadarTechResponse<LogData>> {
  return madarRead<LogData>('logs', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ✅ الصفقات - localStorage + Worker
export async function saveTrade(trade: TradeData): Promise<void> {
  await madarCreate('trades', trade);
}

export async function getTrades(filters?: Record<string, any>): Promise<MadarTechResponse<TradeData>> {
  // ✅ حاول الجلب من Worker أولاً (للحصول على أحدث البيانات)
  try {
    const response = await fetch(`${WORKER_URL}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters || {}),
    });
    const result = await response.json();
    if (result.success && result.data) {
      // ✅ تحديث localStorage ككاش
      const data = Array.isArray(result.data) ? result.data : [result.data];
      for (const trade of data) {
        setLocalItem('trades', trade.id, trade);
      }
      return { success: true, data: data };
    }
  } catch (error) {
    console.warn('⚠️ فشل جلب الصفقات من Worker:', error);
  }
  
  // ❌ ارجع إلى localStorage
  return madarRead<TradeData>('trades', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ✅ التحليلات - فقط localStorage
export async function saveAnalysis(analysis: AnalysisData): Promise<void> {
  const cleanAnalysis = {
    ...analysis,
    signals: safeStringify(analysis.signals),
    botDecision: safeStringify((analysis as any).botDecision || {}),
    additionalAnalysis: safeStringify((analysis as any).additionalAnalysis || {}),
  };
  await madarCreate('analyses', cleanAnalysis);
}

export async function getAnalyses(filters?: Record<string, any>): Promise<MadarTechResponse<AnalysisData>> {
  return madarRead<AnalysisData>('analyses', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 50
  });
}

// ✅ العملات المكتشفة - فقط localStorage
export async function saveDiscoveredToken(token: DiscoveredTokenData): Promise<void> {
  await madarCreate('discovered_tokens', token);
}

export async function getDiscoveredTokens(filters?: Record<string, any>): Promise<MadarTechResponse<DiscoveredTokenData>> {
  return madarRead<DiscoveredTokenData>('discovered_tokens', {
    where: filters,
    orderBy: { created_at: 'desc' },
    limit: 100
  });
}

// ✅ الإشعارات - فقط localStorage
export async function saveNotification(notification: {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
}): Promise<void> {
  try {
    const existing = localStorage.getItem('notifications');
    const notifications = existing ? JSON.parse(existing) : [];
    notifications.push(notification);
    if (notifications.length > 50) {
      notifications.splice(0, notifications.length - 50);
    }
    localStorage.setItem('notifications', JSON.stringify(notifications));
  } catch (error) {
    console.warn('⚠️ فشل حفظ الإشعار:', error);
  }
}

export async function getNotifications(): Promise<any[]> {
  try {
    const existing = localStorage.getItem('notifications');
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export async function clearNotifications(): Promise<void> {
  localStorage.removeItem('notifications');
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
  scanSmartWallets,
  getSmartWalletsFromDB,
  analyzeTokenWithAI,
  executeTradeWithBotWallet,
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
  saveNotification,
  getNotifications,
  clearNotifications,
};