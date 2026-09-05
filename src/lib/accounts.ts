// src/lib/accounts.ts
// ============================================================
// 👤 نظام إدارة الحسابات والمستخدمين (محلي بالكامل)
// ✅ يعتمد على localStorage عبر دوال madar...
// ✅ يدعم إنشاء محافظ صالحة (Solana / EVM)
// ✅ إصلاح مشكلة العنوان undefined
// ============================================================

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete } from './madarTech';
import { encrypt, decrypt } from './encryption';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

// ============================================================
// 📊 الأنواع
// ============================================================

export interface UserAccount {
  id: string;
  email: string;
  password: string;
  username: string;
  isAdmin: boolean;
  balance: number;
  walletAddress: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface UserWallet {
  id: string;
  userId: string;
  network: string;
  address: string;
  encryptedPrivateKey: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRADE' | 'TRANSFER_TO_BOT' | 'TRANSFER_FROM_BOT';
  amount: number;
  balanceAfter: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

// ============================================================
// 🔐 دوال التشفير
// ============================================================

const SALT = 'madartech_account_salt_2024';
const WALLET_KEY_SALT = 'user_wallet_key_salt_2024';

function hashPassword(password: string): string {
  return encrypt(password, SALT);
}

function verifyPassword(plain: string, hashed: string): boolean {
  try {
    const decrypted = decrypt(hashed, SALT);
    return decrypted === plain;
  } catch {
    return false;
  }
}

// ============================================================
// 🔑 إنشاء محفظة مباشرة (بدون استيراد دائري)
// ============================================================

function createWalletDirect(network: string): { address: string; privateKey: string } {
  console.log(`🔑 إنشاء محفظة مباشرة لـ ${network}...`);
  
  if (network === 'solana') {
    try {
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();
      const privateKey = Buffer.from(keypair.secretKey).toString('hex');
      
      console.log('✅ عنوان Solana:', address);
      console.log('✅ طول المفتاح:', privateKey.length);
      
      if (!address || address === 'undefined' || address === 'null') {
        throw new Error('العنوان غير صالح');
      }
      
      return { address, privateKey };
    } catch (error) {
      console.error('❌ فشل إنشاء محفظة Solana:', error);
      throw error;
    }
  } else {
    try {
      const wallet = ethers.Wallet.createRandom();
      console.log('✅ عنوان EVM:', wallet.address);
      return { address: wallet.address, privateKey: wallet.privateKey };
    } catch (error) {
      console.error(`❌ فشل إنشاء محفظة ${network}:`, error);
      throw error;
    }
  }
}

// ============================================================
// 👤 دوال المستخدمين
// ============================================================

export class AccountManager {
  // ✅ إنشاء حساب جديد
  static async createAccount(
    email: string,
    password: string,
    walletAddress: string = ''
  ): Promise<UserAccount> {
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error('البريد الإلكتروني مستخدم بالفعل');
    }

    const user: UserAccount = {
      id: generateId(),
      email: email.toLowerCase().trim(),
      password: hashPassword(password),
      username: email.split('@')[0],
      isAdmin: false,
      balance: 0,
      walletAddress: walletAddress || '',
      status: 'active',
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('users', user);
    return user;
  }

  // ✅ التحقق من كلمة المرور
  static async verifyPassword(email: string, password: string): Promise<UserAccount | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    if (user.status !== 'active') return null;
    if (!verifyPassword(password, user.password)) return null;
    return user;
  }

  // ✅ جلب مستخدم بواسطة البريد الإلكتروني
  static async getUserByEmail(email: string): Promise<UserAccount | null> {
    const result = await madarRead<UserAccount>('users', {
      where: { email: email.toLowerCase().trim() },
    });
    if (result.success && result.data) {
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return data || null;
    }
    return null;
  }

  // ✅ جلب مستخدم بواسطة المعرف
  static async getUserById(id: string): Promise<UserAccount | null> {
    const result = await madarRead<UserAccount>('users', {
      where: { id },
    });
    if (result.success && result.data) {
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return data || null;
    }
    return null;
  }

  // ✅ تحديث بيانات المستخدم
  static async updateUser(id: string, data: Partial<UserAccount>): Promise<void> {
    await madarUpdate('users', id, {
      ...data,
      updatedAt: getTimestamp(),
    });
  }

  // ✅ حذف المستخدم
  static async deleteUser(id: string): Promise<void> {
    await madarDelete('users', id);
  }

  // ✅ جلب جميع المستخدمين
  static async getAllUsers(): Promise<UserAccount[]> {
    const result = await madarRead<UserAccount>('users');
    if (result.success && result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    return [];
  }

  // ✅ جلب إحصائيات المستخدم
  static async getUserStats(userId: string): Promise<{
    totalProfit: number;
    totalFees: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netBalance: number;
    feePercentage: number;
    tradesCount: number;
  } | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const tradesResult = await madarRead<any>('trades', {
      where: { userId },
    });
    const trades = tradesResult.success && tradesResult.data
      ? (Array.isArray(tradesResult.data) ? tradesResult.data : [tradesResult.data])
      : [];

    const totalTrades = trades.length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const netBalance = user.balance;

    return {
      totalProfit,
      totalFees: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      netBalance,
      feePercentage: 0,
      tradesCount: totalTrades,
    };
  }

  // ✅ إحصائيات النظام
  static async getSystemStats(): Promise<{
    totalUsers: number;
    totalTrades: number;
    totalVolume: number;
    totalProfit: number;
    activeUsers: number;
  }> {
    const usersResult = await madarRead<UserAccount>('users');
    const users = usersResult.success && usersResult.data
      ? (Array.isArray(usersResult.data) ? usersResult.data : [usersResult.data])
      : [];

    const tradesResult = await madarRead<any>('trades');
    const trades = tradesResult.success && tradesResult.data
      ? (Array.isArray(tradesResult.data) ? tradesResult.data : [tradesResult.data])
      : [];

    const totalVolume = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const activeUsers = users.filter(u => u.status === 'active').length;

    return {
      totalUsers: users.length,
      totalTrades: trades.length,
      totalVolume,
      totalProfit,
      activeUsers,
    };
  }

  // ============================================================
  // 💰 دوال المحافظ للمستخدمين
  // ============================================================

  // ✅ إنشاء محفظة للمستخدم
  static async createUserWallet(
    userId: string,
    network: string,
    address?: string,
    encryptedPrivateKey?: string
  ): Promise<UserWallet> {
    console.log(`💳 بدء إنشاء محفظة ${network} للمستخدم ${userId}...`);
    
    // التحقق من وجود محفظة بنفس الشبكة
    const existing = await this.getUserWallet(userId, network);
    if (existing) {
      console.log(`⚠️ المحفظة موجودة مسبقاً: ${existing.address}`);
      return existing;
    }

    let walletAddress = address;
    let privKey = encryptedPrivateKey;

    if (!walletAddress || walletAddress === 'undefined' || walletAddress === 'null') {
      // ✅ إنشاء محفظة جديدة مباشرة
      const newWallet = createWalletDirect(network);
      walletAddress = newWallet.address;
      privKey = newWallet.privateKey;
      console.log(`✅ تم إنشاء عنوان ${network}:`, walletAddress);
    }

    // التحقق النهائي من العنوان
    if (!walletAddress || walletAddress === 'undefined' || walletAddress === 'null') {
      console.error('❌ العنوان فارغ بعد الإنشاء');
      throw new Error('فشل إنشاء عنوان المحفظة');
    }

    // تشفير المفتاح الخاص
    const encryptedKey = privKey ? encrypt(privKey, WALLET_KEY_SALT) : '';

    const wallet: UserWallet = {
      id: generateId(),
      userId,
      network,
      address: walletAddress,
      encryptedPrivateKey: encryptedKey,
      balance: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('user_wallets', wallet);
    console.log(`✅ تم إنشاء محفظة ${network} بنجاح:`, walletAddress);
    return wallet;
  }

  // ✅ جلب محفظة المستخدم لشبكة معينة
  static async getUserWallet(userId: string, network: string): Promise<UserWallet | null> {
    const result = await madarRead<UserWallet>('user_wallets', {
      where: { userId, network },
    });
    if (result.success && result.data) {
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return data || null;
    }
    return null;
  }

  // ✅ جلب جميع محافظ المستخدم
  static async getAllUserWallets(userId: string): Promise<UserWallet[]> {
    const result = await madarRead<UserWallet>('user_wallets', {
      where: { userId },
    });
    if (result.success && result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    return [];
  }

  // ✅ تحديث رصيد محفظة المستخدم
  static async updateUserWalletBalance(
    userId: string,
    network: string,
    newBalance: number
  ): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return;
    await madarUpdate('user_wallets', wallet.id, {
      balance: newBalance,
      updatedAt: getTimestamp(),
    });
  }

  // ✅ جلب رصيد المستخدم
  static async getUserWalletBalance(
    userId: string,
    network: string,
    address?: string
  ): Promise<number> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return 0;
    return wallet.balance;
  }

  // ✅ حذف محفظة مستخدم
  static async deleteUserWallet(userId: string, network: string): Promise<{ success: boolean; error?: string }> {
    try {
      const wallet = await this.getUserWallet(userId, network);
      if (!wallet) {
        return { success: false, error: `لا توجد محفظة على ${network}` };
      }

      await madarDelete('user_wallets', wallet.id);

      const key = `madartech_user_wallets_${wallet.id}`;
      localStorage.removeItem(key);

      console.log(`✅ تم حذف محفظة ${network} للمستخدم ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ فشل حذف المحفظة:', error);
      return { success: false, error: String(error) };
    }
  }

  // ✅ حذف جميع محافظ المستخدم
  static async deleteAllUserWallets(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const wallets = await this.getAllUserWallets(userId);
      const count = wallets.length;

      for (const wallet of wallets) {
        await madarDelete('user_wallets', wallet.id);
        const key = `madartech_user_wallets_${wallet.id}`;
        localStorage.removeItem(key);
      }

      console.log(`🗑️ تم حذف ${count} محفظة للمستخدم ${userId}`);
      return { success: true, count };
    } catch (error) {
      console.error('❌ فشل حذف المحافظ:', error);
      return { success: false, count: 0, error: String(error) };
    }
  }

  // ============================================================
  // 📊 دوال الصفقات والمعاملات
  // ============================================================

  // ✅ إضافة معاملة جديدة
  static async addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> {
    const tx: Transaction = {
      id: generateId(),
      ...transaction,
      createdAt: getTimestamp(),
    };
    await madarCreate('transactions', tx);
  }

  // ✅ جلب معاملات المستخدم
  static async getTransactions(userId: string): Promise<Transaction[]> {
    const result = await madarRead<Transaction>('transactions', {
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (result.success && result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    return [];
  }

  // ============================================================
  // 📊 دوال إضافية
  // ============================================================

  static async canUserTrade(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    return user.status === 'active';
  }

  static async getRemainingTrades(userId: string): Promise<number> {
    const tradesResult = await madarRead<any>('trades', {
      where: { userId },
    });
    const trades = tradesResult.success && tradesResult.data
      ? (Array.isArray(tradesResult.data) ? tradesResult.data : [tradesResult.data])
      : [];
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = trades.filter(t => t.createdAt?.startsWith(today));
    const maxTrades = 10;
    return Math.max(0, maxTrades - todayTrades.length);
  }

  static async incrementUserTrades(userId: string): Promise<void> {
    // لا نحتاج إلى تخزين منفصل
  }

  static async addProfit(
    userId: string,
    profit: number,
    details?: { token?: string; amount?: number; price?: number; txHash?: string; network?: string }
  ): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;
    const newBalance = (user.balance || 0) + profit;
    await this.updateUser(userId, { balance: newBalance });
    await this.addTransaction({
      userId,
      type: 'TRADE',
      amount: profit,
      balanceAfter: newBalance,
      description: `💰 ربح من تداول ${details?.token || 'عملة'}`,
      status: 'completed',
    });
  }
}

export default AccountManager;