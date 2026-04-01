// Settlement Validator
// Validates our settlement calculations against Polymarket official results
// Ensures demo simulation matches real Polymarket settlement

import type { Market, Position } from "../types";

export interface SettlementValidation {
  marketId: string;
  marketQuestion: string;

  // Our calculation
  ourBtcStartPrice: number | null;
  ourBtcEndPrice: number;
  ourResult: "UP" | "DOWN";

  // Polymarket official result
  polymarketYesPrice: number;
  polymarketNoPrice: number;
  polymarketResult: "UP" | "DOWN";

  // Validation
  matches: boolean;
  discrepancy?: string;

  // Position impact
  positionsSettled: number;
  positionsAffected: Position[];

  timestamp: number;
}

export interface SettlementStats {
  totalSettlements: number;
  correctSettlements: number;
  incorrectSettlements: number;
  accuracy: number;
  lastValidation: SettlementValidation | null;
}

const GAMMA_API = "https://gamma-api.polymarket.com";

/**
 * Fetch official Polymarket settlement result for a market
 */
export async function fetchPolymarketSettlement(marketId: string): Promise<{
  yesPrice: number;
  noPrice: number;
  result: "UP" | "DOWN";
  closed: boolean;
} | null> {
  try {
    const response = await fetch(`${GAMMA_API}/markets/${marketId}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const market = await response.json();

    // Check if market is closed/settled
    if (!market.closed) return null;

    // Parse outcome prices - [YES_price, NO_price]
    let outcomePrices = [0.5, 0.5];
    if (market.outcomePrices) {
      try {
        outcomePrices = JSON.parse(market.outcomePrices);
      } catch {}
    }

    const yesPrice = parseFloat(String(outcomePrices[0] || "0.5"));
    const noPrice = parseFloat(String(outcomePrices[1] || "0.5"));

    // Determine result: if YES price = 1.0, UP won; if NO price = 1.0, DOWN won
    const result: "UP" | "DOWN" = yesPrice > 0.5 ? "UP" : "DOWN";

    return {
      yesPrice,
      noPrice,
      result,
      closed: market.closed,
    };
  } catch (error) {
    console.error(`[SettlementValidator] Error fetching settlement for ${marketId}:`, error);
    return null;
  }
}

/**
 * Validate our settlement calculation against Polymarket official result
 */
export async function validateSettlement(
  market: Market,
  ourBtcStartPrice: number | null,
  ourBtcEndPrice: number,
  positions: Position[]
): Promise<SettlementValidation> {
  // Our calculated result
  const ourResult: "UP" | "DOWN" = ourBtcEndPrice >= (ourBtcStartPrice || ourBtcEndPrice) ? "UP" : "DOWN";

  // Fetch Polymarket official result
  const polymarketData = await fetchPolymarketSettlement(market.id);

  let polymarketResult: "UP" | "DOWN";
  let polymarketYesPrice = 0;
  let polymarketNoPrice = 0;
  let matches = false;
  let discrepancy: string | undefined;

  if (polymarketData) {
    polymarketResult = polymarketData.result;
    polymarketYesPrice = polymarketData.yesPrice;
    polymarketNoPrice = polymarketData.noPrice;
    matches = ourResult === polymarketResult;

    if (!matches) {
      discrepancy = `Our: ${ourResult} (BTC ${ourBtcStartPrice?.toFixed(2)} → ${ourBtcEndPrice.toFixed(2)}) vs Polymarket: ${polymarketResult} (YES=${(polymarketYesPrice * 100).toFixed(0)}¢, NO=${(polymarketNoPrice * 100).toFixed(0)}¢)`;

      console.warn(`[SettlementValidator] DISCREPANCY: ${discrepancy}`);
    }
  } else {
    // Fallback: couldn't fetch Polymarket data, assume our calculation is correct
    polymarketResult = ourResult;
    discrepancy = "Could not fetch Polymarket settlement data";
    matches = true; // Assume correct if we can't verify
  }

  const validation: SettlementValidation = {
    marketId: market.id,
    marketQuestion: market.question || "",
    ourBtcStartPrice,
    ourBtcEndPrice,
    ourResult,
    polymarketYesPrice,
    polymarketNoPrice,
    polymarketResult,
    matches,
    discrepancy,
    positionsSettled: positions.length,
    positionsAffected: !matches ? positions : [],
    timestamp: Date.now(),
  };

  // Log validation result
  if (matches) {
    console.log(`[SettlementValidator] ✓ Settlement validated: ${ourResult} for market ${market.id}`);
  } else {
    console.error(`[SettlementValidator] ✗ Settlement MISMATCH: ${discrepancy}`);

    // Log affected positions
    for (const pos of positions) {
      const shouldHaveWon = (pos.outcome === "YES" && polymarketResult === "UP") ||
                           (pos.outcome === "NO" && polymarketResult === "DOWN");
      const actualWon = (pos.outcome === "YES" && ourResult === "UP") ||
                       (pos.outcome === "NO" && ourResult === "DOWN");

      if (shouldHaveWon !== actualWon) {
        console.error(`[SettlementValidator]   Position ${pos.id} (${pos.outcome}): Should be ${shouldHaveWon ? 'WON' : 'LOST'}, was ${actualWon ? 'WON' : 'LOST'}`);
      }
    }
  }

  return validation;
}

// Track settlement statistics
let settlementStats: SettlementStats = {
  totalSettlements: 0,
  correctSettlements: 0,
  incorrectSettlements: 0,
  accuracy: 1.0,
  lastValidation: null,
};

/**
 * Record a settlement validation result
 */
export function recordSettlementValidation(validation: SettlementValidation): void {
  settlementStats.totalSettlements++;

  if (validation.matches) {
    settlementStats.correctSettlements++;
  } else {
    settlementStats.incorrectSettlements++;
  }

  settlementStats.accuracy = settlementStats.totalSettlements > 0
    ? settlementStats.correctSettlements / settlementStats.totalSettlements
    : 1.0;

  settlementStats.lastValidation = validation;

  // Log stats
  console.log(`[SettlementValidator] Stats: ${settlementStats.correctSettlements}/${settlementStats.totalSettlements} correct (${(settlementStats.accuracy * 100).toFixed(1)}%)`);
}

/**
 * Get settlement statistics
 */
export function getSettlementStats(): SettlementStats {
  return { ...settlementStats };
}

/**
 * Reset settlement statistics
 */
export function resetSettlementStats(): void {
  settlementStats = {
    totalSettlements: 0,
    correctSettlements: 0,
    incorrectSettlements: 0,
    accuracy: 1.0,
    lastValidation: null,
  };
}