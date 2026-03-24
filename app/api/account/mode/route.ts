import { NextRequest, NextResponse } from 'next/server'

import { getBotManager, getMarketEngine } from '@/lib/global'

export const dynamic = 'force-dynamic'

// GET /api/account/mode - Get trading mode
export async function GET() {
  const marketEngine = getMarketEngine()
  return NextResponse.json({
    mode: marketEngine.getMode() === 'real' ? 'live' : 'demo',
  })
}

// POST /api/account/mode - Switch between demo and live mode
export async function POST(request: NextRequest) {
  const botManager = getBotManager()
  const marketEngine = getMarketEngine()

  let body = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  const { mode, balance } = body as { mode?: 'demo' | 'live'; balance?: number }

  if (!mode) {
    return NextResponse.json(
      { success: false, error: 'Missing mode' },
      { status: 400 }
    )
  }

  const newMode = mode === 'live' ? 'real' : 'simulated'

  // Switch market engine mode
  marketEngine.setMode(newMode)

  // Switch bot manager trading mode
  botManager.setTradingMode(mode)

  // Set balance for demo mode
  if (mode === 'demo' && balance) {
    const bots = botManager.getBots()
    for (const bot of bots) {
      const portfolio = marketEngine.getBotPortfolio(bot.id)
      if (portfolio) {
        portfolio.balance = balance
        portfolio.initialBalance = balance
      }
    }
  }

  return NextResponse.json({
    success: true,
    mode,
    balance: balance || 0,
  })
}