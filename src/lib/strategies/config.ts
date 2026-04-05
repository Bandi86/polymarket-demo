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
  // NEW STRATEGIES (Option A - Change the Game)
  // ═══════════════════════════════════════════════════════════════

  volatility_breakout: {
    minHighVolatility: 0.003,   // 0.3% BTC price volatility - triggers directional bias
    maxLowVolatility: 0.001,    // 0.1% - consolidation phase, wait for breakout
    minDelta: 0.03,             // 0.03% BTC delta from window open needed for direction
    breakoutDelta: 0.05,        // 0.05% delta needed for low-volatility breakout
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
  },

  time_pattern: {
    minDelta: 0.02,             // 0.02% minimum BTC delta for direction
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
    avoidWeekend: true,         // Skip weekend trading (low volume)
  },

  price_reversion: {
    oversoldYes: 0.25,          // Buy YES when price < 25¢ (oversold)
    overboughtYes: 0.75,        // Buy NO when YES price > 75¢ (overbought)
    minTimeRemaining: 15000,    // Don't trade with <15 seconds remaining
  },

  binance_velocity: {
    minVelocity: 0.0001,        // 0.01% BTC price change per second minimum
    minAcceleration: 0.00005,   // 0.005%/s² acceleration for signal boost
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
  },

  sniper_value: {
    yesBuyMax: 0.15,            // Buy YES if price < 15¢ (extreme undervaluation)
    noBuyMin: 0.40,             // Buy NO if YES price > 40¢ (overvaluation)
    minTimeRemaining: 20000,    // Don't trade with <20 seconds remaining
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGACY STRATEGIES (kept for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

  window_delta: {
    minDelta: 0.05,        // 0.05% BTC delta from window open (raised from 0.02)
    minTimeRemaining: 3000,   // Don't trade with <3 seconds remaining
    maxTimeRemaining: 270000, // Don't trade with >4.5 minutes remaining
  },

  binance_signal: {
    signalMaxAge: 8000,    // Binance signal expires after 8 seconds
    minTimeRemaining: 3000,   // Don't trade with <3 seconds remaining
    minDelta: 0.05,        // 0.05% fallback delta threshold
  },

  last_seconds_scalp: {
    minDelta: 0.05,        // 0.05% minimum BTC delta (raised from 0.02)
    minTimeRemaining: 4000,   // Only trade with 4-30 seconds remaining
    maxTimeRemaining: 30000,  // Only trade with 4-30 seconds remaining
  },

  monte_carlo: {
    minDelta: 0.02,        // 0.02% minimum delta (winner - keep as is)
    minEdge: 0.03,         // 3% minimum edge (winner - keep as is)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
    maxTimeRemaining: 240000, // Don't trade with >4 minutes remaining
  },

  fair_value: {
    minEdge: 0.07,         // 7% minimum edge (raised from 0.05)
    minTimeRemaining: 15000,  // Don't trade with <15 seconds remaining
  },

  momentum: {
    minDelta: 0.07,        // 0.07% minimum delta (raised from 0.02 - was worst at -$10)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
  },

  smart_trend: {
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
    minDelta: 0.05,        // 0.05% minimum delta (raised from 0.02)
  },

  contrarian: {
    minDelta: 0.05,        // 0.05% minimum delta (keep at 0.05)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
  },

  arbitrage: {
    minDelta: 0.02,        // 0.02% minimum delta (winner - keep as is)
    minEdge: 0.03,         // 3% minimum edge (winner - keep as is)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
    maxTimeRemaining: 240000, // Don't trade with >4 minutes remaining
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