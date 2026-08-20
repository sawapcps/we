// src/lib/accounts.ts

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete } from './madarTech';
import { BotWalletManager, createWallet, getWalletBalance } from './wallet';
import { encrypt, decrypt } from './encryption';

// ============ الأنواع ============

export interface UserAccount {
  id: string;
  email: string;
  password: string; // مشفرة
  username?: string;
  walletAddress: string; // المحفظة الرئيسية (للإيداع والسحب)
  balance: number; // رصيد المستخدم (بـ USDT)
  totalDeposited: number;
  totalWithdrawn: number;
  totalProfit: number;
  totalGrossProfit: number;
  totalFees: number; // العمولات المدفوعة (15%)
  totalTrades: number;
  activeTrades: number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  status: 'active' | 'suspended' | 'pending';
  referralCode?: string;
  referredBy?: string;
  isAdmin?: boolean;
  
  // ✅ إعدادات التداول الفردي
  maxTradesPerDay: number; // الحد الأقصى للصفقات اليومية
  tradesToday: number; // عدد الصفقات المنفذة اليوم
  lastTradeDate: string; // تاريخ آخر صفقة
  tradeMode: 'shared' | 'individual'; // وضع التداول
  
  // ✅ محافظ المستخدم (لكل شبكة)
  userWallets?: UserWallet[];
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

// ✅ ✅ ✅ واجهة رمز البوت (جديدة)
export interface BotToken {
  id: string;
  userId: string;
  walletId: string;
  network: string;        // solana, robinhood, ethereum, إلخ
  token: string;          // رمز البوت الفريد
  secretKey: string;      // المفتاح السري
  status: 'active' | 'inactive' | 'revoked';
  permissions: string[];  // ['trade', 'view', 'withdraw']
  createdAt: string;
  updatedAt?: string;
  lastUsed?: string;
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
    network?: string;
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

// ============ ثوابت النظام ============

export const COMMISSION_RATE = 0.15; // 15%
export const MIN_WITHDRAWAL = 10;
export const MAX_WITHDRAWAL = 10000;
export const DEFAULT_MAX_TRADES_PER_DAY = 10;

// كلمة مرور الأدمن
const ADMIN_EMAIL = 'admin@cryptobot.com';
const ADMIN_PASSWORD = '12345678910';

// ============ فئة AccountManager ============

export class AccountManager {
  
  // ============================================================
  // 🔐 المصادقة وإدارة الحسابات
  // ============================================================

  /**
   * التحقق من أدمن
   */
  static async verifyAdmin(email: string, password: string): Promise<boolean> {
    if (email !== ADMIN_EMAIL) return false;
    return password === ADMIN_PASSWORD;
  }

  /**
   * إنشاء حساب مستخدم جديد
   */
  static async createAccount(email: string, password: string, walletAddress: string): Promise<UserAccount> {
    // التحقق من عدم وجود حساب مسبق
    const existing = await this.getAccountByEmail(email);
    if (existing) {
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
      maxTradesPerDay: DEFAULT_MAX_TRADES_PER_DAY,
      tradesToday: 0,
      lastTradeDate: new Date().toISOString().split('T')[0],
      tradeMode: 'individual',
    };

    await madarCreate('users', account);
    return account;
  }

  /**
   * التحقق من صحة كلمة المرور
   */
  static async verifyPassword(email: string, password: string): Promise<UserAccount | null> {
    const user = await this.getAccountByEmail(email);
    if (!user) return null;

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
   * جلب حساب مستخدم بالمعرف
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
   * جلب جميع المستخدمين
   */
  static async getAllUsers(): Promise<UserAccount[]> {
    const result = await madarRead<UserAccount>('users');
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  // ============================================================
  // 💰 إدارة الرصيد والأرباح
  // ============================================================

  /**
   * إيداع أموال للمستخدم
   */
  static async deposit(userId: string, amount: number, txHash: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const newBalance = account.balance + amount;
    await this.updateAccount(userId, {
      balance: newBalance,
      totalDeposited: account.totalDeposited + amount,
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
      network: string;
    }
  ): Promise<{ netProfit: number; commission: number }> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const commission = grossProfit * COMMISSION_RATE;
    const netProfit = grossProfit - commission;

    const newBalance = account.balance + netProfit;
    await this.updateAccount(userId, {
      balance: newBalance,
      totalProfit: account.totalProfit + netProfit,
      totalGrossProfit: account.totalGrossProfit + grossProfit,
      totalFees: account.totalFees + commission,
      totalTrades: account.totalTrades + 1,
    });

    // تسجيل صفقة الربح
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
        network: tradeDetails.network,
        grossProfit,
        netProfit,
        commissionAmount: commission,
        feePercentage: COMMISSION_RATE * 100,
      },
    });

    // تسجيل العمولة
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
        network: tradeDetails.network,
        grossProfit,
        netProfit,
        commissionAmount: commission,
        feePercentage: COMMISSION_RATE * 100,
      },
    });

    // تحديث الخزانة
    await this.updateTreasury(commission);

    return { netProfit, commission };
  }

  /**
   * سحب أموال
   */
  static async withdraw(userId: string, amount: number, password: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    if (account.balance < amount) {
      throw new Error(`الرصيد غير كافٍ. الرصيد المتاح: $${account.balance.toFixed(2)}`);
    }

    if (amount < MIN_WITHDRAWAL) {
      throw new Error(`الحد الأدنى للسحب: $${MIN_WITHDRAWAL}`);
    }

    if (amount > MAX_WITHDRAWAL) {
      throw new Error(`الحد الأقصى للسحب: $${MAX_WITHDRAWAL}`);
    }

    const verified = await this.verifyPassword(account.email, password);
    if (!verified) {
      throw new Error('كلمة المرور غير صحيحة');
    }

    // ✅ استخدام BotWalletManager للسحب
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
    await this.updateAccount(userId, {
      balance: newBalance,
      totalWithdrawn: account.totalWithdrawn + amount,
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

  // ============================================================
  // 📊 إحصائيات النظام
  // ============================================================

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

  // ============================================================
  // 🏦 الخزانة
  // ============================================================

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

  // ============================================================
  // 📝 المعاملات
  // ============================================================

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

  // ============================================================
  // 👤 إدارة محافظ المستخدمين (الفردية)
  // ============================================================

  /**
   * إنشاء محفظة لمستخدم على شبكة محددة
   */
  static async createUserWallet(userId: string, network: string): Promise<UserWallet> {
    const user = await this.getAccount(userId);
    if (!user) throw new Error('المستخدم غير موجود');

    // التحقق من عدم وجود محفظة لنفس الشبكة
    const existing = await this.getUserWallet(userId, network);
    if (existing) {
      throw new Error(`توجد محفظة بالفعل لشبكة ${network}`);
    }

    const { address, privateKey } = createWallet(network);
    const encryptedKey = encrypt(privateKey, 'user_wallet_salt');

    const wallet: UserWallet = {
      userId,
      network,
      address,
      encryptedPrivateKey: encryptedKey,
      balance: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('user_wallets', wallet);
    return wallet;
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
   * تحديث رصيد محفظة المستخدم
   */
  static async updateUserWalletBalance(userId: string, network: string, balance: number): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
    
    await madarUpdate('user_wallets', wallet.id!, {
      balance,
      updatedAt: getTimestamp(),
    });
  }

  /**
   * جلب رصيد محفظة المستخدم من السلسلة
   */
  static async getUserWalletBalance(userId: string, network: string): Promise<number> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return 0;
    
    try {
      const balance = await getWalletBalance(network, wallet.address);
      await this.updateUserWalletBalance(userId, network, balance);
      return balance;
    } catch {
      return wallet.balance || 0;
    }
  }

  /**
   * التأكد من وجود محافظ للمستخدم
   */
  static async ensureUserWallets(userId: string, networks: string[]): Promise<void> {
    for (const network of networks) {
      const existing = await this.getUserWallet(userId, network);
      if (!existing) {
        await this.createUserWallet(userId, network);
      }
    }
  }

  /**
   * حذف محفظة مستخدم
   */
  static async deleteUserWallet(userId: string, network: string): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
    
    await madarDelete('user_wallets', wallet.id!);
  }

  // ============================================================
  // 📈 إدارة الصفقات اليومية (الحد الفردي)
  // ============================================================

  /**
   * تحديث عدد صفقات المستخدم اليومية
   */
  static async incrementUserTrades(userId: string): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const today = new Date().toISOString().split('T')[0];
    
    if (account.lastTradeDate !== today) {
      account.tradesToday = 0;
      account.lastTradeDate = today;
    }

    account.tradesToday = (account.tradesToday || 0) + 1;
    await this.updateAccount(userId, {
      tradesToday: account.tradesToday,
      lastTradeDate: account.lastTradeDate,
    });
  }

  /**
   * التحقق من إمكانية تنفيذ صفقة للمستخدم
   */
  static async canUserTrade(userId: string): Promise<boolean> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const today = new Date().toISOString().split('T')[0];
    
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
    const maxTrades = account.maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;

    return currentTrades < maxTrades;
  }

  /**
   * الحصول على عدد الصفقات المتبقية للمستخدم
   */
  static async getRemainingTrades(userId: string): Promise<number> {
    const account = await this.getAccount(userId);
    if (!account) return 0;

    const today = new Date().toISOString().split('T')[0];
    
    if (account.lastTradeDate !== today) {
      return account.maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;
    }

    const currentTrades = account.tradesToday || 0;
    const maxTrades = account.maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY;

    return Math.max(0, maxTrades - currentTrades);
  }

  /**
   * تحديث الحد الأقصى للصفقات اليومية للمستخدم
   */
  static async updateUserMaxTrades(userId: string, maxTradesPerDay: number): Promise<void> {
    await this.updateAccount(userId, { maxTradesPerDay });
  }

  /**
   * إعادة تعيين عداد الصفقات اليومية لجميع المستخدمين
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

  // ============================================================
  // 🔑 🔑 🔑 إدارة رموز البوت (Bot Tokens) - الجديد
  // ============================================================

  /**
   * إنشاء رمز بوت جديد لمستخدم على شبكة محددة
   */
  static async createBotToken(
    userId: string, 
    walletId: string, 
    network: string
  ): Promise<BotToken> {
    
    // التحقق من وجود المستخدم
    const user = await this.getAccount(userId);
    if (!user) throw new Error('المستخدم غير موجود');

    // التحقق من وجود المحفظة
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على شبكة ${network}`);

    // التحقق من عدم وجود رمز نشط لنفس الشبكة
    const existing = await this.getBotToken(userId, network);
    if (existing && existing.status === 'active') {
      throw new Error(`يوجد رمز بوت نشط بالفعل لشبكة ${network}`);
    }

    // توليد رمز فريد
    const token = this.generateBotToken(userId, network);
    const secretKey = this.generateSecretKey();

    const botToken: BotToken = {
      id: generateId(),
      userId,
      walletId,
      network,
      token: `bot_${network}_${token}`,
      secretKey: `sk_${secretKey}`,
      status: 'active',
      permissions: ['trade', 'view'],
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await madarCreate('bot_tokens', botToken);
    
    console.log(`✅ تم إنشاء رمز بوت للشبكة ${network}: ${botToken.token}`);
    return botToken;
  }

  /**
   * جلب رمز بوت لمستخدم على شبكة محددة
   */
  static async getBotToken(userId: string, network: string): Promise<BotToken | null> {
    const result = await madarRead<BotToken>('bot_tokens', { 
      userId, 
      network,
      status: 'active'
    });
    
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * جلب جميع رموز البوت لمستخدم
   */
  static async getAllBotTokens(userId: string): Promise<BotToken[]> {
    const result = await madarRead<BotToken>('bot_tokens', { userId });
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  /**
   * جلب جميع رموز البوت النشطة لمستخدم
   */
  static async getActiveBotTokens(userId: string): Promise<BotToken[]> {
    const result = await madarRead<BotToken>('bot_tokens', { 
      userId,
      status: 'active'
    });
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  /**
   * جلب رمز بوت بواسطة الرمز نفسه
   */
  static async getBotTokenByToken(token: string): Promise<BotToken | null> {
    const result = await madarRead<BotToken>('bot_tokens', { token });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  /**
   * التحقق من صحة رمز البوت
   */
  static async verifyBotToken(token: string, userId: string): Promise<boolean> {
    const result = await madarRead<BotToken>('bot_tokens', { 
      token,
      userId,
      status: 'active'
    });
    
    if (!result.success || !result.data || result.data.length === 0) {
      return false;
    }

    const botToken = result.data[0];
    
    // التحقق من الصلاحيات
    if (!botToken.permissions.includes('trade')) {
      return false;
    }

    // تحديث آخر استخدام
    await this.updateBotTokenLastUsed(botToken.id);
    
    return true;
  }

  /**
   * تحديث آخر استخدام لرمز البوت
   */
  static async updateBotTokenLastUsed(tokenId: string): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      lastUsed: getTimestamp(),
      updatedAt: getTimestamp()
    });
  }

  /**
   * إلغاء رمز البوت
   */
  static async revokeBotToken(tokenId: string): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      status: 'revoked',
      updatedAt: getTimestamp()
    });
  }

  /**
   * إلغاء جميع رموز البوت لمستخدم
   */
  static async revokeAllBotTokens(userId: string): Promise<void> {
    const tokens = await this.getAllBotTokens(userId);
    for (const token of tokens) {
      await this.revokeBotToken(token.id);
    }
  }

  /**
   * تحديث صلاحيات رمز البوت
   */
  static async updateBotTokenPermissions(
    tokenId: string, 
    permissions: string[]
  ): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      permissions: JSON.stringify(permissions),
      updatedAt: getTimestamp()
    });
  }

  /**
   * التحقق من وجود رمز بوت لمستخدم على شبكة محددة
   */
  static async hasBotToken(userId: string, network: string): Promise<boolean> {
    const token = await this.getBotToken(userId, network);
    return token !== null && token.status === 'active';
  }

  /**
   * إنشاء رمز بوت تلقائياً إذا لم يكن موجوداً
   */
  static async ensureBotToken(
    userId: string, 
    walletId: string, 
    network: string
  ): Promise<BotToken> {
    const existing = await this.getBotToken(userId, network);
    if (existing && existing.status === 'active') {
      return existing;
    }
    return await this.createBotToken(userId, walletId, network);
  }

  // ============================================================
  // 🔧 دوال مساعدة لتوليد الرموز
  // ============================================================

  /**
   * توليد رمز بوت فريد
   */
  static generateBotToken(userId: string, network: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const userPrefix = userId.slice(0, 6);
    return `${network}_${userPrefix}_${timestamp}_${random}`;
  }

  /**
   * توليد مفتاح سري
   */
  static generateSecretKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// ============================================================
// 📦 تصدير الثوابت
// ============================================================

export const COMMISSION_CONFIG = {
  rate: COMMISSION_RATE,
  ratePercentage: COMMISSION_RATE * 100,
  minWithdrawal: MIN_WITHDRAWAL,
  maxWithdrawal: MAX_WITHDRAWAL,
  defaultMaxTradesPerDay: DEFAULT_MAX_TRADES_PER_DAY,
};
