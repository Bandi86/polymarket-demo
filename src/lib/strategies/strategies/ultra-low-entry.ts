// Smart Mean Reversion Strategy - IMPROVED
// FIXED: Much tighter zones + strict BTC confirmation

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const ultraLowEntryStrategy: Strategy = {
  name: "Smart Mean Reversion",
  description: "Tight mean reversion with strict BTC confirmation",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    // Get BTC data
    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;

    // ═══════════════════════════════════════════════════════════════
    // EXTREME ZONE DEFINITIONS - Only at the most extreme prices
    // ═══════════════════════════════════════════════════════════════

    // Low zones (buy YES) - EXTREME ONLY
    const ULTRA_LOW_MAX = 0.03;      // 3¢ - Maximum edge (was 6¢)
    const LOW_ENTRY_MAX = 0.10;      // 10¢ - Good edge (was 18¢)

    // High zones (buy NO) - EXTREME ONLY
    const OVERVALUED_MIN = 0.90;     // 90¢+ - Good edge (was 82¢)
    const ULTRA_HIGH_MIN = 0.97;    // 97¢+ - Maximum edge (was 94¢)

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 25000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA LOW (<6¢) - Maximum edge with stabilization
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_LOW_MAX) {
      if (priceVelocity < -0.015) {
        return noTrade(`Ultra-low but crashing: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isStabilizing = recentAvg >= olderAvg * 0.96;
        }
      }

      const priceDiscount = ULTRA_LOW_MAX - yesPrice;
      let confidence = Math.min(0.90, 0.70 + priceDiscount * 5);

      if (isStabilizing) confidence += 0.1;
      if (priceVelocity >= 0) confidence += 0.05;

      return trade(
        "YES",
        confidence,
        `ULTRA-LOW: YES @ ${(yesPrice * 100).toFixed(1)}¢`,
        { yesPrice, priceVelocity, zone: "ultra_low" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: LOW ENTRY (6-18¢) - Needs BTC confirmation
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= LOW_ENTRY_MAX) {
      if (priceVelocity < -0.01) {
        return noTrade(`Low but falling: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // FIX: Need BTC confirmation OR price at extreme
      const btcDeltaPct = btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;

      // Only trade if BTC is going up OR price is very low
      if (btcDeltaPct < 0.03 && yesPrice > 0.12) {
        return noTrade(`Low but BTC not supporting: ${btcDeltaPct.toFixed(2)}%`);
      }

      const priceDiscount = LOW_ENTRY_MAX - yesPrice;
      let confidence = Math.min(0.75, 0.55 + priceDiscount * 2);

      if (btcDeltaPct >= 0.03) confidence += 0.1;

      return trade(
        "YES",
        confidence,
        `LOW ZONE: YES @ ${(yesPrice * 100).toFixed(1)}¢ | BTC: ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
        { yesPrice, priceVelocity, btcDeltaPct, zone: "low_entry" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: ULTRA HIGH (>94%) - Maximum edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= ULTRA_HIGH_MIN) {
      if (priceVelocity > 0.015) {
        return noTrade(`Ultra-high but soaring: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // Check for stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isStabilizing = recentAvg <= olderAvg * 1.04;
        }
      }

      const pricePremium = yesPrice - ULTRA_HIGH_MIN;
      let confidence = Math.min(0.90, 0.70 + pricePremium * 5);

      if (isStabilizing) confidence += 0.1;
      if (priceVelocity <= 0) confidence += 0.05;

      return trade(
        "NO",
        confidence,
        `ULTRA-HIGH: YES @ ${(yesPrice * 100).toFixed(1)}¢`,
        { yesPrice, priceVelocity, zone: "ultra_high" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: HIGH ZONE (82-94%) - Needs BTC confirmation
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= OVERVALUED_MIN) {
      if (priceVelocity > 0.01) {
        return noTrade(`High but rising: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // FIX: Need BTC confirmation OR price at extreme
      const btcDeltaPct = btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;

      // Only trade if BTC is going down OR price is very high
      if (btcDeltaPct > -0.03 && yesPrice < 0.88) {
        return noTrade(`High but BTC not supporting: ${btcDeltaPct.toFixed(2)}%`);
      }

      const pricePremium = yesPrice - OVERVALUED_MIN;
      let confidence = Math.min(0.75, 0.55 + pricePremium * 2);

      if (btcDeltaPct <= -0.03) confidence += 0.1;

      return trade(
        "NO",
        confidence,
        `HIGH ZONE: YES @ ${(yesPrice * 100).toFixed(1)}¢ | BTC: ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
        { yesPrice, noPrice, priceVelocity, btcDeltaPct, zone: "high_entry" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // MIDDLE ZONE - DISABLED
    // These low-confidence BTC momentum trades caused too many losses
    // Only trading at extreme price zones now
    // ═══════════════════════════════════════════════════════════════
    /*
    if (btcPrice && btcWindowOpen) {
      const btcDeltaPct = ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;

      // FIX: Much higher threshold - need STRONG BTC momentum
      const minDelta = 0.10; // 0.10% (was 0.05%)

      if (Math.abs(btcDeltaPct) >= minDelta) {
        const action = btcDeltaPct > 0 ? "YES" : "NO";
        const confidence = Math.min(0.60, 0.45 + Math.abs(btcDeltaPct) * 3);

        return trade(
          action,
          confidence,
          `MOMENTUM: ${action} | BTC ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
          { btcDeltaPct, zone: "momentum_fallback" }
        );
      }
    }
    */

    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(1)}¢ (middle zone disabled)`);
  },
};

export default ultraLowEntryStrategy;