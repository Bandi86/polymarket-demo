// Position Monitor - Auto take-profit and stop-loss for all open positions
// Polls open positions and closes them when TP/SL conditions are met

import { marketEngine } from "./market-engine";
import { botManager } from "./bot-manager";
import type { Position, StrategyType } from "../types";

export interface PositionTarget {
  positionId: string;
  entryOdds: number;         // Odds at entry (e.g. 0.10)
  takeProfitMultiplier: number; // e.g. 2.0 = close when odds double
  stopLossMultiplier: number;   // e.g. 0.5 = close when odds drop by half
  botId?: string;
  strategy?: string;
}

export interface MonitorStats {
  monitored: number;
  takeProfitHits: number;
  stopLossHits: number;
  totalPnl: number;
}

// TP/SL settings by strategy - null means no auto-exit for this strategy
// Both hyphenated (bot-id) and underscore (bot_id) formats supported
//
// MOMENTUM BOT SL POLICY (Volatility Breakout, Binance Velocity):
//   These bots bet on BTC direction which is almost always correct.
//   The old tight SL (0.6/0.7) was triggering on temporary liquidity dips,
//   cutting positions that would have won. Fix:
//     1. Widen SL multiplier (catastrophic-loss-only: 0.30/0.40)
//     2. Time-gate SL: only fire in the last 90 seconds (see checkPositions)
const STRATEGY_TP_SL: Record<string, { tp: number; sl: number } | null> = {
  // Ultra-low entry strategies - need room to bounce back
  odds_swing: { tp: 2.0, sl: 0.5 },
  sniper_value: { tp: 1.5, sl: 0.55 }, // Slightly wider SL for new wider zones
  sniper: { tp: 1.5, sl: 0.55 },       // Alias for sniper_value
  ultra_low_entry: { tp: 2.0, sl: 0.5 },
  ultra_low: { tp: 2.0, sl: 0.5 },

  // FIXED: Momentum/velocity strategies - BTC direction is usually correct.
  // SL widened dramatically + time-gated (only fires in last 90s).
  // These bots should RIDE the position; stop only on catastrophic reversal.
  binance_velocity: { tp: 1.3, sl: 0.40 }, // was 0.7 — now catastrophic-only + time-gated
  velocity: { tp: 1.3, sl: 0.40 },          // Alias for binance_velocity
  volatility_breakout: { tp: 1.4, sl: 0.30 }, // was 0.6 — now catastrophic-only + time-gated
  volatility: { tp: 1.4, sl: 0.30 },           // Alias for volatility_breakout

  // Mean reversion
  price_reversion: { tp: 1.5, sl: 0.60 }, // Slightly wider for new wider zones
  price: { tp: 1.5, sl: 0.60 },

  // Trend pullback — always ride to settlement (no SL; BTC trend holds)
  trend_pullback: null,

  // Legacy/other strategies - no auto-exit
  window_delta: null,
  last_seconds_scalp: null,
  binance_signal: null,
  monte_carlo: null,
  fair_value: null,
  momentum: null,
  mean_reversion: null,
  trend: null,
  smart_trend: null,
  contrarian: null,
  anomaly: null,
  momentum_burst: null,
  grid_trading: null,
  market_making: null,
  arbitrage: null,
  random: null,
  time_pattern: null,
};

// Strategies whose SL is time-gated: only fires in last N ms of the market.
// Prevents premature exits on temporary liquidity dips when direction is correct.
const MOMENTUM_STRATEGIES = new Set([
  "binance_velocity",
  "velocity",
  "volatility_breakout",
  "volatility",
]);
const MOMENTUM_SL_GATE_MS = 90_000; // Only fire SL in last 90 seconds

export class PositionMonitor {
  private targets: Map<string, PositionTarget> = new Map();
  private stats: MonitorStats = {
    monitored: 0,
    takeProfitHits: 0,
    stopLossHits: 0,
    totalPnl: 0,
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL = 500; // Check every 500ms
  private lastCheckedPositions = new Set<string>();

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkPositions(), this.POLL_INTERVAL);
    console.log("[PositionMonitor] Started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Register a position for auto TP/SL monitoring
   */
  register(target: PositionTarget): void {
    // Skip if this strategy doesn't have TP/SL enabled
    if (target.strategy) {
      const settings = STRATEGY_TP_SL[target.strategy];
      if (!settings) {
        // console.log(`[PositionMonitor] Skipping ${target.positionId} - no TP/SL for strategy ${target.strategy}`);
        return;
      }
      target.takeProfitMultiplier = settings.tp;
      target.stopLossMultiplier = settings.sl;
    }

    this.targets.set(target.positionId, target);
    this.stats.monitored++;
    console.log(
      `[PositionMonitor] Registered ${target.positionId} | TP: ${target.takeProfitMultiplier}x | SL: ${target.stopLossMultiplier}x | strategy: ${target.strategy || 'unknown'}`
    );
  }

  unregister(positionId: string): void {
    this.targets.delete(positionId);
  }

  private checkPositions(): void {
    const market = marketEngine.getCurrentMarket();
    if (!market) return;

    const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
    const openPositions = marketEngine.getOpenPositions();
    const openIds = new Set(openPositions.map((p) => p.id));

    // Auto-register new positions that don't have TP/SL yet
    for (const position of openPositions) {
      if (!this.targets.has(position.id) && position.botId) {
        // Try to determine strategy from botId
        const strategy = this.extractStrategyFromBotId(position.botId);
        if (strategy && STRATEGY_TP_SL[strategy]) {
          this.register({
            positionId: position.id,
            entryOdds: position.odds,
            takeProfitMultiplier: STRATEGY_TP_SL[strategy]!.tp,
            stopLossMultiplier: STRATEGY_TP_SL[strategy]!.sl,
            botId: position.botId,
            strategy,
          });
        }
      }
    }

    // Compute time remaining once for all positions
    const timeRemaining = market.endTime ? market.endTime - Date.now() : Infinity;

    for (const [positionId, target] of this.targets) {
      // Remove if already closed/settled
      if (!openIds.has(positionId)) {
        this.targets.delete(positionId);
        continue;
      }

      const position = openPositions.find((p) => p.id === positionId);
      if (!position) continue;

      const currentOdds =
        position.outcome === "YES" ? yesPrice : noPrice;
      const oddsRatio = currentOdds / target.entryOdds;

      // Take profit hit
      if (oddsRatio >= target.takeProfitMultiplier) {
        const closed = marketEngine.closePosition(positionId);
        if (closed) {
          this.stats.takeProfitHits++;
          this.stats.totalPnl += closed.pnl || 0;
          this.targets.delete(positionId);

          // CRITICAL: Update bot tracker so it can trade again
          if (target.botId) {
            const won = (closed.pnl || 0) >= 0;
            botManager.recordSettlement(target.botId, won, closed.pnl || 0);
          }

          console.log(
            `[PositionMonitor] ✅ TP hit ${positionId} | ${target.botId} | odds ${target.entryOdds.toFixed(3)} → ${currentOdds.toFixed(3)} | ratio: ${oddsRatio.toFixed(2)}x | PnL: $${(closed.pnl || 0).toFixed(2)}`
          );
        }
        continue;
      }

      // Stop loss hit
      if (oddsRatio <= target.stopLossMultiplier) {
        // TIME-GATED SL for momentum strategies:
        // BTC-directional bots (velocity, volatility) are correct on direction ~most of the time.
        // Temporary liquidity dips cause the odds to drop briefly before recovering.
        // Only fire SL in the final MOMENTUM_SL_GATE_MS (90s) to avoid premature exits.
        const isMomentum = target.strategy ? MOMENTUM_STRATEGIES.has(target.strategy) : false;
        if (isMomentum && timeRemaining > MOMENTUM_SL_GATE_MS) {
          console.log(
            `[PositionMonitor] ⏳ SL deferred (momentum, ${Math.round(timeRemaining / 1000)}s left) ${positionId} | ratio: ${oddsRatio.toFixed(2)}x`
          );
          continue; // Let it ride — BTC direction is likely correct
        }

        const closed = marketEngine.closePosition(positionId);
        if (closed) {
          this.stats.stopLossHits++;
          this.stats.totalPnl += closed.pnl || 0;
          this.targets.delete(positionId);

          // CRITICAL: Update bot tracker so it can trade again
          if (target.botId) {
            const won = (closed.pnl || 0) >= 0;
            botManager.recordSettlement(target.botId, won, closed.pnl || 0);
          }

          const gateNote = isMomentum ? " [time-gated, near-expiry]" : "";
          console.log(
            `[PositionMonitor] 🛑 SL hit${gateNote} ${positionId} | ${target.botId} | odds ${target.entryOdds.toFixed(3)} → ${currentOdds.toFixed(3)} | ratio: ${oddsRatio.toFixed(2)}x | PnL: $${(closed.pnl || 0).toFixed(2)}`
          );
        }
        continue;
      }
    }

    this.lastCheckedPositions = openIds;
  }

  /**
   * Extract strategy name from botId (e.g., "bot-ultra-low" -> "ultra_low")
   */
  private extractStrategyFromBotId(botId: string): string | null {
    const prefix = "bot-";
    if (!botId.startsWith(prefix)) return null;
    const strategy = botId.substring(prefix.length).replace(/-/g, '_');
    return strategy || null;
  }

  getStats(): MonitorStats {
    return { ...this.stats };
  }

  getTargets(): PositionTarget[] {
    return Array.from(this.targets.values());
  }

  resetStats(): void {
    this.stats = { monitored: 0, takeProfitHits: 0, stopLossHits: 0, totalPnl: 0 };
  }
}

// Singleton
export const positionMonitor = new PositionMonitor();
positionMonitor.start();