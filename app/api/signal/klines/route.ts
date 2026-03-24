import { NextResponse } from 'next/server'

import { getBinanceKlineProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/signal/klines - Get kline history
export async function GET(request: Request) {
  const binanceKlineProvider = getBinanceKlineProvider()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const klines = binanceKlineProvider.getKlineHistory(limit)
  return NextResponse.json(klines)
}