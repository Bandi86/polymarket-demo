import { NextRequest, NextResponse } from 'next/server';

import { getPositionMonitor } from '@/lib/global';

export const dynamic = 'force-dynamic';

interface RegisterBody {
  positionId?: string;
  entryOdds: number;
  takeProfitMultiplier?: number;
  stopLossMultiplier?: number;
  botId?: string;
}

// POST /api/swing/register - Register a position for TP/SL monitoring
export async function POST(request: NextRequest) {
  try {
    const positionMonitor = getPositionMonitor();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validated = body as unknown as RegisterBody;

    if (!validated.entryOdds) {
      return NextResponse.json({ success: false, error: 'Missing entryOdds' }, { status: 400 });
    }

    // If positionId provided, use it directly; otherwise create a temporary ID
    const positionId = validated.positionId || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    positionMonitor.register({
      positionId,
      entryOdds: validated.entryOdds,
      takeProfitMultiplier: validated.takeProfitMultiplier ?? 2.0,
      stopLossMultiplier: validated.stopLossMultiplier ?? 0.5,
      botId: validated.botId,
    });

    return NextResponse.json({ success: true, positionId });
  } catch (error) {
    console.error('[Swing Register] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}