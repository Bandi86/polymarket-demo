import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/strategy/strategies - Get all strategies
export async function GET() {
  const botManager = getBotManager()
  return NextResponse.json(botManager.getStrategies())
}