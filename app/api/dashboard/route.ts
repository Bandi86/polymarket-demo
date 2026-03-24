import { NextResponse } from 'next/server'

import { getMarketEngine, getBinanceKlineProvider, getPriceService, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/dashboard - Combined dashboard data
export async function GET() {
  const marketEngine = getMarketEngine()
  const binanceKlineProvider = getBinanceKlineProvider()
  const priceService = getPriceService()
  const botManager = getBotManager()

  const market = marketEngine.getCurrentMarket()
  const timeRemaining = marketEngine.getTimeRemaining()
  const portfolio = marketEngine.getPortfolio()
  const lastSignal = binanceKlineProvider.getLastSignal()
  const signalStats = binanceKlineProvider.getStats()
  const bots = botManager.getBots()
  const activeBots = bots.filter((b) => b.enabled)

  return NextResponse.json({
    market,
    timeRemaining,
    portfolio,
    btcPrice: priceService.getPrice(),
    signal: lastSignal,
    signalStats,
    activeBots: activeBots.length,
    totalBots: bots.length,
    timestamp: Date.now(),
  })
}