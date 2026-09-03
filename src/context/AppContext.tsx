// src/context/AppContext.tsx
// ============================================================
// سياق التطبيق الرئيسي - يدعم 4 بوتات + محافظ متعددة (داخلية وخارجية) + المحافظ الذكية + بوت الأخبار
// ============================================================
import { TradingBot } from '../lib/botEngine';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
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
// WORKER URL
// ============================================================
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

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

export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: string;
}

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
    feePercentage: number;
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
  createBot: (type: 'hunter' | 'signal' | 'manual' | 'scalper', name: string, userId?: string, tradingAmount?: number) => Promise<void>;
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
  
  // ⏱️ التحكم بالمسح (يدوي/تلقائي) - إضافة جديدة
  runManualScan: (botId: string) => Promise<{ success: boolean; message: string }>;
  startAutoScan: (botId: string) => void;
  stopAutoScan: (botId: string) => void;
  setScanInterval: (botId: string, minutes: number) => void;
  getAutoScanStatus: (botId: string) => { active: boolean; interval: number };
  
  // ✅ الإشعارات
  notifications: Notification[];
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => Promise<void>;
  
  // ✅ دوال التحويل بين المحافظ (جديدة)
  transferToBot: (botId: string, amount: number, network: string) => Promise<{ success: boolean; message: string }>;
  transferFromBot: (botId: string, amount: number, network: string) => Promise<{ success: boolean; message: string }>;

  // ============================================================
  // 📰 بوت الأخبار (NEWS BOT) - البوت الخامس
  // ============================================================
  newsBotEnabled: boolean;
  newsSignals: any[];
  newsAlerts: any[];
  addNewsSignal: (signal: any) => void;
  addNewsAlert: (alert: any) => void;
  toggleNewsBot: () => void;
  setNewsBotEnabled: (enabled: boolean) => void;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ============================================================
  // 📰 بوت الأخبار (NEWS BOT)
  // ============================================================
  const [newsBotEnabled, setNewsBotEnabled] = useState(false);
  const [newsSignals, setNewsSignals] = useState<any[]>([]);
  const [newsAlerts, setNewsAlerts] = useState<any[]>([]);

  // ✅ استرجاع الإشعارات المحفوظة
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
        try {
            setNotifications(JSON.parse(saved));
        } catch {}
    }
  }, []);

  // ✅✅✅ دالة إضافة الإشعارات
  const addNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = generateId();
    const newNotification = { id, type, message, timestamp: getTimestamp() };
    
    setNotifications(prev => {
        const updated = [...prev, newNotification];
        localStorage.setItem('notifications', JSON.stringify(updated));
        return updated;
    });
  }, []);

  // ✅✅✅ دالة إضافة السجلات (addLog)
  const addLog = useCallback(async (level: LogData['level'], message: string, context?: Record<string, any>) => {
    const log: LogData = {
      id: generateId(),
      level,
      message,
      timestamp: getTimestamp(),
      context,
    };
    await saveLog(log);
    setLogs(prev => [log, ...prev]);
  }, []);

  // ✅✅✅ دالة حذف الإشعارات
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ✅ مسح كل الإشعارات من قاعدة البيانات
  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${WORKER_URL}/notifications/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: 'hunter',
          userId: user?.id
        })
      });
      const result = await response.json();
      if (result.success) {
        setNotifications([]);
        localStorage.setItem('notifications', JSON.stringify([]));
        await addLog('SUCCESS', '🗑️ تم مسح جميع الإشعارات');
      }
    } catch (error) {
      console.error('❌ فشل مسح الإشعارات:', error);
    }
  }, [user?.id, addLog]);

  // ✅ دوال بوت الأخبار
  const addNewsSignal = useCallback((signal: any) => {
    setNewsSignals(prev => [signal, ...prev].slice(0, 50));
  }, []);

  const addNewsAlert = useCallback((alert: any) => {
    setNewsAlerts(prev => [alert, ...prev].slice(0, 50));
  }, []);

  const toggleNewsBot = useCallback(() => {
    setNewsBotEnabled(prev => !prev);
  }, []);

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
  const botInstancesRef = useRef<Map<string, TradingBot>>(new Map());

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
      
      const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];
      
      let networks: string[] = ['solana'];
      try {
          if (typeof botConfig?.networks === 'string') {
              const parsed = JSON.parse(botConfig.networks);
              if (Array.isArray(parsed)) networks = parsed;
          } else if (Array.isArray(botConfig?.networks)) {
              networks = botConfig.networks;
          }
      } catch {
          networks = ['solana'];
      }
      
      const validNetworks = networks.filter(n => VALID_NETWORKS.includes(n));
      console.log('🌐 الشبكات الصالحة:', validNetworks);
      
      for (const network of validNetworks) {
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

  // ============================================================
  // 🔥 ربط محافظ المستخدم بالبوت تلقائياً (جديد)
  // ============================================================

  const autoLinkUserWalletsToBot = async (botId: string, userId: string) => {
    try {
      console.log(`🔗 ربط محافظ المستخدم ${userId} بالبوت ${botId}`);
      
      const userWalletsList = await AccountManager.getAllUserWallets(userId);
      
      if (userWalletsList.length === 0) {
        console.log('⚠️ لا توجد محافظ للمستخدم، تخطي الربط');
        return;
      }

      console.log(`📊 عدد محافظ المستخدم: ${userWalletsList.length}`);

      for (const wallet of userWalletsList) {
        try {
          const result = await createBotWallet(
            botId,
            userId,
            wallet.network,
            wallet.address,
            wallet.encryptedPrivateKey
          );
          if (result.success) {
            console.log(`✅ تم ربط محفظة ${wallet.network} بالبوت ${botId}`);
            await addLog('SUCCESS', `💰 تم ربط محفظة ${wallet.network} بالبوت`);
          } else {
            console.warn(`⚠️ فشل ربط محفظة ${wallet.network}:`, result.error);
          }
        } catch (error) {
          console.warn(`⚠️ فشل ربط محفظة ${wallet.network}:`, error);
        }
      }
      
      await loadBotWallets();
      console.log('✅ تم تحديث محافظ البوت بعد الربط');
      
    } catch (error) {
      console.error('❌ فشل ربط المحافظ بالبوت:', error);
    }
  };

  // ✅ createBot - معدل لدعم tradingAmount
const createBot = async (
  type: 'hunter' | 'signal' | 'manual' | 'scalper',
  name: string,
  userId?: string,
  tradingAmount: number = 100,
  walletId?: string // ✅ معامل جديد
) => {
  const uid = userId || currentUserId || user?.id;
  if (!uid) throw new Error('لا يوجد userId');
  
  try {
    const result = await createBotInstance(uid, type, name, tradingAmount);
    if (result.success) {
      const botId = result.botId!;
      
      // ✅ إذا كان هناك walletId محدد، اربطه بالبوت
      if (walletId) {
        const wallet = userWallets.find(w => w.id === walletId);
        if (wallet) {
          await createBotWallet(botId, uid, wallet.network, wallet.address, wallet.encryptedPrivateKey);
          await addLog('SUCCESS', `🔗 تم ربط المحفظة ${wallet.address.slice(0, 8)}... بالبوت`);
        }
      } else {
        // ✅ السلوك القديم: ربط محافظ المستخدم تلقائياً
        await autoLinkUserWalletsToBot(botId, uid);
      }
      
      hasLoadedBotInstances.current = false;
      await loadBotInstances(uid);
      await addLog('SUCCESS', `✅ تم إنشاء البوت ${name} بمبلغ $${tradingAmount}`);
      addNotification('success', `✅ تم إنشاء البوت ${name} بمبلغ $${tradingAmount}`);
    }
    return result;
  } catch (error) {
    await addLog('ERROR', `❌ فشل إنشاء البوت: ${error}`);
    addNotification('error', `❌ فشل إنشاء البوت`);
    throw error;
  }
};

  const startBot = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');

    try {
      const result = await startBotInstance(botId, uid);
      if (result.success) {
        // ✅ إنشاء البوت الفعلي
        const botData = await getUserBots(uid).then(bots => bots.find(b => b.id === botId));
        if (botData) {
          const config = {
            mode: botData.mode || 'auto',
            networks: JSON.parse(botData.networks || '["solana"]'),
            tradingAmount: botData.trading_amount || 100,
            maxPositionUsd: botData.max_position_size || 100,
            takeProfitPct: botData.take_profit || 30,
            stopLossPct: botData.stop_loss || 10,
            minLiquidityUsd: 50000,
            minVolume24h: 100000,
            minPriceChange24h: 0,
            maxTradesPerDay: 10,
            tradeIntervalSec: 5,
            aiAssist: true,
            status: 'running',
            password: '',
          };
          
          // ✅ إنشاء كائن البوت
          const bot = new TradingBot(
            config,
            uid,
            (log) => console.log('[BOT LOG]', log),
            (trade) => console.log('[BOT TRADE]', trade),
            botId
          );
          
          // ✅ تشغيل البوت
          bot.start();
          
          // ✅ تخزين مرجع البوت
          botInstancesRef.current.set(botId, bot);
          console.log(`✅ TradingBot started for ${botId}`);
        }

        await loadBotInstances(uid);
        await addLog('SUCCESS', `▶️ تم تشغيل البوت`);
        addNotification('success', `▶️ تم تشغيل البوت بنجاح`);
      } else {
        await addLog('ERROR', `❌ فشل تشغيل البوت: ${result.message}`);
        addNotification('error', `❌ فشل تشغيل البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تشغيل البوت: ${error}`);
      addNotification('error', `❌ فشل تشغيل البوت`);
      throw error;
    }
  };

  const stopBot = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');

    try {
      // ✅ إيقاف البوت الفعلي (TradingBot)
      const bot = botInstancesRef.current.get(botId);
      if (bot) {
        bot.stop();
        botInstancesRef.current.delete(botId);
        console.log(`⏹️ TradingBot stopped for ${botId}`);
      }

      const result = await stopBotInstance(botId, uid);
      if (result.success) {
        await loadBotInstances(uid);
        await addLog('INFO', `⏸️ تم إيقاف البوت`);
        addNotification('warning', `⏸️ تم إيقاف البوت`);
      } else {
        await addLog('ERROR', `❌ فشل إيقاف البوت: ${result.message}`);
        addNotification('error', `❌ فشل إيقاف البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل إيقاف البوت: ${error}`);
      addNotification('error', `❌ فشل إيقاف البوت`);
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
        addNotification('success', `🗑️ تم حذف البوت`);
      } else {
        await addLog('ERROR', `❌ فشل حذف البوت: ${result.message}`);
        addNotification('error', `❌ فشل حذف البوت: ${result.message}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل حذف البوت: ${error}`);
      addNotification('error', `❌ فشل حذف البوت`);
      throw error;
    }
  };

  // ============================================================
  // 🔥 إنشاء محفظة للبوت (معدل - يستخدم محفظة المستخدم)
  // ============================================================
  const createWalletForBot = async (botId: string, network: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');

    // ✅ فحص: هل المحفظة موجودة مسبقاً للبوت؟
    const existingWallet = await getBotWallet(botId, uid);
    if (existingWallet && existingWallet.network === network) {
      console.log(`✅ محفظة ${network} موجودة مسبقاً للبوت`);
      await addLog('SUCCESS', `✅ محفظة ${network} موجودة مسبقاً`);
      addNotification('success', `✅ محفظة ${network} موجودة مسبقاً`);
      return { success: true, data: existingWallet };
    }

    // 🔍 البحث عن محفظة المستخدم
    let userWallet = userWallets.find(w => w.network === network);
    
    // ✅ إذا لم توجد - أنشئها للمستخدم فقط (بدون ربط بالبوت)
    if (!userWallet) {
      console.log(`⚠️ لا توجد محفظة ${network} - جاري إنشائها...`);
      userWallet = await AccountManager.createUserWallet(uid, network);
      hasLoadedUserWallets.current = false;
      await loadUserWallets();
      addNotification('success', `💰 تم إنشاء محفظة ${network} جديدة`);
    }

    try {
      // ✅ ربط المحفظة بالبوت (هنا فقط يتم الربط)
      const result = await createBotWallet(botId, uid, network, userWallet.address, userWallet.encryptedPrivateKey);
      if (result.success) {
        await addLog('SUCCESS', `💰 تم ربط محفظة ${network} بالبوت`);
        addNotification('success', `💰 تم ربط محفظة ${network} بالبوت`);
      } else {
        await addLog('ERROR', `❌ فشل ربط المحفظة: ${result.error}`);
        addNotification('error', `❌ فشل ربط المحفظة: ${result.error}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل ربط المحفظة: ${error}`);
      addNotification('error', `❌ فشل ربط المحفظة`);
      throw error;
    }
  };

  const getBotWalletData = async (botId: string, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) return null;
    return getBotWallet(botId, uid);
  };

  // ✅ updateBotConfig - معدل لدعم الشبكات
  const updateBotConfig = async (botId: string, data: any, userId?: string) => {
    const uid = userId || currentUserId || user?.id;
    if (!uid) throw new Error('لا يوجد userId');
    
    try {
      const result = await updateBotConfigRemote(botId, uid, data);
      
      if (result.success) {
        if (data.networks && Array.isArray(data.networks) && data.networks.length > 0) {
          const networkResponse = await fetch(`${WORKER_URL}/bots/${botId}/networks?userId=${uid}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ networks: data.networks }),
          });
          const networkResult = await networkResponse.json();
          if (!networkResult.success) {
            await addLog('WARNING', `⚠️ تم تحديث الإعدادات ولكن فشل تحديث الشبكات: ${networkResult.error}`);
            addNotification('warning', `⚠️ فشل تحديث الشبكات`);
          } else {
            await addLog('SUCCESS', `✅ تم تحديث الشبكة إلى ${data.networks.join(', ')}`);
            addNotification('success', `✅ تم تحديث الشبكة إلى ${data.networks.join(', ')}`);
          }
        }
        
        await loadBotInstances(uid);
        await addLog('SUCCESS', `✅ تم تحديث إعدادات البوت`);
        addNotification('success', `✅ تم تحديث إعدادات البوت`);
      } else {
        await addLog('ERROR', `❌ فشل تحديث الإعدادات: ${result.error}`);
        addNotification('error', `❌ فشل تحديث الإعدادات: ${result.error}`);
      }
      return result;
    } catch (error) {
      await addLog('ERROR', `❌ فشل تحديث الإعدادات: ${error}`);
      addNotification('error', `❌ فشل تحديث الإعدادات`);
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
    
    const result = await executeTradeWithBotWallet({ ...params, userId: uid });
    
    if (!result.success) {
      addNotification('error', `❌ فشل ${params.side === 'buy' ? 'شراء' : 'بيع'} ${params.tokenSymbol}: ${result.error}`);
    } else {
      addNotification('success', `✅ تم ${params.side === 'buy' ? 'شراء' : 'بيع'} ${params.tokenSymbol} بمبلغ $${params.amountUsd}`);
    }
    
    return result;
  };

  // ============================================================
  // ⏱️ التحكم بالمسح (يدوي/تلقائي) - إضافة جديدة
  // ============================================================

  const runManualScan = async (botId: string): Promise<{ success: boolean; message: string }> => {
    const bot = botInstancesRef.current.get(botId);
    if (!bot) {
      return { success: false, message: '❌ البوت غير موجود أو غير نشط' };
    }
    try {
      return await bot.runManualScan();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'خطأ غير معروف';
      return { success: false, message: `❌ فشل المسح: ${errorMsg}` };
    }
  };

  const startAutoScan = (botId: string) => {
    const bot = botInstancesRef.current.get(botId);
    if (bot) bot.startAutoScan();
  };

  const stopAutoScan = (botId: string) => {
    const bot = botInstancesRef.current.get(botId);
    if (bot) bot.stopAutoScan();
  };

  const setScanInterval = (botId: string, minutes: number) => {
    const bot = botInstancesRef.current.get(botId);
    if (bot) bot.setScanInterval(minutes);
  };

  const getAutoScanStatus = (botId: string) => {
    const bot = botInstancesRef.current.get(botId);
    if (bot) {
      return bot.getAutoScanStatus();
    }
    return { active: false, interval: 5 };
  };

  // ============================================================
  // ✅ دوال التحويل بين المحافظ (جديدة)
  // ============================================================

  const transferToBot = async (botId: string, amount: number, network: string) => {
    if (!user) return { success: false, message: 'المستخدم غير موجود' };
    
    try {
      const response = await fetch(`${WORKER_URL}/bots/${botId}/transfer-to-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount, network }),
      });
      const result = await response.json();
      
      if (result.success) {
        await loadUserWallets();
        await loadUserStats();
        await addLog('SUCCESS', `✅ تحويل ${amount} من ${network} إلى البوت`);
      }
      
      return result;
    } catch (error) {
      return { success: false, message: String(error) };
    }
  };

  const transferFromBot = async (botId: string, amount: number, network: string) => {
    if (!user) return { success: false, message: 'المستخدم غير موجود' };
    
    try {
      const response = await fetch(`${WORKER_URL}/bots/${botId}/transfer-to-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount, network }),
      });
      const result = await response.json();
      
      if (result.success) {
        await loadUserWallets();
        await loadUserStats();
        await addLog('SUCCESS', `✅ سحب ${amount} من البوت إلى ${network}`);
      }
      
      return result;
    } catch (error) {
      return { success: false, message: String(error) };
    }
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
        setBotConfigState(defaultBotConfig);
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

  useEffect(() => {
    if (user) {
      hasLoadedUserWallets.current = false;
      isLoadingWallets.current = false;
      loadUserWallets();
      loadUserStats();
      loadTransactions();
    }
  }, [user?.id]);

  useEffect(() => {
    console.log('🔍 useEffect user.id changed:', user?.id);
    
    if (user?.id) {
      console.log('🔄 جاري تحميل البوتات للمستخدم:', user.id);
      setCurrentUserId(user.id);
      hasLoadedBotInstances.current = false;
      loadBotInstances(user.id);
    } else {
      console.log('❌ لا يوجد مستخدم، إعادة تعيين البوتات');
      setBotInstances([]);
      hasLoadedBotInstances.current = false;
    }
  }, [user?.id]);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const value: AppContextType = {
    wallet,
    setWallet,
    loadWallet,
    createWallet,
    
    walletProviders,
    activeWallet,
    walletAddress,
    isWalletConnected,
    connectWallet,
    disconnectWallet,
    getWalletBalance,
    walletNetwork,
    signTransaction,
    
    botWallets,
    loadBotWallets,
    getBotWallet,
    refreshBotBalance,
    
    userWallets,
    loadUserWallets,
    createUserWallet,
    refreshUserBalance,
    getUserWallet,
    
    smartWallets,
    smartWalletStats,
    scanSmartWallets,
    getSmartWalletsFromDB,
    analyzeTokenWithAI,
    scanAllTokens,
    smartWalletsLoading,
    
    botConfig,
    setBotConfig,
    loadBotConfig,
    
    trades,
    loadTrades,
    addTrade,
    
    analyses,
    loadAnalyses,
    addAnalysis,
    
    discoveredTokens,
    loadDiscoveredTokens,
    addDiscoveredToken,
    
    logs,
    loadLogs,
    addLog,
    
    isLoading,
    setIsLoading,
    isRunning,
    setIsRunning,
    updateBotState,
    
    user,
    setUser,
    isAdmin,
    setIsAdmin,
    logout,
    
    userStats,
    loadUserStats,
    transactions,
    loadTransactions,
    addTransaction,

    // ============================================================
    // 🔥 البوتات المتعددة + التحكم بالمسح
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

    // ⏱️ التحكم بالمسح (يدوي/تلقائي)
    runManualScan,
    startAutoScan,
    stopAutoScan,
    setScanInterval,
    getAutoScanStatus,

    // ✅ دوال التحويل
    transferToBot,
    transferFromBot,
    
    // ✅ الإشعارات
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,

    // 📰 بوت الأخبار (NEWS BOT)
    newsBotEnabled,
    newsSignals,
    newsAlerts,
    addNewsSignal,
    addNewsAlert,
    toggleNewsBot,
    setNewsBotEnabled,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ✅✅✅ أضف هذا بعد القفل مباشرة:
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}