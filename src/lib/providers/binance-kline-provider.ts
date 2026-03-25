// Binance Kline Provider - Real-time 1-second candle data for predictive signals
// Exploits the 4-12 second delay between Binance and Polymarket's Chainlink oracle

export interface Kline {
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export interface KlineSignal {
  type: "UP" | "DOWN" | "NEUTRAL";
  changePercent: number;
  threshold: number;
  confidence: number;
  timestamp: number;
  kline: Kline;
  predictedOutcome: "YES" | "NO" | null;
}

export interface KlineProviderConfig {
  symbol: string;
  interval: string;
  threshold: number; // % change threshold for signal (default 0.01%)
  enableSignals: boolean;
}

const DEFAULT_CONFIG: KlineProviderConfig = {
  symbol: "btcusdt",
  interval: "1s",
  threshold: 0.04, // 0.04% = less noise, more reliable signals (was 0.01%)
  enableSignals: true,
};

export class BinanceKlineProvider {
  private ws: WebSocket | null = null;
  private currentKline: Kline | null = null;
  private previousKline: Kline | null = null;
  private config: Required<KlineProviderConfig>;
  private listeners: Set<(kline: Kline) => void> = new Set();
  private signalListeners: Set<(signal: KlineSignal) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private klineHistory: Kline[] = [];
  private historyLimit = 500;
  private lastSignal: KlineSignal | null = null;
  private signalHistory: KlineSignal[] = [];
  private signalHistoryLimit = 100;

  constructor(config: Partial<KlineProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<KlineProviderConfig>;
    this.connect();
  }

  private connect(): void {
    // Clean up existing WebSocket before creating new one
    if (this.ws) {
      this.ws.onclose = null; // Prevent recursive reconnect
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    const stream = `${this.config.symbol}@kline_${this.config.interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`[BinanceKlineProvider] Connected to ${stream}`);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data));
        } catch (error) {
          console.error("[BinanceKlineProvider] Parse error:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[BinanceKlineProvider] WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("[BinanceKlineProvider] WebSocket closed");
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("[BinanceKlineProvider] Connection error:", error);
      this.attemptReconnect();
    }
  }

  private handleMessage(data: { k: Record<string, unknown> }): void {
    const k = data.k;
    if (!k) return;

    const kline: Kline = {
      startTime: k.t as number,
      endTime: k.T as number,
      open: parseFloat(k.o as string),
      high: parseFloat(k.h as string),
      low: parseFloat(k.l as string),
      close: parseFloat(k.c as string),
      volume: parseFloat(k.v as string),
      isClosed: k.x as boolean,
    };

    this.currentKline = kline;

    // Only process closed klines for signal generation
    if (kline.isClosed) {
      this.processClosedKline(kline);
    }

    // Notify all listeners
    this.listeners.forEach((cb) => cb(kline));
  }

  private processClosedKline(kline: Kline): void {
    // Store in history
    this.klineHistory.push(kline);
    if (this.klineHistory.length > this.historyLimit) {
      this.klineHistory.shift();
    }

    // Generate signal if enabled
    if (this.config.enableSignals && this.previousKline) {
      const signal = this.generateSignal(kline, this.previousKline);
      this.lastSignal = signal;

      if (signal.type !== "NEUTRAL") {
        this.signalHistory.push(signal);
        if (this.signalHistory.length > this.signalHistoryLimit) {
          this.signalHistory.shift();
        }
        console.log(
          `[BinanceKlineProvider] SIGNAL: ${signal.type} ${signal.changePercent >= 0 ? "+" : ""}${signal.changePercent.toFixed(4)}%`
        );
      }

      this.signalListeners.forEach((cb) => cb(signal));
    }

    this.previousKline = kline;
  }

  private generateSignal(current: Kline, previous: Kline): KlineSignal {
    const changePercent = ((current.close - previous.close) / previous.close) * 100;
    const threshold = this.config.threshold;
    const absChange = Math.abs(changePercent);

    let type: KlineSignal["type"] = "NEUTRAL";
    let predictedOutcome: KlineSignal["predictedOutcome"] = null;
    let confidence = 0;

    if (changePercent > threshold) {
      type = "UP";
      predictedOutcome = "YES"; // BTC going UP = YES
      confidence = Math.min(1, absChange / (threshold * 3));
    } else if (changePercent < -threshold) {
      type = "DOWN";
      predictedOutcome = "NO"; // BTC going DOWN = NO
      confidence = Math.min(1, absChange / (threshold * 3));
    }

    return {
      type,
      changePercent,
      threshold,
      confidence,
      timestamp: Date.now(),
      kline: current,
      predictedOutcome,
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
      console.log(`[BinanceKlineProvider] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error("[BinanceKlineProvider] Max reconnect attempts reached");
    }
  }

  // === Public API ===

  getCurrentKline(): Kline | null {
    return this.currentKline;
  }

  getPreviousKline(): Kline | null {
    return this.previousKline;
  }

  getKlineHistory(limit?: number): Kline[] {
    if (limit) return this.klineHistory.slice(-limit);
    return [...this.klineHistory];
  }

  getLastSignal(): KlineSignal | null {
    return this.lastSignal;
  }

  getSignalHistory(limit?: number): KlineSignal[] {
    if (limit) return this.signalHistory.slice(-limit);
    return [...this.signalHistory];
  }

  getStats(): {
    totalKlines: number;
    totalSignals: number;
    upSignals: number;
    downSignals: number;
    avgChange: number;
  } {
    const upSignals = this.signalHistory.filter((s) => s.type === "UP").length;
    const downSignals = this.signalHistory.filter((s) => s.type === "DOWN").length;
    const totalChanges = this.signalHistory.map((s) => s.changePercent);

    return {
      totalKlines: this.klineHistory.length,
      totalSignals: this.signalHistory.length,
      upSignals,
      downSignals,
      avgChange: totalChanges.length > 0
        ? totalChanges.reduce((a, b) => a + b, 0) / totalChanges.length
        : 0,
    };
  }

  subscribe(callback: (kline: Kline) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  subscribeToSignals(callback: (signal: KlineSignal) => void): () => void {
    this.signalListeners.add(callback);
    return () => this.signalListeners.delete(callback);
  }

  setThreshold(threshold: number): void {
    this.config.threshold = threshold;
    console.log(`[BinanceKlineProvider] Threshold set to ${threshold}%`);
  }

  getThreshold(): number {
    return this.config.threshold;
  }

  destroy(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.signalListeners.clear();
  }
}

// Singleton instance with default config
export const binanceKlineProvider = new BinanceKlineProvider();