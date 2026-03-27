// === Market Types ===

export interface MarketToken {
  token_id: string;
  outcome: string;
  price?: number;
  winner?: boolean;
}

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
  tokens?: MarketToken[];
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