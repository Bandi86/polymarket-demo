// Polymarket CLOB Client Provider
// Uses @polymarket/clob-client for authenticated API access

import { ClobClient, ApiKeyCreds, OrderType, Side, createL2Headers } from "@polymarket/clob-client";
import type { Trade, OpenOrder } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Load credentials from environment
const POLY_API_KEY = process.env.POLYMARKET_API_KEY || "";
const POLY_API_SECRET = process.env.POLYMARKET_API_SECRET || "";
const POLY_API_PASSPHRASE = process.env.POLYMARKET_API_PASSPHRASE || "";
const POLY_PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || "";

const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon

// Types
export interface BalanceResult {
  balance: number;
  available: number;
  locked: number;
  success: boolean;
  isLive: boolean;
  error?: string;
}

export interface Position {
  market: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  currentValue: number;
}

export interface TradeResult {
  id: string;
  market: string;
  outcome: string;
  side: string;
  size: number;
  price: number;
  timestamp: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

// Singleton client instance
let clobClient: ClobClient | null = null;
let apiKeyCreds: ApiKeyCreds | null = null;
let walletAddress: string | null = null;
let initialized = false;
let signer: any = null; // Store signer for custom requests

/**
 * Initialize the CLOB client with credentials
 */
export async function initializeClobClient(): Promise<boolean> {
  if (initialized && clobClient) {
    return true;
  }

  if (!POLY_PRIVATE_KEY) {
    console.error("[ClobClient] No private key configured");
    return false;
  }

  try {
    // Create account from private key
    const account = privateKeyToAccount(POLY_PRIVATE_KEY as `0x${string}`);
    walletAddress = account.address;

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });

    // Initialize ClobClient with credentials
    // Use API key credentials if available, otherwise derive from wallet
    if (POLY_API_KEY && POLY_API_SECRET && POLY_API_PASSPHRASE) {
      apiKeyCreds = {
        key: POLY_API_KEY,
        secret: POLY_API_SECRET,
        passphrase: POLY_API_PASSPHRASE,
      };
    }

    // Initialize ClobClient - signatureType 0 for EOA
    clobClient = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      walletClient,
      apiKeyCreds || undefined,
      0 // signatureType: 0 = EOA
    );

    // Create or derive API key if not provided
    if (!apiKeyCreds) {
      apiKeyCreds = await clobClient.createOrDeriveApiKey();
      console.log("[ClobClient] API key derived");
    }

    // Get the signer from clobClient for custom authenticated requests
    signer = clobClient.signer;

    initialized = true;
    console.log("[ClobClient] Initialized successfully");
    console.log("[ClobClient] API Key:", apiKeyCreds?.key ? "present" : "missing");
    console.log("[ClobClient] Wallet:", walletAddress);

    return true;
  } catch (error) {
    console.error("[ClobClient] Initialization failed:", error);
    return false;
  }
}

/**
 * Get account balance - fetches from CLOB API using authenticated request
 */
export async function getBalance(): Promise<BalanceResult> {
  if (!initialized || !clobClient || !walletAddress || !signer || !apiKeyCreds) {
    const init = await initializeClobClient();
    if (!init || !walletAddress || !signer || !apiKeyCreds) {
      return {
        balance: 0,
        available: 0,
        locked: 0,
        success: false,
        isLive: false,
        error: "Failed to initialize client",
      };
    }
  }

  try {
    // Create authenticated headers
    const timestamp = Math.floor(Date.now() / 1000);
    const authHeaders = await createL2Headers(signer!, apiKeyCreds!, {
      method: "GET",
      requestPath: "/balance",
    }, timestamp);

    // Fetch balance from CLOB API with authentication
    const response = await fetch(
      `${CLOB_HOST}/balance?address=${walletAddress}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.log("[ClobClient] /balance returned:", response.status, await response.text().catch(() => ""));

      // Try alternative endpoint with auth
      const altResponse = await fetch(
        `${CLOB_HOST}/api/balances`,
        {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!altResponse.ok) {
        // Try getting position value as alternative
        return {
          balance: 0,
          available: 0,
          locked: 0,
          success: true,
          isLive: true,
          error: `API returned ${response.status}, but may have positions`,
        };
      }

      const data = await altResponse.json();
      // Parse balance - look for USDC in the response
      const usdcEntry = Array.isArray(data) ? data.find((b: any) => b.currency === "USDC" || b.asset === "USDC") : null;
      const balance = usdcEntry ? parseFloat(usdcEntry.balance || "0") / 1e6 : 0;
      return {
        balance,
        available: balance,
        locked: 0,
        success: true,
        isLive: true,
      };
    }

    const data = await response.json();

    // Parse balance - USDC is in micro units (6 decimals)
    const balance = parseFloat(data?.USDC || data?.balance || "0") / 1e6;
    const available = parseFloat(data?.available || data?.USDC || "0") / 1e6;

    return {
      balance,
      available: available || balance,
      locked: 0,
      success: true,
      isLive: true,
    };
  } catch (error) {
    console.error("[ClobClient] getBalance error:", error);
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
 * Get open positions - uses getOpenOrders from ClobClient
 */
export async function getPositions(): Promise<{
  positions: Position[];
  success: boolean;
  error?: string;
}> {
  if (!initialized || !clobClient) {
    const init = await initializeClobClient();
    if (!init) {
      return { positions: [], success: false, error: "Failed to initialize client" };
    }
  }

  try {
    const openOrders = await clobClient!.getOpenOrders();

    const mappedPositions: Position[] = (openOrders || []).map((order: OpenOrder) => ({
      market: order?.market || "",
      outcome: order?.outcome || "YES",
      shares: parseFloat(order?.original_size || "0"),
      avgPrice: parseFloat(order?.price || "0"),
      currentValue: parseFloat(order?.original_size || "0") * parseFloat(order?.price || "0"),
    }));

    return { positions: mappedPositions, success: true };
  } catch (error) {
    console.error("[ClobClient] getPositions error:", error);
    return {
      positions: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get trade history - uses getTrades from ClobClient
 */
export async function getTrades(): Promise<{
  trades: TradeResult[];
  success: boolean;
  error?: string;
}> {
  if (!initialized || !clobClient) {
    const init = await initializeClobClient();
    if (!init) {
      return { trades: [], success: false, error: "Failed to initialize client" };
    }
  }

  try {
    const trades = await clobClient!.getTrades({});

    const mappedTrades: TradeResult[] = (trades || []).map((trade: Trade) => ({
      id: trade?.id || "",
      market: trade?.market || "",
      outcome: trade?.outcome || "YES",
      side: trade?.side === Side.SELL ? "SELL" : "BUY",
      size: parseFloat(trade?.size || "0"),
      price: parseFloat(trade?.price || "0"),
      timestamp: trade?.match_time ? new Date(trade.match_time).getTime() : Date.now(),
    }));

    return { trades: mappedTrades, success: true };
  } catch (error) {
    console.error("[ClobClient] getTrades error:", error);
    return {
      trades: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  if (!initialized || !clobClient) {
    const init = await initializeClobClient();
    if (!init) {
      return { success: false, error: "Failed to initialize client" };
    }
  }

  try {
    await clobClient!.cancelOrder({ orderID: orderId });
    return { success: true };
  } catch (error) {
    console.error("[ClobClient] cancelOrder error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Place an order using createAndPostOrder
 */
export async function placeOrder(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
}): Promise<OrderResult> {
  if (!initialized || !clobClient) {
    const init = await initializeClobClient();
    if (!init) {
      return { success: false, error: "Failed to initialize client" };
    }
  }

  try {
    const orderResult = await clobClient!.createAndPostOrder(
      {
        tokenID: params.tokenId,
        price: params.price,
        side: params.side === "BUY" ? Side.BUY : Side.SELL,
        size: params.size,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.GTC
    );

    return {
      success: true,
      orderId: orderResult?.orderID || orderResult?.id || "",
    };
  } catch (error) {
    console.error("[ClobClient] placeOrder error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get configuration status
 */
export function getConfig(): { hasCredentials: boolean; hasPrivateKey: boolean; walletAddress: string | null } {
  return {
    hasCredentials: !!(POLY_API_KEY && POLY_API_SECRET),
    hasPrivateKey: !!POLY_PRIVATE_KEY,
    walletAddress,
  };
}

/**
 * Check if client is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Reset client (for testing or reconnection)
 */
export function resetClient(): void {
  clobClient = null;
  apiKeyCreds = null;
  initialized = false;
  console.log("[ClobClient] Reset");
}
