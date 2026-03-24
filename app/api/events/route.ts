import { NextResponse } from 'next/server';

import { getDatabaseService } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/events - Get events
export async function GET() {
  // Events are not currently tracked in the database
  // Return empty array for now
  return NextResponse.json([]);
}