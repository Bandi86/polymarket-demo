// Contrarian Strategy - BTC following (not true contrarian)
// NO strict price limits - confidence scoring handles risk

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { calculateDelta, noTrade, trade } from "../base";

export const contrarianStrategy: Strategy = {
  name: "Contrarian",
  description: "BTC követés - nem igazi contrarian",
  category: "mean_reversion",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.contrarian;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      return noTrade("Túl közel a záráshoz");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    // BTC UP - follow with confidence adjustment (NO price limits)
    if (deltaPct > (thresholds.minDelta ?? 0.05)) {
      let confidence = Math.min(0.75, 0.55 + deltaPct * 3);
      if (ctx.marketPrice.yesPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.yesPrice < 0.25) confidence *= 0.70;
      return trade("YES", confidence, `BTC +${deltaPct.toFixed(3)}% → követés`, { deltaPct });
    }

    // BTC DOWN - follow with confidence adjustment (NO price limits)
    if (deltaPct < -(thresholds.minDelta ?? 0.05)) {
      let confidence = Math.min(0.75, 0.55 + (-deltaPct) * 3);
      if (ctx.marketPrice.noPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.noPrice < 0.25) confidence *= 0.70;
      return trade("NO", confidence, `BTC ${deltaPct.toFixed(3)}% → követés`, { deltaPct });
    }

    // True contrarian: market extreme but BTC contradicts (NO blocking)
    if (ctx.marketPrice.yesPrice > 0.80 && deltaPct < -0.05) {
      return trade("NO", Math.min(0.75, 0.55 + (ctx.marketPrice.yesPrice - 0.70) * 3), `Contrarian: piac túl optimista`, { yesPrice: ctx.marketPrice.yesPrice, deltaPct });
    }
    if (ctx.marketPrice.noPrice > 0.80 && deltaPct > 0.05) {
      return trade("YES", Math.min(0.75, 0.55 + (ctx.marketPrice.noPrice - 0.70) * 3), `Contrarian: piac túl pesszimista`, { noPrice: ctx.marketPrice.noPrice, deltaPct });
    }

    return noTrade("Nincs jelzés");
  },
};

export default contrarianStrategy;