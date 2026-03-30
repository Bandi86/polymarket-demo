// Strategy Configuration - BALANCED for trading frequency
// Key finding: 40-60¢ zone is a loss leader, but we can't block ALL trades
// Solution: Only block the very middle (45-55¢), allow strategies to trade at extremes

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy thresholds - BALANCED FOR ACTIVITY
 *
 * ODDS FILTER STRATEGY:
 * - Block only 45-55¢ zone (very close to 50¢)
 * - Allow 35-45¢ and 55-65¢ for directional trades
 * - Allow <35¢ and >65¢ for high-conviction trades
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES - Relaxed odds for more trades
  // ═══════════════════════════════════════════════════════════════

  // #1 Window Delta - Trade when direction is clear
  window_delta: {
    minDelta: 0.07,
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
    // Allow all odds except very middle
    avoidMiddle: true,  // Blocks 45-55¢
  },

  // #2 Oracle Lag (Binance Signal) - Follow signals
  binance_signal: {
    signalMaxAge: 8000,
    minTimeRemaining: 3000,
    avoidMiddle: true,
  },

  // #3 T-10 Sniper - Last 10-30 seconds
  last_seconds_scalp: {
    minDelta: 0.04,
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
    avoidMiddle: true,
  },

  // #4 Monte Carlo
  monte_carlo: {
    minDelta: 0.04,
    minEdge: 0.08,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
    avoidMiddle: true,
  },

  // #5 Fair Value Arb - Allow all extremes
  fair_value: {
    minEdge: 0.05,  // Lowered from 0.07
    minTimeRemaining: 15000,
    avoidMiddle: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECONDARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  // #6 BTC Momentum
  momentum: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
    avoidMiddle: true,
  },

  // #7 Smart Trend
  smart_trend: {
    minTimeRemaining: 30000,
    avoidMiddle: true,
  },

  // #8 Contrarian - Buy cheap when market overreacts
  contrarian: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
    avoidMiddle: true,
  },

  // #9 Arbitrage
  arbitrage: {
    minDelta: 0.04,
    minEdge: 0.05,  // Lowered from 0.06
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
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