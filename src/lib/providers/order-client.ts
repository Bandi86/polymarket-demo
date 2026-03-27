// Polymarket Order Client
// Handles order placement and cancellation

import { privateKeyToAccount } from "viem/accounts";

const CLOB_API = "https://clob.polymarket.com";

// EIP-712 domain for Polymarket
const POLYMARKET_DOMAIN = {
  name: "Polymarket CLOB",
  version: "1",
  chainId: 137,
  verifyingContract: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as `0x${string}`,
} as const;

const ORDER_TYPES = {
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

export interface OrderParams {
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

/**
 * Place an order on Polymarket CLOB
 */
export async function placeOrder(
  privateKey: string,
  params: OrderParams
): Promise<OrderResult> {
  if (!privateKey) {
    return { success: false, error: "No private key configured" };
  }

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    const account = privateKeyToAccount(pk);
    const address = account.address;

    // Generate order parameters
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = `${timestamp}-${Math.random().toString(36).slice(2)}`;
    const expiration = timestamp + 86400; // 24 hours

    // Calculate amounts
    const makerAmount = params.side === "BUY"
      ? Math.floor(params.price * params.size * 1e6)
      : Math.floor(params.size * 1e6);
    const takerAmount = params.side === "BUY"
      ? Math.floor(params.size * 1e6)
      : Math.floor(params.price * params.size * 1e6);

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
      domain: POLYMARKET_DOMAIN,
      types: ORDER_TYPES,
      primaryType: "Order",
      message: orderValue,
    });

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

    // Submit order
    const response = await fetch(`${CLOB_API}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { success: false, error: `Order failed: ${response.status}` };
    }

    const result = await response.json();
    return { success: true, orderId: result.orderId || result.id || nonce };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Cancel an order on Polymarket CLOB
 */
export async function cancelOrder(
  privateKey: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  if (!privateKey) {
    return { success: false, error: "No private key configured" };
  }

  try {
    const pk = privateKey.startsWith("0x")
      ? privateKey as `0x${string}`
      : `0x${privateKey}` as `0x${string}`;

    const account = privateKeyToAccount(pk);
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign cancel request
    const signature = await account.signTypedData({
      domain: POLYMARKET_DOMAIN,
      types: { Greeting: [{ name: "greeting", type: "string" }] },
      primaryType: "Greeting",
      message: { greeting: `cancel: ${orderId}` },
    });

    const response = await fetch(`${CLOB_API}/order/${orderId}`, {
      method: "DELETE",
      headers: {
        "POLY-ADDRESS": account.address,
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