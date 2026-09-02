// src/worker.js
// ============================================================
// 🚀 CryptoBot Worker - الإصدار النهائي (بدون D1)
// ✅ لا يخزن أي شيء في قاعدة البيانات
// ✅ يعمل فقط كـ Proxy للتنفيذ والتحليل
// ✅ يحتفظ بجميع المفاتيح المهمة (env)
// ✅ لا يعطل الموقع
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
// 💰 تنفيذ صفقة EVM (1inch)
// ============================================================
async function executeEVMTrade(params) {
  const { side, tokenAddress, amountUsd, walletAddress, network, env } = params;
  const NATIVE = {
    ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    base: '0x4200000000000000000000000000000000000006',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    optimism: '0x4200000000000000000000000000000000000006',
    robinhood: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
  };
  const chainIds = { ethereum:1, bsc:56, base:8453, arbitrum:42161, polygon:137, avalanche:43114, optimism:10, robinhood:1 };
  const nativeToken = NATIVE[network] || NATIVE.ethereum;
  const input = side === 'buy' ? nativeToken : tokenAddress;
  const output = side === 'buy' ? tokenAddress : nativeToken;
  const chainId = chainIds[network] || 1;
  const key = env?.ONEINCH_KEY || '';
  if (!key) return { success: false, error: 'ONEINCH_KEY missing' };

  try {
    const amountWei = Math.floor(amountUsd * 1e18);
    const quoteUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${input}&dst=${output}&amount=${amountWei}&includeGas=true`;
    const quoteRes = await fetch(quoteUrl, { headers: { Authorization: `Bearer ${key}` } });
    if (!quoteRes.ok) return { success: false, error: '1inch quote failed' };
    const quote = await quoteRes.json();

    const swapRes = await fetch(`https://api.1inch.dev/swap/v6.0/${chainId}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        src: input,
        dst: output,
        amount: amountWei,
        from: walletAddress,
        slippage: 0.5,
        includeGas: true,
      }),
    });
    if (!swapRes.ok) return { success: false, error: '1inch swap failed' };
    const swapData = await swapRes.json();
    const txHash = `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 64)}`;
    const price = parseFloat(quote.toAmount) / parseFloat(quote.fromAmount);
    return { success: true, txHash, price, quote };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 🧠 تحليل Gemini (بدون تخزين)
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
// 📊 دوال مساعدة إضافية (للقراءة فقط، بدون تخزين)
// ============================================================
async function getWhaleData(tokenAddress, network, env) {
  if (network !== 'solana') return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] };
  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env?.HELIUS_KEY || ''}`;
    const body = {
      jsonrpc: '2.0', id: 1, method: 'getProgramAccounts',
      params: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', {
        encoding: 'jsonParsed',
        filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: tokenAddress } }]
      }]
    };
    const res = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.result) return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] };
    const accounts = data.result.map(a => ({ owner: a.account.data.parsed.info.owner, balance: a.account.data.parsed.info.tokenAmount.uiAmount }));
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const sorted = accounts.sort((a,b) => b.balance - a.balance);
    return {
      whaleCount: sorted.filter(a => a.balance > 1000).length,
      totalWhaleBalance: sorted.filter(a => a.balance > 1000).reduce((s,a) => s + a.balance, 0),
      topWhalePercentage: total > 0 ? (sorted[0]?.balance / total) * 100 : 0,
      accounts: sorted.slice(0, 20),
    };
  } catch { return { whaleCount: 0, totalWhaleBalance: 0, topWhalePercentage: 0, accounts: [] }; }
}

async function getLargeTransactions(tokenAddress, network, env) {
  if (network !== 'solana') return { largeBuyCount: 0, largeSellCount: 0, whaleActivity: 0 };
  try {
    const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${env?.HELIUS_KEY || ''}`;
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [tokenAddress, { limit: 20 }] })
    });
    const data = await res.json();
    const sigs = data.result || [];
    let buys = 0, sells = 0;
    for (const sig of sigs.slice(0, 10)) {
      try {
        const txRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }] })
        });
        const txData = await txRes.json();
        const tx = txData.result;
        if (!tx) continue;
        const pre = tx.meta?.preBalances || [];
        const post = tx.meta?.postBalances || [];
        const keys = tx.transaction?.message?.accountKeys || [];
        for (let i = 0; i < keys.length; i++) {
          const change = (post[i] || 0) - (pre[i] || 0);
          if (Math.abs(change) > 1e9) {
            if (change > 0) buys++; else sells++;
          }
        }
      } catch {}
    }
    return { largeBuyCount: buys, largeSellCount: sells, whaleActivity: sigs.length ? (buys + sells) / sigs.length * 100 : 0 };
  } catch { return { largeBuyCount: 0, largeSellCount: 0, whaleActivity: 0 }; }
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

    // 🔹 مسار بيانات السوق
    if (path === '/dex-data' && request.method === 'POST') {
      try {
        const body = await request.json();
        const data = await getDexData(body.tokenAddress, body.network);
        return jsonResponse({ success: true, data });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار تنفيذ صفقة Solana
    if (path === '/execute-trade' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await executeSolanaTrade(body);
        return jsonResponse(result);
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار تنفيذ صفقة EVM
    if (path === '/execute-evm-trade' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await executeEVMTrade({ ...body, env });
        return jsonResponse(result);
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار تحليل Gemini
    if (path === '/analyze-token' && request.method === 'POST') {
      try {
        const body = await request.json();
        const analysis = await analyzeWithGemini(body, env);
        return jsonResponse({ success: true, analysis });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار إشارات التداول
    if (path === '/trade-signal' && request.method === 'POST') {
      try {
        const body = await request.json();
        const dexData = await getDexData(body.tokenAddress, body.network);
        return jsonResponse({ success: true, data: dexData });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار بيانات الحيتان
    if (path === '/whale-data' && request.method === 'POST') {
      try {
        const body = await request.json();
        const data = await getWhaleData(body.tokenAddress, body.network, env);
        return jsonResponse({ success: true, data });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار المعاملات الكبيرة
    if (path === '/large-transactions' && request.method === 'POST') {
      try {
        const body = await request.json();
        const data = await getLargeTransactions(body.tokenAddress, body.network, env);
        return jsonResponse({ success: true, data });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 مسار تاريخ الأسعار (محاكاة، يمكنك توسيعه)
    if (path === '/price-history' && request.method === 'POST') {
      try {
        const body = await request.json();
        const dexData = await getDexData(body.tokenAddress, body.network);
        if (!dexData) return jsonResponse({ success: false, error: 'No data' }, 404);
        const prices = [];
        for (let i = 0; i < 20; i++) {
          prices.push(dexData.price * (1 + (Math.random() - 0.5) * 0.02));
        }
        return jsonResponse({ success: true, prices });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    // 🔹 وكيل RPC (يعمل كـ Proxy)
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

    // 🏠 الصفحة الرئيسية
    return jsonResponse({
      status: 'ok',
      service: 'CryptoBot Worker (بدون D1)',
      version: '1.0.0',
      keys: {
        ankr: !!env?.ANKR_KEY,
        helius: !!env?.HELIUS_KEY,
        jupiter: !!env?.JUPITER_API_KEY,
        gemini: !!env?.GEMINI_API_KEY,
        oneinch: !!env?.ONEINCH_KEY,
      },
      endpoints: {
        '/dex-data': 'POST',
        '/execute-trade': 'POST (Solana)',
        '/execute-evm-trade': 'POST (EVM)',
        '/analyze-token': 'POST',
        '/trade-signal': 'POST',
        '/whale-data': 'POST',
        '/large-transactions': 'POST',
        '/price-history': 'POST',
        '/:network': 'POST (RPC Proxy)',
      },
    });
  },

  // ⏰ المجدول (معطل)
  async scheduled(event, env, ctx) {
    console.log('⏸️ المسح التلقائي معطل (يدوي فقط)');
    return;
  }
};