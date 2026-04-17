import { NextResponse } from 'next/server';
import { accountStore } from '@/lib/account-store';

export const dynamic = 'force-dynamic';

// Try multiple public RPCs as fallback
const PUBLIC_RPCS = [
  process.env.POLYGON_RPC_URL || '',
  'https://polygon.llamarpc.com',
  'https://polygon-rpc.com',
  'https://1rpc.io/matic',
].filter(Boolean);

async function fetchWithFallback(rpcs: string[], address: string): Promise<{ rpc: string; response: Response }> {
  let lastError: Error | null = null;

  for (const rpc of rpcs) {
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return { rpc, response };
      }
      lastError = new Error(`RPC ${rpc} returned ${response.status}`);
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError || new Error('All RPCs failed');
}

export async function GET() {
  try {
    const active = await accountStore.getActiveAccount();
    const address = active?.walletAddress || process.env.POLYMARKET_WALLET_ADDRESS;

    if (!address) {
      return NextResponse.json({ success: false, error: 'No wallet configured', matic: 0 });
    }

    const { rpc, response } = await fetchWithFallback(PUBLIC_RPCS, address);

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // Convert from wei to MATIC (18 decimals)
    const balanceWei = BigInt(data.result);
    const matic = Number(balanceWei) / 1e18;

    return NextResponse.json({
      success: true,
      matic: parseFloat(matic.toFixed(4)),
      address,
      rpc: rpc.split('?')[0], // Hide any API keys
      warning: matic < 0.5 ? 'Low MATIC — gas fees may fail' : null,
    });
  } catch (error: any) {
    console.error('[API] MATIC balance error:', error);
    return NextResponse.json({ success: false, error: error.message, matic: 0 }, { status: 500 });
  }
}
