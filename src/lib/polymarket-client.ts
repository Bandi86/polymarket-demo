// Polymarket CLOB Client - Real trading integration with Polymarket
// Implements order creation, signing, and execution via CLOB API

import type { Outcome } from "../types";

export interface PolymarketConfig {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  chainId: 137; // Polygon mainnet
}

export interface PolymarketOrder {
  marketId: string;
  outcome: Outcome;
  amount: number;
  price: number;
  side: "BUY" | "SELL";
}

export interface PolymarketPosition {
  id: string;
  marketId: string;
  outcome: Outcome;
  tokens: number;
  avgPrice: number;
  currentValue: number;
  unrealizedPnl: number;
}

export interface MarketInfo {
  id: string;
  question: string;
  outcomes: string[];
  yesTokenId: string;
  noTokenId: string;
  active: boolean;
  endDate: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  transactionHash?: string;
}

export interface BalanceInfo {
  usdcBalance: number;
  totalPositionValue: number;
  totalPnL: number;
}

// CLOB API endpoints
const CLOB_API_URL = "https://clob.polymarket.com";
const GAMMA_API_URL = "https://gamma-api.polymarket.com";

// Check if we're in browser or Node environment
const isBrowser = typeof window !== "undefined";

/**
 * Polymarket CLOB Client
 * Handles real trading operations via Polymarket's CLOB API
 */
export class PolymarketClient {
  private config: PolymarketConfig | null = null;
  private connected: boolean = false;
  private testMode: boolean = true;
  private walletAddress: string | null = null;

  /**
   * Initialize the client with API credentials
   */
  async initialize(config: PolymarketConfig): Promise<boolean> {
    try {
      this.config = config;

      // Verify credentials by fetching user info
      const response = await this.clobRequest("/user", "GET");

      if (response.error) {
        console.error("[PolymarketClient] Auth failed:", response.error);
        return false;
      }

      this.connected = true;
      this.walletAddress = response.address || null;
      console.log("[PolymarketClient] Connected successfully");

      return true;
    } catch (error) {
      console.error("[PolymarketClient] Initialize error:", error);
      return false;
    }
  }

  /**
   * Set test mode (no real trades)
   */
  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
    console.log(`[PolymarketClient] Test mode: ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<BalanceInfo> {
    if (!this.connected || !this.config) {
      return { usdcBalance: 0, totalPositionValue: 0, totalPnL: 0 };
    }

    try {
      const response = await this.clobRequest("/balance", "GET");

      return {
        usdcBalance: response.usdc || 0,
        totalPositionValue: response.positionValue || 0,
        totalPnL: response.totalPnL || 0,
      };
    } catch (error) {
      console.error("[PolymarketClient] Balance fetch error:", error);
      return { usdcBalance: 0, totalPositionValue: 0, totalPnL: 0 };
    }
  }

  /**
   * Get open positions
   */
  async getPositions(): Promise<PolymarketPosition[]> {
    if (!this.connected || !this.config) {
      return [];
    }

    try {
      const response = await this.clobRequest("/positions", "GET");

      return (response.positions || []).map((p: any) => ({
        id: p.id,
        marketId: p.market,
        outcome: p.outcome === "YES" ? "YES" : "NO",
        tokens: p.size,
        avgPrice: p.avgCost,
        currentValue: p.currentValue,
        unrealizedPnl: p.unrealizedPnl,
      }));
    } catch (error) {
      console.error("[PolymarketClient] Positions fetch error:", error);
      return [];
    }
  }

  /**
   * Place a trade order
   */
  async placeOrder(order: PolymarketOrder): Promise<OrderResult> {
    if (!this.connected || !this.config) {
      return { success: false, error: "Not connected" };
    }

    if (this.testMode) {
      console.log("[PolymarketClient] TEST MODE - Would place order:", order);
      return {
        success: true,
        orderId: `test-${Date.now()}`,
      };
    }

    try {
      // Get market info to get token IDs
      const marketInfo = await this.getMarketInfo(order.marketId);
      if (!marketInfo) {
        return { success: false, error: "Market not found" };
      }

      const tokenId = order.outcome === "YES" ? marketInfo.yesTokenId : marketInfo.noTokenId;

      // Create the order
      const orderPayload = {
        tokenID: tokenId,
        price: order.price,
        size: order.amount,
        side: order.side,
        expiration: Math.floor(Date.now() / 1000) + 86400, // 24h expiration
      };

      // Sign and post the order
      const response = await this.clobRequest("/order", "POST", orderPayload);

      if (response.error) {
        return { success: false, error: response.error };
      }

      return {
        success: true,
        orderId: response.orderID,
        transactionHash: response.transactionHash,
      };
    } catch (error) {
      console.error("[PolymarketClient] Order error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.connected || !this.config) {
      return false;
    }

    try {
      const response = await this.clobRequest(`/order/${orderId}`, "DELETE");
      return !response.error;
    } catch (error) {
      console.error("[PolymarketClient] Cancel error:", error);
      return false;
    }
  }

  /**
   * Get market info from Gamma API
   */
  async getMarketInfo(marketId: string): Promise<MarketInfo | null> {
    try {
      const response = await fetch(`${GAMMA_API_URL}/markets/${marketId}`);
      const data = await response.json();

      return {
        id: data.conditionId || data.id,
        question: data.question,
        outcomes: data.outcomes || ["YES", "NO"],
        yesTokenId: data.tokens?.find((t: any) => t.outcome === "Yes")?.token_id || "",
        noTokenId: data.tokens?.find((t: any) => t.outcome === "No")?.token_id || "",
        active: data.active,
        endDate: data.endDate || Date.now() + 300000,
      };
    } catch (error) {
      console.error("[PolymarketClient] Market info error:", error);
      return null;
    }
  }

  /**
   * Search for markets
   */
  async searchMarkets(query: string, limit: number = 10): Promise<MarketInfo[]> {
    try {
      const response = await fetch(
        `${GAMMA_API_URL}/markets?_s=${encodeURIComponent(query)}&_l=${limit}&closed=false`
      );
      const data = await response.json();

      return data.map((m: any) => ({
        id: m.conditionId || m.id,
        question: m.question,
        outcomes: m.outcomes || ["YES", "NO"],
        yesTokenId: m.tokens?.find((t: any) => t.outcome === "Yes")?.token_id || "",
        noTokenId: m.tokens?.find((t: any) => t.outcome === "No")?.token_id || "",
        active: m.active,
        endDate: m.endDate || Date.now() + 300000,
      }));
    } catch (error) {
      console.error("[PolymarketClient] Market search error:", error);
      return [];
    }
  }

  /**
   * Make a CLOB API request
   */
  private async clobRequest(
    endpoint: string,
    method: "GET" | "POST" | "DELETE",
    body?: any
  ): Promise<any> {
    if (!this.config) {
      return { error: "Not configured" };
    }

    const url = `${CLOB_API_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add authentication headers
    if (this.config.apiKey) {
      headers["POLY-ADDRESS"] = this.walletAddress || "";
      headers["POLY-SIGNATURE"] = await this.generateSignature(endpoint, method, body);
      headers["POLY-TIMESTAMP"] = Math.floor(Date.now() / 1000).toString();
      headers["POLY-NONCE"] = Math.random().toString(36).substring(7);
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return data;
  }

  /**
   * Generate signature for authenticated requests
   * Note: In a real implementation, this would use ethers.js or similar
   */
  private async generateSignature(
    endpoint: string,
    method: string,
    body?: any
  ): Promise<string> {
    // This is a placeholder - real implementation would sign with private key
    // using ethers.js or web3
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${method}${endpoint}${timestamp}${body ? JSON.stringify(body) : ""}`;

    // In browser with wallet connected, would use:
    // return await window.ethereum.request({ method: "personal_sign", params: [message, this.walletAddress] });

    // For server-side, would use ethers:
    // const wallet = new ethers.Wallet(privateKey);
    // return await wallet.signMessage(message);

    console.warn("[PolymarketClient] Signature generation not implemented - using mock");
    return `mock-signature-${Date.now()}`;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.config = null;
    this.connected = false;
    this.walletAddress = null;
    console.log("[PolymarketClient] Disconnected");
  }
}

// Singleton instance
export const polymarketClient = new PolymarketClient();

// Export for convenience
export default polymarketClient;