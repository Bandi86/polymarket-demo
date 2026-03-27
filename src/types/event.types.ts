// === Event Types ===

import type { Outcome } from "./trading.types";

export type EventType =
  | "trade"
  | "manual_trade"
  | "position_opened"
  | "position_closed"
  | "position_settled"
  | "bot_started"
  | "bot_stopped"
  | "bot_error"
  | "market_created"
  | "market_settled"
  | "price_alert"
  | "error";

export interface TradeEvent {
  id: string;
  type: EventType;
  bot?: string;
  botId?: string;
  outcome?: Outcome;
  amount?: number;
  pnl?: number;
  price?: number;
  marketId?: string;
  time: number;
  message?: string;
  metadata?: Record<string, unknown>;
}