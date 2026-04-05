import { NextResponse } from 'next/server';

import { SSEHealthMonitor } from '@/lib/sse-health-monitor';

export const dynamic = 'force-dynamic';

// GET /api/debug/sse-health - Get SSE connection health metrics
export async function GET() {
  const metrics = SSEHealthMonitor.getMetrics();
  const alerts = SSEHealthMonitor.getAlerts();
  const status = SSEHealthMonitor.getStatus();
  const isHealthy = SSEHealthMonitor.isHealthy();

  return NextResponse.json({
    success: true,
    status,
    isHealthy,
    metrics,
    alerts,
    thresholds: {
      maxLatencyMs: 5000,
      minMessageFreq: 0.1,
      maxErrorCount: 10,
      reconnectThreshold: 3,
    },
  });
}
