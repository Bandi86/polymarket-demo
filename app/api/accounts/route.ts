import { NextRequest, NextResponse } from 'next/server';
import { accountStore } from '@/lib/account-store';
import { getBotManager } from '@/lib/global';
import { resetClient } from '@/lib/providers/clob-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await accountStore.getAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privateKey, label } = body;
    if (!privateKey) {
      return NextResponse.json({ success: false, error: 'Private key is required' }, { status: 400 });
    }

    const newAccount = await accountStore.addAccount(privateKey, label);

    // When adding a new account, reset CLOB client
    resetClient();

    return NextResponse.json({
      success: true,
      account: {
        id: newAccount.id,
        walletAddress: newAccount.walletAddress,
        label: newAccount.label,
        isActive: newAccount.isActive
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Account ID is required' }, { status: 400 });
    }

    await accountStore.setActiveAccount(id);

    // Reset CLOB client when switching accounts so it reinitializes with new credentials
    resetClient();

    // Stop all bots when switching accounts
    try {
      getBotManager().stopAllBots();
    } catch (e) {
      console.warn("Could not stop bots on account switch", e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Account ID is required' }, { status: 400 });
    }

    await accountStore.removeAccount(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
