import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';

import {
  getBotManager,
  getMarketEngine,
  getRiskManager,
  initializeServices,
  isInitialized,
} from '@/lib/global';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QuickRunBody {
  durationMinutes?: number;
}

/**
 * POST /api/competition/quick-run
 * Start a quick run with specified duration
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services if not already initialized
    if (!isInitialized()) {
      await initializeServices();
    }

    const body = (await request.json().catch(() => ({}))) as QuickRunBody;
    const durationMinutes = body.durationMinutes || 60;
    const durationMs = durationMinutes * 60 * 1000;

    const botManager = getBotManager();
    const riskManager = getRiskManager();
    const marketEngine = getMarketEngine();

    // Reset everything first
    botManager.resetAllBots();
    riskManager.resetAll();
    marketEngine.reset();

    // Wait for market to be ready (max 10 seconds)
    let retries = 0;
    while (!marketEngine.getCurrentMarket() && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      retries++;
    }

    if (!marketEngine.getCurrentMarket()) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get market data. Please try again.',
      });
    }

    // Start competition
    const competition = botManager.startCompetition({
      minTrades: 0,
      startBalance: 10,
      duration: durationMs,
    });

    // Schedule auto-stop after duration
    setTimeout(async () => {
      console.log(`[API] ${durationMinutes}min run complete, stopping...`);
      botManager.stopCompetition();

      // Save data to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/tmp/polymarket-${durationMinutes}m-run-${timestamp}.json`;

      const data = {
        timestamp: new Date().toISOString(),
        duration: durationMinutes,
        competition: botManager.getCompetitionState(),
        bots: botManager.getBots().map((b) => ({
          id: b.id,
          name: b.name,
          strategy: b.strategy,
          balance: b.portfolio?.balance,
          pnl: b.portfolio?.totalPnL,
          trades: b.portfolio?.totalTrades,
          winRate: b.portfolio?.winRate,
          stats: b.stats,
        })),
      };

      try {
        await writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`[API] Data saved to ${filename}`);
      } catch (e) {
        console.error('[API] Failed to save data:', e);
      }
    }, durationMs);

    return NextResponse.json({ success: true, competition });
  } catch (error) {
    console.error('[API] Error in quick-run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start quick run' },
      { status: 500 }
    );
  }
}