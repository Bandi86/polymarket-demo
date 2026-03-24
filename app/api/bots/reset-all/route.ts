import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

// POST /api/bots/reset-all - Reset all bots
export async function POST() {
  const botManager = getBotManager()
  botManager.resetAllBots()
  return NextResponse.json({ success: true })
}