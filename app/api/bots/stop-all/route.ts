import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/stop-all - Stop all bots
export async function POST() {
  const botManager = getBotManager()
  botManager.stopAllBots()
  return NextResponse.json({ success: true })
}