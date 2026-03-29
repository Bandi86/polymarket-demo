// Monte Carlo Strategy - BTC delta based probability estimation

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { checkPriceLimits, calculateDelta, calculateEdge, noTrade, trade } from "../base";

export const monteCarloStrategy: Strategy = {
  name: "Monte Carlo",
  description: "BTC delta alapú valószínűségi becslés",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.monte_carlo;

    // 30s - 4 min
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000) ||
        ctx.timeRemaining > (thresholds.maxTimeRemaining ?? 240000)) {
      return noTrade("Kívül az aktív ablakon");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    // Min delta: 0.04%
    if (Math.abs(deltaPct) < (thresholds.minDelta ?? 0.04)) {
      return noTrade(`Delta túl kicsi`);
    }

    let upProb = 0.5;
    if (deltaPct > 0) {
      upProb = Math.min(0.88, 0.55 + deltaPct * 3.5);
    } else {
      upProb = Math.max(0.12, 0.55 + deltaPct * 3.5);
    }

    const yesPrice = ctx.marketPrice.yesPrice;
    const noPrice = ctx.marketPrice.noPrice;
    const edge = calculateEdge(upProb, yesPrice);

    const minEdge = thresholds.minEdge ?? 0.10;

    // Buy YES if edge > minEdge AND price in range
    if (edge > minEdge && checkPriceLimits(yesPrice, thresholds)) {
      return trade("YES", Math.min(0.75, 0.5 + edge * 3), `MC: P(UP)=${(upProb*100).toFixed(0)}% vs ${(yesPrice*100).toFixed(0)}¢`, { upProb, edge, deltaPct });
    }

    // Buy NO if edge > minEdge AND price in range
    const noEdge = calculateEdge(1 - upProb, noPrice);
    if (noEdge > minEdge && checkPriceLimits(noPrice, thresholds)) {
      return trade("NO", Math.min(0.75, 0.5 + noEdge * 3), `MC: P(DOWN)=${((1-upProb)*100).toFixed(0)}% vs ${(noPrice*100).toFixed(0)}¢`, { upProb, noEdge, deltaPct });
    }

    return noTrade(`MC: edge túl kicsi vagy ár extrém`);
  },
};

export default monteCarloStrategy;