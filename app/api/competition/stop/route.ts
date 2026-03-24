import { NextResponse } from 'next/server';

import { broadcastToSSE, getBotManager } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/competition/stop
 * Stop the current competition
 */
export async function POST() {
  try {
    const botManager = getBotManager();
    const competition = botManager.stopCompetition();

    // Broadcast competition state change
    broadcastToSSE('competition', competition);

    return NextResponse.json({ success: true, competition });
  } catch (error) {
    console.error('[API] Error stopping competition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop competition' },
      { status: 500 }
    );
  }
}