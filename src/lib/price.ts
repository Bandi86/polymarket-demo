// Unified Price Service - Fetches real-time Bitcoin prices from multiple providers
// Supports Binance, Coinbase, and fallback providers with resilient architecture

import type { PricePoint, PriceUpdate } from "../types";

interface Provider {
  name: string;
  fetchPrice(): Promise<PriceUpdate | null>;
  subscribe?(callback: (update: PriceUpdate) => void): () => void;
  destroy?(): void;
}

const PRICE_HISTORY_LIMIT = 1000;
const DEFAULT_POLL_INTERVAL = 3000;

// === Provider Implementations ===

class BinanceProvider implements Provider {
  name = "Binance";
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async fetchPrice(): Promise<PriceUpdate | null> {
    try {
      const response = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();
      const price = parseFloat(data.lastPrice);
      const openPrice = parseFloat(data.openPrice);
      const change24h = price - openPrice;
      const change24hPercent = (change24h / openPrice) * 100;

      return {
        price,
        timestamp: Date.now(),
        change24h,
        change24hPercent,
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
      };
    } catch (error) {
      console.error("[BinanceProvider] Fetch error:", error);
      return null;
    }
  }

  subscribe(callback: (update: PriceUpdate) => void): () => void {
    const connect = () => {
      try {
        this.ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.c);
            const openPrice = parseFloat(data.o);
            const change24h = price - openPrice;

            callback({
              price,
              timestamp: Date.now(),
              change24h,
              change24hPercent: parseFloat(data.P),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume24h: parseFloat(data.v),
            });
          } catch (error) {
            console.error("[BinanceProvider] Parse error:", error);
          }
        };

        this.ws.onclose = () => {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(connect, 1000 * Math.min(this.reconnectAttempts, 5));
          }
        };

        this.ws.onerror = (error) => {
          console.error("[BinanceProvider] WebSocket error:", error);
        };
      } catch (error) {
        console.error("[BinanceProvider] Connection error:", error);
      }
    };

    connect();

    return () => {
      this.ws?.close();
      this.ws = null;
    };
  }

  destroy(): void {
    this.ws?.close();
    this.ws = null;
  }
}

class CoinbaseProvider implements Provider {
  name = "Coinbase";

  async fetchPrice(): Promise<PriceUpdate | null> {
    try {
      const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC", {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Coinbase API error: ${response.status}`);
      }

      const data = await response.json();
      const price = parseFloat(data.data.rates.USD);

      return {
        price,
        timestamp: Date.now(),
        change24h: 0,
        change24hPercent: 0,
        high24h: price,
        low24h: price,
        volume24h: 0,
      };
    } catch (error) {
      console.error("[CoinbaseProvider] Fetch error:", error);
      return null;
    }
  }
}

class MockProvider implements Provider {
  name = "Mock";
  private basePrice = 45000;
  private volatility = 0.002;

  async fetchPrice(): Promise<PriceUpdate | null> {
    const randomWalk = (Math.random() - 0.5) * 2 * this.volatility;
    this.basePrice = this.basePrice * (1 + randomWalk);

    return {
      price: this.basePrice,
      timestamp: Date.now(),
      change24h: (Math.random() - 0.5) * 1000,
      change24hPercent: (Math.random() - 0.5) * 5,
      high24h: this.basePrice * 1.02,
      low24h: this.basePrice * 0.98,
      volume24h: Math.random() * 1000000,
    };
  }
}

// === Price Service ===

export class PriceService {
  private currentPrice = 0;
  private lastUpdate = 0;
  private priceHistory: PricePoint[] = [];
  private listeners: Set<(price: number) => void> = new Set();
  private updateListeners: Set<(update: PriceUpdate) => void> = new Set();
  private ready = false;
  private readyCallbacks: Set<() => void> = new Set();
  private providers: Provider[] = [];
  private currentProviderIndex = 0;
  private pollInterval: number;
  private historyLimit: number;
  private fallbackEnabled: boolean;
  private pollTimer: Timer | null = null;
  private lastPriceUpdate: PriceUpdate | null = null;
  private unsubscribeProvider: (() => void) | null = null;
  private wsUnsubscribe: (() => void) | null = null;

  constructor(config: {
    pollInterval?: number;
    historyLimit?: number;
    providers?: Provider[];
    fallbackEnabled?: boolean;
  } = {}) {
    this.pollInterval = config.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.historyLimit = config.historyLimit ?? PRICE_HISTORY_LIMIT;
    this.fallbackEnabled = config.fallbackEnabled ?? true;
    this.providers = config.providers ?? [
      new BinanceProvider(),
      new CoinbaseProvider(),
    ];

    // Always start with Binance provider first
    this.currentProviderIndex = 0;

    // Start WebSocket subscription for real-time updates from Binance
    this.startWebSocket();

    // Also start polling for reliability
    this.startPolling();
  }

  private startWebSocket(): void {
    const binanceProvider = this.providers[0] as BinanceProvider;
    if (binanceProvider && binanceProvider.subscribe) {
      this.wsUnsubscribe = binanceProvider.subscribe((update: PriceUpdate) => {
        this.handlePriceUpdate(update);
      });
    }
  }

  private async startPolling(): Promise<void> {
    // Initial fetch with fallback
    await this.fetchWithFallback();

    // Start polling
    this.pollTimer = setInterval(() => {
      this.fetchWithFallback();
    }, this.pollInterval);
  }

  private async fetchWithFallback(): Promise<void> {
    let lastError: Error | null = null;

    // Try current provider first
    const firstProvider = this.providers[this.currentProviderIndex];
    try {
      const update = await firstProvider.fetchPrice();
      if (update) {
        this.handlePriceUpdate(update);
        this.currentProviderIndex = 0; // Reset to primary provider on success
        return;
      }
    } catch (error) {
      lastError = error as Error;
    }

    // Try fallback providers
    if (this.fallbackEnabled) {
      for (let i = 0; i < this.providers.length; i++) {
        if (i === this.currentProviderIndex) continue;

        const fallbackProvider = this.providers[i];
        try {
          const update = await fallbackProvider.fetchPrice();
          if (update) {
            console.log(`[PriceService] Fallback to ${fallbackProvider.name}`);
            this.handlePriceUpdate(update);
            this.currentProviderIndex = i;
            return;
          }
        } catch (error) {
          // Continue to next provider
        }
      }
    }

    console.error("[PriceService] All providers failed");
    if (lastError) {
      console.error("[PriceService] Last error:", lastError.message);
    }
  }

  private handlePriceUpdate(update: PriceUpdate): void {
    this.currentPrice = update.price;
    this.lastUpdate = update.timestamp;
    this.lastPriceUpdate = update;

    const point: PricePoint = {
      timestamp: update.timestamp,
      price: update.price,
    };

    this.priceHistory.push(point);

    if (this.priceHistory.length > this.historyLimit) {
      this.priceHistory.shift();
    }

    if (!this.ready) {
      this.ready = true;
      this.readyCallbacks.forEach((cb) => cb());
    }

    // Notify listeners
    this.listeners.forEach((fn) => fn(update.price));
    this.updateListeners.forEach((fn) => fn(update));
  }

  // === Public Methods ===

  isReady(): boolean {
    return this.ready && this.currentPrice > 0;
  }

  onReady(callback: () => void): void {
    if (this.ready) {
      callback();
    } else {
      this.readyCallbacks.add(callback);
    }
  }

  getPrice(): number {
    return this.currentPrice;
  }

  getLastUpdate(): number {
    return this.lastUpdate;
  }

  getLastPriceUpdate(): PriceUpdate | null {
    return this.lastPriceUpdate;
  }

  getPriceHistory(limit?: number): PricePoint[] {
    if (limit) {
      return this.priceHistory.slice(-limit);
    }
    return [...this.priceHistory];
  }

  getPriceHistoryForDuration(durationMs: number): number[] {
    const cutoff = Date.now() - durationMs;
    return this.priceHistory.filter((p) => p.timestamp >= cutoff).map((p) => p.price);
  }

  getVolatility(windowSize: number = 20): number {
    if (this.priceHistory.length < windowSize) {
      return 0;
    }

    const recent = this.priceHistory.slice(-windowSize);
    const returns: number[] = [];

    for (let i = 1; i < recent.length; i++) {
      const ret = (recent[i].price - recent[i - 1].price) / recent[i - 1].price;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  getMomentum(windowSize: number = 10): number {
    if (this.priceHistory.length < windowSize) {
      return 0;
    }

    const recent = this.priceHistory.slice(-windowSize);
    const oldest = recent[0].price;
    const newest = recent[recent.length - 1].price;

    return (newest - oldest) / oldest;
  }

  getTrend(windowSize: number = 10): "up" | "down" | "sideways" {
    const prices = this.getPriceHistoryValues(windowSize);
    if (prices.length < 5) return "sideways";

    const momentum = this.getMomentum(windowSize);
    const volatility = this.getVolatility(windowSize);

    // Normalize by volatility
    const signal = momentum / (volatility || 1);

    if (signal > 0.5) return "up";
    if (signal < -0.5) return "down";
    return "sideways";
  }

  getRsi(period: number = 14): number | null {
    const prices = this.getPriceHistoryValues(period * 2);
    if (prices.length < period + 1) return null;

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i] - prices[i - 1]) / prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    const avgGain = this.mean(gains.slice(-period));
    const avgLoss = this.mean(losses.slice(-period));

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  getPriceChange(periods: number = 24): { value: number; percent: number } {
    if (this.priceHistory.length < periods) {
      return { value: 0, percent: 0 };
    }

    const current = this.currentPrice;
    const previous = this.priceHistory[this.priceHistory.length - periods].price;
    const value = current - previous;
    const percent = previous !== 0 ? (value / previous) * 100 : 0;

    return { value, percent };
  }

  subscribe(callback: (price: number) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  subscribeToUpdates(callback: (update: PriceUpdate) => void): () => void {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  // === Helper Methods ===

  private getPriceHistoryValues(limit?: number): number[] {
    const history = limit ? this.priceHistory.slice(-limit) : this.priceHistory;
    return history.map((p) => p.price);
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // === Cleanup ===

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }

    if (this.unsubscribeProvider) {
      this.unsubscribeProvider();
      this.unsubscribeProvider = null;
    }

    this.providers.forEach((p) => p.destroy?.());
    this.listeners.clear();
    this.updateListeners.clear();
    this.readyCallbacks.clear();
  }
}

// Singleton instance
export const priceService = new PriceService();
