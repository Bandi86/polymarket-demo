import { NextResponse } from 'next/server';
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

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * POST /api/competition/one-hour-run
 * Start 1-hour run with auto-save (legacy endpoint)
 */
export async function POST() {
  try {
    // Initialize services if not already initialized
    if (!isInitialized()) {
      await initializeServices();
    }

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

    // Start competition for 1 hour
    const competition = botManager.startCompetition({
      minTrades: 0, // No minimum trades requirement
      startBalance: 10,
      duration: ONE_HOUR_MS,
    });

    // Note: startCompetition already enables and starts all bots

    // Schedule auto-stop and save after 1 hour
    setTimeout(async () => {
      console.log('[API] 1-hour run complete, stopping and saving data...');
      botManager.stopCompetition();

      // Save all data to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/tmp/polymarket-1hr-run-${timestamp}.json`;

      const data = {
        timestamp: new Date().toISOString(),
        competition: botManager.getCompetitionState(),
        bots: botManager.getBots().map((b) => ({
          id: b.id,
          name: b.name,
          strategy: b.strategy,
          balance: b.portfolio?.balance,
          stats: b.stats,
          portfolio: b.portfolio,
        })),
        logs: botManager.getLogs(500),
      };

      try {
        await writeFile(filename, JSON.stringify(data, null, 2));
        console.log(`[API] Data saved to ${filename}`);
      } catch (e) {
        console.error('[API] Failed to save data:', e);
      }
    }, ONE_HOUR_MS);

    return NextResponse.json({
      success: true,
      competition,
      message:
        '1-hour run started. All bots enabled. Data will be auto-saved to /tmp/polymarket-1hr-run-*.json',
    });
  } catch (error) {
    console.error('[API] Error in one-hour-run:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start 1-hour run' },
      { status: 500 }
    );
  }
}