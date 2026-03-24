import { NextRequest, NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/orders/cancel - Cancel an order
export async function POST(request: NextRequest) {
  const polymarketProvider = getPolymarketProvider()

  const body = (await request.json()) as { orderId?: string }

  if (!body?.orderId) {
    return NextResponse.json(
      { success: false, error: 'Missing orderId' },
      { status: 400 }
    )
  }

  const result = await polymarketProvider.cancelOrder(body.orderId)
  return NextResponse.json(result)
}