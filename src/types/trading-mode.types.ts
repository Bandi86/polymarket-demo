// === Trading Mode & Risk Types ===

export type TradingMode = "demo" | "live";

export interface Account {
  id: string;
  mode: TradingMode;
  name: string;
  // Demo settings
  balance: number;
  initialBalance: number;
  // Live settings (Polymarket)
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  walletAddress?: string;
  // Status
  isConnected: boolean;
  lastSync?: number;
}

export interface RiskSettings {
  // Position sizing
  maxPositionSizePercent: number;    // Max % of portfolio per trade (default: 5%)
  minPositionSizePercent: number;    // Min % (default: 0.5%)
  kellyFraction: number;             // Kelly criterion multiplier (default: 0.25)

  // Risk limits
  maxDailyLossPercent: number;       // Max daily loss % (default: 5%)
  maxDrawdownPercent: number;        // Max drawdown % (default: 20%)
  maxOpenPositions: number;          // Max parallel positions (default: 3)

  // Auto-adjustment
  autoReduceOnLoss: boolean;         // Reduce bet size after losses
  autoIncreaseOnWin: boolean;        // Increase bet size after wins
  consecutiveLossThreshold: number;  // Stop after X consecutive losses
  winStreakToIncrease: number;       // Win streak needed to increase bet

  // Circuit breaker
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;   // Stop trading after X consecutive losses
}

export interface BotRiskProfile {
  botId: string;
  maxBet: number;
  kellyEnabled: boolean;
  kellyFraction: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export interface TradingSession {
  id: string;
  mode: TradingMode;
  accountId: string;
  startTime: number;
  endTime?: number;
  startBalance: number;
  endBalance?: number;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  status: "active" | "paused" | "completed" | "stopped";
}

export interface TradeRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: "always" | "on_loss" | "on_win" | "on_drawdown" | "on_streak";
  action: "increase_bet" | "decrease_bet" | "stop_trading" | "switch_strategy";
  value: number;
  description: string;
}

// Default risk settings
export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  maxPositionSizePercent: 5,
  minPositionSizePercent: 0.5,
  kellyFraction: 0.25,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 20,
  maxOpenPositions: 3,
  autoReduceOnLoss: true,
  autoIncreaseOnWin: true,
  consecutiveLossThreshold: 5,
  winStreakToIncrease: 3,
  circuitBreakerEnabled: true,
  circuitBreakerThreshold: 7,
};