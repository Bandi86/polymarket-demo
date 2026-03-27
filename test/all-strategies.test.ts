import { describe, it, expect, beforeEach, vi } from 'vitest';
import { strategies, debugLog } from '../src/lib/strategies/all-strategies';
import type { StrategyContext, BinanceSignal } from '../src/types';

// Mock console.log for debug tests
vi.spyOn(console, 'log').mockImplementation(() => {});

// Helper to create default context
const createContext = (overrides: Partial<StrategyContext> = {}): StrategyContext => ({
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

// Helper to create Binance signal
const createBinanceSignal = (type: 'UP' | 'DOWN' | 'NEUTRAL', changePercent: number): BinanceSignal => ({
  type,
  changePercent,
  confidence: type === 'NEUTRAL' ? 0 : 0.65,
  timestamp: Date.now(),
});

describe('All Strategies Export', () => {
  it('should export all 17 strategies', () => {
    const strategyKeys = Object.keys(strategies);
    expect(strategyKeys).toHaveLength(17);
    expect(strategyKeys).toContain('window_delta');
    expect(strategyKeys).toContain('binance_signal');
    expect(strategyKeys).toContain('last_seconds_scalp');
    expect(strategyKeys).toContain('monte_carlo');
    expect(strategyKeys).toContain('fair_value');
    expect(strategyKeys).toContain('momentum');
    expect(strategyKeys).toContain('mean_reversion');
    expect(strategyKeys).toContain('trend');
    expect(strategyKeys).toContain('smart_trend');
    expect(strategyKeys).toContain('contrarian');
    expect(strategyKeys).toContain('volatility');
    expect(strategyKeys).toContain('anomaly');
    expect(strategyKeys).toContain('momentum_burst');
    expect(strategyKeys).toContain('grid_trading');
    expect(strategyKeys).toContain('market_making');
    expect(strategyKeys).toContain('arbitrage');
    expect(strategyKeys).toContain('random');
  });

  it('all strategies should have required properties', () => {
    Object.entries(strategies).forEach(([key, strategy]) => {
      expect(strategy).toHaveProperty('name');
      expect(strategy).toHaveProperty('description');
      expect(strategy).toHaveProperty('category');
      expect(strategy).toHaveProperty('execute');
      expect(typeof strategy.execute).toBe('function');
    });
  });

  it('all strategies should return valid decision structure', () => {
    const ctx = createContext({
      btcPrice: 100000,
      btcWindowOpen: 99500,
      btcPriceChange: 0.001,
    });

    Object.entries(strategies).forEach(([key, strategy]) => {
      const result = strategy.execute(ctx);
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      if (result.action !== null) {
        expect(['YES', 'NO']).toContain(result.action);
      }
    });
  });
});

describe('Window Delta Strategy', () => {
  const strategy = strategies.window_delta;

  it('should return null when no BTC price', () => {
    const ctx = createContext({ btcPrice: undefined });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs BTC ár');
  });

  it('should not trade in last 3 seconds', () => {
    const ctx = createContext({
      btcPrice: 100000,
      btcWindowOpen: 99500,
      timeRemaining: 2000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('utolsó 3mp');
  });

  it('should not trade in first 30 seconds', () => {
    const ctx = createContext({
      btcPrice: 100000,
      btcWindowOpen: 99500,
      timeRemaining: 280000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Ablak eleje');
  });

  it('should buy YES on strong positive delta', () => {
    const ctx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000, // +0.20% delta
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.reason).toContain('UP');
  });

  it('should buy NO on strong negative delta', () => {
    const ctx = createContext({
      btcPrice: 99800,
      btcWindowOpen: 100000, // -0.20% delta
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('NO');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.reason).toContain('DOWN');
  });

  it('should not trade on small delta', () => {
    const ctx = createContext({
      btcPrice: 100100,
      btcWindowOpen: 100000, // +0.10% delta (below 0.18% threshold)
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl kicsi');
  });
});

describe('Binance Signal (Oracle Lag) Strategy', () => {
  const strategy = strategies.binance_signal;

  it('should return null when no Binance signal', () => {
    const ctx = createContext({ binanceSignal: undefined });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs Binance jel');
  });

  it('should return null for neutral signal', () => {
    const ctx = createContext({
      binanceSignal: createBinanceSignal('NEUTRAL', 0),
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
  });

  it('should not trade if signal is expired (>8s old)', () => {
    const ctx = createContext({
      binanceSignal: {
        type: 'UP',
        changePercent: 0.05,
        confidence: 0.7,
        timestamp: Date.now() - 10000, // 10s ago
      },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('lejárt');
  });

  it('should not trade if price too low (<40¢)', () => {
    const ctx = createContext({
      binanceSignal: createBinanceSignal('UP', 0.05),
      marketPrice: { yesPrice: 0.35, noPrice: 0.65 },
      btcPrice: 100100,
      btcWindowOpen: 100000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl alacsony');
  });

  it('should not trade if price too high (>80¢)', () => {
    const ctx = createContext({
      binanceSignal: createBinanceSignal('UP', 0.05),
      marketPrice: { yesPrice: 0.85, noPrice: 0.15 },
      btcPrice: 100100,
      btcWindowOpen: 100000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('beárazta');
  });

  it('should trade UP signal aligned with delta', () => {
    const ctx = createContext({
      binanceSignal: createBinanceSignal('UP', 0.05),
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
      btcPrice: 100100,
      btcWindowOpen: 100000, // Positive delta aligns with UP signal
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should reject signal when delta contradicts', () => {
    const ctx = createContext({
      binanceSignal: createBinanceSignal('UP', 0.05),
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
      btcPrice: 99900,
      btcWindowOpen: 100000, // Negative delta contradicts UP signal
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('ellentmond');
  });
});

describe('T-10 Sniper Strategy', () => {
  const strategy = strategies.last_seconds_scalp;

  it('should only be active in T-20s to T-3s window', () => {
    // Outside window - too early
    const earlyCtx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 30000,
    });
    expect(strategy.execute(earlyCtx).action).toBeNull();

    // Outside window - too late
    const lateCtx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 2000,
    });
    expect(strategy.execute(lateCtx).action).toBeNull();
  });

  it('should not trade without BTC price', () => {
    const ctx = createContext({
      btcPrice: undefined,
      timeRemaining: 15000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs BTC ár');
  });

  it('should not trade with small delta', () => {
    const ctx = createContext({
      btcPrice: 100050,
      btcWindowOpen: 100000, // +0.05% delta (below 0.08% threshold)
      timeRemaining: 15000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl kicsi');
  });

  it('should not trade if price below 40¢', () => {
    const ctx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 15000,
      marketPrice: { yesPrice: 0.35, noPrice: 0.65 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl alacsony');
  });

  it('should not trade if price above 65¢', () => {
    const ctx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 15000,
      marketPrice: { yesPrice: 0.70, noPrice: 0.30 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl magas');
  });

  it('should trade YES on positive delta in valid window', () => {
    const ctx = createContext({
      btcPrice: 100150,
      btcWindowOpen: 100000, // +0.15% delta
      timeRemaining: 15000,
      marketPrice: { yesPrice: 0.50, noPrice: 0.50 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThan(0.6);
  });
});

describe('Monte Carlo Strategy', () => {
  const strategy = strategies.monte_carlo;

  it('should only be active in 30s - 4min window', () => {
    // Too early
    const earlyCtx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 250000,
    });
    expect(strategy.execute(earlyCtx).action).toBeNull();

    // Too late
    const lateCtx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 20000,
    });
    expect(strategy.execute(lateCtx).action).toBeNull();
  });

  it('should not trade without BTC price', () => {
    const ctx = createContext({
      btcPrice: undefined,
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs BTC ár');
  });

  it('should not trade with small delta', () => {
    const ctx = createContext({
      btcPrice: 100020,
      btcWindowOpen: 100000, // +0.02% delta (below 0.03% threshold)
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl kicsi');
  });

  it('should trade when edge exists and price is in range', () => {
    const ctx = createContext({
      btcPrice: 100150,
      btcWindowOpen: 100000, // +0.15% delta → ~75% UP prob
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 }, // Edge ~0.20
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('Fair Value Strategy', () => {
  const strategy = strategies.fair_value;

  it('should not trade too close to settlement', () => {
    const ctx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 10000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('zárás');
  });

  it('should not trade without BTC price', () => {
    const ctx = createContext({
      btcPrice: undefined,
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs BTC ár');
  });

  it('should trade when edge exceeds threshold', () => {
    const ctx = createContext({
      btcPrice: 100250,
      btcWindowOpen: 100000, // +0.25% delta
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThan(0.55);
  });

  it('should not trade if price out of range', () => {
    const ctx = createContext({
      btcPrice: 100250,
      btcWindowOpen: 100000,
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.38, noPrice: 0.62 }, // Below 40¢ min
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
  });
});

describe('Momentum Strategy', () => {
  const strategy = strategies.momentum;

  it('should not trade too close to settlement', () => {
    const ctx = createContext({
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 20000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('zárás');
  });

  it('should use btcPriceChange when available', () => {
    const ctx = createContext({
      btcPriceChange: 0.001, // +0.10% (above 0.08% threshold)
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.reason).toContain('momentum');
  });

  it('should fallback to window delta', () => {
    const ctx = createContext({
      btcPriceChange: undefined,
      btcPrice: 100150,
      btcWindowOpen: 100000, // +0.15% delta
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.reason).toContain('delta');
  });

  it('should not trade if price out of range', () => {
    const ctx = createContext({
      btcPriceChange: 0.001,
      btcPrice: 100200,
      btcWindowOpen: 100000,
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.38, noPrice: 0.62 }, // Below 40¢
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('kívül esik');
  });
});

describe('Mean Reversion Strategy', () => {
  const strategy = strategies.mean_reversion;

  it('should not trade too close to settlement', () => {
    const ctx = createContext({
      btcPrice: 100400,
      btcWindowOpen: 100000,
      timeRemaining: 20000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('zárás');
  });

  it('should buy NO on extreme UP movement (expect reversion)', () => {
    const ctx = createContext({
      btcPrice: 100400,
      btcWindowOpen: 100000, // +0.40% delta (above 0.20% threshold)
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('NO');
    expect(result.reason).toContain('visszatérés');
  });

  it('should buy YES on extreme DOWN movement (expect reversion)', () => {
    const ctx = createContext({
      btcPrice: 99600,
      btcWindowOpen: 100000, // -0.40% delta
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.45, noPrice: 0.55 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
    expect(result.reason).toContain('visszatérés');
  });

  it('should not trade on normal movement', () => {
    const ctx = createContext({
      btcPrice: 100100,
      btcWindowOpen: 100000, // +0.10% delta (below 0.20% threshold)
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('extrém');
  });
});

describe('Trend Strategy', () => {
  const strategy = strategies.trend;

  it('should not trade with insufficient data', () => {
    const ctx = createContext({
      priceHistory: [0.5, 0.51, 0.52], // Only 3 points
      timeRemaining: 120000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs elég');
  });

  it('should not trade too close to settlement', () => {
    const ctx = createContext({
      priceHistory: Array(20).fill(0).map((_, i) => 100 + i * 0.5),
      timeRemaining: 20000,
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
  });

  it('should trade when trend aligns with BTC delta', () => {
    // Create uptrending prices
    const uptrendPrices = [
      100, 100.2, 100.4, 100.6, 100.8, 101, 101.2, 101.4, 101.6, 101.8
    ];
    const ctx = createContext({
      priceHistory: uptrendPrices,
      btcPrice: 100200,
      btcWindowOpen: 100000, // Positive delta aligns with uptrend
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBe('YES');
  });

  it('should not trade when trend contradicts BTC delta', () => {
    const uptrendPrices = [
      100, 100.2, 100.4, 100.6, 100.8, 101, 101.2, 101.4, 101.6, 101.8
    ];
    const ctx = createContext({
      priceHistory: uptrendPrices,
      btcPrice: 99800,
      btcWindowOpen: 100000, // Negative delta contradicts uptrend
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('ellentmondás');
  });
});

describe('Anomaly Strategy', () => {
  const strategy = strategies.anomaly;

  it('should detect price anomaly when YES+NO < 96¢', () => {
    const ctx = createContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.46, noPrice: 0.46 }, // Sum = 92¢
    });
    const result = strategy.execute(ctx);
    expect(result.action).not.toBeNull();
    expect(result.reason).toContain('Anomália');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should not trade when no anomaly', () => {
    const ctx = createContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.50, noPrice: 0.50 }, // Sum = 100¢
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('Nincs anomália');
  });

  it('should not trade too close to settlement', () => {
    const ctx = createContext({
      timeRemaining: 20000,
      marketPrice: { yesPrice: 0.46, noPrice: 0.46 },
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
  });

  it('should not trade if price below 40¢', () => {
    const ctx = createContext({
      timeRemaining: 120000,
      marketPrice: { yesPrice: 0.30, noPrice: 0.30 }, // Sum = 60¢ but price too low
    });
    const result = strategy.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('túl alacsony');
  });
});

describe('Paused Strategies', () => {
  it('grid_trading should always return null', () => {
    const ctx = createContext();
    const result = strategies.grid_trading.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('szüneteltetve');
  });

  it('market_making should always return null', () => {
    const ctx = createContext();
    const result = strategies.market_making.execute(ctx);
    expect(result.action).toBeNull();
    expect(result.reason).toContain('szüneteltetve');
  });
});

describe('Random Strategy', () => {
  const strategy = strategies.random;

  it('should always return YES or NO', () => {
    const ctx = createContext();
    const result = strategy.execute(ctx);
    expect(['YES', 'NO']).toContain(result.action);
    expect(result.confidence).toBe(0.5);
    expect(result.reason).toContain('Véletlen');
  });
});

describe('Debug Log Utility', () => {
  it('should log when DEBUG_STRATEGIES is true', () => {
    const originalDebug = vi.spyOn(console, 'log');
    debugLog('TestStrategy', 'Test message', { key: 'value' });
    expect(originalDebug).toHaveBeenCalled();
  });
});