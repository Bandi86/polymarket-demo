import { NextRequest, NextResponse } from 'next/server';

import { getMarketEngine, getPolymarketProvider } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const marketEngine = getMarketEngine();
  const polymarketProvider = getPolymarketProvider();

  return NextResponse.json({
    timeframe: marketEngine.getTimeframe(),
    availableTimeframes: polymarketProvider.getAvailableTimeframes(),
  });
}

export async function POST(request: NextRequest) {
  const marketEngine = getMarketEngine();
  const polymarketProvider = getPolymarketProvider();

  let body: { timeframe?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body?.timeframe) {
    return NextResponse.json(
      { success: false, error: 'Missing timeframe' },
      { status: 400 }
    );
  }

  const success = await marketEngine.setTimeframe(body.timeframe);
  return NextResponse.json({
    success,
    timeframe: body.timeframe,
    availableTimeframes: polymarketProvider.getAvailableTimeframes(),
  });
}