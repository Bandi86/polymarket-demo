import { NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/[id]/reset - Reset a specific bot's balance
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const botManager = getBotManager()
  const { id } = await params

  const bot = botManager.resetBot(id)
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true, bot })
}