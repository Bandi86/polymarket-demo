// Arbitrage Strategy - BTC delta vs market price difference

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { checkPriceLimits, calculateDelta, calculateEdge, noTrade, trade } from "../base";

export const arbitrageStrategy: Strategy = {
  name: "Arbitrage",
  description: "BTC delta vs piac ár különbség",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.arbitrage;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000) ||
        ctx.timeRemaining > (thresholds.maxTimeRemaining ?? 240000)) {
      return noTrade("Kívül az aktív időszakon");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice || 0;
    const deltaPct = ctx.btcPrice ? calculateDelta(ctx.btcPrice, windowOpen) : 0;

    // Min delta: 0.04%
    if (Math.abs(deltaPct) < (thresholds.minDelta ?? 0.04)) {
      return noTrade("Delta nem egyértelmű");
    }

    const fairProb = 0.5 + deltaPct * 4;
    const edge = calculateEdge(fairProb, ctx.marketPrice.yesPrice);

    const minEdge = thresholds.minEdge ?? 0.08;

    // Only trade in reasonable price range (30-65 cents)
    if (edge > minEdge && checkPriceLimits(ctx.marketPrice.yesPrice, thresholds)) {
      return trade("YES", Math.min(0.78, 0.5 + edge * 3), `Arb: fair=${(fairProb*100).toFixed(0)}% vs ${(ctx.marketPrice.yesPrice*100).toFixed(0)}¢`, { fairProb, edge, deltaPct });
    }

    const noEdge = calculateEdge(1 - fairProb, ctx.marketPrice.noPrice);
    if (noEdge > minEdge && checkPriceLimits(ctx.marketPrice.noPrice, thresholds)) {
      return trade("NO", Math.min(0.78, 0.5 + noEdge * 3), `Arb DOWN=${((1-fairProb)*100).toFixed(0)}% vs ${(ctx.marketPrice.noPrice*100).toFixed(0)}¢`, { fairProb, noEdge, deltaPct });
    }

    return noTrade("Nincs elegendő edge vagy ár extrém");
  },
};

export default arbitrageStrategy;