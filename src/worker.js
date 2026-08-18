const RPC_URLS = {
  solana: ['https://api.mainnet-beta.solana.com', 'https://rpc.ankr.com/solana', 'https://solana-rpc.publicnode.com', 'https://1rpc.io/solana'],
  ethereum: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
  bsc: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org', 'https://rpc.ankr.com/bsc', 'https://1rpc.io/bnb'],
  polygon: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon', 'https://polygon-bor-rpc.publicnode.com', 'https://1rpc.io/matic'],
  arbitrum: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum', 'https://arbitrum-one-rpc.publicnode.com', 'https://1rpc.io/arb'],
  base: ['https://mainnet.base.org', 'https://rpc.ankr.com/base', 'https://base-rpc.publicnode.com', 'https://1rpc.io/base'],
  avalanche: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche', 'https://avalanche-c-chain-rpc.publicnode.com', 'https://1rpc.io/avax'],
  optimism: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism', 'https://optimism-rpc.publicnode.com', 'https://1rpc.io/op'],
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '').split('/')[0].toLowerCase();
    let network = null;
    for (const net of Object.keys(RPC_URLS)) {
      if (path === net) { network = net; break; }
    }
    if (!network) {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'multi-chain-rpc-proxy',
        networks: Object.keys(RPC_URLS),
        usage: 'POST to /{network} — e.g. /solana, /ethereum, /bsc, /polygon, /arbitrum, /base, /avalanche, /optimism'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const rpcs = RPC_URLS[network];
    let lastError = null;
    let bodyText = null;
    if (request.method === 'POST') { bodyText = await request.text(); }
    for (const rpc of rpcs) {
      try {
        const init = { method: request.method, headers: { 'Content-Type': 'application/json' } };
        if (request.method === 'POST' && bodyText) { init.body = bodyText; }
        const resp = await fetch(rpc, init);
        const text = await resp.text();
        return new Response(text, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) { lastError = e.message; continue; }
    }
    return new Response(JSON.stringify({ error: 'All RPCs failed for ' + network, lastError }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};
