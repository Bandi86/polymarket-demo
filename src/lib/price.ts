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
const DEFAULT_POLL_INTERVAL = 1000; // Reduced from 3000ms for faster fallback

// === Provider Implementations ===

class BinanceProvider implements Provider {
  name = "Binance";
  private ws: WebSocket | null = null;
  private tradeWs: WebSocket | null = null; // Separate WebSocket for real-time trades
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastTradePrice = 0;
  private tradeListeners: Set<(price: number) => void> = new Set();
  private fallbackToTicker = false; // Fallback to ticker if trade stream fails
  private httpFallbackActive = false; // HTTP polling fallback if all WS fails
  private httpPollInterval: ReturnType<typeof setInterval> | null = null;

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

  // Subscribe to real-time trades (faster than ticker - ~100-300ms latency)
  // Includes automatic fallback to ticker stream and HTTP polling
  subscribeToTrades(callback: (price: number) => void): () => void {
    let lastMessageTime = Date.now();
    let messageTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectTradeStream = () => {
      if (this.fallbackToTicker) {
        // Already in fallback mode, don't reconnect trade stream
        return;
      }

      try {
        this.tradeWs = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

        this.tradeWs.onopen = () => {
          console.log("[BinanceProvider] Trade stream connected");
          this.reconnectAttempts = 0;
          this.fallbackToTicker = false;
          lastMessageTime = Date.now();

          // Setup message timeout - if no message in 10s, switch to fallback
          if (messageTimeout) clearTimeout(messageTimeout);
          messageTimeout = setTimeout(() => {
            console.log("[BinanceProvider] Trade stream timeout, switching to ticker fallback");
            this.fallbackToTicker = true;
            this.tradeWs?.close();
            this.startTickerFallback(callback);
          }, 10000);
        };

        this.tradeWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p);
            this.lastTradePrice = price;
            lastMessageTime = Date.now();

            // Clear timeout on successful message
            if (messageTimeout) {
              clearTimeout(messageTimeout);
              messageTimeout = null;
            }

            // Notify all trade listeners immediately (ultra-low latency)
            this.tradeListeners.forEach(cb => cb(price));
          } catch (error) {
            console.error("[BinanceProvider] Trade parse error:", error);
          }
        };

        this.tradeWs.onclose = () => {
          console.log("[BinanceProvider] Trade stream closed");

          // If we haven't received messages, switch to ticker fallback
          if (Date.now() - lastMessageTime > 10000 && !this.fallbackToTicker) {
            console.log("[BinanceProvider] Trade stream stale, switching to ticker fallback");
            this.fallbackToTicker = true;
            this.startTickerFallback(callback);
          } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Try to reconnect trade stream
            this.reconnectAttempts++;
            console.log(`[BinanceProvider] Reconnecting trade stream (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(connectTradeStream, 1000 * Math.min(this.reconnectAttempts, 3));
          } else if (!this.fallbackToTicker) {
            // Max attempts reached, switch to ticker
            console.log("[BinanceProvider] Max trade stream attempts, switching to ticker fallback");
            this.fallbackToTicker = true;
            this.startTickerFallback(callback);
          }
        };

        this.tradeWs.onerror = (error) => {
          console.error("[BinanceProvider] Trade WebSocket error:", error);
        };
      } catch (error) {
        console.error("[BinanceProvider] Trade connection error:", error);
        this.fallbackToTicker = true;
        this.startTickerFallback(callback);
      }
    };

    connectTradeStream();

    return () => {
      this.tradeWs?.close();
      this.tradeWs = null;
      if (messageTimeout) clearTimeout(messageTimeout);
      this.stopHttpFallback();
    };
  }

  // Start ticker stream as fallback (slower but more reliable than trades)
  private startTickerFallback(callback: (price: number) => void): void {
    console.log("[BinanceProvider] Starting ticker fallback stream");
    this.fallbackToTicker = true;

    // Use the existing ticker subscribe but wrap the callback
    const unsubscribe = this.subscribe((update) => {
      callback(update.price);
    });

    // Store unsubscribe to clean up later
    (this as any)._tickerFallbackUnsubscribe = unsubscribe;
  }

  // Start HTTP polling as last resort fallback
  private startHttpFallback(callback: (price: number) => void): void {
    if (this.httpFallbackActive) return;

    console.log("[BinanceProvider] Starting HTTP polling fallback (3s interval)");
    this.httpFallbackActive = true;

    const poll = async () => {
      try {
        const update = await this.fetchPrice();
        if (update) {
          callback(update.price);
          // If we get successful HTTP responses, we're in fallback mode
          this.fallbackToTicker = true;
        }
      } catch (error) {
        console.error("[BinanceProvider] HTTP fallback poll error:", error);
      }
    };

    // Poll immediately
    poll();

    // Then poll every 3 seconds
    this.httpPollInterval = setInterval(poll, 3000);
  }

  private stopHttpFallback(): void {
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
    this.httpFallbackActive = false;
  }

  // Manually trigger fallback (for testing or external triggers)
  forceFallback(): void {
    console.log("[BinanceProvider] Forcing fallback mode");
    this.fallbackToTicker = true;
    this.tradeWs?.close();
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
    this.tradeWs?.close();
    this.tradeWs = null;
    this.tradeListeners.clear();
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
  private tradeListeners: Set<(price: number) => void> = new Set(); // Ultra-low latency trade subscribers
  private ready = false;
  private readyCallbacks: Set<() => void> = new Set();
  private providers: Provider[] = [];
  private currentProviderIndex = 0;
  private pollInterval: number;
  private historyLimit: number;
  private fallbackEnabled: boolean;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPriceUpdate: PriceUpdate | null = null;
  private unsubscribeProvider: (() => void) | null = null;
  private wsUnsubscribe: (() => void) | null = null;
  private tradeUnsubscribe: (() => void) | null = null;

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

    // Start BOTH WebSocket streams:
    // 1. @ticker for full price data (24h stats, volume, etc)
    // 2. @trade for ultra-low latency price updates (~100-300ms faster)
    this.startWebSocket();
    this.startTradeStream();
  }

  private startTradeStream(): void {
    const binanceProvider = this.providers[0] as BinanceProvider;
    if (binanceProvider && 'subscribeToTrades' in binanceProvider) {
      this.tradeUnsubscribe = binanceProvider.subscribeToTrades((price: number) => {
        // Update current price immediately (ultra-low latency path)
        this.currentPrice = price;
        this.lastUpdate = Date.now();

        // Notify trade listeners immediately (for strategies needing fastest data)
        this.tradeListeners.forEach(fn => fn(price));

        // Also notify regular listeners but throttled (see throttledNotify below)
        this.notifyListenersThrottled(price);
      });
    }
  }

  private startWebSocket(): void {
    const binanceProvider = this.providers[0] as BinanceProvider;
    if (binanceProvider && binanceProvider.subscribe) {
      this.wsUnsubscribe = binanceProvider.subscribe((update: PriceUpdate) => {
        this.handlePriceUpdate(update);

        // Stop polling if WebSocket is working - only use as fallback
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = null;
          console.log("[PriceService] WebSocket connected - using real-time stream (no polling needed)");
        }
      });

      // Start polling as fallback - will be stopped when WS works
      console.log("[PriceService] Starting fallback polling (WebSocket may not be connected)");
      this.startPollingFallback();
    }
  }

  /** Start polling as fallback when WebSocket isn't working */
  private async startPollingFallback(): Promise<void> {
    // Initial fetch with fallback
    await this.fetchWithFallback();

    // Start polling (will be stopped when WebSocket receives data)
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

  private notifyThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastNotifiedPrice = 0;
  private readonly NOTIFY_THROTTLE_MS = 100; // Max 10 notifications per second to regular listeners

  // Throttled notification for regular listeners (prevents flooding)
  private notifyListenersThrottled(price: number): void {
    // Skip if price hasn't changed significantly
    if (Math.abs(price - this.lastNotifiedPrice) < 0.01) {
      return;
    }

    if (this.notifyThrottleTimer) {
      return; // Already scheduled
    }

    this.notifyThrottleTimer = setTimeout(() => {
      this.lastNotifiedPrice = price;

      // Notify regular price listeners (number only)
      this.listeners.forEach((fn) => fn(price));

      // ALSO notify update listeners with a minimal PriceUpdate object
      // This ensures SSE broadcast receives trade stream updates (ultra-low latency path)
      if (this.lastPriceUpdate) {
        const throttledUpdate: PriceUpdate = {
          ...this.lastPriceUpdate,
          price,
          timestamp: Date.now(),
        };
        this.updateListeners.forEach((fn) => fn(throttledUpdate));
      }

      this.notifyThrottleTimer = null;
    }, this.NOTIFY_THROTTLE_MS);
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

    // Notify update listeners (full data)
    this.updateListeners.forEach((fn) => fn(update));
    // Regular price listeners are notified via trade stream (throttled)
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

  // Subscribe to ultra-low latency trade stream (~100-300ms faster than ticker)
  subscribeToTrades(callback: (price: number) => void): () => void {
    this.tradeListeners.add(callback);
    return () => this.tradeListeners.delete(callback);
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

    if (this.notifyThrottleTimer) {
      clearTimeout(this.notifyThrottleTimer);
      this.notifyThrottleTimer = null;
    }

    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }

    if (this.tradeUnsubscribe) {
      this.tradeUnsubscribe();
      this.tradeUnsubscribe = null;
    }

    if (this.unsubscribeProvider) {
      this.unsubscribeProvider();
      this.unsubscribeProvider = null;
    }

    this.providers.forEach((p) => p.destroy?.());
    this.listeners.clear();
    this.updateListeners.clear();
    this.tradeListeners.clear();
    this.readyCallbacks.clear();
  }
}

// Singleton instance
export const priceService = new PriceService();
