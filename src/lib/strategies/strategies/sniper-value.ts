// Smart Sniper Strategy
// Fixed version: Wider zones + BTC momentum fallback + no confidence blocking
//
// Key insights from testing:
// - Original zones (15-40¢) too narrow - no trades
// - Need wider zones: 10-40¢ for YES, 60-90¢ for NO
// - Add BTC momentum fallback for middle zone
// - Remove strict confidence blocking (let strategies decide)

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const sniperValueStrategy: Strategy = {
  name: "Smart Sniper",
  description: "Extreme price sniper with wider zones + BTC fallback",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;
    const priceHistory = ctx.priceHistory || [];

    // Get BTC data for fallback
    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS (WIDER for more trades)
    // ═══════════════════════════════════════════════════════════════

    // YES zones
    const SNIPER_YES_MAX = 0.40;   // 40¢ max for YES sniper
    const ULTRA_YES_MAX = 0.15;    // 15¢ max for ultra sniper

    // NO zones
    const SNIPER_NO_MIN = 0.60;    // 60¢ min for NO sniper
    const ULTRA_NO_MIN = 0.85;     // 85¢ min for ultra sniper

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK - Avoid last 20 seconds
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 20000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA SNIPER YES (4-15¢) - Maximum edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_YES_MAX) {
      // Don't catch falling knife
      const droppingFast = priceVelocity < -0.02;
      if (droppingFast) {
        return noTrade(`Ultra sniper YES but crashing: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Check for stabilization
      let isStabilizing = false;
      if (priceHistory.length >= 5) {
        const recent = priceHistory.slice(-3);
        const older = priceHistory.slice(-5, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        isStabilizing = recentAvg >= olderAvg * 0.95;
      }

      // Higher confidence for lower price
      const priceDiscount = ULTRA_YES_MAX - yesPrice;
      let confidence = Math.min(0.90, 0.65 + priceDiscount * 3);

      if (isStabilizing) confidence += 0.05;
      if (priceVelocity >= 0) confidence += 0.03;

      return trade(
        "YES",
        confidence,
        `ULTRA-SNIPER: YES @ ${(yesPrice * 100).toFixed(1)}¢ (target: 50¢+)`,
        { yesPrice, priceVelocity, zone: "ultra_sniper" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: SNIPER YES (15-40¢) - Good edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= SNIPER_YES_MAX) {
      const fallingFast = priceVelocity < -0.015;
      if (fallingFast) {
        return noTrade(`Sniper YES but falling: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      const priceDiscount = SNIPER_YES_MAX - yesPrice;
      const confidence = Math.min(0.75, 0.55 + priceDiscount * 1.5);

      return trade(
        "YES",
        confidence,
        `SNIPER YES: ${(yesPrice * 100).toFixed(1)}¢`,
        { yesPrice, priceVelocity, zone: "sniper_yes" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: ULTRA SNIPER NO (YES > 85¢)
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= ULTRA_NO_MIN) {
      const risingFast = priceVelocity > 0.02;
      if (risingFast) {
        return noTrade(`Ultra sniper NO but soaring: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      const pricePremium = yesPrice - ULTRA_NO_MIN;
      const confidence = Math.min(0.90, 0.65 + pricePremium * 3);

      return trade(
        "NO",
        confidence,
        `ULTRA-SNIPER: NO @ ${(noPrice * 100).toFixed(1)}¢ (YES=${(yesPrice * 100).toFixed(1)}¢)`,
        { yesPrice, noPrice, priceVelocity, zone: "ultra_sniper_no" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: SNIPER NO (60-85¢) - Buy NO when YES is expensive
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= SNIPER_NO_MIN) {
      const risingFast = priceVelocity > 0.015;
      if (risingFast) {
        return noTrade(`Sniper NO but rising: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      const pricePremium = yesPrice - SNIPER_NO_MIN;
      const confidence = Math.min(0.75, 0.55 + pricePremium * 1.5);

      return trade(
        "NO",
        confidence,
        `SNIPER NO: NO @ ${(noPrice * 100).toFixed(1)}¢ (YES=${(yesPrice * 100).toFixed(1)}¢)`,
        { yesPrice, noPrice, priceVelocity, zone: "sniper_no" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 5: MIDDLE ZONE (40-60¢) - BTC momentum fallback
    // ═══════════════════════════════════════════════════════════════
    if (btcPrice && btcWindowOpen) {
      const btcDeltaPct = ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;

      const minDelta = 0.05;  // Clear BTC momentum needed

      if (Math.abs(btcDeltaPct) >= minDelta) {
        const action = btcDeltaPct > 0 ? "YES" : "NO";
        const confidence = Math.min(0.65, 0.50 + Math.abs(btcDeltaPct) * 2);

        return trade(
          action,
          confidence,
          `SNIPER MOMENTUM: ${action} | BTC ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
          { btcDeltaPct, zone: "momentum" }
        );
      }
    }

    // No edge in middle zone
    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(1)}¢ (no sniper edge)`);
  },
};

export default sniperValueStrategy;