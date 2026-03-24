import { NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/polymarket/test-connection - Test Polymarket API connection
export async function POST() {
  const polymarketProvider = getPolymarketProvider()

  try {
    const markets = await polymarketProvider.fetchActiveMarkets()
    if (markets && markets.length > 0) {
      return NextResponse.json({ success: true, marketsFound: markets.length })
    }
    return NextResponse.json({
      success: true,
      marketsFound: 0,
      message: 'Connected but no active markets found',
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to Polymarket API',
    })
  }
}