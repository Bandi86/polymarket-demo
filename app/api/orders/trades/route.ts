import { NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/orders/trades - Get trade history from Polymarket
export async function GET() {
  const polymarketProvider = getPolymarketProvider()
  const result = await polymarketProvider.fetchTrades()
  return NextResponse.json(result)
}