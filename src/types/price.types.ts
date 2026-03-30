// === Price Types ===

import type { OrderBook } from "./order-book.types";

export interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}

export interface PriceUpdate {
  price: number;
  timestamp: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface PriceProvider {
  name: string;
  fetchPrice(): Promise<PriceUpdate | null>;
  subscribe?(callback: (update: PriceUpdate) => void): () => void;
  destroy?(): void;
}

export interface BinanceSignal {
  type: "UP" | "DOWN" | "NEUTRAL";
  changePercent: number;
  confidence: number;
  timestamp: number;
  predictedOutcome?: "YES" | "NO" | null;
}

export interface StrategyContext {
  currentPrice: number;
  startPrice: number;
  priceHistory: number[];
  timeRemaining: number;
  marketDuration: number;
  marketPrice: {
    yesPrice: number;
    noPrice: number;
  };
  volatility: number;
  momentum: number;
  orderBook?: OrderBook;
  // Binance signal data for predictive strategies
  binanceSignal?: BinanceSignal;
  btcPrice?: number;
  btcPriceChange?: number;
  // BTC window open price - the BTC price when the 5-min market window opened
  btcWindowOpen?: number;
  // Recent BTC price history (last 20 ticks)
  btcPriceHistory?: number[];
}