// Window Delta Strategy - RESTORED from working version
// NO price limits - was best performer on 2026-03-20

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import {
  checkTimeRemaining,
  calculateDelta,
  noTrade,
  trade,
} from "../base";

export const windowDeltaStrategy: Strategy = {
  name: "Window Delta",
  description: "BTC ár vs ablak nyitóár alapján - a legjobb 5m stratégia",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.window_delta;

    if (!ctx.btcPrice) {
      return noTrade("Nincs BTC ár");
    }

    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = calculateDelta(ctx.btcPrice, windowOpen);

    // Time checks only - NO price limits
    if (!checkTimeRemaining(ctx.timeRemaining, thresholds)) {
      return noTrade(ctx.timeRemaining < 3000 ? "Túl késő" : "Ablak eleje");
    }

    // Strong signal: delta > 0.12% (from config)
    if (deltaPct > 0.12) {
      return trade(
        "YES",
        Math.min(0.92, 0.70 + (deltaPct - 0.12) * 3),
        `Erős UP delta: +${deltaPct.toFixed(3)}%`,
        { deltaPct, windowOpen }
      );
    }

    if (deltaPct < -0.12) {
      return trade(
        "NO",
        Math.min(0.92, 0.70 + (-deltaPct - 0.12) * 3),
        `Erős DOWN delta: ${deltaPct.toFixed(3)}%`,
        { deltaPct, windowOpen }
      );
    }

    // Medium signal: delta > 0.07% (RESTORED from config)
    if (deltaPct > 0.07) {
      return trade(
        "YES",
        Math.min(0.78, 0.55 + (deltaPct - 0.07) * 4),
        `UP delta: +${deltaPct.toFixed(3)}%`,
        { deltaPct, windowOpen }
      );
    }

    if (deltaPct < -0.07) {
      return trade(
        "NO",
        Math.min(0.78, 0.55 + (-deltaPct - 0.07) * 4),
        `DOWN delta: ${deltaPct.toFixed(3)}%`,
        { deltaPct, windowOpen }
      );
    }

    return noTrade(`Delta túl kicsi: ${deltaPct.toFixed(4)}%`);
  },
};

export default windowDeltaStrategy;