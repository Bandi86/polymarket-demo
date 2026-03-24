import { NextRequest, NextResponse } from 'next/server'

import { getMarketEngine, getPolymarketProvider, broadcastToSSE } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/orders/place - Place an order on Polymarket
export async function POST(request: NextRequest) {
  const polymarketProvider = getPolymarketProvider()
  const marketEngine = getMarketEngine()

  const body = (await request.json()) as {
    tokenId?: string
    marketId?: string
    outcome?: 'YES' | 'NO'
    side?: 'BUY' | 'SELL'
    price?: number
    size?: number
    amount?: number
  }

  // Validate required fields
  if (!body?.marketId && !body?.tokenId) {
    return NextResponse.json(
      { success: false, error: 'Missing marketId or tokenId' },
      { status: 400 }
    )
  }
  if (!body?.side) {
    return NextResponse.json(
      { success: false, error: 'Missing side (BUY/SELL)' },
      { status: 400 }
    )
  }
  if (!body?.price && body?.side === 'BUY') {
    return NextResponse.json(
      { success: false, error: 'Missing price' },
      { status: 400 }
    )
  }
  if (!body?.size && !body?.amount) {
    return NextResponse.json(
      { success: false, error: 'Missing size or amount' },
      { status: 400 }
    )
  }

  try {
    // Get token ID from market if not provided
    let tokenId = body.tokenId
    if (!tokenId && body.marketId) {
      const market = marketEngine.getCurrentMarket()
      if (market && market.id === body.marketId && market.tokens) {
        // Find YES or NO token
        const tokenOutcome = body.outcome || 'YES'
        const token = market.tokens.find(
          (t) =>
            t.outcome.toLowerCase() === tokenOutcome.toLowerCase() ||
            t.outcome.toLowerCase().includes(tokenOutcome === 'YES' ? 'up' : 'down')
        )
        tokenId = token?.token_id
      }
    }

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine token ID' },
        { status: 400 }
      )
    }

    // Calculate size from amount if needed
    let size = body.size || 0
    let price = body.price || 0
    if (!size && body.amount && price > 0) {
      size = body.amount / price
    }

    const result = await polymarketProvider.placeOrder({
      tokenId,
      side: body.side,
      price,
      size,
    })

    if (result.success) {
      // Broadcast order event
      broadcastToSSE('order_placed', {
        orderId: result.orderId,
        tokenId,
        side: body.side,
        price,
        size,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Order placement error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}