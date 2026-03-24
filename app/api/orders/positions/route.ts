import { NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/orders/positions - Get live positions from Polymarket
export async function GET() {
  const polymarketProvider = getPolymarketProvider()
  const result = await polymarketProvider.fetchPositions()
  return NextResponse.json(result)
}