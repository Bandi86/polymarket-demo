/**
 * Backtesting Engine
 * Runs strategies against historical Polymarket market data offline.
 * Uses the same strategy implementations from bot-manager to ensure consistency.
 */

// === Strategy Implementations (duplicated from bot-manager for isolation) ===

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

// Backtest-compatible strategy logic (matching real execution from bot-manager.ts)
const backtestStrategies: Record<string, (ctx: BacktestContext) => BacktestDecision> = {
  momentum_chaser: (ctx) => {
    // Entry window: T-90s to T-5s
    if (ctx.timeRemaining > 90000 || ctx.timeRemaining < 5000) {
      return { action: null, reason: "Not in entry window (T-90s)" };
    }
    // Need price change data (using simulated BTC price change)
    if (ctx.btcPriceChange === undefined || ctx.btcPriceChange === null) {
      return { action: null, reason: "No BTC price data" };
    }
    // Lowered threshold: 0.01% delta (matching bot-manager)
    const threshold = 0.0001;
    if (Math.abs(ctx.btcPriceChange) < threshold) {
      return { action: null, reason: `Flat market: delta ${(ctx.btcPriceChange * 100).toFixed(3)}%` };
    }
    const action = ctx.btcPriceChange > 0 ? "YES" : "NO";
    return { action, reason: `Momentum: BTC ${ctx.btcPriceChange >= 0 ? "+" : ""}${(ctx.btcPriceChange * 100).toFixed(3)}%` };
  },

  mean_reversion_sniper: (ctx) => {
    if (ctx.timeRemaining < 10000) return { action: null, reason: "Too close to settlement" };
    const yesPrice = ctx.yesPrice;
    const noPrice = ctx.noPrice;
    // Lowered spike threshold: 80% (was 90%)
    const hasSpike = yesPrice > 0.80 || noPrice > 0.80;
    if (!hasSpike) return { action: null, reason: `No spike detected (need >80%)` };
    // Determine spike direction
    const spikeIsUp = yesPrice > noPrice; // Market expects UP
    const spikeIsDown = noPrice > yesPrice; // Market expects DOWN
    // Check BTC momentum
    const btcDelta = ctx.btcPriceChange || 0;
    // KEY: Only fade if BTC moves AGAINST the spike
    const btcMovingUp = btcDelta > 0.0003;
    const btcMovingDown = btcDelta < -0.0003;
    if (spikeIsUp && btcMovingDown) {
      return { action: "NO", reason: `Fade UP spike: BTC down, buying NO at ${(noPrice * 100).toFixed(0)}¢` };
    }
    if (spikeIsDown && btcMovingUp) {
      return { action: "YES", reason: `Fade DOWN spike: BTC up, buying YES at ${(yesPrice * 100).toFixed(0)}¢` };
    }
    return { action: null, reason: `Spike aligns with BTC: no fade opportunity` };
  },

  sum_to_one_arb: (ctx) => {
    if (ctx.timeRemaining < 30000) return { action: null, reason: "Too close to settlement" };

    const yesPrice = ctx.yesPrice;
    const noPrice = ctx.noPrice;
    const btcDelta = ctx.btcPriceChange || 0;

    // Look for market expectations vs BTC direction
    const marketExpectsUp = yesPrice > 0.55;
    const marketExpectsDown = noPrice > 0.55;

    // Need clear market bias
    if (!marketExpectsUp && !marketExpectsDown) {
      return { action: null, reason: `Market undecided: YES ${(yesPrice * 100).toFixed(0)}¢` };
    }

    // BTC direction thresholds
    const btcUp = btcDelta > 0.0003;   // BTC up > 0.03%
    const btcDown = btcDelta < -0.0003; // BTC down > 0.03%

    // Case 1: Market UP + BTC UP = Strong YES signal
    if (marketExpectsUp && btcUp) {
      return { action: "YES", reason: `Balanced: Market & BTC both UP → YES` };
    }

    // Case 2: Market DOWN + BTC DOWN = Strong NO signal
    if (marketExpectsDown && btcDown) {
      return { action: "NO", reason: `Balanced: Market & BTC both DOWN → NO` };
    }

    // Fade cases removed - were causing losses
    return { action: null, reason: `BTC/Market contradiction - no trade` };
  },

  whale_follower: (ctx) => {
    if (ctx.timeRemaining < 30000) return { action: null, reason: "Too close to settlement" };
    const btcDelta = ctx.btcPriceChange || 0;

    // FOLLOW extreme prices when BTC confirms
    const extremeUp = ctx.yesPrice > 0.70;  // Market confident UP
    const extremeDown = ctx.noPrice > 0.70; // Market confident DOWN

    if (!extremeUp && !extremeDown) {
      return { action: null, reason: `No extreme price (need >70%)` };
    }

    // BTC confirming the move (>0.03%)
    const btcUp = btcDelta > 0.0003;
    const btcDown = btcDelta < -0.0003;

    // FOLLOW UP spike when BTC confirms (both going UP)
    if (extremeUp && btcUp) {
      return { action: "YES", reason: `Momentum: Follow UP spike, BTC up +${(btcDelta * 100).toFixed(2)}%` };
    }
    // FOLLOW DOWN spike when BTC confirms (both going DOWN)
    if (extremeDown && btcDown) {
      return { action: "NO", reason: `Momentum: Follow DOWN spike, BTC down ${(btcDelta * 100).toFixed(2)}%` };
    }

    return { action: null, reason: `BTC contradicts extreme - waiting for confirmation` };
  },

  ta_signal_engine: (ctx) => {
    // Wider entry window: 30-240s (was 60-240s)
    if (ctx.timeRemaining > 240000 || ctx.timeRemaining < 30000) return { action: null, reason: "Not in entry window (30-240s)" };
    // Reduced required candles: 14 (matching bot-manager)
    if (ctx.priceHistory.length < 14) return { action: null, reason: `Insufficient data: ${ctx.priceHistory.length} candles (need 14)` };
    const ema9 = calculateEMA(ctx.priceHistory, 9);
    const ema14 = calculateEMA(ctx.priceHistory, 14);
    const rsi = calculateRSI(ctx.priceHistory, 14);
    // Widened RSI bands: 15-85 (matching bot-manager)
    if (rsi > 85) return { action: null, reason: `RSI overbought: ${rsi.toFixed(1)}` };
    if (rsi < 15) return { action: null, reason: `RSI oversold: ${rsi.toFixed(1)}` };
    // Bullish: EMA9 > EMA14 and RSI not overbought
    if (ema9 > ema14 && rsi < 75) return { action: "YES", reason: `Bullish: EMA9 > EMA14, RSI=${rsi.toFixed(1)}` };
    // Bearish: EMA9 < EMA14 and RSI not oversold
    if (ema9 < ema14 && rsi > 25) return { action: "NO", reason: `Bearish: EMA9 < EMA14, RSI=${rsi.toFixed(1)}` };
    return { action: null, reason: `No clear signal: RSI=${rsi.toFixed(1)}` };
  },

  market_maker: (ctx) => {
    // Wider entry window: 30-180s (was 60-180s)
    if (ctx.timeRemaining > 180000 || ctx.timeRemaining < 30000) return { action: null, reason: "Not in entry window (30-180s)" };
    const btcDelta = ctx.btcPriceChange || 0;
    // Lower threshold: >0.05% (was 0.08%)
    const veryStrongBtcUp = btcDelta > 0.0005;
    const veryStrongBtcDown = btcDelta < -0.0005;
    // Setup 1: Strong BTC move with market not yet reacted
    if (veryStrongBtcUp && ctx.yesPrice < 0.65) {
      return { action: "YES", reason: `Sniper: BTC +${(btcDelta * 100).toFixed(2)}%, market lagging` };
    }
    if (veryStrongBtcDown && ctx.noPrice < 0.65) {
      return { action: "NO", reason: `Sniper: BTC -${Math.abs(btcDelta * 100).toFixed(2)}%, market lagging` };
    }
    // Setup 2: Extreme fade (>80%) with BTC contradiction
    const extremeUp = ctx.yesPrice > 0.80;
    const extremeDown = ctx.noPrice > 0.80;
    if (extremeUp && veryStrongBtcDown) {
      return { action: "NO", reason: `Sniper fade: UP extreme, BTC down` };
    }
    if (extremeDown && veryStrongBtcUp) {
      return { action: "YES", reason: `Sniper fade: DOWN extreme, BTC up` };
    }
    return { action: null, reason: `No high-quality setup` };
  },
};

interface BacktestContext {
  yesPrice: number;
  noPrice: number;
  priceHistory: number[];
  priceChange: number;
  timeRemaining: number;
  marketDuration: number;
  btcPriceChange: number; // Simulated BTC price change (matching real bot behavior)
}

interface BacktestDecision {
  action: "YES" | "NO" | null;
  reason: string;
}

interface BacktestTrade {
  timestamp: number;
  action: "YES" | "NO";
  odds: number;
  amount: number;
  fee: number;
  pnl: number | null;
  marketResult: "UP" | "DOWN" | null;
}

export interface BacktestResult {
  strategy: string;
  strategyName: string;
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  equityCurve: number[];
  trades: BacktestTrade[];
  startBalance: number;
  endBalance: number;
  calmarRatio: number;
}

export interface BacktestConfig {
  strategies: string[];
  startBalance: number;
  betSize: number;
  feeRate: number;
  slippageEnabled: boolean;
  baseSpread: number;
  maxSlippage: number;
  numMarkets: number; // How many simulated markets to run
}

const STRATEGY_NAMES: Record<string, string> = {
  momentum_chaser: "Momentum Chaser",
  mean_reversion_sniper: "Mean Reversion Sniper",
  sum_to_one_arb: "Balanced Signal",
  whale_follower: "Momentum Follow",
  ta_signal_engine: "High Conviction",
  market_maker: "Sniper",
};

/**
 * Run a backtest using simulated market data based on real Polymarket patterns.
 * Generates realistic 5-minute market cycles with price evolution.
 */
export function runBacktest(config: BacktestConfig): BacktestResult[] {
  const results: BacktestResult[] = [];

  for (const strategyId of config.strategies) {
    const strategyFn = backtestStrategies[strategyId];
    if (!strategyFn) continue;

    let balance = config.startBalance;
    const equityCurve: number[] = [balance];
    const trades: BacktestTrade[] = [];
    let peak = balance;
    let maxDrawdown = 0;

    // Run through N simulated markets
    for (let marketIdx = 0; marketIdx < config.numMarkets; marketIdx++) {
      // Generate a realistic market
      const market = generateSimulatedMarket();
      const marketDuration = 5 * 60 * 1000; // 5 min
      const priceHistory: number[] = [];

      // Simulate strategy checks at intervals through the market
      const checkInterval = 5000; // Every 5 seconds
      const numChecks = Math.floor(marketDuration / checkInterval);

      for (let tick = 0; tick < numChecks; tick++) {
        const elapsed = tick * checkInterval;
        const timeRemaining = marketDuration - elapsed;
        const progress = elapsed / marketDuration;

        // Get price at this point in time
        const pricePoint = market.getPriceAt(progress);
        priceHistory.push(pricePoint.yes);

        const priceChange = priceHistory.length >= 2
          ? (pricePoint.yes - priceHistory[priceHistory.length - 2]) / priceHistory[priceHistory.length - 2]
          : 0;

        // Simulated BTC price change - correlates with market direction but with noise
        // This mimics real bot behavior where BTC momentum influences decisions
        const btcPriceChange = market.btcChange + (Math.random() - 0.5) * 0.002;

        const ctx: BacktestContext = {
          yesPrice: pricePoint.yes,
          noPrice: pricePoint.no,
          priceHistory: [...priceHistory],
          priceChange,
          timeRemaining,
          marketDuration,
          btcPriceChange,
        };

        const decision = strategyFn(ctx);
        if (!decision.action) continue;

        // Execute trade
        const rawOdds = decision.action === "YES" ? pricePoint.yes : pricePoint.no;

        // Apply slippage
        let slippage = 0;
        if (config.slippageEnabled) {
          const halfSpread = config.baseSpread / 2;
          const randomSlip = Math.random() * config.maxSlippage;
          const sizeImpact = Math.max(0, (config.betSize - 1) * 0.001);
          slippage = halfSpread + randomSlip + sizeImpact;
        }
        const odds = Math.max(0.01, Math.min(0.99, rawOdds + slippage));

        const amount = Math.min(config.betSize, balance * 0.9); // Max 90% of balance
        if (amount < 0.01 || balance < amount * 1.02) continue; // Can't afford

        const fee = amount * config.feeRate;
        balance -= (amount + fee);

        // Determine result at settlement
        const won =
          (decision.action === "YES" && market.result === "UP") ||
          (decision.action === "NO" && market.result === "DOWN");

        const payout = won ? amount / odds : 0;
        const pnl = payout - amount - fee;
        balance += payout;

        trades.push({
          timestamp: Date.now() - (config.numMarkets - marketIdx) * 300000 + elapsed,
          action: decision.action,
          odds,
          amount,
          fee,
          pnl,
          marketResult: market.result,
        });

        equityCurve.push(balance);

        // Track drawdown
        if (balance > peak) peak = balance;
        const dd = (peak - balance) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }

    // Calculate stats
    const wins = trades.filter(t => (t.pnl || 0) > 0);
    const losses = trades.filter(t => (t.pnl || 0) <= 0);
    const winRate = trades.length > 0 ? wins.length / trades.length : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length) : 0;

    const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    const totalReturn = balance - config.startBalance;

    // Sharpe ratio from trade returns
    let sharpeRatio = 0;
    if (trades.length >= 2) {
      const returns = trades.map(t => (t.pnl || 0) / config.startBalance);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    }

    // Calmar ratio = annualized return / max drawdown
    const calmarRatio = maxDrawdown > 0 ? (totalReturn / config.startBalance) / maxDrawdown : 0;

    results.push({
      strategy: strategyId,
      strategyName: STRATEGY_NAMES[strategyId] || strategyId,
      totalTrades: trades.length,
      winRate,
      totalReturn,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      avgWin,
      avgLoss,
      profitFactor,
      equityCurve,
      trades,
      startBalance: config.startBalance,
      endBalance: balance,
      calmarRatio,
    });
  }

  return results.sort((a, b) => b.totalReturn - a.totalReturn);
}

/**
 * Generate a simulated 5-minute market with realistic price evolution.
 * Prices follow a random walk with mean-reverting tendency around 0.5,
 * then settle based on the end-of-market BTC price movement.
 */
function generateSimulatedMarket(): {
  getPriceAt: (progress: number) => { yes: number; no: number };
  result: "UP" | "DOWN";
  btcChange: number; // Simulated BTC price movement
} {
  // Random final result
  const result: "UP" | "DOWN" = Math.random() > 0.5 ? "UP" : "DOWN";

  // Simulate BTC price change - correlates with market outcome
  // BTC up -> market tends UP, BTC down -> market tends DOWN
  const btcChange = result === "UP"
    ? 0.0005 + Math.random() * 0.002  // +0.05% to +0.25%
    : -0.0025 + Math.random() * 0.002; // -0.25% to -0.05%

  // Generate a price path using a mean-reverting random walk
  const steps = 60; // 60 price points for 5 min
  const prices: number[] = [0.5]; // Start at 50%
  const drift = result === "UP" ? 0.001 : -0.001; // Slight drift toward result
  const volatility = 0.015; // Per-step volatility

  for (let i = 1; i < steps; i++) {
    const prevPrice = prices[i - 1];
    const meanRevert = (0.5 - prevPrice) * 0.05; // Pull back to 0.5
    const random = (Math.random() - 0.5) * 2 * volatility;

    // Drift accelerates in last 30% of market
    const timeFactor = i / steps;
    const adjustedDrift = drift * (timeFactor > 0.7 ? 3 : 1);

    let newPrice = prevPrice + adjustedDrift + meanRevert + random;
    newPrice = Math.max(0.05, Math.min(0.95, newPrice));

    // Final price should be closer to 1 or 0 based on result
    if (i === steps - 1) {
      newPrice = result === "UP" ? 0.7 + Math.random() * 0.25 : 0.05 + Math.random() * 0.25;
    }

    prices.push(newPrice);
  }

  return {
    getPriceAt: (progress: number) => {
      const idx = Math.min(steps - 1, Math.floor(progress * steps));
      const yes = prices[idx];
      return { yes, no: 1 - yes };
    },
    result,
    btcChange,
  };
}

export const backtestEngine = {
  run: runBacktest,
};
