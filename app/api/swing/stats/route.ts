import { NextRequest, NextResponse } from 'next/server';

import { getPositionMonitor } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/swing/stats - Get monitor stats and targets
export async function GET(request: NextRequest) {
  try {
    const positionMonitor = getPositionMonitor();

    const stats = positionMonitor.getStats();
    const targets = positionMonitor.getTargets();

    return NextResponse.json({
      monitor: stats,
      targets,
    });
  } catch (error) {
    console.error('[Swing Stats] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}