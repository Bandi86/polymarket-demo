import { NextResponse } from 'next/server';

import { getDatabaseService, getSessionSummaryGenerator } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/competition/summary
 * Generate summary for all sessions in the competition
 */
export async function POST() {
  try {
    const dbService = getDatabaseService();
    const summaryGenerator = getSessionSummaryGenerator();

    const sessions = await dbService.getAllBotSessions(50);
    const allPositions = [];

    for (const session of sessions) {
      const positions = await dbService.getPositionsByBot(session.bot_id);
      allPositions.push(...positions);
    }

    if (sessions.length === 0) {
      return NextResponse.json({
        error: 'No sessions found',
        summary: null,
        filepath: null,
      });
    }

    const summary = summaryGenerator.generate(sessions, allPositions);
    const filepath = summaryGenerator.saveToFile(summary);

    return NextResponse.json({
      summary,
      filepath,
      sessions: sessions.length,
      positions: allPositions.length,
    });
  } catch (error) {
    console.error('[API] Competition summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}