import { NextResponse } from 'next/server'

import { getBinanceKlineProvider } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/signal/threshold - Set signal threshold
export async function POST(request: Request) {
  const binanceKlineProvider = getBinanceKlineProvider()
  const body = await request.json() as { threshold?: number }

  if (body?.threshold !== undefined && body.threshold > 0) {
    binanceKlineProvider.setThreshold(body.threshold)
    return NextResponse.json({ success: true, threshold: body.threshold })
  }

  return NextResponse.json(
    { success: false, error: 'Invalid threshold' },
    { status: 400 },
  )
}