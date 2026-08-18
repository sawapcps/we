// src/lib/botTrading.ts

import { BotWalletManager } from './wallet';
import { AccountManager } from './accounts';
import { discoverAllPairs } from './discovery';
import { runHunterPipeline } from './hunterEngine';
import { analyzeToken } from './gemini';
import type { ChainId, DiscoveredToken } from '@/types';

export class BotTradingSystem {
  private static instance: BotTradingSystem;
  private isRunning: boolean = false;
  private wallet: BotWalletManager;

  private constructor() {
    this.wallet = BotWalletManager.getInstance();
  }

  static getInstance(): BotTradingSystem {
    if (!BotTradingSystem.instance) {
      BotTradingSystem.instance = new BotTradingSystem();
    }
    return BotTradingSystem.instance;
  }

  async runTradingCycle(networks: ChainId[], password: string): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ البوت يعمل بالفعل');
      return;
    }

    this.isRunning = true;
    console.log('🚀 بدء دورة التداول...');

    try {
      for (const network of networks) {
        await this.scanAndTrade(network, password);
      }
    } catch (error) {
      console.error('❌ خطأ في دورة التداول:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async scanAndTrade(network: ChainId, password: string): Promise<void> {
    console.log(🔍 مسح الشبكة: );

    const result = await discoverAllPairs(network);
    if (result.error || result.pairs.length === 0) {
      console.log(⚠️ لا توجد عملات على );
      return;
    }

    const huntResult = runHunterPipeline(result.pairs, network, {
      minLiquidityUsd: 50000,
      minVolume24h: 100000,
      minPriceChange24h: 0,
    });

    const candidates = huntResult.tokens
      .filter(t => t.status === 'candidate')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (candidates.length === 0) {
      console.log(ℹ️ لا توجد مرشحين على );
      return;
    }

    console.log(✅ تم العثور على  مرشح على );

    for (const token of candidates) {
      await this.processCandidate(token, network, password);
    }
  }

  private async processCandidate(token: DiscoveredToken, network: ChainId, password: string): Promise<void> {
    console.log(🧠 تحليل ...);

    let shouldBuy = token.status === 'candidate';
    let reason = Hunter score /100;

    try {
      const analysis = await analyzeToken(token);
      shouldBuy = analysis.recommendation === 'strong_buy' || analysis.recommendation === 'buy';
      reason +=  - AI:  (%);
    } catch {
      console.log(⚠️ فشل تحليل AI لـ );
    }

    if (!shouldBuy) {
      console.log(⏭️ تخطي : );
      return;
    }

    const users = await AccountManager.getAllUsers();
    const activeUsers = users.filter(u => u.balance > 10 && u.status === 'active');
    
    if (activeUsers.length === 0) {
      console.log('ℹ️ لا يوجد مستخدمين نشطين');
      return;
    }

    console.log(💰  مستخدم نشط);

    for (const user of activeUsers) {
      const amount = Math.min(user.balance * 0.1, 50);
      
      if (amount < 1) {
        console.log(⏭️ رصيد  غير كاف ($));
        continue;
      }

      console.log(📈 تنفيذ شراء  لـ  بـ $);

      const tradeResult = await this.wallet.executeBuy({
        tokenAddress: token.tokenAddress,
        amountInSol: amount / 100,
        slippage: 0.01,
        password,
      });

      if (tradeResult.success) {
        const grossProfit = amount * 0.05;
        
        const { netProfit, commission } = await AccountManager.addProfit(
          user.id,
          grossProfit,
          {
            token: token.symbol,
            amount,
            price: token.priceUsd,
            txHash: tradeResult.txHash || 'pending',
          }
        );
        
        console.log(✅ تم شراء  لـ );
        console.log(   📊 الربح الإجمالي: Green{grossProfit.toFixed(2)});
        console.log(   🏦 عمولة 15%: Green{commission.toFixed(2)});
        console.log(   💰 صافي الربح: Green{netProfit.toFixed(2)});
      } else {
        console.log(❌ فشل شراء  لـ : );
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('⏹️ تم إيقاف البوت');
  }

  getStatus(): boolean {
    return this.isRunning;
  }
}
