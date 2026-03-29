import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'
import { errorResponse, successResponse } from '@/lib/utils/error-handler'
import { validateRequest, commonSchemas } from '@/lib/utils/request-validator'

export const dynamic = 'force-dynamic'

// GET /api/live/status - Get live mode status
export async function GET() {
  try {
    const state = liveModeManager.getState()

    return successResponse({
      isLiveMode: state.isLiveMode,
      isConnected: state.isConnected,
      balance: state.balance,
      availableBalance: state.availableBalance,
      lockedBalance: state.lockedBalance,
      totalBankroll: state.totalBankroll,
      allocatedBankroll: state.allocatedBankroll,
      freeBankroll: state.freeBankroll,
      positionsCount: state.positions.length,
      stats: state.stats,
      health: state.healthStatus,
      alertsCount: state.alerts.filter(a => !a.acknowledged).length,
    })
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error(String(error)))
  }
}

// POST /api/live/status - Enable/disable live mode
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    // Validate request
    const validated = validateRequest<{ action: string }>(body, commonSchemas.liveMode)

    if (validated.action === 'enable') {
      const result = await liveModeManager.enableLiveMode()
      if (result.success) {
        return successResponse({ enabled: true })
      }
      return errorResponse(new Error(result.error || 'Failed to enable live mode'))
    }

    if (validated.action === 'disable') {
      liveModeManager.disableLiveMode()
      return successResponse({ enabled: false })
    }

    // Should not reach here due to enum validation
    return errorResponse(new Error('Invalid action'))
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error(String(error)))
  }
}