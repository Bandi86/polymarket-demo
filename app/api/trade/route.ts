import { NextRequest, NextResponse } from 'next/server';

import { getMarketEngine } from '@/lib/global';
import { errorResponse, successResponse } from '@/lib/utils/error-handler';
import { validateRequest, validators, commonSchemas } from '@/lib/utils/request-validator';
import { rateLimiters } from '@/lib/utils/rate-limiter';

export const dynamic = 'force-dynamic';

interface TradeBody {
  marketId: string;
  outcome: string;
  amount: number;
}

// POST /api/trade - Place a trade
export async function POST(request: NextRequest) {
  // Rate limiting check
  const rateResult = rateLimiters.trading.check(request);
  if (!rateResult.allowed) {
    const retryAfter = Math.ceil((rateResult.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many trade requests. Please wait before trying again.',
          retryAfter,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateResult.resetTime / 1000)),
        },
      }
    );
  }

  try {
    const marketEngine = getMarketEngine();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse(new Error('Invalid JSON body'));
    }

    // Validate request
    const validated = validateRequest<TradeBody>(body, commonSchemas.trade);

    // Additional validation for amount (already validated but double-check)
    validators.positiveNumber()(validated.amount, 'amount');

    const position = marketEngine.placeTrade(
      validated.outcome as 'YES' | 'NO',
      validated.amount
    );

    if (!position) {
      return errorResponse(new Error('Failed to place trade. Market may be inactive.'));
    }

    return successResponse({ position });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error(String(error)));
  }
}