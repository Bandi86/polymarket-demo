// Strategies module - exports all trading strategies
// Phase 1 refactor: Split strategies into separate files with configurable thresholds

import {
  windowDeltaStrategy,
  fairValueStrategy,
  oracleLagStrategy,
  t10SniperStrategy,
  monteCarloStrategy,
  momentumStrategy,
  smartTrendStrategy,
  contrarianStrategy,
  arbitrageStrategy,
} from "./strategies";

// Legacy disabled strategies from all-strategies.ts
import { strategies as legacyStrategies } from "./all-strategies";

// Export merged strategies - split ones override legacy
export const strategies = {
  // PRIMARY STRATEGIES - Split with configurable thresholds
  window_delta: windowDeltaStrategy,
  fair_value: fairValueStrategy,
  binance_signal: oracleLagStrategy,
  last_seconds_scalp: t10SniperStrategy,
  monte_carlo: monteCarloStrategy,
  momentum: momentumStrategy,
  smart_trend: smartTrendStrategy,
  contrarian: contrarianStrategy,
  arbitrage: arbitrageStrategy,

  // LEGACY DISABLED STRATEGIES - Kept for reference
  mean_reversion: legacyStrategies.mean_reversion,
  trend: legacyStrategies.trend,
  volatility: legacyStrategies.volatility,
  anomaly: legacyStrategies.anomaly,
  momentum_burst: legacyStrategies.momentum_burst,
  grid_trading: legacyStrategies.grid_trading,
  market_making: legacyStrategies.market_making,
  random: legacyStrategies.random,
};

// Export config and types
export { strategyConfig } from "./config";
export type { StrategyThresholds, StrategyDecision } from "./types";

// Export debug log from legacy
export { debugLog } from "./all-strategies";