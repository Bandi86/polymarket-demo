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