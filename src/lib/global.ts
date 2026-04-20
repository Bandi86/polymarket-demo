// Global Singleton Module for Next.js Migration
// Provides centralized access to all service instances
// This enables API routes to access shared state without importing the full server

import { marketEngine, MarketEngine, MarketEngineConfig } from "./market-engine";
import { priceService, PriceService } from "./price";
import { botManager, BotManager, BotManagerConfig } from "./bot-manager";
import { dbService, DatabaseService, DatabaseConfig } from "./database";
import { riskManager, RiskManager, RiskSettings } from "./risk-manager";
import { strategyCoordinator, CoordinatorConfig } from "./strategy-coordinator";
import { analyticsService } from "./analytics";
import { binanceKlineProvider, BinanceKlineProvider, KlineProviderConfig } from "./providers/binance-kline-provider";
import { polymarketProvider, PolymarketProvider } from "./providers/polymarket-provider";
import { sessionSummaryGenerator, SessionSummaryGenerator } from "./session-summary-generator";
import { positionMonitor, PositionMonitor } from "./position-monitor";
import { liveModeManager, LiveModeManager } from "./live-mode-manager";
import {
  validateSettlement,
  recordSettlementValidation,
  getSettlementStats,
  type SettlementValidation,
  type SettlementStats,
} from "./settlement-validator";

// Note: StrategyCoordinator class is not exported, only the singleton
// AnalyticsService is not a class, just an object with functions

// Re-export types for convenience
export type {
  MarketEngineConfig,
  BotManagerConfig,
  DatabaseConfig,
  RiskSettings,
  CoordinatorConfig,
  KlineProviderConfig,
};

// === Service Getters ===
// These functions provide access to singleton instances

export function getMarketEngine(): MarketEngine {
  return marketEngine;
}

export function getPriceService(): PriceService {
  return priceService;
}

export function getBotManager(): BotManager {
  return botManager;
}

export function getDatabaseService(): DatabaseService {
  return dbService;
}

export function getRiskManager(): RiskManager {
  return riskManager;
}

// StrategyCoordinator class is not exported - use typeof strategyCoordinator
export function getStrategyCoordinator(): typeof strategyCoordinator {
  return strategyCoordinator;
}

export function getAnalyticsService(): typeof analyticsService {
  return analyticsService;
}

export function getBinanceKlineProvider(): BinanceKlineProvider {
  return binanceKlineProvider;
}

export function getPolymarketProvider(): PolymarketProvider {
  return polymarketProvider;
}

export function getSessionSummaryGenerator(): SessionSummaryGenerator {
  return sessionSummaryGenerator;
}

export function getPositionMonitor(): PositionMonitor {
  return positionMonitor;
}

export function getLiveModeManager(): LiveModeManager {
  return liveModeManager;
}

// === SSE Broadcasting ===
// These functions handle real-time updates to connected clients
// Implements throttling to prevent flooding (max 10 updates/sec per type)

type SSEBroadcastFn = (type: string, data: unknown) => void;
let sseBroadcastFn: SSEBroadcastFn | null = null;

// Throttling state per broadcast type
const sseThrottleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
const ssePendingData: Map<string, unknown> = new Map();
const SSE_THROTTLE_MS = 100; // Max 10 broadcasts per second per type

/**
 * Set the SSE broadcast function. Called by the SSE route during initialization.
 */
export function setSSEBroadcast(fn: SSEBroadcastFn): void {
  sseBroadcastFn = fn;
}

/**
 * Broadcast data to all connected SSE clients with throttling.
 * Multiple calls within the throttle window are batched into a single broadcast.
 */
export function broadcastToSSE(type: string, data: unknown): void {
  if (!sseBroadcastFn) {
    console.warn('[Global] SSE broadcast called but no clients connected. Type:', type);
    return;
  }

  // Store pending data (latest value wins)
  ssePendingData.set(type, data);

  // Already throttling - wait for timer
  if (sseThrottleTimers.has(type)) {
    return;
  }

  // Schedule broadcast after throttle window
  const timer = setTimeout(() => {
    const pending = ssePendingData.get(type);
    if (pending && sseBroadcastFn) {
      sseBroadcastFn(type, pending);
    }
    sseThrottleTimers.delete(type);
    ssePendingData.delete(type);
  }, SSE_THROTTLE_MS);

  sseThrottleTimers.set(type, timer);
}

/**
 * Broadcast immediately without throttling (for critical updates).
 * Use sparingly - only for time-sensitive data.
 */
export function broadcastToSSEImmediate(type: string, data: unknown): void {
  if (sseBroadcastFn) {
    sseBroadcastFn(type, data);
  }
}

// === Service Initialization ===

let initialized = false;

/**
 * Initialize all services for use in API routes.
 * This should be called once when the server starts.
 *
 * Steps:
 * 1. Connect to database
 * 2. Subscribe to price updates
 * 3. Set up bot log broadcasting
 * 4. Set up market price update broadcasting
 * 5. Set up settlement handling
 */
export async function initializeServices(): Promise<void> {
  if (initialized) {
    console.log("[Global] Services already initialized");
    return;
  }

  console.log("[Global] Initializing services...");

  try {
    // 1. Connect to database
    await dbService.connect();
    console.log("[Global] Database connected");

    // 1b. Restore market engine state from database
    await marketEngine.restoreFromDatabase();
    console.log("[Global] Market engine state restored");

    // 2. Subscribe to price updates and broadcast
    priceService.subscribeToUpdates((update) => {
      broadcastToSSE("price", update);
    });
    console.log("[Global] Price updates subscribed");

    // 3. Set up bot log broadcasting
    botManager.onLog((log) => {
      broadcastToSSE("bot_log", log);
    });
    console.log("[Global] Bot log broadcasting set up");

    // 4. Set up market price update broadcasting
    marketEngine.onPriceUpdate((price) => {
      const market = marketEngine.getCurrentMarket();
      const marketDuration = market ? market.endTime - market.startTime : 0;
      broadcastToSSE("market_price", {
        yes: price.yes,
        no: price.no,
        timestamp: price.timestamp,
        timeRemaining: marketEngine.getTimeRemaining(),
        marketDuration: marketDuration,
        btcPrice: priceService.getPrice(),
        priceToBeat: marketEngine.getMarketStartBtcPrice() || market?.priceToBeat || null,
      });
    });
    console.log("[Global] Market price broadcasting set up");

    // 4b. Set up timer broadcasting every 5 seconds (reduced from 1s to save CPU)
    setInterval(() => {
      const market = marketEngine.getCurrentMarket();
      if (market) {
        const marketDuration = market.endTime - market.startTime;
        const timeRemaining = marketEngine.getTimeRemaining();
        broadcastToSSE("timer", {
          timeRemaining,
          marketDuration,
          timestamp: Date.now(),
        });
      }
    }, 5000);
    console.log("[Global] Timer broadcasting set up (5s interval - optimized)");

    // 4c. Set up periodic bots state broadcast (every 5 seconds - reduced from 1s)
    setInterval(() => {
      const bots = botManager.getBots();
      const totalBalance = bots.reduce((sum: number, b: { portfolio?: { balance?: number } }) => sum + (b.portfolio?.balance || 0), 0);
      if (totalBalance > 0) {
        broadcastToSSE("bots", bots);
      }
    }, 5000);
    console.log("[Global] Periodic bots broadcasting set up (5s interval - optimized)");

    // 5. Set up settlement handling
    marketEngine.onSettlement((data) => {
      broadcastToSSE("settlement", {
        positionId: data.position.id,
        botId: data.position.botId,
        outcome: data.position.outcome,
        won: data.won,
        pnl: data.pnl,
        marketResult: data.marketResult,
      });

      // Record settlement for metrics tracking
      if (data.position.botId) {
        botManager.recordSettlement(data.position.botId, data.won, data.pnl);
      }

      // Add bot log for SETTLED event (triggers notifications in frontend)
      if (data.position.botId) {
        botManager.addLog(
          data.position.botId,
          "SETTLED",
          `${data.won ? "WON" : "LOST"} ${data.position.outcome} position | PnL: $${data.pnl.toFixed(2)}`,
          {
            outcome: data.position.outcome,
            amount: data.position.amount,
            pnl: data.pnl,
            won: data.won,
            marketResult: data.marketResult,
          }
        );
      }

      // Broadcast updated bots after settlement for real-time stats
      broadcastToSSE("bots", botManager.getBots());
    });
    console.log("[Global] Settlement handling set up");

    initialized = true;
    console.log("[Global] All services initialized successfully");
  } catch (error) {
    console.error("[Global] Failed to initialize services:", error);
    throw error;
  }
}

/**
 * Check if services have been initialized.
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization state (for testing).
 */
export function resetInitialization(): void {
  initialized = false;
}

/**
 * Clear all SSE throttle timers (for cleanup).
 */
export function clearSSEThrottles(): void {
  for (const timer of sseThrottleTimers.values()) {
    clearTimeout(timer);
  }
  sseThrottleTimers.clear();
  ssePendingData.clear();
}

// === Convenience Exports ===
// Direct access to singletons for simpler imports

export {
  marketEngine,
  priceService,
  botManager,
  dbService,
  riskManager,
  strategyCoordinator,
  analyticsService,
  binanceKlineProvider,
  polymarketProvider,
  sessionSummaryGenerator,
  positionMonitor,
  validateSettlement,
  recordSettlementValidation,
  getSettlementStats,
};