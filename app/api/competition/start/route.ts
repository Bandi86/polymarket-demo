import { NextRequest, NextResponse } from 'next/server';

import { broadcastToSSE, getBotManager } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartCompetitionBody {
  minTrades?: number;
  startBalance?: number;
  duration?: number | null;
}

/**
 * POST /api/competition/start
 * Start a new competition with optional configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as StartCompetitionBody;

    const botManager = getBotManager();
    const competition = botManager.startCompetition({
      minTrades: body.minTrades,
      startBalance: body.startBalance,
      duration: body.duration,
    });

    // Broadcast competition state change
    broadcastToSSE('competition', competition);

    return NextResponse.json({ success: true, competition });
  } catch (error) {
    console.error('[API] Error starting competition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start competition' },
      { status: 500 }
    );
  }
}