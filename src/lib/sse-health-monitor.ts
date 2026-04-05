/**
 * SSE Connection Health Monitor
 * Tracks SSE connection status, latency, and stability metrics
 */

export interface SSEHealthMetrics {
  isConnected: boolean;
  lastMessageTime: number | null;
  messageCount: number;
  reconnectCount: number;
  avgLatency: number;
  messageFrequency: number; // messages per second
  errorCount: number;
  uptime: number; // percentage
  connectionStartTime: number | null;
  messagesByType: Record<string, number>;
}

export interface SSEHealthAlert {
  type: 'disconnected' | 'high_latency' | 'low_frequency' | 'error_spike';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
}

// Thresholds for health checks
const HEALTH_THRESHOLDS = {
  MAX_LATENCY_MS: 5000, // Max time since last message before warning
  MIN_MESSAGE_FREQ: 0.1, // Min messages per second (1 message per 10 seconds)
  MAX_ERROR_COUNT: 10, // Max errors before critical alert
  RECONNECT_THRESHOLD: 3, // Reconnects before warning
} as const;

class SSEHealthMonitorClass {
  private metrics: SSEHealthMetrics = {
    isConnected: false,
    lastMessageTime: null,
    messageCount: 0,
    reconnectCount: 0,
    avgLatency: 0,
    messageFrequency: 0,
    errorCount: 0,
    uptime: 100,
    connectionStartTime: null,
    messagesByType: {},
  };

  private latencySamples: number[] = [];
  private alerts: SSEHealthAlert[] = [];
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(metrics: SSEHealthMetrics, alerts: SSEHealthAlert[]) => void> = new Set();

  // Start monitoring
  start(): void {
    console.log('[SSEHealthMonitor] Starting health monitoring');

    // Run health check every 5 seconds
    this.healthCheckInterval = setInterval(() => {
      this.runHealthCheck();
    }, 5000);

    // Track connection start time
    this.metrics.connectionStartTime = Date.now();
  }

  // Stop monitoring
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('[SSEHealthMonitor] Stopped health monitoring');
  }

  // Record incoming message
  recordMessage(type: string, latency?: number): void {
    const now = Date.now();
    this.metrics.lastMessageTime = now;
    this.metrics.isConnected = true;
    this.metrics.messageCount++;

    // Track messages by type
    this.metrics.messagesByType[type] = (this.metrics.messagesByType[type] || 0) + 1;

    // Track latency if provided
    if (latency !== undefined && latency > 0) {
      this.latencySamples.push(latency);
      // Keep only last 100 samples
      if (this.latencySamples.length > 100) {
        this.latencySamples.shift();
      }
      // Update average latency
      this.metrics.avgLatency = this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
    }

    // Calculate message frequency (messages per second over last minute)
    this.updateMessageFrequency();

    // Notify listeners
    this.notifyListeners();
  }

  // Record reconnection
  recordReconnect(): void {
    this.metrics.reconnectCount++;
    console.log(`[SSEHealthMonitor] Reconnection #${this.metrics.reconnectCount}`);

    if (this.metrics.reconnectCount >= HEALTH_THRESHOLDS.RECONNECT_THRESHOLD) {
      this.addAlert({
        type: 'disconnected',
        severity: 'warning',
        message: `SSE connection unstable: ${this.metrics.reconnectCount} reconnections`,
        timestamp: Date.now(),
        metric: 'reconnectCount',
        value: this.metrics.reconnectCount,
        threshold: HEALTH_THRESHOLDS.RECONNECT_THRESHOLD,
      });
    }

    this.notifyListeners();
  }

  // Record error
  recordError(error: string): void {
    this.metrics.errorCount++;
    console.error(`[SSEHealthMonitor] Error: ${error}`);

    if (this.metrics.errorCount >= HEALTH_THRESHOLDS.MAX_ERROR_COUNT) {
      this.addAlert({
        type: 'error_spike',
        severity: 'critical',
        message: `High error rate: ${this.metrics.errorCount} errors`,
        timestamp: Date.now(),
        metric: 'errorCount',
        value: this.metrics.errorCount,
        threshold: HEALTH_THRESHOLDS.MAX_ERROR_COUNT,
      });
    }

    this.notifyListeners();
  }

  // Record disconnection
  recordDisconnect(): void {
    this.metrics.isConnected = false;
    console.log('[SSEHealthMonitor] Connection lost');

    this.addAlert({
      type: 'disconnected',
      severity: 'critical',
      message: 'SSE connection lost',
      timestamp: Date.now(),
      metric: 'isConnected',
      value: 0,
      threshold: 1,
    });

    this.notifyListeners();
  }

  // Get current health metrics
  getMetrics(): SSEHealthMetrics {
    // Update uptime calculation
    if (this.metrics.connectionStartTime) {
      const totalRuntime = Date.now() - this.metrics.connectionStartTime;
      const connectedTime = this.metrics.lastMessageTime
        ? this.metrics.lastMessageTime - this.metrics.connectionStartTime
        : 0;
      this.metrics.uptime = totalRuntime > 0 ? (connectedTime / totalRuntime) * 100 : 100;
    }

    return { ...this.metrics };
  }

  // Get recent alerts
  getAlerts(): SSEHealthAlert[] {
    return [...this.alerts];
  }

  // Clear alerts
  clearAlerts(): void {
    this.alerts = [];
    this.notifyListeners();
  }

  // Subscribe to health updates
  subscribe(callback: (metrics: SSEHealthMetrics, alerts: SSEHealthAlert[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Check if connection is healthy
  isHealthy(): boolean {
    if (!this.metrics.isConnected) return false;
    if (this.metrics.errorCount >= HEALTH_THRESHOLDS.MAX_ERROR_COUNT) return false;

    const timeSinceLastMessage = this.metrics.lastMessageTime
      ? Date.now() - this.metrics.lastMessageTime
      : Infinity;

    return timeSinceLastMessage < HEALTH_THRESHOLDS.MAX_LATENCY_MS;
  }

  // Get health status as string
  getStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.isHealthy()) return 'healthy';

    if (this.metrics.reconnectCount >= HEALTH_THRESHOLDS.RECONNECT_THRESHOLD ||
        this.metrics.errorCount >= HEALTH_THRESHOLDS.MAX_ERROR_COUNT / 2) {
      return 'degraded';
    }

    return 'unhealthy';
  }

  // Private methods

  private runHealthCheck(): void {
    const now = Date.now();

    // Check for stale connection
    if (this.metrics.lastMessageTime) {
      const timeSinceLastMessage = now - this.metrics.lastMessageTime;

      if (timeSinceLastMessage > HEALTH_THRESHOLDS.MAX_LATENCY_MS) {
        this.addAlert({
          type: 'high_latency',
          severity: 'critical',
          message: `No SSE messages for ${(timeSinceLastMessage / 1000).toFixed(1)}s`,
          timestamp: now,
          metric: 'timeSinceLastMessage',
          value: timeSinceLastMessage,
          threshold: HEALTH_THRESHOLDS.MAX_LATENCY_MS,
        });
      }
    }

    // Check message frequency
    if (this.metrics.messageFrequency < HEALTH_THRESHOLDS.MIN_MESSAGE_FREQ && this.metrics.isConnected) {
      this.addAlert({
        type: 'low_frequency',
        severity: 'warning',
        message: `Low message frequency: ${this.metrics.messageFrequency.toFixed(2)}/s`,
        timestamp: now,
        metric: 'messageFrequency',
        value: this.metrics.messageFrequency,
        threshold: HEALTH_THRESHOLDS.MIN_MESSAGE_FREQ,
      });
    }

    // Update uptime
    this.getMetrics();

    // Notify listeners
    this.notifyListeners();
  }

  private updateMessageFrequency(): void {
    // Calculate messages in the last 60 seconds
    const oneMinuteAgo = Date.now() - 60000;
    const recentMessages = this.metrics.messageCount; // Simplified - could track per-timestamp
    this.metrics.messageFrequency = recentMessages / 60;
  }

  private addAlert(alert: SSEHealthAlert): void {
    // Avoid duplicate alerts within 10 seconds
    const recentDuplicate = this.alerts.find(
      a => a.type === alert.type &&
           a.severity === alert.severity &&
           alert.timestamp - a.timestamp < 10000
    );

    if (!recentDuplicate) {
      this.alerts.push(alert);
      // Keep only last 20 alerts
      if (this.alerts.length > 20) {
        this.alerts.shift();
      }
      console.warn(`[SSEHealthMonitor] Alert: ${alert.message}`);
    }
  }

  private notifyListeners(): void {
    const metrics = this.getMetrics();
    const alerts = this.getAlerts();
    this.listeners.forEach(listener => listener(metrics, alerts));
  }
}

// Singleton instance
export const SSEHealthMonitor = new SSEHealthMonitorClass();

// React hook for components - separate file to avoid server/client mixing
// For now, use the monitor directly:
//   const metrics = SSEHealthMonitor.getMetrics()
//   const status = SSEHealthMonitor.getStatus()
//   const isHealthy = SSEHealthMonitor.isHealthy()
