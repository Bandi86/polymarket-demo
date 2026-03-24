import { NextResponse } from 'next/server'

import { getMarketEngine } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/markets/available - List of tradeable markets
export async function GET() {
  const marketEngine = getMarketEngine()
  const markets = marketEngine.getAvailableMarkets()
  return NextResponse.json(markets)
}