import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/positions - Get all positions (open and settled)
export async function GET() {
  const marketEngine = getMarketEngine();
  return NextResponse.json({
    open: marketEngine.getOpenPositions(),
    settled: marketEngine.getClosedPositions(),
  });
}