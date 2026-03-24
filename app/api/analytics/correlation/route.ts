import { NextResponse } from 'next/server';

import { getAnalyticsService } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const analytics = getAnalyticsService();
  return NextResponse.json(analytics.calculateStrategyCorrelationMatrix());
}