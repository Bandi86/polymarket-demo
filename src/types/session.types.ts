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