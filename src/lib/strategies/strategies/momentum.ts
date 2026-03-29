// Momentum Strategy - CRITICAL FIX
// Issue: -$2.30 loss, 47% win rate
// Fix: Higher threshold (0.07%), price limits

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { checkPriceLimits, calculateDelta, noTrade, trade } from "../base";

export const momentumStrategy: Strategy = {
  name: "BTC Momentum",
  description: "BTC momentum alapú kereskedés",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.momentum;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      return noTrade("Túl közel a záráshoz");
    }

    // BTC price change check
    if (ctx.btcPriceChange !== undefined && Math.abs(ctx.btcPriceChange) > 0.0005) {
      const pct = ctx.btcPriceChange * 100;

      // CRITICAL FIX: Higher threshold (0.07%)
      if (pct > (thresholds.minDelta ?? 0.07) && checkPriceLimits(ctx.marketPrice.yesPrice, thresholds)) {
        return trade("YES", Math.min(0.78, 0.50 + pct * 5), `BTC momentum +${pct.toFixed(3)}%`, { pct });
      }
      if (pct < -(thresholds.minDelta ?? 0.07) && checkPriceLimits(ctx.marketPrice.noPrice, thresholds)) {
        return trade("NO", Math.min(0.78, 0.50 + (-pct) * 5), `BTC momentum ${pct.toFixed(3)}%`, { pct });
      }
    }

    // Fallback: window delta
    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    if (deltaPct > (thresholds.minDelta ?? 0.07) && checkPriceLimits(ctx.marketPrice.yesPrice, thresholds)) {
      return trade("YES", Math.min(0.70, 0.50 + deltaPct * 4), `Window momentum +${deltaPct.toFixed(3)}%`, { deltaPct });
    }
    if (deltaPct < -(thresholds.minDelta ?? 0.07) && checkPriceLimits(ctx.marketPrice.noPrice, thresholds)) {
      return trade("NO", Math.min(0.70, 0.50 + (-deltaPct) * 4), `Window momentum ${deltaPct.toFixed(3)}%`, { deltaPct });
    }

    return noTrade("Nincs elég momentum vagy ár extrém");
  },
};

export default momentumStrategy;