import type { Market, MarketPrice } from './types';

const POLYMARKET_GRAPHQL = 'https://clob.polymarket.com/graphql';
const POLYMARKET_PRICES = 'https://clob.polymarket.com/markets';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface MarketsResponse {
  markets: Array<{
    id: string;
    question: string;
    description: string;
    volumeNum: string;
    liquidity: string;
    outcomes: string[];
    endDate: string;
    state: string;
    groupItemId?: string;
  }>;
  marketsCursor?: string;
}

interface PriceResponse {
  market: string;
  outcomes: Array<{
    outcome: string;
    price: string;
  }>;
}

export async function fetchMarkets(cursor?: string): Promise<{ markets: Market[]; cursor?: string }> {
  const query = `
    query GetMarkets($cursor: String) {
      markets(first: 20, orderBy: "volumeNum", orderDirection: "desc", cursor: $cursor) {
        id
        question
        description
        volumeNum
        liquidity
        outcomes
        endDateTimestamp
        state
        groupItemId
      }
    }
  `;

  try {
    const response = await fetch(POLYMARKET_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    const result: GraphQLResponse<MarketsResponse> = await response.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    const markets = (result.data?.markets || []).map((m) => ({
      id: m.id,
      question: m.question,
      description: m.description || '',
      volumeNum: parseFloat(m.volumeNum) || 0,
      liquidity: parseFloat(m.liquidity) || 0,
      outcomes: m.outcomes || ['YES', 'NO'],
      endDate: m.endDateTimestamp || '',
      state: m.state as 'active' | 'closed' | 'resolved',
      groupItemId: m.groupItemId,
    }));

    return { markets, cursor: result.data?.marketsCursor };
  } catch (error) {
    console.error('Failed to fetch markets:', error);
    return { markets: [], cursor: undefined };
  }
}

export async function fetchMarketPrices(marketId: string): Promise<MarketPrice | null> {
  try {
    const response = await fetch(`${POLYMARKET_PRICES}/${marketId}/prices`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const data: PriceResponse = await response.json();
    
    const yesPrice = data.outcomes?.find(
      (o) => o.outcome.toLowerCase() === 'yes'
    )?.price || '0.50';
    
    const noPrice = data.outcomes?.find(
      (o) => o.outcome.toLowerCase() === 'no'
    )?.price || '0.50';

    return {
      marketId,
      yesPrice: parseFloat(yesPrice),
      noPrice: parseFloat(noPrice),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return null;
  }
}

export async function fetchMultipleMarketPrices(marketIds: string[]): Promise<Map<string, MarketPrice>> {
  const prices = new Map<string, MarketPrice>();
  
  const promises = marketIds.map(async (id) => {
    const price = await fetchMarketPrices(id);
    if (price) {
      prices.set(id, price);
    }
  });

  await Promise.all(promises);
  return prices;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toFixed(2);
}
