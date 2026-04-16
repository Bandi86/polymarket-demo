import { NextResponse } from 'next/server'

import { initializeClobClient, getPositions as fetchClobPositions, getConfig } from '@/lib/providers/clob-client'

export const dynamic = 'force-dynamic'

// GET /api/orders/positions - Get live positions from Polymarket
export async function GET() {
  // Initialize CLOB client
  await initializeClobClient()
  const config = getConfig()

  if (!config.hasPrivateKey) {
    return NextResponse.json({
      positions: [],
      success: false,
      error: "No private key configured",
    })
  }

  const result = await fetchClobPositions()
  return NextResponse.json(result)
}
