import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/debug/engine - Get engine debug info
export async function GET() {
  const marketEngine = getMarketEngine();

  return NextResponse.json({
    currentMarket: marketEngine.getCurrentMarket(),
    config: (marketEngine as any).config,
    settledMarketIds: Array.from((marketEngine as any).settledMarketIds || []),
    lastUpdate: (marketEngine as any).lastUpdate,
  });
}