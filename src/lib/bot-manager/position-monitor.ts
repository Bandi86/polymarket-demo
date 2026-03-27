// Position Monitor
// Monitors open positions for stop-loss and take-profit triggers

import type { Position, Outcome } from "../../types";
import { botEventBus } from "./bot-event-bus";

export interface PositionRiskConfig {
  stopLossPercent: number;  // e.g., 0.1 = 10% loss triggers close
  takeProfitPercent: number; // e.g., 0.2 = 20% profit triggers close
  trailingStopPercent?: number; // Optional trailing stop
  maxHoldTimeMs?: number; // Maximum time to hold position
}

export interface MonitoredPosition {
  position: Position;
  botId: string;
  config: PositionRiskConfig;
  highestPrice: number;  // For trailing stop
  lowestPrice: number;   // For trailing stop
  monitoringSince: number;
}

export interface RiskCheckResult {
  shouldClose: boolean;
  reason: "stop_loss" | "take_profit" | "trailing_stop" | "max_hold_time" | "none";
  currentPnL: number;
  pnlPercent: number;
}

/**
 * Position Monitor Service
 * Independently monitors open positions for risk management triggers
 */
export class PositionMonitor {
  private monitoredPositions: Map<string, MonitoredPosition> = new Map();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 1000; // Check every second

  /**
   * Start monitoring a position
   */
  monitorPosition(
    position: Position,
    botId: string,
    config: PositionRiskConfig
  ): void {
    const entryPrice = position.odds;

    this.monitoredPositions.set(position.id, {
      position,
      botId,
      config,
      highestPrice: entryPrice,
      lowestPrice: entryPrice,
      monitoringSince: Date.now(),
    });

    console.log(`[PositionMonitor] Started monitoring position ${position.id} for bot ${botId}`);
    console.log(`[PositionMonitor] Stop-loss: ${config.stopLossPercent * 100}%, Take-profit: ${config.takeProfitPercent * 100}%`);
  }

  /**
   * Stop monitoring a position
   */
  stopMonitoring(positionId: string): void {
    this.monitoredPositions.delete(positionId);
  }

  /**
   * Update position data (called on price changes)
   */
  updatePositionPrice(
    positionId: string,
    currentPrice: number
  ): RiskCheckResult | null {
    const monitored = this.monitoredPositions.get(positionId);
    if (!monitored) return null;

    // Update trailing stop tracking
    if (currentPrice > monitored.highestPrice) {
      monitored.highestPrice = currentPrice;
    }
    if (currentPrice < monitored.lowestPrice) {
      monitored.lowestPrice = currentPrice;
    }

    // Calculate current P&L
    const entryPrice = monitored.position.odds;
    const outcome = monitored.position.outcome;

    // For YES outcome: profit if price goes up
    // For NO outcome: profit if price goes down
    const priceChange = outcome === "YES"
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;

    const pnlPercent = priceChange / entryPrice;
    const currentPnL = pnlPercent * monitored.position.amount * monitored.position.odds;

    return {
      shouldClose: false,
      reason: "none",
      currentPnL,
      pnlPercent,
    };
  }

  /**
   * Check all monitored positions for risk triggers
   */
  checkPositions(
    getPriceFn: (marketId: string, outcome: Outcome) => number | null
  ): Array<{ positionId: string; botId: string; result: RiskCheckResult }> {
    const results: Array<{ positionId: string; botId: string; result: RiskCheckResult }> = [];

    for (const [positionId, monitored] of this.monitoredPositions) {
      const currentPrice = getPriceFn(monitored.position.marketId, monitored.position.outcome);

      if (currentPrice === null) continue;

      const checkResult = this.checkPosition(monitored, currentPrice);

      if (checkResult.shouldClose) {
        results.push({
          positionId,
          botId: monitored.botId,
          result: checkResult,
        });

        // Emit risk alert event
        botEventBus.emitRiskAlert(monitored.botId, `Position ${positionId} triggered: ${checkResult.reason}`, {
          positionId,
          reason: checkResult.reason,
          pnlPercent: checkResult.pnlPercent,
        });
      }
    }

    return results;
  }

  /**
   * Check a single position for risk triggers
   */
  private checkPosition(
    monitored: MonitoredPosition,
    currentPrice: number
  ): RiskCheckResult {
    const { position, config, monitoringSince } = monitored;
    const entryPrice = position.odds;
    const outcome = position.outcome;

    // Calculate P&L based on outcome direction
    const priceChange = outcome === "YES"
      ? currentPrice - entryPrice
      : entryPrice - currentPrice;

    const pnlPercent = priceChange / entryPrice;
    const currentPnL = pnlPercent * position.amount * entryPrice;

    // Check max hold time
    if (config.maxHoldTimeMs) {
      const holdTime = Date.now() - monitoringSince;
      if (holdTime > config.maxHoldTimeMs) {
        return {
          shouldClose: true,
          reason: "max_hold_time",
          currentPnL,
          pnlPercent,
        };
      }
    }

    // Check stop-loss
    if (pnlPercent <= -config.stopLossPercent) {
      return {
        shouldClose: true,
        reason: "stop_loss",
        currentPnL,
        pnlPercent,
      };
    }

    // Check take-profit
    if (pnlPercent >= config.takeProfitPercent) {
      return {
        shouldClose: true,
        reason: "take_profit",
        currentPnL,
        pnlPercent,
      };
    }

    // Check trailing stop
    if (config.trailingStopPercent) {
      const trailingTrigger = outcome === "YES"
        ? monitored.highestPrice * (1 - config.trailingStopPercent)
        : monitored.lowestPrice * (1 + config.trailingStopPercent);

      const shouldTrigger = outcome === "YES"
        ? currentPrice < trailingTrigger
        : currentPrice > trailingTrigger;

      if (shouldTrigger && pnlPercent > 0) {
        return {
          shouldClose: true,
          reason: "trailing_stop",
          currentPnL,
          pnlPercent,
        };
      }
    }

    return {
      shouldClose: false,
      reason: "none",
      currentPnL,
      pnlPercent,
    };
  }

  /**
   * Get all monitored positions for a bot
   */
  getBotPositions(botId: string): MonitoredPosition[] {
    return Array.from(this.monitoredPositions.values())
      .filter((m) => m.botId === botId);
  }

  /**
   * Start the monitoring loop
   */
  startMonitoringLoop(
    getPriceFn: (marketId: string, outcome: Outcome) => number | null,
    onClosePosition: (positionId: string, botId: string, reason: string) => void
  ): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      const triggers = this.checkPositions(getPriceFn);

      for (const { positionId, botId, result } of triggers) {
        console.log(`[PositionMonitor] Closing position ${positionId}: ${result.reason} (PnL: ${result.pnlPercent * 100}%)`);
        onClosePosition(positionId, botId, result.reason);
        this.stopMonitoring(positionId);
      }
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the monitoring loop
   */
  stopMonitoringLoop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    totalMonitored: number;
    byBot: Record<string, number>;
  } {
    const byBot: Record<string, number> = {};

    for (const monitored of this.monitoredPositions.values()) {
      byBot[monitored.botId] = (byBot[monitored.botId] || 0) + 1;
    }

    return {
      totalMonitored: this.monitoredPositions.size,
      byBot,
    };
  }

  /**
   * Clear all monitored positions
   */
  clear(): void {
    this.stopMonitoringLoop();
    this.monitoredPositions.clear();
  }
}

// Singleton instance
export const positionMonitor = new PositionMonitor();