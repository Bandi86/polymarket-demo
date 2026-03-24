import { NextResponse } from 'next/server'

import { getRiskManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/risk/settings - Get risk settings
export async function GET() {
  const riskManager = getRiskManager()
  return NextResponse.json(riskManager.getSettings())
}

// POST /api/risk/settings - Update risk settings
export async function POST(request: Request) {
  const riskManager = getRiskManager()
  const body = await request.json()
  riskManager.updateSettings(body)
  return NextResponse.json({ success: true, settings: riskManager.getSettings() })
}