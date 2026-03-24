import { NextResponse } from 'next/server';

import { getMarketEngine, getPriceService } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const marketEngine = getMarketEngine();
  const priceService = getPriceService();
  const market = marketEngine.getCurrentMarket();
  const timeRemaining = marketEngine.getTimeRemaining();
  const totalDuration = market ? market.endTime - market.startTime : 0;
  const btcPrice = priceService.getPrice();

  return NextResponse.json({
    market,
    btcPrice,
    timeRemaining,
    totalDuration,
    marketDuration: totalDuration,
    startedAt: market?.startTime || Date.now(),
    priceToBeat: market?.priceToBeat,
  });
}