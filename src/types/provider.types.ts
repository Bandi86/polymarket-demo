// === Provider Types ===

import type { Market } from "./market.types";

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