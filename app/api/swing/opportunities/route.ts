import { NextRequest, NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/swing/opportunities - Get swing entry opportunities
export async function GET(request: NextRequest) {
  try {
    const marketEngine = getMarketEngine();
    const market = marketEngine.getCurrentMarket();

    if (!market) {
      return NextResponse.json([]);
    }

    const yesPrice = parseFloat(market.outcomePrices?.yes || '0.5');
    const noPrice = parseFloat(market.outcomePrices?.no || '0.5');
    const timeRemaining = marketEngine.getTimeRemaining();

    const threshold = parseFloat(request.nextUrl.searchParams.get('threshold') || '0.15');
    const opportunities = [];

    // Check YES opportunity
    if (yesPrice <= threshold && yesPrice >= 0.04 && timeRemaining > 90_000) {
      opportunities.push({
        outcome: 'YES',
        currentPrice: yesPrice,
        targetPrice: yesPrice * 2,
        roi2x: (2 * 0.98 - 1) * 100,
        quality: yesPrice < 0.08 ? 'premium' : yesPrice < 0.12 ? 'good' : 'fair',
        timeRemaining,
      });
    }

    // Check NO opportunity
    if (noPrice <= threshold && noPrice >= 0.04 && timeRemaining > 90_000) {
      opportunities.push({
        outcome: 'NO',
        currentPrice: noPrice,
        targetPrice: noPrice * 2,
        roi2x: (2 * 0.98 - 1) * 100,
        quality: noPrice < 0.08 ? 'premium' : noPrice < 0.12 ? 'good' : 'fair',
        timeRemaining,
      });
    }

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error('[Swing Opportunities] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}