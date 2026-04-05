// Ultra Low Price Entry Strategy
// Based on Andrew's approach: @s4yonnara
//
// Key insights:
// - Enter at 4-15¢ instead of 50¢
// - The market says 4-15% chance, but reality is 60-70%
// - Not betting on BTC direction, but on the 5-minute window price action
// - Order flow, Funding rates, Liquidation clusters -> market adjusts, he's already in
// - Enters, Collects, Resets - nothing sits open
//
// Entry zones:
// - YES < 15¢ (undervalued) - Buy YES expecting reversion
// - YES > 85¢ (overvalued) - Buy NO expecting reversion
// - Ultra-low zone: 4-12¢ - Maximum edge, highest conviction

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const ultraLowEntryStrategy: Strategy = {
  name: "Ultra Low Entry",
  description: "Entry at 4-15¢ - market underestimates probability",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS (matching Andrew's approach)
    // ═══════════════════════════════════════════════════════════════

    // Ultra-low zone: 4-12¢ - Maximum edge (market says 4-12%, real is 60%+)
    const ULTRA_LOW_MAX = 0.12;

    // Low entry zone: 12-25¢ - Good edge
    const LOW_ENTRY_MAX = 0.25;

    // Overvalued zone: YES > 85¢ (NO is cheap)
    const OVERVALUED_MIN = 0.85;

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK - Avoid last 20 seconds
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 20000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA LOW (4-12¢) - Maximum edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_LOW_MAX) {
      // Check if price is stabilizing (not crashing further)
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        // Stabilizing if recent average not significantly lower
        isStabilizing = recentAvg >= olderAvg * 0.95;
      }

      // Don't catch a falling knife - need stabilization
      const droppingFast = priceVelocity < -0.02;
      if (droppingFast && !isStabilizing) {
        return noTrade(`Ultra-low but dropping fast: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Calculate confidence based on how low the price is
      // Lower price = higher confidence (more upside)
      const priceDiscount = ULTRA_LOW_MAX - yesPrice;
      let confidence = Math.min(0.92, 0.65 + priceDiscount * 3);

      // Boost if stabilizing
      if (isStabilizing) confidence += 0.05;
      if (priceVelocity >= 0) confidence += 0.03; // Already recovering

      return trade(
        "YES",
        Math.min(0.95, confidence),
        `ULTRA-LOW: YES @ ${(yesPrice * 100).toFixed(1)}¢ (edge: 60%+) | velocity=${priceVelocity.toFixed(4)}`,
        { yesPrice, priceVelocity, zone: "ultra_low" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: LOW ENTRY (12-25¢) - Good edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= LOW_ENTRY_MAX) {
      // Need some upward momentum or at least not falling
      const fallingFast = priceVelocity < -0.015;

      if (fallingFast) {
        return noTrade(`Low entry but falling: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Calculate confidence
      const priceDiscount = LOW_ENTRY_MAX - yesPrice;
      const confidence = Math.min(0.80, 0.55 + priceDiscount * 2);

      return trade(
        "YES",
        confidence,
        `LOW ENTRY: YES @ ${(yesPrice * 100).toFixed(1)}¢ | velocity=${priceVelocity.toFixed(4)}`,
        { yesPrice, priceVelocity, zone: "low_entry" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: OVERVALUED (YES > 85¢) - NO is cheap
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= OVERVALUED_MIN) {
      // Check if price is peaking (not rising further)
      let isPeaking = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        isPeaking = recentAvg <= olderAvg * 1.05;
      }

      // Don't chase if still rising fast
      const risingFast = priceVelocity > 0.02;
      if (risingFast && !isPeaking) {
        return noTrade(`Overvalued but still rising: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Calculate confidence
      const pricePremium = yesPrice - OVERVALUED_MIN;
      const confidence = Math.min(0.85, 0.60 + pricePremium * 2);

      return trade(
        "NO",
        confidence,
        `OVERVALUED: YES @ ${(yesPrice * 100).toFixed(1)}¢ (NO cheap @ ${(noPrice * 100).toFixed(1)}¢)`,
        { yesPrice, noPrice, priceVelocity, zone: "overvalued" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // MIDDLE ZONE - No edge, no trade
    // ═══════════════════════════════════════════════════════════════
    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(1)}¢ (no ultra-low edge)`);
  },
};

export default ultraLowEntryStrategy;