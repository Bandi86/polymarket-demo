// Ultra Low Entry Strategy - X Strategy Clone
// Based on: 7¢-22¢ range where market gives <22% but oracle confirms at ~80%
// Key: Chainlink oracle updates BTC price vs Polymarket odds divergence

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const ultraLowEntryStrategy: Strategy = {
  name: "Ultra Low Entry (X Strategy)",
  description: "7¢-22¢ range: market gives <22% but oracle confirms at ~80%",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    // ═══════════════════════════════════════════════════════════════
    // X STRATEGY RANGE: 7¢ - 22¢
    // ═══════════════════════════════════════════════════════════════
    const LOW_ZONE_MAX = 0.22;   // 22¢ - upper limit of the range
    const ENTRY_MIN = 0.07;      // 7¢ - lower limit of the range (real edge starts here)

    // Ultra zones for max confidence
    const ULTRA_LOW_MAX = 0.10;  // 10¢ - maximum edge zone

    // High zones (buy NO) - mirror the low side
    const HIGH_ZONE_MIN = 0.78;  // 78¢ - mirror of 22¢ (100% - 22%)
    const ULTRA_HIGH_MIN = 0.90;  // 90¢ - ultra high zone

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK - Need at least 30 seconds for 5-min market resolution
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 30000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade(`Too close to settlement: ${Math.round(ctx.timeRemaining/1000)}s`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA LOW (<10¢) - Maximum edge zone
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_LOW_MAX) {
      // Don't trade if price is crashing too fast
      if (priceVelocity < -0.02) {
        return noTrade(`Crashing too fast: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for stabilization or reversal
      let isStabilizing = false;
      if (priceHistory.length >= 4) {
        const recent = priceHistory.slice(-2);
        const older = priceHistory.slice(-4, -2);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          // Stabilizing = not falling further
          isStabilizing = recentAvg >= olderAvg * 0.97;
        }
      }

      // Calculate confidence based on how deep in the zone
      const depth = ULTRA_LOW_MAX - yesPrice;
      let confidence = 0.65 + depth * 3; // 0.65-0.95 range (slightly lower than before)

      if (isStabilizing) confidence += 0.08;
      if (priceVelocity >= 0) confidence += 0.05;
      confidence = Math.min(0.95, confidence);

      return trade(
        "YES",
        confidence,
        `ULTRA-LOW: YES @ ${(yesPrice * 100).toFixed(1)}¢ (oracle divergence)`,
        { yesPrice, priceVelocity, zone: "ultra_low" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: LOW ENTRY (7¢-22¢) - X Strategy sweet spot
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= LOW_ZONE_MAX && yesPrice >= ENTRY_MIN) {
      // Don't trade if price is crashing
      if (priceVelocity < -0.015) {
        return noTrade(`Falling too fast: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for reversal signals
      let isReversing = false;
      if (priceHistory.length >= 3) {
        const recent = priceHistory.slice(-2);
        const older = priceHistory.slice(-3, -1);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          // Reversing = price going up after being low
          isReversing = recentAvg > olderAvg;
        }
      }

      // Calculate confidence - deeper = higher confidence
      const depth = LOW_ZONE_MAX - yesPrice;
      let confidence = 0.50 + depth * 1.5; // 0.50-0.73 range for 7¢-22¢ (slightly lower)

      // Boost for reversal signal
      if (isReversing) confidence += 0.12;
      // Boost if price was falling and now stabilizing
      if (priceVelocity >= -0.005 && priceVelocity < 0.01) confidence += 0.08;

      confidence = Math.min(0.85, confidence);

      return trade(
        "YES",
        confidence,
        `X-ZONE: YES @ ${(yesPrice * 100).toFixed(1)}¢ (target: 7¢-22¢ range)`,
        { yesPrice, priceVelocity, zone: "x_zone" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: ULTRA HIGH (>90¢) - Mirror of ultra low
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= ULTRA_HIGH_MIN) {
      if (priceVelocity > 0.02) {
        return noTrade(`Soaring too fast: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 4) {
        const recent = priceHistory.slice(-2);
        const older = priceHistory.slice(-4, -2);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isStabilizing = recentAvg <= olderAvg * 1.03;
        }
      }

      const depth = yesPrice - ULTRA_HIGH_MIN;
      let confidence = 0.70 + depth * 3;

      if (isStabilizing) confidence += 0.08;
      if (priceVelocity <= 0) confidence += 0.05;
      confidence = Math.min(0.95, confidence);

      return trade(
        "NO",
        confidence,
        `ULTRA-HIGH: NO @ ${(yesPrice * 100).toFixed(1)}¢ (oracle divergence)`,
        { yesPrice, priceVelocity, zone: "ultra_high" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: HIGH ZONE (78¢-90¢) - Mirror of X zone
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= HIGH_ZONE_MIN && yesPrice < ULTRA_HIGH_MIN) {
      if (priceVelocity > 0.015) {
        return noTrade(`Rising too fast: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for reversal
      let isReversing = false;
      if (priceHistory.length >= 3) {
        const recent = priceHistory.slice(-2);
        const older = priceHistory.slice(-3, -1);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isReversing = recentAvg < olderAvg;
        }
      }

      const depth = yesPrice - HIGH_ZONE_MIN;
      let confidence = 0.55 + depth * 1.5;

      if (isReversing) confidence += 0.12;
      if (priceVelocity <= 0.005 && priceVelocity > -0.01) confidence += 0.08;

      confidence = Math.min(0.85, confidence);

      return trade(
        "NO",
        confidence,
        `X-ZONE-HIGH: NO @ ${(yesPrice * 100).toFixed(1)}¢ (target: 78¢-90¢ range)`,
        { yesPrice, priceVelocity, zone: "x_zone_high" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // OUTSIDE ZONES - No trade
    // ═══════════════════════════════════════════════════════════════
    const priceDisplay = (yesPrice * 100).toFixed(1);
    if (yesPrice < ENTRY_MIN) {
      return noTrade(`Price too low: ${priceDisplay}¢ (below 7¢ entry)`);
    }
    if (yesPrice > (1 - HIGH_ZONE_MIN)) {
      return noTrade(`Price too high: ${priceDisplay}¢ (above ${((1-HIGH_ZONE_MIN)*100).toFixed(0)}¢)`);
    }

    return noTrade(`Outside X zone: YES=${priceDisplay}¢`);
  },
};

export default ultraLowEntryStrategy;