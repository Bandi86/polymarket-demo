import type { Market } from "../../types";

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

const GAMMA_API = "https://gamma-api.polymarket.com";

// Map timeframe to duration in seconds
const TIMEFRAME_DURATIONS: Record<string, number> = {
  "5": 300,      // 5 minutes
  "15": 900,     // 15 minutes
  "60": 3600,    // 1 hour
  "240": 14400,  // 4 hours
  "D": 86400,    // 1 day
};

export class PolymarketProvider {
  private cachedMarkets: Map<string, Market[]> = new Map();
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 1000; // 1s cache for live markets
  private currentTimeframe = "5"; // Default to 5m

  // Price cache for faster updates
  private priceCache: Map<string, { yes: string; no: string; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 100; // 100ms cache for near-real-time prices
  
  // Market metadata (tokens, etc.) that don't change
  private marketMetadataCache: Map<string, { tokens: any[] }> = new Map();

  /**
   * Parse clobTokenIds string into tokens array format.
   * The clobTokenIds field contains a JSON string like '["token1", "token2"]'
   * We need to map them to the outcomes from the market.
   */
  private parseClobTokenIds(clobTokenIds: string | undefined): { token_id: string; outcome: string }[] | null {
    if (!clobTokenIds) return null;
    try {
      const ids = JSON.parse(clobTokenIds);
      if (!Array.isArray(ids) || ids.length < 2) return null;
      // Assume first token is UP/YES, second is DOWN/NO for up/down markets
      return [
        { token_id: ids[0], outcome: "Up" },
        { token_id: ids[1], outcome: "Down" }
      ];
    } catch {
      return null;
    }
  }

  /** Set BTC price for display (used by price service) */
  setBtcPrice(_price: number): void {
    // Kept for compatibility with price service
  }

  /** Enable/disable simulation mode (kept for API compatibility) */
  setSimulationMode(_enabled: boolean): void {
    // No-op - we always use real markets now
  }

  /** Set the current timeframe for market selection */
  setTimeframe(timeframe: string): void {
    this.currentTimeframe = timeframe;
  }

  /** Get the current timeframe */
  getTimeframe(): string {
    return this.currentTimeframe;
  }

  /**
   * Get the duration in seconds for a timeframe
   */
  getDurationForTimeframe(timeframe: string): number {
    return TIMEFRAME_DURATIONS[timeframe] || 900; // Default to 15m
  }

  /**
   * Discover live up/down markets for the specified timeframe.
   * Supports 5m, 15m, 1h, 4h, 1d markets.
   */
  async fetchActiveMarkets(timeframe?: string): Promise<Market[]> {
    const tf = timeframe || this.currentTimeframe;
    const now = Date.now();

    // Check cache
    const cached = this.cachedMarkets.get(tf);
    if (cached && cached.length > 0 && now - this.lastFetchTime < this.CACHE_TTL) {
      return cached;
    }

    const duration = this.getDurationForTimeframe(tf);

    try {
      const currentTimeSec = Math.floor(now / 1000);
      const roundedTime = Math.floor(currentTimeSec / duration) * duration;

      const markets: Market[] = [];

      // Parallel discovery for all assets
      const assets = ["btc", "eth", "sol", "xrp"];
      const marketPromises = assets.map(async (asset) => {
        // Parallel check for current and previous offsets (0-3)
        const offsets = [0, 1, 2, 3];
        const offsetPromises = offsets.map(async (offset) => {
          const tryTime = roundedTime - offset * duration;
          const slug = `${asset}-updown-${
            tf === "D" ? "1d" : tf === "240" ? "4h" : tf === "60" ? "1h" : tf === "15" ? "15m" : "5m"
          }-${tryTime}`;

          return this.fetchMarketBySlug(slug, asset.toUpperCase(), tf);
        });

        const offsetResults = await Promise.all(offsetPromises);
        // Return soonest expiration or first active
        return offsetResults.find((m) => m && m.active && !m.closed) || null;
      });

      const results = await Promise.all(marketPromises);
      const marketsArray = results.filter((m): m is Market => m !== null);

      // Sort by time remaining (soonest first)
      marketsArray.sort((a, b) => a.endTime - b.endTime);

      this.cachedMarkets.set(tf, marketsArray);
      this.lastFetchTime = now;

      console.log(`[PolymarketProvider] Found ${marketsArray.length} live up/down markets for ${tf} timeframe`);
      if (marketsArray.length > 0) {
        const top = marketsArray[0];
        const remaining = Math.floor((top.endTime - now) / 1000);
        console.log(`[PolymarketProvider] Top: "${top.question}" YES=${top.outcomePrices.yes} Remaining: ${remaining}s`);
      }

      return marketsArray;
    } catch (error) {
      console.error("[PolymarketProvider] Fetch error:", error);
      return this.cachedMarkets.get(tf) || [];
    }
  }

  /**
   * Legacy method for backward compatibility - fetches BTC markets
   */
  async fetchActiveBitcoinMarkets(): Promise<Market[]> {
    return this.fetchActiveMarkets("15"); // Default to 15m
  }

  /**
   * Fetch market by slug using the events/slug endpoint.
   */
  private async fetchMarketBySlug(slug: string, asset: string, timeframe: string): Promise<Market | null> {
    try {
      const response = await fetch(`${GAMMA_API}/events/slug/${slug}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const event: PolymarketEvent = await response.json();

      // Check if event is active
      if (!event.active || event.closed) return null;

      if (!event.markets || event.markets.length === 0) return null;

      const market = event.markets[0];

      // Check if market is active
      if (!market.active || market.closed) return null;

      // Parse end time and check if market hasn't expired
      const endTime = new Date(market.endDate).getTime();
      if (endTime < Date.now()) return null;

      // Parse outcome prices
      let outcomePrices: string[] = ["0.5", "0.5"];
      if (market.outcomePrices) {
        try {
          outcomePrices = JSON.parse(market.outcomePrices);
        } catch {}
      }

      const upPrice = parseFloat(outcomePrices[0] || "0.5");
      const downPrice = parseFloat(outcomePrices[1] || "0.5");

      // Calculate startTime from endTime and duration for accurate market duration
      // The event.startDate is when the event series started, not the current market window
      const durationMs = (TIMEFRAME_DURATIONS[timeframe] || 300) * 1000;
      const startTime = endTime - durationMs;

      const category = `${asset} ${timeframe}`;

      const result: Market = {
        id: market.id,
        question: market.question,
        description: market.description || event.description,
        startTime,
        endTime,
        startPrice: upPrice,
        endPrice: null,
        status: "active",
        result: null,
        volumeNum: market.volumeNum || event.volume,
        liquidity: market.liquidity || event.liquidityClob || 0,
        outcomePrices: {
          yes: upPrice.toFixed(3),
          no: downPrice.toFixed(3),
        },
        category,
        resolutionSource: event.resolutionSource || "Polymarket",
        imageUrl: market.image || event.image,
        priceToBeat: event.eventMetadata?.priceToBeat,
      };

      // Store additional properties for internal use
      result.is5Min = timeframe === "5";
      result.isSimulated = false;
      result.active = true;
      result.closed = false;
      result.conditionId = market.conditionId;
      result.tokens = this.parseClobTokenIds(market.clobTokenIds) || market.tokens;
      result.timeframe = timeframe;
      result.asset = asset;

      return result;
    } catch (error) {
      console.error(`[PolymarketProvider] Error fetching slug ${slug}:`, error);
      return null;
    }
  }

  /**
   * Fetch current YES/NO prices for a specific market by its market ID.
   * Uses a short cache to avoid spamming the API while still being responsive.
   */
  async fetchMarketPriceByMarketId(marketId: string, tokens?: { token_id: string; outcome: string }[]): Promise<{ yes: string; no: string } | null> {
    const now = Date.now();

    // Check cache first - return cached price if fresh
    const cached = this.priceCache.get(marketId);
    if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
      return { yes: cached.yes, no: cached.no };
    }

    try {
      let currentTokens = tokens;
      
      // Check metadata cache if tokens passed in are empty
      if (!currentTokens || currentTokens.length === 0) {
        currentTokens = this.marketMetadataCache.get(marketId)?.tokens;
      }
      
      // Strategy 1: Fast CLOB Midpoint API (if tokens available)
      if (currentTokens && currentTokens.length >= 1) {
        const yesToken = currentTokens.find(t => 
          t.outcome.toLowerCase() === 'yes' || 
          t.outcome === 'Long' || 
          t.outcome.toLowerCase().includes('up')
        );
        if (yesToken) {
          try {
            const clobResponse = await fetch(`https://clob.polymarket.com/midpoint?token_id=${yesToken.token_id}`, {
              signal: AbortSignal.timeout(800),
            });
            if (clobResponse.ok) {
              const data = await clobResponse.json();
              const yesPrice = parseFloat(data.mid);
              if (!isNaN(yesPrice) && yesPrice > 0 && yesPrice < 1) {
                const result = {
                  yes: yesPrice.toFixed(3),
                  no: (1 - yesPrice).toFixed(3),
                };
                this.priceCache.set(marketId, { ...result, timestamp: now });
                return result;
              }
            }
          } catch (e) {
            // Fall through
          }
        }
      }

      // Strategy 2: Gamma API
      const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
        signal: AbortSignal.timeout(1000),
      });

      if (!response.ok) return cached || null;

      const market = await response.json();
      
      // Update tokens for future CLOB calls if they were missing
      if (!currentTokens && market.tokens) {
        currentTokens = market.tokens;
      }

      let prices = { yes: "0.500", no: "0.500" };

      if (market.outcomePrices) {
        const parsed = JSON.parse(market.outcomePrices);
        
        // Cache tokens for future CLOB strategy
        if (market.tokens && market.tokens.length > 0) {
          this.marketMetadataCache.set(marketId, { tokens: market.tokens });
        }

        // Find which index is YES. Usually index 0.
        let yesIndex = 0;
        const tokensToUse = market.tokens || (currentTokens?.length ? currentTokens : []);
        if (tokensToUse.length > 0) {
          const foundIndex = tokensToUse.findIndex((t: any) => 
            t.outcome.toLowerCase() === 'yes' || 
            t.outcome === 'Long' || 
            t.outcome.toLowerCase().includes('up')
          );
          if (foundIndex !== -1) yesIndex = foundIndex;
        }
        
        const yesPrice = parseFloat(parsed[yesIndex] || "0.5");
        const noPrice = parseFloat(parsed[1 - yesIndex] || "0.5");
        
        prices = {
          yes: yesPrice.toFixed(3),
          no: noPrice.toFixed(3)
        };
      }

      const result = {
        ...prices,
        // We could also return the updated tokens here if we wanted to update the engine
      };

      this.priceCache.set(marketId, { ...result, timestamp: now });
      return result;
    } catch (error) {
      if (cached) return { yes: cached.yes, no: cached.no };
      return null;
    }
  }

  /**
   * Fetch all available crypto markets for the market selector UI.
   */
  async fetchAllCryptoMarkets(timeframe?: string): Promise<Market[]> {
    return this.fetchActiveMarkets(timeframe);
  }

  /** Clear cache to force refresh */
  clearCache(): void {
    this.cachedMarkets.clear();
    this.priceCache.clear();
    this.marketMetadataCache.clear();
    this.lastFetchTime = 0;
  }

  /** Get available timeframes */
  getAvailableTimeframes(): string[] {
    return Object.keys(TIMEFRAME_DURATIONS);
  }
}

export const polymarketProvider = new PolymarketProvider();
