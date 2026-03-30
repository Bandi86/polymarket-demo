// T-10 Sniper Strategy - Last 10-30 seconds scalp
// NO strict price limits - confidence scoring handles risk

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { calculateDelta, signalAlignsWithDelta, noTrade, trade } from "../base";

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

    // NO PRICE LIMITS - confidence adjusts based on price instead
    // High prices (>80¢): reduce confidence
    // Low prices (<25¢): reduce confidence (lottery zone)
    let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

    // Price-based confidence adjustment (not blocking)
    if (targetPrice > 0.80) {
      confidence *= 0.85; // Reduce but don't block
    } else if (targetPrice < 0.25) {
      confidence *= 0.70; // Lottery zone - reduce more
    }

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