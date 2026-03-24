import type { Market } from "../../types";
import { privateKeyToAccount } from "viem/accounts";

// Load credentials from environment (Bun automatically loads .env)
const POLY_API_KEY = process.env.POLYMARKET_API_KEY || "";
const POLY_API_SECRET = process.env.POLYMARKET_API_SECRET || "";
const POLY_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || "";

// Debug: Log if credentials are loaded (without revealing them)
const hasCredentials = !!(POLY_API_KEY && POLY_API_SECRET);
const hasPrivateKey = !!POLY_PRIVATE_KEY;
console.log(`[PolymarketProvider] Credentials: API=${hasCredentials ? 'YES' : 'NO'} PrivateKey=${hasPrivateKey ? 'YES' : 'NO'}`);

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
const CLOB_API = "https://clob.polymarket.com";

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

  /** Get API configuration status */
  getConfig(): { apiKey: string; hasCredentials: boolean; hasPrivateKey: boolean } {
    return {
      apiKey: POLY_API_KEY ? `${POLY_API_KEY.slice(0, 8)}...` : "",
      hasCredentials: !!(POLY_API_KEY && POLY_API_SECRET),
      hasPrivateKey: !!POLY_PRIVATE_KEY,
    };
  }

  /** Check if we have API credentials configured */
  hasCredentials(): boolean {
    return !!(POLY_API_KEY && POLY_API_SECRET);
  }

  /** Check if we have a private key configured */
  hasPrivateKey(): boolean {
    return !!POLY_PRIVATE_KEY;
  }

  /**
   * Fetch account balance from Polymarket CLOB API.
   * Uses L2 signature authentication with the private key.
   */
  async fetchAccountBalance(): Promise<{
    balance: number;
    available: number;
    locked: number;
    success: boolean;
    isLive: boolean;
    error?: string;
  }> {
    // If we have a private key, try authenticated balance fetch
    if (POLY_PRIVATE_KEY) {
      return this.fetchBalanceWithPrivateKey();
    }

    // If we have API key/secret but no private key
    if (POLY_API_KEY && POLY_API_SECRET) {
      return {
        balance: 0,
        available: 0,
        locked: 0,
        success: false,
        isLive: false,
        error: "API credentials configured but private key required for balance. Add POLYMARKET_PRIVATE_KEY to .env",
      };
    }

    return {
      balance: 0,
      available: 0,
      locked: 0,
      success: false,
      isLive: false,
      error: "No API credentials configured",
    };
  }

  /**
   * Fetch balance using private key for L2 signature authentication.
   * Implements Polymarket's EIP-712 typed data signature using viem.
   */
  private async fetchBalanceWithPrivateKey(): Promise<{
    balance: number;
    available: number;
    locked: number;
    success: boolean;
    isLive: boolean;
    error?: string;
  }> {
    try {
      // Ensure private key has 0x prefix
      const privateKey = POLY_PRIVATE_KEY.startsWith("0x")
        ? POLY_PRIVATE_KEY as `0x${string}`
        : `0x${POLY_PRIVATE_KEY}` as `0x${string}`;

      // Create account from private key using viem
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      console.log(`[PolymarketProvider] Using address: ${address}`);

      // Create timestamp and nonce for L2 signature
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = timestamp;

      // EIP-712 typed data for Polymarket L2 authentication
      const domain = {
        name: "Polymarket CLOB",
        version: "1",
        chainId: 137,
        verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
      };

      const types = {
        Greeting: [
          { name: "greeting", type: "string" },
        ],
      } as const;

      const value = {
        greeting: `greeting: ${timestamp}`,
      };

      // Sign the typed data using viem
      const signature = await account.signTypedData({
        domain,
        types,
        primaryType: "Greeting",
        message: value,
      });

      console.log(`[PolymarketProvider] Signature created: ${signature.slice(0, 20)}...`);

      // Fetch balance with L2 signature
      const response = await fetch(`${CLOB_API}/balances`, {
        method: "GET",
        headers: {
          "POLY-ADDRESS": address,
          "POLY-SIGNATURE": signature,
          "POLY-TIMESTAMP": timestamp.toString(),
          "POLY-NONCE": nonce.toString(),
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PolymarketProvider] Balance API error: ${response.status} ${errorText}`);

        // Check if balance is simply $0
        if (response.status === 400 || response.status === 404) {
          return {
            balance: 0,
            available: 0,
            locked: 0,
            success: true,
            isLive: true,
            error: "No balance found (account may be empty)",
          };
        }

        return {
          balance: 0,
          available: 0,
          locked: 0,
          success: false,
          isLive: false,
          error: `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      console.log(`[PolymarketProvider] Balance response:`, JSON.stringify(data).slice(0, 200));

      // Parse balance from response
      // Polymarket returns balances as array
      let balance = 0;
      let available = 0;
      let locked = 0;

      if (Array.isArray(data)) {
        // Find USDC balance
        const usdcBalance = data.find((b: any) =>
          b.currency === "USDC" || b.asset === "USDC" || b.symbol === "USDC"
        );
        if (usdcBalance) {
          balance = parseFloat(usdcBalance.balance || usdcBalance.amount || 0) / 1e6;
          available = parseFloat(usdcBalance.available || balance) / 1e6;
          locked = parseFloat(usdcBalance.locked || 0) / 1e6;
        }
      } else if (data.balance !== undefined) {
        balance = parseFloat(data.balance);
        available = parseFloat(data.available || data.balance);
        locked = parseFloat(data.locked || 0);
      } else if (data.USDC !== undefined) {
        balance = parseFloat(data.USDC);
      }

      console.log(`[PolymarketProvider] Live balance fetched: $${balance.toFixed(2)}`);

      return {
        balance,
        available,
        locked,
        success: true,
        isLive: true,
      };
    } catch (error) {
      console.error("[PolymarketProvider] Failed to fetch balance with private key:", error);
      return {
        balance: 0,
        available: 0,
        locked: 0,
        success: false,
        isLive: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch positions from Polymarket using L2 signature
   */
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
      return {
        positions: [],
        success: false,
        error: "No private key configured",
      };
    }

    try {
      // Ensure private key has 0x prefix
      const privateKey = POLY_PRIVATE_KEY.startsWith("0x")
        ? POLY_PRIVATE_KEY as `0x${string}`
        : `0x${POLY_PRIVATE_KEY}` as `0x${string}`;

      // Create account from private key using viem
      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      // Create timestamp and nonce for L2 signature
      const timestamp = Math.floor(Date.now() / 1000);

      // EIP-712 typed data for Polymarket L2 authentication
      const domain = {
        name: "Polymarket CLOB",
        version: "1",
        chainId: 137,
        verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
      };

      const types = {
        Greeting: [
          { name: "greeting", type: "string" },
        ],
      } as const;

      const value = {
        greeting: `greeting: ${timestamp}`,
      };

      // Sign the typed data using viem
      const signature = await account.signTypedData({
        domain,
        types,
        primaryType: "Greeting",
        message: value,
      });

      const response = await fetch(`${CLOB_API}/positions`, {
        method: "GET",
        headers: {
          "POLY-ADDRESS": address,
          "POLY-SIGNATURE": signature,
          "POLY-TIMESTAMP": timestamp.toString(),
          "POLY-NONCE": timestamp.toString(),
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          positions: [],
          success: false,
          error: `API error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Transform positions
      const positions = (data || []).map((p: any) => ({
        market: p.market || p.condition_id || "Unknown",
        outcome: p.outcome || "Unknown",
        shares: parseFloat(p.shares || p.size || 0),
        avgPrice: parseFloat(p.avg_price || p.avgPrice || 0),
        currentValue: parseFloat(p.current_value || p.value || 0),
      }));

      return { positions, success: true };
    } catch (error) {
      return {
        positions: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Place a market order on Polymarket CLOB.
   * Uses GTC (Good Till Cancelled) order type.
   */
  async placeOrder(params: {
    tokenId: string;
    side: "BUY" | "SELL";
    price: number;
    size: number;
  }): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    if (!POLY_PRIVATE_KEY) {
      return { success: false, error: "No private key configured" };
    }

    try {
      const privateKey = POLY_PRIVATE_KEY.startsWith("0x")
        ? POLY_PRIVATE_KEY as `0x${string}`
        : `0x${POLY_PRIVATE_KEY}` as `0x${string}`;

      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      // Generate order parameters
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `${timestamp}-${Math.random().toString(36).slice(2)}`;
      const expiration = timestamp + 86400; // 24 hours from now

      // EIP-712 Order type
      const domain = {
        name: "Polymarket CLOB",
        version: "1",
        chainId: 137,
        verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
      };

      const types = {
        Order: [
          { name: "salt", type: "string" },
          { name: "maker", type: "address" },
          { name: "signer", type: "address" },
          { name: "taker", type: "address" },
          { name: "tokenId", type: "string" },
          { name: "makerAmount", type: "string" },
          { name: "takerAmount", type: "string" },
          { name: "expiration", type: "string" },
          { name: "nonce", type: "string" },
          { name: "feeRateBps", type: "string" },
          { name: "side", type: "string" },
          { name: "signatureType", type: "string" },
        ],
      } as const;

      // Calculate amounts
      const makerAmount = params.side === "BUY"
        ? Math.floor(params.price * params.size * 1e6) // USDC to spend
        : Math.floor(params.size * 1e6); // Shares to sell
      const takerAmount = params.side === "BUY"
        ? Math.floor(params.size * 1e6) // Shares to receive
        : Math.floor(params.price * params.size * 1e6); // USDC to receive

      const orderValue = {
        salt: nonce,
        maker: address,
        signer: address,
        taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        tokenId: params.tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: expiration.toString(),
        nonce: nonce,
        feeRateBps: "0",
        side: params.side === "BUY" ? "0" : "1",
        signatureType: "0",
      };

      // Sign the order
      const signature = await account.signTypedData({
        domain,
        types,
        primaryType: "Order",
        message: orderValue,
      });

      console.log(`[PolymarketProvider] Order signed: ${signature.slice(0, 20)}...`);

      // Create order payload
      const orderPayload = {
        salt: nonce,
        maker: address,
        signer: address,
        taker: "0x0000000000000000000000000000000000000000",
        tokenId: params.tokenId,
        makerAmount: makerAmount.toString(),
        takerAmount: takerAmount.toString(),
        expiration: expiration.toString(),
        nonce: nonce,
        feeRateBps: "0",
        side: params.side,
        signatureType: "EOA",
        signature,
      };

      // Submit order to CLOB
      const response = await fetch(`${CLOB_API}/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PolymarketProvider] Order failed: ${response.status} ${errorText}`);
        return {
          success: false,
          error: `Order failed: ${response.status}`,
        };
      }

      const result = await response.json();
      console.log(`[PolymarketProvider] Order placed:`, result);

      return {
        success: true,
        orderId: result.orderId || result.id || nonce,
      };
    } catch (error) {
      console.error("[PolymarketProvider] Place order error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel an order on Polymarket CLOB.
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    if (!POLY_PRIVATE_KEY) {
      return { success: false, error: "No private key configured" };
    }

    try {
      const privateKey = POLY_PRIVATE_KEY.startsWith("0x")
        ? POLY_PRIVATE_KEY as `0x${string}`
        : `0x${POLY_PRIVATE_KEY}` as `0x${string}`;

      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const timestamp = Math.floor(Date.now() / 1000);

      // L2 signature for cancellation
      const domain = {
        name: "Polymarket CLOB",
        version: "1",
        chainId: 137,
        verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
      };

      const types = {
        Greeting: [{ name: "greeting", type: "string" }],
      } as const;

      const signature = await account.signTypedData({
        domain,
        types,
        primaryType: "Greeting",
        message: { greeting: `greeting: ${timestamp}` },
      });

      const response = await fetch(`${CLOB_API}/order/${orderId}`, {
        method: "DELETE",
        headers: {
          "POLY-ADDRESS": address,
          "POLY-SIGNATURE": signature,
          "POLY-TIMESTAMP": timestamp.toString(),
          "POLY-NONCE": timestamp.toString(),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { success: false, error: `Cancel failed: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Fetch trade history from Polymarket.
   */
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

    try {
      const privateKey = POLY_PRIVATE_KEY.startsWith("0x")
        ? POLY_PRIVATE_KEY as `0x${string}`
        : `0x${POLY_PRIVATE_KEY}` as `0x${string}`;

      const account = privateKeyToAccount(privateKey);
      const address = account.address;

      const timestamp = Math.floor(Date.now() / 1000);

      const domain = {
        name: "Polymarket CLOB",
        version: "1",
        chainId: 137,
        verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
      };

      const types = {
        Greeting: [{ name: "greeting", type: "string" }],
      } as const;

      const signature = await account.signTypedData({
        domain,
        types,
        primaryType: "Greeting",
        message: { greeting: `greeting: ${timestamp}` },
      });

      const response = await fetch(`${CLOB_API}/trades`, {
        method: "GET",
        headers: {
          "POLY-ADDRESS": address,
          "POLY-SIGNATURE": signature,
          "POLY-TIMESTAMP": timestamp.toString(),
          "POLY-NONCE": timestamp.toString(),
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { trades: [], success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();

      const trades = (data || []).map((t: any) => ({
        id: t.id || t.transaction_hash || "",
        market: t.market || t.condition_id || "Unknown",
        outcome: t.outcome || "Unknown",
        side: t.side || "BUY",
        size: parseFloat(t.size || t.shares || 0),
        price: parseFloat(t.price || t.avg_price || 0),
        timestamp: t.timestamp || t.created_at || Date.now(),
      }));

      return { trades, success: true };
    } catch (error) {
      return { trades: [], success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export const polymarketProvider = new PolymarketProvider();
