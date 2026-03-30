// Arbitrage Strategy - BTC delta vs market price difference
// NO strict price limits - confidence scoring handles risk

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { calculateDelta, calculateEdge, noTrade, trade } from "../base";

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

    // Buy YES if edge > minEdge - NO price limits, adjust confidence
    if (edge > minEdge) {
      let confidence = Math.min(0.78, 0.5 + edge * 3);
      if (ctx.marketPrice.yesPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.yesPrice < 0.25) confidence *= 0.70;
      return trade("YES", confidence, `Arb: fair=${(fairProb*100).toFixed(0)}% vs ${(ctx.marketPrice.yesPrice*100).toFixed(0)}¢`, { fairProb, edge, deltaPct });
    }

    // Buy NO if edge > minEdge - NO price limits
    const noEdge = calculateEdge(1 - fairProb, ctx.marketPrice.noPrice);
    if (noEdge > minEdge) {
      let confidence = Math.min(0.78, 0.5 + noEdge * 3);
      if (ctx.marketPrice.noPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.noPrice < 0.25) confidence *= 0.70;
      return trade("NO", confidence, `Arb DOWN=${((1-fairProb)*100).toFixed(0)}% vs ${(ctx.marketPrice.noPrice*100).toFixed(0)}¢`, { fairProb, noEdge, deltaPct });
    }

    return noTrade("Nincs elegendő edge");
  },
};

export default arbitrageStrategy;