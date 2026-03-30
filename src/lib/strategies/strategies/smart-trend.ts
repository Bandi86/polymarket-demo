// Smart Trend Strategy - Multi-timeframe trend + BTC confirmation
// NO strict price limits - confidence scoring handles risk

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { calculateDelta, noTrade, trade } from "../base";

export const smartTrendStrategy: Strategy = {
  name: "Smart Trend",
  description: "Multi-timeframe trend + BTC megerősítés",
  category: "trend",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.smart_trend;

    if (ctx.priceHistory.length < 10 || ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      return noTrade("Nincs elég adat");
    }

    const shortTerm = ctx.priceHistory.slice(-3);
    const mediumTerm = ctx.priceHistory.slice(-8);
    const longTerm = ctx.priceHistory.slice(-15);

    const shortAvg = shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length;
    const mediumAvg = mediumTerm.reduce((a, b) => a + b, 0) / mediumTerm.length;
    const longAvg = longTerm.length > 0 ? longTerm.reduce((a, b) => a + b, 0) / longTerm.length : mediumAvg;

    const shortTrendUp = shortAvg > mediumAvg;
    const mediumTrendUp = mediumAvg > longAvg;

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice || 0;
    const deltaPct = ctx.btcPrice ? calculateDelta(ctx.btcPrice, windowOpen) : 0;

    const btcConfirmsUp = deltaPct > (thresholds.minDelta ?? 0.03);
    const btcConfirmsDown = deltaPct < -(thresholds.minDelta ?? 0.03);

    // NO PRICE LIMITS - just confidence adjustment
    let confidence = thresholds.minConfidence ?? 0.72;

    if (shortTrendUp && mediumTrendUp && btcConfirmsUp) {
      // Adjust confidence based on price (not blocking)
      if (ctx.marketPrice.yesPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.yesPrice < 0.25) confidence *= 0.70;
      return trade("YES", confidence, "Trend UP + BTC megerősítve", { shortAvg, mediumAvg, deltaPct });
    }
    if (!shortTrendUp && !mediumTrendUp && btcConfirmsDown) {
      // Adjust confidence based on price (not blocking)
      if (ctx.marketPrice.noPrice > 0.80) confidence *= 0.85;
      else if (ctx.marketPrice.noPrice < 0.25) confidence *= 0.70;
      return trade("NO", confidence, "Trend DOWN + BTC megerősítve", { shortAvg, mediumAvg, deltaPct });
    }

    return noTrade("Vegyes jelzések");
  },
};

export default smartTrendStrategy;