// Fair Value Strategy - CRITICAL FIX
// Issue: -$5.49 loss, 36% win rate in 2h session
// Fixes: delta confirmation, tighter price range (30-65¢), higher minEdge

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  checkPriceLimits,
  calculateDelta,
  calculateEdge,
  calculateFairProb,
  noTrade,
  trade,
} from "../base";

export const fairValueStrategy: Strategy = {
  name: "Fair Value Arb",
  description: "Piac félreárazást keres - delta megerősítéssel",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.fair_value;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 15000)) {
      return noTrade("Túl közel a záráshoz");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    // CRITICAL FIX: Calculate BTC delta and require confirmation
    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    // CRITICAL FIX: Require minimum delta for confirmation
    if (Math.abs(deltaPct) < (thresholds.minDelta ?? 0.04)) {
      return noTrade(`Delta túl kicsi: ${deltaPct.toFixed(4)}% (min: ${thresholds.minDelta}%)`);
    }

    // Calculate fair probability based on delta
    const fairUpProb = calculateFairProb(deltaPct);
    const marketYes = ctx.marketPrice.yesPrice;
    const marketNo = ctx.marketPrice.noPrice;
    const edge = calculateEdge(fairUpProb, marketYes);

    const minEdge = thresholds.minEdge ?? 0.10; // CRITICAL: Increased from 0.07

    // Buy YES if edge > minEdge AND price in range AND delta confirms UP
    if (edge > minEdge && deltaPct > 0 && checkPriceLimits(marketYes, thresholds)) {
      return trade(
        "YES",
        Math.min(0.85, 0.5 + edge * 3),
        `Fair: P(UP)=${(fairUpProb*100).toFixed(0)}% vs ${(marketYes*100).toFixed(0)}¢`,
        { fairUpProb, edge, deltaPct }
      );
    }

    // Buy NO if edge > minEdge AND price in range AND delta confirms DOWN
    const noEdge = calculateEdge(1 - fairUpProb, marketNo);
    if (noEdge > minEdge && deltaPct < 0 && checkPriceLimits(marketNo, thresholds)) {
      return trade(
        "NO",
        Math.min(0.85, 0.5 + noEdge * 3),
        `Fair: P(DOWN)=${((1-fairUpProb)*100).toFixed(0)}% vs ${(marketNo*100).toFixed(0)}¢`,
        { fairDownProb: 1 - fairUpProb, noEdge, deltaPct }
      );
    }

    return noTrade(`Edge túl kicsi vagy delta nem egyértelmű`);
  },
};

export default fairValueStrategy;