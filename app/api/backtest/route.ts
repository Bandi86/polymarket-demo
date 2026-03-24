import { NextResponse } from 'next/server'

import { runBacktest, BacktestConfig, BacktestResult } from '@/lib/backtest-engine'

export const dynamic = 'force-dynamic'

interface BacktestRequest {
  strategies?: string[]
  startBalance?: number
  betSize?: number
  numMarkets?: number
  slippageEnabled?: boolean
}

// POST /api/backtest - Run strategies against simulated historical data
export async function POST(request: Request) {
  const body = (await request.json()) as BacktestRequest

  const config: BacktestConfig = {
    strategies: body?.strategies || [
      'momentum_chaser',
      'mean_reversion_sniper',
      'sum_to_one_arb',
      'whale_follower',
      'ta_signal_engine',
      'market_maker',
    ],
    startBalance: body?.startBalance ?? 10,
    betSize: body?.betSize ?? 1,
    feeRate: 0.02,
    slippageEnabled: body?.slippageEnabled ?? true,
    baseSpread: 0.01,
    maxSlippage: 0.01,
    numMarkets: body?.numMarkets ?? 50,
  }

  const results: BacktestResult[] = runBacktest(config)

  return NextResponse.json({ success: true, results })
}