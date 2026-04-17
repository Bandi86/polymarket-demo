import type { Market } from "../../types";
import type { PolymarketEvent, PolymarketMarket } from "../../types/provider.types";
import {
  fetchActiveMarketsForTimeframe,
  fetchMarketPriceByMarketId as fetchPriceByMarketId,
  fetchAllCryptoMarkets,
  getAvailableTimeframes,
  getDurationForTimeframe,
} from "./market-fetcher";
import {
  fetchPositions as fetchPositionsList,
  fetchTrades as fetchTradesList,
} from "./account-client";
import { accountManager } from "../account-manager";
import { placeOrder as placeOrderRequest, cancelOrder as cancelOrderRequest } from "./order-client";

// Load credentials from environment (Bun automatically loads .env)
const POLY_API_KEY = process.env.POLYMARKET_API_KEY || "";
const POLY_API_SECRET = process.env.POLYMARKET_API_SECRET || "";
const POLY_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || "";

// Debug: Log if credentials are loaded (without revealing them)
const hasCredentials = !!(POLY_API_KEY && POLY_API_SECRET);
const hasPrivateKey = !!POLY_PRIVATE_KEY;
console.log(`[PolymarketProvider] Credentials: API=${hasCredentials ? 'YES' : 'NO'} PrivateKey=${hasPrivateKey ? 'YES' : 'NO'}`);

// Re-export types for backward compatibility
export type { PolymarketEvent, PolymarketMarket } from "../../types/provider.types";

export class PolymarketProvider {
  private cachedMarkets: Map<string, Market[]> = new Map();
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 1000; // 1s cache for live markets
  private currentTimeframe = "5"; // Default to 5m

  // Price cache for faster updates
  private priceCache: Map<string, { yes: string; no: string; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 100; // 100ms cache

  /** Set BTC price for display (used by price service) */
  setBtcPrice(_price: number): void {}

  /** Enable/disable simulation mode (kept for API compatibility) */
  setSimulationMode(_enabled: boolean): void {}

  /** Set the current timeframe for market selection */
  setTimeframe(timeframe: string): void {
    this.currentTimeframe = timeframe;
  }

  /** Get the current timeframe */
  getTimeframe(): string {
    return this.currentTimeframe;
  }

  /** Get the duration in seconds for a timeframe */
  getDurationForTimeframe(timeframe: string): number {
    return getDurationForTimeframe(timeframe);
  }

  /** Discover live up/down markets for the specified timeframe */
  async fetchActiveMarkets(timeframe?: string): Promise<Market[]> {
    const tf = timeframe || this.currentTimeframe;
    const now = Date.now();

    // Check cache
    const cached = this.cachedMarkets.get(tf);
    if (cached && cached.length > 0 && now - this.lastFetchTime < this.CACHE_TTL) {
      return cached;
    }

    const markets = await fetchActiveMarketsForTimeframe(tf);

    // Update cache
    if (markets.length > 0) {
      this.cachedMarkets.set(tf, markets);
      this.lastFetchTime = now;
    }

    return markets;
  }

  /** Fetch active Bitcoin markets */
  async fetchActiveBitcoinMarkets(): Promise<Market[]> {
    return this.fetchActiveMarkets();
  }

  /** Fetch market price by market ID */
  async fetchMarketPriceByMarketId(
    marketId: string,
    tokens?: { token_id: string; outcome: string }[]
  ): Promise<{ yes: string; no: string } | null> {
    // Check price cache first
    const now = Date.now();
    const cached = this.priceCache.get(marketId);
    if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
      return { yes: cached.yes, no: cached.no };
    }

    const prices = await fetchPriceByMarketId(marketId, tokens);

    // Update cache
    if (prices) {
      this.priceCache.set(marketId, { ...prices, timestamp: now });
    }

    return prices;
  }

  /** Fetch all crypto markets */
  async fetchAllCryptoMarkets(timeframe?: string): Promise<Market[]> {
    const tf = timeframe || this.currentTimeframe;
    return fetchAllCryptoMarkets(tf);
  }

  /** Clear all caches */
  clearCache(): void {
    this.cachedMarkets.clear();
    this.priceCache.clear();
    this.lastFetchTime = 0;
  }

  /** Get available timeframes */
  getAvailableTimeframes(): string[] {
    return getAvailableTimeframes();
  }

  /** Get configuration status */
  getConfig(): { apiKey: string; hasCredentials: boolean; hasPrivateKey: boolean } {
    return {
      apiKey: POLY_API_KEY ? "configured" : "not configured",
      hasCredentials,
      hasPrivateKey,
    };
  }

  /** Check if API credentials are configured */
  hasCredentials(): boolean {
    return hasCredentials;
  }

  /** Check if private key is configured */
  hasPrivateKey(): boolean {
    return hasPrivateKey;
  }

  /** Fetch account balance (Trading Balance for bots) */
  async fetchAccountBalance(): Promise<{
    balance: number;
    available: number;
    locked: number;
    success: boolean;
    isLive: boolean;
    error?: string;
  }> {
    const result = await accountManager.getTradingBalance();
    return {
      balance: result.total,
      available: result.available,
      locked: result.locked,
      success: result.success,
      isLive: result.success, // If successful, it implies we hit the live API
      error: result.error,
    };
  }

  /** Fetch comprehensive detailed account (CLOB + On-Chain Wallet) */
  async getDetailedAccount() {
    return accountManager.getDetailedAccount();
  }

  /** Redeem winning tokens for a condition */
  async redeemWinnings(conditionId: string) {
    return accountManager.redeemWinnings(conditionId);
  }

  /** Fetch positions from Polymarket */
  async fetchPositions(): Promise<{
    positions: Array<{
      market: string;
      outcome: string;
      shares: number;
      avgPrice: number;
      currentValue: number;
    }>;
    success: boolean;
    error?: string;
  }> {
    if (!POLY_PRIVATE_KEY) {
      return { positions: [], success: false, error: "No private key configured" };
    }

    return fetchPositionsList(POLY_PRIVATE_KEY);
  }

  /** Place an order on Polymarket CLOB */
  async placeOrder(params: {
    tokenId: string;
    side: "BUY" | "SELL";
    price: number;
    size: number;
  }): Promise<{ success: boolean; orderId?: string; error?: string }> {
    if (!POLY_PRIVATE_KEY) {
      return { success: false, error: "No private key configured" };
    }

    return placeOrderRequest(POLY_PRIVATE_KEY, params);
  }

  /** Cancel an order on Polymarket CLOB */
  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    if (!POLY_PRIVATE_KEY) {
      return { success: false, error: "No private key configured" };
    }

    return cancelOrderRequest(POLY_PRIVATE_KEY, orderId);
  }

  /** Fetch trades from Polymarket */
  async fetchTrades(): Promise<{
    trades: Array<{
      id: string;
      market: string;
      outcome: string;
      side: string;
      size: number;
      price: number;
      timestamp: number;
    }>;
    success: boolean;
    error?: string;
  }> {
    if (!POLY_PRIVATE_KEY) {
      return { trades: [], success: false, error: "No private key configured" };
    }

    return fetchTradesList(POLY_PRIVATE_KEY);
  }
}

export const polymarketProvider = new PolymarketProvider();