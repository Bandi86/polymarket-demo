// Memory Management Utilities
// Handles cleanup and monitoring for long-running sessions (24/7 operation)

// Configuration
const MEMORY_CONFIG = {
  // Max items to keep in memory
  MAX_BOT_LOGS: 100,
  MAX_EVENTS: 50,
  MAX_PRICE_HISTORY: 200,
  MAX_PNL_HISTORY: 100,
  MAX_POSITIONS_HISTORY: 50,

  // Cleanup intervals
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  STALE_DATA_AGE_MS: 30 * 60 * 1000, // 30 minutes

  // Memory thresholds (MB)
  WARNING_THRESHOLD: 500,
  CRITICAL_THRESHOLD: 1000,
};

// Memory stats interface
export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercent: number;
  timestamp: number;
}

// Get current memory usage (Chrome/Edge only)
export function getMemoryStats(): MemoryStats | null {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      timestamp: Date.now(),
    };
  }
  return null;
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Cleanup manager for tracking and cleaning resources
export class CleanupManager {
  private intervals: Set<ReturnType<typeof setInterval>> = new Set();
  private timeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private listeners: Map<EventTarget, Map<string, Set<EventListener>>> = new Map();
  private abortControllers: Set<AbortController> = new Set();
  private cleanupCallbacks: Set<() => void> = new Set();

  // Register an interval for cleanup
  registerInterval(id: ReturnType<typeof setInterval>): void {
    this.intervals.add(id);
  }

  // Register a timeout for cleanup
  registerTimeout(id: ReturnType<typeof setTimeout>): void {
    this.timeouts.add(id);
  }

  // Register an event listener for cleanup
  registerEventListener(
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(event, listener, options);
    if (!this.listeners.has(target)) {
      this.listeners.set(target, new Map());
    }
    const targetListeners = this.listeners.get(target)!;
    if (!targetListeners.has(event)) {
      targetListeners.set(event, new Set());
    }
    targetListeners.get(event)!.add(listener);
  }

  // Register an abort controller for cleanup
  registerAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  // Register a cleanup callback
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  // Clear a specific interval
  clearInterval(id: ReturnType<typeof setInterval>): void {
    clearInterval(id);
    this.intervals.delete(id);
  }

  // Clear a specific timeout
  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  // Cleanup all registered resources
  cleanup(): void {
    // Clear all intervals
    for (const id of this.intervals) {
      clearInterval(id);
    }
    this.intervals.clear();

    // Clear all timeouts
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.timeouts.clear();

    // Remove all event listeners
    for (const [target, events] of this.listeners) {
      for (const [event, listeners] of events) {
        for (const listener of listeners) {
          target.removeEventListener(event, listener);
        }
      }
    }
    this.listeners.clear();

    // Abort all controllers
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Run cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (e) {
        console.error('[CleanupManager] Callback error:', e);
      }
    }
    this.cleanupCallbacks.clear();
  }

  // Get stats
  getStats(): {
    intervals: number;
    timeouts: number;
    listeners: number;
    abortControllers: number;
    callbacks: number;
  } {
    let listenerCount = 0;
    for (const events of this.listeners.values()) {
      for (const listeners of events.values()) {
        listenerCount += listeners.size;
      }
    }
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      listeners: listenerCount,
      abortControllers: this.abortControllers.size,
      callbacks: this.cleanupCallbacks.size,
    };
  }
}

// Global cleanup manager instance
export const globalCleanupManager = new CleanupManager();

// Memory monitor class
export class MemoryMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onWarning?: (stats: MemoryStats) => void;
  private onCritical?: (stats: MemoryStats) => void;
  private statsHistory: MemoryStats[] = [];
  private maxHistory = 60; // Keep last 60 measurements (5 minutes at 5s intervals)

  start(intervalMs = 5000): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      const stats = getMemoryStats();
      if (stats) {
        this.statsHistory.push(stats);
        if (this.statsHistory.length > this.maxHistory) {
          this.statsHistory.shift();
        }

        if (stats.usagePercent > 80) {
          this.onCritical?.(stats);
        } else if (stats.usagePercent > 60) {
          this.onWarning?.(stats);
        }
      }
    }, intervalMs);

    globalCleanupManager.registerInterval(this.intervalId);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setCallbacks(
    onWarning: (stats: MemoryStats) => void,
    onCritical: (stats: MemoryStats) => void
  ): void {
    this.onWarning = onWarning;
    this.onCritical = onCritical;
  }

  getStats(): MemoryStats | null {
    return this.statsHistory[this.statsHistory.length - 1] || null;
  }

  getHistory(): MemoryStats[] {
    return [...this.statsHistory];
  }

  getAverageUsage(): number {
    if (this.statsHistory.length === 0) return 0;
    const sum = this.statsHistory.reduce((acc, s) => acc + s.usagePercent, 0);
    return sum / this.statsHistory.length;
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor();

// Array cleanup utilities
export function trimArray<T>(arr: T[], maxLength: number): T[] {
  if (arr.length <= maxLength) return arr;
  return arr.slice(-maxLength);
}

export function filterByAge<T extends { timestamp?: number }>(
  arr: T[],
  maxAgeMs: number
): T[] {
  const now = Date.now();
  return arr.filter(item => {
    if (!item.timestamp) return true;
    return now - item.timestamp < maxAgeMs;
  });
}

// Object cleanup utility - removes undefined/null values
export function cleanObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key as keyof T] = value as T[keyof T];
    }
  }
  return cleaned;
}

// Periodic cleanup function for stores
export function createStoreCleanup(
  stores: {
    clearLogs?: () => void;
    reset?: () => void;
  }[]
): () => void {
  return () => {
    for (const store of stores) {
      store.clearLogs?.();
    }
    // Trigger garbage collection hint (if available)
    if (typeof gc === 'function') {
      gc();
    }
  };
}

// Setup periodic memory cleanup
export function setupPeriodicCleanup(
  cleanupFn: () => void,
  intervalMs = MEMORY_CONFIG.CLEANUP_INTERVAL_MS
): () => void {
  const intervalId = setInterval(cleanupFn, intervalMs);
  globalCleanupManager.registerInterval(intervalId);
  return () => clearInterval(intervalId);
}

// Export config for external use
export { MEMORY_CONFIG };