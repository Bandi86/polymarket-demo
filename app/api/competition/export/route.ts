import { NextResponse } from 'next/server';

import { getBotManager, getMarketEngine, initializeServices, isInitialized } from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/competition/export
 * Export all competition data
 */
export async function GET() {
  try {
    // Initialize services if not already initialized
    if (!isInitialized()) {
      await initializeServices();
    }

    const botManager = getBotManager();
    const marketEngine = getMarketEngine();

    const data = {
      exportedAt: new Date().toISOString(),
      competition: botManager.getCompetitionState(),
      bots: botManager.getBots().map((b) => ({
        id: b.id,
        name: b.name,
        strategy: b.strategy,
        enabled: b.enabled,
        balance: b.portfolio?.balance,
        stats: b.stats,
        portfolio: b.portfolio,
      })),
      logs: botManager.getLogs(500),
      market: marketEngine.getCurrentMarket(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error exporting competition data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export competition data' },
      { status: 500 }
    );
  }
}