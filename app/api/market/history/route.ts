import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function GET() {
  const marketEngine = getMarketEngine();
  return NextResponse.json(marketEngine.getMarketHistory());
}