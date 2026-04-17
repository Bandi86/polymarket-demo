import { NextResponse } from 'next/server'
import { accountManager } from '@/lib/account-manager'

export const dynamic = 'force-dynamic'

// POST /api/account/redeem
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { conditionId } = body

    if (!conditionId) {
      return NextResponse.json(
        { success: false, error: 'conditionId is required' },
        { status: 400 }
      )
    }

    // Attempt to redeem winning CTF tokens using the CLI wrapper via AccountManager
    const result = await accountManager.redeemWinnings(conditionId)

    return NextResponse.json({
      success: true,
      message: 'Tokens redeemed successfully',
      details: result,
    })
  } catch (error: any) {
    console.error('[API] Redeem error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to redeem tokens' },
      { status: 500 }
    )
  }
}
