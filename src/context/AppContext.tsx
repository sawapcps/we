// src/context/AppContext.tsx
// ============================================================
// سياق التطبيق الرئيسي - يدعم 4 بوتات + محافظ متعددة (داخلية وخارجية) + المحافظ الذكية
// ============================================================

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import {
  madarRead,
  saveBotConfig,
  getBotConfig,
  saveLog,
  getLogs,
  getWallet,
  saveWallet,
  WalletData,
  BotConfigData,
  LogData,
  TradeData,
  getTrades,
  saveTrade,
  AnalysisData,
  getAnalyses,
  saveAnalysis,
  DiscoveredTokenData,
  getDiscoveredTokens,
  saveDiscoveredToken,
  generateId,
  getTimestamp,
  getUserBots,
  createBotInstance,
  startBotInstance,
  stopBotInstance,
  deleteBotInstance,
  createBotWallet,
  getBotWallet,
  executeTradeWithBotWallet,
  updateBotConfigRemote,
  scanSmartWallets,
  getSmartWalletsFromDB,
  analyzeTokenWithAI,
  scanAllTokens,
  type BotInstanceData,
  type BotWalletData as WorkerBotWalletData,
  type SmartWalletData,
} from '../lib/madarTech';
import { BotWalletManager, BotWalletData } from '../lib/wallet';
import { AccountManager, UserAccount, UserWallet, Transaction } from '../lib/accounts';

// ============================================================
// 🔗 دعم محافظ متعددة (خارجية)
// ============================================================

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
  getBalance: (address: string) => Promise<number>;
  getNetwork: () => string;
  signTransaction: (tx: any) => Promise<any>;
}

// ✅ Phantom Wallet (Solana)
class PhantomWallet implements WalletProvider {
  id = 'phantom';
  name = 'Phantom';
  icon = '🟣';
  
  get installed(): boolean {
    return typeof window !== 'undefined' && !!(window as any).solana?.isPhantom;
  }

  async connect(): Promise<string> {
    if (!this.installed) {
      throw new Error('Phantom wallet not installed');
    }
    const response = await (window as any).solana.connect();
    return response.publicKey.toString();
  }

  async disconnect(): Promise<void> {
    if (this.installed) {
      await (window as any).solana.disconnect();
    }
  }

  async getBalance(address: string): Promise<number> {
    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });
      const data = await response.json();
      return data.result?.value / 1e9 || 0;
    } catch {
      return 0;
    }
  }

  getNetwork(): string {
    return 'solana';
  }

  async signTransaction(tx: any): Promise<any> {
    return (window as any).solana.signTransaction(tx);
  }
}

// ✅ MetaMask (Ethereum)
class MetaMaskWallet implements WalletProvider {
  id = 'metamask';
  name = 'MetaMask';
  icon = '🦊';
  
  get installed(): boolean {
    return typeof window !== 'undefined' && !!(window as any).ethereum?.isMetaMask;
  }

  async connect(): Promise<string> {
    if (!this.installed) {
      throw new Error('MetaMask not installed');
    }
    const accounts = await (window as any).ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    return accounts[0];
  }

  async disconnect(): Promise<void> {
    // MetaMask doesn't support disconnect
  }

  async getBalance(address: string): Promise<number> {
    try {
      const response = await fetch('https://cloudflare-eth.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });
      const data = await response.json();
      return parseInt(data.result || '0') / 1e18;
    } catch {
      return 0;
    }
  }

  getNetwork(): string {
    return 'ethereum';
  }

  async signTransaction(tx: any): Promise<any> {
    return (window as any).ethereum.request({
      method: 'eth_sendTransaction',
      params: [tx],
    });
  }
}

// ✅ WalletConnect (جميع الشبكات)
class WalletConnectWallet implements WalletProvider {
  id = 'walletconnect';
  name = 'WalletConnect';
  icon = '🔗';
  
  get installed(): boolean {
    return true;
  }

  async connect(): Promise<string> {
    throw new Error('WalletConnect requires QR code scanning');
  }

  async disconnect(): Promise<void> {
    // Disconnect logic
  }

  async getBalance(address: string): Promise<number> {
    return 0;
  }

  getNetwork(): string {
    return 'multi';
  }

  async signTransaction(tx: any): Promise<any> {
    return null;
  }
}

// ============================================================
// WORKER URL
// ============================================================
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============================================================
// الأنواع
// ============================================================

interface AppContextType {
  // Wallet (المستخدم الحالي)
  wallet: WalletData | null;
  setWallet: (wallet: WalletData | null) => void;
  loadWallet: (address: string) => Promise<void>;
  createWallet: (network: string) => Promise<WalletData>;
  
  // 🔥 المحافظ المتعددة (خارجية)
  walletProviders: WalletProvider[];
  activeWallet: WalletProvider | null;
  walletAddress: string | null;
  isWalletConnected: boolean;
  connectWallet: (providerId: string) => Promise<string>;
  disconnectWallet: () => Promise<void>;
  getWalletBalance: () => Promise<number>;
  walletNetwork: string;
  signTransaction: (tx: any) => Promise<any>;

  // محافظ البوت (داخلية - للأدمن)
  botWallets: BotWalletData[];
  loadBotWallets: () => Promise<void>;
  getBotWallet: (network: string) => BotWalletData | null;
  refreshBotBalance: (network: string) => Promise<number>;

  // محافظ المستخدم (الفردية)
  userWallets: UserWallet[];
  loadUserWallets: () => Promise<void>;
  createUserWallet: (network: string) => Promise<UserWallet>;
  refreshUserBalance: (network: string) => Promise<number>;
  getUserWallet: (network: string) => UserWallet | null;

  // 🔥 المحافظ الذكية (جديدة)
  smartWallets: SmartWalletData[];
  smartWalletStats: { totalProfit: number; avgWinRate: number } | null;
  scanSmartWallets: (tokenAddress: string, network: string, minCount?: number) => Promise<any>;
  getSmartWalletsFromDB: (network?: string, limit?: number, minWinRate?: number) => Promise<any>;
  analyzeTokenWithAI: (params: {
    tokenAddress: string;
    network: string;
    symbol: string;
    name?: string;
    price?: number;
    liquidity?: number;
    volume24h?: number;
    priceChange24h?: number;
  }) => Promise<any>;
  scanAllTokens: (network: string, minCount?: number) => Promise<any>;
  smartWalletsLoading: boolean;

  // Bot Config
  botConfig: BotConfigData | null;
  setBotConfig: (config: BotConfigData) => Promise<void>;
  loadBotConfig: () => Promise<void>;

  // Trades
  trades: TradeData[];
  loadTrades: (filters?: Record<string, any>) => Promise<void>;
  addTrade: (trade: TradeData) => Promise<void>;

  // Analyses
  analyses: AnalysisData[];
  loadAnalyses: (filters?: Record<string, any>) => Promise<void>;
  addAnalysis: (analysis: AnalysisData) => Promise<void>;

  // Discovered Tokens
  discoveredTokens: DiscoveredTokenData[];
  loadDiscoveredTokens: (filters?: Record<string, any>) => Promise<void>;
  addDiscoveredToken: (token: DiscoveredTokenData) => Promise<void>;

  // Logs
  logs: LogData[];
  loadLogs: (filters?: Record<string, any>) => Promise<void>;
  addLog: (level: LogData['level'], message: string, context?: Record<string, any>) => Promise<void>;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Bot running state
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  
  // تحديث حالة البوت
  updateBotState: (isRunning: boolean, networks?: string[]) => Promise<void>;
  
  // User
  user: UserAccount | null;
  setUser: (user: UserAccount | null) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
  
  // إحصائيات المستخدم
  userStats: {
    totalProfit: number;
    totalFees: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netBalance: number;
    tradesCount: number;
  } | null;
  loadUserStats: () => Promise<void>;
  
  // المعاملات
  transactions: Transaction[];
  loadTransactions: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;

  // ============================================================
  // 🔥 البوتات المتعددة (4 بوتات)
  // ============================================================
  botInstances: BotInstanceData[];
  loadBotInstances: (userId?: string) => Promise<void>;
  createBot: (type: 'hunter' | 'signal' | 'manual' | 'scalper', name: string, userId?: string) => Promise<void>;
  startBot: (botId: string, userId?: string) => Promise<void>;
  stopBot: (botId: string, userId?: string) => Promise<void>;
  deleteBot: (botId: string, userId?: string) => Promise<void>;
  createWalletForBot: (botId: string, network: string, userId?: string) => Promise<void>;
  getBotWalletData: (botId: string, userId?: string) => Promise<WorkerBotWalletData | null>;
  updateBotConfig: (botId: string, data: any, userId?: string) => Promise<void>;
  executeTrade: (params: {
    botId: string;
    side: 'buy' | 'sell';
    tokenAddress: string;
    amountUsd: number;
    tokenSymbol: string;
    network: string;
    userId?: string;
  }) => Promise<{ success: boolean; tradeId?: string; txHash?: string; error?: string }>;
}

// ============================================================
// القيم الافتراضية
// ============================================================

const defaultBotConfig: BotConfigData = {
  mode: 'AUTO',
  networks: ['solana'],
  minLiquidity: 50000,
  minVolume: 100000,
  maxPositionSize: 100,
  takeProfit: 15,
  stopLoss: 5,
  scanInterval: 5,
  maxTradesPerDay: 5,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================================
// Provider
// ============================================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // ============================================================
  // الحالات الأساسية
  // ============================================================
    console.log('🔄 AppProvider: بدء التشغيل');

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [botWallets, setBotWallets] = useState<BotWalletData[]>([]);
  const [userWallets, setUserWallets] = useState<UserWallet[]>([]);
  const [botConfig, setBotConfigState] = useState<BotConfigData | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [discoveredTokens, setDiscoveredTokens] = useState<DiscoveredTokenData[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStats, setUserStats] = useState<AppContextType['userStats']>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ============================================================
  // 🔥 حالات المحافظ الذكية (جديدة)
  // ============================================================
  const [smartWallets, setSmartWallets] = useState<SmartWalletData[]>([]);
  const [smartWalletStats, setSmartWalletStats] = useState<{ totalProfit: number; avgWinRate: number } | null>(null);
  const [smartWalletsLoading, setSmartWalletsLoading] = useState(false);

  // ============================================================
  // 🔥 حالات المحافظ المتعددة (خارجية)
  // ============================================================
  const [activeWallet, setActiveWallet] = useState<WalletProvider | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const walletProviders: WalletProvider[] = [
    new PhantomWallet(),
    new MetaMaskWallet(),
    new WalletConnectWallet(),
  ];

  // ============================================================
  // 🔥 حالات البوتات المتعددة
  // ============================================================
  const [botInstances, setBotInstances] = useState<BotInstanceData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // ============================================================
  // 🔥 منع التكرار (Refs) - محسّن
  // ============================================================
  const hasLoadedWallets = useRef(false);
  const isInitialized = useRef(false);
  const hasLoadedUserWallets = useRef(false);
  const hasLoadedBotInstances = useRef(false);
  const isLoadingWallets = useRef(false);

  // ============================================================
  // 🔗 دوال المحافظ المتعددة (خارجية)
  // ============================================================

  const connectWallet = async (providerId: string): Promise<string> => {
    const provider = walletProviders.find(p => p.id === providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!provider.installed && provider.id !== 'walletconnect') {
      throw new Error(`${provider.name} not installed`);
    }

    try {
      const address = await provider.connect();
      setActiveWallet(provider);
      setWalletAddress(address);
      setIsWalletConnected(true);
      await addLog('SUCCESS', `✅ تم ربط ${provider.name}: ${address.slice(0, 8)}...`);
      return address;
    } catch (error) {
      await addLog('ERROR', `❌ فشل ربط ${provider.name}: ${error}`);
      throw error;
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    if (activeWallet) {
      try {
        await activeWallet.disconnect();
      } catch (error) {
        console.warn('Disconnect error:', error);
      }
    }
    setActiveWallet(null);
    setWalletAddress(null);
    setIsWalletConnected(false);
    await addLog('INFO', '🔌 تم فصل المحفظة');
  };

  const getWalletBalance = async (): Promise<number> => {
    if (!activeWallet || !walletAddress) return 0;
    try {
      const balance = await activeWallet.getBalance(walletAddress);
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  };

  const signTransaction = async (tx: any): Promise<any> => {
    if (!activeWallet) {
      throw new Error('No wallet connected');
    }
    return activeWallet.signTransaction(tx);
  };

  const walletNetwork = activeWallet?.getNetwork() || 'unknown';

  // ============================================================
  // 🔥 دوال المحافظ الذكية (جديدة)
  // ============================================================

  const scanSmartWallets = async (tokenAddress: string, network: string, minCount: number = 3) => {
    setSmartWalletsLoading(true);
    try {
      const result = await scanSmartWallets(tokenAddress, network, minCount);
      if (result.success) {
        setSmartWallets(result.wallets || []);
        setSmartWalletStats({
          totalProfit: result.totalProfit || 0,
          avgWinRate: result.avgWinRate || 0,
        });
        await addLog('SUCCESS', `✅ تم تحليل ${result.wallets?.length || 0} محفظة ذكية على ${network}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تحليل المحافظ الذكية: ${error}`);
      throw error;
    } finally {
      setSmartWalletsLoading(false);
    }
  };

  const getSmartWalletsFromDB = async (network?: string, limit?: number, minWinRate?: number) => {
    try {
      const result = await getSmartWalletsFromDB(network, limit, minWinRate);
      if (result.success) {
        setSmartWallets(result.data || []);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل جلب المحافظ الذكية: ${error}`);
      throw error;
    }
  };

  const analyzeTokenWithAI = async (params: {
    tokenAddress: string;
    network: string;
    symbol: string;
    name?: string;
    price?: number;
    liquidity?: number;
    volume24h?: number;
    priceChange24h?: number;
  }) => {
    try {
      const result = await analyzeTokenWithAI(params);
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تحليل العملة: ${error}`);
      throw error;
    }
  };

  const scanAllTokens = async (network: string, minCount: number = 3) => {
    setSmartWalletsLoading(true);
    try {
      const result = await scanAllTokens(network, minCount);
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل مسح جميع العملات: ${error}`);
      throw error;
    } finally {
      setSmartWalletsLoading(false);
    }
  };

  // ============================================================
  // BOT WALLETS (داخلية - مركزية)
  // ============================================================

  const loadBotWallets = async () => {
    if (isInitialized.current) {
      console.log('✅ المحافظ محملة مسبقاً، تخطي...');
      return;
    }

    try {
      console.log('🔄 جاري تحميل محافظ البوت...');
      const botWallet = BotWalletManager.getInstance();
      const networks = botConfig?.networks || ['solana'];
      
      for (const network of networks) {
        await botWallet.init(network);
      }
      
      const allWallets = botWallet.getAllWallets();
      setBotWallets(allWallets);
      isInitialized.current = true;
      console.log(`✅ تم تحميل ${allWallets.length} محفظة بوت`);
    } catch (error) {
      console.error('❌ فشل تحميل محافظ البوت:', error);
    }
  };

  const getBotWallet = (network: string): BotWalletData | null => {
    return botWallets.find(w => w.network === network) || null;
  };

  const refreshBotBalance = async (network: string): Promise<number> => {
    try {
      const botWallet = BotWalletManager.getInstance();
      return await botWallet.refreshBalance(network);
    } catch (error) {
      console.error('❌ فشل تحديث رصيد البوت:', error);
      return 0;
    }
  };

  // ============================================================
  // USER WALLETS (الفردية) - مع منع التكرار
  // ============================================================

  const loadUserWallets = async () => {
    if (!user) {
      console.log('⚠️ لا يوجد مستخدم، تخطي تحميل المحافظ');
      return;
    }
    
    if (isLoadingWallets.current) {
      console.log('⏳ جاري تحميل المحافظ بالفعل، تخطي...');
      return;
    }

    if (hasLoadedUserWallets.current) {
      console.log('✅ محافظ المستخدم محملة مسبقاً، تخطي...');
      return;
    }

    isLoadingWallets.current = true;
    
    try {
      console.log('🔄 جاري تحميل محافظ المستخدم...');
      const wallets = await AccountManager.getAllUserWallets(user.id);
      console.log(`📊 تم جلب ${wallets.length} محفظة من قاعدة البيانات`);
      setUserWallets(wallets);
      hasLoadedUserWallets.current = true;
      console.log(`✅ تم تحميل ${wallets.length} محفظة مستخدم`);
    } catch (error) {
      console.error('❌ فشل تحميل محافظ المستخدم:', error);
    } finally {
      isLoadingWallets.current = false;
    }
  };

  const getUserWallet = (network: string): UserWallet | null => {
    return userWallets.find(w => w.network === network) || null;
  };

  const createUserWallet = async (network: string): Promise<UserWallet> => {
    if (!user) throw new Error('المستخدم غير مسجل');
    const wallet = await AccountManager.createUserWallet(user.id, network);
    hasLoadedUserWallets.current = false;
    await loadUserWallets();
    return wallet;
  };

  const refreshUserBalance = async (network: string): Promise<number> => {
    if (!user) throw new Error('المستخدم غير مسجل');
    const balance = await AccountManager.getUserWalletBalance(user.id, network);
    hasLoadedUserWallets.current = false;
    await loadUserWallets();
    return balance;
  };

  // ============================================================
  // UPDATE BOT STATE
  // ============================================================

  const updateBotState = async (isRunning: boolean, networks?: string[]) => {
    try {
      const endpoint = isRunning ? '/start' : '/stop';
      const body = isRunning 
        ? JSON.stringify({ mode: 'normal-bot', networks: networks || botConfig?.networks || ['solana'] })
        : '{}';
      
      const res = await fetch(`${WORKER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      const data = await res.json();
      
      if (data.success) {
        setIsRunning(isRunning);
        
        if (networks) {
          await fetch(`${WORKER_URL}/networks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ networks }),
          });
          
          if (botConfig) {
            const updatedConfig = { ...botConfig, networks };
            await setBotConfig(updatedConfig);
          }
        }
        
        await addLog('INFO', `✅ تم ${isRunning ? 'تشغيل' : 'إيقاف'} البوت${networks ? ` على الشبكات: ${networks.join(', ')}` : ''}`);
      } else {
        await addLog('ERROR', `❌ فشل ${isRunning ? 'تشغيل' : 'إيقاف'} البوت: ${data.message}`);
      }
    } catch (error) {
      console.error('❌ فشل تحديث حالة البوت:', error);
      await addLog('ERROR', `❌ فشل تحديث حالة البوت: ${String(error)}`);
    }
  };

  // ============================================================
  // 🔥 دوال البوتات المتعددة (4 بوتات)
  // ============================================================

  const loadBotInstances = async (userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) {
      console.log('⚠️ لا يوجد userId لتحميل البوتات');
      setBotInstances([]);
      return;
    }

    if (isLoading) return;
    
    try {
      console.log('🔄 جاري تحميل البوتات للمستخدم:', uid);
      const bots = await getUserBots(uid);
      console.log('✅ تم تحميل البوتات:', bots);
      setBotInstances(Array.isArray(bots) ? bots : []);
    } catch (error) {
      console.error('❌ فشل تحميل البوتات:', error);
      setBotInstances([]);
    }
  };

  const createBot = async (type: 'hunter' | 'signal' | 'manual' | 'scalper', name: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await createBotInstance(uid, type, name);
      if (result.success) {
        hasLoadedBotInstances.current = false;
        await loadBotInstances(uid);
        await addLog('SUCCESS', `✅ تم إنشاء البوت ${name}`);
      } else {
        await addLog('ERROR', `❌ فشل إنشاء البوت: ${result.error}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل إنشاء البوت: ${error}`);
      throw error;
    }
  };

  const startBot = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await startBotInstance(botId, uid);
      if (result.success) {
        await loadBotInstances(uid);
        await addLog('SUCCESS', `▶️ تم تشغيل البوت`);
      } else {
        await addLog('ERROR', `❌ فشل تشغيل البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تشغيل البوت: ${error}`);
      throw error;
    }
  };

  const stopBot = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await stopBotInstance(botId, uid);
      if (result.success) {
        await loadBotInstances(uid);
        await addLog('INFO', `⏸️ تم إيقاف البوت`);
      } else {
        await addLog('ERROR', `❌ فشل إيقاف البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل إيقاف البوت: ${error}`);
      throw error;
    }
  };

  const deleteBot = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await deleteBotInstance(botId, uid);
      if (result.success) {
        hasLoadedBotInstances.current = false;
        await loadBotInstances(uid);
        await addLog('SUCCESS', `🗑️ تم حذف البوت`);
      } else {
        await addLog('ERROR', `❌ فشل حذف البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل حذف البوت: ${error}`);
      throw error;
    }
  };

  // ============================================================
  // 🔥 إنشاء محفظة للبوت (داخلية)
  // ============================================================
  
  const createWalletForBot = async (botId: string, network: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await createBotWallet(botId, uid, network);
      if (result.success) {
        await addLog('SUCCESS', `💰 تم إنشاء محفظة للبوت: ${result.address}`);
      } else {
        await addLog('ERROR', `❌ فشل إنشاء المحفظة: ${result.error}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل إنشاء المحفظة: ${error}`);
      throw error;
    }
  };

  const getBotWalletData = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) return null;
    return getBotWallet(botId, uid);
  };

  const updateBotConfig = async (botId: string, data: any, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await updateBotConfigRemote(botId, uid, data);
      
      if (result.success) {
        await loadBotInstances(uid);
        await addLog('SUCCESS', `✅ تم تحديث إعدادات البوت`);
      } else {
        await addLog('ERROR', `❌ فشل تحديث الإعدادات: ${result.error}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تحديث الإعدادات: ${error}`);
      throw error;
    }
  };

  const executeTrade = async (params: {
    botId: string;
    side: 'buy' | 'sell';
    tokenAddress: string;
    amountUsd: number;
    tokenSymbol: string;
    network: string;
    userId?: string;
  }) => {
    const uid = params.userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    return executeTradeWithBotWallet({ ...params, userId: uid });
  };

  // ============================================================
  // دوال LOAD الأساسية
  // ============================================================

  const loadWallet = async (address: string) => {
    setIsLoading(true);
    try {
      const result = await getWallet(address);
      if (result.success && result.data && result.data.length > 0) {
        setWallet(result.data[0]);
      }
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWallet = async (network: string): Promise<WalletData> => {
    const newWallet: WalletData = {
      address: `0x${generateId()}${generateId()}`,
      encryptedPrivateKey: `encrypted_${generateId()}`,
      network,
      balance: 0,
      createdAt: getTimestamp(),
    };
    
    await saveWallet(newWallet);
    setWallet(newWallet);
    return newWallet;
  };

  const loadBotConfig = async () => {
    setIsLoading(true);
    try {
      const result = await getBotConfig();
      if (result.success && result.data && result.data.length > 0) {
        setBotConfigState(result.data[0]);
      } else {
        const newConfig = { ...defaultBotConfig, id: generateId() };
        await saveBotConfig(newConfig);
        setBotConfigState(newConfig);
      }
    } catch (error) {
      console.error('Failed to load bot config:', error);
      setBotConfigState(defaultBotConfig);
    } finally {
      setIsLoading(false);
    }
  };

  const setBotConfig = async (config: BotConfigData) => {
    setIsLoading(true);
    try {
      const id = config.id || generateId();
      const configToSave = { ...config, id };
      await saveBotConfig(configToSave);
      setBotConfigState(configToSave);
    } catch (error) {
      console.error('Failed to save bot config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrades = async (filters?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const result = await getTrades(filters);
      if (result.success && result.data) {
        setTrades(result.data);
      }
    } catch (error) {
      console.error('Failed to load trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTrade = async (trade: TradeData) => {
    const tradeWithId = { ...trade, id: trade.id || generateId() };
    await saveTrade(tradeWithId);
    setTrades(prev => [tradeWithId, ...prev]);
  };

  const loadAnalyses = async (filters?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const result = await getAnalyses(filters);
      if (result.success && result.data) {
        setAnalyses(result.data);
      }
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addAnalysis = async (analysis: AnalysisData) => {
    const analysisWithId = { ...analysis, id: analysis.id || generateId() };
    await saveAnalysis(analysisWithId);
    setAnalyses(prev => [analysisWithId, ...prev]);
  };

  const loadDiscoveredTokens = async (filters?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const result = await getDiscoveredTokens(filters);
      if (result.success && result.data) {
        setDiscoveredTokens(result.data);
      }
    } catch (error) {
      console.error('Failed to load discovered tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addDiscoveredToken = async (token: DiscoveredTokenData) => {
    const tokenWithId = { ...token, id: token.id || generateId() };
    await saveDiscoveredToken(tokenWithId);
    setDiscoveredTokens(prev => [tokenWithId, ...prev]);
  };

  const loadLogs = async (filters?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const result = await getLogs(filters);
      if (result.success && result.data) {
        setLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addLog = async (level: LogData['level'], message: string, context?: Record<string, any>) => {
    const log: LogData = {
      id: generateId(),
      level,
      message,
      timestamp: getTimestamp(),
      context,
    };
    await saveLog(log);
    setLogs(prev => [log, ...prev]);
  };

  // ============================================================
  // USER STATS & TRANSACTIONS
  // ============================================================

  const loadUserStats = async () => {
    if (!user) return;
    try {
      const stats = await AccountManager.getUserStats(user.id);
      setUserStats(stats);
    } catch (error) {
      console.error('❌ فشل تحميل إحصائيات المستخدم:', error);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    try {
      const txs = await AccountManager.getTransactions(user.id);
      setTransactions(txs);
    } catch (error) {
      console.error('❌ فشل تحميل المعاملات:', error);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    await AccountManager.addTransaction(transaction);
    await loadTransactions();
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    setUserWallets([]);
    setUserStats(null);
    setTransactions([]);
    setBotInstances([]);
    setSmartWallets([]);
    setSmartWalletStats(null);
    hasLoadedUserWallets.current = false;
    hasLoadedBotInstances.current = false;
    disconnectWallet();
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // ============================================================
  // EFFECTS - محسّنة لمنع التكرار
  // ============================================================

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setIsAdmin(parsed.isAdmin || false);
        setCurrentUserId(parsed.id || '');
      } catch {
        localStorage.removeItem('user');
      }
    }

    loadBotConfig();
    loadTrades();
    loadAnalyses();
    loadDiscoveredTokens();
    loadLogs();
  }, []);

  useEffect(() => {
    if (botConfig && !hasLoadedWallets.current) {
      hasLoadedWallets.current = true;
      loadBotWallets();
    }
  }, [botConfig]);

  // ✅ محسّن: تحميل محافظ المستخدم عند تغيير user.id فقط
  useEffect(() => {
    if (user) {
      hasLoadedUserWallets.current = false;
      isLoadingWallets.current = false;
      loadUserWallets();
      loadUserStats();
      loadTransactions();
    }
  }, [user?.id]); // ← استخدم user.id بدلاً من user

  useEffect(() => {
    if (user?.id && !hasLoadedBotInstances.current) {
      hasLoadedBotInstances.current = true;
      setCurrentUserId(user.id);
      loadBotInstances(user.id);
    } else if (!user) {
      setBotInstances([]);
      hasLoadedBotInstances.current = false;
    }
  }, [user?.id]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: AppContextType = {
    // الأساسيات
    wallet,
    setWallet,
    loadWallet,
    createWallet,
    
    // المحافظ المتعددة (خارجية)
    walletProviders,
    activeWallet,
    walletAddress,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    getWalletBalance,
    walletNetwork,
    signTransaction,
    
    // محافظ البوت المركزية (داخلية)
    botWallets,
    loadBotWallets,
    getBotWallet,
    refreshBotBalance,
    
    // محافظ المستخدم (الفردية)
    userWallets,
    loadUserWallets,
    createUserWallet,
    refreshUserBalance,
    getUserWallet,
    
    // 🔥 المحافظ الذكية (جديدة)
    smartWallets,
    smartWalletStats,
    scanSmartWallets,
    getSmartWalletsFromDB,
    analyzeTokenWithAI,
    scanAllTokens,
    smartWalletsLoading,
    
    // Bot Config
    botConfig,
    setBotConfig,
    loadBotConfig,
    
    // Trades
    trades,
    loadTrades,
    addTrade,
    
    // Analyses
    analyses,
    loadAnalyses,
    addAnalysis,
    
    // Discovered Tokens
    discoveredTokens,
    loadDiscoveredTokens,
    addDiscoveredToken,
    
    // Logs
    logs,
    loadLogs,
    addLog,
    
    // Loading & Running
    isLoading,
    setIsLoading,
    isRunning,
    setIsRunning,
    updateBotState,
    
    // User
    user,
    setUser,
    isAdmin,
    setIsAdmin,
    logout,
    
    // Stats & Transactions
    userStats,
    loadUserStats,
    transactions,
    loadTransactions,
    addTransaction,

    // ============================================================
    // 🔥 البوتات المتعددة (4 بوتات)
    // ============================================================
    botInstances,
    loadBotInstances,
    createBot,
    startBot,
    stopBot,
    deleteBot,
    createWalletForBot,
    getBotWalletData,
    updateBotConfig,
    executeTrade,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============================================================
// HOOK
// ============================================================

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}