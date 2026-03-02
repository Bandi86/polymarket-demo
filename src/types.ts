export interface Market {
  id: string;
  question: string;
  description: string;
  volumeNum: number;
  liquidity: number;
  outcomes: string[];
  endDate: string;
  state: 'active' | 'closed' | 'resolved';
  outcomePrices?: { [key: string]: string };
  groupItemId?: string;
}

export interface MarketPrice {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  timestamp: number;
}

export interface Position {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  amount: number;
  odds: number;
  timestamp: number;
  status: 'open' | 'closed' | 'settled';
  pnl?: number;
  settlementPrice?: number;
  fee?: number;
  stake?: number;
}

export interface BotConfig {
  id: string;
  name: string;
  type: 'random' | 'momentum' | 'mean_reversion' | 'signal' | 'smart_trend' | 'contrarian' | 'volatility';
  enabled: boolean;
  betSize: number;
  interval: number;
  useKelly?: boolean;
  kellyFraction?: number;
  maxBet?: number;
  lastRun?: number;
  stats?: {
    winRate: number;
  };
}

export interface BotStats {
  botId: string;
  totalTrades: number;
  winningTrades: number;
  totalPnL: number;
  winRate: number;
}

export interface Portfolio {
  balance: number;
  positions: Position[];
  totalPnL: number;
  winRate: number;
  roi: number;
  initialBalance: number;
}

export interface TradeRequest {
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: number;
}

export interface TradeResponse {
  success: boolean;
  position?: Position;
  error?: string;
}
