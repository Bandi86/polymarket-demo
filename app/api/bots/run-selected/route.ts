import { NextRequest, NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager, getMarketEngine, getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/run-selected - Run selected bots
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

  const { botIds, betSize, interval } = body as { botIds: string[]; betSize?: number; interval?: number }

  if (!botIds || !Array.isArray(botIds) || botIds.length === 0) {
    return NextResponse.json({
      success: false,
      error: "botIds array is required"
    }, { status: 400 })
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

  // Run only the selected bots
  console.log(`[API] run-selected: starting bots:`, botIds);
  botManager.runSelectedBots(botIds, { betSize, interval });
  console.log(`[API] run-selected: bots started, getting updated state`);

  // Broadcast updated bots state
  const updatedBots = botManager.getBots();
  console.log(`[API] run-selected: broadcasting ${updatedBots.length} bots, enabled:`, updatedBots.filter(b => b.enabled).map(b => b.id));
  broadcastToSSE('bots', updatedBots);

  return NextResponse.json({ success: true, startedBots: botIds, enabledCount: updatedBots.filter(b => b.enabled).length })
}