// Smart Price Reversion Strategy - FIXED v4
//
// PROBLEM: v3 assumed "price too low = will revert" which is WRONG
// The market prices EXTREME values for a reason - they're usually CORRECT
//
// FIX v4: Trade AGAINST extreme only with STRONG reversal evidence
// - Price must be STABILIZING (not falling further)
// - PriceVelocity must show reversal direction
// - LOW confidence at extreme (the market is usually right!)

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const priceReversionStrategy: Strategy = {
  name: "Smart Price Reversion",
  description: "Mean reversion with STRONG reversal evidence — market is usually right",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;
    const btcDeltaPct =
      btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS - v4 (conservative)
    // ═══════════════════════════════════════════════════════════════
    const PURE_EXTREME_YES = 0.10;  // <10¢ — don't trade extreme
    const BUY_YES_MAX = 0.20;       // 10-20¢ — need strong reversal evidence
    const PURE_EXTREME_NO = 0.90;  // >90¢ — don't trade extreme
    const BUY_NO_MIN = 0.80;        // 80-90¢ — need strong reversal evidence

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 60000; // 60s
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: PURE EXTREME YES (<10¢) - DON'T TRADE
    // Market is usually RIGHT at extreme
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= PURE_EXTREME_YES) {
      return noTrade(
        `Extreme YES skipped: ${(yesPrice * 100).toFixed(1)}¢ — market usually right at extreme`
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: REVERSION YES (10-20¢) - NEEDS REVERSAL EVIDENCE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= BUY_YES_MAX) {
      // 1. Must have positive velocity (reversing up)
      if (priceVelocity < 0) {
        return noTrade(`Reversion YES falling: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // 2. Need significant reversal signal
      const isReversing = priceVelocity > 0.005;
      if (!isReversing) {
        return noTrade(`No reversal: velocity ${(priceVelocity * 100).toFixed(2)}%`);
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

      // FIX v4: LOW confidence - market is usually right!
      let confidence = 0.32;
      if (isStabilizing) confidence += 0.08;
      if (isReversing) confidence += 0.08;
      if (btcDeltaPct > 0.02) confidence += 0.05;

      confidence = Math.min(0.50, confidence);

      return trade(
        "YES",
        confidence,
        `REVERSION-YES ${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}%`,
        { yesPrice, priceVelocity, btcDeltaPct, zone: "reversion_yes_v4" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: PURE EXTREME NO (YES >90¢) - DON'T TRADE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= PURE_EXTREME_NO) {
      return noTrade(
        `Extreme NO skipped: YES=${(yesPrice * 100).toFixed(1)}¢ — market usually right`
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: REVERSION NO (YES 80-90¢) - NEEDS REVERSAL EVIDENCE
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= BUY_NO_MIN) {
      // 1. Must have negative velocity (reversing down)
      if (priceVelocity > 0) {
        return noTrade(`Reversion NO rising: ${(priceVelocity * 100).toFixed(2)}%/s`);
      }

      // 2. Need significant reversal signal
      const isReversing = priceVelocity < -0.005;
      if (!isReversing) {
        return noTrade(`No reversal: velocity ${(priceVelocity * 100).toFixed(2)}%`);
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

      // FIX v4: LOW confidence
      let confidence = 0.32;
      if (isStabilizing) confidence += 0.08;
      if (isReversing) confidence += 0.08;
      if (btcDeltaPct < -0.02) confidence += 0.05;

      confidence = Math.min(0.50, confidence);

      return trade(
        "NO",
        confidence,
        `REVERSION-NO YES=${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}%`,
        { yesPrice, priceVelocity, btcDeltaPct, zone: "reversion_no_v4" }
      );
    }

    return noTrade(
      `No reversion signal: YES=${(yesPrice * 100).toFixed(1)}¢ BTC=${btcDeltaPct.toFixed(2)}%`
    );
  },
};

export default priceReversionStrategy;