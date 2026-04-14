import { NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager, getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/[id]/toggle - Toggle bot enabled state
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const botManager = getBotManager()
  const polymarketProvider = getPolymarketProvider()
  const { id } = await params

  // Check if we're enabling a bot
  const currentBot = botManager.getBot(id)
  if (!currentBot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  // KRITIKUS: Ha live módban van és bekapcsolunk egy botot, ellenőrizzük a balance-t
  if (!currentBot.enabled && botManager.getTradingMode() === "live") {
    try {
      const balanceResult = await polymarketProvider.fetchAccountBalance()
      if (!balanceResult.success || balanceResult.balance === 0) {
        return NextResponse.json({
          error: "Cannot start bot in live mode with $0 balance. Switch to demo mode or deposit USDC.",
          currentMode: "live",
          balance: balanceResult.balance || 0
        }, { status: 400 })
      }
    } catch (err) {
      return NextResponse.json({
        error: `Failed to verify Polymarket balance: ${err}`,
      }, { status: 400 })
    }
  }

  const bot = botManager.toggleBot(id)
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  console.log(`[API] toggle bot ${id}: enabled=${bot.enabled}, portfolio balance=${bot.portfolio?.balance}`)

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json(bot)
}