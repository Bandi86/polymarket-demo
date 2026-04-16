import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'
import { initializeClobClient, getBalance as fetchClobBalance, getConfig } from '@/lib/providers/clob-client'

export const dynamic = 'force-dynamic'

// GET /api/account/balance - Fetch live balance from Polymarket
export async function GET() {
  const botManager = getBotManager()

  // Initialize CLOB client
  await initializeClobClient()
  const config = getConfig()

  // Fetch live balance from Polymarket
  const result = await fetchClobBalance()

  // Get demo balance from bots
  const bots = botManager.getBots()
  const demoBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)

  if (!result.success) {
    return NextResponse.json({
      success: false,
      error: result.error,
      isLive: false,
      balance: 0,
      available: 0,
      locked: 0,
      demoBalance,
      hasCredentials: config.hasCredentials,
      hasPrivateKey: config.hasPrivateKey,
      walletAddress: config.walletAddress,
    })
  }

  return NextResponse.json({
    success: true,
    isLive: result.isLive,
    balance: result.balance,
    available: result.available,
    locked: result.locked,
    demoBalance,
    hasCredentials: config.hasCredentials,
    hasPrivateKey: config.hasPrivateKey,
    walletAddress: config.walletAddress,
    lastSync: Date.now(),
  })
}
