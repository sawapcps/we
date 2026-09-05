// src/lib/wallet.ts
// ============================================================
// 💰 نظام إدارة المحافظ والتداول الحقيقي - الإصدار النهائي
// ✅ يدعم: Solana (Jupiter) + EVM (ParaSwap)
// ✅ التوقيع التلقائي بدون إدخال كلمة المرور
// ✅ إصلاح مشاكل العناوين والتشفير
// ============================================================

import { 
  Keypair, 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL, 
  SystemProgram, 
  Transaction,
  VersionedTransaction 
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

// ============================================================
// 🔗 الإعدادات
// ============================================================

const CONFIG = {
  MASTER_PASSWORD: "SecureMasterPassword123!@#",
  CACHE_DURATION: 30 * 60 * 1000,
  BALANCE_CACHE_DURATION: 10 * 1000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 15000,
  SLIPPAGE_DEFAULT: 1,
};

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

const RPC_URLS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  'https://solana.publicnode.com',
];

const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY || '';
const ANKR_KEY = import.meta.env.VITE_ANKR_KEY || '';

let workingRpcIndex = 0;

function getWorkingRpcUrl(): string {
  return RPC_URLS[workingRpcIndex] || RPC_URLS[0];
}

// ============================================================
// 🔧 أدوات مساعدة
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidSolanaAddress(address: string): boolean {
  if (!address || address === 'undefined' || address === 'null') {
    return false;
  }
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
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
  
  static isUnlocked(network: string): boolean {
    return KeyCacheManager.get(network) !== null;
  }
  
  static getUnlockedNetworks(): string[] {
    return Array.from(KeyCacheManager.cache.keys());
  }
}

// ============================================================
// 🔑 إنشاء المحافظ
// ============================================================

export function createSolanaWallet(): { publicKey: string; privateKey: string } {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  
  if (!isValidSolanaAddress(publicKey)) {
    console.error('❌ فشل إنشاء عنوان Solana صالح');
    throw new Error('فشل إنشاء عنوان Solana');
  }
  
  return {
    publicKey,
    privateKey: bs58.encode(keypair.secretKey), // ✅ Base58
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
// 📊 جلب الرصيد
// ============================================================

export async function getSolanaBalance(address: string): Promise<number> {
  try {
    const response = await fetch(`${WORKER_URL}/solana`, {
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
    if (data.result) {
      return data.result.value / LAMPORTS_PER_SOL;
    }
    return 0;
  } catch (error) {
    console.warn('⚠️ Worker Proxy فشل، جاري استخدام RPC مباشر:', error);
    return getSolanaBalanceDirect(address);
  }
}

export async function getSolanaBalanceDirect(address: string): Promise<number> {
  // ✅ التحقق من صحة العنوان أولاً
  if (!isValidSolanaAddress(address)) {
    console.warn('⚠️ عنوان Solana غير صالح:', address);
    return 0;
  }
  
  try {
    const pubKey = new PublicKey(address);
    const url = getWorkingRpcUrl();
    const connection = new Connection(url, 'confirmed');
    const balance = await connection.getBalance(pubKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error: any) {
    if (error.message?.includes('403') || error.message?.includes('429')) {
      workingRpcIndex = (workingRpcIndex + 1) % RPC_URLS.length;
      console.log(`🔄 تبديل RPC إلى: ${RPC_URLS[workingRpcIndex]}`);
      return getSolanaBalanceDirect(address);
    }
    console.error('❌ Solana balance error:', error);
    return 0;
  }
}

export async function getEvmBalance(address: string, network: string): Promise<number> {
  try {
    const response = await fetch(`${WORKER_URL}/${network}`, {
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
    if (data.result) {
      return parseInt(data.result, 16) / 1e18;
    }
    return 0;
  } catch (error) {
    console.warn(`⚠️ Worker Proxy فشل لـ ${network}:`, error);
    
    try {
      const rpcUrl = `https://rpc.ankr.com/${network}/${ANKR_KEY}`;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const balance = await provider.getBalance(address);
      return parseFloat(ethers.formatEther(balance));
    } catch {
      return 0;
    }
  }
}

export async function getWalletBalance(network: string, address: string): Promise<number> {
  if (network === 'solana') {
    return getSolanaBalance(address);
  }
  return getEvmBalance(address, network);
}

// ============================================================
// 📊 جلب سعر التوكن
// ============================================================

async function getTokenPrice(tokenAddress: string, network: string): Promise<number> {
  try {
    const response = await fetch(`${WORKER_URL}/dex-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, network }),
    });

    if (!response.ok) {
      throw new Error(`❌ فشل جلب السعر: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.data?.price) {
      throw new Error('❌ لا توجد بيانات سعر');
    }

    return data.data.price;
  } catch (error) {
    console.error('❌ فشل جلب سعر التوكن:', error);
    throw error;
  }
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
  try {
    const keypair = params.privateKey 
      ? Keypair.fromSecretKey(bs58.decode(params.privateKey))
      : KeyCacheManager.getKeypair('solana');
    
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(params.amountInSol * 1e9);
    
    const inputMint = params.side === 'sell' ? params.tokenAddress : SOL_MINT;
    const outputMint = params.side === 'sell' ? SOL_MINT : params.tokenAddress;
    
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${Math.floor(params.slippage * 100)}`;
    
    const quoteResponse = await fetch(quoteUrl, {
      headers: JUPITER_API_KEY ? { Authorization: `Bearer ${JUPITER_API_KEY}` } : {},
    });
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      return { txHash: '', price: 0, error: `❌ فشل جلب سعر Jupiter: ${errorText}` };
    }
    
    const quote = await quoteResponse.json();
    
    if (!quote || !quote.outAmount) {
      return { txHash: '', price: 0, error: '❌ لا توجد أسعار من Jupiter' };
    }
    
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
      return { txHash: '', price: 0, error: `❌ فشل تنفيذ Jupiter: ${errorText}` };
    }
    
    const swapData = await swapResponse.json();
    
    if (!swapData || !swapData.swapTransaction) {
      return { txHash: '', price: 0, error: '❌ لا توجد معاملة من Jupiter' };
    }
    
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    );
    
    transaction.sign([keypair]);
    
    const connection = new Connection(getWorkingRpcUrl(), 'confirmed');
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      return { txHash: '', price: 0, error: `❌ فشل تأكيد المعاملة: ${JSON.stringify(confirmation.value.err)}` };
    }
    
    const outAmount = parseFloat(quote.outAmount) / 1e9;
    const price = params.side === 'buy' 
      ? params.amountInSol / outAmount 
      : outAmount / params.amountInSol;
    
    return {
      txHash: signature,
      price,
      error: null,
    };
  } catch (error) {
    return {
      txHash: '',
      price: 0,
      error: error instanceof Error ? error.message : '❌ خطأ غير معروف في Jupiter',
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
    return { txHash: '', price: 0, error: `❌ شبكة غير مدعومة: ${params.network}` };
  }
  
  try {
    const wallet = params.privateKey 
      ? new ethers.Wallet(params.privateKey)
      : KeyCacheManager.getEvmWallet(params.network);
    
    const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const srcToken = params.side === 'buy' ? NATIVE_TOKEN : params.tokenAddress;
    const destToken = params.side === 'buy' ? params.tokenAddress : NATIVE_TOKEN;
    const amountWei = ethers.parseEther(params.amount.toString()).toString();
    
    const priceUrl = `https://api.paraswap.io/prices?srcToken=${srcToken}&destToken=${destToken}&amount=${amountWei}&side=${params.side === 'buy' ? 'SELL' : 'BUY'}&network=${chainId}`;
    
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      return { txHash: '', price: 0, error: `❌ فشل جلب السعر: ${priceResponse.status}` };
    }
    
    const priceData = await priceResponse.json();
    
    const swapUrl = `https://api.paraswap.io/transactions/${chainId}`;
    const swapResponse = await fetch(swapUrl, {
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
    });
    
    if (!swapResponse.ok) {
      return { txHash: '', price: 0, error: `❌ فشل التنفيذ: ${swapResponse.status}` };
    }
    
    const swapData = await swapResponse.json();
    
    const provider = new ethers.JsonRpcProvider(
      `https://rpc.ankr.com/${params.network}/${ANKR_KEY}`
    );
    const connectedWallet = wallet.connect(provider);
    
    const tx = await connectedWallet.sendTransaction({
      to: swapData.to,
      data: swapData.data,
      value: swapData.value ? BigInt(swapData.value) : undefined,
    });
    
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      return { txHash: '', price: 0, error: '❌ فشلت المعاملة على الشبكة' };
    }
    
    const price = parseFloat(priceData.destAmount) / parseFloat(priceData.srcAmount);
    
    return {
      txHash: tx.hash,
      price,
      error: null,
    };
  } catch (error) {
    return {
      txHash: '',
      price: 0,
      error: error instanceof Error ? error.message : '❌ خطأ غير معروف',
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
    
    const connection = new Connection(getWorkingRpcUrl(), 'confirmed');
    const fromPubkey = new PublicKey(params.fromAddress);
    const toPubkey = new PublicKey(params.toAddress);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(params.amount * LAMPORTS_PER_SOL),
      })
    );
    
    const signature = await connection.sendTransaction(transaction, [keypair]);
    await connection.confirmTransaction(signature);
    
    return { txHash: signature, error: null };
  } catch (error) {
    return {
      txHash: '',
      error: error instanceof Error ? error.message : '❌ خطأ في إرسال الأموال',
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
    
    await tx.wait();
    return { txHash: tx.hash, error: null };
  } catch (error) {
    return {
      txHash: '',
      error: error instanceof Error ? error.message : '❌ خطأ في إرسال الأموال',
    };
  }
}

// ============================================================
// 🤖 BotWalletManager
// ============================================================

export class BotWalletManager {
  private static instance: BotWalletManager;
  private wallets: BotWalletData[] = [];
  private balanceCache: Map<string, { balance: number; timestamp: number }> = new Map();
  
  private constructor() {
    console.log('🔑 BotWalletManager initialized');
  }
  
  static getInstance(): BotWalletManager {
    if (!BotWalletManager.instance) {
      BotWalletManager.instance = new BotWalletManager();
    }
    return BotWalletManager.instance;
  }
  
  async init(network: string = 'solana'): Promise<BotWalletData> {
    const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism'];
    
    if (!VALID_NETWORKS.includes(network)) {
      throw new Error(`شبكة غير صالحة: ${network}`);
    }
    
    const result = await madarRead<BotWalletData>('bot_wallet', {});
    this.wallets = result.success && result.data ? result.data : [];
    
    this.wallets = this.wallets.filter(w => {
      if (w.network === 'solana') {
        return isValidSolanaAddress(w.address);
      }
      return w.address && w.address !== 'undefined' && w.address !== 'null';
    });
    
    let wallet = this.wallets.find(w => w.network === network);
    
    if (wallet && wallet.address) {
      console.log(`✅ تم تحميل محفظة ${network}:`, wallet.address);
      
      try {
        const decryptedKey = decrypt(wallet.encrypted_private_key, CONFIG.MASTER_PASSWORD);
        KeyCacheManager.set(network, decryptedKey);
        console.log(`🔓 تم فتح محفظة ${network} للتوقيع التلقائي`);
      } catch (error) {
        console.error(`❌ فشل فتح محفظة ${network}:`, error);
        
        // ✅ إنشاء محفظة جديدة إذا فشل فك التشفير
        console.log(`🔄 إنشاء محفظة جديدة لـ ${network}...`);
        const { address, privateKey } = createWallet(network);
        const encryptedKey = encrypt(privateKey, CONFIG.MASTER_PASSWORD);
        
        const newWallet: BotWalletData = {
          id: wallet.id || generateId(),
          bot_id: 'admin_wallet',
          address,
          encrypted_private_key: encryptedKey,
          network,
          balance: 0,
          created_at: wallet.created_at || getTimestamp(),
          updated_at: getTimestamp(),
        };
        
        await madarUpdate('bot_wallet', newWallet.id!, newWallet);
        
        this.wallets = this.wallets.filter(w => w.network !== network);
        this.wallets.push(newWallet);
        
        KeyCacheManager.set(network, privateKey);
        
        console.log(`✅ تم إنشاء محفظة جديدة لـ ${network}:`, address);
        return newWallet;
      }
      
      try {
        const balance = await getWalletBalance(network, wallet.address);
        wallet.balance = balance;
        await this.updateWallet(wallet);
      } catch (error) {
        console.warn(`⚠️ فشل تحديث رصيد ${network}:`, error);
        wallet.balance = 0;
      }
      
      return wallet;
    }
    
    console.log(`⚠️ لا توجد محفظة لـ ${network}، جاري إنشاء محفظة جديدة...`);
    
    const { address, privateKey } = createWallet(network);
    
    if (!address || address === 'undefined' || address === 'null') {
      console.error(`❌ فشل إنشاء عنوان ${network}`);
      throw new Error(`فشل إنشاء عنوان ${network}`);
    }
    
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
    
    KeyCacheManager.set(network, privateKey);
    
    console.log(`✅ تم إنشاء وفتح محفظة ${network}:`, address);
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
    
    console.log('✅ تم تهيئة جميع الشبكات بنجاح');
    console.log('🔓 المحافظ المفتوحة:', KeyCacheManager.getUnlockedNetworks().join(', '));
  }
  
  private async saveWallet(wallet: BotWalletData): Promise<void> {
    await madarCreate('bot_wallet', wallet);
  }
  
  private async updateWallet(wallet: BotWalletData): Promise<void> {
    if (!wallet.id) return;
    wallet.updated_at = getTimestamp();
    await madarUpdate('bot_wallet', wallet.id, wallet);
  }
  
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
      
      if (!KeyCacheManager.isUnlocked(network)) {
        throw new Error(`❌ محفظة ${network} مقفلة`);
      }
      
      const balance = await this.getCachedBalance(network);
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
        throw new Error(`❌ محفظة ${network} مقفلة`);
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
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.toAddress,
        network: params.network,
      };
    }
  }
  
  async executeBuyForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage?: number;
    network?: string;
  }): Promise<TradeResult> {
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
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
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
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        network: params.network,
      };
    }
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
  KeyCacheManager.clear();
  
  console.log('🔄 تم إعادة تعيين تهيئة المحافظ');
}

export { KeyCacheManager, CONFIG };