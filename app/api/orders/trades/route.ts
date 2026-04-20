import { NextResponse } from 'next/server'

import { initializeClobClient, getTrades as fetchClobTrades, getConfig } from '@/lib/providers/clob-client'

export const dynamic = 'force-dynamic'

// GET /api/orders/trades - Get trade history from Polymarket
export async function GET() {
  // Initialize CLOB client
  await initializeClobClient()
  const config = await getConfig()

  if (!config.hasPrivateKey) {
    return NextResponse.json({
      trades: [],
      success: false,
      error: "No private key configured",
    })
  }

  const result = await fetchClobTrades()
  return NextResponse.json(result)
}
