import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { noTrade, trade } from "../base";

// Trend Pullback Strategy - FIXED v2
// Trades when BTC has a clear directional trend and Polymarket price lags behind.
//
// FIXES:
//  - BTC delta threshold lowered: 0.05% → 0.03% (was too strict, often missed valid setups)
//  - Price zone widened: 0.60 → 0.68 (YES can lag up to 68¢ even during strong BTC up)
//  - Velocity no longer required to be negative (just "not rapidly rising")
//    The classic pullback bonus (+0.07 confidence) is still given for active dips
//  - Same mirror logic for the DOWN trend / NO trade

export const trendPullbackStrategy: Strategy = {
  name: "Trend Pullback",
  description: "Buys Polymarket lag vs. BTC trend — fires when market price hasn't caught up",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    // ═══════════════════════════════════════════════════════════════
    // TIME CHECK
    // ═══════════════════════════════════════════════════════════════
    const minTimeRemaining = 30000; // 30 seconds minimum
    if (ctx.timeRemaining < minTimeRemaining) {
      return noTrade("Too close to closure");
    }

    const btcPrice = ctx.btcPrice ?? 0;
    const btcWindowOpen = ctx.btcWindowOpen ?? btcPrice;

    if (!btcPrice || btcPrice <= 0) {
      return noTrade("No BTC price");
    }

    const btcDeltaPct =
      btcWindowOpen > 0 ? ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100 : 0;
    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;

    // ═══════════════════════════════════════════════════════════════
    // STRONG BTC UP TREND → BUY YES (Market is lagging BTC rise)
    // ═══════════════════════════════════════════════════════════════
    // FIX: Threshold 0.05 → 0.03  |  Zone 0.60 → 0.68
    //      Velocity: no longer must be negative — just not aggressively rising
    if (btcDeltaPct > 0.03) {
      if (yesPrice <= 0.68 && priceVelocity <= 0.003) {
        const btcStrength = Math.min(0.25, (btcDeltaPct - 0.03) * 4);
        const discount = Math.max(0, 0.68 - yesPrice);
        const baseConfidence = 0.58;
        // Classic pullback bonus: price is actively dipping despite BTC going up
        const pullbackBonus = priceVelocity < -0.0005 ? 0.07 : 0;
        const confidence = Math.min(
          0.85,
          baseConfidence + btcStrength + discount * 1.5 + pullbackBonus
        );

        return trade(
          "YES",
          confidence,
          `Pullback UP: YES @ ${(yesPrice * 100).toFixed(1)}¢ | BTC: +${btcDeltaPct.toFixed(2)}%`,
          { yesPrice, btcDeltaPct, priceVelocity, type: "pullback_yes" }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STRONG BTC DOWN TREND → BUY NO (Market is lagging BTC fall)
    // ═══════════════════════════════════════════════════════════════
    if (btcDeltaPct < -0.03) {
      if (noPrice <= 0.68 && priceVelocity >= -0.003) {
        const btcStrength = Math.min(0.25, (Math.abs(btcDeltaPct) - 0.03) * 4);
        const discount = Math.max(0, 0.68 - noPrice);
        const baseConfidence = 0.58;
        // Classic pullback bonus: YES is rising (NO dipping) despite BTC falling
        const pullbackBonus = priceVelocity > 0.0005 ? 0.07 : 0;
        const confidence = Math.min(
          0.85,
          baseConfidence + btcStrength + discount * 1.5 + pullbackBonus
        );

        return trade(
          "NO",
          confidence,
          `Pullback DOWN: NO @ ${(noPrice * 100).toFixed(1)}¢ | BTC: ${btcDeltaPct.toFixed(2)}%`,
          { noPrice, btcDeltaPct, priceVelocity, type: "pullback_no" }
        );
      }
    }

    return noTrade(
      `No setup: BTC=${btcDeltaPct.toFixed(2)}% YES=${(yesPrice * 100).toFixed(1)}¢ vel=${(priceVelocity * 100).toFixed(2)}%/s`
    );
  },
};

export default trendPullbackStrategy;
