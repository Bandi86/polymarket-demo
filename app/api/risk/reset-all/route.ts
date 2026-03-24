import { NextResponse } from 'next/server'

import { getRiskManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/risk/reset-all - Reset all risk states
export async function POST() {
  const riskManager = getRiskManager()
  riskManager.resetAll()
  return NextResponse.json({ success: true })
}