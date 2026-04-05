import { NextResponse } from 'next/server';

import { getMarketEngine, getPriceService, getBotManager } from '@/lib/global';

export const dynamic = 'force-dynamic';

// GET /api/debug/engine - Get engine debug info
export async function GET() {
  const marketEngine = getMarketEngine();
  const priceService = getPriceService();
  const botManager = getBotManager();

  const market = marketEngine.getCurrentMarket();
  const btcStartPrice = marketEngine.getMarketStartBtcPrice();
  const btcCurrentPrice = priceService.getPrice();

  // Calculate expected result
  const btcChange = btcCurrentPrice - (btcStartPrice || btcCurrentPrice);
  const calculatedResult = btcChange >= 0 ? 'UP' : 'DOWN';

  // Get all bot portfolios
  const bots = botManager.getBots();
  const botData = bots.map(bot => ({
    id: bot.id,
    name: bot.name,
    strategy: bot.strategy,
    enabled: bot.enabled,
    balance: bot.portfolio?.balance || 0,
    totalPnL: bot.portfolio?.totalPnL || 0,
    totalTrades: bot.portfolio?.totalTrades || 0,
    winningTrades: bot.portfolio?.winningTrades || 0,
    losingTrades: bot.portfolio?.losingTrades || 0,
    openPositions: bot.portfolio?.openPositions.map(p => ({
      id: p.id,
      outcome: p.outcome,
      amount: p.amount,
      odds: p.odds,
      pnl: p.pnl,
      unrealizedPnl: p.unrealizedPnl,
      status: p.status,
    })) || [],
    closedPositions: bot.portfolio?.closedPositions.slice(0, 10).map(p => ({
      id: p.id,
      outcome: p.outcome,
      amount: p.amount,
      odds: p.odds,
      stake: p.stake,
      fee: p.fee,
      pnl: p.pnl,
      exitPrice: p.exitPrice,
      status: p.status,
    })) || [],
  }));

  return NextResponse.json({
    market: market ? {
      id: market.id,
      question: market.question,
      status: market.status,
      startTime: market.startTime,
      endTime: market.endTime,
      outcomePrices: market.outcomePrices,
      yesPriceHistory: market.yesPriceHistory?.slice(-10) || [],
    } : null,
    btcPrices: {
      start: btcStartPrice,
      current: btcCurrentPrice,
      change: btcChange,
      changePercent: btcStartPrice ? (btcChange / btcStartPrice) * 100 : 0,
    },
    calculatedResult: {
      result: calculatedResult,
      ifClosedNow: {
        polymarketResult: market && parseFloat(market.outcomePrices.yes) > 0.5 ? 'UP' : 'DOWN',
        wouldMatch: market ? (parseFloat(market.outcomePrices.yes) > 0.5) === (calculatedResult === 'UP') : null,
      },
    },
    bots: botData,
    timeRemaining: marketEngine.getTimeRemaining(),
    progress: marketEngine.getProgress(),
  });
}