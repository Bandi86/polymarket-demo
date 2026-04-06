// Smart Price Reversion Strategy
// Fixed version: Tighter zones + BTC momentum fallback
//
// Key insights from testing:
// - Original zones (25-75¢) were too narrow
// - Need wider zones: 10-35¢ for YES, 65-90¢ for NO
// - Add BTC momentum filter for middle zone
// - Focus on Polymarket price action, not BTC direction

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

export const priceReversionStrategy: Strategy = {
  name: "Smart Price Reversion",
  description: "Polymarket price reversion with wider zones + BTC fallback",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;

    // Get BTC data for fallback
    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;
    const btcVelocity = ctx.btcVelocity ?? 0;

    // ═══════════════════════════════════════════════════════════════
    // ZONE DEFINITIONS (WIDER)
    // ═══════════════════════════════════════════════════════════════

    // BUY YES zones (price too low = undervalued)
    const BUY_YES_MAX = 0.35;     // Below 35¢ = buy YES

    // BUY NO zones (price too high = overvalued)
    const BUY_NO_MIN = 0.65;      // Above 65¢ = buy NO

    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK - Avoid last 15 seconds
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 15000;
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 1: YES UNDERVALUED (10-35¢)
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice <= BUY_YES_MAX) {
      // Check if price is stabilizing (reversal setup)
      const fallingFast = priceVelocity < -0.015;
      const fallingModerate = priceVelocity < -0.005;

      // If still falling fast, wait for stabilization
      if (fallingFast) {
        return noTrade(`YES undervalued but falling fast: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      // If falling moderately, check for stabilization
      if (fallingModerate) {
        return noTrade(`YES still dropping, waiting for stabilization`);
      }

      // Price stabilizing or recovering - BUY YES
      // Confidence based on how far from "fair" (50¢)
      const priceDiscount = BUY_YES_MAX - yesPrice;
      const confidence = Math.min(0.80, 0.55 + priceDiscount * 1.5);

      return trade(
        "YES",
        confidence,
        `REVERSION YES: ${(yesPrice * 100).toFixed(1)}¢ (undervalued, target: 50¢+)`,
        { yesPrice, priceVelocity, zone: "undervalued" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 2: NO UNDERVALUED (YES > 65¢)
    // ═══════════════════════════════════════════════════════════════
    if (yesPrice >= BUY_NO_MIN) {
      // Check if price is peaking
      const risingFast = priceVelocity > 0.015;
      const risingModerate = priceVelocity > 0.005;

      if (risingFast) {
        return noTrade(`YES overvalued but rising fast: ${(yesPrice * 100).toFixed(1)}¢`);
      }

      if (risingModerate) {
        return noTrade(`YES still rising, waiting for peak`);
      }

      // Price stabilizing or dropping - BUY NO
      const pricePremium = yesPrice - BUY_NO_MIN;
      const confidence = Math.min(0.80, 0.55 + pricePremium * 1.5);

      return trade(
        "NO",
        confidence,
        `REVERSION NO: YES @ ${(yesPrice * 100).toFixed(1)}¢ (NO=${(noPrice * 100).toFixed(1)}¢)`,
        { yesPrice, noPrice, priceVelocity, zone: "overvalued" }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ZONE 3: MIDDLE (35-65¢) - BTC momentum fallback
    // ═══════════════════════════════════════════════════════════════
    if (btcPrice && btcWindowOpen) {
      const btcDeltaPct = ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;

      // Use velocity + acceleration for stronger signal
      const minDelta = 0.04;  // Lower threshold for reversion

      if (Math.abs(btcDeltaPct) >= minDelta) {
        // Also check BTC velocity direction
        const btcDirection = btcDeltaPct > 0 ? 1 : -1;
        const velocityDirection = btcVelocity > 0 ? 1 : -1;

        // Only trade if momentum is consistent (velocity matches delta)
        if (btcDirection === velocityDirection || Math.abs(btcDeltaPct) > 0.08) {
          const action = btcDeltaPct > 0 ? "YES" : "NO";
          const confidence = Math.min(0.60, 0.45 + Math.abs(btcDeltaPct) * 2);

          return trade(
            action,
            confidence,
            `BTC MOMENTUM: ${action} | BTC ${btcDeltaPct >= 0 ? '+' : ''}${btcDeltaPct.toFixed(2)}%`,
            { btcDeltaPct, btcVelocity, zone: "btc_fallback" }
          );
        }
      }
    }

    // No edge in middle zone
    return noTrade(`Middle zone: YES=${(yesPrice * 100).toFixed(1)}¢ (reversion: wait for 35¢/65¢)`);
  },
};

export default priceReversionStrategy;