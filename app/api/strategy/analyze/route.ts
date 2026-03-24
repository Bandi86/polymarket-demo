import { NextResponse } from 'next/server'

import { getMarketEngine, getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/strategy/analyze - Use Polymarket odds
export async function GET() {
  const marketEngine = getMarketEngine()
  const botManager = getBotManager()
  const market = marketEngine.getCurrentMarket()
  const yesPrice = parseFloat(market?.outcomePrices?.yes || '0.5')
  const noPrice = parseFloat(market?.outcomePrices?.no || '0.5')
  const yesPriceHistory = market?.yesPriceHistory || []
  const priceHistory = yesPriceHistory.map((p) => p.price)

  // Calculate volatility
  let volatility = 0
  if (priceHistory.length >= 5) {
    const changes: number[] = []
    for (let i = 1; i < priceHistory.length; i++) {
      changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]))
    }
    volatility = changes.reduce((a, b) => a + b, 0) / changes.length
  }

  // Calculate momentum
  let momentum = 0
  if (priceHistory.length >= 3) {
    const recent = priceHistory.slice(-3)
    const older = priceHistory.slice(-6, -3)
    if (older.length > 0) {
      momentum =
        recent.reduce((a, b) => a + b, 0) / recent.length -
        older.reduce((a, b) => a + b, 0) / older.length
    }
  }

  // Fair value signal
  const fairValue = 0.5 // Neutral baseline
  const edge = fairValue - yesPrice
  const fairValueAction =
    edge > 0.05 ? 'BUY_YES' : edge < -0.05 ? 'BUY_NO' : 'HOLD'

  // Anomaly
  const sum = yesPrice + noPrice
  const anomalyAction = sum < 0.98 ? 'BUY_BOTH' : 'HOLD'

  // Momentum signal
  const momentumAction =
    momentum > 0.005 ? 'BUY_YES' : momentum < -0.005 ? 'BUY_NO' : 'HOLD'

  return NextResponse.json({
    fairValue: { action: fairValueAction, fairValue, edge },
    anomaly: { action: anomalyAction, sum, confidence: Math.abs(1 - sum) },
    momentum: {
      action: momentumAction,
      momentum,
      confidence: Math.abs(momentum) * 50,
    },
    volatility,
    marketPrice: { yesPrice, noPrice },
  })
}