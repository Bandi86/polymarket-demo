import { NextResponse, NextRequest } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// POST /api/trade - Place a trade
export async function POST(request: NextRequest) {
  const marketEngine = getMarketEngine();

  let body: { outcome?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body?.outcome || !body?.amount) {
    return NextResponse.json(
      { success: false, error: 'Missing outcome or amount' },
      { status: 400 }
    );
  }

  if (body.amount < 0.01) {
    return NextResponse.json(
      { success: false, error: 'Minimum bet is $0.01' },
      { status: 400 }
    );
  }

  const position = marketEngine.placeTrade(
    body.outcome as 'YES' | 'NO',
    body.amount
  );

  if (!position) {
    return NextResponse.json(
      { success: false, error: 'Failed to place trade' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, position });
}