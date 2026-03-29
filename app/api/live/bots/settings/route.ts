import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/live/bots/settings - Get all bot live settings
export async function GET() {
  const botManager = getBotManager()
  const bots = botManager.getBots()

  const settings = bots.map(bot => ({
    botName: bot.name,
    strategy: bot.strategy,
    ...liveModeManager.getBotSettings(bot.id)
  }))

  return NextResponse.json(settings)
}

// POST /api/live/bots/settings - Update bot live settings
export async function POST(request: Request) {
  const body = await request.json()
  const { botId, settings } = body

  if (!botId || !settings) {
    return NextResponse.json({ error: 'Missing botId or settings' }, { status: 400 })
  }

  const updated = liveModeManager.updateBotSettings(botId, settings)

  return NextResponse.json({
    success: true,
    settings: updated
  })
}