// Core domain types for Polymarket Trading Simulator

// === Market Types ===
export interface Market {
  id: string;
  question: string;
  description: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number | null;
  status: "active" | "settled" | "paused";
  result: "UP" | "DOWN" | null;
  volumeNum: number;
  liquidity: number;
  outcomePrices: { yes: string; no: string };
  category?: string;
  resolutionSource?: string;
  imageUrl?: string;
  yesPriceHistory?: { timestamp: number; price: number }[];
  is5Min?: boolean;
  asset?: string;
  timeframe?: string;
  conditionId?: string;
  tokens?: any[];
  active?: boolean;
  closed?: boolean;
  isSimulated?: boolean;
  priceToBeat?: number;
}

export interface MarketHistory {
  id: string;
  result: "UP" | "DOWN";
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  volume: number;
}

// === Trading Types ===
export type Outcome = "YES" | "NO";

export interface Position {
  id: string;
  marketId: string;
  outcome: Outcome;
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: "open" | "closed" | "settled";
  pnl: number | null;
  botId?: string;
  currentValue?: number;
  unrealizedPnl?: number;
  exitPrice?: number;
  exitTime?: number;
}

export interface Trade {
  id: string;
  positionId: string;
  marketId: string;
  type: "buy" | "sell";
  outcome: Outcome;
  amount: number;
  price: number;
  fee: number;
  timestamp: number;
  botId?: string;
}

export interface Portfolio {
  balance: number;
  initialBalance: number;
  positions: Position[];
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  roi: number;
  openPositions: Position[];
  closedPositions: Position[];
  maxDrawdown: number;
  sharpeRatio: number;
  lastTradeTime?: number;
}

// === Order Book Types ===
export interface OrderBookEntry {
  price: number;
  size: number;
  side: "yes" | "no";
  total: number;
}

export interface OrderBook {
  yesAsks: OrderBookEntry[];
  yesBids: OrderBookEntry[];
  noAsks: OrderBookEntry[];
  noBids: OrderBookEntry[];
  spread: number;
  midPrice: number;
}

// === Price Types ===
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

// === Bot Types ===
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
  maxBet: number;
  stopLoss: number;
  takeProfit: number;
  maxPositions: number;
  stats: BotStats;
  runTime: number;
  portfolio: Portfolio;
  createdAt: number;
  updatedAt: number;
}

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
  binanceSignal?: {
    type: "UP" | "DOWN" | "NEUTRAL";
    changePercent: number;
    confidence: number;
    timestamp: number;
    predictedOutcome?: "YES" | "NO" | null;
  };
  btcPrice?: number;
  btcPriceChange?: number;
  // BTC window open price - the BTC price when the 5-min market window opened
  btcWindowOpen?: number;
  // Recent BTC price history (last 20 ticks)
  btcPriceHistory?: number[];
}

export interface Strategy {
  name: string;
  description: string;
  category: "momentum" | "mean_reversion" | "arbitrage" | "social" | "technical" | "market_making" | "trend" | "other";
  execute: (context: StrategyContext) => { action: Outcome | null; confidence: number; reason?: string };
}

// === Session Types ===
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
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// === Event Types ===
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

// === Analysis Types ===
export interface StrategyAnalysis {
  fairValue: {
    action: "BUY_YES" | "BUY_NO" | "HOLD";
    fairValue: number;
    edge: number;
    confidence: number;
  };
  anomaly: {
    action: "BUY_BOTH" | "SELL_BOTH" | "HOLD";
    sum: number;
    confidence: number;
    arbProfit: number;
  };
  momentum: {
    action: "BUY_YES" | "BUY_NO" | "HOLD";
    momentum: number;
    confidence: number;
    trend: "up" | "down" | "sideways";
  };
  volatility: {
    value: number;
    regime: "low" | "normal" | "high" | "extreme";
    forecast: number;
  };
  technical: {
    rsi: number;
    macd: number;
    signal: number;
    histogram: number;
    support: number;
    resistance: number;
  };
  marketPrice: {
    yesPrice: number;
    noPrice: number;
    spread: number;
    imbalance: number;
  };
  recommendation: {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    confidence: number;
    reasons: string[];
  };
}

export interface BacktestResult {
  strategy: StrategyType;
  startDate: number;
  endDate: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
  equityCurve: { timestamp: number; value: number }[];
}

// === API Types ===
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

// === Settings Types ===
export interface UserSettings {
  defaultBetSize: number;
  autoRefreshInterval: number;
  enableSoundEffects: boolean;
  enableNotifications: boolean;
  theme: "dark" | "light" | "system";
  riskSettings: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxOpenPositions: number;
  };
}

export interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  simulationMode: SimulationConfig["mode"];
  lastUpdated: number;
}
