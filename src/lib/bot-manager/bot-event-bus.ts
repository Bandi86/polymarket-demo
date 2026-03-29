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
  | "risk_alert"
  | "trade_decision"      // NEW: When bot makes a decision
  | "signal_received"     // NEW: When Binance signal arrives
  | "market_created";     // NEW: When new market starts

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

// NEW: Trade decision event
export interface TradeDecisionEvent {
  botId: string;
  botName: string;
  strategy: string;
  action: "YES" | "NO" | null;
  confidence: number;
  reason: string;
  timestamp: number;
}

// NEW: Signal received event
export interface SignalReceivedEvent {
  source: "binance" | "oracle";
  type: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  changePercent: number;
  timestamp: number;
}

// NEW: Market created event
export interface MarketCreatedEvent {
  marketId: string;
  startTime: number;
  endTime: number;
  btcStartPrice: number;
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
      "trade_decision",
      "signal_received",
      "market_created",
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
   * Emit a trade decision event (NEW)
   */
  emitTradeDecision(data: TradeDecisionEvent): void {
    this.emit({
      type: "trade_decision",
      botId: data.botId,
      timestamp: data.timestamp,
      data: {
        botName: data.botName,
        strategy: data.strategy,
        action: data.action,
        confidence: data.confidence,
        reason: data.reason,
      },
    });
  }

  /**
   * Emit a signal received event (NEW)
   */
  emitSignalReceived(data: SignalReceivedEvent): void {
    this.emit({
      type: "signal_received",
      timestamp: data.timestamp,
      data: {
        source: data.source,
        type: data.type,
        confidence: data.confidence,
        changePercent: data.changePercent,
      },
    });
  }

  /**
   * Emit a market created event (NEW)
   */
  emitMarketCreated(data: MarketCreatedEvent): void {
    this.emit({
      type: "market_created",
      timestamp: data.startTime,
      data: {
        marketId: data.marketId,
        startTime: data.startTime,
        endTime: data.endTime,
        btcStartPrice: data.btcStartPrice,
      },
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