// === Bot Types ===

import type { Outcome } from "./trading.types";
import type { Portfolio } from "./trading.types";
import type { StrategyContext } from "./price.types";

export type StrategyType =
  | "window_delta"
  | "last_seconds_scalp"
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
  type: string;
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