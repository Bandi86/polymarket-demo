import { NextRequest, NextResponse } from 'next/server'

import { getBotManager, getMarketEngine } from '@/lib/global'
import { initializeClobClient, getBalance, getConfig } from '@/lib/providers/clob-client'
import { accountStore } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

// GET /api/account/mode - Get trading mode
export async function GET() {
  const botManager = getBotManager()
  const marketEngine = getMarketEngine()
  return NextResponse.json({
    mode: botManager.getTradingMode(),
    marketMode: marketEngine.getMode(),
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

  // Check if bots are running
  const bots = botManager.getBots()
  const runningBots = bots.filter(b => b.enabled)
  if (runningBots.length > 0) {
    return NextResponse.json(
      { success: false, error: 'Cannot switch mode while bots are running. Stop all bots first.' },
      { status: 400 }
    )
  }

  let warning: string | null = null;

  // If switching to live mode, verify credentials
  if (mode === 'live') {
    const config = getConfig()
    const activeAccount = await accountStore.getActiveAccount()

    // Check both config and account store for private key
    const hasPrivateKey = config.hasPrivateKey || !!activeAccount?.privateKey

    if (!hasPrivateKey) {
      return NextResponse.json(
        { success: false, error: 'No trading account configured. Add an account via the Accounts button in Live mode.' },
        { status: 400 }
      )
    }

    // Try to initialize with account store credentials
    try {
      const privateKey = activeAccount?.privateKey || process.env.POLYMARKET_PRIVATE_KEY;
      if (privateKey) {
        await initializeClobClient(privateKey)
      }

      const balanceResult = await getBalance()

      if (!balanceResult.success) {
        return NextResponse.json(
          { success: false, error: `Failed to connect to Polymarket: ${balanceResult.error || 'Unknown error'}` },
          { status: 400 }
        )
      }

      // Warn if balance is 0 but don't block - user can still test
      if (balanceResult.balance === 0) {
        warning = 'Your Polymarket balance is $0. You can test but cannot execute real trades without funds.';
      }
    } catch (err) {
      warning = `Could not verify Polymarket connection: ${err}. Proceeding anyway.`;
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
    warning,
  })
}
