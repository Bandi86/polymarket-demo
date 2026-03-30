// Tick Trend Analyzer - 2-second polling for price direction consistency
// Research shows 60%+ tick consistency predicts market direction

export interface TickTrend {
  direction: "UP" | "DOWN" | "NEUTRAL";
  consistency: number;  // 0-1, percentage of ticks moving same direction
  tickCount: number;
  lastUpdate: number;
}

export interface TickTrendConfig {
  pollInterval: number;    // ms between ticks (default: 2000)
  historyLength: number;   // number of ticks to track (default: 10)
  minConsistency: number;  // minimum consistency for signal (default: 0.6)
}

const DEFAULT_CONFIG: TickTrendConfig = {
  pollInterval: 2000,
  historyLength: 10,
  minConsistency: 0.6,
};

export class TickTrendAnalyzer {
  private ticks: Array<{ price: number; timestamp: number }> = [];
  private config: Required<TickTrendConfig>;
  private lastTrend: TickTrend = {
    direction: "NEUTRAL",
    consistency: 0,
    tickCount: 0,
    lastUpdate: 0,
  };

  constructor(config: Partial<TickTrendConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<TickTrendConfig>;
  }

  /**
   * Add a new price tick
   * Call this every 2 seconds with the current YES price
   */
  addTick(price: number): void {
    const now = Date.now();
    this.ticks.push({ price, timestamp: now });

    // Keep only last N ticks
    if (this.ticks.length > this.config.historyLength) {
      this.ticks.shift();
    }

    // Update trend analysis
    this.analyzeTrend();
  }

  /**
   * Analyze current tick trend
   */
  private analyzeTrend(): void {
    if (this.ticks.length < 3) {
      this.lastTrend = {
        direction: "NEUTRAL",
        consistency: 0,
        tickCount: this.ticks.length,
        lastUpdate: Date.now(),
      };
      return;
    }

    let upMoves = 0;
    let downMoves = 0;

    for (let i = 1; i < this.ticks.length; i++) {
      const diff = this.ticks[i].price - this.ticks[i - 1].price;
      if (diff > 0.0001) {  // 0.01¢ threshold to ignore noise
        upMoves++;
      } else if (diff < -0.0001) {
        downMoves++;
      }
    }

    const total = upMoves + downMoves;
    if (total === 0) {
      this.lastTrend = {
        direction: "NEUTRAL",
        consistency: 0,
        tickCount: this.ticks.length,
        lastUpdate: Date.now(),
      };
      return;
    }

    const consistency = Math.max(upMoves, downMoves) / total;
    const direction = upMoves > downMoves ? "UP" : "DOWN";

    // Only report signal if consistency is above threshold
    if (consistency >= this.config.minConsistency) {
      this.lastTrend = {
        direction,
        consistency,
        tickCount: this.ticks.length,
        lastUpdate: Date.now(),
      };
    } else {
      this.lastTrend = {
        direction: "NEUTRAL",
        consistency,
        tickCount: this.ticks.length,
        lastUpdate: Date.now(),
      };
    }
  }

  /**
   * Get current tick trend
   */
  getTrend(): TickTrend {
    return { ...this.lastTrend };
  }

  /**
   * Check if trend aligns with expected direction
   */
  alignsWith(expected: "UP" | "DOWN"): boolean {
    return this.lastTrend.direction === expected && this.lastTrend.consistency >= this.config.minConsistency;
  }

  /**
   * Get tick history for debugging
   */
  getTickHistory(): Array<{ price: number; timestamp: number }> {
    return [...this.ticks];
  }

  /**
   * Clear tick history (call when market changes)
   */
  reset(): void {
    this.ticks = [];
    this.lastTrend = {
      direction: "NEUTRAL",
      consistency: 0,
      tickCount: 0,
      lastUpdate: 0,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTicks: number;
    currentConsistency: number;
    direction: string;
    avgTickInterval: number;
  } {
    let avgTickInterval = 0;
    if (this.ticks.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.ticks.length; i++) {
        intervals.push(this.ticks[i].timestamp - this.ticks[i - 1].timestamp);
      }
      avgTickInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    return {
      totalTicks: this.ticks.length,
      currentConsistency: this.lastTrend.consistency,
      direction: this.lastTrend.direction,
      avgTickInterval,
    };
  }
}

// Singleton instance
export const tickTrendAnalyzer = new TickTrendAnalyzer();