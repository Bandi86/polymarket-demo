import { NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/simulation/toggle - Toggle simulation mode
export async function POST(request: Request) {
  const polymarketProvider = getPolymarketProvider()

  let body: { enabled?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  const enabled = body?.enabled ?? true
  polymarketProvider.setSimulationMode(enabled)
  return NextResponse.json({ success: true, simulationEnabled: enabled })
}