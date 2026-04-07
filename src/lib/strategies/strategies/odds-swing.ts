// Odds Swing Strategy - FIXED v4
//
// PROBLEM: v2 assumed "extreme price = will swing back" which is WRONG
// The market prices EXTREME values for a reason - they're usually CORRECT
//
// FIX v4: Trade at extremes only with STRONG reversal evidence
// - Price must be STABILIZING and REVERSING
// - LOW confidence (market is usually right!)

import type { Strategy, StrategyContext } from "../../../types";
import { noTrade, trade } from "../base";

export const oddsSwingStrategy: Strategy = {
  name: "Odds Swing",
  description: "Swing trade at extremes with STRONG reversal evidence — market usually right",
  category: "other",
  execute: (ctx: StrategyContext) => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const timeRemaining = ctx.timeRemaining;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    // Minimum 60 seconds needed for swing (was 60s)
    if (timeRemaining < 60_000) {
      return noTrade("Too close to expiry for swing");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS - v4 (conservative)
    // ═══════════════════════════════════════════════════════════════
    const EXTREME_LOW = 0.08;  // <8¢ (was 15¢)
    const SWING_LOW = 0.20;    // 8-20¢ (was 15¢)
    const EXTREME_HIGH = 0.92; // >92¢ (was 90¢)
    const SWING_HIGH = 0.80;   // 80-92¢ (was 90¢)

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: EXTREME LOW YES (<8¢) - DON'T TRADE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= EXTREME_LOW) {
      return noTrade(`EXTREME-LOW skipped: ${(yesPrice * 100).toFixed(1)}¢ — market usually right`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: SWING YES (8-20¢) - NEEDS REVERSAL EVIDENCE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= SWING_LOW) {
      // 1. Must have positive velocity (reversing UP)
      if (priceVelocity < -0.005) {
        return noTrade(`Swing YES falling: ${(priceVelocity * 100).toFixed(2)}%/s - no reversal`);
      }

      // 2. Need strong reversal
      const isReversing = priceVelocity > 0.005;
      if (!isReversing) {
        return noTrade(`No reversal: velocity ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // 3. Check stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -2);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isStabilizing = recentAvg > olderAvg * 0.98;
        }
      }

      // 4. BTC check (optional positive confirmation)
      const btcPrice = ctx.btcPrice ?? 0;
      const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;
      const btcDelta = btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;
      const btcConfirm = btcDelta > 0.02;

      // FIX v4: LOW confidence at low price
      let confidence = 0.30;
      if (isStabilizing) confidence += 0.08;
      if (isReversing) confidence += 0.08;
      if (btcConfirm) confidence += 0.05;

      confidence = Math.min(0.48, confidence);

      return trade(
        "YES",
        confidence,
        `SWING-YES ${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}%`,
        { yesPrice, priceVelocity, zone: "swing_low_v4" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: EXTREME HIGH YES (>92¢) - DON'T TRADE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= EXTREME_HIGH) {
      return noTrade(`EXTREME-HIGH skipped: YES=${(yesPrice * 100).toFixed(1)}¢ — market usually right`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: SWING NO (YES 80-92¢) - NEEDS REVERSAL EVIDENCE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= SWING_HIGH) {
      // 1. Must have negative velocity (reversing DOWN)
      if (priceVelocity > 0.005) {
        return noTrade(`Swing NO rising: ${(priceVelocity * 100).toFixed(2)}%/s - no reversal`);
      }

      // 2. Need strong reversal
      const isReversing = priceVelocity < -0.005;
      if (!isReversing) {
        return noTrade(`No reversal: velocity ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // 3. Check stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -2);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          isStabilizing = recentAvg < olderAvg * 1.02;
        }
      }

      // 4. BTC check
      const btcPrice = ctx.btcPrice ?? 0;
      const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;
      const btcDelta = btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;
      const btcConfirm = btcDelta < -0.02;

      // FIX v4: LOW confidence at high price
      let confidence = 0.30;
      if (isStabilizing) confidence += 0.08;
      if (isReversing) confidence += 0.08;
      if (btcConfirm) confidence += 0.05;

      confidence = Math.min(0.48, confidence);

      return trade(
        "NO",
        confidence,
        `SWING-NO YES=${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}%`,
        { yesPrice, priceVelocity, zone: "swing_high_v4" }
      );
    }

    return noTrade(`No swing: YES=${(yesPrice * 100).toFixed(1)}¢`);
  },
};

export default oddsSwingStrategy;