// src/lib/gemini.ts

import type { AIAnalysis, ChainId, DiscoveredToken } from '@/types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

// ? æáÓ ÇäæåÇĞÌ ÇäåÓÊÎÏåÉ áê ÇäÊ×Èêâ ÇäÂÎÑ (ÊÙåä)
const MODELS = [
  'gemini-3.5-flash-lite',   // ? êÙåä (ãåÇ áê ÇäÊ×Èêâ ÇäÂÎÑ)
  'gemini-3.5-flash',        // ÈÏêä
  'gemini-1.5-flash',        // ÈÏêä ÇÍÊêÇ×ê
  'gemini-1.5-pro',          // ÇäÈÏêä ÇäÃÎêÑ
];

interface GeminiResponse {
  candidates?: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

export async function callGemini(prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`?? åÍÇèäÉ ÇÓÊÎÏÇå ÇäæåèĞÌ: ${model}`);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,      // ? æáÓ ÇäÊ×Èêâ ÇäÂÎÑ
            maxOutputTokens: 1000, // ? æáÓ ÇäÊ×Èêâ ÇäÂÎÑ
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`?? ÇäæåèĞÌ ${model} ÚêÑ åÊÇÍ:`, errText);
        lastError = new Error(`${model}: ${res.status} ${errText}`);
        continue;
      }

      const data: GeminiResponse = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log(`? ÇäæåèĞÌ ${model} ÇÓÊÌÇÈ ÈæÌÇÍ`);
        return text;
      }
      lastError = new Error(`${model}: empty response`);
    } catch (e) {
      console.warn(`?? áÔä ÇäæåèĞÌ ${model}:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}

export async function analyzeToken(token: DiscoveredToken): Promise<AIAnalysis> {
  const priceUsd = token.priceUsd;
  const vol24 = token.volume24h;
  const liqUsd = token.liquidityUsd;
  const change24 = token.priceChange.h24;
  const change6 = token.priceChange.h6;
  const change1 = token.priceChange.h1;
  const change5 = token.priceChange.m5;
  const txns24 = token.txns24h;
  const mcap = token.marketCap ?? 0;
  const fdv = token.fdv ?? 0;
  const network = token.chainId;
  const score = token.score;
  const numPairs = token.allPairs.length;
  const boosts = token.boosts;

  const prompt = `You are a crypto trading analyst. Analyze this token and return ONLY valid JSON (no markdown, no code blocks).

Token: ${token.name} (${token.symbol})
Network: ${network}
Token Address: ${token.tokenAddress}
Price USD: ${priceUsd}
24h Volume: ${vol24.toLocaleString()}
Liquidity: ${liqUsd.toLocaleString()}
Market Cap: ${mcap.toLocaleString()}
FDV: ${fdv.toLocaleString()}
Price Changes: 5m ${change5}%, 1h ${change1}%, 6h ${change6}%, 24h ${change24}%
24h Transactions: Buys ${txns24.buys}, Sells ${txns24.sells}
Number of DEX Pairs: ${numPairs}
Boost Status: ${boosts} active boosts
Hunter Engine Score: ${score}/100
Security Flags: ${token.securityFlags.length > 0 ? token.securityFlags.join(', ') : 'none'}

Return JSON with this exact structure:
{
  "recommendation": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "confidence": 0-100,
  "summary": "2-3 sentence analysis",
  "signals": [{"label": "Liquidity", "value": "$X", "bullish": true/false}, {"label": "Volume", "value": "$X", "bullish": true/false}, {"label": "Price Trend", "value": "X%", "bullish": true/false}, {"label": "Buy/Sell Ratio", "value": "X:Y", "bullish": true/false}],
  "priceTarget": number,
  "riskLevel": "low" | "medium" | "high"
}`;

  try {
    const text = await callGemini(prompt);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      tokenSymbol: token.symbol,
      network,
      recommendation: parsed.recommendation ?? 'hold',
      confidence: parsed.confidence ?? 50,
      summary: parsed.summary ?? 'Analysis unavailable',
      signals: parsed.signals ?? [],
      priceTarget: parsed.priceTarget ?? priceUsd,
      riskLevel: parsed.riskLevel ?? 'medium',
      timestamp: Date.now(),
    };
  } catch {
    return {
      tokenSymbol: token.symbol,
      network,
      recommendation: 'hold',
      confidence: 30,
      summary: 'AI analysis temporarily unavailable. Based on raw metrics, this token shows typical market activity.',
      signals: [
        { label: 'Liquidity', value: `${liqUsd.toLocaleString()}`, bullish: liqUsd > 50000 },
        { label: 'Volume 24h', value: `${vol24.toLocaleString()}`, bullish: vol24 > 100000 },
        { label: 'Price 24h', value: `${change24}%`, bullish: change24 > 0 },
        { label: 'Buy/Sell Ratio', value: `${txns24.buys}:${txns24.sells}`, bullish: txns24.buys > txns24.sells },
      ],
      priceTarget: priceUsd * 1.1,
      riskLevel: liqUsd < 100000 ? 'high' : 'medium',
      timestamp: Date.now(),
    };
  }
}