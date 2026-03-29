import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'

export const dynamic = 'force-dynamic'

// GET /api/live/balance - Get current live balance
export async function GET() {
  if (!liveModeManager.isLiveMode()) {
    return NextResponse.json({
      success: false,
      error: "Not in live mode"
    })
  }

  // Force sync balance
  const result = await liveModeManager.syncBalance()

  return NextResponse.json({
    success: result.success,
    balance: result.balance,
    error: result.error
  })
}