import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/simulation/status - Get simulation status
export async function GET() {
  // Always true for now - simulation mode is kept for API compatibility
  return NextResponse.json({ simulationEnabled: true })
}