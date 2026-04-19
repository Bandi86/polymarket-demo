import { NextRequest, NextResponse } from 'next/server'

import { getMarketEngine, broadcastToSSE, getBotManager } from '@/lib/global'
import { initializeClobClient, placeOrder as placeClobOrder, getConfig } from '@/lib/providers/clob-client'

export const dynamic = 'force-dynamic'

// POST /api/orders/place - Place an order on Polymarket
export async function POST(request: NextRequest) {
  const marketEngine = getMarketEngine()
  const botManager = getBotManager()
  const tradingMode = botManager.getTradingMode()

  const body = (await request.json()) as {
    tokenId?: string
    marketId?: string
    outcome?: 'YES' | 'NO'
    side?: 'BUY' | 'SELL'
    price?: number
    size?: number
    amount?: number
    mode?: 'demo' | 'live'  // Explicit mode override
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

  // Determine mode: explicit body mode > trading mode > default demo
  const isLiveMode = body?.mode === 'live' || (body?.mode !== 'demo' && tradingMode === 'live')

  console.log(`[DEBUG-ORDER] tradingMode=${tradingMode}, body.mode=${body?.mode}, isLiveMode=${isLiveMode}`);

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

    let result: { success: boolean; orderId?: string; error?: string }

    if (isLiveMode) {
      // Use new clob-client for live trading
      await initializeClobClient()
      const config = getConfig()

      if (!config.hasPrivateKey) {
        return NextResponse.json(
          { success: false, error: 'No private key configured for live trading' },
          { status: 400 }
        )
      }

      result = await placeClobOrder({
        tokenId,
        side: body.side,
        price,
        size,
      })

      console.log(`[API] Live order result:`, result)
      console.log(`[API] Live order placed: ${body.side} ${size} @ ${price} (token: ${tokenId})`)
    } else {
      // Demo mode - simulate order
      result = {
        success: true,
        orderId: `demo-${Date.now()}`,
      }
      console.log(`[API] Demo order simulated: ${body.side} ${size} @ ${price}`)
    }

    if (result.success) {
      // Broadcast order event
      broadcastToSSE('order_placed', {
        orderId: result.orderId,
        tokenId,
        side: body.side,
        price,
        size,
        mode: isLiveMode ? 'live' : 'demo',
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
