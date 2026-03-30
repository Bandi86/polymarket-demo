// Strategy Configuration - NO HARD ODDS FILTERS
// Let strategies decide based on signals, not arbitrary odds limits
// The key is confidence scoring, not blocking trades

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy thresholds - QUALITY OVER QUANTITY
 *
 * Lessons from 2-hour test (119 min):
 * - Winners (Monte Carlo +$5.45, Arbitrage +$1.65): 19 trades, higher thresholds
 * - Losers (BTC Momentum -$10, etc.): 24 trades, too low thresholds
 *
 * Rule: More selective = better win rate = profit
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  window_delta: {
    minDelta: 0.05,        // Raised from 0.02 - was losing
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
  },

  binance_signal: {
    signalMaxAge: 8000,
    minTimeRemaining: 3000,
    minDelta: 0.05,        // Fallback delta threshold
  },

  last_seconds_scalp: {
    minDelta: 0.05,        // Raised from 0.02
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
  },

  monte_carlo: {
    minDelta: 0.02,        // Winner - keep as is
    minEdge: 0.03,         // Winner - keep as is
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  fair_value: {
    minEdge: 0.07,         // Raised from 0.05 - still losing
    minTimeRemaining: 15000,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECONDARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  momentum: {
    minDelta: 0.07,        // Raised from 0.02 - was WORST at -$10
    minTimeRemaining: 30000,
  },

  smart_trend: {
    minTimeRemaining: 30000,
    minDelta: 0.05,        // Raised from 0.02
  },

  contrarian: {
    minDelta: 0.05,        // Keep at 0.05
    minTimeRemaining: 30000,
  },

  arbitrage: {
    minDelta: 0.02,        // Winner - keep as is
    minEdge: 0.03,         // Winner - keep as is
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGACY/DISABLED
  // ═══════════════════════════════════════════════════════════════
  mean_reversion: {},
  trend: {},
  volatility: {},
  anomaly: {},
  momentum_burst: {},
  grid_trading: {},
  market_making: {},
  random: {},
};