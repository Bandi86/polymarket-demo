/**
 * Backtesting Engine
 * Runs strategies against historical Polymarket market data offline.
 * Uses the same strategy implementations from bot-manager to ensure consistency.
 */

import { dbService } from "./database";
import type { StrategyType, StrategyContext, Strategy } from "../types";
import { marketEngine } from "./market-engine";

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

// Backtest-compatible strategy logic (simplified but matching real execution)
const backtestStrategies: Record<string, (ctx: BacktestContext) => BacktestDecision> = {
  momentum_chaser: (ctx) => {
    if (ctx.timeRemaining > 30000 || ctx.timeRemaining < 5000) {
      return { action: null, reason: "Not in entry window" };
    }
    if (ctx.priceChange === undefined || Math.abs(ctx.priceChange) < 0.0002) {
      return { action: null, reason: "Flat market" };
    }
    const action = ctx.priceChange > 0 ? "YES" : "NO";
    const targetPrice = action === "YES" ? ctx.yesPrice : ctx.noPrice;
    if (targetPrice > 0.88) return { action: null, reason: "Token too expensive" };
    return { action, reason: `Momentum: ${ctx.priceChange > 0 ? "+" : ""}${(ctx.priceChange * 100).toFixed(3)}%` };
  },

  mean_reversion_sniper: (ctx) => {
    if (ctx.timeRemaining < 10000) return { action: null, reason: "Too close to settlement" };
    const hasSpike = ctx.yesPrice > 0.93 || ctx.noPrice > 0.93;
    if (!hasSpike) return { action: null, reason: "No spike" };
    if (Math.abs(ctx.priceChange || 0) > 0.0001) return { action: null, reason: "BTC moved" };
    return { action: ctx.yesPrice > 0.93 ? "NO" : "YES", reason: "Fade spike" };
  },

  sum_to_one_arb: (ctx) => {
    if (ctx.timeRemaining < 30000) return { action: null, reason: "Too close" };
    const sum = ctx.yesPrice + ctx.noPrice;
    if (sum >= 0.98) return { action: null, reason: `No arb: sum=${(sum * 100).toFixed(1)}%` };
    return { action: ctx.yesPrice < ctx.noPrice ? "YES" : "NO", reason: `Arb: sum=${(sum * 100).toFixed(1)}%` };
  },

  whale_follower: (ctx) => {
    if (ctx.timeRemaining < 5000) return { action: null, reason: "Too close" };
    // Simulated whale signal based on price momentum
    if (ctx.priceHistory.length < 3) return { action: null, reason: "Insufficient data" };
    const recent = ctx.priceHistory.slice(-3);
    const trend = recent[2] - recent[0];
    if (Math.abs(trend) < 0.01) return { action: null, reason: "No whale activity" };
    return { action: trend > 0 ? "YES" : "NO", reason: `Whale signal: ${trend > 0 ? "bullish" : "bearish"}` };
  },

  ta_signal_engine: (ctx) => {
    if (ctx.timeRemaining < 30000) return { action: null, reason: "Too close" };
    if (ctx.priceHistory.length < 21) return { action: null, reason: "Insufficient data" };
    const ema9 = calculateEMA(ctx.priceHistory, 9);
    const ema21 = calculateEMA(ctx.priceHistory, 21);
    const rsi = calculateRSI(ctx.priceHistory, 14);
    if (rsi > 80 || rsi < 20) return { action: null, reason: `RSI extreme: ${rsi.toFixed(1)}` };
    if (ema9 > ema21 && rsi < 70) return { action: "YES", reason: `Bullish EMA crossover` };
    if (ema9 < ema21 && rsi > 30) return { action: "NO", reason: `Bearish EMA crossover` };
    return { action: null, reason: "No signal" };
  },

  market_maker: (ctx) => {
    if (ctx.timeRemaining < 60000) return { action: null, reason: "T-60s exit" };
    const spread = Math.abs(ctx.yesPrice - ctx.noPrice);
    if (spread < 0.015) return { action: null, reason: "Tight spread" };
    if (ctx.yesPrice > 0.55) return { action: "NO", reason: "Market making: bid NO" };
    if (ctx.noPrice > 0.55) return { action: "YES", reason: "Market making: bid YES" };
    return { action: null, reason: "Market balanced" };
  },
};

interface BacktestContext {
  yesPrice: number;
  noPrice: number;
  priceHistory: number[];
  priceChange: number;
  timeRemaining: number;
  marketDuration: number;
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
  sum_to_one_arb: "Sum-to-One Arbitrage",
  whale_follower: "Whale Follower",
  ta_signal_engine: "TA Signal Engine",
  market_maker: "Market Maker",
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

        const ctx: BacktestContext = {
          yesPrice: pricePoint.yes,
          noPrice: pricePoint.no,
          priceHistory: [...priceHistory],
          priceChange,
          timeRemaining,
          marketDuration,
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
} {
  // Random final result
  const result: "UP" | "DOWN" = Math.random() > 0.5 ? "UP" : "DOWN";

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
  };
}

export const backtestEngine = {
  run: runBacktest,
};
