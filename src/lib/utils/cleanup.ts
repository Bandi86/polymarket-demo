// Memory Management Utilities
// Handles cleanup of resources, timers, and event listeners

/**
 * Resource cleanup manager for components and services
 */
export class CleanupManager {
  private timers: Set<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>> = new Set();
  private eventListeners: Set<{ target: EventTarget; event: string; handler: EventListener }> = new Set();
  private abortControllers: Set<AbortController> = new Set();
  private customCleanup: Set<() => void> = new Set();

  /**
   * Register a timer for cleanup
   */
  addTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
    this.timers.add(timer);
  }

  /**
   * Register an event listener for cleanup
   */
  addEventListener(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler);
    this.eventListeners.add({ target, event, handler });
  }

  /**
   * Register an AbortController for cleanup
   */
  addAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  /**
   * Register a custom cleanup function
   */
  addCleanup(fn: () => void): void {
    this.customCleanup.add(fn);
  }

  /**
   * Create a managed interval
   */
  setInterval(fn: () => void, delay: number): ReturnType<typeof setInterval> {
    const id = setInterval(fn, delay);
    this.timers.add(id);
    return id;
  }

  /**
   * Create a managed timeout
   */
  setTimeout(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, delay);
    this.timers.add(id);
    return id;
  }

  /**
   * Clear a specific timer
   */
  clearTimer(id: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
    clearInterval(id as ReturnType<typeof setInterval>);
    clearTimeout(id as ReturnType<typeof setTimeout>);
    this.timers.delete(id);
  }

  /**
   * Create a managed AbortController
   */
  createAbortController(): AbortController {
    const controller = new AbortController();
    this.abortControllers.add(controller);
    return controller;
  }

  /**
   * Cleanup all registered resources
   */
  cleanup(): void {
    // Clear timers
    for (const timer of this.timers) {
      clearInterval(timer as ReturnType<typeof setInterval>);
      clearTimeout(timer as ReturnType<typeof setTimeout>);
    }
    this.timers.clear();

    // Remove event listeners
    for (const { target, event, handler } of this.eventListeners) {
      target.removeEventListener(event, handler);
    }
    this.eventListeners.clear();

    // Abort pending requests
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Run custom cleanup functions
    for (const fn of this.customCleanup) {
      try {
        fn();
      } catch (error) {
        console.error("[CleanupManager] Custom cleanup error:", error);
      }
    }
    this.customCleanup.clear();
  }

  /**
   * Get stats about managed resources
   */
  getStats(): {
    timers: number;
    eventListeners: number;
    abortControllers: number;
    customCleanup: number;
  } {
    return {
      timers: this.timers.size,
      eventListeners: this.eventListeners.size,
      abortControllers: this.abortControllers.size,
      customCleanup: this.customCleanup.size,
    };
  }
}

/**
 * Create a cleanup manager for use in useEffect
 * @example
 * useEffect(() => {
 *   const cleanup = new CleanupManager();
 *   cleanup.setInterval(() => {}, 1000);
 *   return () => cleanup.cleanup();
 * }, []);
 */
export function createCleanupManager(): CleanupManager {
  return new CleanupManager();
}

/**
 * Debounce a function with cleanup support
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  cleanupManager?: CleanupManager
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);

    if (cleanupManager) {
      cleanupManager.addCleanup(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    }
  };

  return debounced;
}

/**
 * Throttle a function with cleanup support
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
  cleanupManager?: CleanupManager
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  if (cleanupManager) {
    cleanupManager.addCleanup(() => {
      inThrottle = false;
      lastArgs = null;
    });
  }

  return throttled;
}

/**
 * Memory usage monitor for debugging
 */
export function getMemoryUsage(): {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
} | null {
  // @ts-expect-error - performance.memory is Chrome-specific
  if (typeof performance !== 'undefined' && performance.memory) {
    // @ts-expect-error - performance.memory is Chrome-specific
    const memory = performance.memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Log memory usage for debugging
 */
export function logMemoryUsage(label: string): void {
  const usage = getMemoryUsage();
  if (usage) {
    const usedMB = Math.round((usage.usedJSHeapSize || 0) / 1024 / 1024);
    const totalMB = Math.round((usage.totalJSHeapSize || 0) / 1024 / 1024);
    console.log(`[Memory] ${label}: ${usedMB}MB / ${totalMB}MB`);
  }
}