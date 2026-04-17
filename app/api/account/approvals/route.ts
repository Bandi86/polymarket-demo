import { NextResponse } from 'next/server'
import { accountManager } from '@/lib/account-manager'
import { getConfig } from '@/lib/providers/clob-client'
import { accountStore } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

// GET /api/account/approvals - Check if contracts are approved
export async function GET() {
  try {
    const config = getConfig()
    const activeAccount = await accountStore.getActiveAccount()
    const walletAddress = config.walletAddress || activeAccount?.walletAddress || null

    if (!walletAddress) {
      return NextResponse.json({ success: false, error: 'No wallet connected', isApproved: false })
    }

    const result = await accountManager.checkApprovals()

    // The CLI usually returns the approvals status in the JSON.
    // Example: { isApproved: true } or { ctf: true, usdc: true }
    // We will assume it's approved if no error is thrown and it returns true/valid object.
    const isApproved = result?.isApproved === true || (result?.ctf && result?.usdc)

    return NextResponse.json({
      success: true,
      isApproved: isApproved,
      raw: result,
    })
  } catch (error: any) {
    console.error('[API] Check approvals error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check approvals',
      isApproved: false
    }, { status: 500 })
  }
}

// POST /api/account/approvals - Set contract approvals
export async function POST() {
  try {
    const config = getConfig()
    const activeAccount = await accountStore.getActiveAccount()
    const walletAddress = config.walletAddress || activeAccount?.walletAddress || null

    if (!walletAddress) {
      return NextResponse.json({ success: false, error: 'No wallet connected' }, { status: 400 })
    }

    const result = await accountManager.setApprovals()

    return NextResponse.json({
      success: true,
      message: 'Contracts approved successfully',
      raw: result,
    })
  } catch (error: any) {
    console.error('[API] Set approvals error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to set approvals. Make sure you have MATIC for gas.'
    }, { status: 500 })
  }
}
