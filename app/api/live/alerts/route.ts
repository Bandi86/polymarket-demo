import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'

export const dynamic = 'force-dynamic'

// GET /api/live/alerts - Get live alerts
export async function GET() {
  const state = liveModeManager.getState()

  return NextResponse.json({
    alerts: state.alerts,
    unacknowledged: state.alerts.filter(a => !a.acknowledged)
  })
}

// POST /api/live/alerts - Acknowledge or clear alerts
export async function POST(request: Request) {
  const body = await request.json()
  const { action, alertId } = body

  if (action === 'acknowledge' && alertId) {
    liveModeManager.acknowledgeAlert(alertId)
    return NextResponse.json({ success: true })
  }

  if (action === 'clear') {
    liveModeManager.clearAlerts()
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}