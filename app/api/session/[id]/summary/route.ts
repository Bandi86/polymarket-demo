import { NextResponse } from 'next/server';

import { getDatabaseService, getSessionSummaryGenerator } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/session/[id]/summary - Generate summary for a single session
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbService = getDatabaseService();
  const summaryGenerator = getSessionSummaryGenerator();
  const { id } = await params;

  try {
    const session = await dbService.getBotSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const positions = await dbService.getPositionsByBot(session.bot_id);
    const logs = await dbService.getSessionLogs(id);

    const summary = summaryGenerator.generate([session], positions);

    // Save summary to file
    const filepath = summaryGenerator.saveToFile(summary);

    return NextResponse.json({
      summary,
      filepath,
      session,
      positions: positions.length,
      logs: logs.length,
    });
  } catch (error) {
    console.error('[API] Session summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}