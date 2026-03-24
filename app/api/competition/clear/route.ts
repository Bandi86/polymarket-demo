import { NextResponse } from 'next/server';

import { broadcastToSSE, getBotManager } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/competition/clear
 * Clear the competition state
 */
export async function POST() {
  try {
    const botManager = getBotManager();
    const competition = botManager.clearCompetition();

    // Broadcast competition state change
    broadcastToSSE('competition', competition);

    return NextResponse.json({ success: true, competition });
  } catch (error) {
    console.error('[API] Error clearing competition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear competition' },
      { status: 500 }
    );
  }
}