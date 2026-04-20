import { NextResponse } from 'next/server'

import { getBotManager } from '@/lib/global'
import { accountManager } from '@/lib/account-manager'
import { getConfig } from '@/lib/providers/clob-client'
import { accountStore } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

// GET /api/account/balance - Fetch live balance from Polymarket
export async function GET() {
  const botManager = getBotManager()

  // Check for private key from account store (more reliable)
  const activeAccount = await accountStore.getActiveAccount();
  const hasPrivateKeyFromStore = !!activeAccount?.privateKey;
  const walletAddressFromStore = activeAccount?.walletAddress || null;

  // Fetch detailed account info (Trading + On-Chain)
  const accountResult = await accountManager.getDetailedAccount()
  const config = await getConfig()

  // Get demo balance from bots
  const bots = botManager.getBots()
  const demoBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0)

  // Use account store values if config doesn't have them
  const finalHasPrivateKey = config.hasPrivateKey || hasPrivateKeyFromStore;
  const finalWalletAddress = config.walletAddress || walletAddressFromStore;

  if (!accountResult.success) {
    return NextResponse.json({
      success: false,
      error: accountResult.error,
      isLive: false,
      balance: 0,
      available: 0,
      locked: 0,
      onChainValue: 0,
      demoBalance,
      hasCredentials: config.hasCredentials || hasPrivateKeyFromStore,
      hasPrivateKey: finalHasPrivateKey,
      walletAddress: finalWalletAddress,
    })
  }

  return NextResponse.json({
    success: true,
    isLive: accountResult.isLive,
    balance: accountResult.tradingBalance.total,
    available: accountResult.tradingBalance.available,
    locked: accountResult.tradingBalance.locked,
    onChainValue: accountResult.onChainWallet.totalValue,
    demoBalance,
    hasCredentials: config.hasCredentials || hasPrivateKeyFromStore,
    hasPrivateKey: finalHasPrivateKey,
    walletAddress: finalWalletAddress,
    lastSync: Date.now(),
  })
}
