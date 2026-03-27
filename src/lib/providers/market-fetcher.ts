// Polymarket Market Fetcher
// Handles market discovery and price fetching

import type { Market } from "../../types";
import type { PolymarketMarket } from "../../types/provider.types";

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
 * Transform raw market data to our Market format
 */
export function transformMarket(
  market: PolymarketMarket,
  asset: string,
  timeframe: string
): Market | null {
  const tokens = parseClobTokenIds(market.clobTokenIds);
  const duration = TIMEFRAME_DURATIONS[timeframe] || 900;

  return {
    id: market.conditionId || market.id,
    question: market.question || `${asset} ${timeframe}m Market`,
    endTime: market.end_date_iso ? new Date(market.end_date_iso).getTime() : Date.now() + duration * 1000,
    startTime: market.start_date_iso ? new Date(market.start_date_iso).getTime() : Date.now(),
    status: "active",
    outcomePrices: {
      yes: market.outcomePrices?.[0] || "0.5",
      no: market.outcomePrices?.[1] || "0.5",
    },
    tokens,
    asset,
    timeframe,
  };
}

/**
 * Fetch market by slug from Gamma API
 */
export async function fetchMarketBySlug(
  slug: string,
  asset: string,
  timeframe: string
): Promise<Market | null> {
  try {
    const response = await fetch(`${GAMMA_API}/markets?slug=${slug}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[MarketFetcher] Failed to fetch ${slug}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const market = Array.isArray(data) ? data[0] : data;

    if (!market) return null;

    return transformMarket(market, asset, timeframe);
  } catch (error) {
    console.error(`[MarketFetcher] Error fetching ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch active markets for a timeframe
 */
export async function fetchActiveMarketsForTimeframe(timeframe: string): Promise<Market[]> {
  const duration = TIMEFRAME_DURATIONS[timeframe] || 900;
  const markets: Market[] = [];

  const slugs = [
    { slug: `btc-${timeframe}m-up-or-down`, asset: "BTC" },
    { slug: `eth-${timeframe}m-up-or-down`, asset: "ETH" },
  ];

  const results = await Promise.allSettled(
    slugs.map(s => fetchMarketBySlug(s.slug, s.asset, timeframe))
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      markets.push(result.value);
    }
  }

  return markets;
}

/**
 * Fetch market price by market ID from CLOB API
 */
export async function fetchMarketPriceByMarketId(
  marketId: string,
  tokens?: { token_id: string; outcome: string }[]
): Promise<{ yes: string; no: string } | null> {
  try {
    // If we have tokens, use the CLOB price API for real-time prices
    if (tokens && tokens.length >= 2) {
      const response = await fetch(`${CLOB_API}/price?token_id=${tokens[0].token_id}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const yesPrice = data?.price || "0.5";
        const noPrice = (1 - parseFloat(yesPrice)).toString();

        return { yes: yesPrice, no: noPrice };
      }
    }

    // Fallback to Gamma API
    const response = await fetch(`${GAMMA_API}/markets?condition_id=${marketId}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const market = Array.isArray(data) ? data[0] : data;

    if (market?.outcomePrices) {
      return {
        yes: market.outcomePrices[0] || "0.5",
        no: market.outcomePrices[1] || "0.5",
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