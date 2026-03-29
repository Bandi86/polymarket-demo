// === Provider Types ===

// Full PolymarketEvent from Gamma API
export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  resolutionSource: string;
  startDate: string;
  endDate: string;
  image: string;
  active: boolean;
  closed: boolean;
  volume: number;
  liquidityClob: number;
  markets: PolymarketMarket[];
  eventMetadata?: {
    priceToBeat?: number;
  };
}

// Individual market within an event
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  image: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volumeNum: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  tokens?: { token_id: string; outcome: string }[];
  clobTokenIds?: string;
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price?: number;
  winner?: boolean;
}

export interface PolymarketOrder {
  id: string;
  market: string;
  side: string;
  size: string;
  price: string;
  status: string;
  created_at: string;
}

export interface PolymarketPosition {
  market: string;
  outcome: string;
  size: string;
  avgPrice: string;
  currentPrice: string;
  pnl: string;
}

// API Response types
export interface PolymarketBalanceResponse {
  currency?: string;
  asset?: string;
  symbol?: string;
  balance?: string;
  amount?: string;
  available?: string;
  locked?: string;
}

export interface PolymarketPositionResponse {
  market?: string;
  condition_id?: string;
  outcome?: string;
  size?: string;
  shares?: string;
  avg_price?: string;
  entryPrice?: string;
  current_value?: string;
}

export interface PolymarketTradeResponse {
  id?: string;
  transaction_hash?: string;
  market?: string;
  condition_id?: string;
  outcome?: string;
  side?: string;
  size?: string;
  shares?: string;
  price?: string;
  avg_price?: string;
  timestamp?: string;
  created_at?: string;
}