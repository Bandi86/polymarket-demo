import { NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/portfolio - Get portfolio
export async function GET() {
  const marketEngine = getMarketEngine();
  return NextResponse.json(marketEngine.getPortfolio());
}