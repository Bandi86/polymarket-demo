import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/[id]/toggle - Toggle bot enabled state
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const botManager = getBotManager()
  const { id } = await params

  const bot = botManager.toggleBot(id)
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  return NextResponse.json(bot)
}