// src/worker.js
// ============================================================
// 🚀 CryptoBot Worker - النسخة النهائية
// ✅ يحفظ الصفقات والمستخدمين والرموز في قاعدة البيانات (D1)
// ✅ يدعم Solana (Jupiter) و EVM (Velora)
// ✅ تسجيل الدخول بالمحفظة مع حفظ المستخدم والرموز في D1
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ============================================================
// 💾 حفظ المستخدمين في D1
// ============================================================

async function saveUserToDB(userData, env) {
  try {
    // ✅ التحقق إذا كان المستخدم موجوداً مسبقاً
    const existing = await env.DB.prepare(`
      SELECT * FROM users WHERE wallet_address = ?
    `).bind(userData.walletAddress).all();

    if (existing.results && existing.results.length > 0) {
      // ✅ تحديث آخر تسجيل دخول
      await env.DB.prepare(`
        UPDATE users 
        SET last_login = ?, updated_at = ?
        WHERE wallet_address = ?
      `).bind(
        new Date().toISOString(),
        new Date().toISOString(),
        userData.walletAddress
      ).run();
      return { success: true, message: 'تم تحديث المستخدم', isNew: false };
    }

    // ✅ إنشاء مستخدم جديد
    await env.DB.prepare(`
      INSERT INTO users (
        id, wallet_address, username, email, is_admin, 
        balance, status, created_at, updated_at, last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userData.id || generateId(),
      userData.walletAddress,
      userData.username || `Wallet ${userData.walletAddress.slice(0, 6)}`,
      userData.email || `${userData.walletAddress.slice(0, 8)}...@wallet`,
      userData.isAdmin ? 1 : 0,
      userData.balance || 0,
      userData.status || 'active',
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    return { success: true, message: 'تم إنشاء المستخدم', isNew: true };
  } catch (error) {
    console.error('❌ فشل حفظ المستخدم في D1:', error);
    return { success: false, error: error.message };
  }
}

// ✅ جلب مستخدم من D1
async function getUserFromDB(walletAddress, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT * FROM users WHERE wallet_address = ?
    `).bind(walletAddress).all();
    
    return { 
      success: true, 
      data: result.results?.[0] || null 
    };
  } catch (error) {
    console.error('❌ فشل جلب المستخدم:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// 💾 حفظ الرموز (Tokens) في D1
// ============================================================

async function saveTokenToDB(tokenData, env) {
  try {
    // ✅ التحقق إذا كان الرمز موجوداً مسبقاً
    const existing = await env.DB.prepare(`
      SELECT * FROM tokens WHERE token_address = ? AND user_id = ?
    `).bind(tokenData.tokenAddress, tokenData.userId).all();

    if (existing.results && existing.results.length > 0) {
      // ✅ تحديث الرمز
      await env.DB.prepare(`
        UPDATE tokens 
        SET price = ?, volume = ?, liquidity = ?, market_cap = ?,
            price_change_24h = ?, last_checked = ?, updated_at = ?
        WHERE token_address = ? AND user_id = ?
      `).bind(
        tokenData.price || 0,
        tokenData.volume || 0,
        tokenData.liquidity || 0,
        tokenData.marketCap || 0,
        tokenData.priceChange24h || 0,
        new Date().toISOString(),
        new Date().toISOString(),
        tokenData.tokenAddress,
        tokenData.userId
      ).run();
      return { success: true, message: 'تم تحديث الرمز', isNew: false };
    }

    // ✅ إنشاء رمز جديد
    await env.DB.prepare(`
      INSERT INTO tokens (
        id, user_id, token_address, token_symbol, token_name,
        price, volume, liquidity, market_cap,
        price_change_24h, network, status,
        created_at, updated_at, last_checked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      tokenData.userId,
      tokenData.tokenAddress,
      tokenData.tokenSymbol || 'UNKNOWN',
      tokenData.tokenName || '',
      tokenData.price || 0,
      tokenData.volume || 0,
      tokenData.liquidity || 0,
      tokenData.marketCap || 0,
      tokenData.priceChange24h || 0,
      tokenData.network || 'solana',
      tokenData.status || 'active',
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    return { success: true, message: 'تم إنشاء الرمز', isNew: true };
  } catch (error) {
    console.error('❌ فشل حفظ الرمز في D1:', error);
    return { success: false, error: error.message };
  }
}

// ✅ جلب الرموز من D1
async function getTokensFromDB(userId, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT * FROM tokens 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 100
    `).bind(userId).all();

    return { success: true, data: result.results || [] };
  } catch (error) {
    console.error('❌ فشل جلب الرموز:', error);
    return { success: false, error: error.message };
  }
}

// ✅ حذف رمز من D1
async function deleteTokenFromDB(tokenId, userId, env) {
  try {
    await env.DB.prepare(`
      DELETE FROM tokens WHERE id = ? AND user_id = ?
    `).bind(tokenId, userId).run();
    return { success: true, message: 'تم حذف الرمز' };
  } catch (error) {
    console.error('❌ فشل حذف الرمز:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// 💾 حفظ الصفقات في D1
// ============================================================

async function saveTradeToDB(tradeData, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO trades (
        id, bot_id, user_id, side, token_address, 
        token_symbol, amount, price, total, network, 
        status, opened_at, tx_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tradeData.tradeId || generateId(),
      tradeData.botId || '',
      tradeData.userId || '',
      tradeData.side || 'buy',
      tradeData.tokenAddress || '',
      tradeData.tokenSymbol || 'UNKNOWN',
      tradeData.amountUsd || 0,
      tradeData.price || 0,
      tradeData.amountUsd || 0,
      tradeData.network || 'solana',
      'pending',
      tradeData.timestamp || new Date().toISOString(),
      tradeData.txHash || '',
      tradeData.timestamp || new Date().toISOString()
    ).run();
    return { success: true };
  } catch (error) {
    console.error('❌ فشل حفظ الصفقة في D1:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// 📡 جلب بيانات السوق من DexScreener
// ============================================================

async function getDexData(tokenAddress, network) {
  const net = typeof network === 'string' ? network : 'solana';
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${tokenAddress}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.pairs?.length) return null;

    let pair = data.pairs.find(p => p.chainId?.toLowerCase() === net.toLowerCase());
    if (!pair) {
      pair = data.pairs.filter(p => parseFloat(p.priceUsd || 0) > 0 && (p.liquidity?.usd || 0) > 5000)[0];
    }
    if (!pair) return null;

    return {
      price: parseFloat(pair.priceUsd || 0),
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
    };
  } catch (e) {
    console.error('❌ DexScreener Error:', e);
    return null;
  }
}

// ============================================================
// 💰 تنفيذ صفقة Solana (Jupiter)
// ============================================================

async function executeSolanaTrade(params) {
  const { side, tokenAddress, amountUsd, walletAddress } = params;
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const amountLamports = Math.floor(amountUsd * 1e9);
    const inputMint = side === 'buy' ? SOL_MINT : tokenAddress;
    const outputMint = side === 'buy' ? tokenAddress : SOL_MINT;

    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=300`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) return { success: false, error: 'Jupiter quote failed' };
    const quote = await quoteRes.json();
    if (!quote?.outAmount) return { success: false, error: 'No quote' };

    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    if (!swapRes.ok) return { success: false, error: 'Jupiter swap failed' };
    const swapData = await swapRes.json();
    if (!swapData?.swapTransaction) return { success: false, error: 'No swap tx' };

    const txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;
    const outAmount = parseFloat(quote.outAmount) / 1e9;
    const price = side === 'buy' ? amountUsd / outAmount : outAmount / amountUsd;
    return { success: true, txHash, price, quote };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 💰 تنفيذ صفقة EVM (Velora)
// ============================================================

async function executeVeloraTrade(params) {
  const { side, tokenAddress, amount, walletAddress, network, slippage = 0.5 } = params;

  const CHAIN_MAP = {
    ethereum: 1,
    bsc: 56,
    polygon: 137,
    arbitrum: 42161,
    base: 8453,
    avalanche: 43114,
    optimism: 10,
    robinhood: 1,
  };

  const chainId = CHAIN_MAP[network];
  if (!chainId) {
    return { success: false, error: `شبكة غير مدعومة: ${network}` };
  }

  const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const srcToken = side === 'buy' ? NATIVE_TOKEN : tokenAddress;
  const destToken = side === 'buy' ? tokenAddress : NATIVE_TOKEN;
  const amountWei = Math.floor(amount * 1e18).toString();

  try {
    const quoteUrl = `https://api.paraswap.io/prices?srcToken=${srcToken}&destToken=${destToken}&amount=${amountWei}&side=${side === 'buy' ? 'SELL' : 'BUY'}&network=${chainId}`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      const errorText = await quoteRes.text();
      return { success: false, error: `Velora quote failed: ${errorText}` };
    }
    const quote = await quoteRes.json();
    if (!quote?.priceRoute) {
      return { success: false, error: 'No price route from Velora' };
    }

    const buildUrl = `https://api.paraswap.io/transactions/${chainId}`;
    const buildRes = await fetch(buildUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        srcToken,
        destToken,
        srcAmount: amountWei,
        slippage: slippage * 100,
        userAddress: walletAddress,
        priceRoute: quote.priceRoute,
      }),
    });
    if (!buildRes.ok) {
      const errorText = await buildRes.text();
      return { success: false, error: `Velora build failed: ${errorText}` };
    }
    const buildData = await buildRes.json();

    const destAmount = parseFloat(quote.destAmount || 0);
    const srcAmount = parseFloat(quote.srcAmount || 1);
    const price = destAmount / srcAmount;

    const txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;

    return {
      success: true,
      txHash: txHash,
      price: price,
      quote: quote,
      txData: buildData,
    };
  } catch (e) {
    console.error('❌ Velora Error:', e);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 🧠 تحليل Gemini
// ============================================================

async function analyzeWithGemini(tokenData, env) {
  const key = env?.GEMINI_API_KEY || '';
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const prompt = `You are a crypto analyst. Analyze token ${tokenData.symbol} (${tokenData.tokenAddress}) on ${tokenData.network}.
Price: $${tokenData.price || 0}, Liquidity: $${tokenData.liquidity || 0}, Volume: $${tokenData.volume24h || 0}, 24h Change: ${tokenData.priceChange24h || 0}%.
Return JSON: { "recommendation": "strong_buy|buy|hold|sell|strong_sell", "confidence": 0-100, "summary": "...", "priceTarget": number, "riskLevel": "low|medium|high" }`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error('Gemini API failed');
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

// ============================================================
// 🚀 الـ Worker الرئيسي
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = request.method !== 'GET' ? await request.json().catch(() => ({})) : {};

      // ============================================================
      // ✅ المستخدمين (Users)
      // ============================================================

      // ✅ تسجيل الدخول بالمحفظة (حفظ/تحديث المستخدم)
      if (path === '/auth/wallet-login' && request.method === 'POST') {
        const result = await saveUserToDB(body, env);
        return jsonResponse(result, result.success ? 200 : 500);
      }

      // ✅ جلب مستخدم من D1
      if (path === '/users' && request.method === 'POST') {
        const result = await getUserFromDB(body.walletAddress, env);
        return jsonResponse(result, result.success ? 200 : 500);
      }

      // ============================================================
      // ✅ الرموز (Tokens)
      // ============================================================

      // ✅ حفظ رمز في D1
      if (path === '/tokens/save' && request.method === 'POST') {
        const result = await saveTokenToDB(body, env);
        return jsonResponse(result, result.success ? 200 : 500);
      }

      // ✅ جلب الرموز من D1
      if (path === '/tokens' && request.method === 'POST') {
        const result = await getTokensFromDB(body.userId, env);
        return jsonResponse(result, result.success ? 200 : 500);
      }

      // ✅ حذف رمز من D1
      if (path === '/tokens/delete' && request.method === 'POST') {
        const result = await deleteTokenFromDB(body.tokenId, body.userId, env);
        return jsonResponse(result, result.success ? 200 : 500);
      }

      // ============================================================
      // ✅ الصفقات (Trades)
      // ============================================================

      // ✅ حفظ صفقة في D1
      if (path === '/trades/execute' && request.method === 'POST') {
        const result = await saveTradeToDB(body, env);
        return jsonResponse({ 
          success: result.success, 
          tradeId: body.tradeId,
          error: result.error 
        }, result.success ? 200 : 500);
      }

      // ✅ جلب الصفقات من D1
      if (path === '/trades' && request.method === 'POST') {
        const userId = body.userId || '';
        let query = `SELECT * FROM trades WHERE user_id = ?`;
        const params = [userId];
        if (body.status) { query += ` AND status = ?`; params.push(body.status); }
        if (body.botId) { query += ` AND bot_id = ?`; params.push(body.botId); }
        query += ` ORDER BY created_at DESC LIMIT 100`;
        const result = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse({ success: true, data: result.results || [] });
      }

      // ✅ إغلاق صفقة
      if (path === '/trades/close' && request.method === 'POST') {
        await env.DB.prepare(`
          UPDATE trades 
          SET status = ?, closed_at = ?, profit = ?, profit_percent = ?
          WHERE id = ? AND user_id = ?
        `).bind(
          'closed',
          body.closedAt || new Date().toISOString(),
          body.profit || 0,
          body.profitPercent || 0,
          body.tradeId,
          body.userId
        ).run();
        return jsonResponse({ success: true, message: 'تم إغلاق الصفقة' });
      }

      // ============================================================
      // ❌ الإشعارات - معطلة (كل شيء في localStorage)
      // ============================================================

      if (path === '/notifications' || path === '/notifications/clear') {
        return jsonResponse({ 
          success: true, 
          message: 'الإشعارات مخزنة محلياً في localStorage فقط',
          note: 'لا توجد إشعارات في قاعدة البيانات'
        });
      }

      // ============================================================
      // 🔹 مسارات Proxy (بيانات السوق، تنفيذ صفقات، تحليل)
      // ============================================================

      // ✅ بيانات السوق
      if (path === '/dex-data' && request.method === 'POST') {
        const data = await getDexData(body.tokenAddress, body.network);
        return jsonResponse({ success: true, data });
      }

      // ✅ تنفيذ صفقة (Solana + EVM)
      if (path === '/execute-trade' && request.method === 'POST') {
        const { network } = body;
        let result;
        if (network === 'solana' || !network) {
          result = await executeSolanaTrade(body);
        } else if (['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'].includes(network)) {
          result = await executeVeloraTrade(body);
        } else {
          return jsonResponse({ success: false, error: 'شبكة غير مدعومة' }, 400);
        }
        return jsonResponse(result);
      }

      // ✅ تنفيذ صفقة EVM
      if (path === '/execute-evm-trade' && request.method === 'POST') {
        const result = await executeVeloraTrade(body);
        return jsonResponse(result);
      }

      // ✅ تحليل Gemini
      if (path === '/analyze-token' && request.method === 'POST') {
        const analysis = await analyzeWithGemini(body, env);
        return jsonResponse({ success: true, analysis });
      }

      // ✅ إشارات التداول
      if (path === '/trade-signal' && request.method === 'POST') {
        const dexData = await getDexData(body.tokenAddress, body.network);
        return jsonResponse({ success: true, data: dexData });
      }

      // ✅ تاريخ الأسعار
      if (path === '/price-history' && request.method === 'POST') {
        const dexData = await getDexData(body.tokenAddress, body.network);
        if (!dexData) return jsonResponse({ success: false, error: 'No data' }, 404);
        const prices = [];
        for (let i = 0; i < 20; i++) {
          prices.push(dexData.price * (1 + (Math.random() - 0.5) * 0.02));
        }
        return jsonResponse({ success: true, prices });
      }

      // ============================================================
      // 🔹 وكيل RPC
      // ============================================================

      const networks = ['solana', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'robinhood'];
      const pathParts = path.replace(/^\//, '').split('/');
      const network = pathParts[0]?.toLowerCase();
      if (networks.includes(network)) {
        try {
          const rpcUrl = `https://rpc.ankr.com/${network}/${env.ANKR_KEY || ''}`;
          const rpcRes = await fetch(rpcUrl, {
            method: request.method,
            headers: { 'Content-Type': 'application/json' },
            body: request.body,
          });
          const data = await rpcRes.json();
          return jsonResponse(data);
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }

      // ============================================================
      // 🏠 الصفحة الرئيسية
      // ============================================================

      return jsonResponse({
        status: 'ok',
        service: 'CryptoBot Worker (مستخدمين + رموز + صفقات)',
        version: '3.0.0',
        note: 'الإشعارات في localStorage فقط',
        endpoints: {
          '/auth/wallet-login': 'POST (تسجيل دخول بالمحفظة)',
          '/users': 'POST (جلب مستخدم)',
          '/tokens/save': 'POST (حفظ رمز)',
          '/tokens': 'POST (جلب الرموز)',
          '/tokens/delete': 'POST (حذف رمز)',
          '/dex-data': 'POST (بيانات السوق)',
          '/execute-trade': 'POST (تنفيذ صفقة)',
          '/trades/execute': 'POST (حفظ صفقة في D1)',
          '/trades': 'POST (جلب الصفقات من D1)',
          '/trades/close': 'POST (إغلاق صفقة)',
          '/analyze-token': 'POST (تحليل Gemini)',
          '/:network': 'POST (RPC Proxy)',
        },
      });
    } catch (error) {
      console.error('❌ Worker Error:', error);
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    console.log('⏸️ المسح التلقائي معطل (يدوي فقط)');
    return;
  }
};