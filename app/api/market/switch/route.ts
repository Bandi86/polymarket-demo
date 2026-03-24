import { NextRequest, NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const marketEngine = getMarketEngine();

  let body: { marketId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body?.marketId) {
    return NextResponse.json(
      { success: false, error: 'Missing marketId' },
      { status: 400 }
    );
  }

  const success = await marketEngine.switchMarket(body.marketId);
  return NextResponse.json({ success });
}