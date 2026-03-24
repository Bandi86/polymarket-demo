import { NextResponse } from 'next/server';

import { getAnalyticsService, getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const analytics = getAnalyticsService();
  const marketEngine = getMarketEngine();
  const market = marketEngine.getCurrentMarket();
  const priceHistory = market?.yesPriceHistory?.map(p => p.price) || [];

  const analysis = analytics.analyzeMarketPhase(priceHistory.length > 0 ? priceHistory : [0.5]);

  // Find alternative strategies based on phase
  const alternatives: string[] = [];
  if (analysis.phase === 'volatile') {
    alternatives.push('momentum', 'binance_signal');
  } else if (analysis.phase === 'trending_up' || analysis.phase === 'trending_down') {
    alternatives.push('trend', 'smart_trend');
  } else {
    alternatives.push('mean_reversion', 'fair_value');
  }

  return NextResponse.json({
    phase: analysis.phase,
    confidence: analysis.confidence,
    recommendedStrategy: analysis.recommendedStrategy,
    alternativeStrategies: alternatives.filter(s => s !== analysis.recommendedStrategy).slice(0, 2),
    reason: analysis.reason,
    metrics: analysis.metrics,
  });
}