import { NextResponse } from 'next/server';

import { getBotManager, getMarketEngine } from '@/lib/global';

export const dynamic = 'force-dynamic';

// POST /api/balance/set-all - Set balance for all bots
export async function POST(request: Request) {
  const botManager = getBotManager();
  const marketEngine = getMarketEngine();

  const body = (await request.json()) as { balance: number };
  const balance = body.balance || 10;

  const bots = botManager.getBots();
  for (const bot of bots) {
    const portfolio = marketEngine.getBotPortfolio(bot.id);
    if (portfolio) {
      portfolio.balance = balance;
      portfolio.initialBalance = balance;
    }
  }

  return NextResponse.json({ success: true, balance, botsUpdated: bots.length });
}