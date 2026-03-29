import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/competition/status - Get competition status
export async function GET() {
  const botManager = getBotManager()
  const competition = botManager.getCompetitionState()

  return NextResponse.json(competition)
}