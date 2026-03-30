// Fair Value Strategy - Uses configurable thresholds
// NO price limits, NO delta confirmation, configurable edge threshold
// This was profitable on 2026-03-20 session

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  calculateEdge,
  calculateFairProb,
  noTrade,
  trade,
} from "../base";

export const fairValueStrategy: Strategy = {
  name: "Fair Value Arb",
  description: "Piac félreárazást keres - egyszerű edge alapján",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.fair_value;
    const minEdge = thresholds.minEdge ?? 0.02;

    // Time check only
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 15000)) {
      return noTrade("Túl közel a záráshoz");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    // Calculate BTC delta for fair probability
    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = (ctx.btcPrice - windowOpen) / windowOpen * 100;

    // Calculate fair probability based on delta
    const fairUpProb = calculateFairProb(deltaPct);
    const marketYes = ctx.marketPrice.yesPrice;
    const marketNo = ctx.marketPrice.noPrice;
    const edge = calculateEdge(fairUpProb, marketYes);

    // Buy YES if edge > minEdge - NO price limits, NO delta confirmation
    if (edge > minEdge) {
      return trade(
        "YES",
        Math.min(0.85, 0.5 + edge * 3),
        `Fair: P(UP)=${(fairUpProb*100).toFixed(0)}% vs ${(marketYes*100).toFixed(0)}¢`,
        { fairUpProb, edge, deltaPct }
      );
    }

    // Buy NO if edge > minEdge
    const noEdge = calculateEdge(1 - fairUpProb, marketNo);
    if (noEdge > minEdge) {
      return trade(
        "NO",
        Math.min(0.85, 0.5 + noEdge * 3),
        `Fair: P(DOWN)=${((1-fairUpProb)*100).toFixed(0)}% vs ${(marketNo*100).toFixed(0)}¢`,
        { fairDownProb: 1 - fairUpProb, noEdge, deltaPct }
      );
    }

    return noTrade(`Edge túl kicsi: ${Math.max(edge, noEdge).toFixed(3)}`);
  },
};

export default fairValueStrategy;