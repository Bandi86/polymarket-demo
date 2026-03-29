// Oracle Lag Strategy (Binance Signal) - RESTORED from working version
// Signal freshness check only - NO strict price limits

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  calculateDelta,
  isSignalFresh,
  signalAlignsWithDelta,
  noTrade,
  trade,
} from "../base";

export const oracleLagStrategy: Strategy = {
  name: "Oracle Lag",
  description: "Binance valós idejű BTC ár előnye",
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

    // Signal missing or expired - fallback to window delta
    if (!signalValid) {
      const signalAge = binanceSignal ? Math.floor((Date.now() - binanceSignal.timestamp) / 1000) : -1;

      // Fallback: Use window delta if strong enough (> 0.07%)
      if (deltaPct > 0.07) {
        return trade(
          "YES",
          Math.min(0.70, 0.55 + deltaPct * 2),
          `Fallback UP delta: +${deltaPct.toFixed(3)}%`,
          { deltaPct, signalAge, fallback: true }
        );
      }
      if (deltaPct < -0.07) {
        return trade(
          "NO",
          Math.min(0.70, 0.55 + (-deltaPct) * 2),
          `Fallback DOWN delta: ${deltaPct.toFixed(3)}%`,
          { deltaPct, signalAge, fallback: true }
        );
      }

      return noTrade(`Signal ${binanceSignal ? `lejárt (${signalAge}s)` : 'nincs'}, delta gyenge`);
    }

    // Signal is valid - use it (NO price limits - just signal freshness)
    const action = binanceSignal!.type === "UP" ? "YES" : "NO";

    let confidence = binanceSignal!.confidence;

    // Delta confirmation bonus
    if (signalAlignsWithDelta(binanceSignal!.type, deltaPct)) {
      confidence = Math.min(0.95, confidence + 0.10);
    }

    // Strong change bonus
    if (Math.abs(binanceSignal!.changePercent) > 0.05) {
      confidence = Math.min(0.95, confidence + 0.08);
    }

    if (confidence < 0.45) {
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