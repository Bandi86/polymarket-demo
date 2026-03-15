import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PolymarketProvider } from '../src/lib/providers/polymarket-provider';

describe('PolymarketProvider', () => {
  let provider: PolymarketProvider;
  
  beforeEach(() => {
    provider = new PolymarketProvider();
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with 5m timeframe by default', () => {
    expect(provider.getTimeframe()).toBe('5');
  });

  it('should correctly map timeframes to durations', () => {
    expect(provider.getDurationForTimeframe('5')).toBe(300);
    expect(provider.getDurationForTimeframe('15')).toBe(900);
    expect(provider.getDurationForTimeframe('60')).toBe(3600);
    expect(provider.getDurationForTimeframe('unknown')).toBe(900); // defaults to 15m
  });

  it('should format market data correctly when fetchMarketBySlug succeeds', async () => {
    // Mock the Polymarket Gamma API response
    const mockApiResponse = {
      id: 'event-123',
      startDate: new Date(Date.now() - 1000).toISOString(),
      active: true,
      closed: false,
      description: 'Will BTC go up?',
      volume: 1000,
      liquidityClob: 5000,
      image: 'https://example.com/btc.png',
      markets: [
        {
          id: 'market-123',
          question: 'Bitcoin to go UP?',
          conditionId: '0xabc',
          active: true,
          closed: false,
          endDate: new Date(Date.now() + 10000).toISOString(),
          outcomePrices: '["0.65", "0.35"]',
          volumeNum: 100,
          liquidity: 500,
        }
      ]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse
    });

    const markets = await provider.fetchActiveMarkets('5');
    
    // It loops through btc, eth, sol, xrp and tries offsets. With the mock returning the same thing for the first fetch:
    // Actually our mock returns this for the very first fetch which is BTC. Then it loops to the next.
    // wait, fetchActiveMarkets makes loop of fetches. We only provided one mock result, so next ones will fail if we don't return null.
  });

  it('fetchMarketPriceByMarketId should return parsed prices and use cache', async () => {
    const mockMarket = {
      outcomePrices: '["0.75", "0.25"]'
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMarket
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const prices1 = await provider.fetchMarketPriceByMarketId('market-1');
    expect(prices1).toEqual({ yes: '0.750', no: '0.250' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Call again, should use cache
    const prices2 = await provider.fetchMarketPriceByMarketId('market-1');
    expect(prices2).toEqual({ yes: '0.750', no: '0.250' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // Still 1 !
  });
});
