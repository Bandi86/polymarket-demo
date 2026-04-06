// Smart Mean Reversion Strategy
// Fixed version: Tighter zones + BTC momentum fallback
//
// Key insights from testing:
// - Original "dead zone" (25-85¢) was too large - 80% of time price was there
// - Need wider zones: 10-35¢ for YES, 65-90¢ for NO
// - Add BTC momentum fallback for middle zone
// - Don't fight strong trends
//
// Entry zones:
// - YES: 10-35¢ (undervalued) - Buy YES expecting reversion to 50¢+
// - NO: 65-90¢ (overvalued) - Buy NO expecting reversion to 50¢-
// - Fallback: BTC momentum when in middle zone

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const ultraLowEntryStrategy: Strategy = {
  name: "Smart Mean Reversion",
  description: "Mean reversion with wider zones + BTC momentum fallback",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;

    // Get BTC data for momentum fallback
    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;
    const btcVelocity = ctx.btcVelocity ?? 0;

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS (WIDER for more trades)
    // ═══════════════════════════════════════════════════════════════

    // Low zones (buy YES)
    const ULTRA_LOW_MAX = 0.10;      // 4-10¢ - Maximum edge
    const LOW_ENTRY_MAX = 0.35;      // 10-35¢ - Good edge

    // High zones (buy NO)
    const OVERVALUED_MIN = 0.65;     // 65-90¢ - Good edge
    const ULTRA_HIGH_MIN = 0.90;    // 90¢+ - Maximum edge

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK - Avoid last 15 seconds
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 15000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: ULTRA LOW (4-10¢) - Maximum edge
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= ULTRA_LOW_MAX) {
      const droppingFast = priceVelocity < -0.025;
      if (droppingFast) {
        return noTrade(`Ultra-low but crashing: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Higher confidence for lower price
      const priceDiscount = ULTRA_LOW_MAX - yesPrice;
      const confidence = Math.min(0.90, 0.70 + priceDiscount * 4);

      return trade(
        "YES",
        confidence,
        `ULTRA-LOW: YES @ ${(yesPrice * 100).toFixed(1)}¢`,
        { yesPrice, priceVelocity, zone: "ultra_low" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: LOW ENTRY (10-35¢) - Good edge, high probability
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= LOW_ENTRY_MAX) {
      const fallingFast = priceVelocity < -0.02;
      if (fallingFast) {
        return noTrade(`Low but falling fast: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // Confidence based on how far from "fair" (50¢)
      const priceDiscount = LOW_ENTRY_MAX - yesPrice;
      const confidence = Math.min(0.75, 0.55 + priceDiscount * 1.5);

      return trade(
        "YES",
        confidence,
        `LOW ZONE: YES @ ${(yesPrice * 100).toFixed(1)}¢ (fair: 50¢)`,
        { yesPrice, priceVelocity, zone: "low_entry" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: OVERVALUED (65-90¢) - Good edge, NO is cheap
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= ULTRA_HIGH_MIN) {
      const risingFast = priceVelocity > 0.025;
      if (risingFast) {
        return noTrade(`Ultra-high but soaring: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      const pricePremium = yesPrice - ULTRA_HIGH_MIN;
      const confidence = Math.min(0.90, 0.70 + pricePremium * 4);

      return trade(
        "NO",
        confidence,
        `ULTRA-HIGH: YES @ ${(yesPrice * 100).toFixed(1)}¢ (NO cheap)`,
        { yesPrice, priceVelocity, zone: "ultra_high" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 4: HIGH ZONE (65-90¢) - Buy NO
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= OVERVALUED_MIN) {
      const risingFast = priceVelocity > 0.02;
      if (risingFast) {
        return noTrade(`High but rising fast: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      const pricePremium = yesPrice - OVERVALUED_MIN;
      const confidence = Math.min(0.75, 0.55 + pricePremium * 1.5);

      return trade(
        "NO",
        confidence,
        `HIGH ZONE: YES @ ${(yesPrice * 100).toFixed(1)}¢ (NO cheap)`,
        { yesPrice, priceVelocity, zone: "high_entry" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 5: MIDDLE ZONE (35-65¢) - Use BTC momentum fallback
    // ═══════════════════════════════════════════════════════════════
    // Only use momentum if there's clear BTC direction
    if (btcPrice && btcWindowOpen) {
      const btcDeltaPct = ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;

      // Strong BTC momentum (> 0.05%) - follow the direction
      const minDelta = 0.05;
      if (Math.abs(btcDeltaPct) >= minDelta) {
        const action = btcDeltaPct > 0 ? "YES" : "NO";
        const confidence = Math.min(0.65, 0.50 + Math.abs(btcDeltaPct) * 2);

        return trade(
          action,
          confidence,
          `MOMENTUM FALLBACK: ${action} | BTC ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
          { btcDeltaPct, zone: "momentum_fallback" }
        );
      }
    }

    // No edge in middle zone without BTC momentum
    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(1)}¢ (no BTC edge)`);
  },
};

export default ultraLowEntryStrategy;