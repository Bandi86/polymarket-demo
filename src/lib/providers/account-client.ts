// Polymarket Account Client
// Handles authentication, balance, positions, and trades

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { ClobClient, Chain, AssetType } from "@polymarket/clob-client";
import type { PolymarketPositionResponse, PolymarketTradeResponse } from "../../types/provider.types";

const CLOB_API = "https://clob.polymarket.com";

// EIP-712 domain for Polymarket L2 authentication
const POLYMARKET_DOMAIN = {
  name: "Polymarket CLOB",
  version: "1",
  chainId: 137,
  verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
} as const;

const GREETING_TYPES = {
  Greeting: [{ name: "greeting", type: "string" }],
} as const;

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

export interface Trade {
  id: string;
  market: string;
  outcome: string;
  side: string;
  size: number;
  price: number;
  timestamp: number;
}

/**
 * Create L2 signature for Polymarket API authentication
 */
export async function createL2Signature(
  privateKey: `0x${string}`
): Promise<{ address: string; signature: string; timestamp: number }> {
  const account = privateKeyToAccount(privateKey);
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = await account.signTypedData({
    domain: POLYMARKET_DOMAIN,
    types: GREETING_TYPES,
    primaryType: "Greeting",
    message: { greeting: `greeting: ${timestamp}` },
  });

  return { address: account.address, signature, timestamp };
}

/**
 * Create headers for authenticated Polymarket API requests
 */
export async function createAuthHeaders(privateKey: `0x${string}`): Promise<Record<string, string>> {
  const { address, signature, timestamp } = await createL2Signature(privateKey);
  return {
    "POLY-ADDRESS": address,
    "POLY-SIGNATURE": signature,
    "POLY-TIMESTAMP": timestamp.toString(),
    "POLY-NONCE": timestamp.toString(),
    "Content-Type": "application/json",
  };
}

/**
 * Fetch account balance using private key
 * Uses @polymarket/clob-client for proper L2 authentication
 */
export async function fetchAccountBalance(privateKey: string): Promise<BalanceResult> {
  if (!privateKey) {
    return {
      balance: 0,
      available: 0,
      locked: 0,
      success: false,
      isLive: false,
      error: "No private key configured",
    };
  }

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    // Create viem wallet client for ClobClient
    const account = privateKeyToAccount(pk);
    const walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(),
    });
    const clobClient = new ClobClient(CLOB_API, Chain.POLYGON, walletClient);

    // Get USDC collateral balance and allowance
    const collateral = await clobClient.getBalanceAllowance({
      asset_type: AssetType.COLLATERAL,
    });

    const balance = parseFloat(collateral.balance || "0");
    const available = parseFloat(collateral.allowance || collateral.balance || "0");

    return {
      balance,
      available,
      locked: 0,
      success: true,
      isLive: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[fetchAccountBalance] Error:", errorMessage);

    return {
      balance: 0,
      available: 0,
      locked: 0,
      success: false,
      isLive: false,
      error: errorMessage,
    };
  }
}
/**
 * Fetch positions from Polymarket
 */
export async function fetchPositions(privateKey: string): Promise<{
  positions: Position[];
  success: boolean;
  error?: string;
}> {
  if (!privateKey) {
    return { positions: [], success: false, error: "No private key configured" };
  }

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    const headers = await createAuthHeaders(pk);

    const response = await fetch(`${CLOB_API}/positions`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { positions: [], success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    const positions = ((data as PolymarketPositionResponse[]) || []).map((p) => ({
      market: p.market ?? p.condition_id ?? "Unknown",
      outcome: p.outcome ?? "Unknown",
      shares: parseFloat(p.size ?? p.shares ?? "0"),
      avgPrice: parseFloat(p.avg_price ?? p.entryPrice ?? "0"),
      currentValue: parseFloat(p.current_value ?? "0"),
    }));

    return { positions, success: true };
  } catch (error) {
    return { positions: [], success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Fetch trades from Polymarket
 */
export async function fetchTrades(privateKey: string): Promise<{
  trades: Trade[];
  success: boolean;
  error?: string;
}> {
  if (!privateKey) {
    return { trades: [], success: false, error: "No private key configured" };
  }

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    const headers = await createAuthHeaders(pk);

    const response = await fetch(`${CLOB_API}/trades`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { trades: [], success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();

    const trades = ((data as PolymarketTradeResponse[]) || []).map((t) => ({
      id: t.id ?? t.transaction_hash ?? "",
      market: t.market ?? t.condition_id ?? "Unknown",
      outcome: t.outcome ?? "Unknown",
      side: t.side ?? "BUY",
      size: parseFloat(t.size ?? t.shares ?? "0"),
      price: parseFloat(t.price ?? t.avg_price ?? "0"),
      timestamp: typeof t.timestamp === 'string' ? parseInt(t.timestamp, 10)
        : typeof t.created_at === 'string' ? parseInt(t.created_at, 10)
        : Date.now(),
    }));

    return { trades, success: true };
  } catch (error) {
    return { trades: [], success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
/**
 * Place an order using direct API call with L2 signature auth
 */
export async function placeOrderDirect(params: {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  privateKey: string;
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const { tokenId, side, price, size, privateKey } = params;

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    const headers = await createAuthHeaders(pk);

    // Order payload
    const orderData = {
      token_id: tokenId,
      side: side.toLowerCase(),
      price: price.toString(),
      size: size.toString(),
    };

    console.log("[AccountClient] Placing order direct:", orderData);

    const response = await fetch(`${CLOB_API}/orders`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
      signal: AbortSignal.timeout(30000),
    });

    const result = await response.json();
    console.log("[AccountClient] Order response:", response.status, result);

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      orderId: result.orderID || result.id || "",
    };
  } catch (error) {
    console.error("[AccountClient] placeOrderDirect error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
