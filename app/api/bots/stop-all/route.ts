import { NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/stop-all - Stop all bots
export async function POST() {
  const botManager = getBotManager()
  botManager.stopAllBots()

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true })
}