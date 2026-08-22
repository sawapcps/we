// src/lib/accounts.ts

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete, createBotInstance } from './madarTech';
import { BotWalletManager, createWallet, getWalletBalance } from './wallet';
import { encrypt, decrypt } from './encryption';

// ============ الأنواع ============

export interface UserAccount {
  id: string;
  email: string;
  password: string;
  username?: string;
  walletAddress: string;
  walletProvider?: string;
  walletLinkedAt?: string;
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
  maxTradesPerDay: number;
  tradesToday: number;
  lastTradeDate: string;
  tradeMode: 'shared' | 'individual';
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

export interface BotToken {
  id: string;
  userId: string;
  walletId: string;
  network: string;
  token: string;
  secretKey: string;
  status: 'active' | 'inactive' | 'revoked';
  permissions: string[];
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

export const COMMISSION_RATE = 0.15;
export const MIN_WITHDRAWAL = 10;
export const MAX_WITHDRAWAL = 10000;
export const DEFAULT_MAX_TRADES_PER_DAY = 10;
export const NETWORKS = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];

// ============ فئة AccountManager ============

export class AccountManager {
  
  // ============================================================
  // 🔐 المصادقة وإدارة الحسابات
  // ============================================================

  static async createAccount(email: string, password: string, walletAddress: string): Promise<UserAccount> {
    console.log('📝 [createAccount] بدء إنشاء حساب:', email);
    
    const existing = await this.getAccountByEmail(email);
    if (existing) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل');
    }

    const dbUser = {
      email,
      password: password,
      name: email.split('@')[0],
      full_name: email.split('@')[0],
      role: 'user',
      status: 'active',
      isAdmin: 0,
      walletAddress: walletAddress || '',
      walletProvider: '',
      walletLinkedAt: null,
      balance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalProfit: 0,
      totalGrossProfit: 0,
      totalFees: 0,
      totalTrades: 0,
      activeTrades: 0,
      maxTradesPerDay: DEFAULT_MAX_TRADES_PER_DAY,
      tradesToday: 0,
      lastTradeDate: new Date().toISOString().split('T')[0],
      tradeMode: 'individual',
      created_at: getTimestamp(),
      updated_at: getTimestamp(),
    };

    const result = await madarCreate('users', dbUser);
    console.log('📊 [createAccount] نتيجة الإدراج:', result);
    
    if (!result.success) {
      throw new Error('فشل إنشاء الحساب');
    }

    const user = this.mapDbUserToUserAccount(result.data);
    
    // ✅ إنشاء 9 محافظ للمستخدم الجديد
    await this.ensureUserWallets(user.id, NETWORKS);
    
    // ✅ إنشاء 4 بوتات للمستخدم الجديد
    const botTypes = ['hunter', 'signal', 'manual', 'scalper'];
    const botNames = ['Hunter Alpha', 'Signal Pro', 'Manual Desk', 'Scalper X'];
    for (let i = 0; i < botTypes.length; i++) {
      await createBotInstance(user.id, botTypes[i] as any, botNames[i]);
    }

    return user;
  }

  // ============================================================
  // 🔥 تسجيل الدخول بالمحفظة
  // ============================================================

  static async findUserByWallet(walletAddress: string): Promise<UserAccount | null> {
    try {
      console.log('🔍 [findUserByWallet] البحث عن:', walletAddress.slice(0, 8) + '...');
      const result = await madarRead<any>('users', { walletAddress });
      
      if (result.success && result.data && result.data.length > 0) {
        console.log('✅ [findUserByWallet] المستخدم موجود');
        return this.mapDbUserToUserAccount(result.data[0]);
      }
      console.log('❌ [findUserByWallet] المستخدم غير موجود');
      return null;
    } catch (error) {
      console.error('❌ فشل البحث عن المستخدم:', error);
      return null;
    }
  }

  static async createAccountFromWallet(
    walletAddress: string,
    providerId: string
  ): Promise<UserAccount> {
    try {
      console.log('📝 [createAccountFromWallet] إنشاء حساب من المحفظة:', walletAddress.slice(0, 8) + '...');
      
      const existing = await this.findUserByWallet(walletAddress);
      if (existing) {
        throw new Error('هذه المحفظة مرتبطة بحساب موجود');
      }

      const now = getTimestamp();
      const tempEmail = `wallet_${walletAddress.slice(0, 10)}_${Date.now()}@temp.com`;
      
      const dbUser = {
        email: tempEmail,
        password: `wallet_${walletAddress.slice(0, 16)}`,
        name: `wallet_${walletAddress.slice(0, 8)}`,
        full_name: `Wallet ${walletAddress.slice(0, 8)}`,
        role: 'user',
        status: 'active',
        isAdmin: 0,
        walletAddress: walletAddress,
        walletProvider: providerId,
        walletLinkedAt: now,
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalProfit: 0,
        totalGrossProfit: 0,
        totalFees: 0,
        totalTrades: 0,
        activeTrades: 0,
        maxTradesPerDay: DEFAULT_MAX_TRADES_PER_DAY,
        tradesToday: 0,
        lastTradeDate: new Date().toISOString().split('T')[0],
        tradeMode: 'individual',
        created_at: now,
        updated_at: now,
      };

      const result = await madarCreate('users', dbUser);
      
      if (!result.success) {
        throw new Error('فشل إنشاء الحساب من المحفظة');
      }

      const user = this.mapDbUserToUserAccount(result.data);
      
      await this.ensureUserWallets(user.id, NETWORKS);
      
      const botTypes = ['hunter', 'signal', 'manual', 'scalper'];
      const botNames = ['Hunter Alpha', 'Signal Pro', 'Manual Desk', 'Scalper X'];
      for (let i = 0; i < botTypes.length; i++) {
        await createBotInstance(user.id, botTypes[i] as any, botNames[i]);
      }

      console.log('✅ [createAccountFromWallet] تم إنشاء الحساب بنجاح');
      return user;
      
    } catch (error) {
      console.error('❌ فشل إنشاء حساب من المحفظة:', error);
      throw error;
    }
  }

  static async linkWalletToAccount(
    userId: string,
    walletAddress: string,
    providerId: string
  ): Promise<void> {
    try {
      const existing = await this.findUserByWallet(walletAddress);
      if (existing && existing.id !== userId) {
        throw new Error('هذه المحفظة مرتبطة بحساب آخر');
      }

      await this.updateAccount(userId, {
        walletAddress: walletAddress,
        walletProvider: providerId,
        walletLinkedAt: getTimestamp(),
      });
      
      console.log('✅ [linkWalletToAccount] تم ربط المحفظة بنجاح');
    } catch (error) {
      console.error('❌ فشل ربط المحفظة:', error);
      throw error;
    }
  }

  // ============================================================
  // 🔐 التحقق من كلمة المرور
  // ============================================================

  static async verifyPassword(email: string, password: string): Promise<UserAccount | null> {
    console.log('🔍 [verifyPassword] بدء التحقق');
    console.log('📧 البريد:', email);
    
    const user = await this.getAccountByEmail(email);
    
    if (!user) {
      console.log('❌ [verifyPassword] المستخدم غير موجود');
      return null;
    }

    if (user.password === password) {
      console.log('✅ [verifyPassword] كلمة المرور صحيحة!');
      return user;
    } else {
      console.log('❌ [verifyPassword] كلمة المرور غير صحيحة');
      return null;
    }
  }

  static async getAccount(userId: string): Promise<UserAccount | null> {
    try {
      const result = await madarRead<any>('users', { id: userId });
      
      if (result.success && result.data && result.data.length > 0) {
        return this.mapDbUserToUserAccount(result.data[0]);
      }
      return null;
    } catch (error) {
      console.error('❌ فشل جلب المستخدم:', error);
      return null;
    }
  }

  static async getAccountByEmail(email: string): Promise<UserAccount | null> {
    try {
      console.log('📡 [getAccountByEmail] جلب المستخدم:', email);
      const result = await madarRead<any>('users', { email });
      
      if (result.success && result.data && result.data.length > 0) {
        console.log('✅ [getAccountByEmail] المستخدم موجود');
        return this.mapDbUserToUserAccount(result.data[0]);
      }
      console.log('❌ [getAccountByEmail] المستخدم غير موجود');
      return null;
    } catch (error) {
      console.error('❌ فشل جلب المستخدم:', error);
      return null;
    }
  }

  static async updateAccount(userId: string, data: Partial<UserAccount>): Promise<void> {
    const dbData: any = { updated_at: getTimestamp() };
    
    if (data.email !== undefined) dbData.email = data.email;
    if (data.password !== undefined) dbData.password = data.password;
    if (data.username !== undefined) dbData.name = data.username;
    if (data.walletAddress !== undefined) dbData.walletAddress = data.walletAddress;
    if (data.walletProvider !== undefined) dbData.walletProvider = data.walletProvider;
    if (data.walletLinkedAt !== undefined) dbData.walletLinkedAt = data.walletLinkedAt;
    if (data.balance !== undefined) dbData.balance = data.balance;
    if (data.totalDeposited !== undefined) dbData.totalDeposited = data.totalDeposited;
    if (data.totalWithdrawn !== undefined) dbData.totalWithdrawn = data.totalWithdrawn;
    if (data.totalProfit !== undefined) dbData.totalProfit = data.totalProfit;
    if (data.totalGrossProfit !== undefined) dbData.totalGrossProfit = data.totalGrossProfit;
    if (data.totalFees !== undefined) dbData.totalFees = data.totalFees;
    if (data.totalTrades !== undefined) dbData.totalTrades = data.totalTrades;
    if (data.activeTrades !== undefined) dbData.activeTrades = data.activeTrades;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.isAdmin !== undefined) dbData.isAdmin = data.isAdmin ? 1 : 0;
    if (data.maxTradesPerDay !== undefined) dbData.maxTradesPerDay = data.maxTradesPerDay;
    if (data.tradesToday !== undefined) dbData.tradesToday = data.tradesToday;
    if (data.lastTradeDate !== undefined) dbData.lastTradeDate = data.lastTradeDate;
    if (data.tradeMode !== undefined) dbData.tradeMode = data.tradeMode;

    await madarUpdate('users', userId, dbData);
  }

  static async getAllUsers(): Promise<UserAccount[]> {
    try {
      const result = await madarRead<any>('users');
      
      if (result.success && result.data) {
        return result.data.map((dbUser: any) => this.mapDbUserToUserAccount(dbUser));
      }
      return [];
    } catch (error) {
      console.error('❌ فشل جلب المستخدمين:', error);
      return [];
    }
  }

  // ============================================================
  // 🔄 دالة تحويل البيانات من قاعدة البيانات إلى UserAccount
  // ============================================================

  private static mapDbUserToUserAccount(dbUser: any): UserAccount {
    return {
      id: String(dbUser.id),
      email: dbUser.email,
      password: dbUser.password,
      username: dbUser.name || dbUser.full_name || '',
      walletAddress: dbUser.walletAddress || '',
      walletProvider: dbUser.walletProvider || '',
      walletLinkedAt: dbUser.walletLinkedAt || '',
      balance: dbUser.balance || 0,
      totalDeposited: dbUser.totalDeposited || 0,
      totalWithdrawn: dbUser.totalWithdrawn || 0,
      totalProfit: dbUser.totalProfit || 0,
      totalGrossProfit: dbUser.totalGrossProfit || 0,
      totalFees: dbUser.totalFees || 0,
      totalTrades: dbUser.totalTrades || 0,
      activeTrades: dbUser.activeTrades || 0,
      createdAt: dbUser.created_at || new Date().toISOString(),
      updatedAt: dbUser.updated_at || new Date().toISOString(),
      status: dbUser.status || 'active',
      referralCode: dbUser.referralCode || '',
      referredBy: dbUser.referredBy || '',
      isAdmin: dbUser.isAdmin === 1 || dbUser.isAdmin === true,
      maxTradesPerDay: dbUser.maxTradesPerDay || DEFAULT_MAX_TRADES_PER_DAY,
      tradesToday: dbUser.tradesToday || 0,
      lastTradeDate: dbUser.lastTradeDate || new Date().toISOString().split('T')[0],
      tradeMode: dbUser.tradeMode || 'shared',
    };
  }

  // ============================================================
  // 💰 إدارة الرصيد والأرباح
  // ============================================================

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

    await this.updateTreasury(commission);

    return { netProfit, commission };
  }

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
    if (!account) {
      console.warn(`⚠️ المستخدم ${userId} غير موجود، إرجاع قيم افتراضية`);
      return {
        totalProfit: 0,
        totalFees: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        netBalance: 0,
        feePercentage: COMMISSION_RATE * 100,
        tradesCount: 0,
      };
    }

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
  // 👤 إدارة محافظ المستخدمين
  // ============================================================

  static async createUserWallet(userId: string, network: string): Promise<UserWallet> {
    const user = await this.getAccount(userId);
    if (!user) throw new Error('المستخدم غير موجود');

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

  static async getUserWallet(userId: string, network: string): Promise<UserWallet | null> {
    const result = await madarRead<UserWallet>('user_wallets', { userId, network });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

  static async getAllUserWallets(userId: string): Promise<UserWallet[]> {
    const result = await madarRead<UserWallet>('user_wallets', { userId });
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

  static async updateUserWalletBalance(userId: string, network: string, balance: number): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
    
    await madarUpdate('user_wallets', wallet.id!, {
      balance,
      updatedAt: getTimestamp(),
    });
  }

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

  static async ensureUserWallets(userId: string, networks: string[]): Promise<void> {
    for (const network of networks) {
      const existing = await this.getUserWallet(userId, network);
      if (!existing) {
        await this.createUserWallet(userId, network);
        console.log(`✅ تم إنشاء محفظة على ${network} للمستخدم ${userId}`);
      }
    }
  }

  static async deleteUserWallet(userId: string, network: string): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
    
    await madarDelete('user_wallets', wallet.id!);
  }

  // ============================================================
  // 📈 إدارة الصفقات اليومية
  // ============================================================

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

  static async updateUserMaxTrades(userId: string, maxTradesPerDay: number): Promise<void> {
    await this.updateAccount(userId, { maxTradesPerDay });
  }

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
  // 🔑 إدارة رموز البوت
  // ============================================================

  static async createBotToken(
    userId: string, 
    walletId: string, 
    network: string
  ): Promise<BotToken> {
    
    const user = await this.getAccount(userId);
    if (!user) throw new Error('المستخدم غير موجود');

    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على شبكة ${network}`);

    const existing = await this.getBotToken(userId, network);
    if (existing && existing.status === 'active') {
      throw new Error(`يوجد رمز بوت نشط بالفعل لشبكة ${network}`);
    }

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

  static async getAllBotTokens(userId: string): Promise<BotToken[]> {
    const result = await madarRead<BotToken>('bot_tokens', { userId });
    if (result.success && result.data) {
      return result.data;
    }
    return [];
  }

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

  static async getBotTokenByToken(token: string): Promise<BotToken | null> {
    const result = await madarRead<BotToken>('bot_tokens', { token });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  }

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
    
    if (!botToken.permissions.includes('trade')) {
      return false;
    }

    await this.updateBotTokenLastUsed(botToken.id);
    
    return true;
  }

  static async updateBotTokenLastUsed(tokenId: string): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      lastUsed: getTimestamp(),
      updatedAt: getTimestamp()
    });
  }

  static async revokeBotToken(tokenId: string): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      status: 'revoked',
      updatedAt: getTimestamp()
    });
  }

  static async revokeAllBotTokens(userId: string): Promise<void> {
    const tokens = await this.getAllBotTokens(userId);
    for (const token of tokens) {
      await this.revokeBotToken(token.id);
    }
  }

  static async updateBotTokenPermissions(
    tokenId: string, 
    permissions: string[]
  ): Promise<void> {
    await madarUpdate('bot_tokens', tokenId, {
      permissions: JSON.stringify(permissions),
      updatedAt: getTimestamp()
    });
  }

  static async hasBotToken(userId: string, network: string): Promise<boolean> {
    const token = await this.getBotToken(userId, network);
    return token !== null && token.status === 'active';
  }

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

  static generateBotToken(userId: string, network: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const userPrefix = userId.slice(0, 6);
    return `${network}_${userPrefix}_${timestamp}_${random}`;
  }

  static generateSecretKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ============================================================
  // ✅ دوال الصفقات (جديدة)
  // ============================================================

  /**
   * ✅ جلب جميع صفقات المستخدم
   */
  static async getUserTrades(userId: string): Promise<any[]> {
    try {
      const result = await madarRead<any>('trades', { userId });
      if (result.success && result.data) {
        return result.data.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
      return [];
    } catch (error) {
      console.error('❌ فشل جلب الصفقات:', error);
      return [];
    }
  }

  /**
   * ✅ جلب الصفقات المفتوحة (غير المغلقة)
   */
  static async getOpenTrades(userId: string): Promise<any[]> {
    try {
      const result = await madarRead<any>('trades', { userId, isOpen: true });
      if (result.success && result.data) {
        return result.data;
      }
      return [];
    } catch (error) {
      console.error('❌ فشل جلب الصفقات المفتوحة:', error);
      return [];
    }
  }

  /**
   * ✅ إغلاق صفقة
   */
  static async closeTrade(tradeId: string, userId: string, closePrice: number, pnl: number): Promise<void> {
    try {
      // ✅ جلب الصفقة للتأكد من وجودها
      const tradeResult = await madarRead<any>('trades', { id: tradeId, userId });
      if (!tradeResult.success || !tradeResult.data || tradeResult.data.length === 0) {
        throw new Error('الصفقة غير موجودة');
      }

      const trade = tradeResult.data[0];
      
      // ✅ تحديث الصفقة
      await madarUpdate('trades', tradeId, {
        isOpen: false,
        closePrice,
        pnl,
        closedAt: getTimestamp(),
        status: 'CLOSED',
      });
      
      // ✅ إذا كان هناك ربح، طبق العمولة
      if (pnl > 0) {
        await this.addProfit(userId, pnl, {
          token: trade.token || 'CLOSED_TRADE',
          amount: trade.amount || closePrice,
          price: closePrice,
          txHash: `close_${tradeId}`,
          network: trade.network || 'solana',
        });
      }
      
      console.log(`✅ تم إغلاق الصفقة ${tradeId} بـ PnL: $${pnl.toFixed(2)}`);
    } catch (error) {
      console.error('❌ فشل إغلاق الصفقة:', error);
      throw error;
    }
  }

  /**
   * ✅ جلب إحصائيات صفقات المستخدم
   */
  static async getUserTradeStats(userId: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    winRate: number;
  }> {
    const trades = await this.getUserTrades(userId);
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    
    const winning = closedTrades.filter(t => t.pnl > 0);
    const losing = closedTrades.filter(t => t.pnl < 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    return {
      totalTrades: trades.length,
      winningTrades: winning.length,
      losingTrades: losing.length,
      totalPnl,
      winRate: closedTrades.length > 0 ? (winning.length / closedTrades.length) * 100 : 0,
    };
  }

  /**
   * ✅ جلب سعر الصفقة الحالي (للتحديث)
   */
  static async getTradePrice(tradeId: string, userId: string): Promise<number | null> {
    try {
      const result = await madarRead<any>('trades', { id: tradeId, userId });
      if (result.success && result.data && result.data.length > 0) {
        return result.data[0].price || null;
      }
      return null;
    } catch (error) {
      console.error('❌ فشل جلب سعر الصفقة:', error);
      return null;
    }
  }

  /**
   * ✅ تحديث سعر الصفقة (لتحديث السعر الحالي)
   */
  static async updateTradePrice(tradeId: string, userId: string, currentPrice: number): Promise<void> {
    try {
      await madarUpdate('trades', tradeId, {
        currentPrice,
        updatedAt: getTimestamp(),
      });
    } catch (error) {
      console.error('❌ فشل تحديث سعر الصفقة:', error);
      throw error;
    }
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
  networks: NETWORKS,
};