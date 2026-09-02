// src/lib/accounts.ts
// ============================================================
// 👤 نظام إدارة الحسابات والمستخدمين (محلي بالكامل)
// ✅ يعتمد على localStorage عبر دوال madar...
// ✅ لا يحتوي على أي اتصال خارجي (Worker / D1)
// ============================================================

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete } from './madarTech';
import { encrypt, decrypt } from './encryption';

// ============================================================
// 📊 الأنواع
// ============================================================

export interface UserAccount {
  id: string;
  email: string;
  password: string; // مشفرة
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
// 🔐 دوال التشفير (لكلمة المرور)
// ============================================================

const SALT = 'madartech_account_salt_2024';

function hashPassword(password: string): string {
  // باستخدام نفس دالة encryption مع كلمة مرور ثابتة
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

    // ✅ جلب الصفقات من localStorage
    const tradesResult = await madarRead<any>('trades', {
      where: { userId },
    });
    const trades = tradesResult.success && tradesResult.data
      ? (Array.isArray(tradesResult.data) ? tradesResult.data : [tradesResult.data])
      : [];

    const totalTrades = trades.length;
    const totalProfit = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalDeposited = 0; // يمكن توسيعه لاحقاً
    const totalWithdrawn = 0;
    const totalFees = 0;
    const feePercentage = 0;
    const netBalance = user.balance;

    return {
      totalProfit,
      totalFees,
      totalDeposited,
      totalWithdrawn,
      netBalance,
      feePercentage,
      tradesCount: totalTrades,
    };
  }

  // ============================================================
  // 💰 دوال المحافظ (للمستخدمين)
  // ============================================================

  // ✅ إنشاء محفظة للمستخدم
  static async createUserWallet(
    userId: string,
    network: string,
    address?: string,
    encryptedPrivateKey?: string
  ): Promise<UserWallet> {
    // التحقق من وجود محفظة بنفس الشبكة
    const existing = await this.getUserWallet(userId, network);
    if (existing) {
      return existing;
    }

    const wallet: UserWallet = {
      id: generateId(),
      userId,
      network,
      address: address || `0x${generateId()}`,
      encryptedPrivateKey: encryptedPrivateKey || `encrypted_${generateId()}`,
      balance: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('user_wallets', wallet);
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

  // ✅ جلب رصيد المستخدم على شبكة معينة
  static async getUserWalletBalance(
    userId: string,
    network: string,
    address?: string
  ): Promise<number> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return 0;
    // يمكن تحديث الرصيد من السلسلة (عبر Worker) لكننا نكتفي بالمخزن محلياً
    return wallet.balance;
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
  // 📊 دوال إضافية (للتوافق مع الكود القديم)
  // ============================================================

  // ✅ هل يمكن للمستخدم التداول؟
  static async canUserTrade(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    return user.status === 'active';
  }

  // ✅ عدد الصفقات المتبقية (محاكاة)
  static async getRemainingTrades(userId: string): Promise<number> {
    const tradesResult = await madarRead<any>('trades', {
      where: { userId },
    });
    const trades = tradesResult.success && tradesResult.data
      ? (Array.isArray(tradesResult.data) ? tradesResult.data : [tradesResult.data])
      : [];
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = trades.filter(t => t.createdAt?.startsWith(today));
    const maxTrades = 10; // حد افتراضي
    return Math.max(0, maxTrades - todayTrades.length);
  }

  // ✅ زيادة عدد صفقات المستخدم
  static async incrementUserTrades(userId: string): Promise<void> {
    // لا نحتاج إلى تخزين منفصل، يمكن حسابه من الصفقات
    // هذه الدالة للتوافق مع الكود القديم
  }

  // ✅ إضافة ربح للمستخدم
  static async addProfit(
    userId: string,
    profit: number,
    details?: { token?: string; amount?: number; price?: number; txHash?: string; network?: string }
  ): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) return;
    const newBalance = (user.balance || 0) + profit;
    await this.updateUser(userId, { balance: newBalance });
    // تسجيل كمعاملة
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