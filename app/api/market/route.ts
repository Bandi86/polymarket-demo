import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const marketEngine = getMarketEngine();
  const market = marketEngine.getCurrentMarket();
  const timeRemaining = marketEngine.getTimeRemaining();
  const totalDuration = market ? market.endTime - market.startTime : 0;

  return NextResponse.json({
    market,
    timeRemaining,
    totalDuration,
    marketDuration: totalDuration,
    startedAt: market?.startTime || Date.now(),
  });
}