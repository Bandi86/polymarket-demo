// Position Monitor - Auto take-profit and stop-loss for all open positions
// Polls open positions and closes them when TP/SL conditions are met

import { marketEngine } from "./market-engine";
import type { Position } from "../types";

export interface PositionTarget {
  positionId: string;
  entryOdds: number;         // Odds at entry (e.g. 0.10)
  takeProfitMultiplier: number; // e.g. 2.0 = close when odds double
  stopLossMultiplier: number;   // e.g. 0.5 = close when odds drop by half
  botId?: string;
}

export interface MonitorStats {
  monitored: number;
  takeProfitHits: number;
  stopLossHits: number;
  totalPnl: number;
}

export class PositionMonitor {
  private targets: Map<string, PositionTarget> = new Map();
  private stats: MonitorStats = {
    monitored: 0,
    takeProfitHits: 0,
    stopLossHits: 0,
    totalPnl: 0,
  };
  private timer: Timer | null = null;
  private readonly POLL_INTERVAL = 500; // Check every 500ms

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
    this.targets.set(target.positionId, target);
    this.stats.monitored++;
    console.log(
      `[PositionMonitor] Registered ${target.positionId} | TP: ${target.takeProfitMultiplier}x | SL: ${target.stopLossMultiplier}x`
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
          console.log(
            `[PositionMonitor] ✅ TP hit ${positionId} | odds ${target.entryOdds.toFixed(3)} → ${currentOdds.toFixed(3)} | PnL: $${(closed.pnl || 0).toFixed(2)}`
          );
        }
        continue;
      }

      // Stop loss hit
      if (oddsRatio <= target.stopLossMultiplier) {
        const closed = marketEngine.closePosition(positionId);
        if (closed) {
          this.stats.stopLossHits++;
          this.stats.totalPnl += closed.pnl || 0;
          this.targets.delete(positionId);
          console.log(
            `[PositionMonitor] 🛑 SL hit ${positionId} | odds ${target.entryOdds.toFixed(3)} → ${currentOdds.toFixed(3)} | PnL: $${(closed.pnl || 0).toFixed(2)}`
          );
        }
        continue;
      }
    }
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
