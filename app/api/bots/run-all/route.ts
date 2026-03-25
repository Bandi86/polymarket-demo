import { NextRequest, NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager, getMarketEngine, getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/run-all - Run all bots
export async function POST(request: NextRequest) {
  const botManager = getBotManager()
  const marketEngine = getMarketEngine()
  const polymarketProvider = getPolymarketProvider()

  let body = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  // KRITIKUS: Ha live módban van, ellenőrizzük a balance-t
  if (botManager.getTradingMode() === "live") {
    try {
      const balanceResult = await polymarketProvider.fetchAccountBalance()
      if (!balanceResult.success || balanceResult.balance === 0) {
        return NextResponse.json({
          success: false,
          error: "Cannot start bots in live mode with $0 balance. Switch to demo mode or deposit USDC.",
          currentMode: "live",
          balance: balanceResult.balance || 0
        }, { status: 400 })
      }
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `Failed to verify Polymarket balance: ${err}`,
      }, { status: 400 })
    }
  }

  const { betSize, interval } = body as { betSize?: number; interval?: number }
  botManager.runAllBots({ betSize, interval })

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true })
}