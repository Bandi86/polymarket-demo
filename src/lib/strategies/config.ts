// Strategy Configuration - Configurable thresholds for all strategies
// Critical fixes applied based on 2-hour session analysis:
// - fair_value: delta confirmation, tighter price range
// - binance_signal: relaxed price limits, fallback support
// - momentum: higher threshold

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy-specific thresholds
 * These can be tuned at runtime via config system (Phase 4)
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES - Optimized based on live testing
  // ═══════════════════════════════════════════════════════════════

  // #1 Window Delta - The best performer
  // FIX: Lowered minDelta from 0.07 to 0.05 for more trades
  window_delta: {
    minDelta: 0.05,
    minConfidence: 0.55,
    minPrice: 0.30,
    maxPrice: 0.70,
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
  },

  // #2 Oracle Lag (Binance Signal)
  // FIX: Relaxed price limits (25-75¢), signal freshness check
  binance_signal: {
    minDelta: 0.03,
    minConfidence: 0.45,
    minPrice: 0.25,
    maxPrice: 0.75,
    minTimeRemaining: 3000,
    signalMaxAge: 8000,
  },

  // #3 T-10 Sniper
  // Last 10-30 seconds scalp strategy
  last_seconds_scalp: {
    minDelta: 0.04,
    minPrice: 0.25,
    maxPrice: 0.75,
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
  },

  // #4 Monte Carlo
  // FIX: Increased minEdge from 0.08 to 0.10
  monte_carlo: {
    minDelta: 0.04,
    minEdge: 0.10,
    minPrice: 0.30,
    maxPrice: 0.65,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  // #5 Fair Value Arb - CRITICAL FIX
  // Issue: -$5.49 loss, 36% win rate in 2h session
  // FIX: Require delta confirmation, tighter price range, higher edge
  fair_value: {
    minDelta: 0.04,
    minEdge: 0.10,
    minPrice: 0.30,
    maxPrice: 0.65,  // Tighter (was 0.70)
    minTimeRemaining: 15000,
  },

  // #6 BTC Momentum - CRITICAL FIX
  // Issue: -$2.30 loss, 47% win rate
  // FIX: Higher threshold (0.07%), price limits
  momentum: {
    minDelta: 0.07,
    minConfidence: 0.50,
    minPrice: 0.30,
    maxPrice: 0.70,
    minTimeRemaining: 30000,
  },

  // #7 Smart Trend
  smart_trend: {
    minDelta: 0.03,
    minConfidence: 0.72,
    minPrice: 0.30,
    maxPrice: 0.70,
    minTimeRemaining: 30000,
  },

  // #8 Contrarian
  contrarian: {
    minDelta: 0.05,
    minConfidence: 0.55,
    minPrice: 0.30,
    maxPrice: 0.70,
    minTimeRemaining: 30000,
  },

  // #9 Arbitrage
  arbitrage: {
    minDelta: 0.04,
    minEdge: 0.08,
    minPrice: 0.30,
    maxPrice: 0.65,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGACY/DISABLED STRATEGIES - Minimal config
  // ═══════════════════════════════════════════════════════════════
  mean_reversion: { minDelta: 0.20 },
  trend: { minDelta: 0.04 },
  volatility: { minDelta: 0.06 },
  anomaly: {},
  momentum_burst: { minDelta: 0.04 },
  grid_trading: {},
  market_making: {},
  random: {},
};