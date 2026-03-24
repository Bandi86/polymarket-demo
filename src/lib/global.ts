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

// === SSE Broadcasting ===
// These functions handle real-time updates to connected clients

type SSEBroadcastFn = (type: string, data: unknown) => void;
let sseBroadcastFn: SSEBroadcastFn | null = null;

/**
 * Set the SSE broadcast function. Called by the SSE route during initialization.
 */
export function setSSEBroadcast(fn: SSEBroadcastFn): void {
  sseBroadcastFn = fn;
}

/**
 * Broadcast data to all connected SSE clients.
 */
export function broadcastToSSE(type: string, data: unknown): void {
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
      broadcastToSSE("market_price", {
        yes: price.yes,
        no: price.no,
        timestamp: price.timestamp,
      });
    });
    console.log("[Global] Market price broadcasting set up");

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
};