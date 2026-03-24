import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function POST() {
  const marketEngine = getMarketEngine();
  marketEngine.forceNewMarket();
  return NextResponse.json({ success: true });
}