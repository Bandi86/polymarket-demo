import { NextResponse } from 'next/server';

import { getBotManager, getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// POST /api/reset - Full system reset
export async function POST() {
  const marketEngine = getMarketEngine();
  const botManager = getBotManager();

  marketEngine.reset();
  botManager.resetAllBots();

  return NextResponse.json({ success: true });
}