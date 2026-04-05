// Volatility Breakout Strategy
// Only trades when BTC volatility is extreme
// High volatility = directional movement = more predictable 5-min direction

import type { Strategy, StrategyContext } from "../../../types";
import type { StrategyDecision } from "../types";
import { strategyConfig } from "../config";
import { noTrade, trade } from "../base";

export const volatilityBreakoutStrategy: Strategy = {
  name: "Volatility Breakout",
  description: "Trades only at extreme volatility - high vol = directional movement",
  category: "momentum",
  execute: (ctx: StrategyContext): StrategyDecision => {
    const thresholds = strategyConfig.volatility_breakout;

    // Time check - avoid last 30 seconds
    if (ctx.timeRemaining < (thresholds.minTimeRemaining ?? 30000)) {
      return noTrade("Too close to closure");
    }

    // Get BTC volatility
    const btcVol = ctx.btcVolatility ?? 0;
    const minHighVol = thresholds.minHighVolatility ?? 0.003; // 0.3%
    const maxLowVol = thresholds.maxLowVolatility ?? 0.001;   // 0.1%

    // Need BTC price
    if (!ctx.btcPrice) {
      return noTrade("No BTC price");
    }

    // Calculate delta for direction
    const windowOpen = ctx.btcWindowOpen || ctx.btcPrice;
    const deltaPct = windowOpen > 0 ? ((ctx.btcPrice - windowOpen) / windowOpen) * 100 : 0;

    // HIGH VOLATILITY: Strong directional movement expected
    if (btcVol > minHighVol) {
      // Need minimum delta for direction
      const minDelta = thresholds.minDelta ?? 0.03;
      if (Math.abs(deltaPct) < minDelta) {
        return noTrade(`High vol but delta small: ${deltaPct.toFixed(4)}%`);
      }

      const action = deltaPct > 0 ? "YES" : "NO";
      // Higher confidence in high volatility
      const volBoost = Math.min(0.2, (btcVol - minHighVol) * 50);
      const confidence = Math.min(0.85, 0.60 + Math.abs(deltaPct) * 3 + volBoost);

      return trade(
        action,
        confidence,
        `High Vol Breakout: ${action} @ ${(ctx.marketPrice.yesPrice * 100).toFixed(0)}¢ | vol=${(btcVol * 100).toFixed(2)}% delta=${deltaPct.toFixed(3)}%`,
        { btcVol, deltaPct, mode: "high_vol" }
      );
    }

    // LOW VOLATILITY: Consolidation breakout setup
    if (btcVol < maxLowVol) {
      // Only trade if there's a breakout (delta starting to form)
      const breakoutDelta = thresholds.breakoutDelta ?? 0.05;
      if (Math.abs(deltaPct) > breakoutDelta) {
        const action = deltaPct > 0 ? "YES" : "NO";
        const confidence = Math.min(0.75, 0.55 + Math.abs(deltaPct) * 2);

        return trade(
          action,
          confidence,
          `Low Vol Breakout: ${action} @ ${(ctx.marketPrice.yesPrice * 100).toFixed(0)}¢ | vol=${(btcVol * 100).toFixed(2)}% delta=${deltaPct.toFixed(3)}%`,
          { btcVol, deltaPct, mode: "low_vol_breakout" }
        );
      }

      return noTrade(`Low vol consolidation: vol=${(btcVol * 100).toFixed(3)}%`);
    }

    // MEDIUM VOLATILITY: Skip - no edge
    return noTrade(`Medium volatility: ${(btcVol * 100).toFixed(3)}% (no edge)`);
  },
};

export default volatilityBreakoutStrategy;