/**
 * useSSEHealth Hook
 * React hook for consuming SSE connection health metrics in components
 */

import { useState, useEffect, useCallback } from 'react';
import { SSEHealthMonitor } from '@/lib/sse-health-monitor';
import type { SSEHealthMetrics, SSEHealthAlert } from '@/lib/sse-health-monitor';

export interface SSEHealthState {
  isConnected: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  isHealthy: boolean;
  metrics: SSEHealthMetrics;
  alerts: SSEHealthAlert[];
  lastMessageTime: number | null;
  messageCount: number;
  reconnectCount: number;
  avgLatency: number;
  uptime: number;
  errorCount: number;
}

const INITIAL_STATE: SSEHealthState = {
  isConnected: false,
  status: 'unhealthy',
  isHealthy: false,
  metrics: {
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
  },
  alerts: [],
  lastMessageTime: null,
  messageCount: 0,
  reconnectCount: 0,
  avgLatency: 0,
  uptime: 100,
  errorCount: 0,
};

/**
 * Hook to monitor SSE connection health in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, status, metrics, alerts } = useSSEHealth();
 *
 *   return (
 *     <div>
 *       <div>Status: {status}</div>
 *       <div>Uptime: {metrics.uptime.toFixed(1)}%</div>
 *       {alerts.map(alert => <Alert key={alert.timestamp} {...alert} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSSEHealth(): SSEHealthState {
  const [state, setState] = useState<SSEHealthState>(INITIAL_STATE);

  useEffect(() => {
    // Subscribe to health updates
    const unsubscribe = SSEHealthMonitor.subscribe((metrics, alerts) => {
      setState({
        isConnected: metrics.isConnected,
        status: SSEHealthMonitor.getStatus(),
        isHealthy: SSEHealthMonitor.isHealthy(),
        metrics,
        alerts,
        lastMessageTime: metrics.lastMessageTime,
        messageCount: metrics.messageCount,
        reconnectCount: metrics.reconnectCount,
        avgLatency: metrics.avgLatency,
        uptime: metrics.uptime,
        errorCount: metrics.errorCount,
      });
    });

    // Get initial state
    const initialMetrics = SSEHealthMonitor.getMetrics();
    setState({
      isConnected: initialMetrics.isConnected,
      status: SSEHealthMonitor.getStatus(),
      isHealthy: SSEHealthMonitor.isHealthy(),
      metrics: initialMetrics,
      alerts: SSEHealthMonitor.getAlerts(),
      lastMessageTime: initialMetrics.lastMessageTime,
      messageCount: initialMetrics.messageCount,
      reconnectCount: initialMetrics.reconnectCount,
      avgLatency: initialMetrics.avgLatency,
      uptime: initialMetrics.uptime,
      errorCount: initialMetrics.errorCount,
    });

    return unsubscribe;
  }, []);

  return state;
}

/**
 * Get current SSE health state without subscription (for non-React code)
 *
 * @example
 * ```ts
 * const health = getSSEHealth();
 * if (!health.isHealthy) {
 *   console.warn('SSE connection unhealthy:', health.alerts);
 * }
 * ```
 */
export function getSSEHealth(): SSEHealthState {
  const metrics = SSEHealthMonitor.getMetrics();
  return {
    isConnected: metrics.isConnected,
    status: SSEHealthMonitor.getStatus(),
    isHealthy: SSEHealthMonitor.isHealthy(),
    metrics,
    alerts: SSEHealthMonitor.getAlerts(),
    lastMessageTime: metrics.lastMessageTime,
    messageCount: metrics.messageCount,
    reconnectCount: metrics.reconnectCount,
    avgLatency: metrics.avgLatency,
    uptime: metrics.uptime,
    errorCount: metrics.errorCount,
  };
}
