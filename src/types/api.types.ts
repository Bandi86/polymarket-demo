// === API Types ===

import type { Market, OrderBook, Outcome, PricePoint } from "./index";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: number;
    requestId: string;
  };
}

export interface MarketState {
  market: Market | null;
  btcPrice: number;
  priceHistory: PricePoint[];
  yesPriceHistory?: { timestamp: number; price: number }[];
  btcPriceHistory: number[];
  timeRemaining: number;
  marketDuration: number;
  startedAt: number;
  orderBook: OrderBook | null;
}

export interface TradeRequest {
  marketId: string;
  outcome: Outcome;
  amount: number;
  botId?: string;
}

export interface SimulationConfig {
  mode: "real" | "simulated" | "backtest";
  startingBalance: number;
  speedMultiplier?: number;
  dataSource?: "binance" | "polymarket" | "mock";
}