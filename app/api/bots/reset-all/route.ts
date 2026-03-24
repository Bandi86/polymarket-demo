import { NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/reset-all - Reset all bots
export async function POST() {
  const botManager = getBotManager()
  botManager.resetAllBots()

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true })
}