# SSE Health Monitoring

## Overview

Real-time SSE (Server-Sent Events) connection health monitoring with automatic fallback mechanisms and React integration.

## Components

### 1. SSE Health Monitor (`src/lib/sse-health-monitor.ts`)

Singleton class that tracks SSE connection health:

```typescript
import { SSEHealthMonitor } from '@/lib/sse-health-monitor';

// Get current metrics
const metrics = SSEHealthMonitor.getMetrics();
const status = SSEHealthMonitor.getStatus();
const isHealthy = SSEHealthMonitor.isHealthy();

// Subscribe to updates
const unsubscribe = SSEHealthMonitor.subscribe((metrics, alerts) => {
  console.log('Connection status:', metrics.isConnected);
  console.log('Uptime:', metrics.uptime.toFixed(2), '%');
});
```

**Metrics tracked:**
- `isConnected` - Connection status
- `messageCount` - Total messages received
- `avgLatency` - Average message latency
- `uptime` - Connection uptime percentage
- `reconnectCount` - Number of reconnections
- `errorCount` - Number of errors
- `messageFrequency` - Messages per second

**Alerts generated for:**
- `disconnected` - Connection lost
- `high_latency` - No messages for > 5 seconds
- `low_frequency` - Message frequency below threshold
- `error_spike` - Error count exceeds threshold

### 2. useSSEHealth Hook (`src/hooks/useSSEHealth.ts`)

React hook for consuming health metrics in components:

```tsx
import { useSSEHealth } from '@/hooks/useSSEHealth';

function MyComponent() {
  const { isConnected, status, metrics, alerts } = useSSEHealth();

  return (
    <div>
      <div>Status: {status}</div>
      <div>Uptime: {metrics.uptime.toFixed(1)}%</div>
      {alerts.map(alert => (
        <Alert key={alert.timestamp} {...alert} />
      ))}
    </div>
  );
}
```

**Returns:**
- `isConnected` - boolean
- `status` - 'healthy' | 'degraded' | 'unhealthy'
- `isHealthy` - boolean
- `metrics` - Full metrics object
- `alerts` - Array of active alerts

### 3. SSE Health Dashboard (`src/components/SSEHealthDashboard.tsx`)

Visual dashboard component for monitoring SSE health:

```tsx
import { SSEHealthDashboard } from '@/components/SSEHealthDashboard';

function DashboardPage() {
  return (
    <div>
      <SSEHealthDashboard />
    </div>
  );
}
```

**Features:**
- Real-time connection status
- Metrics grid (message count, latency, uptime, frequency)
- Secondary metrics (reconnects, errors)
- Alert list with severity indicators
- Auto-updating with Framer Motion animations

### 4. WebSocket Fallback (`src/lib/price.ts`)

Automatic fallback mechanism for Binance WebSocket:

**Fallback hierarchy:**
1. **Trade Stream** (primary) - ~100-300ms latency
2. **Ticker Stream** (fallback 1) - ~1-2s latency
3. **HTTP Polling** (fallback 2) - 3s interval

**Automatic triggers:**
- No message in 10 seconds → switch to ticker
- Trade stream error → switch to ticker
- Max reconnect attempts → switch to ticker
- Ticker unavailable → switch to HTTP polling

```typescript
// Manual fallback trigger (for testing)
priceService.forceFallback();
```

## API Endpoint

### GET `/api/debug/sse-health`

Returns current SSE health metrics:

```json
{
  "success": true,
  "status": "healthy",
  "isHealthy": true,
  "metrics": {
    "isConnected": true,
    "lastMessageTime": 1234567890,
    "messageCount": 150,
    "reconnectCount": 0,
    "avgLatency": 245.5,
    "messageFrequency": 2.5,
    "errorCount": 0,
    "uptime": 99.9,
    "connectionStartTime": 1234567890,
    "messagesByType": {
      "price": 100,
      "market": 50
    }
  },
  "alerts": [],
  "thresholds": {
    "maxLatencyMs": 5000,
    "minMessageFreq": 0.1,
    "maxErrorCount": 10,
    "reconnectThreshold": 3
  }
}
```

## Health Status Definitions

| Status | Condition |
|--------|-----------|
| `healthy` | Connected, no alerts, latency < 5s |
| `degraded` | Connected but ≥3 reconnects or ≥5 errors |
| `unhealthy` | Disconnected or critical alerts |

## Usage Examples

### Check health before trading

```tsx
import { useSSEHealth } from '@/hooks/useSSEHealth';

function TradingPanel() {
  const { isHealthy, isConnected } = useSSEHealth();

  if (!isConnected) {
    return <div>Connecting to market data...</div>;
  }

  if (!isHealthy) {
    return <div>Market data connection unstable</div>;
  }

  return <button>Trade</button>;
}
```

### Display connection status in header

```tsx
function Header() {
  const { status } = useSSEHealth();

  const colors = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    unhealthy: '#ef4444',
  };

  return (
    <div style={{ color: colors[status] }}>
      SSE: {status.toUpperCase()}
    </div>
  );
}
```

## Troubleshooting

### Connection shows "unhealthy"

1. Check SSE endpoint is accessible
2. Verify server is broadcasting events
3. Check browser console for errors
4. Visit `/api/debug/sse-health` for metrics

### Frequent reconnections

1. Check network stability
2. Verify WebSocket server capacity
3. Monitor `reconnectCount` metric
4. Consider increasing reconnect threshold

### High latency

1. Check network conditions
2. Monitor `avgLatency` metric
3. Consider CDN for SSE endpoint
4. Verify server isn't overloaded

## Testing

Run frontend tests:

```bash
bun test test/frontend-performance.test.ts
```

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/sse-health-monitor.ts` | Core monitoring logic |
| `src/hooks/useSSEHealth.ts` | React hook |
| `src/components/SSEHealthDashboard.tsx` | UI dashboard |
| `src/lib/price.ts` | WebSocket fallback |
| `app/api/debug/sse-health/route.ts` | Debug API |
