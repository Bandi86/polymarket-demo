// Smart Sniper Strategy - FIXED v4
//
// PROBLEM: v3 assumed "price too low = will revert" which is WRONG
// The market prices EXTREME values for a reason - they're usually CORRECT
//
// FIX v4: Trade AGAINST extreme only with STRONG reversal evidence:
// - Price must be STABILIZING (not falling further)
// - PriceVelocity must be POSITIVE (reversing up)
// - BTC must confirm (not strongly against)
// - LOW confidence at extreme (the market is usually right!)

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const sniperValueStrategy: Strategy = {
  name: "Smart Sniper",
  description: "Snipes reversals with STRONG evidence — market is usually right at extremes",
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
    const ULTRA_YES_MAX = 0.05;  // <5¢ ultra (was 8¢)
    const SNIPER_YES_MAX = 0.15; // 5-15¢ sniper (was 28¢)
    const ULTRA_NO_MIN = 0.95;   // >95¢ ultra (was 92¢)
    const SNIPER_NO_MIN = 0.85;  // 85-95¢ sniper (was 72¢)

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 60000; // 60s minimum (was 30s)
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA SNIPER YES (<5¢)
    // FIX v4: Don't trade at extreme - market is usually RIGHT!
    // Only trade with STRONG reversal evidence
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_YES_MAX) {
      // FIX: NO trade at ultra extreme - too risky
      // Market priced it there for a reason
      return noTrade(
        `ULTRA-YES skipped: ${(yesPrice * 100).toFixed(1)}¢ is too extreme - market usually right`
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: SNIPER YES (5-15¢) - NEEDS STRONG EVIDENCE
    // FIX v4: Strict requirements
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= SNIPER_YES_MAX) {
      // 1. Price must be stabilizing or reversing (NOT falling)
      if (priceVelocity < -0.008) {
        return noTrade(`Sniper YES falling: ${(priceVelocity * 100).toFixed(2)}%/s - no reversal`);
      }

      // 2. Need STRONG positive velocity (reversal in progress)
      const isReversing = priceVelocity > 0.003;
      if (!isReversing) {
        return noTrade(`Sniper NO: no reversal signal yet (velocity: ${(priceVelocity * 100).toFixed(2)}%)`);
      }

      // 3. BTC must not be strongly against
      if (btcDeltaPct < -0.03) {
        return noTrade(`BTC too bearish: ${btcDeltaPct.toFixed(2)}%`);
      }

      // 4. Check stabilization
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

      // FIX v4: LOW confidence at extreme - market is usually right!
      // Max 45% even with all signals
      let confidence = 0.35; // Base low confidence
      if (isStabilizing) confidence += 0.05;
      if (isReversing) confidence += 0.05;
      if (btcDeltaPct > 0) confidence += 0.03;

      confidence = Math.min(0.48, confidence); // Cap at 48%

      return trade(
        "YES",
        confidence,
        `SNIPER-YES ${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}% | BTC: ${btcDeltaPct.toFixed(2)}%`,
        { yesPrice, priceVelocity, btcDeltaPct, zone: "sniper_yes_v4" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: ULTRA SNIPER NO (YES >95¢)
    // FIX v4: Don't trade at extreme
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= ULTRA_NO_MIN) {
      return noTrade(
        `ULTRA-NO skipped: YES=${(yesPrice * 100).toFixed(1)}¢ is too extreme - market usually right`
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: SNIPER NO (YES 85-95¢) - NEEDS STRONG EVIDENCE
    // FIX v4: Strict requirements
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= SNIPER_NO_MIN) {
      // 1. Price must be stabilizing or reversing (NOT rising)
      if (priceVelocity > 0.008) {
        return noTrade(`Sniper NO rising: ${(priceVelocity * 100).toFixed(2)}%/s - no reversal`);
      }

      // 2. Need STRONG negative velocity (reversal in progress)
      const isReversing = priceVelocity < -0.003;
      if (!isReversing) {
        return noTrade(`Sniper NO: no reversal signal yet`);
      }

      // 3. BTC must not be strongly against
      if (btcDeltaPct > 0.03) {
        return noTrade(`BTC too bullish: ${btcDeltaPct.toFixed(2)}%`);
      }

      // 4. Check stabilization
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

      // FIX v4: LOW confidence at extreme - market is usually right!
      let confidence = 0.35;
      if (isStabilizing) confidence += 0.05;
      if (isReversing) confidence += 0.05;
      if (btcDeltaPct < 0) confidence += 0.03;

      confidence = Math.min(0.48, confidence);

      return trade(
        "NO",
        confidence,
        `SNIPER-NO YES=${(yesPrice * 100).toFixed(1)}¢ | vel: ${(priceVelocity * 100).toFixed(2)}% | BTC: ${btcDeltaPct.toFixed(2)}%`,
        { yesPrice, noPrice, priceVelocity, btcDeltaPct, zone: "sniper_no_v4" }
      );
    }

    return noTrade(
      `No sniper signal: YES=${(yesPrice * 100).toFixed(1)}¢ BTC=${btcDeltaPct.toFixed(2)}%`
    );
  },
};

export default sniperValueStrategy;
