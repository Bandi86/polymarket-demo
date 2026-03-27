// === Provider Types ===

import type { Market } from "./market.types";

export interface PolymarketEvent {
  conditionId: string;
  questionId: string;
  question: string;
  description: string;
  marketSlug: string;
  endDate: string;
  liquidity: number;
  volume: number;
  active: boolean;
  closed: boolean;
  imageUrl?: string;
  tokens?: PolymarketToken[];
}

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketMarket {
  conditionId: string;
  questionId: string;
  question: string;
  slug: string;
  endDate: string;
  outcomes: string[];
  outcomePrices: string[];
  active: boolean;
  closed: boolean;
  volume: string;
  liquidity: string;
  imageUrl?: string;
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

// Helper function to convert PolymarketEvent to Market
export function polymarketEventToMarket(event: PolymarketEvent, simulated?: boolean): Partial<Market> {
  return {
    id: event.conditionId,
    question: event.question,
    description: event.description,
    conditionId: event.conditionId,
    liquidity: event.liquidity,
    volumeNum: event.volume,
    active: event.active,
    closed: event.closed,
    imageUrl: event.imageUrl,
    tokens: event.tokens,
    isSimulated: simulated,
  };
}