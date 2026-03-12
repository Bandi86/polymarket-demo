import type { PricePoint, PriceUpdate } from "../../types";

export interface PriceProvider {
  name: string;
  subscribe(callback: (update: PriceUpdate) => void): () => void;
  getCurrentPrice(): Promise<number>;
  getHistoricalPrices(period: string): Promise<PricePoint[]>;
}

// Binance WebSocket and REST API provider
export class BinancePriceProvider implements PriceProvider {
  name = "Binance";
  private ws: WebSocket | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private currentPrice: number = 0;
  private priceHistory: PricePoint[] = [];
  private listeners: Set<(update: PriceUpdate) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private priceHistoryLimit = 500;

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");

      this.ws.onopen = () => {
        console.log("[BinancePriceProvider] WebSocket connected");
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const price = parseFloat(data.c);
          const priceChange = parseFloat(data.P) / 100;

          if (price > 0) {
            this.currentPrice = price;
            const update: PriceUpdate = {
              price,
              timestamp: Date.now(),
              change24h: parseFloat(data.p),
              change24hPercent: priceChange,
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume24h: parseFloat(data.v),
            };

            // Store price history
            this.priceHistory.push({
              timestamp: update.timestamp,
              price: update.price,
              volume: update.volume24h,
            });

            if (this.priceHistory.length > this.priceHistoryLimit) {
              this.priceHistory.shift();
            }

            this.listeners.forEach((cb) => cb(update));
          }
        } catch (error) {
          console.error("[BinancePriceProvider] Error parsing message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[BinancePriceProvider] WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("[BinancePriceProvider] WebSocket closed");
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("[BinancePriceProvider] Connection error:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[BinancePriceProvider] Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error("[BinancePriceProvider] Max reconnect attempts reached");
      // Fall back to REST API polling
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return; // Already polling
    console.log("[BinancePriceProvider] Falling back to REST polling");
    this.pollingInterval = setInterval(async () => {
      try {
        const price = await this.getCurrentPrice();
        if (price > 0) {
          this.currentPrice = price;
          const update: PriceUpdate = {
            price,
            timestamp: Date.now(),
            change24h: 0,
            change24hPercent: 0,
            high24h: price,
            low24h: price,
            volume24h: 0,
          };
          this.listeners.forEach((cb) => cb(update));
        }
      } catch (error) {
        console.error("[BinancePriceProvider] Polling error:", error);
      }
    }, 3000);
  }

  subscribe(callback: (update: PriceUpdate) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getCurrentPrice(): Promise<number> {
    if (this.currentPrice > 0) return this.currentPrice;

    const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

    const data = await response.json();
    return parseFloat(data.price);
  }

  async getHistoricalPrices(period: string): Promise<PricePoint[]> {
    const interval = this.mapPeriodToInterval(period);
    const limit = 100;

    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

    const data = await response.json();
    return data.map((candle: unknown[]) => ({
      timestamp: candle[0] as number,
      price: parseFloat(candle[4] as string),
      volume: parseFloat(candle[5] as string),
    }));
  }

  private mapPeriodToInterval(period: string): string {
    const mapping: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
    };
    return mapping[period] || "5m";
  }

  getPriceHistory(): PricePoint[] {
    return [...this.priceHistory];
  }

  destroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Mock price provider for testing
export class MockPriceProvider implements PriceProvider {
  name = "Mock";
  private basePrice = 45000;
  private currentPrice = this.basePrice;
  private interval: Timer | null = null;
  private listeners: Set<(update: PriceUpdate) => void> = new Set();
  private priceHistory: PricePoint[] = [];

  subscribe(callback: (update: PriceUpdate) => void): () => void {
    this.listeners.add(callback);
    this.startSimulation();
    return () => this.listeners.delete(callback);
  }

  async getCurrentPrice(): Promise<number> {
    return this.currentPrice;
  }

  async getHistoricalPrices(): Promise<PricePoint[]> {
    return this.priceHistory;
  }

  private startSimulation(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      // Random walk with mean reversion
      const change = (Math.random() - 0.5) * 100;
      const meanReversion = (this.basePrice - this.currentPrice) * 0.001;
      this.currentPrice += change + meanReversion;

      const update: PriceUpdate = {
        price: this.currentPrice,
        timestamp: Date.now(),
        change24h: this.currentPrice - this.basePrice,
        change24hPercent: (this.currentPrice - this.basePrice) / this.basePrice,
        high24h: this.currentPrice * 1.02,
        low24h: this.currentPrice * 0.98,
        volume24h: Math.random() * 1000000,
      };

      this.priceHistory.push({
        timestamp: update.timestamp,
        price: update.price,
        volume: update.volume24h,
      });

      if (this.priceHistory.length > 500) {
        this.priceHistory.shift();
      }

      this.listeners.forEach((cb) => cb(update));
    }, 1000);
  }

  destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
