import { NextResponse } from 'next/server'

import { getPolymarketProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/account/sync - Sync live account balance from Polymarket
export async function POST() {
  const polymarketProvider = getPolymarketProvider()

  const result = await polymarketProvider.fetchAccountBalance()

  if (!result.success) {
    return NextResponse.json({
      success: false,
      error: result.error || 'Failed to fetch live balance',
      isLive: false,
    })
  }

  return NextResponse.json({
    success: true,
    isLive: true,
    balance: result.balance,
    available: result.available,
    locked: result.locked,
    lastSync: Date.now(),
  })
}