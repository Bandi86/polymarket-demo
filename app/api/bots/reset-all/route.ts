import { NextResponse } from 'next/server'

import { broadcastToSSE, getBotManager, getMarketEngine, getDatabaseService } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/reset-all - Reset all bots and clear all positions
export async function POST() {
  const botManager = getBotManager()
  const marketEngine = getMarketEngine()
  const dbService = getDatabaseService()

  // Clear all positions from market engine
  marketEngine.clearAllPositions()

  // Clear positions from database
  await dbService.clearData()

  // Reset all bots to fresh state
  botManager.resetAllBots()

  // Broadcast updated bots state
  broadcastToSSE('bots', botManager.getBots())

  return NextResponse.json({ success: true })
}