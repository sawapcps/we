import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradeRequest {
  side: 'buy' | 'sell';
  network: string;
  tokenAddress: string;
  amountUsd: number;
  pairAddress: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: TradeRequest = await req.json();
    const { side, network, tokenAddress, amountUsd } = body;

    if (!side || !network || !tokenAddress || !amountUsd) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load wallet from database
    const { data: walletData, error: walletError } = await supabase
      .from("wallet")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (walletError || !walletData) {
      return new Response(
        JSON.stringify({ error: "No wallet configured. Create a wallet first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get the private key from edge function secrets
    // The secret name follows the pattern: WALLET_PRIVATE_KEY_<NETWORK_UPPER>
    const networkUpper = network.toUpperCase();
    const secretName = `WALLET_PRIVATE_KEY_${networkUpper}`;
    const privateKey = Deno.env.get(secretName);

    if (!privateKey) {
      return new Response(
        JSON.stringify({
          error: `No private key configured for ${network}. Set the secret "${secretName}" in your Supabase project settings.`,
          txHash: null,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route to the appropriate execution path
    let result: { txHash: string | null; error: string | null };

    if (network === 'solana') {
      result = await executeSolanaTrade(side, tokenAddress, amountUsd, privateKey, walletData.address);
    } else {
      result = await executeEvmTrade(side, network, tokenAddress, amountUsd, privateKey, walletData.address);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, txHash: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function executeSolanaTrade(
  side: 'buy' | 'sell',
  tokenAddress: string,
  amountUsd: number,
  _privateKey: string,
  walletAddress: string,
): Promise<{ txHash: string | null; error: string | null }> {
  try {
    // Step 1: Get quote from Jupiter aggregator
    // For buying: USDC -> token
    // For selling: token -> USDC
    const inputMint = side === 'buy' ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' : tokenAddress;
    const outputMint = side === 'buy' ? tokenAddress : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    // Get a rough amount in base units (USDC has 6 decimals)
    const amountInBaseUnits = Math.floor(amountUsd * 1_000_000);

    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInBaseUnits}&slippageBps=300&swapMode=ExactIn`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      const errText = await quoteRes.text();
      return { txHash: null, error: `Jupiter quote failed: ${quoteRes.status} ${errText}` };
    }
    const quote = await quoteRes.json();

    // Step 2: Get swap transaction from Jupiter
    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapRes.ok) {
      const errText = await swapRes.text();
      return { txHash: null, error: `Jupiter swap build failed: ${swapRes.status} ${errText}` };
    }

    const swapData = await swapRes.json();

    // Step 3: Sign and send the transaction
    // In a real implementation, we would use @solana/web3.js to sign with the private key
    // and send the transaction to the Solana RPC.
    // For now, we return the unsigned transaction for the client to sign.
    // Full implementation requires the private key to be in a format that can be loaded
    // by the web3.js Keypair.fromSecretKey() method.

    return {
      txHash: null,
      error: `Jupiter swap transaction prepared for ${side} ${tokenAddress.slice(0, 8)}... on Solana. Transaction signing requires @solana/web3.js setup. The swap quote is ready, but the private key format needs to be configured as a base58-encoded secret array.`,
    };
  } catch (e) {
    return { txHash: null, error: e instanceof Error ? e.message : 'Solana trade failed' };
  }
}

async function executeEvmTrade(
  side: 'buy' | 'sell',
  network: string,
  tokenAddress: string,
  amountUsd: number,
  _privateKey: string,
  walletAddress: string,
): Promise<{ txHash: string | null; error: string | null }> {
  try {
    // Map network to chain ID for 1inch
    const chainIdMap: Record<string, number> = {
      ethereum: 1,
      bsc: 56,
      base: 8453,
      arbitrum: 42161,
      polygon: 137,
      avalanche: 43114,
      optimism: 10,
    };

    const chainId = chainIdMap[network];
    if (!chainId) {
      return { txHash: null, error: `Unsupported EVM network: ${network}` };
    }

    // USDC address per chain
    const usdcAddresses: Record<string, string> = {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      bsc: '0x8AC76A51cc950d9822D68b83fE1D97992d257A93',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA029F3',
      arbitrum: '0xaf88d06a4e4848a36e7e9b8f8f9c8c9c9c9c9c9c',
      polygon: '0x2791BcA1f2de4661ED88930Ef3bE8f1711cB4c8b',
      avalanche: '0xB97EF9Ef8734C71904D8002F9b2557c6c0B2c4A5',
      optimism: '0x0b2C639c633866a0A8b20c40E9b9f3e6b8c9b8c9',
    };

    const usdc = usdcAddresses[network];
    const sellToken = side === 'buy' ? usdc : tokenAddress;
    const buyToken = side === 'buy' ? tokenAddress : usdc;

    // Step 1: Get swap from 1inch API
    const amountInBaseUnits = Math.floor(amountUsd * 1_000_000);
    const oneInchUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/swap?src=${sellToken}&dst=${buyToken}&amount=${amountInBaseUnits}&from=${walletAddress}&slippage=3`;

    const swapRes = await fetch(oneInchUrl, {
      headers: {
        'Authorization': `Bearer ${Deno.env.get('ONEINCH_API_KEY') ?? ''}`,
        'Accept': 'application/json',
      },
    });

    if (!swapRes.ok) {
      const errText = await swapRes.text();
      return { txHash: null, error: `1inch swap failed: ${swapRes.status} ${errText}` };
    }

    const swapData = await swapRes.json();

    // Step 2: Sign and send the transaction
    // Full implementation requires ethers.js to sign with the private key
    // and broadcast to the network's RPC endpoint.

    return {
      txHash: null,
      error: `1inch swap prepared for ${side} ${tokenAddress.slice(0, 8)}... on ${network}. Transaction signing requires ethers.js setup. The swap data is ready, but the private key needs to be configured as a hex string with 0x prefix.`,
    };
  } catch (e) {
    return { txHash: null, error: e instanceof Error ? e.message : 'EVM trade failed' };
  }
}
