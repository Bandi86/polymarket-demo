import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarketEngine } from '../src/lib/market-engine';
import { polymarketProvider } from '../src/lib/providers/polymarket-provider';
import type { Market } from '../src/types';

// Mock DB service so we don't write to DB
vi.mock('../src/lib/database', () => ({
  dbService: {
    saveMarket: vi.fn(),
    savePosition: vi.fn(),
  }
}));

describe('MarketEngine', () => {
  let engine: MarketEngine;

  let mockMarket: Market;

  beforeEach(() => {
    mockMarket = {
      id: 'market-123',
      question: 'Test Market',
      description: 'Test',
      startTime: Date.now() - 10000,
      endTime: Date.now() + 10000,
      startPrice: 0.5,
      endPrice: null,
      status: 'active',
      result: null,
      volumeNum: 1000,
      liquidity: 5000,
      outcomePrices: { yes: '0.60', no: '0.40' }
    };

    vi.spyOn(polymarketProvider, 'fetchActiveMarkets').mockResolvedValue([mockMarket]);
    
    engine = new MarketEngine({
      startingBalance: 100,
      feeRate: 0.02, // 2%
      baseSpread: 0.0, // 0 spread for easier testing
      maxSlippage: 0.0, // 0 rand slippage
      slippageEnabled: true
    });

    // Manually set the active market since startNewMarket is async and we mocked fetchActiveMarkets
    (engine as any).setActiveMarket(mockMarket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculateSlippage applies 0.1% linear slippage per $1 over $1', () => {
    // We configured baseSpread=0, maxSlippage=0 above. So only size impact applies.
    const sizeImpact = (engine as any).calculateSlippage(11, 0.5); 
    // formula: Math.max(0, (amount - 1) * 0.001) -> (11 - 1) * 0.001 = 0.01 (1% slippage)
    expect(sizeImpact).toBeCloseTo(0.01);

    const sizeImpactSmall = (engine as any).calculateSlippage(1, 0.5);
    expect(sizeImpactSmall).toBeCloseTo(0);
  });

  it('placeTrade handles fees, reduces balance, and calculates odds with slippage', () => {
    // Current price is YES: 0.60
    // Amount = $11 -> slippage = 0.01
    // Odds should become 0.60 + 0.01 = 0.61
    const position = engine.placeTrade("YES", 11);
    
    expect(position).not.toBeNull();
    if (!position) return;
    
    expect(position.amount).toBe(11);
    expect(position.fee).toBe(11 * 0.02); // 0.22 fee
    expect(position.odds).toBeCloseTo(0.61);
    expect(position.stake).toBeCloseTo(11 / 0.61); // ~18.03 max payout
    
    const portfolio = engine.getPortfolio();
    expect(portfolio.balance).toBe(100 - 11 - 0.22); // 88.78
    expect(portfolio.openPositions.length).toBe(1);
  });

  it('settleMarket computes PnL correctly for a winning YES position', () => {
    const position = engine.placeTrade("YES", 10); // $10 bet, fee = 0.2, cost = 10.2, bal = 89.8
    expect(position).toBeDefined();

    // Settle market dynamically
    const settleMarket = (engine as any).settleMarket.bind(engine);
    
    // Settle with yesPrice = 1.0 (UP)
    settleMarket(1.0);

    const portfolio = engine.getPortfolio();
    
    // Win logic: payout = stake
    const payout = position!.stake; // ~16.42
    
    expect(portfolio.winningTrades).toBe(1);
    expect(portfolio.losingTrades).toBe(0);
    expect(portfolio.totalTrades).toBe(1);
    expect(portfolio.winRate).toBe(1.0);
    
    // PnL = payout - amount - fee
    // Balance = startingBalance - initialCost + payout
    
    const expectedPnl = payout - 10 - 0.2;
    expect(portfolio.totalPnL).toBeCloseTo(expectedPnl);
    expect(portfolio.balance).toBeCloseTo(100 - 10.2 + payout);
  });

  it('settleMarket computes PnL correctly for a losing NO position', () => {
    const position = engine.placeTrade("NO", 10); 
    
    const settleMarket = (engine as any).settleMarket.bind(engine);
    // Settle with yesPrice = 1.0 (UP => NO loses)
    settleMarket(1.0);

    const portfolio = engine.getPortfolio();
    expect(portfolio.winningTrades).toBe(0);
    expect(portfolio.losingTrades).toBe(1);
    expect(portfolio.totalPnL).toBeCloseTo(-10.2); // Lost amount + fee
    expect(portfolio.balance).toBeCloseTo(100 - 10.2); // 89.8
  });
});
