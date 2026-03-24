import { NextResponse } from 'next/server'

import { getRiskManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/risk/warnings - Get risk warnings
export async function GET(request: Request) {
  const riskManager = getRiskManager()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  return NextResponse.json(riskManager.getWarnings(limit))
}