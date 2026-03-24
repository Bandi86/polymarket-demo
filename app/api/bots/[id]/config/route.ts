import { NextRequest, NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/[id]/config - Update bot configuration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const botManager = getBotManager()
  const { id } = await params

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bot = botManager.updateBotConfig(id, body as Record<string, unknown>)
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true, bot })
}