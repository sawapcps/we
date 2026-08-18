// src/lib/accounts.ts

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete } from './madarTech';
import { BotWalletManager } from './wallet';
import { encrypt, decrypt } from './encryption';
import { createWallet, getWalletBalance } from './wallet';

// ============ الأنواع ============

export interface UserAccount {
  id: string;
  email: string;
  password: string;
  username?: string;
  walletAddress: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalProfit: number;
  totalGrossProfit: number;
  totalFees: number;
  totalTrades: number;
  activeTrades: number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  status: 'active' | 'suspended' | 'pending';
  referralCode?: string;
  referredBy?: string;
  isAdmin?: boolean;
  
  // ✅ إضافات جديدة للحد الفردي
  maxTradesPerDay?: number; // عدد الصفقات المسموحة يومياً (تلقائي أو يدوي)
  tradesToday?: number;     // عدد الصفقات التي نفذها اليوم
  lastTradeDate?: string;   // تاريخ آخر صفقة (لإعادة تعيين العداد)
  tradeMode?: 'shared' | 'individual'; // وضع التداول
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRADE_BUY' | 'TRADE_SELL' | 'PROFIT' | 'FEE' | 'COMMISSION';
  amount: number;
  balanceAfter: number;
  txHash?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  metadata?: {
    tradeId?: string;
    token?: string;
    feePercentage?: number;
    grossProfit?: number;
    netProfit?: number;
    commissionAmount?: number;
  };
}

export interface TreasuryStats {
  id?: string;
  totalCollected: number;
  totalDistributed: number;
  currentBalance: number;
  pendingWithdrawals: number;
  totalTrades: number;
  lastUpdated: string;
}

export interface UserWallet {
  id?: string;
  userId: string;
  network: string;
  address: string;
  encryptedPrivateKey: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// ============ ثوابت النظام ============

export const COMMISSION_RATE = 0.15; // 15%
export const MIN_WITHDRAWAL = 0;      // لا حد أدنى
export const MAX_WITHDRAWAL = Infinity; // لا حد أقصى
export const DEFAULT_MAX_TRADES_PER_DAY = 10; // الحد الافتراضي للصفقات اليومية

// كلمة مرور الأدمن (مشفرة)
const ADMIN_PASSWORD_HASH = encrypt('12345678910', 'admin_salt_2024');
const ADMIN_EMAIL = 'admin@cryptobot.com';

// ============ إدارة الحسابات ============

export class AccountManager {
  /**
   * التحقق من أدمن
   */
  static async verifyAdmin(email: string, password: string): Promise<boolean> {
    if (email !== ADMIN_EMAIL) return false;
    try {
      const decrypted = decrypt(ADMIN_PASSWORD_HASH, 'admin_salt_2024');
      return decrypted === password;
    } catch {
      return false;
    }
  }

  /**
   * إنشاء حساب مستخدم جديد (مع تشفير كلمة المرور)
   */
  static async createAccount(email: string, password: string, walletAddress: string): Promise<UserAccount> {
    const existing = await madarRead<UserAccount>('users', { email });
    if (existing.success && existing.data && existing.data.length > 0) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل');
    }

    const encryptedPassword = encrypt(password, 'user_salt_2024');

    const account: UserAccount = {
      id: generateId(),
      email,
      password: encryptedPassword,
      walletAddress,
      balance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalProfit: 0,
      totalGrossProfit: 0,
      totalFees: 0,
      totalTrades: 0,
      activeTrades: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
      status: 'active',
      referralCode: generateId().toUpperCase().slice(0, 8),
      isAdmin: false,
      // ✅ إعدادات الحد الفردي
      maxTradesPerDay: DEFAULT_MAX_TRADES_PER_DAY,
      tradesToday: 0,
      lastTradeDate: getTimestamp().split('T')[0],
      tradeMode: 'shared',
    };

    await madarCreate('users', account);
    return account;
  }

  /**
   * التحقق من صحة كلمة المرور
   */
  static async verifyPassword(email: string, password: string): Promise<UserAccount | null> {
    const result = await madarRead<UserAccount>('users', { email });
    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    const user = result.data[0];
    try {
      const decrypted = decrypt(user.password, 'user_salt_2024');
      if (decrypted === password) {
        return user;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * جلب حساب مستخدم
   */
  static async getAccount(userId: string): Promise<UserAccount | null> {
    const result = await madarRead<UserAccount>('users', { id: userId });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * جلب حساب مستخدم بالبريد
   */
  static async getAccountByEmail(email: string): Promise<UserAccount | null> {
    const result = await madarRead<UserAccount>('users', { email });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * تحديث حساب المستخدم
   */
  static async updateAccount(userId: string, data: Partial<UserAccount>): Promise<void> {
    await madarUpdate('users', userId, { ...data, updatedAt: getTimestamp() });
  }

  /**
   * إيداع أموال للمستخدم
   */
  static async deposit(userId: string, amount: number, txHash: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const newBalance = account.balance + amount;
    account.balance = newBalance;
    account.totalDeposited += amount;
    account.updatedAt = getTimestamp();

    await this.updateAccount(userId, {
      balance: newBalance,
      totalDeposited: account.totalDeposited,
    });

    await this.addTransaction({
      userId,
      type: 'DEPOSIT',
      amount,
      balanceAfter: newBalance,
      txHash,
      description: `💰 إيداع $${amount.toFixed(2)}`,
      status: 'completed',
    });
  }

  /**
   * إضافة ربح مع خصم 15%
   */
  static async addProfit(
    userId: string,
    grossProfit: number,
    tradeDetails: {
      token: string;
      amount: number;
      price: number;
      txHash: string;
    }
  ): Promise<{ netProfit: number; commission: number }> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const commission = grossProfit * COMMISSION_RATE;
    const netProfit = grossProfit - commission;

    const newBalance = account.balance + netProfit;
    account.balance = newBalance;
    account.totalProfit += netProfit;
    account.totalGrossProfit += grossProfit;
    account.totalFees += commission;
    account.totalTrades += 1;
    account.updatedAt = getTimestamp();

    await this.updateAccount(userId, {
      balance: newBalance,
      totalProfit: account.totalProfit,
      totalGrossProfit: account.totalGrossProfit,
      totalFees: account.totalFees,
      totalTrades: account.totalTrades,
    });

    await this.addTransaction({
      userId,
      type: 'PROFIT',
      amount: netProfit,
      balanceAfter: newBalance,
      txHash: tradeDetails.txHash,
      description: `📈 ربح ${tradeDetails.token} (85% = $${netProfit.toFixed(2)})`,
      status: 'completed',
      metadata: {
        token: tradeDetails.token,
        grossProfit,
        netProfit,
        commissionAmount: commission,
        feePercentage: COMMISSION_RATE * 100,
      },
    });

    await this.addTransaction({
      userId,
      type: 'COMMISSION',
      amount: commission,
      balanceAfter: newBalance,
      txHash: tradeDetails.txHash,
      description: `🏦 عمولة 15% = $${commission.toFixed(2)}`,
      status: 'completed',
      metadata: {
        token: tradeDetails.token,
        grossProfit,
        netProfit,
        commissionAmount: commission,
        feePercentage: COMMISSION_RATE * 100,
      },
    });

    await this.updateTreasury(commission);

    return { netProfit, commission };
  }

  /**
   * سحب أموال (بدون حدود)
   */
  static async withdraw(userId: string, amount: number, password: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');
    
    // ✅ فقط تحقق من وجود رصيد كافٍ
    if (account.balance < amount) {
      throw new Error(`الرصيد غير كافٍ. الرصيد المتاح: $${account.balance.toFixed(2)}`);
    }

    const verified = await this.verifyPassword(account.email, password);
    if (!verified) {
      throw new Error('كلمة المرور غير صحيحة');
    }

    const botWallet = BotWalletManager.getInstance();
    const result = await botWallet.sendToUser({
      toAddress: account.walletAddress,
      amount,
      network: 'solana',
      password: 'master_password',
    });

    if (!result.success) {
      throw new Error(`فشل السحب: ${result.error}`);
    }

    const newBalance = account.balance - amount;
    account.balance = newBalance;
    account.totalWithdrawn += amount;
    account.updatedAt = getTimestamp();

    await this.updateAccount(userId, {
      balance: newBalance,
      totalWithdrawn: account.totalWithdrawn,
    });

    await this.addTransaction({
      userId,
      type: 'WITHDRAW',
      amount,
      balanceAfter: newBalance,
      txHash: result.txHash,
      description: `💸 سحب $${amount.toFixed(2)}`,
      status: 'completed',
    });
  }

  /**
   * جلب محفظة الأدمن
   */
  static async getAdminWallet(): Promise<string | null> {
    try {
      const result = await madarRead('admin_settings', {});
      if (result.success && result.data && result.data.length > 0) {
        return result.data[0].walletAddress || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  // ============ الخزانة ============

  private static async updateTreasury(amount: number): Promise<void> {
    const treasury = await this.getTreasury();
    treasury.totalCollected += amount;
    treasury.currentBalance += amount;
    treasury.totalTrades += 1;
    treasury.lastUpdated = getTimestamp();
    await this.saveTreasury(treasury);
  }

  static async getTreasury(): Promise<TreasuryStats> {
    const result = await madarRead<TreasuryStats>('treasury');
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    const newTreasury: TreasuryStats = {
      totalCollected: 0,
      totalDistributed: 0,
      currentBalance: 0,
      pendingWithdrawals: 0,
      totalTrades: 0,
      lastUpdated: getTimestamp(),
    };
    await madarCreate('treasury', newTreasury);
    return newTreasury;
  }

  private static async saveTreasury(treasury: TreasuryStats): Promise<void> {
    const result = await madarRead<TreasuryStats>('treasury');
    if (result.success && result.data && result.data.length > 0) {
      await madarUpdate('treasury', result.data[0].id!, treasury);
    } else {
      await madarCreate('treasury', treasury);
    }
  }

  static async getTreasuryStats(): Promise<{
    totalCollected: number;
    currentBalance: number;
    totalTrades: number;
    averageCommission: number;
  }> {
    const treasury = await this.getTreasury();
    return {
      totalCollected: treasury.totalCollected,
      currentBalance: treasury.currentBalance,
      totalTrades: treasury.totalTrades,
      averageCommission: treasury.totalTrades > 0 ? treasury.totalCollected / treasury.totalTrades : 0,
    };
  }

  // ============ المعاملات ============

  static async addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> {
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId(),
      createdAt: getTimestamp(),
    };
    await madarCreate('transactions', newTransaction);
  }

  static async getTransactions(userId: string): Promise<Transaction[]> {
    const result = await madarRead<Transaction>('transactions', { userId });
    if (result.success && result.data) {
      return result.data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return [];
  }

  static async getAllUsers(): Promise<UserAccount[]> {
    const result = await madarRead<UserAccount>('users');
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  static async getSystemStats(): Promise<{
    totalUsers: number;
    totalBalance: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalProfit: number;
    totalFees: number;
    activeTrades: number;
  }> {
    const users = await this.getAllUsers();
    return {
      totalUsers: users.length,
      totalBalance: users.reduce((sum, u) => sum + u.balance, 0),
      totalDeposited: users.reduce((sum, u) => sum + u.totalDeposited, 0),
      totalWithdrawn: users.reduce((sum, u) => sum + u.totalWithdrawn, 0),
      totalProfit: users.reduce((sum, u) => sum + u.totalProfit, 0),
      totalFees: users.reduce((sum, u) => sum + u.totalFees, 0),
      activeTrades: users.reduce((sum, u) => sum + u.activeTrades, 0),
    };
  }

  static async getUserStats(userId: string): Promise<{
    totalProfit: number;
    totalFees: number;
    totalDeposited: number;
    totalWithdrawn: number;
    netBalance: number;
    feePercentage: number;
    tradesCount: number;
  }> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    return {
      totalProfit: account.totalProfit,
      totalFees: account.totalFees,
      totalDeposited: account.totalDeposited,
      totalWithdrawn: account.totalWithdrawn,
      netBalance: account.balance,
      feePercentage: COMMISSION_RATE * 100,
      tradesCount: account.totalTrades,
    };
  }

  // ============ ✅ دوال جديدة للحد الفردي ============

  /**
   * تحديث عدد صفقات المستخدم اليومية
   */
  static async incrementUserTrades(userId: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const today = new Date().toISOString().split('T')[0];
    
    // إعادة تعيين العداد إذا كان يوم جديد
    if (account.lastTradeDate !== today) {
      account.tradesToday = 0;
      account.lastTradeDate = today;
    }

    account.tradesToday = (account.tradesToday || 0) + 1;
    account.updatedAt = getTimestamp();

    await this.updateAccount(userId, {
      tradesToday: account.tradesToday,
      lastTradeDate: account.lastTradeDate,
    });
  }

  /**
   * التحقق من إمكانية تنفيذ صفقة للمستخدم (وضع فردي)
   */
  static async canUserTrade(userId: string, maxTradesPerDay: number): Promise<boolean> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const today = new Date().toISOString().split('T')[0];
    
    // إعادة تعيين العداد إذا كان يوم جديد
    if (account.lastTradeDate !== today) {
      account.tradesToday = 0;
      account.lastTradeDate = today;
      await this.updateAccount(userId, {
        tradesToday: 0,
        lastTradeDate: today,
      });
      return true;
    }

    const currentTrades = account.tradesToday || 0;
    const maxTrades = account.maxTradesPerDay || maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;

    return currentTrades < maxTrades;
  }

  /**
   * الحصول على عدد الصفقات المتبقية للمستخدم اليوم
   */
  static async getRemainingTrades(userId: string, maxTradesPerDay: number): Promise<number> {
    const account = await this.getAccount(userId);
    if (!account) return 0;

    const today = new Date().toISOString().split('T')[0];
    
    if (account.lastTradeDate !== today) {
      return account.maxTradesPerDay || maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;
    }

    const currentTrades = account.tradesToday || 0;
    const maxTrades = account.maxTradesPerDay || maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;

    return Math.max(0, maxTrades - currentTrades);
  }

  /**
   * تحديث الحد الأقصى للصفقات اليومية للمستخدم
   */
  static async updateUserMaxTrades(userId: string, maxTradesPerDay: number): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    await this.updateAccount(userId, {
      maxTradesPerDay: maxTradesPerDay,
    });
  }

  /**
   * إعادة تعيين عداد الصفقات اليومية لجميع المستخدمين (يتم تشغيله يومياً)
   */
  static async resetAllDailyTrades(): Promise<void> {
    const users = await this.getAllUsers();
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      if (user.lastTradeDate !== today) {
        await this.updateAccount(user.id, {
          tradesToday: 0,
          lastTradeDate: today,
        });
      }
    }
  }

  // ============ ✅ دوال جديدة لإدارة محافظ المستخدمين (الوضع المنفرد) ============

  /**
   * إنشاء محفظة لمستخدم معين على شبكة محددة
   */
  static async createUserWallet(userId: string, network: string): Promise<{
    address: string;
    encryptedPrivateKey: string;
  }> {
    // التحقق من وجود المستخدم
    const user = await this.getAccount(userId);
    if (!user) throw new Error('المستخدم غير موجود');

    // إنشاء محفظة جديدة
    const { address, privateKey } = createWallet(network);
    const encryptedKey = encrypt(privateKey, 'user_wallet_salt');

    // حفظ في قاعدة البيانات
    const walletData: UserWallet = {
      userId,
      network,
      address,
      encryptedPrivateKey: encryptedKey,
      balance: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('user_wallets', walletData);

    return {
      address,
      encryptedPrivateKey: encryptedKey,
    };
  }

  /**
   * جلب محفظة مستخدم على شبكة محددة
   */
  static async getUserWallet(userId: string, network: string): Promise<UserWallet | null> {
    const result = await madarRead<UserWallet>('user_wallets', { userId, network });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * جلب جميع محافظ المستخدم
   */
  static async getAllUserWallets(userId: string): Promise<UserWallet[]> {
    const result = await madarRead<UserWallet>('user_wallets', { userId });
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  /**
   * جلب رصيد محفظة المستخدم
   */
  static async getUserWalletBalance(userId: string, network: string): Promise<number> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return 0;
    
    try {
      const balance = await getWalletBalance(network, wallet.address);
      // تحديث الرصيد في قاعدة البيانات
      await madarUpdate('user_wallets', wallet.id!, { 
        balance, 
        updatedAt: getTimestamp() 
      });
      return balance;
    } catch {
      return wallet.balance || 0;
    }
  }

  /**
   * التأكد من وجود محافظ للمستخدم (إنشاء إذا لم توجد)
   */
  static async ensureUserWallets(userId: string, networks: string[]): Promise<void> {
    for (const network of networks) {
      const existing = await this.getUserWallet(userId, network);
      if (!existing) {
        await this.createUserWallet(userId, network);
        console.log(`✅ تم إنشاء محفظة ${network} للمستخدم ${userId.slice(0, 8)}`);
      }
    }
  }

  /**
   * تحديث رصيد محفظة المستخدم
   */
  static async updateUserWalletBalance(userId: string, network: string, balance: number): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم ${userId} على ${network}`);
    
    await madarUpdate('user_wallets', wallet.id!, {
      balance,
      updatedAt: getTimestamp(),
    });
  }

  /**
   * حذف محفظة مستخدم
   */
  static async deleteUserWallet(userId: string, network: string): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم ${userId} على ${network}`);
    
    await madarDelete('user_wallets', wallet.id!);
  }
}

export const COMMISSION_CONFIG = {
  rate: COMMISSION_RATE,
  ratePercentage: COMMISSION_RATE * 100,
  minWithdrawal: MIN_WITHDRAWAL,
  maxWithdrawal: MAX_WITHDRAWAL,
};