import { NextResponse } from 'next/server'

import { getBinanceKlineProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/signal - Get Binance signal data
export async function GET() {
  const binanceKlineProvider = getBinanceKlineProvider()
  const lastSignal = binanceKlineProvider.getLastSignal()
  const signalHistory = binanceKlineProvider.getSignalHistory(20)
  const stats = binanceKlineProvider.getStats()
  const currentKline = binanceKlineProvider.getCurrentKline()
  const previousKline = binanceKlineProvider.getPreviousKline()

  return NextResponse.json({
    currentKline,
    previousKline,
    lastSignal,
    signalHistory,
    stats,
    threshold: binanceKlineProvider.getThreshold(),
  })
}