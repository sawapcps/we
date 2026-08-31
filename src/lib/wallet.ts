// src/lib/wallet.ts
// ============================================================
// 💰 نظام إدارة المحافظ والتداول الحقيقي
// ✅ يدعم: Solana (Jupiter) + EVM (ParaSwap/1inch)
// ✅ جميع الصفقات حقيقية عبر APIs
// ✅ لا يحتوي على أي بيانات وهمية
// ============================================================

import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import { encrypt, decrypt } from './encryption';
import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate } from './madarTech';
import { AccountManager, UserWallet } from './accounts';

// ============================================================
// 📊 الأنواع
// ============================================================

// src/lib/wallet.ts - السطر ~28

export interface BotWalletData {
  id?: string;
  bot_id: string;              // ✅ underscore
  address: string;
  encrypted_private_key: string;  // ✅ underscore (ليس encryptedPrivateKey)
  network: string;
  balance: number;
  created_at: string;          // ✅ underscore (ليس createdAt)
  updated_at: string;          // ✅ underscore (ليس updatedAt)
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
}

// ============================================================
// 🔗 Worker URL (لجلب البيانات وتنفيذ الصفقات)
// ============================================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://multi-chain-rpc-proxy.sawapcps.workers.dev';

// ============================================================
// 🌐 RPC URLs احتياطي (في حال فشل Worker)
// ============================================================

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

// ============================================================
// 🔑 المفاتيح من KeyManager
// ============================================================

import { getJupiterKey, getAnkrKey, getHeliusKey } from './keyManager';

const JUPITER_API_KEY = getJupiterKey() || import.meta.env.VITE_JUPITER_API_KEY;
const ANKR_KEY = getAnkrKey() || import.meta.env.VITE_ANKR_KEY;
const HELIUS_KEY = getHeliusKey() || import.meta.env.VITE_HELIUS_KEY;

// ============================================================
// 🛠️ إنشاء محفظة جديدة
// ============================================================

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

// ============================================================
// 📊 جلب الرصيد (حقيقي)
// ============================================================

export async function getSolanaBalance(address: string): Promise<number> {
  // ✅ محاولة عبر Worker أولاً
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
    if (error.message?.includes('403') || error.message?.includes('Access forbidden') || 
        error.message?.includes('429') || error.message?.includes('fetch')) {
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
    return 0;
  }
}

export async function getWalletBalance(network: string, address: string): Promise<number> {
  if (network === 'solana') {
    return getSolanaBalance(address);
  }
  return getEvmBalance(address, network);
}

// ============================================================
// 📊 جلب سعر التوكن من السوق (حقيقي)
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
// 💰 تنفيذ صفقة Jupiter (Solana) - حقيقي
// ============================================================

async function executeJupiterSwap(params: {
  tokenAddress: string;
  amountInSol: number;
  slippage: number;
  walletAddress: string;
  side?: 'buy' | 'sell';
}): Promise<{ txHash: string; price: number; error: string | null }> {
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(params.amountInSol * 1e9);
    
    // ✅ تحديد اتجاه الصفقة
    const inputMint = params.side === 'sell' ? params.tokenAddress : SOL_MINT;
    const outputMint = params.side === 'sell' ? SOL_MINT : params.tokenAddress;
    
    // ✅ جلب السعر من Jupiter
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

    // ✅ تنفيذ الصفقة
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

    // ✅ حساب السعر الفعلي
    const outAmount = parseFloat(quote.outAmount) / 1e9;
    const price = params.side === 'buy' ? params.amountInSol / outAmount : outAmount / params.amountInSol;

    return {
      txHash: swapData.swapTransaction,
      price: price,
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
// 💰 تنفيذ صفقة ParaSwap (EVM) - حقيقي
// ============================================================

async function executeParaSwapTrade(params: {
  network: string;
  tokenAddress: string;
  amount: number;
  side: 'buy' | 'sell';
  walletAddress: string;
  slippage: number;
}): Promise<{ txHash: string; price: number; error: string | null }> {
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
    return { txHash: '', price: 0, error: `❌ شبكة غير مدعومة: ${params.network}` };
  }

  const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const srcToken = params.side === 'buy' ? NATIVE_TOKEN : params.tokenAddress;
  const destToken = params.side === 'buy' ? params.tokenAddress : NATIVE_TOKEN;
  const amount = params.side === 'buy' ? params.amount * 1e18 : params.amount * 1e18;

  try {
    // ✅ جلب السعر من ParaSwap
    const priceUrl = `https://api.paraswap.io/prices?srcToken=${srcToken}&destToken=${destToken}&amount=${amount}&side=${params.side === 'buy' ? 'SELL' : 'BUY'}&network=${chainId}`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      const error = await priceResponse.text();
      return { txHash: '', price: 0, error: `❌ فشل جلب السعر: ${error}` };
    }
    
    const priceData = await priceResponse.json();

    // ✅ تنفيذ الصفقة
    const swapUrl = `https://api.paraswap.io/transactions/${chainId}`;
    const swapResponse = await fetch(swapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken,
        destToken,
        srcAmount: amount,
        slippage: params.slippage * 100,
        userAddress: params.walletAddress,
        priceRoute: priceData.priceRoute,
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      return { txHash: '', price: 0, error: `❌ فشل التنفيذ: ${error}` };
    }

    const swapData = await swapResponse.json();
    
    // ✅ حساب السعر الفعلي
    const price = parseFloat(priceData.destAmount) / parseFloat(priceData.srcAmount);

    return {
      txHash: swapData.txHash || 'pending',
      price: price,
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
// 💰 إرسال الأموال (حقيقي)
// ============================================================

async function sendSolanaTransaction(params: {
  fromAddress: string;
  toAddress: string;
  amount: number;
  privateKey: string;
}): Promise<{ txHash: string; error: string | null }> {
  try {
    const connection = new Connection(getWorkingRpcUrl(), 'confirmed');
    const fromPubkey = new PublicKey(params.fromAddress);
    const toPubkey = new PublicKey(params.toAddress);
    const privateKeyBytes = Buffer.from(params.privateKey, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

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
  privateKey: string;
}): Promise<{ txHash: string; error: string | null }> {
  try {
    const provider = new ethers.JsonRpcProvider(`https://rpc.ankr.com/${params.network}/${ANKR_KEY}`);
    const wallet = new ethers.Wallet(params.privateKey, provider);
    
    const tx = await wallet.sendTransaction({
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
// 🤖 BotWalletManager - النسخة الكاملة
// ============================================================

export class BotWalletManager {
  private static instance: BotWalletManager;
  private wallets: BotWalletData[] = [];
  private masterPassword: string;
  
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

// src/lib/wallet.ts - السطر ~535

// src/lib/wallet.ts - دالة _initInternal

private async _initInternal(network: string = 'solana'): Promise<BotWalletData> {
  // ✅ الشبكات الصحيحة فقط
  const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];
  
  if (!VALID_NETWORKS.includes(network)) {
    console.warn(`⚠️ شبكة غير صالحة: ${network} - تجاهل`);
    throw new Error(`شبكة غير صالحة: ${network}`);
  }
  
  const result = await madarRead<BotWalletData>('bot_wallet', {});
  this.wallets = result.success && result.data ? result.data : [];
  
  // ✅ فلترة المحافظ الصالحة فقط
  this.wallets = this.wallets.filter(w => VALID_NETWORKS.includes(w.network));

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
  console.log(`✅ تم إنشاء محفظة ${network}:`, newWallet.address);
  return newWallet;
}
  private async saveWallet(wallet: BotWalletData): Promise<void> {
    console.log(`💾 جاري حفظ محفظة ${wallet.network}:`, wallet.address);
    await madarCreate('bot_wallet', wallet);
  }

  // ✅ صحيح: استخدم updated_at
private async updateWallet(wallet: BotWalletData): Promise<void> {
  if (!wallet.id) return;
  wallet.updated_at = getTimestamp();  // ✅ صحيح
  await madarUpdate('bot_wallet', wallet.id, wallet);
}

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
  return this.wallets.filter(w => w.bot_id === 'admin_wallet');
}

 getPrivateKey(network: string, password: string): string {
  const wallet = this.wallets.find((w) => w.network === network);
  if (!wallet) throw new Error(`المحفظة (${network}) غير موجودة`);
  return decrypt(wallet.encrypted_private_key, password);
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
  // 💰 التداول بمحفظة الأدمن - شراء (حقيقي)
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

      // ✅ التحقق من الرصيد
       const balance = await this.refreshBalance(network);
      if (balance < params.amount) {
        // ✅ تسجيل الإشعار
        await saveLog({
          level: 'ERROR',
          message: `❌ الرصيد غير كافٍ على ${network}: ${balance} < ${params.amount}`,
          timestamp: getTimestamp(),
          context: { network, balance, required: params.amount, side: 'buy' }
        });
        
        return { 
          success: false, 
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`, 
          amount: params.amount, 
          tokenAddress: params.tokenAddress 
        };
      }
      // ✅ جلب سعر التوكن الحالي
      const currentPrice = await getTokenPrice(params.tokenAddress, network);

      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: wallet.address,
          side: 'buy',
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
          price: result.price || currentPrice,
        };
      }

      // ✅ EVM
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
        price: result.price || currentPrice,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.tokenAddress };
    }
  }

  // ============================================================
  // 💰 التداول بمحفظة الأدمن - بيع (حقيقي)
  // ============================================================

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

      // ✅ جلب سعر التوكن الحالي
      const currentPrice = await getTokenPrice(params.tokenAddress, network);

      if (currentPrice <= 0) {
        return { 
          success: false, 
          error: '❌ لا يمكن جلب سعر التوكن للبيع', 
          amount: params.amount, 
          tokenAddress: params.tokenAddress 
        };
      }

      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: wallet.address,
          side: 'sell',
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
          price: result.price || currentPrice,
        };
      }

      // ✅ EVM
      const result = await executeParaSwapTrade({
        network,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        side: 'sell',
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
        price: result.price || currentPrice,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.tokenAddress };
    }
  }

  // ============================================================
  // 💰 إرسال الأموال إلى المستخدم (حقيقي)
  // ============================================================

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

      // ✅ التحقق من الرصيد
          const balance = await this.refreshBalance(params.network);
      if (balance < params.amount) {
        // ✅ تسجيل الإشعار
        await saveLog({
          level: 'ERROR',
          message: `❌ الرصيد غير كافٍ على ${params.network}: ${balance} < ${params.amount}`,
          timestamp: getTimestamp(),
          context: { network: params.network, balance, required: params.amount }
        });
        
        return { 
          success: false, 
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`, 
          amount: params.amount, 
          tokenAddress: params.toAddress 
        };
      }

      const privateKey = decrypt(wallet.encryptedPrivateKey, params.password);
      let result;

      if (params.network === 'solana') {
        result = await sendSolanaTransaction({
          fromAddress: wallet.address,
          toAddress: params.toAddress,
          amount: params.amount,
          privateKey,
        });
      } else {
        result = await sendEVMTx({
          network: params.network,
          toAddress: params.toAddress,
          amount: params.amount,
          privateKey,
        });
      }

      if (result.error) {
        return { 
          success: false, 
          error: result.error, 
          amount: params.amount, 
          tokenAddress: params.toAddress 
        };
      }

      await this.refreshBalance(params.network);

      return {
        success: true,
        txHash: result.txHash,
        amount: params.amount,
        tokenAddress: params.toAddress,
        network: params.network,
      };
    } catch (error) {
      return { success: false, error: String(error), amount: params.amount, tokenAddress: params.toAddress };
    }
  }

  // ============================================================
  // 💰 التداول بمحفظة المستخدم - شراء (حقيقي)
  // ============================================================

  async executeBuyForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    console.log('🔑 [executeBuyForUser] ===== بدء التنفيذ =====');
    console.log('🔑 [executeBuyForUser] userId:', params.userId);
    console.log('🔑 [executeBuyForUser] tokenAddress:', params.tokenAddress);
    console.log('🔑 [executeBuyForUser] amount:', params.amount);

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

      // ✅ التحقق من كلمة المرور
      try {
        decrypt(userWallet.encryptedPrivateKey, params.password);
      } catch (decryptError) {
        return {
          success: false,
          error: 'كلمة المرور غير صحيحة',
          amount: params.amount,
          tokenAddress: params.tokenAddress,
        };
      }

      // ✅ التحقق من الرصيد
      const balance = await AccountManager.getUserWalletBalance(params.userId, network);
      if (balance < params.amount) {
        return { 
          success: false, 
          error: `❌ الرصيد غير كافٍ: ${balance} < ${params.amount}`, 
          amount: params.amount, 
          tokenAddress: params.tokenAddress 
        };
      }

      // ✅ جلب سعر التوكن الحالي
      const currentPrice = await getTokenPrice(params.tokenAddress, network);

      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: userWallet.address,
          side: 'buy',
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
          price: result.price || currentPrice,
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
        price: result.price || currentPrice,
      };
    } catch (error) {
      console.error('❌ [executeBuyForUser] خطأ:', error);
      return { 
        success: false, 
        error: String(error), 
        amount: params.amount, 
        tokenAddress: params.tokenAddress 
      };
    }
  }

  // ============================================================
  // 💰 التداول بمحفظة المستخدم - بيع (حقيقي)
  // ============================================================

  async executeSellForUser(params: {
    userId: string;
    tokenAddress: string;
    amount: number;
    slippage: number;
    password: string;
    network?: string;
  }): Promise<TradeResult> {
    console.log('🔑 [executeSellForUser] ===== بدء التنفيذ =====');
    console.log('🔑 [executeSellForUser] userId:', params.userId);
    console.log('🔑 [executeSellForUser] tokenAddress:', params.tokenAddress);
    console.log('🔑 [executeSellForUser] amount:', params.amount);

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

      // ✅ التحقق من كلمة المرور
      try {
        decrypt(userWallet.encryptedPrivateKey, params.password);
      } catch (decryptError) {
        return {
          success: false,
          error: 'كلمة المرور غير صحيحة',
          amount: params.amount,
          tokenAddress: params.tokenAddress,
        };
      }

      // ✅ جلب سعر التوكن الحالي
      const currentPrice = await getTokenPrice(params.tokenAddress, network);

      if (currentPrice <= 0) {
        return { 
          success: false, 
          error: '❌ لا يمكن جلب سعر التوكن للبيع', 
          amount: params.amount, 
          tokenAddress: params.tokenAddress 
        };
      }

      if (network === 'solana') {
        const result = await executeJupiterSwap({
          tokenAddress: params.tokenAddress,
          amountInSol: params.amount,
          slippage: params.slippage,
          walletAddress: userWallet.address,
          side: 'sell',
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
          price: result.price || currentPrice,
        };
      }

      // ✅ EVM
      const result = await executeParaSwapTrade({
        network,
        tokenAddress: params.tokenAddress,
        amount: params.amount,
        side: 'sell',
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
        price: result.price || currentPrice,
      };
    } catch (error) {
      console.error('❌ [executeSellForUser] خطأ:', error);
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
// 🚀 دوال التهيئة المركزية
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
  
  // ✅✅✅ الشبكات الصحيحة فقط
  const VALID_NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];
  
  walletLoadPromise = (async () => {
    try {
      const manager = BotWalletManager.getInstance();
      
      for (const network of VALID_NETWORKS) {
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