import { NextRequest, NextResponse } from 'next/server'

import { getBotManager, getMarketEngine, getPolymarketProvider } from '@/lib/global'

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
  const polymarketProvider = getPolymarketProvider()

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

  // Check if bots are running
  const bots = botManager.getBots()
  const runningBots = bots.filter(b => b.enabled)
  if (runningBots.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Cannot switch mode while bots are running. Stop all bots first.' },
      { status: 400 }
    )
  }

  // If switching to live mode, verify credentials
  if (mode === 'live') {
    if (!polymarketProvider.hasCredentials()) {
      return NextResponse.json(
        { success: false, error: 'Missing Polymarket API credentials. Configure POLY_API_KEY and POLY_API_SECRET.' },
        { status: 400 }
      )
    }
    if (!polymarketProvider.hasPrivateKey()) {
      return NextResponse.json(
        { success: false, error: 'Missing Polymarket private key. Configure POLY_PRIVATE_KEY for trading.' },
        { status: 400 }
      )
    }

    // Try to fetch live balance to verify connection
    try {
      const balanceResult = await polymarketProvider.fetchAccountBalance()
      if (!balanceResult.success) {
        return NextResponse.json(
          { success: false, error: `Failed to connect to Polymarket: ${balanceResult.error || 'Unknown error'}` },
          { status: 400 }
        )
      }
      // Block if balance is 0 - cannot trade without funds
      if (balanceResult.balance === 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot enable live mode: Your Polymarket balance is $0. Deposit USDC to your Polymarket account first.' },
          { status: 400 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to verify Polymarket connection: ${err}` },
        { status: 400 }
      )
    }
  }

  const newMode = mode === 'live' ? 'real' : 'simulated'

  // Switch market engine mode
  marketEngine.setMode(newMode)

  // Switch bot manager trading mode
  botManager.setTradingMode(mode)

  // Set balance for demo mode
  if (mode === 'demo' && balance) {
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