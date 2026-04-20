import { NextResponse } from 'next/server'

import {
  getBotManager,
  getPolymarketProvider,
  getRiskManager,
} from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/account - Get account info (balance, mode, risk settings)
export async function GET() {
  const botManager = getBotManager()
  const polymarketProvider = getPolymarketProvider()
  const riskManager = getRiskManager()

  const bots = botManager.getBots()
  const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)
  const config = await polymarketProvider.getConfig()

  // Get trading mode from botManager
  const tradingMode = botManager.getTradingMode()

  // Get live balance if in live mode
  let liveBalance = 0
  if (tradingMode === 'live') {
    try {
      const { getBalance } = await import('@/lib/providers/clob-client')
      await getBalance().then(b => { liveBalance = b.balance })
    } catch (e) {
      // ignore
    }
  }

  return NextResponse.json({
    mode: tradingMode,
    totalBalance,
    demoBalance: totalBalance,
    liveBalance,
    botCount: bots.length,
    riskSettings: riskManager.getSettings(),
    connectionStatus: config.hasCredentials ? 'configured' : 'not_configured',
    hasApiKey: !!config.apiKey,
    hasPrivateKey: config.hasPrivateKey,
  })
}