// Strategy Configuration - NO HARD ODDS FILTERS
// Let strategies decide based on signals, not arbitrary odds limits
// The key is confidence scoring, not blocking trades

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy thresholds - SIGNALS OVER FILTERS
 *
 * Philosophy:
 * - Don't block trades by odds alone
 * - Let strategies decide based on delta, signals, timing
 * - Confidence scoring handles the risk
 * - Higher thresholds = fewer but better quality trades
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  window_delta: {
    minDelta: 0.02,        // 0.02% minimum delta
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
  },

  binance_signal: {
    signalMaxAge: 8000,    // Signal must be fresh
    minTimeRemaining: 3000,
    minDelta: 0.05,        // Fallback delta threshold (raised from 0.02)
  },

  last_seconds_scalp: {
    minDelta: 0.02,        // 0.02% minimum
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
  },

  monte_carlo: {
    minDelta: 0.02,        // 0.02% minimum
    minEdge: 0.03,         // 3% edge
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  fair_value: {
    minEdge: 0.05,         // 5% edge (raised from 0.02 - was losing)
    minTimeRemaining: 15000,
  },

  // ═══════════════════════════════════════════════════════════════
  // SECONDARY STRATEGIES
  // ═══════════════════════════════════════════════════════════════

  momentum: {
    minDelta: 0.02,        // 0.02% minimum
    minTimeRemaining: 30000,
  },

  smart_trend: {
    minTimeRemaining: 30000,
    minDelta: 0.02,        // Added minimum
  },

  contrarian: {
    minDelta: 0.05,        // 0.05% minimum (raised from 0.02 - was losing)
    minTimeRemaining: 30000,
  },

  arbitrage: {
    minDelta: 0.02,        // 0.02% minimum
    minEdge: 0.03,         // 3% edge
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