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