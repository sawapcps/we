// src/lib/technicalAnalysis.ts
// ============================================================
// 📊 محرك التحليل الفني - RSI, MACD, EMA, Bollinger Bands
// ============================================================

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  ema20: number;
  ema50: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  volumeRatio: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  buySignal: boolean;
  sellSignal: boolean;
  score: number;
  signals: string[];
}

// ============================================================
// 📊 RSI - مؤشر القوة النسبية
// ============================================================

export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

// ============================================================
// 📊 EMA - المتوسط المتحرك الأسي
// ============================================================

export function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes[closes.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// ============================================================
// 📊 MACD - تقارب/تباعد المتوسطات
// ============================================================

export function calculateMACD(closes: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (closes.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  
  // Signal line (EMA 9 of MACD)
  const signal = macd * 0.2; // تقريب
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

// ============================================================
// 📊 Bollinger Bands
// ============================================================

export function calculateBollingerBands(closes: number[], period: number = 20): {
  upper: number;
  middle: number;
  lower: number;
} {
  if (closes.length < period) {
    const avg = closes.length > 0 ? closes[closes.length - 1] : 0;
    return { upper: avg * 1.02, middle: avg, lower: avg * 0.98 };
  }
  
  const recent = closes.slice(-period);
  const middle = recent.reduce((a, b) => a + b, 0) / period;
  
  const variance = recent.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: middle + 2 * stdDev,
    middle,
    lower: middle - 2 * stdDev,
  };
}

// ============================================================
// 📊 التحليل الفني الكامل
// ============================================================

export function analyzeTechnical(candles: CandleData[]): TechnicalIndicators {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  
  const rsi = calculateRSI(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const macdData = calculateMACD(closes);
  const bollinger = calculateBollingerBands(closes);
  
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const currentVolume = volumes[volumes.length - 1] || 0;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  // تحديد الاتجاه
  const trend = ema20 > ema50 ? 'bullish' : ema20 < ema50 ? 'bearish' : 'neutral';
  
  // إشارات
  const signals: string[] = [];
  let score = 50;
  
  // RSI
  if (rsi < 30) {
    signals.push(`RSI=${rsi.toFixed(1)} (تشبع بيعي - فرصة شراء)`);
    score += 15;
  } else if (rsi > 70) {
    signals.push(`RSI=${rsi.toFixed(1)} (تشبع شرائي - خطر)`);
    score -= 15;
  } else if (rsi > 50 && rsi < 70) {
    signals.push(`RSI=${rsi.toFixed(1)} (زخم إيجابي)`);
    score += 5;
  } else {
    signals.push(`RSI=${rsi.toFixed(1)} (محايد)`);
  }
  
  // EMA
  if (trend === 'bullish') {
    signals.push(`EMA20 > EMA50 (اتجاه صاعد)`);
    score += 10;
  } else if (trend === 'bearish') {
    signals.push(`EMA20 < EMA50 (اتجاه هابط)`);
    score -= 10;
  }
  
  // MACD
  if (macdData.histogram > 0) {
    signals.push(`MACD إيجابي (زخم شرائي)`);
    score += 10;
  } else {
    signals.push(`MACD سلبي (زخم بيعي)`);
    score -= 5;
  }
  
  // Bollinger
  const lastClose = closes[closes.length - 1] || 0;
  if (lastClose < bollinger.lower) {
    signals.push(`السعر تحت Bollinger Lower (ارتداد محتمل)`);
    score += 10;
  } else if (lastClose > bollinger.upper) {
    signals.push(`السعر فوق Bollinger Upper (تشبع شرائي)`);
    score -= 5;
  }
  
  // Volume
  if (volumeRatio > 1.5) {
    signals.push(`حجم تداول مرتفع (${volumeRatio.toFixed(1)}x)`);
    score += 5;
  }
  
  // إشارات الشراء/البيع
  const buySignal = score >= 65;
  const sellSignal = score <= 35;
  
  return {
    rsi,
    ema20,
    ema50,
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    bollingerUpper: bollinger.upper,
    bollingerLower: bollinger.lower,
    bollingerMiddle: bollinger.middle,
    volumeRatio,
    trend,
    buySignal,
    sellSignal,
    score: Math.max(0, Math.min(100, score)),
    signals,
  };
}

// ============================================================
// 📊 جلب الشموع من API
// ============================================================

export async function fetchCandles(
  tokenAddress: string,
  network: string = 'solana',
  timeframe: string = '15m',
  limit: number = 50
): Promise<CandleData[]> {
  try {
    // استخدام DexScreener API للشموع
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/candles?tokenAddress=${tokenAddress}&timeframe=${timeframe}&limit=${limit}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    if (!data.candles || !Array.isArray(data.candles)) return [];
    
    return data.candles.map((c: any) => ({
      timestamp: c.timestamp,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));
  } catch {
    return [];
  }
}