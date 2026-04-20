// Polymarket CLOB Client Provider
// Uses @polymarket/clob-client for authenticated API access

import { ClobClient, ApiKeyCreds, OrderType, Side, createL2Headers } from "@polymarket/clob-client";
import type { Trade, OpenOrder } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { accountStore } from '@/lib/account-store';
import { cliWrapper } from "./cli-wrapper";
import { placeOrderDirect } from "./account-client";

// Load credentials from environment (legacy fallback)
const POLY_API_KEY = process.env.POLYMARKET_API_KEY || "";
const POLY_API_SECRET = process.env.POLYMARKET_API_SECRET || "";
const POLY_API_PASSPHRASE = process.env.POLYMARKET_API_PASSPHRASE || "";
let currentPrivateKey: string | null = null;

const CLOB_HOST = "https://clob.polymarket.com";
const DATA_HOST = "https://data-api.polymarket.com";
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
export async function initializeClobClient(privateKeyParam?: string): Promise<boolean> {
  // Determine which key to use
  let keyToUse = privateKeyParam;
  if (!keyToUse) {
    const activeAcc = await accountStore.getActiveAccount();
    if (activeAcc) {
      keyToUse = activeAcc.privateKey;
    } else {
      keyToUse = process.env.POLYMARKET_PRIVATE_KEY || undefined;
    }
  }

  if (!keyToUse) {
    console.error("[ClobClient] No private key configured");
    return false;
  }

  // If we are initialized with a different key, reset first
  if (initialized && clobClient && currentPrivateKey !== keyToUse) {
    resetClient();
  }

  if (initialized && clobClient) {
    return true;
  }

  currentPrivateKey = keyToUse;

  try {
    // Create account from private key
    const account = privateKeyToAccount(keyToUse as `0x${string}`);
    walletAddress = account.address;

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });

    // Initialize ClobClient - try without API credentials first (wallet-only auth)
    // Only add credentials if needed
    let credsToUse = undefined;
    if (POLY_API_KEY && POLY_API_SECRET && POLY_API_PASSPHRASE) {
      credsToUse = {
        key: POLY_API_KEY,
        secret: POLY_API_SECRET,
        passphrase: POLY_API_PASSPHRASE,
      };
      console.log("[ClobClient] Using provided API credentials from env");
    }

    clobClient = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      walletClient,
      credsToUse,
      0 // signatureType: 0 = EOA
    );

    // Try to derive API key if no credentials provided - this helps with some endpoints
    if (!credsToUse) {
      try {
        apiKeyCreds = await clobClient.createOrDeriveApiKey();
        console.log("[ClobClient] API key derived from wallet");
      } catch (keyError) {
        console.warn("[ClobClient] Could not derive API key:", keyError);
      }
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
 * Get account balance - fetches from CLOB via CLI (more reliable)
 */
export async function getBalance(): Promise<BalanceResult> {
  // Try CLI first (most reliable)
  try {
    const activeAcc = await accountStore.getActiveAccount();
    if (activeAcc) {
      const cliResult = await cliWrapper.getClobBalance(activeAcc.privateKey);
      if (cliResult && cliResult.balance !== undefined) {
        const balance = parseFloat(cliResult.balance);
        console.log("[ClobClient] Balance from CLI:", balance);
        return {
          balance,
          available: balance,
          locked: 0,
          success: true,
          isLive: true,
        };
      }
    }
  } catch (e) {
    console.warn("[ClobClient] CLI balance failed, trying API:", e);
  }

  if (!walletAddress) {
    // Try to initialize first
    const init = await initializeClobClient();
    if (!init || !walletAddress) {
      return {
        balance: 0,
        available: 0,
        locked: 0,
        success: false,
        isLive: false,
        error: "No wallet address",
      };
    }
  }

  try {
    // Fallback: use /value endpoint from Data API (no auth required, returns positions value)
    console.log("[ClobClient] Fetching balance from Data API /value...");
    const valueResponse = await fetch(
      `${DATA_HOST}/value?user=${walletAddress}`,
      {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (valueResponse.ok) {
      const data = await valueResponse.json();
      // /value returns [{ user: "...", value: 100.5 }]
      const value = Array.isArray(data) ? data[0]?.value : data?.value;
      const balance = parseFloat(value || "0");
      console.log("[ClobClient] Balance from /value:", balance);
      return {
        balance,
        available: balance,
        locked: 0,
        success: true,
        isLive: true,
      };
    }
    console.log("[ClobClient] /value returned:", valueResponse.status);

    // Second try: get positions from Data API and calculate total value
    console.log("[ClobClient] Fetching balance from Data API /positions...");
    const positionsResponse = await fetch(
      `${DATA_HOST}/positions?user=${walletAddress}&limit=100`,
      {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (positionsResponse.ok) {
      const positions = await positionsResponse.json();
      let totalValue = 0;
      let totalBought = 0;

      if (Array.isArray(positions)) {
        for (const pos of positions) {
          // Use currentValue if available, otherwise calculate from size * price
          totalValue += pos.currentValue || (pos.size || 0) * (pos.avgPrice || 0);
          totalBought += pos.totalBought || 0;
        }
      }
      console.log("[ClobClient] Balance from /positions:", totalValue);

      return {
        balance: totalValue,
        available: totalValue - totalBought,
        locked: 0,
        success: true,
        isLive: true,
      };
    }
    console.log("[ClobClient] /positions returned:", positionsResponse.status);

    // Third try: authenticated /balance (legacy - may not exist)
    if (signer && apiKeyCreds) {
      const timestamp = Math.floor(Date.now() / 1000);
      const authHeaders = await createL2Headers(signer!, apiKeyCreds!, {
        method: "GET",
        requestPath: "/balance",
      }, timestamp);

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

      if (response.ok) {
        const data = await response.json();
        const balance = parseFloat(data?.USDC || data?.balance || "0") / 1e6;
        return {
          balance,
          available: balance,
          locked: 0,
          success: true,
          isLive: true,
        };
      }

      console.log("[ClobClient] /balance (auth) returned:", response.status, await response.text().catch(() => ""));
    }

    // If all else fails, return 0 but don't error
    console.log("[ClobClient] Could not fetch balance. Using 0.");
    return {
      balance: 0,
      available: 0,
      locked: 0,
      success: true,
      isLive: true,
      error: "Could not fetch balance - may have no positions",
    };
  } catch (error) {
    console.error("[ClobClient] getBalance error:", error);
    return {
      balance: 0,
      available: 0,
      locked: 0,
      success: false,
      isLive: true,
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

    // Check if response is an error object
    if (!openOrders) {
      return { positions: [], success: true };
    }

    if (typeof openOrders === 'object' && 'error' in openOrders) {
      console.error("[ClobClient] getPositions API error:", openOrders.error);
      return { positions: [], success: false, error: String(openOrders.error) };
    }

    // Check if it's actually an array
    if (!Array.isArray(openOrders)) {
      console.error("[ClobClient] getPositions: unexpected response type", typeof openOrders);
      return { positions: [], success: false, error: "Unexpected response format" };
    }

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

    // Check if response is an error object
    if (!trades) {
      return { trades: [], success: true };
    }

    if (typeof trades === 'object' && 'error' in trades) {
      console.error("[ClobClient] getTrades API error:", trades.error);
      return { trades: [], success: false, error: String(trades.error) };
    }

    // Check if it's actually an array
    if (!Array.isArray(trades)) {
      console.error("[ClobClient] getTrades: unexpected response type", typeof trades);
      return { trades: [], success: false, error: "Unexpected response format" };
    }

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
    console.log("[ClobClient] placeOrder: tokenId=", params.tokenId, "side=", params.side, "price=", params.price, "size=", params.size);
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

    console.log("[ClobClient] placeOrder result:", JSON.stringify(orderResult));

    // Check if the response contains an error
    if (orderResult && (orderResult as any).error) {
      const errMsg = (orderResult as any).error || "Order placement failed";

      // If auth error, try direct API method as fallback
      if (errMsg.includes("Unauthorized") || errMsg.includes("Invalid api key")) {
        console.log("[ClobClient] Auth failed, trying direct API method...");
        const activeAcc = await accountStore.getActiveAccount();
        const pk = activeAcc?.privateKey || process.env.POLYMARKET_PRIVATE_KEY;
        if (pk) {
          const directResult = await placeOrderDirect({
            tokenId: params.tokenId,
            side: params.side,
            price: params.price,
            size: params.size,
            privateKey: pk,
          });
          return directResult;
        }
      }

      console.error("[ClobClient] placeOrder API error:", errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }

    return {
      success: true,
      orderId: orderResult?.orderID || orderResult?.id || "",
    };
  } catch (error) {
    console.error("[ClobClient] placeOrder exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get configuration status - now async to read from account store
 */
export async function getConfig(): Promise<{ hasCredentials: boolean; hasPrivateKey: boolean; walletAddress: string | null }> {
  // Try to get active account from store
  let activeWalletAddress: string | null = null;
  try {
    const activeAcc = await accountStore.getActiveAccount();
    activeWalletAddress = activeAcc?.walletAddress || null;
  } catch (e) {
    // Fallback to cached value
  }

  return {
    hasCredentials: !!(POLY_API_KEY && POLY_API_SECRET) || !!currentPrivateKey,
    hasPrivateKey: !!currentPrivateKey,
    walletAddress: activeWalletAddress || walletAddress,
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
  signer = null;
  walletAddress = null;
  currentPrivateKey = null;
  console.log("[ClobClient] Reset");
}
