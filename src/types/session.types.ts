// === Session & Log Types ===

import type { StrategyType } from "./bot.types";

export interface BotSession {
  id: string;
  botId: string;
  botName: string;
  strategy: StrategyType;
  startTime: number;
  endTime: number | null;
  startBalance: number;
  endBalance: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  status: "running" | "completed" | "paused";
  metadata?: Record<string, unknown>;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD" | "SETTLED";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface DecisionContext {
  // Strategy decision
  strategy: string;
  action: "YES" | "NO";
  confidence: number;
  reason: string;

  // Market state at decision time
  yesPrice: number;
  noPrice: number;
  btcPrice: number;
  btcDelta: number;
  timeRemaining: number;
  marketDuration: number;

  // Strategy-specific signals
  binanceSignal?: {
    type: "bullish" | "bearish";
    changePercent: number;
    confidence: number;
    age: number;
  };
  windowDelta?: number;
  edge?: number;

  // Thresholds used
  thresholdsUsed: Record<string, number>;

  // Risk checks
  riskChecksPassed: boolean;
  kellyFractionUsed?: number;
  coordinationChecks?: string;

  // Bet sizing
  rawBetSize: number;
  finalBetSize: number;
  balanceAtDecision: number;
}

export interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface SessionLog {
  id: string;
  sessionId: string;
  botId: string;
  type: string;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: number;
}