import { NextResponse } from 'next/server';

import { getMarketEngine, getRiskManager } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/settings - Get all settings
export async function GET() {
  const marketEngine = getMarketEngine();
  const riskManager = getRiskManager();

  return NextResponse.json({
    mode: marketEngine.getMode(),
    timeframe: marketEngine.getTimeframe(),
    risk: riskManager.getSettings(),
    defaultStartBalance: 10,
  });
}

// POST /api/settings - Update settings
export async function POST(request: Request) {
  const marketEngine = getMarketEngine();
  const riskManager = getRiskManager();

  const body = (await request.json()) as {
    mode?: 'real' | 'simulated';
    timeframe?: string;
    risk?: Record<string, unknown>;
    defaultStartBalance?: number;
  };

  if (body.mode) {
    marketEngine.setMode(body.mode);
  }
  if (body.timeframe) {
    await marketEngine.setTimeframe(body.timeframe);
  }
  if (body.risk) {
    riskManager.updateSettings(body.risk);
  }

  return NextResponse.json({
    success: true,
    settings: {
      mode: marketEngine.getMode(),
      timeframe: marketEngine.getTimeframe(),
      risk: riskManager.getSettings(),
      defaultStartBalance: 10,
    },
  });
}