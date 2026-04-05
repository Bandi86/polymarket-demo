// Price Reversion Strategy
// Bets on Polymarket price mean-reversion, NOT BTC direction
// When YES price drops to 15-25¢, it often recovers regardless of BTC
// This is a market microstructure edge, not BTC prediction

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { noTrade, trade } from "../base";

export const priceReversionStrategy: Strategy = {
  name: "Price Reversion",
  description: "Plays Polymarket price reversion - independent of BTC",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.price_reversion;

    // Time check - avoid last 15 seconds
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 15000)) {
      return noTrade("Too close to closure");
    }

    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const priceVelocity = ctx.priceVelocity ?? 0;

    // Oversold YES: price dropped too low
    const oversoldYes = thresholds.oversoldYes ?? 0.25;
    const overboughtYes = thresholds.overboughtYes ?? 0.75;

    // Check if price is in reversion zone
    // YES is oversold (cheap) - buy YES expecting reversion
    if (yesPrice < oversoldYes) {
      // Check if velocity is slowing (reversal setup)
      const velocitySlowing = priceVelocity < 0 && Math.abs(priceVelocity) < 0.01;

      if (velocitySlowing || priceVelocity >= 0) {
        // Price already starting to recover or stabilizing
        const confidence = Math.min(0.80, 0.55 + (oversoldYes - yesPrice) * 2);
        return trade(
          "YES",
          confidence,
          `Price Reversion: YES oversold @ ${(yesPrice * 100).toFixed(0)}¢ | velocity=${priceVelocity.toFixed(4)}`,
          { yesPrice, priceVelocity, mode: "oversold_yes" }
        );
      }

      // Still dropping fast - wait
      return noTrade(`YES oversold but still falling: velocity=${priceVelocity.toFixed(4)}`);
    }

    // YES is overbought (expensive) - buy NO expecting reversion
    if (yesPrice > overboughtYes) {
      // Check if velocity is slowing
      const velocitySlowing = priceVelocity > 0 && Math.abs(priceVelocity) < 0.01;

      if (velocitySlowing || priceVelocity <= 0) {
        // Price starting to drop or stabilizing
        const confidence = Math.min(0.80, 0.55 + (yesPrice - overboughtYes) * 2);
        return trade(
          "NO",
          confidence,
          `Price Reversion: NO (YES overbought) @ ${(noPrice * 100).toFixed(0)}¢ | velocity=${priceVelocity.toFixed(4)}`,
          { yesPrice, noPrice, priceVelocity, mode: "overbought_yes" }
        );
      }

      // Still rising fast - wait
      return noTrade(`YES overbought but still rising: velocity=${priceVelocity.toFixed(4)}`);
    }

    // Price in middle range - no reversion edge
    return noTrade(`Price in middle: YES=${(yesPrice * 100).toFixed(0)}¢ (no reversion edge)`);
  },
};

export default priceReversionStrategy;