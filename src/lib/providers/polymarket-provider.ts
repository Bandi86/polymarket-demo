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
  private readonly CACHE_TTL = 5_000; // 5s cache for live markets
  private currentTimeframe = "15"; // Default to 15m

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

      // Try to find markets for each asset
      const assets = ["btc", "eth", "sol", "xrp"];

      for (const asset of assets) {
        // Try current period and previous periods
        for (let offset = 0; offset <= 3; offset++) {
          const tryTime = roundedTime - (offset * duration);
          const slug = `${asset}-updown-${tf === "D" ? "1d" : tf === "240" ? "4h" : tf === "60" ? "1h" : tf === "15" ? "15m" : "5m"}-${tryTime}`;

          const market = await this.fetchMarketBySlug(slug, asset.toUpperCase(), tf);
          if (market && (market as any).active && !(market as any).closed) {
            console.log(`[PolymarketProvider] Found live ${asset.toUpperCase()} ${tf} market: ${slug}`);
            markets.push(market);
            break; // Found one for this asset, move to next
          }
        }
      }

      // Sort by time remaining (soonest first)
      markets.sort((a, b) => a.endTime - b.endTime);

      this.cachedMarkets.set(tf, markets);
      this.lastFetchTime = now;

      console.log(`[PolymarketProvider] Found ${markets.length} live up/down markets for ${tf} timeframe`);
      if (markets.length > 0) {
        const top = markets[0];
        const remaining = Math.floor((top.endTime - now) / 1000);
        console.log(`[PolymarketProvider] Top: "${top.question}" YES=${top.outcomePrices.yes} Remaining: ${remaining}s`);
      }

      return markets;
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
      const startTime = new Date(event.startDate || Date.now()).getTime();

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
      };

      // Store additional properties for internal use
      (result as any).is5Min = timeframe === "5";
      (result as any).isSimulated = false;
      (result as any).active = true;
      (result as any).closed = false;
      (result as any).conditionId = market.conditionId;
      (result as any).tokens = market.tokens;
      (result as any).timeframe = timeframe;
      (result as any).asset = asset;

      return result;
    } catch (error) {
      console.error(`[PolymarketProvider] Error fetching slug ${slug}:`, error);
      return null;
    }
  }

  /**
   * Fetch current YES/NO prices for a specific market by its market ID.
   */
  async fetchMarketPriceByMarketId(marketId: string): Promise<{ yes: string; no: string } | null> {
    try {
      const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;
      const market = await response.json();

      let prices: number[] = [0.5, 0.5];

      if (market.outcomePrices) {
        const parsed = JSON.parse(market.outcomePrices);
        prices = [parseFloat(parsed[0] || "0.5"), parseFloat(parsed[1] || "0.5")];
      } else if (market.bestAsk !== undefined) {
        prices = [market.bestAsk || 0.5, 1 - (market.bestAsk || 0.5)];
      }

      return {
        yes: prices[0].toFixed(3),
        no: prices[1].toFixed(3),
      };
    } catch {
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
    this.lastFetchTime = 0;
  }

  /** Get available timeframes */
  getAvailableTimeframes(): string[] {
    return Object.keys(TIMEFRAME_DURATIONS);
  }
}

export const polymarketProvider = new PolymarketProvider();
