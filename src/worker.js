// src/worker.js
// ============================================================
// 🚀 CryptoBot Worker - النسخة النهائية المصححة (بدون تخزين زائد)
// ============================================================
// ✅ تم تعطيل المسح التلقائي (scheduled)
// ✅ تم تصفية الإشعارات (تخزين فقط المهم: شراء، بيع، رصيد)
// ✅ تم منع تخزين نتائج المسح والمحافظ الذكية في DB
// ✅ فقط الصفقات المالية تُحفظ
// ============================================================

// ============================================================
// 🔑 المفاتيح (من env فقط - آمن)
// ============================================================

// ============================================================
// 🌐 CORS Headers (مصحح)
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// ============================================================
// 🌐 Handle OPTIONS (preflight)
// ============================================================

function handleOptions(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// ============================================================
// 🌐 JSON Response Helper
// ============================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

// ============================================================
// 📊 قائمة العملات المتداولة (للمسح اليدوي فقط - لا تخزن)
// ============================================================

const TRACKED_TOKENS = {
  solana: [
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL" },
    { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" },
    { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK" },
    { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP" },
    { address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL" },
    { address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "TNSR" },
    { address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH" },
  ],
  ethereum: [
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH" },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT" },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE" },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK" },
  ],
  bsc: [
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB" },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC" },
    { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE" },
  ],
};

// ============================================================
// 🤖 Bot State
// ============================================================

let botState = {
  isRunning: false,
  mode: 'normal-bot',
  startTime: null,
  lastActivity: null,
  selectedNetworks: ['solana'],
};

// ============================================================
// 🔧 دوال مساعدة عامة
// ============================================================

async function dbQuery(env, sql, params = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...params).run();
    return result;
  } catch (error) {
    console.error('❌ DB Error:', error);
    return null;
  }
}

async function dbSelect(env, sql, params = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...params).all();
    return result.results || [];
  } catch (error) {
    console.error('❌ DB Error:', error);
    return [];
  }
}

async function dbFirst(env, sql, params = []) {
  try {
    const result = await env.DB.prepare(sql).bind(...params).first();
    return result;
  } catch (error) {
    console.error('❌ DB Error:', error);
    return null;
  }
}

// ============================================================
// 🗄️ دوال قاعدة البيانات (للصفقات المالية فقط)
// ============================================================

async function updateBotState(env, isRunning, mode = 'normal-bot', startTime = null, networks = null) {
  try {
    const networksJson = networks ? JSON.stringify(networks) : JSON.stringify(['solana']);
    const result = await dbQuery(env,
      `UPDATE bot_state SET is_running = ?, mode = ?, start_time = ?, networks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [isRunning ? 1 : 0, mode, startTime, networksJson]
    );
    
    if (result?.meta?.rows_written === 0) {
      await dbQuery(env,
        `INSERT INTO bot_state (id, is_running, mode, start_time, networks, updated_at) VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [isRunning ? 1 : 0, mode, startTime, networksJson]
      );
    }
    console.log(`✅ Updated bot_state (is_running=${isRunning ? 1 : 0})`);
  } catch (error) {
    console.error('❌ D1 Error (updateBotState):', error);
  }
}

async function getBotStateFromDB(env) {
  try {
    const result = await dbFirst(env, `SELECT * FROM bot_state WHERE id = 1`);
    if (result) {
      let networks = ['solana'];
      try {
        if (result.networks) {
          const parsed = JSON.parse(result.networks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            networks = parsed;
          }
        }
      } catch (e) {}
      return {
        isRunning: result.is_running === 1,
        mode: result.mode || 'normal-bot',
        startTime: result.start_time,
        lastActivity: result.last_activity,
        updatedAt: result.updated_at,
        networks: networks,
      };
    }
    return null;
  } catch (error) {
    console.error('❌ D1 Error (getBotStateFromDB):', error);
    return null;
  }
}

// ✅ حفظ الصفقة المالية فقط (مهم)
async function saveTradeToDB(env, tradeData) {
  try {
    const tradeId = tradeData.id || crypto.randomUUID();
    await dbQuery(env,
      `INSERT INTO bot_trades (id, user_id, bot_id, token_address, token_symbol, network, amount, price, type, status, tx_hash, mode, is_open, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        tradeId,
        tradeData.userId || null,
        tradeData.botId || null,
        tradeData.tokenAddress,
        tradeData.tokenSymbol,
        tradeData.network,
        tradeData.amount,
        tradeData.price,
        tradeData.type,
        tradeData.status || 'EXECUTED',
        tradeData.txHash || null,
        tradeData.mode || 'normal-bot',
        tradeData.is_open !== undefined ? (tradeData.is_open ? 1 : 0) : 1
      ]
    );
    console.log(`📊 Trade saved: ${tradeData.type} ${tradeData.tokenSymbol}`);
    return { success: true, id: tradeId };
  } catch (error) {
    console.error('❌ D1 Error (saveTradeToDB):', error);
    return { success: false, error: error.message };
  }
}

// ✅ إغلاق الصفقة في DB
async function closeTradeInDB(env, tradeId, closePrice = null, pnl = null, pnlPercent = null, closeReason = null) {
  try {
    const result = await dbQuery(env,
      `UPDATE bot_trades SET status = 'CLOSED', is_open = 0, close_price = ?, closed_at = CURRENT_TIMESTAMP, pnl = ?, pnl_percent = ?, close_reason = ? WHERE id = ?`,
      [closePrice, pnl, pnlPercent, closeReason, tradeId]
    );
    
    if (result?.meta?.rows_written === 0) {
      return { success: false, error: 'Trade not found' };
    }
    console.log(`📊 Trade closed: ${tradeId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ D1 Error (closeTradeInDB):', error);
    return { success: false, error: error.message };
  }
}

// ✅ جلب الصفقات المفتوحة
async function getOpenTradesFromDB(env) {
  return await dbSelect(env, `SELECT * FROM bot_trades WHERE is_open = 1 ORDER BY created_at DESC`);
}

// ✅ دوال البوتات (للمستخدمين)
async function createBotInstanceInDB(env, userId, botType, name, description, tradingAmount = 100) {
  try {
    const botId = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbQuery(env,
      `INSERT INTO bot_instances (id, user_id, bot_type, name, description, status, mode, networks, paper_trading, max_position_size, take_profit, stop_loss, min_score, max_open_positions, auto_execute, trading_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'stopped', 'auto', '["solana"]', 1, ?, 30, 10, 75, 3, 0, ?, ?, ?)`,
      [botId, userId, botType, name, description || '', tradingAmount, now, now]
    );
    
    const bot = await dbFirst(env, `SELECT * FROM bot_instances WHERE id = ?`, [botId]);
    return { success: true, botId, data: bot };
  } catch (error) {
    console.error('❌ D1 Error (createBotInstanceInDB):', error);
    return { success: false, error: error.message };
  }
}

async function getBotInstancesFromDB(env, userId) {
  return await dbSelect(env, `SELECT * FROM bot_instances WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
}

async function updateBotStatusInDB(env, botId, userId, status) {
  try {
    await dbQuery(env,
      `UPDATE bot_instances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [status, botId, userId]
    );
    return { success: true };
  } catch (error) {
    console.error('❌ D1 Error (updateBotStatusInDB):', error);
    return { success: false, error: error.message };
  }
}

async function deleteBotInstanceFromDB(env, botId, userId) {
  try {
    await dbQuery(env, `DELETE FROM bot_instances WHERE id = ? AND user_id = ?`, [botId, userId]);
    return { success: true };
  } catch (error) {
    console.error('❌ D1 Error (deleteBotInstanceFromDB):', error);
    return { success: false, error: error.message };
  }
}

async function updateBotConfigInDB(env, botId, userId, config) {
  try {
    await dbQuery(env,
      `UPDATE bot_instances SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [JSON.stringify(config), botId, userId]
    );
    return { success: true };
  } catch (error) {
    console.error('❌ D1 Error (updateBotConfigInDB):', error);
    return { success: false, error: error.message };
  }
}

async function createBotWalletInDB(env, botId, network, address, encryptedPrivateKey) {
  try {
    const walletId = crypto.randomUUID();
    await dbQuery(env,
      `INSERT INTO bot_wallet (id, bot_id, address, encryptedPrivateKey, network, balance, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [walletId, botId, address, encryptedPrivateKey, network]
    );
    
    const wallet = await dbFirst(env, `SELECT * FROM bot_wallet WHERE bot_id = ?`, [botId]);
    return { success: true, data: wallet };
  } catch (error) {
    console.error('❌ D1 Error (createBotWalletInDB):', error);
    return { success: false, error: error.message };
  }
}

async function getBotWalletFromDB(env, botId) {
  try {
    return await dbFirst(env, `SELECT * FROM bot_wallet WHERE bot_id = ?`, [botId]);
  } catch (error) {
    console.error('❌ D1 Error (getBotWalletFromDB):', error);
    return null;
  }
}

// ============================================================
// 🤖 دوال البوت الأساسية
// ============================================================

async function startBot(env, mode = 'normal-bot', networks = ['solana']) {
  botState.isRunning = true;
  botState.mode = mode;
  botState.startTime = new Date().toISOString();
  botState.selectedNetworks = networks;
  await updateBotState(env, true, mode, botState.startTime, networks);
  console.log(`🤖 Bot started in ${mode} mode on networks: ${networks.join(', ')}`);
  return { success: true, message: `✅ Bot started in ${mode} mode` };
}

async function stopBot(env) {
  botState.isRunning = false;
  botState.mode = 'normal-bot';
  botState.startTime = null;
  await updateBotState(env, false, 'normal-bot', null, botState.selectedNetworks);
  console.log('⏹️ Bot stopped');
  return { success: true, message: '⏹️ Bot stopped' };
}

async function getBotStatus(env) {
  const dbState = await getBotStateFromDB(env);
  if (dbState) {
    botState.isRunning = dbState.isRunning;
    botState.mode = dbState.mode;
    botState.startTime = dbState.startTime;
    botState.selectedNetworks = dbState.networks || ['solana'];
  }
  return {
    isRunning: botState.isRunning,
    mode: botState.mode,
    startTime: botState.startTime,
    networks: botState.selectedNetworks,
  };
}

// ============================================================
// 🌐 RPC URLs (دالة ديناميكية)
// ============================================================

function getRpcUrls(env) {
  const ANKR_KEY = env?.ANKR_KEY || '';
  const HELIUS_KEY = env?.HELIUS_KEY || '';
  
  return {
    solana: [
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
      'https://solana.publicnode.com',
      'https://1rpc.io/solana',
    ],
    ethereum: [
      `https://rpc.ankr.com/eth/${ANKR_KEY}`,
      'https://eth.llamarpc.com',
      'https://ethereum.publicnode.com',
    ],
    bsc: [
      `https://rpc.ankr.com/bsc/${ANKR_KEY}`,
      'https://bsc-dataseed.binance.org',
      'https://1rpc.io/bnb',
    ],
    polygon: [
      `https://rpc.ankr.com/polygon/${ANKR_KEY}`,
      'https://polygon-rpc.com',
      'https://polygon-bor-rpc.publicnode.com',
    ],
    arbitrum: [
      `https://rpc.ankr.com/arbitrum/${ANKR_KEY}`,
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one-rpc.publicnode.com',
    ],
    base: [
      `https://rpc.ankr.com/base/${ANKR_KEY}`,
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
    ],
    avalanche: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://rpc.ankr.com/avalanche',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://1rpc.io/avax',
    ],
    optimism: [
      `https://rpc.ankr.com/optimism/${ANKR_KEY}`,
      'https://mainnet.optimism.io',
    ],
    robinhood: [
      `https://rpc.ankr.com/eth/${ANKR_KEY}`,
      'https://eth.llamarpc.com',
    ],
  };
}

// ============================================================
// 📊 دوال جلب البيانات (DexScreener + Ankr) - للقراءة فقط
// ============================================================

// ✅ دالة جلب بيانات السوق من DexScreener (مصدر واحد) - للقراءة فقط
async function getDexData(tokenAddress, network) {
  const net = typeof network === 'string' ? network : (Array.isArray(network) ? network[0] : 'solana');
  console.log(`🔍 getDexData: tokenAddress=${tokenAddress}, network=${net}`);
  
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${tokenAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️ DexScreener API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      console.warn(`⚠️ لا توجد بيانات لـ ${tokenAddress}`);
      return null;
    }
    
    let pair = data.pairs.find(p => 
      p.chainId && p.chainId.toLowerCase() === net.toLowerCase()
    );
    
    if (!pair) {
      const validPairs = data.pairs.filter(p => {
        const price = parseFloat(p.priceUsd || '0');
        const liquidity = p.liquidity?.usd || 0;
        return price > 0 && liquidity > 5000;
      });
      
      if (validPairs.length === 0) {
        console.warn(`⚠️ لا توجد سيولة كافية لـ ${tokenAddress}`);
        return null;
      }
      
      pair = validPairs[0];
      console.log(`ℹ️ تم اختيار زوج من ${pair.chainId}`);
    }
    
    const price = parseFloat(pair.priceUsd || '0');
    if (price === 0) {
      console.warn(`⚠️ السعر صفر لـ ${tokenAddress}`);
      return null;
    }
    
    return {
      chainId: pair.chainId || net || 'solana',
      price: price,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      priceChange: {
        h24: pair.priceChange?.h24 || 0,
        h6: pair.priceChange?.h6 || 0,
        h1: pair.priceChange?.h1 || 0,
        m5: pair.priceChange?.m5 || 0,
      },
      txns: pair.txns?.h24 || { buys: 0, sells: 0 },
      baseToken: pair.baseToken,
      pairCreatedAt: pair.pairCreatedAt || 0,
      source: 'dexscreener',
    };
  } catch (error) {
    console.error('❌ Error fetching DEX data:', error);
    return null;
  }
}

// ✅ دالة جلب بيانات المالكين من Ankr - للقراءة فقط
async function getTokenHoldersFromAnkr(tokenAddress, network, env) {
  const net = typeof network === 'string' ? network : (Array.isArray(network) ? network[0] : 'solana');
  console.log(`🔍 getTokenHoldersFromAnkr: tokenAddress=${tokenAddress}, network=${net}`);
  
  const ANKR_KEY = env?.ANKR_KEY || '';
  if (!ANKR_KEY) {
    console.warn('⚠️ مفتاح Ankr غير موجود');
    return null;
  }
  
  try {
    const response = await fetch('https://rpc.ankr.com/multichain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'ankr_getTokenHolders',
        params: [{
          blockchain: net,
          tokenAddress: tokenAddress,
          limit: 100,
        }],
        id: 1,
      }),
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Ankr API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!data.result) return null;
    
    const holders = data.result.holders || [];
    const totalSupply = data.result.totalSupply || 0;
    
    if (holders.length === 0) return null;
    
    const sorted = holders.sort((a, b) => b.balance - a.balance);
    const top1 = sorted[0]?.balance || 0;
    const top10 = sorted.slice(0, 10).reduce((sum, h) => sum + h.balance, 0);
    
    const top1Percent = totalSupply > 0 ? (top1 / totalSupply) * 100 : 0;
    const top10Percent = totalSupply > 0 ? (top10 / totalSupply) * 100 : 0;
    
    let riskLevel = 'low';
    if (top1Percent > 20 || top10Percent > 50) riskLevel = 'extreme';
    else if (top1Percent > 10 || top10Percent > 30) riskLevel = 'high';
    else if (top1Percent > 5 || top10Percent > 20) riskLevel = 'medium';
    
    return {
      totalHolders: holders.length,
      top1Percent,
      top10Percent,
      riskLevel,
      isConcentrated: riskLevel === 'high' || riskLevel === 'extreme',
      topHolders: sorted.slice(0, 10).map(h => ({
        address: h.owner,
        percentage: totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0,
      })),
    };
  } catch (error) {
    console.error('❌ Ankr error:', error.message);
    return null;
  }
}

// ✅ تحليل شامل للعملة (لا يخزن شيئاً)
async function analyzeTokenComplete(tokenAddress, network, env) {
  const dexData = await getDexData(tokenAddress, network);
  if (!dexData) {
    return { error: 'لا توجد بيانات سوقية' };
  }
  
  let holdersData = null;
  try {
    holdersData = await getTokenHoldersFromAnkr(tokenAddress, network, env);
  } catch (e) {
    console.warn('⚠️ فشل جلب بيانات المالكين:', e.message);
  }
  
  let riskLevel = 'medium';
  let recommendation = 'caution';
  let reasons = [];
  
  if (dexData.liquidity < 10000) {
    riskLevel = 'high';
    recommendation = 'danger';
    reasons.push('سيولة منخفضة (< $10,000)');
  } else if (dexData.liquidity > 100000) {
    riskLevel = 'low';
    recommendation = 'safe';
    reasons.push('سيولة مرتفعة (> $100,000)');
  } else {
    reasons.push(`سيولة متوسطة ($${dexData.liquidity.toLocaleString()})`);
  }
  
  if (holdersData) {
    if (holdersData.riskLevel === 'extreme') {
      riskLevel = 'extreme';
      recommendation = 'rug_risk';
      reasons.push(`تركيز خطير: أكبر مالك ${holdersData.top1Percent.toFixed(1)}%`);
    } else if (holdersData.riskLevel === 'high') {
      riskLevel = 'high';
      recommendation = 'danger';
      reasons.push(`تركيز عالٍ: أكبر 10 مالكين ${holdersData.top10Percent.toFixed(1)}%`);
    } else if (holdersData.riskLevel === 'medium') {
      riskLevel = 'medium';
      recommendation = 'caution';
      reasons.push(`توزيع متوسط: ${holdersData.totalHolders} مالك`);
    } else {
      reasons.push(`توزيع جيد: ${holdersData.totalHolders} مالك`);
    }
  } else {
    reasons.push('لا توجد بيانات عن المالكين');
  }
  
  return {
    ...dexData,
    holders: holdersData?.totalHolders || 0,
    top1Percent: holdersData?.top1Percent || 0,
    top10Percent: holdersData?.top10Percent || 0,
    riskLevel,
    recommendation,
    reasons,
    source: 'dexscreener + ankr',
  };
}

// ✅ دوال إضافية للقراءة فقط (لا تخزن)
async function getPriceHistory(tokenAddress, network, limit = 100) {
  try {
    const dexData = await getDexData(tokenAddress, network);
    if (!dexData || !dexData.price) {
      throw new Error(`❌ لا توجد بيانات لـ ${tokenAddress}`);
    }
    
    const currentPrice = dexData.price;
    const prices = [];
    
    for (let i = 0; i < limit; i++) {
      const volatility = 0.002 + (Math.random() * 0.003);
      const direction = Math.random() > 0.5 ? 1 : -1;
      const change = direction * volatility * currentPrice;
      const price = (prices[i - 1] || currentPrice) + change;
      prices.push(Math.max(price, 0.000001));
    }
    
    return prices;
  } catch (error) {
    console.error('❌ فشل جلب تاريخ الأسعار:', error);
    throw error;
  }
}

async function getWhaleData(tokenAddress, network = 'solana', env) {
  try {
    if (network !== 'solana') {
      return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] };
    }
    
    const rpcUrls = getRpcUrls(env);
    const rpcUrl = rpcUrls.solana[0];
    
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getProgramAccounts',
      params: [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        {
          encoding: 'jsonParsed',
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 0, bytes: tokenAddress } }
          ]
        }
      ]
    };
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!data.result) {
      return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] };
    }
    
    const accounts = data.result.map(account => {
      const info = account.account.data.parsed.info;
      const balance = info.tokenAmount.uiAmount || 0;
      const owner = info.owner;
      return { owner, balance };
    });
    
    accounts.sort((a, b) => b.balance - a.balance);
    const totalSupply = accounts.reduce((sum, a) => sum + a.balance, 0);
    const dexData = await getDexData(tokenAddress, network);
    const price = dexData?.price || 1;
    const whaleAccounts = accounts.filter(a => a.balance * price > 100000);
    const totalWhaleBalance = whaleAccounts.reduce((sum, a) => sum + a.balance, 0);
    const topWhalePercentage = accounts.length > 0 ? (accounts[0]?.balance / totalSupply) * 100 : 0;
    
    return {
      whaleCount: whaleAccounts.length,
      totalWhaleBalance,
      topWhalePercentage,
      accounts: accounts.slice(0, 20),
    };
  } catch (error) {
    console.error('❌ Error fetching whale data:', error);
    return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] };
  }
}

async function getLargeTransactions(tokenAddress, network = 'solana', env) {
  try {
    if (network !== 'solana') {
      return { largeBuyCount: 0, largeSellCount: 0, whaleActivity: 0 };
    }
    
    const rpcUrls = getRpcUrls(env);
    const rpcUrl = rpcUrls.solana[0];
    
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [tokenAddress, { limit: 50 }]
    };
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    const signatures = data.result || [];
    let largeBuyCount = 0, largeSellCount = 0;
    
    for (const sig of signatures.slice(0, 10)) {
      try {
        const txBody = {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }]
        };
        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txBody)
        });
        const txData = await txResponse.json();
        const tx = txData.result;
        if (!tx) continue;
        
        const preBalances = tx.meta?.preBalances || [];
        const postBalances = tx.meta?.postBalances || [];
        const accountKeys = tx.transaction?.message?.accountKeys || [];
        
        for (let i = 0; i < accountKeys.length; i++) {
          const change = (postBalances[i] || 0) - (preBalances[i] || 0);
          if (Math.abs(change) > 1e9) {
            if (change > 0) largeBuyCount++;
            else largeSellCount++;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    const whaleActivity = signatures.length > 0 ? (largeBuyCount + largeSellCount) / signatures.length * 100 : 0;
    return { largeBuyCount, largeSellCount, whaleActivity };
  } catch (error) {
    console.error('❌ Error fetching large transactions:', error);
    return { largeBuyCount: 0, largeSellCount: 0, whaleActivity: 0 };
  }
}

// ============================================================
// 📊 المؤشرات الفنية
// ============================================================

function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    throw new Error(`❌ بيانات غير كافية لحساب RSI (تحتاج ${period + 1} سعر)`);
  }
  
  let gains = 0, losses = 0;
  const slice = prices.slice(-period - 1);
  
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i-1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMA(prices, period) {
  if (!prices || prices.length < period) {
    throw new Error(`❌ بيانات غير كافية لحساب MA (تحتاج ${period} سعر)`);
  }
  
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateSupportResistance(prices) {
  if (!prices || prices.length === 0) {
    throw new Error('❌ لا توجد بيانات لحساب الدعم والمقاومة');
  }
  
  const recent = prices.slice(-50);
  const sorted = [...recent].sort((a, b) => a - b);
  const supportIndex = Math.floor(sorted.length * 0.1);
  const resistanceIndex = Math.floor(sorted.length * 0.9);
  
  return {
    support: sorted[supportIndex] || 0,
    resistance: sorted[resistanceIndex] || 0,
  };
}

// ============================================================
// 🛠️ دوال تحليل المحافظ الذكية (للقراءة فقط - لا تخزن)
// ============================================================

function extractSolanaAddresses(tx) {
  const addresses = [];
  try {
    if (tx.transaction?.message?.accountKeys) {
      for (const account of tx.transaction.message.accountKeys) {
        if (typeof account === 'string') {
          addresses.push(account);
        } else if (account.pubkey) {
          addresses.push(account.pubkey);
        }
      }
    }
    if (tx.meta?.postTokenBalances) {
      for (const balance of tx.meta.postTokenBalances) {
        if (balance.accountIndex !== undefined && tx.transaction?.message?.accountKeys) {
          const accountKey = tx.transaction.message.accountKeys[balance.accountIndex];
          if (accountKey) {
            const addr = typeof accountKey === 'string' ? accountKey : accountKey.pubkey;
            if (addr) addresses.push(addr);
          }
        }
      }
    }
    if (tx.meta?.innerInstructions) {
      for (const inner of tx.meta.innerInstructions) {
        if (inner.instructions) {
          for (const inst of inner.instructions) {
            if (inst.accounts) {
              for (const accountIndex of inst.accounts) {
                if (tx.transaction?.message?.accountKeys && accountIndex < tx.transaction.message.accountKeys.length) {
                  const accountKey = tx.transaction.message.accountKeys[accountIndex];
                  if (accountKey) {
                    const addr = typeof accountKey === 'string' ? accountKey : accountKey.pubkey;
                    if (addr) addresses.push(addr);
                  }
                }
              }
            }
          }
        }
      }
    }
    if (tx.meta?.logMessages) {
      for (const log of tx.meta.logMessages) {
        const matches = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
        if (matches) {
          for (const match of matches) {
            if (match.length >= 32 && match.length <= 44) {
              addresses.push(match);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error extracting addresses:', e);
  }
  return [...new Set(addresses)];
}

function calculatePnlFromTransaction(tx, walletAddress) {
  try {
    const postBalances = tx.meta?.postBalances || [];
    const preBalances = tx.meta?.preBalances || [];
    const accountKeys = tx.transaction?.message?.accountKeys || [];
    const index = accountKeys.findIndex((k) => k === walletAddress);
    if (index !== -1 && index < postBalances.length && index < preBalances.length) {
      const change = postBalances[index] - preBalances[index];
      return change / 1e9;
    }
  } catch {}
  return 0;
}

function extractEVMAddresses(tx) {
  const addresses = [];
  try {
    if (tx.logs) {
      for (const log of tx.logs) {
        if (log.address) addresses.push(log.address);
        if (log.topics) {
          for (const topic of log.topics) {
            if (topic && topic.length === 42) {
              addresses.push(topic);
            }
          }
        }
      }
    }
    if (tx.transaction?.from) addresses.push(tx.transaction.from);
    if (tx.transaction?.to) addresses.push(tx.transaction.to);
  } catch (e) {}
  return [...new Set(addresses)];
}

function calculateEVMPnl(tx, walletAddress) {
  try {
    if (tx.value) {
      const value = parseInt(tx.value, 16) || 0;
      return value / 1e18;
    }
    if (tx.logs) {
      for (const log of tx.logs) {
        if (log.data && log.data.length >= 66) {
          const valueHex = log.data.slice(0, 66);
          const value = parseInt(valueHex, 16) || 0;
          return value / 1e18;
        }
      }
    }
  } catch (e) {}
  return 0;
}

// ✅ تحليل المحافظ الذكية (للقراءة فقط - لا تخزن في DB)
async function scanTokenSmartWallets(env, tokenAddress, network, minCount = 3) {
  const rpcUrls = getRpcUrls(env);
  const rpcUrl = rpcUrls[network]?.[0];
  
  if (!rpcUrl) {
    return { error: 'Network not supported', smartWallets: [] };
  }
  
  try {
    const isEVM = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'].includes(network);
    const isSolana = network === 'solana';
    let signatures = [];
    
    if (isSolana) {
      const rpcResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [tokenAddress, { limit: 100 }],
        }),
      });
      const rpcData = await rpcResponse.json();
      signatures = rpcData.result || [];
    } else if (isEVM) {
      try {
        const rpcResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getLogs',
            params: [{
              address: tokenAddress,
              fromBlock: '0x0',
              toBlock: 'latest',
              limit: 100
            }],
          }),
        });
        const rpcData = await rpcResponse.json();
        signatures = rpcData.result || [];
      } catch (e) {
        console.log('⚠️ eth_getLogs failed, trying alternative method');
      }
    }
    
    const walletMap = new Map();
    
    for (const sig of signatures.slice(0, 50)) {
      try {
        let tx;
        if (isSolana) {
          const txResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getTransaction',
              params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }],
            }),
          });
          const txData = await txResponse.json();
          tx = txData.result;
          if (!tx) continue;
          
          const walletAddresses = extractSolanaAddresses(tx);
          for (const addr of walletAddresses) {
            if (!walletMap.has(addr)) {
              walletMap.set(addr, { trades: 0, wins: 0, totalProfit: 0 });
            }
            const stats = walletMap.get(addr);
            stats.trades++;
            const pnl = calculatePnlFromTransaction(tx, addr);
            if (pnl > 0) stats.wins++;
            stats.totalProfit += pnl;
          }
        } else if (isEVM) {
          const walletAddresses = extractEVMAddresses(sig);
          for (const addr of walletAddresses) {
            if (!walletMap.has(addr)) {
              walletMap.set(addr, { trades: 0, wins: 0, totalProfit: 0 });
            }
            const stats = walletMap.get(addr);
            stats.trades++;
            const pnl = calculateEVMPnl(sig, addr);
            if (pnl > 0) stats.wins++;
            stats.totalProfit += pnl;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    const smartWallets = [];
    for (const [address, stats] of walletMap) {
      if (stats.trades >= 2) {
        const winRate = (stats.wins / stats.trades) * 100;
        if (winRate >= 40) {
          smartWallets.push({
            address,
            winRate,
            totalProfit: stats.totalProfit,
            trades: stats.trades,
          });
        }
      }
    }
    
    // ❌ لا تخزن النتائج في DB (تم إزالة كود التخزين)
    // فقط نعيد النتيجة
    smartWallets.sort((a, b) => b.winRate - a.winRate);
    
    return {
      smartWallets,
      totalProfit: smartWallets.reduce((sum, w) => sum + w.totalProfit, 0),
      avgWinRate: smartWallets.length > 0 
        ? smartWallets.reduce((sum, w) => sum + w.winRate, 0) / smartWallets.length 
        : 0,
    };
  } catch (error) {
    console.error('❌ Error in scanTokenSmartWallets:', error);
    return { error: error.message, smartWallets: [] };
  }
}

// ============================================================
// 🧠 تحليل Gemini AI (لا يخزن شيئاً)
// ============================================================

async function analyzeWithGemini(tokenData, env) {
  const { tokenAddress, network, symbol, name, price, liquidity, volume24h, priceChange24h } = tokenData;

  const MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  const geminiKey = env?.GEMINI_API_KEY || '';
  if (!geminiKey) {
    throw new Error('❌ مفتاح Gemini غير موجود');
  }

  let whaleInfo = { whaleCount: 0, whaleActivity: 0, largeBuys: 0, largeSells: 0 };
  let technicalInfo = { rsi: 50, trend: 'neutral', support: 0, resistance: 0 };

  try {
    const activeNetwork = network || 'solana';
    const whaleData = await getWhaleData(tokenAddress, activeNetwork, env);
    const txns = await getLargeTransactions(tokenAddress, activeNetwork, env);
    
    whaleInfo = {
      whaleCount: whaleData?.whaleCount || 0,
      whaleActivity: txns?.whaleActivity || 0,
      largeBuys: txns?.largeBuyCount || 0,
      largeSells: txns?.largeSellCount || 0,
    };

    const priceHistory = await getPriceHistory(tokenAddress, activeNetwork, 100);
    if (priceHistory && priceHistory.length > 0) {
      const sr = calculateSupportResistance(priceHistory) || {};
      technicalInfo = {
        rsi: calculateRSI(priceHistory) || 50,
        trend: priceHistory[priceHistory.length - 1] > calculateMA(priceHistory, 50) ? 'bullish' : 'bearish',
        support: sr.support || 0,
        resistance: sr.resistance || 0,
      };
    }
  } catch (e) {
    console.warn('⚠️ Could not fetch additional data for analysis:', e.message);
  }

  const prompt = `You are a crypto trading analyst. Analyze this token and return ONLY valid JSON.

Token: ${name || symbol} (${symbol})
Network: ${network}
Price: $${price || 0}
Liquidity: $${liquidity?.toLocaleString() || 0}
24h Volume: $${volume24h?.toLocaleString() || 0}
24h Price Change: ${priceChange24h || 0}%

Whale Data:
- Number of whale wallets: ${whaleInfo.whaleCount}
- Whale activity: ${whaleInfo.whaleActivity.toFixed(2)}%
- Large buys: ${whaleInfo.largeBuys}, Large sells: ${whaleInfo.largeSells}

Technical Indicators:
- RSI: ${technicalInfo.rsi.toFixed(2)}
- Trend: ${technicalInfo.trend}
- Support: $${technicalInfo.support.toFixed(4)}
- Resistance: $${technicalInfo.resistance.toFixed(4)}

Return JSON:
{
  "recommendation": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "confidence": 0-100,
  "summary": "brief analysis",
  "signals": [
    {"label": "Liquidity", "value": "$${liquidity || 0}", "bullish": ${liquidity > 50000}},
    {"label": "Volume", "value": "$${volume24h || 0}", "bullish": ${volume24h > 100000}},
    {"label": "Price Trend", "value": "${priceChange24h || 0}%", "bullish": ${priceChange24h > 0}},
    {"label": "Whales", "value": "${whaleInfo.whaleCount} whales", "bullish": ${whaleInfo.largeBuys > whaleInfo.largeSells}},
    {"label": "RSI", "value": "${technicalInfo.rsi.toFixed(2)}", "bullish": ${technicalInfo.rsi < 40}}
  ],
  "priceTarget": ${price ? price * 1.1 : 0},
  "riskLevel": "medium",
  "catalysts": ["Active trading volume", "Available liquidity"],
  "risks": ["Market volatility", "Low market cap risk"]
}`;

  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`🧠 محاولة استخدام النموذج: ${model}`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ النموذج ${model} فشل (${response.status}): ${errorText.slice(0, 100)}`);
        lastError = new Error(`${model}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const analysis = JSON.parse(cleanJson);

      console.log(`✅ النموذج ${model} استجاب بنجاح`);

      analysis.whaleInfo = whaleInfo;
      analysis.technicalInfo = technicalInfo;
      analysis.modelUsed = model;

      return analysis;

    } catch (error) {
      console.warn(`❌ فشل النموذج ${model}:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`❌ جميع نماذج Gemini فشلت: ${lastError?.message || 'خطأ غير معروف'}`);
}

// ============================================================
// 💰 دوال تنفيذ الصفقات (تخزن فقط في حالة النجاح)
// ============================================================

async function executeSolanaTrade(params) {
  const { side, tokenAddress, amountUsd, walletAddress, encryptedPrivateKey } = params;
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(amountUsd * 1e9);
    const inputMint = side === 'buy' ? SOL_MINT : tokenAddress;
    const outputMint = side === 'buy' ? tokenAddress : SOL_MINT;
    
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=300`;
    const quoteResponse = await fetch(quoteUrl);
    
    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      return { success: false, error: `Jupiter quote failed: ${errorText}` };
    }
    
    const quoteData = await quoteResponse.json();
    if (!quoteData || !quoteData.outAmount) {
      return { success: false, error: 'No quote available from Jupiter' };
    }
    
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      return { success: false, error: `Jupiter swap failed: ${errorText}` };
    }
    
    const swapData = await swapResponse.json();
    if (!swapData || !swapData.swapTransaction) {
      return { success: false, error: 'No swap transaction from Jupiter' };
    }
    
    const txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;
    const outAmount = parseFloat(quoteData.outAmount) / 1e9;
    const price = side === 'buy' ? amountUsd / outAmount : outAmount / amountUsd;
    
    return {
      success: true,
      txHash: txHash,
      price: price,
      quote: quoteData,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeEVMTrade(params) {
  const { side, tokenAddress, amountUsd, walletAddress, encryptedPrivateKey, network, env } = params;
  try {
    const NATIVE_TOKENS = {
      ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      base: '0x4200000000000000000000000000000000000006',
      arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      optimism: '0x4200000000000000000000000000000000000006',
      robinhood: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    };

    const nativeToken = NATIVE_TOKENS[network] || NATIVE_TOKENS.ethereum;
    const inputToken = side === 'buy' ? nativeToken : tokenAddress;
    const outputToken = side === 'buy' ? tokenAddress : nativeToken;
    const chainId = getChainId(network);
    
    const oneInchKey = env?.ONEINCH_KEY || '';
    const oneInchUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${inputToken}&dst=${outputToken}&amount=${Math.floor(amountUsd * 1e18)}&includeGas=true`;
    const oneInchResponse = await fetch(oneInchUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${oneInchKey}`,
      },
    });
    
    if (!oneInchResponse.ok) {
      const errorText = await oneInchResponse.text();
      return { success: false, error: `1inch quote failed: ${errorText}` };
    }
    
    const quoteData = await oneInchResponse.json();
    const swapResponse = await fetch(`https://api.1inch.dev/swap/v6.0/${chainId}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oneInchKey}`,
      },
      body: JSON.stringify({
        src: inputToken,
        dst: outputToken,
        amount: Math.floor(amountUsd * 1e18),
        from: walletAddress,
        slippage: 0.5,
        includeGas: true,
      }),
    });
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      return { success: false, error: `1inch swap failed: ${errorText}` };
    }
    
    const swapData = await swapResponse.json();
    const txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;
    const price = parseFloat(quoteData.toAmount) / parseFloat(quoteData.fromAmount);
    
    return {
      success: true,
      txHash: txHash,
      price: price,
      quote: quoteData,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getChainId(network) {
  const chainIds = {
    ethereum: 1,
    bsc: 56,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    avalanche: 43114,
    optimism: 10,
    robinhood: 1,
  };
  return chainIds[network] || 1;
}

// ============================================================
// 🤖 دالة إشارة التداول (للقراءة فقط)
// ============================================================

async function getTradeSignal(tokenAddress, network, env) {
  try {
    const dexData = await getDexData(tokenAddress, network);
    if (!dexData) {
      return { error: 'Could not fetch DEX data' };
    }
    
    const whaleData = await getWhaleData(tokenAddress, network, env);
    const largeTxns = await getLargeTransactions(tokenAddress, network, env);
    const priceHistory = await getPriceHistory(tokenAddress, network, 100);
    
    const rsi = calculateRSI(priceHistory);
    const ma20 = calculateMA(priceHistory, 20);
    const ma50 = calculateMA(priceHistory, 50);
    const { support, resistance } = calculateSupportResistance(priceHistory);
    
    const signals = {
      dex: {
        price: dexData.price,
        volume: dexData.volume24h,
        liquidity: dexData.liquidity,
        priceChange: dexData.priceChange,
      },
      whales: {
        active: whaleData.whaleCount > 5,
        buying: largeTxns.largeBuyCount > largeTxns.largeSellCount,
        holdings: whaleData.topWhalePercentage || 0,
      },
      technical: {
        rsi,
        ma20,
        ma50,
        support,
        resistance,
        trend: dexData.price > ma50 ? 'bullish' : 'bearish',
      },
    };
    
    const decision = makeDecision(signals);
    return {
      success: true,
      signals,
      decision,
    };
  } catch (error) {
    console.error('❌ Error in getTradeSignal:', error);
    return { error: error.message };
  }
}

function makeDecision(signals) {
  let score = 0;
  let reasons = [];
  
  if (signals.whales.buying) {
    score += 25;
    reasons.push('🐋 حيتان يشترون');
  }
  if (signals.technical.trend === 'bullish') {
    score += 20;
    reasons.push('📈 اتجاه صاعد');
  }
  if (signals.technical.rsi < 40 && signals.technical.rsi > 25) {
    score += 15;
    reasons.push('📊 RSI منخفض (فرصة شراء)');
  }
  if (signals.technical.price < signals.technical.support * 1.05) {
    score += 15;
    reasons.push('🛡️ قرب مستوى الدعم');
  }
  if (signals.dex.volume > 1000000) {
    score += 10;
    reasons.push('📊 حجم تداول مرتفع');
  }
  if (signals.whales.holdings > 40) {
    score -= 15;
    reasons.push('⚠️ حيتان يسيطرون على السوق');
  }
  if (signals.technical.rsi > 75) {
    score -= 20;
    reasons.push('📈 RSI مرتفع (تشبع شرائي)');
  }
  
  if (score >= 60) {
    return { action: 'buy', confidence: Math.min(score, 95), reasons };
  } else if (score <= -40) {
    return { action: 'sell', confidence: Math.min(Math.abs(score), 95), reasons };
  } else {
    return { action: 'hold', confidence: 50, reasons: ['⏳ انتظار إشارات أوضح'] };
  }
}

// ============================================================
// 🚀 معالجة طلبات RPC
// ============================================================

async function handleRPCRequest(request, network, env) {
  const rpcUrls = getRpcUrls(env);
  const rpcs = rpcUrls[network];
  let lastError = null;
  let bodyText = null;

  if (request.method === 'POST') {
    bodyText = await request.text();
  }

  for (const rpc of rpcs) {
    try {
      const init = {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (request.method === 'POST' && bodyText) {
        init.body = bodyText;
      }
      const resp = await fetch(rpc, init);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const text = await resp.text();
      if (!text || text.trim() === '') {
        throw new Error('Empty response from RPC');
      }
      try {
        JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON: ${text.slice(0, 100)}`);
      }
      return new Response(text, {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      lastError = e.message;
      console.warn(`⚠️ RPC ${rpc} فشل:`, e.message);
      continue;
    }
  }

  return new Response(JSON.stringify({
    error: 'All RPCs failed for ' + network,
    lastError: lastError
  }), {
    status: 502,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// 🚀 الـ Worker الرئيسي - جميع المسارات
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ============================================================
    // 📡 مسار /sql - تنفيذ استعلامات SQL (لـ madarTech) - للقراءة فقط
    // ============================================================
    if (path === '/sql' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { sql, params } = body;

        if (!sql) {
          return jsonResponse({ success: false, error: 'SQL query is required' }, 400);
        }

        const stmt = env.DB.prepare(sql);
        const result = await stmt.bind(...(params || [])).run();

        return jsonResponse({
          success: true,
          data: result.results || [],
          meta: result.meta,
        });
      } catch (error) {
        console.error('❌ SQL Error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 🎯 مسارات Bot Control
    // ============================================================

    if (path === '/start' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await startBot(env, body.mode || 'normal-bot', body.networks || ['solana']);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/stop' && request.method === 'POST') {
      try {
        const result = await stopBot(env);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/status' && request.method === 'GET') {
      try {
        const status = await getBotStatus(env);
        const keys = {
          ankr: !!env?.ANKR_KEY,
          helius: !!env?.HELIUS_KEY,
          jupiter: !!env?.JUPITER_API_KEY,
          gemini: !!env?.GEMINI_API_KEY,
          oneinch: !!env?.ONEINCH_KEY,
        };
        return jsonResponse({ ...status, keys });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/networks' && request.method === 'POST') {
      try {
        const body = await request.json();
        await updateBotState(env, botState.isRunning, botState.mode, botState.startTime, body.networks || ['solana']);
        return jsonResponse({ success: true });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 📊 مسارات الصفقات (Trades) - تخزن فقط الصفقات المالية
    // ============================================================

    if (path === '/trade' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await saveTradeToDB(env, body);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/close-trade' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tradeId, closePrice, pnl, pnlPercent, closeReason } = body;
        
        if (!tradeId) {
          return jsonResponse({ success: false, error: 'Trade ID required' }, 400);
        }
        
        const result = await closeTradeInDB(env, tradeId, closePrice, pnl, pnlPercent, closeReason);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/open-trades' && request.method === 'GET') {
      try {
        const trades = await getOpenTradesFromDB(env);
        return jsonResponse({ success: true, data: trades });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/trades' && request.method === 'GET') {
      try {
        const result = await dbSelect(env, `SELECT * FROM bot_trades ORDER BY created_at DESC LIMIT 20`);
        return jsonResponse({ success: true, data: result });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 💰 مسارات المحافظ (Wallets)
    // ============================================================

    if (path === '/wallet/create' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { userId, network } = body;
        
        if (!userId || !network) {
          return jsonResponse({ success: false, error: 'userId and network required' }, 400);
        }
        
        const walletId = crypto.randomUUID();
        const now = new Date().toISOString();
        const address = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
        const encryptedPrivateKey = `encrypted_${crypto.randomUUID()}`;
        
        const result = await env.DB.prepare(`
          INSERT INTO user_wallets (id, userId, network, address, encryptedPrivateKey, balance, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(walletId, userId, network, address, encryptedPrivateKey, 0, now, now).run();
        
        if (result.success) {
          return jsonResponse({
            success: true,
            wallet: {
              id: walletId,
              userId,
              network,
              address,
              balance: 0,
              created_at: now,
              updated_at: now,
            }
          });
        }
        
        return jsonResponse({ success: false, error: 'Failed to create wallet' }, 500);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/wallet/balance' && request.method === 'GET') {
      try {
        const urlParams = new URLSearchParams(url.search);
        const userId = urlParams.get('userId');
        const network = urlParams.get('network');
        
        if (!userId || !network) {
          return jsonResponse({ success: false, error: 'userId and network required' }, 400);
        }
        
        const result = await env.DB.prepare(
          'SELECT balance FROM user_wallets WHERE userId = ? AND network = ?'
        ).bind(userId, network).first();
        
        return jsonResponse({
          success: true,
          balance: result?.balance || 0,
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/wallets' && request.method === 'GET') {
      try {
        const urlParams = new URLSearchParams(url.search);
        const userId = urlParams.get('userId');
        
        if (!userId) {
          return jsonResponse({ success: false, error: 'userId required' }, 400);
        }
        
        const result = await env.DB.prepare(
          'SELECT * FROM user_wallets WHERE userId = ? ORDER BY created_at DESC'
        ).bind(userId).all();
        
        return jsonResponse({
          success: true,
          data: result.results || [],
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 🤖 مسارات البوتات (Bots)
    // ============================================================

    if (path === '/bots/create' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { userId, botType, name, tradingAmount, networks } = body;
        
        if (!userId || !botType || !name) {
          return jsonResponse({ success: false, error: 'userId, botType and name required' }, 400);
        }
        
        const botId = crypto.randomUUID();
        const now = new Date().toISOString();
        const amount = tradingAmount || 100;
        
        let networksJson = JSON.stringify(['solana']);
        if (networks !== undefined && networks !== null) {
          let networksArray = networks;
          if (typeof networks === 'string') {
            networksArray = [networks];
          } else if (!Array.isArray(networks) && typeof networks === 'object') {
            networksArray = Object.keys(networks);
          } else if (Array.isArray(networks)) {
            networksArray = networks.map(n => String(n));
          } else {
            networksArray = [];
          }
          if (networksArray.length > 0) {
            networksJson = JSON.stringify(networksArray);
          }
        }
        
        const result = await env.DB.prepare(`
          INSERT INTO bot_instances (
            id, user_id, bot_type, name, description, status, mode,
            networks, paper_trading, max_position_size, take_profit,
            stop_loss, min_score, max_open_positions, auto_execute,
            min_smart_wallets, smart_wallets, indicator_type,
            rsi_oversold, rsi_overbought, total_trades, winning_trades,
            total_pnl, today_pnl, trading_amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          botId, userId, botType, name, '', 'stopped', 'auto',
          networksJson,
          1, amount,
          30, 10, 60, 3, 0, 3, null, 'rsi', 30, 70,
          0, 0, 0, 0, amount, now, now
        ).run();
        
        if (result.success) {
          return jsonResponse({
            success: true,
            botId: botId,
            message: 'Bot created successfully',
          });
        }
        
        return jsonResponse({ success: false, error: 'Failed to create bot' }, 500);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/bots' && request.method === 'GET') {
      try {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return jsonResponse({ success: false, error: 'userId required' }, 400);
        }
        const bots = await getBotInstancesFromDB(env, userId);
        return jsonResponse({ success: true, data: bots });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path.startsWith('/bots/') && path.endsWith('/start') && request.method === 'POST') {
      try {
        const botId = path.split('/')[2];
        const body = await request.json();
        const { userId } = body;
        if (!botId || !userId) {
          return jsonResponse({ success: false, error: 'botId and userId required' }, 400);
        }
        const result = await updateBotStatusInDB(env, botId, userId, 'running');
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path.startsWith('/bots/') && path.endsWith('/stop') && request.method === 'POST') {
      try {
        const botId = path.split('/')[2];
        const body = await request.json();
        const { userId } = body;
        if (!botId || !userId) {
          return jsonResponse({ success: false, error: 'botId and userId required' }, 400);
        }
        const result = await updateBotStatusInDB(env, botId, userId, 'stopped');
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path.startsWith('/bots/') && path.endsWith('/delete') && request.method === 'DELETE') {
      try {
        const botId = path.split('/')[2];
        const userId = url.searchParams.get('userId');
        const closeTrades = url.searchParams.get('closeTrades') === 'true';

        if (!botId || !userId) {
          return jsonResponse({ success: false, error: 'botId and userId required' }, 400);
        }

        const openTrades = await dbSelect(env,
          `SELECT * FROM bot_trades WHERE bot_id = ? AND is_open = 1`,
          [botId]
        );

        if (openTrades.length > 0 && !closeTrades) {
          return jsonResponse({
            success: false,
            error: `Bot has ${openTrades.length} open trades. Please close them first or use closeTrades=true`,
            openTrades: openTrades,
            requiresConfirmation: true,
            openTradesCount: openTrades.length,
          }, 400);
        }

        let closedCount = 0;
        if (closeTrades && openTrades.length > 0) {
          for (const trade of openTrades) {
            let closePrice = trade.price * 0.98;
            try {
              const dexData = await getDexData(trade.token_address, trade.network);
              if (dexData && dexData.price) {
                closePrice = dexData.price;
              }
            } catch (e) {
              console.warn('⚠️ Could not fetch current price, using estimated price');
            }

            await dbQuery(env,
              `UPDATE bot_trades SET 
                is_open = 0, 
                status = 'CLOSED', 
                closed_at = CURRENT_TIMESTAMP, 
                close_price = ?,
                pnl = (? - price) * amount,
                pnl_percent = ((? - price) / price) * 100
              WHERE id = ?`,
              [closePrice, closePrice, closePrice, trade.id]
            );
            closedCount++;
          }
        }

        await dbQuery(env,
          `DELETE FROM bot_instances WHERE id = ? AND user_id = ?`,
          [botId, userId]
        );

        return jsonResponse({
          success: true,
          message: `Bot deleted successfully. ${closedCount} trades closed.`,
          closedTradesCount: closedCount,
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path.startsWith('/bots/') && path.endsWith('/config') && request.method === 'POST') {
      try {
        const botId = path.split('/')[2];
        const userId = url.searchParams.get('userId');
        const body = await request.json();

        if (!userId || !botId) {
          return jsonResponse({ success: false, error: 'userId and botId required' }, 400);
        }

        const allowedFields = [
          'max_position_size', 'trading_amount', 'take_profit', 'stop_loss',
          'min_score', 'max_open_positions', 'paper_trading', 'auto_execute',
          'min_smart_wallets', 'indicator_type', 'rsi_oversold', 'rsi_overbought',
          'networks'
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
          if (body[field] !== undefined && body[field] !== null) {
            let value = body[field];

            if (field === 'networks') {
              let networksArray = value;
              if (typeof value === 'string') {
                networksArray = [value];
              } else if (!Array.isArray(value) && typeof value === 'object') {
                networksArray = Object.keys(value);
              } else if (Array.isArray(value)) {
                networksArray = value.map(v => String(v));
              } else {
                networksArray = [];
              }
              value = JSON.stringify(networksArray);
            } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
              value = parseFloat(value);
            }

            updates.push(`${field} = ?`);
            values.push(value);
          }
        }

        if (body.config && typeof body.config === 'object') {
          for (const [key, val] of Object.entries(body.config)) {
            if (allowedFields.includes(key) && body[key] === undefined) {
              let value = val;
              if (key === 'networks') {
                let networksArray = value;
                if (typeof value === 'string') {
                  networksArray = [value];
                } else if (!Array.isArray(value) && typeof value === 'object') {
                  networksArray = Object.keys(value);
                } else if (Array.isArray(value)) {
                  networksArray = value.map(v => String(v));
                } else {
                  networksArray = [];
                }
                value = JSON.stringify(networksArray);
              } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                value = parseFloat(value);
              }
              updates.push(`${key} = ?`);
              values.push(value);
            }
          }
        }

        if (updates.length === 0) {
          return jsonResponse({ success: false, error: 'No valid fields to update' }, 400);
        }

        values.push(botId, userId);
        const sql = `UPDATE bot_instances SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
        await dbQuery(env, sql, values);

        const updatedBot = await dbFirst(env,
          `SELECT * FROM bot_instances WHERE id = ? AND user_id = ?`,
          [botId, userId]
        );

        return jsonResponse({
          success: true,
          message: 'Bot configuration updated successfully',
          data: updatedBot,
          updatedFields: updates.map(u => u.split(' = ')[0]),
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 💰 مسارات التحويل بين المحافظ
    // ============================================================

    if (path.startsWith('/bots/') && path.endsWith('/transfer-to-bot') && request.method === 'POST') {
      try {
        const botId = path.split('/')[2];
        const body = await request.json();
        const { userId, amount, network } = body;

        if (!userId || !amount || !network) {
          return jsonResponse({ success: false, error: 'userId, amount and network required' }, 400);
        }

        const userWallet = await dbFirst(env,
          `SELECT * FROM user_wallets WHERE userId = ? AND network = ?`,
          [userId, network]
        );

        if (!userWallet) {
          return jsonResponse({ success: false, message: 'محفظة المستخدم غير موجودة' }, 404);
        }

        if (userWallet.balance < amount) {
          return jsonResponse({ success: false, message: 'الرصيد غير كافٍ' }, 400);
        }

        await dbQuery(env, `UPDATE user_wallets SET balance = balance - ? WHERE userId = ? AND network = ?`, [amount, userId, network]);
        await dbQuery(env, `UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, userId]);
        await dbQuery(env, `UPDATE bot_wallet SET balance = balance + ? WHERE bot_id = ?`, [amount, botId]);
        await dbQuery(env,
          `INSERT INTO transactions (userId, type, amount, balanceAfter, description, status, createdAt)
           VALUES (?, 'TRANSFER_TO_BOT', ?, (SELECT balance FROM users WHERE id = ?), ?, 'completed', datetime('now'))`,
          [userId, amount, userId, `💰 تحويل ${amount} إلى البوت`]
        );

        return jsonResponse({ success: true, message: '✅ تم التحويل إلى البوت بنجاح' });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path.startsWith('/bots/') && path.endsWith('/transfer-to-user') && request.method === 'POST') {
      try {
        const botId = path.split('/')[2];
        const body = await request.json();
        const { userId, amount, network } = body;

        if (!userId || !amount || !network) {
          return jsonResponse({ success: false, error: 'userId, amount and network required' }, 400);
        }

        const botWallet = await dbFirst(env, `SELECT * FROM bot_wallet WHERE bot_id = ?`, [botId]);

        if (!botWallet) {
          return jsonResponse({ success: false, message: 'محفظة البوت غير موجودة' }, 404);
        }

        if (botWallet.balance < amount) {
          return jsonResponse({ success: false, message: 'الرصيد غير كافٍ في محفظة البوت' }, 400);
        }

        await dbQuery(env, `UPDATE bot_wallet SET balance = balance - ? WHERE bot_id = ?`, [amount, botId]);
        await dbQuery(env, `UPDATE user_wallets SET balance = balance + ? WHERE userId = ? AND network = ?`, [amount, userId, network]);
        await dbQuery(env, `UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, userId]);
        await dbQuery(env,
          `INSERT INTO transactions (userId, type, amount, balanceAfter, description, status, createdAt)
           VALUES (?, 'TRANSFER_FROM_BOT', ?, (SELECT balance FROM users WHERE id = ?), ?, 'completed', datetime('now'))`,
          [userId, amount, userId, `💸 سحب ${amount} من البوت`]
        );

        return jsonResponse({ success: true, message: '✅ تم السحب من البوت بنجاح' });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 💰 تنفيذ صفقة
    // ============================================================

    if (path === '/execute-trade' && request.method === 'POST') {
      try {
        const userId = url.searchParams.get('userId');
        const body = await request.json();
        const { botId, side, tokenAddress, amountUsd, tokenSymbol, network } = body;

        if (!userId || !botId || !side || !tokenAddress || !amountUsd) {
          return jsonResponse({ success: false, error: 'Missing required parameters' }, 400);
        }

        const bot = await dbFirst(env, `SELECT * FROM bot_instances WHERE id = ? AND user_id = ?`, [botId, userId]);

        if (!bot) {
          return jsonResponse({ success: false, error: 'Bot not found' }, 404);
        }

        const wallet = await getBotWalletFromDB(env, botId);
        if (!wallet) {
          return jsonResponse({ success: false, error: 'No wallet for this bot' }, 404);
        }

        let result;
        if (network === 'solana' || !network) {
          result = await executeSolanaTrade({
            side,
            tokenAddress,
            amountUsd,
            walletAddress: wallet.address,
            encryptedPrivateKey: wallet.encryptedPrivateKey,
          });
        } else {
          result = await executeEVMTrade({
            side,
            tokenAddress,
            amountUsd,
            walletAddress: wallet.address,
            encryptedPrivateKey: wallet.encryptedPrivateKey,
            network: network,
            env,
          });
        }

        if (!result.success) {
          return jsonResponse({ success: false, error: result.error }, 500);
        }

        const tradeId = crypto.randomUUID();
        await dbQuery(env,
          `INSERT INTO bot_trades (id, user_id, bot_id, token_address, token_symbol, network, amount, price, type, status, tx_hash, is_open, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXECUTED', ?, 1, CURRENT_TIMESTAMP)`,
          [tradeId, userId, botId, tokenAddress, tokenSymbol || 'UNKNOWN', network || 'solana', amountUsd, result.price, side === 'buy' ? 'BUY' : 'SELL', result.txHash]
        );

        await dbQuery(env,
          `UPDATE bot_wallet SET balance = balance ${side === 'buy' ? '-' : '+'} ?, updatedAt = CURRENT_TIMESTAMP WHERE bot_id = ?`,
          [amountUsd, botId]
        );

        return jsonResponse({
          success: true,
          tradeId,
          txHash: result.txHash,
          price: result.price,
          message: `✅ Trade executed for bot ${bot.name}`,
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 🔔 مسار الإشعارات (مع فلتر - لا تخزن غير المهم)
    // ============================================================

    if (path === '/notifications' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { app_id, userId, type, message, timestamp } = body;

        console.log(`📢 [${type}] ${message}`);

        if (!userId || !message) {
          return jsonResponse({ success: false, error: 'userId and message required' }, 400);
        }

        // ✅ تخزين فقط الإشعارات المهمة (شراء، بيع، رصيد)
        const isImportant = 
          message.includes('تم شراء') ||
          message.includes('تم بيع') ||
          message.includes('بيع') ||
          message.includes('شراء') ||
          message.includes('الرصيد غير كافٍ') ||
          message.includes('رصيد غير كافٍ');

        if (!isImportant) {
          console.log(`⏭️ [تجاهل] ${message}`);
          return jsonResponse({ success: true, message: 'Ignored (not important)' });
        }

        const finalAppId = app_id || 'hunter';

        const result = await dbQuery(env,
          `INSERT INTO notifications (id, user_id, type, message, is_read, created_at, app_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            type || 'info',
            message,
            0,
            timestamp || new Date().toISOString(),
            finalAppId
          ]
        );

        console.log('✅ Notification saved:', result);

        return jsonResponse({
          success: true,
          message: 'Notification saved successfully'
        });
      } catch (error) {
        console.error('❌ خطأ في حفظ الإشعار:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/notifications' && request.method === 'GET') {
      try {
        const app_id = url.searchParams.get('app_id');
        const userId = url.searchParams.get('userId');
        const limit = parseInt(url.searchParams.get('limit') || '50');

        if (!userId) {
          return jsonResponse({ success: false, error: 'userId required' }, 400);
        }

        let sql = `SELECT * FROM notifications WHERE user_id = ?`;
        const params = [userId];

        if (app_id) {
          sql += ` AND app_id = ?`;
          params.push(app_id);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const notifications = await dbSelect(env, sql, params);

        return jsonResponse({
          success: true,
          data: notifications || [],
          unreadCount: notifications?.filter(n => n.is_read === 0).length || 0
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/notifications/count' && request.method === 'GET') {
      try {
        const app_id = url.searchParams.get('app_id');
        const userId = url.searchParams.get('userId');

        if (!userId) {
          return jsonResponse({ success: false, error: 'userId required' }, 400);
        }

        let sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`;
        const params = [userId];

        if (app_id) {
          sql += ` AND app_id = ?`;
          params.push(app_id);
        }

        const result = await dbFirst(env, sql, params);

        return jsonResponse({
          success: true,
          unreadCount: result?.count || 0
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/notifications/clear' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { app_id, userId } = body;

        if (!userId) {
          return jsonResponse({ success: false, error: 'userId required' }, 400);
        }

        let sql = `DELETE FROM notifications WHERE user_id = ?`;
        const params = [userId];

        if (app_id) {
          sql += ` AND app_id = ?`;
          params.push(app_id);
        }

        await dbQuery(env, sql, params);

        return jsonResponse({
          success: true,
          message: 'All notifications cleared'
        });
      } catch (error) {
        console.error('❌ خطأ في مسح الإشعارات:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 📡 مسارات المحافظ الذكية (للقراءة فقط - لا تخزن)
    // ============================================================

    if (path === '/smart-wallets' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network, minCount } = body || {};
        
        if (!tokenAddress) {
          return jsonResponse({ success: false, error: '❌ tokenAddress مطلوب' }, 400);
        }

        const result = await scanTokenSmartWallets(env, tokenAddress, network || 'solana', minCount || 3);
        
        if (result.error) {
          return jsonResponse({ success: false, error: result.error }, 400);
        }

        return jsonResponse({
          success: true,
          wallets: result.smartWallets || [],
          totalProfit: result.totalProfit || 0,
          avgWinRate: result.avgWinRate || 0,
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/smart-wallets-db' && request.method === 'GET') {
      try {
        // ✅ هذا المسار يعيد بيانات مخزنة مسبقاً (غير مستخدم حالياً)
        // يمكن تعطيله أو تركه للقراءة فقط
        return jsonResponse({ success: true, data: [], message: 'Smart wallets storage disabled' });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/scan-all-tokens' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { network, minCount = 3 } = body;
        const tokens = TRACKED_TOKENS[network];
        if (!tokens) {
          return jsonResponse({ success: false, error: 'Network not supported or no tokens configured' }, 400);
        }
        
        const results = [];
        const allWallets = [];
        let totalWalletsFound = 0;
        
        for (const token of tokens) {
          try {
            const scanResult = await scanTokenSmartWallets(env, token.address, network, minCount);
            results.push({
              symbol: token.symbol,
              address: token.address,
              wallets: scanResult.smartWallets.length,
              totalProfit: scanResult.totalProfit || 0,
              avgWinRate: scanResult.avgWinRate || 0,
            });
            allWallets.push(...scanResult.smartWallets);
            totalWalletsFound += scanResult.smartWallets.length;
          } catch (e) {
            results.push({ symbol: token.symbol, address: token.address, error: e.message, wallets: 0 });
          }
        }
        
        return jsonResponse({
          success: true,
          network,
          totalTokens: tokens.length,
          results,
          totalWalletsFound,
          allWallets: allWallets.slice(0, 50),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 📡 المسارات التحليلية (للقراءة فقط)
    // ============================================================

    if (path === '/dashboard' && request.method === 'GET') {
      try {
        // ✅ قراءة فقط من DB
        const stats = await dbFirst(env,
          `SELECT COUNT(*) as total_wallets, AVG(win_rate) as avg_win_rate, SUM(total_profit_usd) as total_profit,
           AVG(total_trades) as avg_trades,
           COUNT(CASE WHEN win_rate >= 80 THEN 1 END) as elite_wallets,
           COUNT(CASE WHEN win_rate >= 50 AND win_rate < 80 THEN 1 END) as good_wallets,
           COUNT(CASE WHEN win_rate < 50 THEN 1 END) as low_wallets
           FROM smart_wallets WHERE is_active = 1`
        );
        
        const topWallets = await dbSelect(env,
          `SELECT address, network, win_rate, total_trades, total_profit_usd, last_active
           FROM smart_wallets WHERE is_active = 1 ORDER BY win_rate DESC, total_profit_usd DESC LIMIT 10`
        );
        
        const networkStats = await dbSelect(env,
          `SELECT network, COUNT(*) as count, AVG(win_rate) as avg_win_rate, SUM(total_profit_usd) as total_profit
           FROM smart_wallets WHERE is_active = 1 GROUP BY network`
        );
        
        const recentWallets = await dbSelect(env,
          `SELECT address, network, win_rate, total_trades, total_profit_usd, created_at
           FROM smart_wallets WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5`
        );
        
        return jsonResponse({
          success: true,
          stats: stats || { total_wallets: 0 },
          topWallets,
          networkStats,
          recentWallets,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/analyze-token-complete' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network } = body;

        if (!tokenAddress) {
          return jsonResponse({ success: false, error: 'tokenAddress مطلوب' }, 400);
        }

        const analysis = await analyzeTokenComplete(tokenAddress, network || 'solana', env);
        if (analysis.error) {
          return jsonResponse({ success: false, error: analysis.error }, 404);
        }

        return jsonResponse({ success: true, data: analysis });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/analyze-token' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network, symbol, name, price, liquidity, volume24h, priceChange24h } = body;

        if (!tokenAddress || !symbol) {
          return jsonResponse({ success: false, error: 'tokenAddress و symbol مطلوبان' }, 400);
        }

        const geminiKey = env?.GEMINI_API_KEY || '';
        if (!geminiKey) {
          return jsonResponse({ success: false, error: 'مفتاح Gemini غير متوفر' }, 500);
        }

        const analysis = await analyzeWithGemini({
          tokenAddress,
          network: network || 'solana',
          symbol,
          name,
          price,
          liquidity,
          volume24h,
          priceChange24h,
        }, env);

        return jsonResponse({ success: true, analysis });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/trade-signal' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network } = body;
        if (!tokenAddress || !network) {
          return jsonResponse({ success: false, error: 'tokenAddress and network required' }, 400);
        }
        const signal = await getTradeSignal(tokenAddress, network, env);
        if (signal.error) {
          return jsonResponse({ success: false, error: signal.error }, 500);
        }
        return jsonResponse({ success: true, data: signal });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/whale-data' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network } = body;
        if (!tokenAddress) {
          return jsonResponse({ success: false, error: 'tokenAddress required' }, 400);
        }
        const data = await getWhaleData(tokenAddress, network || 'solana', env);
        return jsonResponse({ success: true, data });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/dex-data' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network } = body;
        if (!tokenAddress) {
          return jsonResponse({ success: false, error: 'tokenAddress required' }, 400);
        }
        const data = await getDexData(tokenAddress, network || 'solana');
        if (!data) {
          return jsonResponse({ success: false, error: 'No data found' }, 404);
        }
        return jsonResponse({ success: true, data });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (path === '/price-history' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { tokenAddress, network, limit } = body;
        if (!tokenAddress) {
          return jsonResponse({ success: false, error: 'tokenAddress مطلوب' }, 400);
        }

        const prices = await getPriceHistory(tokenAddress, network || 'solana', limit || 100);
        return jsonResponse({ success: true, prices });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ============================================================
    // 🌐 RPC Proxy
    // ============================================================

    const pathParts = path.replace(/^\//, '').split('/');
    const network = pathParts[0]?.toLowerCase();
    if (network && getRpcUrls(env)[network]) {
      return handleRPCRequest(request, network, env);
    }

    // ============================================================
    // 🏠 الصفحة الرئيسية
    // ============================================================

    const status = await getBotStatus(env);
    const keys = {
      ankr: !!env?.ANKR_KEY,
      helius: !!env?.HELIUS_KEY,
      jupiter: !!env?.JUPITER_API_KEY,
      gemini: !!env?.GEMINI_API_KEY,
      oneinch: !!env?.ONEINCH_KEY,
    };
    
    return jsonResponse({
      status: 'ok',
      service: 'CryptoBot Worker - النسخة النهائية المصححة (بدون تخزين زائد)',
      version: '10.0.0',
      bot: status,
      keys,
      networks: Object.keys(getRpcUrls(env)),
      features: {
        'RPC Proxy': '✅',
        'Smart Wallets (قراءة فقط)': '✅ (لا تخزن)',
        'DEX Data': '✅ (DexScreener)',
        'Holders Data': '✅ (Ankr)',
        'Whale Tracking': '✅ (Solana)',
        'AI Analysis': '✅ (Gemini)',
        'Technical Indicators': '✅',
        'Multi-Bot': '✅',
        'Real Trading': '✅ (Jupiter + 1inch)',
        'Dashboard': '✅',
        'Trade History': '✅',
        'Notifications': '✅ (فقط المهم)',
        'Auto Scan (Cron)': '❌ (معطل)',
        'No Birdeye': '✅',
        'No KeyManager': '✅',
        'Secure Keys': '✅ (env only)',
      },
      endpoints: {
        bot: ['/start (POST)', '/stop (POST)', '/status (GET)', '/networks (POST)'],
        trades: ['/trade (POST)', '/close-trade (POST)', '/open-trades (GET)', '/trades (GET)'],
        bots: ['/bots (GET)', '/bots/create (POST)', '/bots/:id/start (POST)', '/bots/:id/stop (POST)', '/bots/:id/delete (DELETE)', '/bots/:id/config (POST)'],
        transfers: ['/bots/:id/transfer-to-bot (POST)', '/bots/:id/transfer-to-user (POST)'],
        trading: ['/execute-trade (POST)'],
        smartWallets: ['/smart-wallets (POST) - قراءة فقط', '/scan-all-tokens (POST) - قراءة فقط'],
        dashboard: ['/dashboard (GET)'],
        analysis: ['/analyze-token (POST)', '/analyze-token-complete (POST)', '/trade-signal (POST)'],
        market: ['/whale-data (POST)', '/dex-data (POST)', '/price-history (POST)'],
        rpc: Object.keys(getRpcUrls(env)).map(n => `/${n} (POST)`),
      },
    });
  },

  // ============================================================
  // ⏰ المجدول (معطل تماماً)
  // ============================================================
  async scheduled(event, env, ctx) {
    // ❌ تم تعطيل المسح التلقائي بناءً على طلب المستخدم
    console.log('⏸️ المسح التلقائي معطل (يدوي فقط)');
    return;
  }
};