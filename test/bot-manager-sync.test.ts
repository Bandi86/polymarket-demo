import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BotManager } from '../src/lib/bot-manager';
import { marketEngine } from '../src/lib/market-engine';
import type { Position, Portfolio } from '../src/types';

// Mock DB service to avoid bun:sqlite errors in jsdom
vi.mock('../src/lib/database', () => ({
  dbService: {
    saveMarket: vi.fn(),
    savePosition: vi.fn(),
    getBots: vi.fn().mockResolvedValue([]),
    saveBot: vi.fn(),
    logActivity: vi.fn(),
    getBotLogs: vi.fn().mockResolvedValue([]),
    getBotSessions: vi.fn().mockResolvedValue([])
  }
}));

describe('BotManager Stats Sync', () => {
  let manager: BotManager;

  beforeEach(() => {
    // We want to mock marketEngine's getBotPortfolio to return what we want
    // maxBots: 20 allows for 10 default bots + test bots
    manager = new BotManager({ maxBots: 20 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should sync stats from portfolio correctly', () => {
    // 1. Create a bot
    manager.createBot({
      id: 'test-bot-1',
      name: 'Test Bot',
      strategy: 'window_delta',
      enabled: false,
      interval: 1000,
      betSize: 10,
      maxBet: 20,
      useKelly: false,
      kellyFraction: 0,
      stopLoss: 0,
      takeProfit: 0,
      maxPositions: 1,
      stats: {
        trades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, profitFactor: 0,
        maxConsecutiveWins: 0, maxConsecutiveLosses: 0
      },
      runTime: 0,
      portfolio: {
        balance: 100, initialBalance: 100, positions: [], openPositions: [], closedPositions: [],
        totalPnL: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, roi: 0,
        maxDrawdown: 0, sharpeRatio: 0
      },
      createdAt: 0,
      updatedAt: 0,
      lastTradeTime: 0
    });

    // 2. Mock market engine to return a populated portfolio
    const closedPositions: Partial<Position>[] = [
      { id: '1', pnl: 10, status: 'closed' }, // WIN
      { id: '2', pnl: 15, status: 'closed' }, // WIN (Consecutive 2)
      { id: '3', pnl: -5, status: 'closed' }, // LOSS
      { id: '4', pnl: 20, status: 'closed' }, // WIN
      { id: '5', pnl: -10, status: 'closed'}, // LOSS
      { id: '6', pnl: -15, status: 'closed'}  // LOSS (Consecutive 2)
    ];

    const mockPortfolio: Portfolio = {
      balance: 115,
      initialBalance: 100,
      positions: [],
      openPositions: [],
      closedPositions: closedPositions as Position[],
      totalPnL: 15,
      totalTrades: 6,
      winningTrades: 3,
      losingTrades: 3,
      winRate: 0.5,
      roi: 15,
      maxDrawdown: 0,
      sharpeRatio: 0
    };

    vi.spyOn(marketEngine, 'getBotPortfolio').mockReturnValue(mockPortfolio);

    // 3. Call getBots() which triggers syncStatsFromPortfolio internally
    const retrievedBot = manager.getBots().find(b => b.id === 'test-bot-1');
    expect(retrievedBot).toBeDefined();
    if (!retrievedBot) return;

    // 4. Verify the stats
    expect(retrievedBot.stats.trades).toBe(6);
    expect(retrievedBot.stats.wins).toBe(3);
    expect(retrievedBot.stats.losses).toBe(3);
    expect(retrievedBot.stats.pnl).toBe(15);
    expect(retrievedBot.stats.winRate).toBe(0.5);

    // avgWin: (10 + 15 + 20) / 3 = 45 / 3 = 15
    expect(retrievedBot.stats.avgWin).toBe(15);
    // avgLoss: Math.abs((-5 - 10 - 15) / 3) = Math.abs(-30 / 3) = 10
    expect(retrievedBot.stats.avgLoss).toBe(10);

    // profitFactor: Gross Profit / Gross Loss = 45 / 30 = 1.5
    expect(retrievedBot.stats.profitFactor).toBe(1.5);

    // Consecutive stuff
    // The streak logic processes the array from [0] to [length-1].
    // Our array: WIN, WIN, LOSS, WIN, LOSS, LOSS
    // That means maxWinStreak = 2, maxLossStreak = 2
    expect(retrievedBot.stats.maxConsecutiveWins).toBe(2);
    expect(retrievedBot.stats.maxConsecutiveLosses).toBe(2);
  });
});
