// Momentum Strategy - Uses configurable thresholds
// NO price limits, lower threshold

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { calculateDelta, noTrade, trade } from "../base";

export const momentumStrategy: Strategy = {
  name: "BTC Momentum",
  description: "BTC momentum alapú kereskedés",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.momentum;
    const minDelta = thresholds.minDelta ?? 0.02;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      return noTrade("Túl közel a záráshoz");
    }

    // BTC price change check - NO price limits
    if (ctx.btcPriceChange !== undefined && Math.abs(ctx.btcPriceChange) > 0.0005) {
      const pct = ctx.btcPriceChange * 100;

      if (pct > minDelta) {
        return trade("YES", Math.min(0.78, 0.50 + pct * 5), `BTC momentum +${pct.toFixed(3)}%`, { pct });
      }
      if (pct < -minDelta) {
        return trade("NO", Math.min(0.78, 0.50 + (-pct) * 5), `BTC momentum ${pct.toFixed(3)}%`, { pct });
      }
    }

    // Fallback: window delta - NO price limits
    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    if (deltaPct > minDelta) {
      return trade("YES", Math.min(0.70, 0.50 + deltaPct * 4), `Window momentum +${deltaPct.toFixed(3)}%`, { deltaPct });
    }
    if (deltaPct < -minDelta) {
      return trade("NO", Math.min(0.70, 0.50 + (-deltaPct) * 4), `Window momentum ${deltaPct.toFixed(3)}%`, { deltaPct });
    }

    return noTrade("Nincs elég momentum");
  },
};

export default momentumStrategy;