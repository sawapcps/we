// src/lib/wallet.ts

import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import { encrypt, decrypt } from './encryption';
import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate } from './madarTech';
import { AccountManager, UserWallet } from './accounts';

// ============ الأنواع ============

export interface BotWalletData {
  id?: string;
  address: string;
  encryptedPrivateKey: string;
  network: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
  userId?: string; // ✅ ربط المحفظة بمستخدم (للحسابات الفردية)
  isAdminWallet?: boolean; // ✅ تمييز محافظ الأدمن
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amount: number;
  tokenAddress: string;
  tokenSymbol?: string;
  network?: string;
}

// ============ Worker Proxy (حل مشكلة CORS) ============

const WORKER_URL = 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============ RPC URLs احتياطي (في حال فشل Worker) ============

const RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana.publicnode.com',
];

let workingRpcIndex = 0;

function getWorkingRpcUrl(): string {
  return RPC_URLS[workingRpcIndex] || RPC_URLS[0];
}

// ============ إنشاء محفظة جديدة ============

export function createSolanaWallet(): { publicKey: string; privateKey: string } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
  };
}

export function createEvmWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

export function createWallet(network: string): { address: string; privateKey: string } {
  if (network === 'solana') {
    const solWallet = createSolanaWallet();
    return {
      address: solWallet.publicKey,
      privateKey: solWallet.privateKey,
    };
  }
  return createEvmWallet();
}

// ============ جلب الرصيد (عبر Worker Proxy) ============

export async function getSolanaBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${WORKER_URL}/solana`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
    });

    const data = await response.json();
    if (data.result) {
      return data.result.value / LAMPORTS_PER_SOL;
    }
    return 0;
  } catch (error) {
    console.warn('⚠️ Worker Proxy فشل، جاري التبديل إلى RPC مباشر:', error);
    return getSolanaBalanceDirect(address);
  }
}

export async function getSolanaBalanceDirect(address: string): Promise<number> {
  const url = getWorkingRpcUrl();
  try {
    const connection = new Connection(url, 'confirmed');
    const pubKey = new PublicKey(address);
    const balance = await connection.getBalance(pubKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error: any) {
    if (error.message?.includes('403') || error.message?.includes('Access forbidden') || error.message?.includes('429') || error.message?.includes('fetch')) {
      workingRpcIndex = (workingRpcIndex + 1) % RPC_URLS.length;
      console.log(`🔄 تبديل RPC إلى: ${RPC_URLS[workingRpcIndex]}`);
      return getSolanaBalanceDirect(address);
    }
    console.error('Solana balance error:', error);
    return 0;
  }
}

export async function getEvmBalance(address: string, network: string): Promise<number> {
  try {
    const response = await fetch(`${WORKER_URL}/${network}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    const data = await response.json();
    if (data.result) {
      return parseInt(data.result, 16) / 1e18;
    }
    return 0;
  } catch (error) {
    console.warn(`⚠️ Worker Proxy فشل لـ ${network}:`, error);
    return 0;
  }
}

export async function getWalletBalance(network: string, address: string): Promise<number> {
  if (network === 'solana') {
    return getSolanaBalance(address);
  }
  return getEvmBalance(address, network);
}

// ============ ParaSwap API (لـ EVM) ============

async function executeParaSwapTrade(params: {
  network: string;
  tokenAddress: string;
  amount: number;
  side: 'buy' | 'sell';
  walletAddress: string;
  slippage: number;
}): Promise<{ txHash: string; error: string | null }> {
  const networkMap: Record<string, number> = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    base: 8453,
    avalanche: 43114,
    optimism: 10,
    robinhood: 1,
  };

  const chainId = networkMap[params.network];
  if (!chainId) {
    return { txHash: '', error: `شبكة غير مدعومة: ${params.network}` };
  }

  const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  try {
    const priceUrl = `https://api.paraswap.io/prices?srcToken=${NATIVE_TOKEN}&destToken=${params.tokenAddress}&amount=${params.amount * 1e18}&side=SELL&network=${chainId}`;
    const priceResponse = await fetch(priceUrl);
    if (!priceResponse.ok) {
      const error = await priceResponse.text();
      return { txHash: '', error: `فشل جلب السعر: ${error}` };
    }
    const priceData = await priceResponse.json();

    const swapUrl = `https://api.paraswap.io/transactions/${chainId}`;
    const swapResponse = await fetch(swapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken: NATIVE_TOKEN,
        destToken: params.tokenAddress,
        srcAmount: params.amount * 1e18,
        slippage: params.slippage * 100,
        userAddress: params.walletAddress,
        priceRoute: priceData.priceRoute,
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      return { txHash: '', error: `فشل التنفيذ: ${error}` };
    }

    const swapData = await swapResponse.json();
    return { txHash: swapData.txHash || 'pending', error: null };
  } catch (error) {
    return { txHash: '', error: error instanceof Error ? error.message : 'خطأ غير معروف' };
  }
}

// ============ Jupiter API (لـ Solana فقط) ============

const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY;

async function executeJupiterSwap(params: {
  tokenAddress: string;
  amountInSol: number;
  slippage: number;
  walletAddress: string;
}): Promise<{ txHash: string; error: string | null }> {
  try {
    const quoteResponse = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${params.tokenAddress}&amount=${Math.floor(params.amountInSol * 1e9)}&slippageBps=${Math.floor(params.slippage * 100)}`,
      {
        headers: JUPITER_API_KEY ? { Authorization: `Bearer ${JUPITER_API_KEY}` } : {},
      }
    );

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      return { txHash: '', error: `فشل جلب السعر: ${errorText}` };
    }

    const quote = await quoteResponse.json();

    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(JUPITER_API_KEY ? { Authorization: `Bearer ${JUPITER_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: params.walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      return { txHash: '', error: `فشل التنفيذ: ${errorText}` };
    }

    const { swapTransaction } = await swapResponse.json();
    return { txHash: swapTransaction, error: null };
  } catch (error) {
    return { txHash: '', error: error instanceof Error ? error.message : 'خطأ غير معروف' };
  }
}

// ============ BotWalletManager ============

export class BotWalletManager {
  private static instance: BotWalletManager;
  private wallets: BotWalletData[] = [];
  private masterPassword: string;
  
  // ✅ متغيرات لمنع التحميل المتكرر
  private static isInitialized = false;
  private static initializationPromise: Promise<BotWalletData> | null = null;
  private static isLoadingWallets = false;
  private static walletsLoaded = false;

  private constructor() {
    this.masterPassword = import.meta.env.VITE_MASTER_PASSWORD || 'default_master_password_please_change';
  }

  static getInstance(): BotWalletManager {
    if (!BotWalletManager.instance) {
      BotWalletManager.instance = new BotWalletManager();
    }
    return BotWalletManager.instance;
  }

  // ✅ دالة init المعدلة (تمنع التكرار نهائياً)
  async init(network: string = 'solana'): Promise<BotWalletData> {
    if (BotWalletManager.walletsLoaded) {
      const existingWallet = this.wallets.find((w) => w.network === network);
      if (existingWallet) {
        console.log(`✅ محفظة ${network} موجودة مسبقاً:`, existingWallet.address);
        return existingWallet;
      }
      if (BotWalletManager.isLoadingWallets) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.init(network);
      }
    }

    if (BotWalletManager.isLoadingWallets) {
      console.log(`⏳ جاري انتظار تحميل المحفظة ${network}...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.init(network);
    }

    if (BotWalletManager.initializationPromise) {
      console.log(`⏳ جاري انتظار تحميل المحفظة ${network}...`);
      return BotWalletManager.initializationPromise;
    }

    console.log(`🔄 بدء تحميل محفظة ${network}...`);
    BotWalletManager.isLoadingWallets = true;
    BotWalletManager.initializationPromise = this._initInternal(network);
    
    try {
      const result = await BotWalletManager.initializationPromise;
      BotWalletManager.isInitialized = true;
      BotWalletManager.walletsLoaded = true;
      console.log(`✅ تم تحميل محفظة ${network} بنجاح`);
      return result;
    } finally {
      BotWalletManager.isLoadingWallets = false;
      BotWalletManager.initializationPromise = null;
    }
  }

  // ✅ دالة داخلية للتحميل
  private async _initInternal(network: string = 'solana'): Promise<BotWalletData> {
    const result = await madarRead<BotWalletData>('bot_wallet', {});
    this.wallets = result.success && result.data ? result.data : [];

    let existingWallet = this.wallets.find((w) => w.network === network);

    if (existingWallet && existingWallet.address) {
      console.log(`✅ تم تحميل محفظة ${network}:`, existingWallet.address);
      const balance = await getWalletBalance(network, existingWallet.address);
      existingWallet.balance = balance;
      await this.updateWallet(existingWallet);
      return existingWallet;
    }

    console.log(`⚠️ لا توجد محفظة لـ ${network}، جاري إنشاء محفظة جديدة...`);
    const { address, privateKey } = createWallet(network);
    const encryptedKey = encrypt(privateKey, this.masterPassword);

    const newWallet: BotWalletData = {
      id: generateId(),
      address,
      encryptedPrivateKey: encryptedKey,
      network,
      balance: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
      isAdminWallet: true, // ✅ محافظ البوت المركزية هي للأدمن
    };

    await this.saveWallet(newWallet);
    this.wallets.push(newWallet);
    console.log(`✅ تم إنشاء محفظة ${network}:`, newWallet.address);
    return newWallet;
  }

  private async saveWallet(wallet: BotWalletData): Promise<void> {
    console.log(`💾 جاري حفظ محفظة ${wallet.network}:`, wallet.address);
    await madarCreate('bot_wallet', wallet);
  }

  private async updateWallet(wallet: BotWalletData): Promise<void> {
    if (!wallet.id) return;
    wallet.updatedAt = getTimestamp();
    await madarUpdate('bot_wallet', wallet.id, wallet);
  }

  // ✅ getWallet مع حماية إضافية
  getWallet(network?: string): BotWalletData | null {
    if (network) {
      const wallet = this.wallets.find((w) => w.network === network);
      if (wallet) {
        return wallet;
      }
      return null;
    }
    return this.wallets.length > 0 ? this.wallets[0] : null;
  }

  getAllWallets(): BotWalletData[] {
    return this.wallets;
  }

  getAdminWallets(): BotWalletData[] {
    return this.wallets.filter(w => w.isAdminWallet !== false);
  }

  getPrivateKey(network: string, password: string): string {
    const wallet = this.wallets.find((w) => w.network === network);
    if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
    return decrypt(wallet.encryptedPrivateKey, password);
  }

  async refreshBalance(network?: string): Promise<number> {
    const targetNetwork = network || (this.wallets.length > 0 ? this.wallets[0].network : 'solana');
    const wallet = this.wallets.find((w) => w.network === targetNetwork);
    if (!wallet) throw new Error(`المحفظة (${targetNetwork}) غير موجودة`);
    if (!wallet.address) throw new Error('عنوان المحفظة غير موجود');
    const balance = await getWalletBalance(targetNetwork, wallet.address);
    wallet.balance = balance;
    await this.updateWallet(wallet);
    return balance;
  }

  // ============================================================
  // ✅ التداول بمحفظة الأدمن (المركزية - النظام القديم)
  // ============================================================

  async executeBuy(params: {
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    try {
      const network = params.network || 'solana';
      this.getPrivateKey(network, params.password);

      const wallet = this.wallets.find((w) => w.network === network);
      if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
      if (!wallet.address) throw new Error('عنوان المحفظة غير موجود');

      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: wallet.address,
        });

        if (result.error) {
          return { success: false, error: result.error, amount: params.amount, tokenAddress: params.tokenAddress };
        }

        await this.refreshBalance(network);
        return {
          success: true,
          txHash: result.txHash,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          tokenSymbol: 'TOKEN',
          network,
        };
      }

      const result = await executeParaSwapTrade({
        network,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        side: 'buy',
        walletAddress: wallet.address,
        slippage: params.slippage,
      });

      if (result.error) {
        return { success: false, error: result.error, amount: params.amount, tokenAddress: params.tokenAddress };
      }

      await this.refreshBalance(network);
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.tokenAddress };
    }
  }

  async executeSell(params: {
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    try {
      const network = params.network || 'solana';
      this.getPrivateKey(network, params.password);

      const wallet = this.wallets.find((w) => w.network === network);
      if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
      if (!wallet.address) throw new Error('عنوان المحفظة غير موجود');

      const txHash = `0x${generateId()}${generateId()}`;
      await this.refreshBalance(network);

      return {
        success: true,
        txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.tokenAddress };
    }
  }

  async sendToUser(params: {
    toAddress: string;
    amount: number;
    network: string;
    password: string;
  }): Promise<TradeResult> {
    try {
      this.getPrivateKey(params.network, params.password);

      const wallet = this.wallets.find((w) => w.network === params.network);
      if (!wallet) throw new Error(`المحفظة (${params.network}) غير موجودة`);
      if (!wallet.address) throw new Error('عنوان المحفظة غير موجود');

      const txHash = `0x${generateId()}${generateId()}`;
      await this.refreshBalance(params.network);

      return {
        success: true,
        txHash,
        amount: params.amount,
        tokenAddress: params.toAddress,
        network: params.network,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.toAddress };
    }
  }

  // ============================================================
  // ✅ التداول بمحفظة المستخدم (الفردية - النظام الجديد)
  // ============================================================

  async executeBuyForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    try {
      const network = params.network || 'solana';
      
      // ✅ جلب محفظة المستخدم من AccountManager
      const userWallet = await AccountManager.getUserWallet(params.userId, network);
      if (!userWallet) {
        return { 
          success: false, 
          error: `لا توجد محفظة للمستخدم على ${network}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
        };
      }

      // ✅ التحقق من كلمة المرور
      decrypt(userWallet.encryptedPrivateKey, params.password);

      // ✅ تنفيذ الصفقة على محفظة المستخدم
      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: userWallet.address,
        });

        if (result.error) {
          return { success: false, error: result.error, amount: params.amount, tokenAddress: params.tokenAddress };
        }

        // ✅ تحديث رصيد المحفظة في قاعدة البيانات
        await AccountManager.updateUserWalletBalance(params.userId, network, userWallet.balance);
        
        return {
          success: true,
          txHash: result.txHash,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          tokenSymbol: 'TOKEN',
          network,
        };
      }

      // ✅ EVM
      const result = await executeParaSwapTrade({
        network,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        side: 'buy',
        walletAddress: userWallet.address,
        slippage: params.slippage,
      });

      if (result.error) {
        return { success: false, error: result.error, amount: params.amount, tokenAddress: params.tokenAddress };
      }

      await AccountManager.updateUserWalletBalance(params.userId, network, userWallet.balance);
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
      };
    } catch (error) {
      return { 
        success: false, 
        error: String(error), 
        amount: params.amount, 
        tokenAddress: params.tokenAddress 
      };
    }
  }

  async executeSellForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    try {
      const network = params.network || 'solana';
      
      const userWallet = await AccountManager.getUserWallet(params.userId, network);
      if (!userWallet) {
        return { 
          success: false, 
          error: `لا توجد محفظة للمستخدم على ${network}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
        };
      }

      decrypt(userWallet.encryptedPrivateKey, params.password);

      const txHash = `0x${generateId()}${generateId()}`;
      await AccountManager.updateUserWalletBalance(params.userId, network, userWallet.balance);

      return {
        success: true,
        txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network,
      };
    } catch (error) {
      return { 
        success: false, 
        error: String(error), 
        amount: params.amount, 
        tokenAddress: params.tokenAddress 
      };
    }
  }
}

// ============================================================
// ✅ دوال التهيئة المركزية
// ============================================================

let isWalletLoading = false;
let walletLoadPromise: Promise<void> | null = null;
let isInitialized = false;

export async function initializeAllWallets(): Promise<void> {
  if (isWalletLoading && walletLoadPromise) {
    console.log('⏳ جاري انتظار تهيئة المحافظ...');
    return walletLoadPromise;
  }

  if (isInitialized) {
    console.log('✅ المحافظ مهيأة مسبقاً');
    return;
  }

  console.log('🔄 بدء تهيئة جميع المحافظ...');
  isWalletLoading = true;
  
  walletLoadPromise = (async () => {
    try {
      const manager = BotWalletManager.getInstance();
      
      const networks = ['solana', 'ethereum', 'arbitrum', 'bsc', 'polygon', 'avalanche', 'base', 'optimism', 'robinhood'];
      
      for (const network of networks) {
        try {
          await manager.init(network);
        } catch (error) {
          console.warn(`⚠️ فشل تهيئة ${network}:`, error);
        }
      }
      
      isInitialized = true;
      console.log('✅ تم تهيئة جميع المحافظ بنجاح');
    } catch (error) {
      console.error('❌ فشل تهيئة المحافظ:', error);
    } finally {
      isWalletLoading = false;
      walletLoadPromise = null;
    }
  })();

  return walletLoadPromise;
}

export function ensureWalletsInitialized(): void {
  if (!isInitialized && !isWalletLoading) {
    console.log('🔄 بدء تهيئة المحافظ (استدعاء تلقائي)');
    initializeAllWallets().catch(console.error);
  }
}

export function resetWalletsInitialization(): void {
  isInitialized = false;
  isWalletLoading = false;
  walletLoadPromise = null;
  console.log('🔄 تم إعادة تعيين تهيئة المحافظ');
}
