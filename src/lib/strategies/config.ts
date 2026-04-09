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
    minDelta: 0.05,             // 0.05% BTC delta (raised from 0.03 - per 2026-04-09 plan)
    breakoutDelta: 0.08,         // 0.08% delta needed for low-vol breakout (raised from 0.05)
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
  },

  ultra_low_entry: {
    ultraLowMax: 0.05,         // Ultra-low zone: <5¢ (reduced from 12¢ - per 2026-04-09 plan - DON'T trade at extreme lows)
    lowEntryMax: 0.15,         // Low entry zone: 5-15¢ (reduced from 25¢)
    overvaluedMin: 0.90,       // Overvalued zone: YES > 90¢ (raised from 85¢)
    minTimeRemaining: 30000,   // Don't trade with <30 seconds remaining (raised from 20s)
    // Fallback: BTC momentum if in middle zone
    fallbackEnabled: true,
    fallbackMinDelta: 0.06,    // Higher threshold per plan
  },

  trend_pullback: {
    minDelta: 0.05,             // 0.05% minimum BTC delta for direction trend
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
  },

  price_reversion: {
    oversoldYes: 0.28,          // Buy YES when price < 28¢ (widened from 0.20 - per 2026-04-09 plan)
    overboughtYes: 0.72,        // Buy NO when YES price > 72¢ (narrowed from 0.80 - per 2026-04-09 plan)
    minTimeRemaining: 15000,    // Don't trade with <15 seconds remaining
    // Fallback: BTC momentum if in middle zone
    fallbackEnabled: true,
    fallbackMinDelta: 0.02,    // Lowered from 0.03 - more fallback opportunities per plan
  },

  binance_velocity: {
    minVelocity: 0.0001,        // 0.01% BTC price change per second minimum
    minAcceleration: 0.00005,   // 0.005%/s² acceleration for signal boost
    minTimeRemaining: 30000,    // Don't trade with <30 seconds remaining
  },

  sniper_value: {
    yesBuyMax: 0.22,           // Buy YES if price < 22¢ (widened from 0.12 - per 2026-04-09 plan)
    noBuyMin: 0.78,             // Buy NO if YES price > 78¢ (widened from 0.45 - per 2026-04-09 plan)
    minTimeRemaining: 30000,   // Don't trade with <30 seconds remaining (raised from 20s)
    // Fallback: BTC momentum if in middle zone
    fallbackEnabled: true,
    fallbackMinDelta: 0.03,    // Lowered from 0.04 - more fallback opportunities
  },

  odds_swing: {
    minPrice: 0.25,            // Minimum price to buy (25¢) (widened from 0.04 - per 2026-04-09 plan)
    maxPrice: 0.75,            // Maximum price to buy (75¢) (widened from 0.15 - per 2026-04-09 plan)
    minTimeRemaining: 60000,   // Need at least 60 seconds for swing (reduced from 90s)
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
    signalMaxAge: 5000,    // 5 seconds (reduced from 8s - per 2026-04-09 plan)
    minTimeRemaining: 3000,   // Don't trade with <3 seconds remaining
    minDelta: 0.07,        // 0.07% fallback delta threshold (raised from 0.05 - per 2026-04-09 plan)
  },

  last_seconds_scalp: {
    minDelta: 0.04,        // 0.04% minimum BTC delta (per 2026-04-09 plan - was 0.05)
    minTimeRemaining: 4000,   // Only trade with 4-30 seconds remaining
    maxTimeRemaining: 30000,  // Only trade with 4-30 seconds remaining
  },

  monte_carlo: {
    minDelta: 0.06,        // 0.06% minimum delta (raised from 0.02 - CRITICAL FIX per 2026-04-09 plan)
    minEdge: 0.10,         // 10% minimum edge (raised from 0.03 - CRITICAL FIX per 2026-04-09 plan)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
    maxTimeRemaining: 240000, // Don't trade with >4 minutes remaining
  },

  fair_value: {
    minEdge: 0.08,         // 8% minimum edge (raised from 0.07 - CRITICAL FIX per 2026-04-09 plan)
    minTimeRemaining: 15000,  // Don't trade with <15 seconds remaining
  },

  momentum: {
    minDelta: 0.10,        // 0.10% minimum delta (raised from 0.07 - per 2026-04-09 plan)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
  },

  smart_trend: {
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
    minDelta: 0.03,        // 0.03% minimum delta (lowered from 0.05 - per 2026-04-09 plan for more trades)
  },

  contrarian: {
    minDelta: 0.05,        // 0.05% minimum delta (keep at 0.05)
    minTimeRemaining: 30000,  // Don't trade with <30 seconds remaining
  },

  arbitrage: {
    minDelta: 0.08,        // 0.08% minimum delta (raised from 0.02 - CRITICAL FIX per 2026-04-09 plan)
    minEdge: 0.12,         // 12% minimum edge (raised from 0.03 - CRITICAL FIX per 2026-04-09 plan)
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