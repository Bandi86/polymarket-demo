import { NextRequest, NextResponse } from 'next/server'

import { initializeClobClient, cancelOrder as cancelClobOrder, getConfig } from '@/lib/providers/clob-client'

export const dynamic = 'force-dynamic'

// POST /api/orders/cancel - Cancel an order
export async function POST(request: NextRequest) {
  const config = await getConfig()

  if (!config.hasPrivateKey) {
    return NextResponse.json(
      { success: false, error: "No private key configured" },
      { status: 400 }
    )
  }

  const body = (await request.json()) as { orderId?: string }

  if (!body?.orderId) {
    return NextResponse.json(
      { success: false, error: 'Missing orderId' },
      { status: 400 }
    )
  }

  await initializeClobClient()
  const result = await cancelClobOrder(body.orderId)
  return NextResponse.json(result)
}
