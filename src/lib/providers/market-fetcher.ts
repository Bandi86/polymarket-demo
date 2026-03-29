// Polymarket Market Fetcher
// Handles market discovery and price fetching

import type { Market } from "../../types";
import type { PolymarketEvent, PolymarketMarket, PolymarketToken } from "../../types/provider.types";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

// Map timeframe to duration in seconds
export const TIMEFRAME_DURATIONS: Record<string, number> = {
  "5": 300,      // 5 minutes
  "15": 900,     // 15 minutes
  "60": 3600,    // 1 hour
  "240": 14400,  // 4 hours
  "D": 86400,    // 1 day
};

/**
 * Parse clobTokenIds string into tokens array format.
 */
export function parseClobTokenIds(clobTokenIds: string | undefined): { token_id: string; outcome: string }[] | null {
  if (!clobTokenIds) return null;
  try {
    const ids = JSON.parse(clobTokenIds);
    if (!Array.isArray(ids) || ids.length < 2) return null;
    return [
      { token_id: ids[0], outcome: "Up" },
      { token_id: ids[1], outcome: "Down" }
    ];
  } catch {
    return null;
  }
}

/**
 * Fetch market by slug using the events/slug endpoint.
 * This uses the Polymarket event slug format with timestamps.
 */
export async function fetchMarketBySlug(
  slug: string,
  asset: string,
  timeframe: string
): Promise<Market | null> {
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
    (result as any).is5Min = timeframe === "5";
    (result as any).isSimulated = false;
    (result as any).active = true;
    (result as any).closed = false;
    (result as any).conditionId = market.conditionId;
    (result as any).tokens = parseClobTokenIds(market.clobTokenIds) || market.tokens;
    (result as any).timeframe = timeframe;
    (result as any).asset = asset;

    return result;
  } catch (error) {
    console.error(`[MarketFetcher] Error fetching slug ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch active markets for a timeframe using the timestamp-based slug format
 */
export async function fetchActiveMarketsForTimeframe(timeframe: string): Promise<Market[]> {
  const duration = TIMEFRAME_DURATIONS[timeframe] || 900;
  const now = Date.now();

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
        // Format: btc-updown-5m-1234567890
        const slug = `${asset}-updown-${
          timeframe === "D" ? "1d" : timeframe === "240" ? "4h" : timeframe === "60" ? "1h" : timeframe === "15" ? "15m" : "5m"
        }-${tryTime}`;

        return fetchMarketBySlug(slug, asset.toUpperCase(), timeframe);
      });

      const offsetResults = await Promise.all(offsetPromises);
      // Return soonest expiration or first active
      return offsetResults.find((m) => m && (m as any).active && !(m as any).closed) || null;
    });

    const results = await Promise.all(marketPromises);
    const marketsArray = results.filter((m): m is Market => m !== null);

    // Sort by time remaining (soonest first)
    marketsArray.sort((a, b) => a.endTime - b.endTime);

    console.log(`[MarketFetcher] Found ${marketsArray.length} live up/down markets for ${timeframe} timeframe`);
    if (marketsArray.length > 0) {
      const top = marketsArray[0];
      const remaining = Math.floor((top.endTime - now) / 1000);
      console.log(`[MarketFetcher] Top: "${top.question}" YES=${top.outcomePrices.yes} Remaining: ${remaining}s`);
    }

    return marketsArray;
  } catch (error) {
    console.error("[MarketFetcher] Fetch error:", error);
    return [];
  }
}

/**
 * Fetch market price by market ID from CLOB API
 */
export async function fetchMarketPriceByMarketId(
  marketId: string,
  tokens?: { token_id: string; outcome: string }[]
): Promise<{ yes: string; no: string } | null> {
  try {
    // Strategy 1: Fast CLOB Midpoint API (if tokens available)
    if (tokens && tokens.length >= 1) {
      const yesToken = tokens.find(t =>
        t.outcome.toLowerCase() === 'yes' ||
        t.outcome === 'Long' ||
        t.outcome.toLowerCase().includes('up')
      );
      if (yesToken) {
        try {
          const clobResponse = await fetch(`${CLOB_API}/midpoint?token_id=${yesToken.token_id}`, {
            signal: AbortSignal.timeout(800),
          });
          if (clobResponse.ok) {
            const data = await clobResponse.json();
            const yesPrice = parseFloat(data.mid);
            if (!isNaN(yesPrice) && yesPrice > 0 && yesPrice < 1) {
              return {
                yes: yesPrice.toFixed(3),
                no: (1 - yesPrice).toFixed(3),
              };
            }
          }
        } catch {
          // Fall through
        }
      }
    }

    // Strategy 2: Gamma API
    const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
      signal: AbortSignal.timeout(1000),
    });

    if (!response.ok) return null;

    const market = await response.json();

    if (market.outcomePrices) {
      const parsed = JSON.parse(market.outcomePrices);

      // Find which index is YES. Usually index 0.
      let yesIndex = 0;
      const tokensToUse = (market.tokens as PolymarketToken[] | undefined) || (tokens?.length ? tokens : []);
      if (tokensToUse.length > 0) {
        const foundIndex = tokensToUse.findIndex((t) =>
          t.outcome.toLowerCase() === 'yes' ||
          t.outcome === 'Long' ||
          t.outcome.toLowerCase().includes('up')
        );
        if (foundIndex !== -1) yesIndex = foundIndex;
      }

      const yesPrice = parseFloat(parsed[yesIndex] || "0.5");
      const noPrice = parseFloat(parsed[1 - yesIndex] || "0.5");

      return {
        yes: yesPrice.toFixed(3),
        no: noPrice.toFixed(3)
      };
    }

    return null;
  } catch (error) {
    console.error(`[MarketFetcher] Error fetching price for ${marketId}:`, error);
    return null;
  }
}

/**
 * Fetch all crypto markets
 */
export async function fetchAllCryptoMarkets(timeframe?: string): Promise<Market[]> {
  const tf = timeframe || "5";
  return fetchActiveMarketsForTimeframe(tf);
}

/**
 * Get available timeframes
 */
export function getAvailableTimeframes(): string[] {
  return Object.keys(TIMEFRAME_DURATIONS);
}

/**
 * Get duration for timeframe
 */
export function getDurationForTimeframe(timeframe: string): number {
  return TIMEFRAME_DURATIONS[timeframe] || 900;
}