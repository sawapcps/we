// src/lib/accounts.ts
// ============================================================
// إدارة حسابات المستخدمين والمحافظ - يدعم 9 شبكات
// ============================================================

import { generateId, getTimestamp, madarCreate, madarRead, madarUpdate, madarDelete, createBotInstance } from './madarTech';
import { BotWalletManager, createWallet, getWalletBalance } from './wallet';
import { encrypt, decrypt } from './encryption';
import { NETWORKS, getNativeToken } from '../config/networks';

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
  externalWalletAddress?: Record<string, string>;
}

export interface UserWallet {
  id?: string;
  userId: string;
  network: string;
  address: string;
  encryptedPrivateKey: string;
  balance: number;
  created_at: string;
  updated_at: string;
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
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRADE_BUY' | 'TRADE_SELL' | 'PROFIT' | 'FEE' | 'COMMISSION' | 'TRANSFER_TO_BOT' | 'TRANSFER_FROM_BOT';
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
    botId?: string;
    externalAddress?: string;
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

export const COMMISSION_RATE = 0.05; // 5%
export const MIN_WITHDRAWAL = 10;
export const MAX_WITHDRAWAL = 10000;
export const DEFAULT_MAX_TRADES_PER_DAY = 10;

// ✅ 9 شبكات من ملف networks.ts
export const NETWORKS_LIST = NETWORKS.map(n => n.id);

// ✅ عناوين محافظ المدير (Admin)
const ADMIN_WALLET_ADDRESSES: Record<string, string> = {
  solana: 'AdminSolanaAddressHere...',
  ethereum: '0xAdminEthereumAddressHere...',
  bsc: '0xAdminBscAddressHere...',
  polygon: '0xAdminPolygonAddressHere...',
  arbitrum: '0xAdminArbitrumAddressHere...',
  base: '0xAdminBaseAddressHere...',
  avalanche: '0xAdminAvalancheAddressHere...',
  optimism: '0xAdminOptimismAddressHere...',
  robinhood: '0xAdminRobinhoodAddressHere...',
};

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
      email: email,
      password: password,
      name: email.split('@')[0],
      full_name: email.split('@')[0],
      role: 'user',
      status: 'active',
      isAdmin: 0,
      walletAddress: walletAddress || '',
      walletProvider: '',
      walletLinkedAt: '',
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

    const userData = result.data || dbUser;
    const user = this.mapDbUserToUserAccount(userData);
    
    await this.ensureAllUserWallets(user.id);
    
    const botTypes = ['hunter', 'signal', 'manual', 'scalper'];
    const botNames = ['Hunter Alpha', 'Signal Pro', 'Manual Desk', 'Scalper X'];
    for (let i = 0; i < botTypes.length; i++) {
      await createBotInstance(user.id, botTypes[i] as any, botNames[i], 100);
    }

    return user;
  }

  // ============================================================
  // 🔥 تسجيل الدخول بالمحفظة
  // ============================================================

  static async findUserByWallet(walletAddress: string): Promise<UserAccount | null> {
    try {
      console.log('🔍 [findUserByWallet] البحث عن:', walletAddress.slice(0, 8) + '...');
      const result = await madarRead<any>('users', { where: { walletAddress } });
      
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
      console.log('📊 [createAccountFromWallet] نتيجة الإدراج:', result);
      
      if (!result.success) {
        throw new Error('فشل إنشاء الحساب من المحفظة');
      }

      const userData = result.data || dbUser;
      const user = this.mapDbUserToUserAccount(userData);
      
      await this.ensureAllUserWallets(user.id);
      
      const botTypes = ['hunter', 'signal', 'manual', 'scalper'];
      const botNames = ['Hunter Alpha', 'Signal Pro', 'Manual Desk', 'Scalper X'];
      for (let i = 0; i < botTypes.length; i++) {
        await createBotInstance(user.id, botTypes[i] as any, botNames[i], 100);
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
      const result = await madarRead<any>('users', { where: { id: userId } });
      
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
      const result = await madarRead<any>('users', { where: { email } });
      
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
    if (data.externalWalletAddress !== undefined) {
      dbData.externalWalletAddress = JSON.stringify(data.externalWalletAddress);
    }

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
    let externalWalletAddress: Record<string, string> = {};
    try {
      if (dbUser.externalWalletAddress) {
        externalWalletAddress = typeof dbUser.externalWalletAddress === 'string' 
          ? JSON.parse(dbUser.externalWalletAddress) 
          : dbUser.externalWalletAddress;
      }
    } catch {
      externalWalletAddress = {};
    }

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
      tradeMode: dbUser.tradeMode || 'individual',
      externalWalletAddress,
    };
  }

  // ============================================================
  // 💰 إدارة الرصيد والأرباح
  // ============================================================

  static async deposit(
    userId: string, 
    amount: number, 
    txHash: string, 
    network: string = 'base'
  ): Promise<void> {
    const account = await this.getAccount(userId);
    if (!account) throw new Error('المستخدم غير موجود');

    const newBalance = account.balance + amount;
    await this.updateAccount(userId, {
      balance: newBalance,
      totalDeposited: account.totalDeposited + amount,
    });

    const wallet = await this.getUserWallet(userId, network);
    if (wallet) {
      await this.updateUserWalletBalance(userId, network, wallet.balance + amount);
      console.log(`✅ تم تحديث رصيد المحفظة ${network}: ${wallet.balance + amount}`);
    }

    await this.addTransaction({
      userId,
      type: 'DEPOSIT',
      amount,
      balanceAfter: newBalance,
      txHash,
      description: `💰 إيداع $${amount.toFixed(2)} على ${network}`,
      status: 'completed',
      metadata: { network },
    });
  }

  // ✅ ربط المحفظة الخارجية
  static async linkExternalWallet(
    userId: string,
    network: string,
    address: string
  ): Promise<{ success: boolean; error?: string }> {
    const account = await this.getAccount(userId);
    if (!account) return { success: false, error: 'المستخدم غير موجود' };

    const externalWallets = account.externalWalletAddress || {};
    externalWallets[network] = address;

    await this.updateAccount(userId, {
      externalWalletAddress: externalWallets,
      walletLinkedAt: getTimestamp(),
    });

    return { success: true };
  }

  // ✅ السحب إلى المحفظة الخارجية
  static async withdrawToExternalWallet(
    userId: string,
    network: string,
    amount: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const account = await this.getAccount(userId);
    if (!account) return { success: false, error: 'المستخدم غير موجود' };

    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) return { success: false, error: 'لا توجد محفظة' };
    if (wallet.balance < amount) return { success: false, error: 'الرصيد غير كافٍ' };

    const externalAddress = account.externalWalletAddress?.[network];
    if (!externalAddress) {
      return { success: false, error: 'الرجاء ربط محفظة خارجية أولاً' };
    }

    const botWallet = BotWalletManager.getInstance();
    const result = await botWallet.sendToUser({
      toAddress: externalAddress,
      amount,
      network,
      password: 'master_password',
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    await this.updateUserWalletBalance(userId, network, wallet.balance - amount);
    await this.updateAccount(userId, {
      balance: account.balance - amount,
      totalWithdrawn: account.totalWithdrawn + amount,
    });

    await this.addTransaction({
      userId,
      type: 'WITHDRAW',
      amount,
      balanceAfter: account.balance - amount,
      txHash: result.txHash,
      description: `💸 سحب $${amount.toFixed(2)} إلى المحفظة الخارجية (${network})`,
      status: 'completed',
      metadata: { network, externalAddress },
    });

    return { success: true, txHash: result.txHash };
  }

 // ============================================================
// 💰 إدارة محافظ المستخدمين (9 شبكات)
// ============================================================

// ✅ إنشاء محفظة للمستخدم على شبكة محددة
static async createUserWallet(userId: string, network: string): Promise<UserWallet> {
  console.log(`💰 createUserWallet - إنشاء محفظة للمستخدم ${userId} على ${network}`);
  
  const user = await this.getAccount(userId);
  if (!user) throw new Error('المستخدم غير موجود');

  // ✅ التحقق من وجود محفظة بنفس الشبكة
  const existing = await this.getUserWallet(userId, network);
  if (existing) {
    throw new Error(`توجد محفظة بالفعل لشبكة ${network}`);
  }

  // ✅ إنشاء عنوان ومفتاح خاص
  const { address, privateKey } = createWallet(network);
  const encryptedKey = encrypt(privateKey, 'user_wallet_salt');

  const wallet: UserWallet = {
    id: generateId(),
    userId,
    network,
    address,
    encryptedPrivateKey: encryptedKey,
    balance: 0,
    created_at: getTimestamp(),
    updated_at: getTimestamp(),
  };

  // ✅ فقط إنشاء محفظة المستخدم (وليس محفظة البوت)
  await madarCreate('user_wallets', wallet);
  console.log(`✅ تم إنشاء محفظة المستخدم ${network}: ${address.slice(0, 10)}...`);

  // ❌ تم إزالة إنشاء محفظة البوت التلقائي

  return wallet;
}

// ✅ جلب محفظة المستخدم على شبكة محددة
static async getUserWallet(userId: string, network: string): Promise<UserWallet | null> {
  try {
    const result = await madarRead<UserWallet>('user_wallets', { where: { userId, network } });
    if (result.success && result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  } catch (error) {
    console.error('❌ getUserWallet Error:', error);
    return null;
  }
}

// ✅ جلب جميع محافظ المستخدم
static async getAllUserWallets(userId: string): Promise<UserWallet[]> {
  try {
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.warn('⚠️ userId غير صالح:', userId);
      return [];
    }

    const userIdStr = String(userId);
    const result = await madarRead<UserWallet>('user_wallets', { where: { userId: userIdStr } });
    
    if (result.success && result.data) {
      const wallets = Array.isArray(result.data) ? result.data : [result.data];
      const filtered = wallets.filter(w => String(w.userId) === userIdStr);
      console.log(`✅ تم جلب ${filtered.length} محفظة للمستخدم ${userIdStr}`);
      return filtered;
    }
    return [];
  } catch (error) {
    console.error('❌ getAllUserWallets Error:', error);
    return [];
  }
}

// ✅ إنشاء محافظ لجميع الشبكات (9 شبكات)
static async ensureAllUserWallets(userId: string): Promise<void> {
  console.log(`🔄 ensureAllUserWallets - إنشاء محافظ لـ ${NETWORKS_LIST.length} شبكة للمستخدم ${userId}`);
  
  for (const network of NETWORKS_LIST) {
    try {
      const existing = await this.getUserWallet(userId, network);
      if (!existing) {
        await this.createUserWallet(userId, network);
        console.log(`✅ تم إنشاء محفظة ${network} للمستخدم ${userId}`);
      } else {
        console.log(`✅ محفظة ${network} موجودة بالفعل للمستخدم ${userId}`);
      }
    } catch (error) {
      console.warn(`⚠️ فشل إنشاء محفظة ${network}:`, error);
    }
  }
}

// ✅ تحديث رصيد محفظة المستخدم
static async updateUserWalletBalance(userId: string, network: string, balance: number): Promise<void> {
  const wallet = await this.getUserWallet(userId, network);
  if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
  
  await madarUpdate('user_wallets', wallet.id!, {
    balance,
    updated_at: getTimestamp(),
  });
}
  // ✅ جلب رصيد محفظة المستخدم من الشبكة
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

  // ✅ حذف محفظة المستخدم
  static async deleteUserWallet(userId: string, network: string): Promise<void> {
    const wallet = await this.getUserWallet(userId, network);
    if (!wallet) throw new Error(`لا توجد محفظة للمستخدم على ${network}`);
    
    await madarDelete('user_wallets', wallet.id!);
    console.log(`🗑️ تم حذف محفظة ${network} للمستخدم ${userId}`);
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

  // ============================================================
  // 🏦 الخزانة (Treasury)
  // ============================================================

  static async getTreasury(): Promise<TreasuryStats> {
    try {
      const result = await madarRead<TreasuryStats>('treasury');
      if (result.success && result.data && result.data.length > 0) {
        return result.data[0];
      }
    } catch (error) {
      console.warn('⚠️ فشل جلب الخزانة، جاري إنشاء جديدة:', error);
    }

    const newTreasury: TreasuryStats = {
      id: generateId(),
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

  private static async updateTreasury(amount: number): Promise<void> {
    const treasury = await this.getTreasury();
    treasury.totalCollected += amount;
    treasury.currentBalance += amount;
    treasury.totalTrades += 1;
    treasury.lastUpdated = getTimestamp();
    
    if (treasury.id) {
      await madarUpdate('treasury', treasury.id, treasury);
    } else {
      await madarCreate('treasury', treasury);
    }
  }

  // ============================================================
  // 📊 إحصائيات النظام والمستخدم
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
    const result = await madarRead<Transaction>('transactions', { where: { userId } });
    if (result.success && result.data) {
      return result.data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return [];
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
  networks: NETWORKS_LIST,
};