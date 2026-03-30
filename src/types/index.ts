// Core domain types for Polymarket Trading Simulator
// Barrel file - re-exports all types for convenience

// Market Types
export type { Market, MarketHistory, MarketToken } from "./market.types";

// Trading Types
export type { Outcome, Position, Trade, Portfolio } from "./trading.types";

// Order Book Types
export type { OrderBookEntry, OrderBook } from "./order-book.types";

// Price Types
export type {
  PricePoint,
  PriceUpdate,
  PriceProvider,
  StrategyContext,
} from "./price.types";

// Bot Types
export type {
  StrategyType,
  BotStats,
  BotConfig,
  Strategy,
} from "./bot.types";

// Session Types
export type { BotLog, BotSession, DecisionContext, RiskMetrics, SessionLog } from "./session.types";

// Event Types
export type { EventType, TradeEvent } from "./event.types";

// Analysis Types
export type { StrategyAnalysis, BacktestResult } from "./analysis.types";

// API Types
export type {
  ApiResponse,
  MarketState,
  TradeRequest,
  SimulationConfig,
} from "./api.types";

// Settings Types
export type { UserSettings, AppState } from "./settings.types";

// Trading Mode & Risk Types
export type {
  TradingMode,
  Account,
  RiskSettings,
  BotRiskProfile,
  TradingSession,
  TradeRule,
} from "./trading-mode.types";
export { DEFAULT_RISK_SETTINGS } from "./trading-mode.types";

// Provider Types
export type {
  PolymarketEvent,
  PolymarketToken,
  PolymarketMarket,
  PolymarketOrder,
  PolymarketPosition,
} from "./provider.types";