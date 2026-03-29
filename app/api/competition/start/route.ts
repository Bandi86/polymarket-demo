import { NextRequest, NextResponse } from 'next/server';

import {
  broadcastToSSE,
  getBotManager,
  getMarketEngine,
  getRiskManager,
  initializeServices,
  isInitialized,
} from '@/lib/global';
import { AppError, errorResponse, successResponse, validateRange } from '@/lib/utils/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartCompetitionBody {
  minTrades?: number;
  startBalance?: number;
  duration?: number | null;
  durationMinutes?: number;
  durationSeconds?: number;
}

/**
 * POST /api/competition/start
 * Start a new competition with optional configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize services if not already initialized
    if (!isInitialized()) {
      await initializeServices();
    }

    const body = (await request.json().catch(() => ({}))) as StartCompetitionBody;

    // Validate inputs
    if (body.startBalance !== undefined) {
      validateRange(body.startBalance, 1, 1000, 'startBalance');
    }
    if (body.durationMinutes !== undefined) {
      validateRange(body.durationMinutes, 1, 1440, 'durationMinutes');
    }
    if (body.durationSeconds !== undefined) {
      validateRange(body.durationSeconds, 30, 86400, 'durationSeconds');
    }

    // Support multiple duration formats (ms, minutes, or seconds)
    let durationMs: number | null = null;
    if (body.duration !== undefined && body.duration !== null) {
      durationMs = body.duration;
    } else if (body.durationSeconds) {
      durationMs = body.durationSeconds * 1000;
    } else if (body.durationMinutes) {
      durationMs = body.durationMinutes * 60 * 1000;
    }

    const botManager = getBotManager();
    const riskManager = getRiskManager();
    const marketEngine = getMarketEngine();

    // KRITIKUS: Ensure demo mode
    if (botManager.getTradingMode() === "live") {
      console.warn("[API] Switching from live to demo mode for competition");
      botManager.setTradingMode("demo");
      marketEngine.setMode("simulated");
    }

    // Clear any existing competition state first
    botManager.clearCompetition();

    // Reset everything first
    botManager.stopAllBots();
    riskManager.resetAll();
    marketEngine.reset();

    // Wait for market to be ready (max 10 seconds)
    let retries = 0;
    while (!marketEngine.getCurrentMarket() && retries < 50) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      retries++;
    }

    if (!marketEngine.getCurrentMarket()) {
      throw AppError.serviceUnavailable('Failed to get market data. Please try again.');
    }

    // Start competition
    const competition = botManager.startCompetition({
      minTrades: body.minTrades,
      startBalance: body.startBalance,
      duration: durationMs,
    });

    // Schedule auto-stop if duration is set
    if (durationMs) {
      const durationMinutes = durationMs / 60000;
      setTimeout(async () => {
        console.log(`[API] ${durationMinutes}min competition complete, stopping...`);
        const finalCompetition = botManager.stopCompetition();
        broadcastToSSE('competition', finalCompetition);
      }, durationMs);
    }

    // Broadcast competition state change
    broadcastToSSE('competition', competition);

    return successResponse({
      competition,
      mode: botManager.getTradingMode()
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error(String(error)));
  }
}