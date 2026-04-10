import { NextRequest, NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/stop-selected - Stop selected bots
export async function POST(request: NextRequest) {
  const botManager = getBotManager()

  let body = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  const { botIds } = body as { botIds: string[] }

  if (!botIds || !Array.isArray(botIds) || botIds.length === 0) {
    return NextResponse.json({
      success: false,
      error: "botIds array is required"
    }, { status: 400 })
  }

  // Stop only the selected bots
  botManager.stopSelectedBots(botIds)

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true, stoppedBots: botIds })
}