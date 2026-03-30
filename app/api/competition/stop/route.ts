import { NextResponse } from 'next/server';

import { broadcastToSSE, getBotManager, getDatabaseService, getSessionSummaryGenerator } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/competition/stop
 * Stop the current competition
 */
export async function POST() {
  try {
    const botManager = getBotManager();
    const dbService = getDatabaseService();
    const summaryGenerator = getSessionSummaryGenerator();

    const competition = botManager.stopCompetition();

    // Generate session summary
    try {
      const sessions = await dbService.getAllBotSessions(20);
      const allPositions = [];
      for (const session of sessions) {
        const positions = await dbService.getPositionsByBot(session.bot_id);
        allPositions.push(...positions);
      }

      if (sessions.length > 0) {
        const summary = summaryGenerator.generate(sessions, allPositions);
        const filepath = summaryGenerator.saveToFile(summary);

        // Broadcast summary via SSE
        broadcastToSSE('summary_generated', {
          filepath,
          sessions: sessions.length,
          positions: allPositions.length
        });
      }
    } catch (summaryError) {
      console.error('[API] Error generating summary:', summaryError);
      // Don't fail the whole request if summary generation fails
    }

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