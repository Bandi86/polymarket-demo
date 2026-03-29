// Strategy Configuration - RESTORED from working version (commit eb05cd2)
// 2026-03-20 session: +$90 profit with these settings
// Simpler is better - less restrictions = more trades = more profit

import type { StrategyType } from "../../types";
import type { StrategyThresholds } from "./types";

/**
 * Strategy thresholds - RESTORED TO WORKING VALUES
 * These were the values when bots made +$90 profit on 2026-03-20
 */
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY STRATEGIES - Working thresholds from 2026-03-20
  // Key: NO price limits, NO delta confirmation, lower edges
  // ═══════════════════════════════════════════════════════════════

  // #1 Window Delta - The best performer
  // Strong: 0.12%, Medium: 0.07% (ORIGINAL working values)
  window_delta: {
    minDelta: 0.07,         // Medium signal threshold
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
  },

  // #2 Oracle Lag (Binance Signal)
  // Just signal freshness check, NO price limits
  binance_signal: {
    signalMaxAge: 8000,
    minTimeRemaining: 3000,
  },

  // #3 T-10 Sniper
  last_seconds_scalp: {
    minDelta: 0.04,
    minTimeRemaining: 4000,
    maxTimeRemaining: 30000,
  },

  // #4 Monte Carlo
  // Lower minEdge (was 0.10, restore to 0.08)
  monte_carlo: {
    minDelta: 0.04,
    minEdge: 0.08,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  // #5 Fair Value Arb
  // CRITICAL: NO delta confirmation, NO price limits
  // minEdge 0.07 (NOT 0.10!)
  fair_value: {
    minEdge: 0.07,
    minTimeRemaining: 15000,
  },

  // #6 BTC Momentum
  // NO price limits, lower threshold
  momentum: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
  },

  // #7 Smart Trend
  smart_trend: {
    minTimeRemaining: 30000,
  },

  // #8 Contrarian
  contrarian: {
    minDelta: 0.05,
    minTimeRemaining: 30000,
  },

  // #9 Arbitrage
  arbitrage: {
    minDelta: 0.04,
    minEdge: 0.06,
    minTimeRemaining: 30000,
    maxTimeRemaining: 240000,
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGACY/DISABLED STRATEGIES
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