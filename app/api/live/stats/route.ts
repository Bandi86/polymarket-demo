import { NextResponse } from 'next/server'

import { liveModeManager } from '@/lib/live-mode-manager'

export const dynamic = 'force-dynamic'

// GET /api/live/stats - Get live trading statistics
export async function GET() {
  const state = liveModeManager.getState()

  // Calculate additional metrics
  const winRate = state.stats.dailyTrades > 0
    ? (state.stats.dailyWins / state.stats.dailyTrades * 100).toFixed(1)
    : 0

  const roi = state.totalBankroll > 0
    ? (state.stats.dailyPnL / state.totalBankroll * 100).toFixed(2)
    : 0

  return NextResponse.json({
    daily: {
      pnl: state.stats.dailyPnL,
      trades: state.stats.dailyTrades,
      wins: state.stats.dailyWins,
      losses: state.stats.dailyLosses,
      winRate: `${winRate}%`,
      roi: `${roi}%`,
    },
    monthly: {
      pnl: state.stats.monthlyPnL,
      trades: state.stats.monthlyTrades,
    },
    performance: {
      totalVolume: state.stats.totalVolume,
      avgTradeSize: state.stats.avgTradeSize,
      bestTrade: state.stats.bestTrade,
      worstTrade: state.stats.worstTrade,
      sharpeRatio: state.stats.sharpeRatio,
      maxDrawdown: state.stats.maxDrawdown,
      currentDrawdown: state.stats.currentDrawdown,
      winStreak: state.stats.winStreak,
      lossStreak: state.stats.lossStreak,
    },
    session: {
      startTime: state.stats.sessionStartTime,
      lastTrade: state.stats.lastTradeTime,
      lastBalanceSync: state.stats.lastBalanceSync,
    },
    health: state.healthStatus
  })
}