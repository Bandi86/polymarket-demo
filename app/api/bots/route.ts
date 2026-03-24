import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/bots - Get all bots
export async function GET() {
  const botManager = getBotManager()
  return NextResponse.json(botManager.getBots())
}