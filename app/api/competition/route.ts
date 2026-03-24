import { NextResponse } from 'next/server';

import { getBotManager } from '@/lib/global';
import { broadcastToSSE } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/competition
 * Get current competition state
 */
export async function GET() {
  const botManager = getBotManager();
  return NextResponse.json(botManager.getCompetitionState());
}