// src/lib/wallet.ts
// ============================================================
// 💰 نظام إدارة المحافظ والتداول الحقيقي - الإصدار 2.0
// ✅ يدعم: Solana (Jupiter) + EVM (ParaSwap/1inch)
// ✅ التوقيع التلقائي بدون إدخال كلمة المرور
// ✅ تخزين مؤقت آمن مع قفل تلقائي
// ✅ معالجة أخطاء محسنة مع إعادة المحاولة
// ============================================================

import { 
  Keypair, 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL, 
  SystemProgram, 
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { encrypt, decrypt } from './encryption';
import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate } from './madarTech';
import { AccountManager, UserWallet } from './accounts';

// ============================================================
// 📊 الأنواع
// ============================================================

export interface BotWalletData {
  id?: string;
  bot_id: string;
  address: string;
  encrypted_private_key: string;
  network: string;
  balance: number;
  created_at: string;
  updated_at: string;
  userId?: string;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amount: number;
  tokenAddress: string;
  tokenSymbol?: string;
  network?: string;
  price?: number;
  executionTime?: number;
}

interface DecryptedKeyCache {
  key: string;
  timestamp: number;
  keypair?: Keypair;
  evmWallet?: ethers.Wallet;
}

interface BalanceCache {
  balance: number;
  timestamp: number;
}

// ============================================================
// 🔗 الإعدادات
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

const RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana.publicnode.com',
  'https://api.mainnet.rpcpool.com',
];

const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY || '';
const ANKR_KEY = import.meta.env.VITE_ANKR_KEY || '';
const HELIUS_KEY = import.meta.env.VITE_HELIUS_KEY || '';

// ============================================================
// ⚙️ الإعدادات المتقدمة
// ============================================================

const CONFIG = {
  MASTER_PASSWORD: "SecureMasterPassword123!@#",
  CACHE_DURATION: 30 * 60 * 1000, // 30 دقيقة
  BALANCE_CACHE_DURATION: 10 * 1000, // 10 ثواني
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 ثانية
  TIMEOUT: 15000, // 15 ثانية
  SLIPPAGE_DEFAULT: 1, // 1%
  PRIORITY_FEE: 'auto',
  COMPUTE_UNITS: 'auto',
};

// ============================================================
// 🔧 الأدوات المساعدة
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = CONFIG.TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`❌ انتهت المهلة بعد ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = CONFIG.MAX_RETRIES,
  delayMs: number = CONFIG.RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ محاولة ${attempt}/${maxRetries} فشلت:`, lastError.message);
      
      if (attempt < maxRetries) {
        await sleep(delayMs * attempt); // تأخير متزايد
      }
    }
  }
  
  throw lastError || new Error('❌ فشلت جميع المحاولات');
}

// ============================================================
// 🔑 إنشاء المحافظ
// ============================================================

export function createSolanaWallet(): { publicKey: string; privateKey: string } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey), // Base58 format
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
    return createSolanaWallet();
  }
  return createEvmWallet();
}

// ============================================================
// 🔐 نظام التخزين المؤقت للمفاتيح
// ============================================================

class KeyCacheManager {
  private static cache: Map<string, DecryptedKeyCache> = new Map();
  private static autoLockTimer: NodeJS.Timeout | null = null;
  
  static set(network: string, key: string): void {
    const cacheEntry: DecryptedKeyCache = {
      key,
      timestamp: Date.now(),
    };
    
    // إنشاء الكائنات مسبقاً للاستخدام السريع
    try {
      if (network === 'solana') {
        const keyBytes = bs58.decode(key);
        cacheEntry.keypair = Keypair.fromSecretKey(keyBytes);
      } else {
        cacheEntry.evmWallet = new ethers.Wallet(key);
      }
    } catch (error) {
      console.error(`❌ فشل إنشاء كائن المفتاح لـ ${network}:`, error);
    }
    
    KeyCacheManager.cache.set(network, cacheEntry);
  }
  
  static get(network: string): DecryptedKeyCache | null {
    const cached = KeyCacheManager.cache.get(network);
    
    if (!cached) return null;
    
    // التحقق من الصلاحية
    if (Date.now() - cached.timestamp > CONFIG.CACHE_DURATION) {
      KeyCacheManager.cache.delete(network);
      return null;
    }
    
    return cached;
  }
  
  static getKey(network: string): string {
    const cached = KeyCacheManager.get(network);
    if (!cached) {
      throw new Error(`❌ المفتاح غير متوفر في الذاكرة لشبكة ${network}`);
    }
    return cached.key;
  }
  
  static getKeypair(network: string): Keypair {
    const cached = KeyCacheManager.get(network);
    if (!cached?.keypair) {
      throw new Error(`❌ Keypair غير متوفر لشبكة ${network}`);
    }
    return cached.keypair;
  }
  
  static getEvmWallet(network: string): ethers.Wallet {
    const cached = KeyCacheManager.get(network);
    if (!cached?.evmWallet) {
      throw new Error(`❌ EVM Wallet غير متوفر لشبكة ${network}`);
    }
    return cached.evmWallet;
  }
  
  static clear(network?: string): void {
    if (network) {
      KeyCacheManager.cache.delete(network);
    } else {
      KeyCacheManager.cache.clear();
    }
  }
  
  static startAutoLock(): void {
    if (KeyCacheManager.autoLockTimer) {
      clearInterval(KeyCacheManager.autoLockTimer);
    }
    
    KeyCacheManager.autoLockTimer = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      
      for (const [network, cached] of KeyCacheManager.cache.entries()) {
        if (now - cached.timestamp > CONFIG.CACHE_DURATION) {
          KeyCacheManager.cache.delete(network);
          expiredCount++;
          console.log(`🔒 تم قفل مفتاح ${network} تلقائياً`);
        }
      }
      
      if (expiredCount > 0) {
        console.log(`🔒 تم قفل ${expiredCount} مفتاح تلقائياً`);
      }
    }, 60 * 1000); // فحص كل دقيقة
  }
  
  static stopAutoLock(): void {
    if (KeyCacheManager.autoLockTimer) {
      clearInterval(KeyCacheManager.autoLockTimer);
      KeyCacheManager.autoLockTimer = null;
    }
  }
  
  static isUnlocked(network: string): boolean {
    return KeyCacheManager.get(network) !== null;
  }
  
  static getUnlockedNetworks(): string[] {
    return Array.from(KeyCacheManager.cache.keys());
  }
}

// ============================================================
// 🌐 إدارة RPC
// ============================================================

class RPCManager {
  private static currentIndex = 0;
  private static failedUrls: Set<string> = new Set();
  
  static getWorkingUrl(): string {
    return RPC_URLS[RPCManager.currentIndex] || RPC_URLS[0];
  }
  
  static async switchToNextRpc(): Promise<string> {
    RPCManager.failedUrls.add(RPCManager.getWorkingUrl());
    
    // البحث عن RPC التالي الصالح
    for (let i = 0; i < RPC_URLS.length; i++) {
      RPCManager.currentIndex = (RPCManager.currentIndex + 1) % RPC_URLS.length;
      const url = RPCManager.getWorkingUrl();
      
      if (!RPCManager.failedUrls.has(url)) {
        console.log(`🔄 تم التبديل إلى RPC: ${url}`);
        return url;
      }
    }
    
    // إذا فشلت جميع الروابط، إعادة تعيين
    RPCManager.failedUrls.clear();
    RPCManager.currentIndex = 0;
    console.log('🔄 إعادة تعيين قائمة RPC');
    return RPCManager.getWorkingUrl();
  }
  
  static async testRpcConnection(url: string): Promise<boolean> {
    try {
      const connection = new Connection(url, 'confirmed');
      await withTimeout(connection.getLatestBlockhash(), 5000);
      return true;
    } catch {
      return false;
    }
  }
  
  static async findBestRpc(): Promise<string> {
    for (const url of RPC_URLS) {
      if (!RPCManager.failedUrls.has(url)) {
        if (await RPCManager.testRpcConnection(url)) {
          RPCManager.currentIndex = RPC_URLS.indexOf(url);
          console.log(`✅ RPC يعمل: ${url}`);
          return url;
        }
      }
    }
    
    // إذا فشل كل شيء، استخدم الأول
    return RPC_URLS[0];
  }
}

// ============================================================
// 📊 جلب الرصيد
// ============================================================

export async function getSolanaBalance(address: string): Promise<number> {
  return retryWithBackoff(async () => {
    try {
      // المحاولة عبر Worker أولاً
      const response = await withTimeout(fetch(`${WORKER_URL}/solana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      }));

      const data = await response.json();
      if (data.result) {
        return data.result.value / LAMPORTS_PER_SOL;
      }
      
      throw new Error('لا توجد نتيجة من Worker');
    } catch (error) {
      console.warn('⚠️ Worker Proxy فشل، جاري استخدام RPC مباشر:', error);
      return getSolanaBalanceDirect(address);
    }
  });
}

export async function getSolanaBalanceDirect(address: string): Promise<number> {
  const url = await RPCManager.findBestRpc();
  
  try {
    const connection = new Connection(url, 'confirmed');
    const pubKey = new PublicKey(address);
    const balance = await withTimeout(connection.getBalance(pubKey));
    return balance / LAMPORTS_PER_SOL;
  } catch (error: any) {
    if (error.message?.includes('403') || error.message?.includes('429')) {
      await RPCManager.switchToNextRpc();
      return getSolanaBalanceDirect(address);
    }
    console.error('❌ Solana balance error:', error);
    return 0;
  }
}

export async function getEvmBalance(address: string, network: string): Promise<number> {
  return retryWithBackoff(async () => {
    try {
      const response = await withTimeout(fetch(`${WORKER_URL}/${network}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      }));

      const data = await response.json();
      if (data.result) {
        return parseInt(data.result, 16) / 1e18;
      }
      return 0;
    } catch (error) {
      console.warn(`⚠️ Worker Proxy فشل لـ ${network}:`, error);
      
      // استخدام RPC مباشر للشبكات EVM
      try {
        const rpcUrl = `https://rpc.ankr.com/${network}/${ANKR_KEY}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balance = await provider.getBalance(address);
        return parseFloat(ethers.formatEther(balance));
      } catch {
        return 0;
      }
    }
  });
}

export async function getWalletBalance(network: string, address: string): Promise<number> {
  if (network === 'solana') {
    return getSolanaBalance(address);
  }
  return getEvmBalance(address, network);
}

// ============================================================
// 📊 جلب أسعار التوكن
// ============================================================

async function getTokenPrice(tokenAddress: string, network: string): Promise<number> {
  return retryWithBackoff(async () => {
    const response = await withTimeout(fetch(`${WORKER_URL}/dex-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network }),
    }));

    if (!response.ok) {
      throw new Error(`❌ فشل جلب السعر: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data?.price) {
      throw new Error('❌ لا توجد بيانات سعر');
    }

    return data.data.price;
  });
}

// ============================================================
// 💱 تنفيذ صفقات Jupiter (Solana)
// ============================================================

async function executeJupiterSwap(params: {
  tokenAddress: string;
  amountInSol: number;
  slippage: number;
  walletAddress: string;
  privateKey?: string;
  side?: 'buy' | 'sell';
}): Promise<{ txHash: string; price: number; error: string | null }> {
  const startTime = Date.now();
  
  try {
    const keypair = params.privateKey 
      ? Keypair.fromSecretKey(bs58.decode(params.privateKey))
      : KeyCacheManager.getKeypair('solana');
    
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(params.amountInSol * 1e9);
    
    const inputMint = params.side === 'sell' ? params.tokenAddress : SOL_MINT;
    const outputMint = params.side === 'sell' ? SOL_MINT : params.tokenAddress;
    
    // جلب الاقتباس
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${Math.floor(params.slippage * 100)}`;
    
    const quoteResponse = await withTimeout(fetch(quoteUrl, {
      headers: JUPITER_API_KEY ? { Authorization: `Bearer ${JUPITER_API_KEY}` } : {},
    }), 10000);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      throw new Error(`فشل جلب سعر Jupiter: ${errorText}`);
    }
    
    const quote = await quoteResponse.json();
    
    if (!quote || !quote.outAmount) {
      throw new Error('لا توجد أسعار من Jupiter');
    }
    
    // جلب معاملة التبادل
    const swapResponse = await withTimeout(fetch('https://quote-api.jup.ag/v6/swap', {
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
        prioritizationFeeLamports: CONFIG.PRIORITY_FEE,
      }),
    }), 10000);
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error(`فشل تنفيذ Jupiter: ${errorText}`);
    }
    
    const swapData = await swapResponse.json();
    
    if (!swapData || !swapData.swapTransaction) {
      throw new Error('لا توجد معاملة من Jupiter');
    }
    
    // فك تشفير المعاملة
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    );
    
    // التوقيع على المعاملة
    transaction.sign([keypair]);
    
    // إرسال المعاملة الموقعة
    const connection = new Connection(await RPCManager.findBestRpc(), 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    // انتظار التأكيد
    const confirmation = await withTimeout(
      connection.confirmTransaction(signature, 'confirmed'),
      15000
    );
    
    if (confirmation.value.err) {
      throw new Error(`فشل تأكيد المعاملة: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    const outAmount = parseFloat(quote.outAmount) / 1e9;
    const price = params.side === 'buy' 
      ? params.amountInSol / outAmount 
      : outAmount / params.amountInSol;
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ تم تنفيذ صفقة Jupiter في ${executionTime}ms`);
    
    return {
      txHash: signature,
      price,
      error: null,
    };
  } catch (error) {
    console.error('❌ Jupiter swap error:', error);
    return {
      txHash: '',
      price: 0,
      error: error instanceof Error ? error.message : 'خطأ غير معروف في Jupiter',
    };
  }
}

// ============================================================
// 💱 تنفيذ صفقات ParaSwap (EVM)
// ============================================================

async function executeParaSwapTrade(params: {
  network: string;
  tokenAddress: string;
  amount: number;
  side: 'buy' | 'sell';
  walletAddress: string;
  slippage: number;
  privateKey?: string;
}): Promise<{ txHash: string; price: number; error: string | null }> {
  const startTime = Date.now();
  
  const networkMap: Record<string, number> = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    base: 8453,
    avalanche: 43114,
    optimism: 10,
  };
  
  const chainId = networkMap[params.network];
  if (!chainId) {
    return { txHash: '', price: 0, error: `شبكة غير مدعومة: ${params.network}` };
  }
  
  try {
    const wallet = params.privateKey 
      ? new ethers.Wallet(params.privateKey)
      : KeyCacheManager.getEvmWallet(params.network);
    
    const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const srcToken = params.side === 'buy' ? NATIVE_TOKEN : params.tokenAddress;
    const destToken = params.side === 'buy' ? params.tokenAddress : NATIVE_TOKEN;
    const amountWei = ethers.parseEther(params.amount.toString()).toString();
    
    // جلب السعر
    const priceUrl = `https://api.paraswap.io/prices?srcToken=${srcToken}&destToken=${destToken}&amount=${amountWei}&side=${params.side === 'buy' ? 'SELL' : 'BUY'}&network=${chainId}`;
    
    const priceResponse = await withTimeout(fetch(priceUrl), 10000);
    
    if (!priceResponse.ok) {
      throw new Error(`فشل جلب السعر: ${priceResponse.status}`);
    }
    
    const priceData = await priceResponse.json();
    
    // بناء المعاملة
    const swapUrl = `https://api.paraswap.io/transactions/${chainId}`;
    const swapResponse = await withTimeout(fetch(swapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken,
        destToken,
        srcAmount: amountWei,
        slippage: params.slippage * 100,
        userAddress: params.walletAddress,
        priceRoute: priceData.priceRoute,
      }),
    }), 10000);
    
    if (!swapResponse.ok) {
      throw new Error(`فشل التنفيذ: ${swapResponse.status}`);
    }
    
    const swapData = await swapResponse.json();
    
    // توقيع وإرسال المعاملة
    const provider = new ethers.JsonRpcProvider(
      `https://rpc.ankr.com/${params.network}/${ANKR_KEY}`
    );
    const connectedWallet = wallet.connect(provider);
    
    const tx = await connectedWallet.sendTransaction({
      to: swapData.to,
      data: swapData.data,
      value: swapData.value ? BigInt(swapData.value) : undefined,
      gasLimit: swapData.gasLimit ? BigInt(swapData.gasLimit) : undefined,
      gasPrice: swapData.gasPrice ? BigInt(swapData.gasPrice) : undefined,
    });
    
    // انتظار التأكيد
    const receipt = await withTimeout(tx.wait(), 15000);
    
    if (receipt.status !== 1) {
      throw new Error('فشلت المعاملة على الشبكة');
    }
    
    const price = parseFloat(priceData.destAmount) / parseFloat(priceData.srcAmount);
    const executionTime = Date.now() - startTime;
    console.log(`✅ تم تنفيذ صفقة ParaSwap في ${executionTime}ms`);
    
    return {
      txHash: tx.hash,
      price,
      error: null,
    };
  } catch (error) {
    console.error('❌ ParaSwap trade error:', error);
    return {
      txHash: '',
      price: 0,
      error: error instanceof Error ? error.message : 'خطأ غير معروف',
    };
  }
}

// ============================================================
// 💸 إرسال المعاملات
// ============================================================

async function sendSolanaTransaction(params: {
  fromAddress: string;
  toAddress: string;
  amount: number;
  privateKey?: string;
}): Promise<{ txHash: string; error: string | null }> {
  try {
    const keypair = params.privateKey
      ? Keypair.fromSecretKey(bs58.decode(params.privateKey))
      : KeyCacheManager.getKeypair('solana');
    
    const connection = new Connection(await RPCManager.findBestRpc(), 'confirmed');
    const fromPubkey = new PublicKey(params.fromAddress);
    const toPubkey = new PublicKey(params.toAddress);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(params.amount * LAMPORTS_PER_SOL),
      })
    );
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    
    const signature = await connection.sendTransaction(transaction, [keypair]);
    
    const confirmation = await withTimeout(
      connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }),
      15000
    );
    
    if (confirmation.value.err) {
      throw new Error(`فشل تأكيد المعاملة: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    return { txHash: signature, error: null };
  } catch (error) {
    return {
      txHash: '',
      error: error instanceof Error ? error.message : 'خطأ في إرسال الأموال',
    };
  }
}

async function sendEVMTx(params: {
  network: string;
  toAddress: string;
  amount: number;
  privateKey?: string;
}): Promise<{ txHash: string; error: string | null }> {
  try {
    const wallet = params.privateKey
      ? new ethers.Wallet(params.privateKey)
      : KeyCacheManager.getEvmWallet(params.network);
    
    const provider = new ethers.JsonRpcProvider(
      `https://rpc.ankr.com/${params.network}/${ANKR_KEY}`
    );
    const connectedWallet = wallet.connect(provider);
    
    const tx = await connectedWallet.sendTransaction({
      to: params.toAddress,
      value: ethers.parseEther(params.amount.toString()),
    });
    
    const receipt = await withTimeout(tx.wait(), 15000);
    
    if (receipt.status !== 1) {
      throw new Error('فشلت المعاملة على الشبكة');
    }
    
    return { txHash: tx.hash, error: null };
  } catch (error) {
    return {
      txHash: '',
      error: error instanceof Error ? error.message : 'خطأ في إرسال الأموال',
    };
  }
}

// ============================================================
// 🤖 BotWalletManager
// ============================================================

export class BotWalletManager {
  private static instance: BotWalletManager;
  private wallets: BotWalletData[] = [];
  private balanceCache: Map<string, BalanceCache> = new Map();
  
  private static isInitialized = false;
  private static initializationPromise: Promise<void> | null = null;
  
  private constructor() {
    console.log('🔑 BotWalletManager initialized');
  }
  
  static getInstance(): BotWalletManager {
    if (!BotWalletManager.instance) {
      BotWalletManager.instance = new BotWalletManager();
    }
    return BotWalletManager.instance;
  }
  
  // ============================================================
  // 📥 التهيئة
  // ============================================================
  
  async init(network: string = 'solana'): Promise<BotWalletData> {
    const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism'];
    
    if (!VALID_NETWORKS.includes(network)) {
      throw new Error(`شبكة غير صالحة: ${network}`);
    }
    
    // تحميل المحافظ من قاعدة البيانات
    const result = await madarRead<BotWalletData>('bot_wallet', {});
    this.wallets = result.success && result.data ? result.data : [];
    
    // فلترة الشبكات الصالحة
    this.wallets = this.wallets.filter(w => VALID_NETWORKS.includes(w.network));
    
    let wallet = this.wallets.find(w => w.network === network);
    
    if (wallet && wallet.address) {
      console.log(`✅ تم تحميل محفظة ${network}:`, wallet.address);
      
      // فك تشفير المفتاح وتخزينه في الذاكرة
      try {
        const decryptedKey = decrypt(wallet.encrypted_private_key, CONFIG.MASTER_PASSWORD);
        KeyCacheManager.set(network, decryptedKey);
        console.log(`🔓 تم فتح محفظة ${network} للتوقيع التلقائي`);
      } catch (error) {
        console.error(`❌ فشل فتح محفظة ${network}:`, error);
      }
      
      // تحديث الرصيد
      const balance = await getWalletBalance(network, wallet.address);
      wallet.balance = balance;
      await this.updateWallet(wallet);
      
      return wallet;
    }
    
    // إنشاء محفظة جديدة
    console.log(`⚠️ لا توجد محفظة لـ ${network}، جاري إنشاء محفظة جديدة...`);
    const { address, privateKey } = createWallet(network);
    const encryptedKey = encrypt(privateKey, CONFIG.MASTER_PASSWORD);
    
    const newWallet: BotWalletData = {
      id: generateId(),
      bot_id: 'admin_wallet',
      address,
      encrypted_private_key: encryptedKey,
      network,
      balance: 0,
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };
    
    await this.saveWallet(newWallet);
    this.wallets.push(newWallet);
    
    // تخزين المفتاح في الذاكرة
    KeyCacheManager.set(network, privateKey);
    
    console.log(`✅ تم إنشاء وفتح محفظة ${network}:`, newWallet.address);
    return newWallet;
  }
  
  async initializeAllNetworks(): Promise<void> {
    const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism'];
    
    console.log('🚀 بدء تهيئة جميع الشبكات...');
    
    for (const network of VALID_NETWORKS) {
      try {
        await this.init(network);
      } catch (error) {
        console.warn(`⚠️ فشل تهيئة ${network}:`, error);
      }
    }
    
    // بدء القفل التلقائي
    KeyCacheManager.startAutoLock();
    
    console.log('✅ تم تهيئة جميع الشبكات بنجاح');
    console.log('🔓 المحافظ المفتوحة:', KeyCacheManager.getUnlockedNetworks().join(', '));
  }
  
  // ============================================================
  // 💾 إدارة البيانات
  // ============================================================
  
  private async saveWallet(wallet: BotWalletData): Promise<void> {
    await madarCreate('bot_wallet', wallet);
  }
  
  private async updateWallet(wallet: BotWalletData): Promise<void> {
    if (!wallet.id) return;
    wallet.updated_at = getTimestamp();
    await madarUpdate('bot_wallet', wallet.id, wallet);
  }
  
  // ============================================================
  // 🔍 الوصول إلى المحافظ
  // ============================================================
  
  getWallet(network?: string): BotWalletData | null {
    if (network) {
      return this.wallets.find(w => w.network === network) || null;
    }
    return this.wallets.length > 0 ? this.wallets[0] : null;
  }
  
  getAllWallets(): BotWalletData[] {
    return this.wallets;
  }
  
  getAdminWallets(): BotWalletData[] {
    return this.wallets.filter(w => w.bot_id === 'admin_wallet');
  }
  
  isWalletUnlocked(network: string): boolean {
    return KeyCacheManager.isUnlocked(network);
  }
  
  getUnlockedNetworks(): string[] {
    return KeyCacheManager.getUnlockedNetworks();
  }
  
  // ============================================================
  // 🔑 إدارة المفاتيح
  // ============================================================
  
  async unlockWallet(network: string, password: string): Promise<boolean> {
    const wallet = this.wallets.find(w => w.network === network);
    if (!wallet) {
      console.error(`❌ المحفظة (${network}) غير موجودة`);
      return false;
    }
    
    try {
      const decryptedKey = decrypt(wallet.encrypted_private_key, password);
      KeyCacheManager.set(network, decryptedKey);
      console.log(`🔓 تم فتح محفظة ${network} بنجاح`);
      return true;
    } catch (error) {
      console.error(`❌ كلمة المرور غير صحيحة لـ ${network}`);
      return false;
    }
  }
  
  async unlockAllWallets(password: string): Promise<boolean> {
    if (password !== CONFIG.MASTER_PASSWORD) {
      console.error('❌ كلمة المرور الرئيسية غير صحيحة');
      return false;
    }
    
    let successCount = 0;
    
    for (const wallet of this.wallets) {
      try {
        const decryptedKey = decrypt(wallet.encrypted_private_key, password);
        KeyCacheManager.set(wallet.network, decryptedKey);
        successCount++;
      } catch (error) {
        console.error(`❌ فشل فتح ${wallet.network}:`, error);
      }
    }
    
    console.log(`🔓 تم فتح ${successCount} محفظة بنجاح`);
    return successCount > 0;
  }
  
  lockWallet(network: string): void {
    KeyCacheManager.clear(network);
    console.log(`🔒 تم قفل محفظة ${network}`);
  }
  
  lockAllWallets(): void {
    KeyCacheManager.clear();
    console.log('🔒 تم قفل جميع المحافظ');
  }
  
  // ============================================================
  // 💰 التداول
  // ============================================================
  
  async executeBuy(params: {
    tokenAddress: string;
    amount: number;
    slippage?: number;
    network?: string;
  }): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      const network = params.network || 'solana';
      const slippage = params.slippage || CONFIG.SLIPPAGE_DEFAULT;
      
      const wallet = this.wallets.find(w => w.network === network);
      if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
      
      // التحقق من أن المفتاح مفتوح
      if (!KeyCacheManager.isUnlocked(network)) {
        throw new Error(`❌ محفظة ${network} مقفلة. يرجى فتحها أولاً`);
      }
      
      // التحقق من الرصيد
      const balance = await this.getCachedBalance(network);
      if (balance < params.amount) {
        return {
          success: false,
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
          executionTime: Date.now() - startTime,
        };
      }
      
      let result;
      
      if (network === 'solana') {
        result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage,
          walletAddress: wallet.address,
          side: 'buy',
        });
      } else {
        result = await executeParaSwapTrade({
          network,
          tokenAddress: params.tokenAddress,
          amount: params.amount,
          side: 'buy',
          walletAddress: wallet.address,
          slippage,
        });
      }
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
          executionTime: Date.now() - startTime,
        };
      }
      
      // تحديث الرصيد في الخلفية
      this.refreshBalance(network).catch(console.warn);
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
        price: result.price,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  async executeSell(params: {
    tokenAddress: string;
    amount: number;
    slippage?: number;
    network?: string;
  }): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      const network = params.network || 'solana';
      const slippage = params.slippage || CONFIG.SLIPPAGE_DEFAULT;
      
      const wallet = this.wallets.find(w => w.network === network);
      if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
      
      if (!KeyCacheManager.isUnlocked(network)) {
        throw new Error(`❌ محفظة ${network} مقفلة. يرجى فتحها أولاً`);
      }
      
      let result;
      
      if (network === 'solana') {
        result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage,
          walletAddress: wallet.address,
          side: 'sell',
        });
      } else {
        result = await executeParaSwapTrade({
          network,
          tokenAddress: params.tokenAddress,
          amount: params.amount,
          side: 'sell',
          walletAddress: wallet.address,
          slippage,
        });
      }
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
          executionTime: Date.now() - startTime,
        };
      }
      
      this.refreshBalance(network).catch(console.warn);
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
        price: result.price,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  async sendToUser(params: {
    toAddress: string;
    amount: number;
    network: string;
  }): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      const wallet = this.wallets.find(w => w.network === params.network);
      if (!wallet) throw new Error(`المحفظة (${params.network}) غير موجودة`);
      
      if (!KeyCacheManager.isUnlocked(params.network)) {
        throw new Error(`❌ محفظة ${params.network} مقفلة`);
      }
      
      const balance = await this.getCachedBalance(params.network);
      if (balance < params.amount) {
        return {
          success: false,
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`,
          amount: params.amount,
          tokenAddress: params.toAddress,
          network: params.network,
        };
      }
      
      let result;
      
      if (params.network === 'solana') {
        result = await sendSolanaTransaction({
          fromAddress: wallet.address,
          toAddress: params.toAddress,
          amount: params.amount,
        });
      } else {
        result = await sendEVMTx({
          network: params.network,
          toAddress: params.toAddress,
          amount: params.amount,
        });
      }
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          amount: params.amount,
          tokenAddress: params.toAddress,
          network: params.network,
        };
      }
      
      this.refreshBalance(params.network).catch(console.warn);
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.toAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.toAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  // ============================================================
  // 💰 التداول للمستخدمين
  // ============================================================
  
  async executeBuyForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage?: number;
    network?: string;
  }): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      const network = params.network || 'solana';
      const slippage = params.slippage || CONFIG.SLIPPAGE_DEFAULT;
      
      const userWallet = await AccountManager.getUserWallet(params.userId, network);
      if (!userWallet) {
        return {
          success: false,
          error: `لا توجد محفظة للمستخدم على ${network}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
        };
      }
      
      const balance = await AccountManager.getUserWalletBalance(params.userId, network);
      if (balance < params.amount) {
        return {
          success: false,
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
        };
      }
      
      let result;
      
      if (network === 'solana') {
        const privateKey = bs58.encode(
          Buffer.from(userWallet.encryptedPrivateKey, 'hex')
        );
        
        result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage,
          walletAddress: userWallet.address,
          privateKey,
          side: 'buy',
        });
      } else {
        result = await executeParaSwapTrade({
          network,
          tokenAddress: params.tokenAddress,
          amount: params.amount,
          side: 'buy',
          walletAddress: userWallet.address,
          slippage,
          privateKey: userWallet.encryptedPrivateKey,
        });
      }
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
        };
      }
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
        price: result.price,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  async executeSellForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage?: number;
    network?: string;
  }): Promise<TradeResult> {
    const startTime = Date.now();
    
    try {
      const network = params.network || 'solana';
      const slippage = params.slippage || CONFIG.SLIPPAGE_DEFAULT;
      
      const userWallet = await AccountManager.getUserWallet(params.userId, network);
      if (!userWallet) {
        return {
          success: false,
          error: `لا توجد محفظة للمستخدم على ${network}`,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
        };
      }
      
      let result;
      
      if (network === 'solana') {
        const privateKey = bs58.encode(
          Buffer.from(userWallet.encryptedPrivateKey, 'hex')
        );
        
        result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage,
          walletAddress: userWallet.address,
          privateKey,
          side: 'sell',
        });
      } else {
        result = await executeParaSwapTrade({
          network,
          tokenAddress: params.tokenAddress,
          amount: params.amount,
          side: 'sell',
          walletAddress: userWallet.address,
          slippage,
          privateKey: userWallet.encryptedPrivateKey,
        });
      }
      
      if (result.error) {
        return {
          success: false,
          error: result.error,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          network,
        };
      }
      
      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        tokenSymbol: 'TOKEN',
        network,
        price: result.price,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  // ============================================================
  // 💰 إدارة الرصيد
  // ============================================================
  
  private async getCachedBalance(network: string): Promise<number> {
    const cached = this.balanceCache.get(network);
    
    if (cached && Date.now() - cached.timestamp < CONFIG.BALANCE_CACHE_DURATION) {
      return cached.balance;
    }
    
    const wallet = this.wallets.find(w => w.network === network);
    if (!wallet || !wallet.address) return 0;
    
    const balance = await getWalletBalance(network, wallet.address);
    
    this.balanceCache.set(network, {
      balance,
      timestamp: Date.now(),
    });
    
    return balance;
  }
  
  async refreshBalance(network?: string): Promise<number> {
    const targetNetwork = network || (this.wallets.length > 0 ? this.wallets[0].network : 'solana');
    const wallet = this.wallets.find(w => w.network === targetNetwork);
    
    if (!wallet) throw new Error(`المحفظة (${targetNetwork}) غير موجودة`);
    if (!wallet.address) throw new Error('عنوان المحفظة غير موجود');
    
    const balance = await getWalletBalance(targetNetwork, wallet.address);
    wallet.balance = balance;
    
    // تحديث cache
    this.balanceCache.set(targetNetwork, {
      balance,
      timestamp: Date.now(),
    });
    
    await this.updateWallet(wallet);
    return balance;
  }
  
  async refreshAllBalances(): Promise<void> {
    console.log('🔄 تحديث جميع الأرصدة...');
    
    const promises = this.wallets.map(async (wallet) => {
      try {
        await this.refreshBalance(wallet.network);
      } catch (error) {
        console.warn(`⚠️ فشل تحديث رصيد ${wallet.network}:`, error);
      }
    });
    
    await Promise.all(promises);
    console.log('✅ تم تحديث جميع الأرصدة');
  }
}

// ============================================================
// 🚀 التهيئة المركزية
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
      await manager.initializeAllNetworks();
      
      isInitialized = true;
      console.log('✅ تم تهيئة جميع المحافظ بنجاح');
      console.log('🔓 المحافظ المفتوحة:', manager.getUnlockedNetworks().join(', '));
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
  
  const manager = BotWalletManager.getInstance();
  manager.lockAllWallets();
  
  console.log('🔄 تم إعادة تعيين تهيئة المحافظ');
}

// ============================================================
// 🔄 ترحيل المحافظ القديمة
// ============================================================

export async function migrateOldWallets(): Promise<void> {
  console.log('🔄 بدء ترحيل المحافظ القديمة...');
  
  const manager = BotWalletManager.getInstance();
  const wallets = manager.getAllWallets();
  
  for (const wallet of wallets) {
    if (wallet.network === 'solana') {
      try {
        const decryptedKey = decrypt(wallet.encrypted_private_key, CONFIG.MASTER_PASSWORD);
        
        // تحويل من hex إلى base58 إذا كان hex
        if (decryptedKey.length === 128 && /^[0-9a-f]+$/i.test(decryptedKey)) {
          const keyBytes = Buffer.from(decryptedKey, 'hex');
          const base58Key = bs58.encode(keyBytes);
          
          wallet.encrypted_private_key = encrypt(base58Key, CONFIG.MASTER_PASSWORD);
          
          await madarUpdate('bot_wallet', wallet.id!, wallet);
          console.log(`✅ تم ترحيل محفظة Solana: ${wallet.address}`);
        }
      } catch (error) {
        console.error(`❌ فشل ترحيل المحفظة: ${wallet.address}`, error);
      }
    }
  }
  
  console.log('✅ اكتمل ترحيل المحافظ');
}

// ============================================================
// 📤 التصدير
// ============================================================

export { KeyCacheManager, RPCManager };
export { CONFIG };