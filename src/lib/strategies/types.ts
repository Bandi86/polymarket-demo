// Strategy Types - Configurable thresholds and decision types
// Part of strategy refactor for modular, tunable strategies

import type { Outcome } from "../../types";

/**
 * Configurable thresholds for strategy execution
 * All values are optional - strategies use defaults if not specified
 */
export interface StrategyThresholds {
  minDelta?: number;        // Minimum BTC delta % (e.g., 0.07 = 0.07%)
  minEdge?: number;         // Minimum edge for arb strategies (0-1 scale)
  minConfidence?: number;   // Minimum confidence to trade (0-1 scale)
  minPrice?: number;        // Minimum price to buy (0-1 scale, e.g., 0.30 = 30¢)
  maxPrice?: number;        // Maximum price to buy (0-1 scale, e.g., 0.70 = 70¢)
  minTimeRemaining?: number; // Min time before market close (ms)
  maxTimeRemaining?: number; // Max time from market start (ms)
  signalMaxAge?: number;    // Max signal age for oracle strategies (ms)
  // Odds range filters - CRITICAL for profitability
  minOdds?: number;         // Minimum odds to enter trade (0-1 scale)
  maxOdds?: number;         // Maximum odds to enter trade (0-1 scale)
  avoidMiddle?: boolean;    // Avoid 40-60¢ "fair value" zone (default: true)

  // === NEW THRESHOLDS for Option A strategies ===
  // volatility_breakout
  minHighVolatility?: number;  // High vol threshold (e.g., 0.003 = 0.3%)
  maxLowVolatility?: number;   // Low vol threshold (e.g., 0.001 = 0.1%)
  breakoutDelta?: number;      // Delta needed for low-vol breakout

  // time_pattern
  avoidWeekend?: boolean;      // Skip trading on weekends

  // price_reversion
  oversoldYes?: number;        // Buy YES when price below this (e.g., 0.25)
  overboughtYes?: number;      // Buy NO when price above this (e.g., 0.75)

  // binance_velocity
  minVelocity?: number;        // Minimum BTC velocity to trade
  minAcceleration?: number;    // Minimum acceleration for stronger signal

  // sniper_value
  yesBuyMax?: number;          // Buy YES if price below this (default 0.15)
  noBuyMin?: number;           // Buy NO if YES price above this (default 0.40)

  // ultra_low_entry
  ultraLowMax?: number;        // Ultra-low zone max (e.g., 0.12 = 12¢)
  lowEntryMax?: number;         // Low entry zone max (e.g., 0.25 = 25¢)
  overvaluedMin?: number;      // Overvalued zone min (e.g., 0.85 = 85¢)

  // Fallback configuration (price_reversion, sniper_value, ultra_low_entry)
  fallbackEnabled?: boolean;   // Enable BTC momentum fallback in middle zone
  fallbackMinDelta?: number;   // Minimum BTC delta for fallback trades

  // Position management - TP/SL for short-term strategies
  supportsPositionManagement?: boolean;  // Enable TP/SL for this strategy
  takeProfitThreshold?: number;           // TP threshold (e.g., 0.25 = 25%)
  stopLossThreshold?: number;             // SL threshold (e.g., -0.30 = -30%)

  // bayesian_ev
  minEv?: number;           // Minimum Expected Value to enter (e.g., 0.08 = 8%)
  skipEv?: number;         // Skip if EV below this (e.g., 0.02 = 2%)
}

/**
 * Standardized decision output from strategy execution
 */
export interface StrategyDecision {
  action: Outcome | null;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
}

/**
 * Full configuration for a strategy
 */
export interface StrategyConfig {
  thresholds: StrategyThresholds;
  description: string;
  category: "momentum" | "arbitrage" | "trend" | "mean_reversion" | "other";
}