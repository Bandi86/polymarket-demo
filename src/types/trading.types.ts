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