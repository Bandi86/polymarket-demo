// Strategy Configuration - OPTIMIZED based on odds analysis
// Key finding: 40-60¢ zone is a loss leader, avoid it
// 60-80¢ zone has 73% win rate, profitable
// 0-20¢ zone is lottery (7% win rate, high variance)

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy thresholds - OPTIMIZED FOR PROFITABILITY
 *
 * ODDS RANGE ANALYSIS:
 * - 40-60¢: 50% win rate, -$90 PnL -> AVOID
 * - 60-80¢: 73% win rate, +$22 PnL -> TARGET for high-confidence strategies
 * - 0-20¢: 7% win rate, +$233 PnL -> Lottery only (contrarian)
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES - High confidence, target 60-80¢ odds
  // ═══════════════════════════════════════════════════════════════

  // #1 Window Delta - The best performer
  // Target expensive odds where win rate is higher
  window_delta: {
    minDelta: 0.07,
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
    // Target 60-85¢ for YES trades (high confidence)
    minOdds: 0.55,  // Don't buy cheap
    maxOdds: 0.88,  // Don't overpay
    avoidMiddle: true,
  },

  // #2 Oracle Lag (Binance Signal)
  // Signal freshness check, target higher odds
  binance_signal: {
    signalMaxAge: 8000,
    minTimeRemaining: 3000,
    minOdds: 0.55,
    maxOdds: 0.88,
    avoidMiddle: true,
  },

  // #3 T-10 Sniper - Last 10-30 seconds
  // Only trade when direction is clear (high odds)
  last_seconds_scalp: {
    minDelta: 0.04,
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
    minOdds: 0.60,  // Only buy when already expensive
    maxOdds: 0.90,
    avoidMiddle: true,
  },

  // #4 Monte Carlo - Needs rework, currently losing
  monte_carlo: {
    minDelta: 0.04,
    minEdge: 0.08,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
    minOdds: 0.55,
    maxOdds: 0.85,
    avoidMiddle: true,
  },

  // #5 Fair Value Arb - Target extreme odds
  fair_value: {
    minEdge: 0.07,
    minTimeRemaining: 15000,
    // Fair value should target extremes only
    minOdds: 0.05,  // Buy cheap NO
    maxOdds: 0.95,  // Buy cheap YES
    avoidMiddle: true,  // Block 40-60¢ zone
  },

  // ═══════════════════════════════════════════════════════════════
  // SECONDARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  // #6 BTC Momentum
  momentum: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
    minOdds: 0.55,
    maxOdds: 0.85,
    avoidMiddle: true,
  },

  // #7 Smart Trend
  smart_trend: {
    minTimeRemaining: 30000,
    minOdds: 0.55,
    maxOdds: 0.85,
    avoidMiddle: true,
  },

  // #8 Contrarian - Buy cheap when market overreacts
  contrarian: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
    // Contrarian buys cheap (opposite of crowd)
    minOdds: 0.05,
    maxOdds: 0.35,  // Only buy when cheap
    avoidMiddle: true,
  },

  // #9 Arbitrage
  arbitrage: {
    minDelta: 0.04,
    minEdge: 0.06,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
    minOdds: 0.55,
    maxOdds: 0.85,
    avoidMiddle: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGACY/DISABLED STRATEGIES
  // ═══════════════════════════════════════════════════════════════
  mean_reversion: { avoidMiddle: true },
  trend: { avoidMiddle: true },
  volatility: { avoidMiddle: true },
  anomaly: { avoidMiddle: true },
  momentum_burst: { avoidMiddle: true },
  grid_trading: { avoidMiddle: true },
  market_making: { avoidMiddle: true },
  random: { avoidMiddle: true },
};