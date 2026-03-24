import { NextResponse } from 'next/server';

import { getAnalyticsService, getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const analytics = getAnalyticsService();
  const marketEngine = getMarketEngine();
  const positions = marketEngine.getOpenPositions().concat(marketEngine.getClosedPositions());
  return NextResponse.json(analytics.calculateTradeDistribution(positions));
}