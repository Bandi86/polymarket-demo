// Oracle Lag Strategy (Binance Signal) - CRITICAL FIX
// Issue: 0 trades in 2h session - signal not working
// Fixes: fallback to window delta, relaxed price limits (25-75¢)

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  checkPriceLimits,
  calculateDelta,
  isSignalFresh,
  signalAlignsWithDelta,
  noTrade,
  trade,
} from "../base";

export const oracleLagStrategy: Strategy = {
  name: "Oracle Lag",
  description: "Binance valós idejű BTC ár előnye - fallback to window delta",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.binance_signal;

    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 3000)) {
      return noTrade("Túl közel a záráshoz");
    }

    const binanceSignal = ctx.binanceSignal;
    const signalMaxAge = thresholds.signalMaxAge ?? 8000;

    // Check if signal exists and is fresh
    const signalFresh = binanceSignal ? isSignalFresh(binanceSignal.timestamp, signalMaxAge) : false;
    const signalValid = binanceSignal && binanceSignal.type !== "NEUTRAL" && signalFresh;

    // Calculate BTC delta for fallback/confirmation
    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice || 0;
    const deltaPct = ctx.btcPrice ? calculateDelta(ctx.btcPrice, windowOpen) : 0;

    // CRITICAL FIX: Fallback to window delta if signal expired or missing
    if (!signalValid) {
      const signalAge = binanceSignal ? Math.floor((Date.now() - binanceSignal.timestamp) / 1000) : -1;

      // Fallback: Use window delta logic if strong enough
      if (deltaPct > 0.08 && checkPriceLimits(ctx.marketPrice.yesPrice, thresholds)) {
        return trade(
          "YES",
          Math.min(0.70, 0.55 + deltaPct * 2),
          `Fallback UP delta: +${deltaPct.toFixed(3)}% (signal ${binanceSignal ? 'lejárt' : 'nincs'})`,
          { deltaPct, signalAge, fallback: true }
        );
      }
      if (deltaPct < -0.08 && checkPriceLimits(ctx.marketPrice.noPrice, thresholds)) {
        return trade(
          "NO",
          Math.min(0.70, 0.55 + (-deltaPct) * 2),
          `Fallback DOWN delta: ${deltaPct.toFixed(3)}% (signal ${binanceSignal ? 'lejárt' : 'nincs'})`,
          { deltaPct, signalAge, fallback: true }
        );
      }

      return noTrade(`Signal ${binanceSignal ? `lejárt (${signalAge}s)` : 'nincs'}, delta gyenge`);
    }

    // Signal is valid - use it
    const action = binanceSignal!.type === "UP" ? "YES" : "NO";
    const targetPrice = action === "YES" ? ctx.marketPrice.yesPrice : ctx.marketPrice.noPrice;

    // CRITICAL FIX: Relaxed price limits (25-75¢) for oracle
    if (targetPrice < 0.25 || targetPrice > 0.75) {
      return noTrade(`Ár extrém: ${(targetPrice*100).toFixed(0)}¢`);
    }

    let confidence = binanceSignal!.confidence;

    // Delta confirmation bonus
    if (signalAlignsWithDelta(binanceSignal!.type, deltaPct)) {
      confidence = Math.min(0.95, confidence + 0.10);
    } else {
      confidence = confidence * 0.7;
    }

    // Strong change bonus
    if (Math.abs(binanceSignal!.changePercent) > 0.05) {
      confidence = Math.min(0.95, confidence + 0.08);
    }

    if (confidence < (thresholds.minConfidence ?? 0.45)) {
      return noTrade(`Konfidencia túl alacsony: ${(confidence*100).toFixed(0)}%`);
    }

    const signalAge = Math.floor((Date.now() - binanceSignal!.timestamp) / 1000);

    return trade(
      action,
      confidence,
      `Oracle: BTC ${binanceSignal!.type} ${binanceSignal!.changePercent.toFixed(4)}%`,
      { signalAge, deltaPct, aligned: signalAlignsWithDelta(binanceSignal!.type, deltaPct) }
    );
  },
};

export default oracleLagStrategy;