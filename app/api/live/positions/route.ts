import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'

export const dynamic = 'force-dynamic'

// GET /api/live/positions - Get live positions
export async function GET() {
  if (!liveModeManager.isLiveMode()) {
    return NextResponse.json({
      positions: [],
      success: false,
      error: "Not in live mode"
    })
  }

  // Sync positions first
  const result = await liveModeManager.syncPositions()
  const state = liveModeManager.getState()

  return NextResponse.json({
    positions: state.positions,
    success: result.success
  })
}