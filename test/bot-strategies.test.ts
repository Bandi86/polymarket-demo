import { describe, it, expect } from 'vitest';
import type { StrategyContext, Outcome } from '../src/types';

// Helper functions from bot-manager.ts
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Strategy implementations for testing
const momentumChaser = (ctx: StrategyContext) => {
  const { timeRemaining, btcPriceChange, marketPrice } = ctx;

  if (timeRemaining > 30000 || timeRemaining < 5000) {
    return { action: null, confidence: 0, reason: "Not in entry window (T-30s)" };
  }

  if (btcPriceChange === undefined || btcPriceChange === null) {
    return { action: null, confidence: 0, reason: "No BTC price data" };
  }

  const threshold = 0.0002;
  const delta = btcPriceChange;

  if (Math.abs(delta) < threshold) {
    return { action: null, confidence: 0, reason: `Flat market: delta ${(delta * 100).toFixed(3)}%` };
  }

  const action = delta > 0 ? "YES" : "NO";
  const targetPrice = action === "YES" ? marketPrice?.yesPrice : marketPrice?.noPrice;

  if (targetPrice && targetPrice > 0.88) {
    return { action: null, confidence: 0, reason: `Token too expensive: ${(targetPrice * 100).toFixed(0)}¢` };
  }

  const confidence = Math.min(0.75, Math.abs(delta) * 1000);

  return {
    action,
    confidence,
    reason: `Momentum: BTC ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(3)}%`,
  };
};

const meanReversionSniper = (ctx: StrategyContext) => {
  const { marketPrice, btcPriceChange, timeRemaining } = ctx;

  if (timeRemaining < 10000) {
    return { action: null, confidence: 0, reason: "Too close to settlement" };
  }

  const yesPrice = marketPrice?.yesPrice || 0.5;
  const noPrice = marketPrice?.noPrice || 0.5;

  const hasSpike = yesPrice > 0.93 || noPrice > 0.93;
  if (!hasSpike) {
    return { action: null, confidence: 0, reason: "No spike detected" };
  }

  const btcDelta = Math.abs(btcPriceChange || 0);
  if (btcDelta > 0.0001) {
    return { action: null, confidence: 0, reason: `BTC moved: ${(btcDelta * 100).toFixed(3)}%` };
  }

  const action = yesPrice > 0.93 ? "NO" : "YES";
  const targetPrice = action === "YES" ? yesPrice : noPrice;

  const confidence = 0.6 + (0.93 - targetPrice);

  return {
    action,
    confidence: Math.min(0.8, confidence),
    reason: `Fade spike: ${action === "YES" ? "YES" : "NO"} at ${(targetPrice * 100).toFixed(0)}¢`,
  };
};

const sumToOneArb = (ctx: StrategyContext) => {
  const { marketPrice, orderBook, timeRemaining } = ctx;

  if (timeRemaining < 30000) {
    return { action: null, confidence: 0, reason: "Too close to settlement" };
  }

  let yesAsk = 1;
  let noAsk = 1;

  if (orderBook?.yesAsks?.length) {
    yesAsk = orderBook.yesAsks[0].price;
  } else if (marketPrice?.yesPrice) {
    yesAsk = marketPrice.yesPrice + 0.01;
  }

  if (orderBook?.noAsks?.length) {
    noAsk = orderBook.noAsks[0].price;
  } else if (marketPrice?.noPrice) {
    noAsk = marketPrice.noPrice + 0.01;
  }

  const sum = yesAsk + noAsk;

  if (sum >= 0.98) {
    return { action: null, confidence: 0, reason: `No arb: sum=${(sum * 100).toFixed(1)}%` };
  }

  const edge = 1 - sum;
  const confidence = Math.min(0.95, edge * 20);

  const action = yesAsk < noAsk ? "YES" : "NO";

  return {
    action,
    confidence,
    reason: `Arb opportunity: sum=${(sum * 100).toFixed(1)}%, edge=${(edge * 100).toFixed(1)}%`,
  };
};

const taSignalEngine = (ctx: StrategyContext) => {
  const { priceHistory, timeRemaining } = ctx;

  if (timeRemaining < 30000) {
    return { action: null, confidence: 0, reason: "Too close to settlement" };
  }

  if (priceHistory.length < 21) {
    return { action: null, confidence: 0, reason: `Insufficient data: ${priceHistory.length} candles` };
  }

  const ema9 = calculateEMA(priceHistory, 9);
  const ema21 = calculateEMA(priceHistory, 21);
  const rsi = calculateRSI(priceHistory, 14);

  if (rsi > 80) {
    return { action: null, confidence: 0, reason: `RSI overbought: ${rsi.toFixed(1)}` };
  }
  if (rsi < 20) {
    return { action: null, confidence: 0, reason: `RSI oversold: ${rsi.toFixed(1)}` };
  }

  if (ema9 > ema21 && rsi < 70) {
    const confidence = 0.55 + (ema9 - ema21) / ema21 * 100;
    return {
      action: "YES" as Outcome,
      confidence: Math.min(0.8, confidence),
      reason: `Bullish: EMA9(${ema9.toFixed(4)}) > EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
    };
  }

  if (ema9 < ema21 && rsi > 30) {
    const confidence = 0.55 + (ema21 - ema9) / ema21 * 100;
    return {
      action: "NO" as Outcome,
      confidence: Math.min(0.8, confidence),
      reason: `Bearish: EMA9(${ema9.toFixed(4)}) < EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
    };
  }

  return { action: null, confidence: 0, reason: `No clear signal` };
};

const marketMaker = (ctx: StrategyContext) => {
  const { marketPrice, timeRemaining, orderBook } = ctx;

  if (timeRemaining < 60000) {
    return { action: null, confidence: 0, reason: "Exiting market making: T-60s reached" };
  }

  const yesPrice = marketPrice?.yesPrice || 0.5;
  const noPrice = marketPrice?.noPrice || 0.5;

  const spread = orderBook?.spread || 0.02;

  if (spread < 0.015) {
    return { action: null, confidence: 0, reason: `Spread too tight: ${(spread * 100).toFixed(1)}%` };
  }

  if (yesPrice > 0.55) {
    return {
      action: "NO" as Outcome,
      confidence: 0.5,
      reason: `Market making: bid NO at ${((noPrice - 0.015) * 100).toFixed(0)}¢`,
    };
  }

  if (noPrice > 0.55) {
    return {
      action: "YES" as Outcome,
      confidence: 0.5,
      reason: `Market making: bid YES at ${((yesPrice - 0.015) * 100).toFixed(0)}¢`,
    };
  }

  return { action: null, confidence: 0, reason: "Market balanced, no edge" };
};

// Default context
const createDefaultContext = (overrides: Partial<StrategyContext> = {}): StrategyContext => ({
  currentPrice: 0.5,
  startPrice: 0.5,
  priceHistory: Array(30).fill(0.5).map((v, i) => v + i * 0.001),
  timeRemaining: 60000,
  marketDuration: 300000,
  marketPrice: { yesPrice: 0.5, noPrice: 0.5 },
  volatility: 0.001,
  momentum: 0,
  ...overrides,
});

describe('Technical Analysis Helpers', () => {
  describe('calculateEMA', () => {
    it('should return last price if not enough data', () => {
      expect(calculateEMA([100], 9)).toBe(100);
    });

    it('should calculate EMA correctly for rising prices', () => {
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
      const ema = calculateEMA(prices, 9);
      expect(ema).toBeGreaterThan(104); // Should be above simple average
      expect(ema).toBeLessThan(109);
    });

    it('should give more weight to recent prices', () => {
      const prices1 = [100, 100, 100, 100, 100, 100, 100, 100, 100, 110];
      const prices2 = [100, 110, 100, 100, 100, 100, 100, 100, 100, 100];

      const ema1 = calculateEMA(prices1, 9);
      const ema2 = calculateEMA(prices2, 9);

      // Recent high should give higher EMA
      expect(ema1).toBeGreaterThan(ema2);
    });
  });

  describe('calculateRSI', () => {
    it('should return 50 for insufficient data', () => {
      expect(calculateRSI([100, 101], 14)).toBe(50);
    });

    it('should return 100 for all gains (no losses)', () => {
      const prices = Array(20).fill(0).map((_, i) => 100 + i);
      expect(calculateRSI(prices, 14)).toBe(100);
    });

    it('should return low RSI for all losses', () => {
      const prices = Array(20).fill(0).map((_, i) => 100 - i);
      const rsi = calculateRSI(prices, 14);
      expect(rsi).toBeLessThan(10);
    });

    it('should return around 50 for balanced market', () => {
      const prices = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
      const rsi = calculateRSI(prices, 14);
      expect(rsi).toBeGreaterThanOrEqual(40);
      expect(rsi).toBeLessThanOrEqual(60);
    });
  });
});

describe('Momentum Chaser Strategy', () => {
  it('should not trade outside entry window (before T-30s)', () => {
    const ctx = createDefaultContext({ timeRemaining: 60000, btcPriceChange: 0.001 });
    const result = momentumChaser(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("Not in entry window");
  });

  it('should not trade outside entry window (after T-5s)', () => {
    const ctx = createDefaultContext({ timeRemaining: 3000, btcPriceChange: 0.001 });
    const result = momentumChaser(ctx);
    expect(result.action).toBeNull();
  });

  it('should buy YES when BTC moves up significantly', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: 0.0003, // 0.03%
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 }
    });
    const result = momentumChaser(ctx);
    expect(result.action).toBe("YES");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should buy NO when BTC moves down significantly', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: -0.0003, // -0.03%
      marketPrice: { yesPrice: 0.45, noPrice: 0.55 }
    });
    const result = momentumChaser(ctx);
    expect(result.action).toBe("NO");
  });

  it('should skip flat market', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: 0.0001, // Below threshold
    });
    const result = momentumChaser(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("Flat market");
  });

  it('should skip expensive tokens', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: 0.001,
      marketPrice: { yesPrice: 0.90, noPrice: 0.10 }
    });
    const result = momentumChaser(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("too expensive");
  });

  it('should handle missing BTC data', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: undefined,
    });
    const result = momentumChaser(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("No BTC price data");
  });
});

describe('Mean Reversion Sniper Strategy', () => {
  it('should detect spike and fade it', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      btcPriceChange: 0,
      marketPrice: { yesPrice: 0.95, noPrice: 0.05 }
    });
    const result = meanReversionSniper(ctx);
    expect(result.action).toBe("NO"); // Fade the YES spike
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should not trade without spike', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      btcPriceChange: 0,
      marketPrice: { yesPrice: 0.60, noPrice: 0.40 }
    });
    const result = meanReversionSniper(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("No spike detected");
  });

  it('should not fade if BTC actually moved', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      btcPriceChange: 0.002, // BTC moved
      marketPrice: { yesPrice: 0.95, noPrice: 0.05 }
    });
    const result = meanReversionSniper(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("BTC moved");
  });

  it('should not trade too close to settlement', () => {
    const ctx = createDefaultContext({
      timeRemaining: 5000,
      btcPriceChange: 0,
      marketPrice: { yesPrice: 0.95, noPrice: 0.05 }
    });
    const result = meanReversionSniper(ctx);
    expect(result.action).toBeNull();
  });
});

describe('Sum-to-One Arbitrage Strategy', () => {
  it('should detect arbitrage opportunity', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      marketPrice: { yesPrice: 0.46, noPrice: 0.46 } // Sum = 0.92 + 0.02 = 0.94
    });
    const result = sumToOneArb(ctx);
    expect(result.action).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reason).toContain("Arb opportunity");
  });

  it('should not trade without arbitrage', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      marketPrice: { yesPrice: 0.50, noPrice: 0.50 } // Sum = 1.0
    });
    const result = sumToOneArb(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("No arb");
  });

  it('should use order book when available', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      orderBook: {
        yesAsks: [{ price: 0.46, size: 100, side: 'yes' as const, total: 100 }],
        noAsks: [{ price: 0.46, size: 100, side: 'no' as const, total: 100 }],
        yesBids: [],
        noBids: [],
        spread: 0.02,
        midPrice: 0.5
      }
    });
    const result = sumToOneArb(ctx);
    expect(result.action).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should not trade too close to settlement', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      marketPrice: { yesPrice: 0.48, noPrice: 0.48 }
    });
    const result = sumToOneArb(ctx);
    expect(result.action).toBeNull();
  });
});

describe('TA Signal Engine Strategy', () => {
  it('should generate bullish signal when EMA9 > EMA21 and RSI healthy', () => {
    // Create uptrending prices with balanced +2/-1 pattern
    // This gives RSI ~66.7 (healthy, not overbought) and EMA9 > EMA21
    const basePrices = [
      100, 102, 101, 103, 102, 104, 103, 105, 104, 106,
      105, 107, 106, 108, 107, 109, 108, 110, 109, 111,
      110, 112, 111, 113, 112, 114, 113, 115, 114, 116
    ];
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      priceHistory: basePrices
    });
    const result = taSignalEngine(ctx);
    // EMA9 > EMA21, RSI ~66.7 (between 20 and 70)
    expect(result.action).toBe("YES");
  });

  it('should generate bearish signal when EMA9 < EMA21', () => {
    // Create downtrending prices with balanced -2/+1 pattern
    // This gives RSI ~33.3 (healthy, not oversold) and EMA9 < EMA21
    const basePrices = [
      116, 114, 115, 113, 114, 112, 113, 111, 112, 110,
      111, 109, 110, 108, 109, 107, 108, 106, 107, 105,
      106, 104, 105, 103, 104, 102, 103, 101, 102, 100
    ];
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      priceHistory: basePrices
    });
    const result = taSignalEngine(ctx);
    // EMA9 < EMA21, RSI ~33.3 (between 30 and 80)
    expect(result.action).toBe("NO");
  });

  it('should skip when RSI overbought', () => {
    // Strong uptrend (RSI will be high)
    const prices = Array(30).fill(0).map((_, i) => 100 + i * 2);
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      priceHistory: prices
    });
    const result = taSignalEngine(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("overbought");
  });

  it('should skip with insufficient data', () => {
    const ctx = createDefaultContext({
      timeRemaining: 60000,
      priceHistory: [100, 101, 102] // Only 3 candles
    });
    const result = taSignalEngine(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("Insufficient data");
  });

  it('should not trade too close to settlement', () => {
    const prices = Array(30).fill(0).map((_, i) => 100 + i * 0.5);
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      priceHistory: prices
    });
    const result = taSignalEngine(ctx);
    expect(result.action).toBeNull();
  });
});

describe('Market Maker Strategy', () => {
  it('should bid NO when YES is expensive', () => {
    const ctx = createDefaultContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 },
      orderBook: {
        yesAsks: [],
        noAsks: [],
        yesBids: [],
        noBids: [],
        spread: 0.03,
        midPrice: 0.5
      }
    });
    const result = marketMaker(ctx);
    expect(result.action).toBe("NO");
  });

  it('should bid YES when NO is expensive', () => {
    const ctx = createDefaultContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.35, noPrice: 0.65 },
      orderBook: {
        yesAsks: [],
        noAsks: [],
        yesBids: [],
        noBids: [],
        spread: 0.03,
        midPrice: 0.5
      }
    });
    const result = marketMaker(ctx);
    expect(result.action).toBe("YES");
  });

  it('should not trade when spread too tight', () => {
    const ctx = createDefaultContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 },
      orderBook: {
        yesAsks: [],
        noAsks: [],
        yesBids: [],
        noBids: [],
        spread: 0.01, // Too tight
        midPrice: 0.5
      }
    });
    const result = marketMaker(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("Spread too tight");
  });

  it('should exit before settlement', () => {
    const ctx = createDefaultContext({
      timeRemaining: 50000, // Less than 60s
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 },
    });
    const result = marketMaker(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("T-60s");
  });

  it('should not trade in balanced market', () => {
    const ctx = createDefaultContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.50, noPrice: 0.50 },
      orderBook: {
        yesAsks: [],
        noAsks: [],
        yesBids: [],
        noBids: [],
        spread: 0.03,
        midPrice: 0.5
      }
    });
    const result = marketMaker(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain("balanced");
  });
});

describe('Strategy Integration', () => {
  it('all strategies should return valid decision structure', () => {
    const ctx = createDefaultContext({
      timeRemaining: 20000,
      btcPriceChange: 0.001,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
      priceHistory: Array(30).fill(0).map((_, i) => 100 + i * 0.3),
      orderBook: {
        yesAsks: [{ price: 0.56, size: 100, side: 'yes' as const, total: 100 }],
        noAsks: [{ price: 0.46, size: 100, side: 'no' as const, total: 100 }],
        yesBids: [],
        noBids: [],
        spread: 0.02,
        midPrice: 0.5
      }
    });

    const strategies = [momentumChaser, meanReversionSniper, sumToOneArb, taSignalEngine, marketMaker];

    strategies.forEach(strategy => {
      const result = strategy(ctx);
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});