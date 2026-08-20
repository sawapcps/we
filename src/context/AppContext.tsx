// src/context/AppContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
} from '../lib/madarTech';
import { BotWalletManager, BotWalletData } from '../lib/wallet';

// ============ TYPES ============

interface AppContextType {
  // Wallet
  wallet: WalletData | null;
  setWallet: (wallet: WalletData | null) => void;
  loadWallet: (address: string) => Promise<void>;
  createWallet: (network: string) => Promise<WalletData>;
  
  // ✅ محافظ متعددة
  botWallets: BotWalletData[];
  loadBotWallets: () => Promise<void>;
  getBotWallet: (network: string) => BotWalletData | null;
  refreshBotBalance: (network: string) => Promise<number>;

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
  
  // ✅ تحديث حالة البوت (جديد)
  updateBotState: (isRunning: boolean, networks?: string[]) => Promise<void>;
  
  // User
  user: any;
  setUser: (user: any) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
}

// ============ DEFAULT VALUES ============

const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

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

// ============ PROVIDER ============

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // State
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [botWallets, setBotWallets] = useState<BotWalletData[]>([]);
  const [botConfig, setBotConfigState] = useState<BotConfigData | null>(null);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisData[]>([]);
  const [discoveredTokens, setDiscoveredTokens] = useState<DiscoveredTokenData[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ============ BOT WALLETS ============

  const loadBotWallets = async () => {
    try {
      const botWallet = BotWalletManager.getInstance();
      const networks = botConfig?.networks || ['solana'];
      for (const network of networks) {
        await botWallet.init(network);
      }
      const allWallets = botWallet.getAllWallets();
      setBotWallets(allWallets);
    } catch (error) {
      console.error('❌ فشل تحميل المحافظ:', error);
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
      console.error('❌ فشل تحديث الرصيد:', error);
      return 0;
    }
  };

  // ============ UPDATE BOT STATE (✅ جديد) ============

  const updateBotState = async (isRunning: boolean, networks?: string[]) => {
    try {
      // ✅ تحديث الحالة في الـ Worker
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
        
        // ✅ إذا كانت هناك شبكات جديدة، احفظها
        if (networks) {
          // حفظ الشبكات في D1
          await fetch(`${WORKER_URL}/networks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ networks }),
          });
          
          // تحديث botConfig
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

  // ============ LOAD FUNCTIONS ============

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

  // ============ LOGOUT ============

  const logout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // ============ INITIAL LOAD ============

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setIsAdmin(parsed.isAdmin || false);
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

  // ✅ تحميل المحافظ بعد تحميل الإعدادات
  useEffect(() => {
    if (botConfig) {
      loadBotWallets();
    }
  }, [botConfig]);

  // ============ CONTEXT VALUE ============

  const value: AppContextType = {
    wallet,
    setWallet,
    loadWallet,
    createWallet,
    botWallets,
    loadBotWallets,
    getBotWallet,
    refreshBotBalance,
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
    updateBotState, // ✅ جديد
    user,
    setUser,
    isAdmin,
    setIsAdmin,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ============ HOOK ============

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}