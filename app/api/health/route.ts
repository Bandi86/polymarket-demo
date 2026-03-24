import { NextResponse } from 'next/server';

import { getMarketEngine, getPriceService } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/health - Health check
export async function GET() {
  const marketEngine = getMarketEngine();
  const priceService = getPriceService();

  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    btcPrice: priceService.getPrice(),
    marketActive: !!marketEngine.getCurrentMarket(),
  });
}