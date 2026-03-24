import { NextRequest, NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/run-all - Run all bots
export async function POST(request: NextRequest) {
  const botManager = getBotManager()

  let body = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  const { betSize, interval } = body as { betSize?: number; interval?: number }
  botManager.runAllBots({ betSize, interval })

  return NextResponse.json({ success: true })
}