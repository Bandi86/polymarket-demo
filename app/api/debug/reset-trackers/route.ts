import { NextResponse } from 'next/server'
import { resetAllLossTrackers } from '@/lib/bot-manager/index'

// POST /api/debug/reset-trackers - Reset all loss trackers
export async function POST() {
  resetAllLossTrackers()
  return NextResponse.json({ success: true, message: "Loss trackers reset" })
}
