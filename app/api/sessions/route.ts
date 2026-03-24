import { NextResponse } from 'next/server';

import { getBotManager } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/sessions - Get all bot sessions
export async function GET() {
  const botManager = getBotManager();
  return NextResponse.json(botManager.getSessions());
}