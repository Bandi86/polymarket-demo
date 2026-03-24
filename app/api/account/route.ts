import { NextResponse } from 'next/server'

import {
  getBotManager,
  getMarketEngine,
  getPolymarketProvider,
  getRiskManager,
} from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/account - Get account info (balance, mode, risk settings)
export async function GET() {
  const botManager = getBotManager()
  const marketEngine = getMarketEngine()
  const polymarketProvider = getPolymarketProvider()
  const riskManager = getRiskManager()

  const bots = botManager.getBots()
  const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)
  const config = polymarketProvider.getConfig()

  return NextResponse.json({
    mode: marketEngine.getMode() === 'real' ? 'live' : 'demo',
    totalBalance,
    botCount: bots.length,
    riskSettings: riskManager.getSettings(),
    connectionStatus: config.hasCredentials ? 'configured' : 'not_configured',
    hasApiKey: !!config.apiKey,
  })
}