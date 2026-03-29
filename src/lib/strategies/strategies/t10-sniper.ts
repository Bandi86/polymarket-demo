// T-10 Sniper Strategy - Last 10-30 seconds scalp

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { checkPriceLimits, calculateDelta, signalAlignsWithDelta, noTrade, trade } from "../base";

export const t10SniperStrategy: Strategy = {
  name: "T-10 Sniper",
  description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
  category: "arbitrage",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.last_seconds_scalp;

    // Only active in last 30 seconds (down to 4s)
    if (ctx.timeRemaining > 30000 || ctx.timeRemaining < 4000) {
      return noTrade("Kívül a T-10 ablakon");
    }

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    // Min delta: 0.04%
    if (Math.abs(deltaPct) < (thresholds.minDelta ?? 0.04)) {
      return noTrade(`Delta túl kicsi: ${deltaPct.toFixed(4)}%`);
    }

    const action = deltaPct > 0 ? "YES" : "NO";
    const targetPrice = action === "YES" ? ctx.marketPrice.yesPrice : ctx.marketPrice.noPrice;

    // Price limits: 25-75¢
    if (!checkPriceLimits(targetPrice, { minPrice: 0.25, maxPrice: 0.75 })) {
      return noTrade(`Ár extrém: ${(targetPrice*100).toFixed(0)}¢`);
    }

    let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

    // Binance confirmation
    if (ctx.binanceSignal && ctx.binanceSignal.type !== "NEUTRAL") {
      if (signalAlignsWithDelta(ctx.binanceSignal.type, deltaPct)) {
        confidence = Math.min(0.85, confidence + 0.10);
      }
    }

    return trade(action, confidence, `T-10: ${action} @ ${(targetPrice*100).toFixed(0)}¢ | delta ${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(3)}%`, { deltaPct, targetPrice });
  },
};

export default t10SniperStrategy;