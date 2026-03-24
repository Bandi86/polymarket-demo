import { NextRequest, NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const marketEngine = getMarketEngine();

  let body: { asset?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body?.asset) {
    return NextResponse.json(
      { success: false, error: 'Missing asset' },
      { status: 400 }
    );
  }

  const success = await marketEngine.setAsset(body.asset);
  return NextResponse.json({ success, asset: body.asset });
}