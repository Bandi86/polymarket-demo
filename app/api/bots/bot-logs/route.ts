import { NextRequest, NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/bots/bot-logs - Get bot activity logs
export async function GET(request: NextRequest) {
  const botManager = getBotManager()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  return NextResponse.json(botManager.getLogs(limit))
}