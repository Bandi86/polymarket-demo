// === Bot Types ===

import type { Outcome } from "./trading.types";
import type { Portfolio } from "./trading.types";
import type { StrategyContext } from "./price.types";

export type StrategyType =
  // === NEW STRATEGIES (Option A - Change the Game) ===
  | "volatility_breakout"   // Trade when BTC volatility is extreme
  | "ultra_low_entry"       // Andrew's approach: Entry at 4-15¢ (market underestimates)
  | "trend_pullback"        // Trade pullbacks during strong BTC trends
  | "price_reversion"       // Bet on Polymarket price mean-reversion
  | "binance_velocity"      // Use BTC velocity/acceleration
  | "sniper_value"          // Extreme price sniper (10-15¢ YES, 40-50¢+ NO)
  | "bayesian_ev"           // Bayesian probability + EV filter + Kelly sizing
  // === LEGACY STRATEGIES (kept for backward compatibility) ===
  | "window_delta"
  | "last_seconds_scalp"
  | "odds_swing"
  // === LEGACY STRATEGIES (kept for backward compatibility) ===
  | "window_delta"
  | "binance_signal"
  | "monte_carlo"
  | "fair_value"
  | "momentum"
  | "mean_reversion"
  | "trend"
  | "smart_trend"
  | "contrarian"
  | "volatility"
  | "anomaly"
  | "momentum_burst"
  | "grid_trading"
  | "market_making"
  | "arbitrage"
  | "random";

export interface BotStats {
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  lastTradeTime?: number;
}

export interface BotConfig {
  id: string;
  name: string;
  strategy: StrategyType;
  enabled: boolean;
  interval: number;
  betSize: number;
  useKelly: boolean;
  kellyFraction: number;
  maxBet: number; // Percentage of bankroll (0.25 = 25% max bet)
  stopLoss: number;
  takeProfit: number;
  maxPositions: number;
  stats: BotStats;
  runTime: number;
  portfolio: Portfolio;
  createdAt: number;
  updatedAt: number;
}

export interface Strategy {
  name: string;
  description: string;
  category: "momentum" | "mean_reversion" | "arbitrage" | "social" | "technical" | "market_making" | "trend" | "other";
  execute: (context: StrategyContext) => { action: Outcome | null; confidence: number; reason?: string };
}