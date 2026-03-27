// Bot Event System
// Event-driven architecture for bot trading decisions

import type { Outcome } from "../../types";

export type BotEventType =
  | "price_change"
  | "position_opened"
  | "position_closed"
  | "market_settled"
  | "order_filled"
  | "error"
  | "risk_alert";

export interface BotEvent {
  type: BotEventType;
  botId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface PriceChangeEvent {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  previousYesPrice: number;
  previousNoPrice: number;
  changePercent: number;
  timestamp: number;
}

export interface PositionEvent {
  botId: string;
  positionId: string;
  marketId: string;
  outcome: Outcome;
  amount: number;
  entryPrice: number;
}

type EventListener = (event: BotEvent) => void;

/**
 * Event bus for bot communication
 * Implements pub/sub pattern for decoupled event handling
 */
export class BotEventBus {
  private listeners: Map<BotEventType, Set<EventListener>> = new Map();
  private eventHistory: BotEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to events of a specific type
   */
  on(eventType: BotEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(listener: EventListener): () => void {
    const types: BotEventType[] = [
      "price_change",
      "position_opened",
      "position_closed",
      "market_settled",
      "order_filled",
      "error",
      "risk_alert",
    ];

    const unsubscribers = types.map((type) => this.on(type, listener));
    return () => unsubscribers.forEach((unsub) => unsub());
  }

  /**
   * Emit an event to all subscribers
   */
  emit(event: BotEvent): void {
    // Store in history
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Notify subscribers
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`[EventBus] Listener error for ${event.type}:`, error);
        }
      }
    }
  }

  /**
   * Emit a price change event
   */
  emitPriceChange(data: PriceChangeEvent): void {
    this.emit({
      type: "price_change",
      timestamp: data.timestamp,
      data: {
        marketId: data.marketId,
        yesPrice: data.yesPrice,
        noPrice: data.noPrice,
        previousYesPrice: data.previousYesPrice,
        previousNoPrice: data.previousNoPrice,
        changePercent: data.changePercent,
      },
    });
  }

  /**
   * Emit a position opened event
   */
  emitPositionOpened(data: PositionEvent): void {
    this.emit({
      type: "position_opened",
      botId: data.botId,
      timestamp: Date.now(),
      data: {
        positionId: data.positionId,
        marketId: data.marketId,
        outcome: data.outcome,
        amount: data.amount,
        entryPrice: data.entryPrice,
      },
    });
  }

  /**
   * Emit a position closed event
   */
  emitPositionClosed(
    botId: string,
    positionId: string,
    pnl: number
  ): void {
    this.emit({
      type: "position_closed",
      botId,
      timestamp: Date.now(),
      data: { positionId, pnl },
    });
  }

  /**
   * Emit a market settled event
   */
  emitMarketSettled(marketId: string, outcome: Outcome): void {
    this.emit({
      type: "market_settled",
      timestamp: Date.now(),
      data: { marketId, outcome },
    });
  }

  /**
   * Emit an error event
   */
  emitError(botId: string, error: string, details?: Record<string, unknown>): void {
    this.emit({
      type: "error",
      botId,
      timestamp: Date.now(),
      data: { error, ...details },
    });
  }

  /**
   * Emit a risk alert event
   */
  emitRiskAlert(botId: string, alert: string, details?: Record<string, unknown>): void {
    this.emit({
      type: "risk_alert",
      botId,
      timestamp: Date.now(),
      data: { alert, ...details },
    });
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 50): BotEvent[] {
    return this.eventHistory.slice(0, limit);
  }

  /**
   * Get events for a specific bot
   */
  getBotEvents(botId: string): BotEvent[] {
    return this.eventHistory.filter((e) => e.botId === botId);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Remove all listeners
   */
  dispose(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}

// Singleton instance
export const botEventBus = new BotEventBus();