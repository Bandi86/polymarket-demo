import { NextResponse } from 'next/server'

import { getMarketEngine, getBinanceKlineProvider, getPriceService } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/markets/signals - Get signals for all active crypto markets
export async function GET() {
  const marketEngine = getMarketEngine()
  const binanceKlineProvider = getBinanceKlineProvider()
  const priceService = getPriceService()

  const markets = marketEngine.getAvailableMarkets()
  const lastSignal = binanceKlineProvider.getLastSignal()
  const btcPrice = priceService.getPrice()
  const signalStats = binanceKlineProvider.getStats()

  // Calculate signal for each market
  const marketSignals = markets.map((market) => {
    const yesPrice = parseFloat(market.outcomePrices?.yes || '0.5')
    const noPrice = parseFloat(market.outcomePrices?.no || '0.5')
    const timeRemaining = market.endTime - Date.now()

    // Determine if market is in scalp window (last 3-12 seconds)
    const inScalpWindow = timeRemaining <= 12000 && timeRemaining >= 3000

    // Get signal recommendation based on Binance data
    let recommendation = 'HOLD'
    let confidence = 0
    let reason = ''

    if (lastSignal && lastSignal.type !== 'NEUTRAL') {
      const signalAge = Date.now() - lastSignal.timestamp
      if (signalAge < 8000) {
        recommendation = lastSignal.predictedOutcome || 'HOLD'
        confidence = lastSignal.confidence
        reason = `Binance ${lastSignal.type}: ${lastSignal.changePercent >= 0 ? '+' : ''}${lastSignal.changePercent.toFixed(4)}%`
      }
    }

    // Calculate ROI for each outcome
    const yesRoi = yesPrice > 0 ? (1 / yesPrice - 1) * 100 : 0
    const noRoi = noPrice > 0 ? (1 / noPrice - 1) * 100 : 0

    return {
      id: market.id,
      question: market.question,
      category: market.category,
      endTime: market.endTime,
      timeRemaining,
      yesPrice,
      noPrice,
      yesRoi,
      noRoi,
      volume: market.volumeNum || 0,
      liquidity: market.liquidity || 0,
      signal: {
        recommendation,
        confidence,
        reason,
        inScalpWindow,
      },
      is5Min: market.is5Min,
    }
  })

  return NextResponse.json({
    markets: marketSignals,
    btcPrice,
    lastSignal,
    signalStats,
    timestamp: Date.now(),
  })
}