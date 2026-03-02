import type { Position, Portfolio, BotConfig, Market, MarketPrice } from './types';

const INITIAL_BALANCE = 10;
const FEE_PERCENTAGE = 0.02;

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export interface BotTradeResult {
  success: boolean;
  position?: Position;
  error?: string;
}

export class TradingEngine {
  private portfolio: Portfolio;
  private marketPrices: Map<string, MarketPrice> = new Map();
  private currentMarketId: string | null = null;
  private priceHistory: Map<string, number[]> = new Map();
  private botStats: Map<string, { trades: number; wins: number; pnl: number; lastTrade: number }> = new Map();

  constructor() {
    this.portfolio = {
      balance: INITIAL_BALANCE,
      positions: [],
      totalPnL: 0,
      winRate: 0,
      roi: 0,
      initialBalance: INITIAL_BALANCE,
    };
  }

  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  getBalance(): number {
    return this.portfolio.balance;
  }

  updateMarketPrice(marketId: string, price: MarketPrice): void {
    this.currentMarketId = marketId;
    this.marketPrices.set(marketId, price);
    
    const history = this.priceHistory.get(marketId) || [];
    history.push(price.yesPrice);
    if (history.length > 50) history.shift();
    this.priceHistory.set(marketId, history);
  }

  getCurrentMarketId(): string | null {
    return this.currentMarketId;
  }

  getCurrentPrice(): MarketPrice | null {
    if (!this.currentMarketId) return null;
    return this.marketPrices.get(this.currentMarketId) || null;
  }

  getPriceHistory(marketId: string): number[] {
    return this.priceHistory.get(marketId) || [];
  }

  placeTrade(marketId: string, outcome: 'YES' | 'NO', amount: number, botId?: string): Position | null {
    const price = this.marketPrices.get(marketId);
    if (!price) {
      console.error('No price available for market:', marketId);
      return null;
    }

    const odds = outcome === 'YES' ? price.yesPrice : price.noPrice;
    const cost = amount;
    const fee = cost * FEE_PERCENTAGE;
    const totalCost = cost + fee;

    if (totalCost > this.portfolio.balance || cost < 0.01) {
      return null;
    }

    const position: Position = {
      id: `${botId || 'manual'}-${generateId()}`,
      marketId,
      marketQuestion: 'BTC 5-min',
      outcome,
      amount,
      odds,
      timestamp: Date.now(),
      status: 'open',
      fee,
      stake: amount / odds,
    };

    this.portfolio.balance -= totalCost;
    this.portfolio.positions.push(position);

    if (botId) {
      const stats = this.botStats.get(botId) || { trades: 0, wins: 0, pnl: 0, lastTrade: 0 };
      stats.trades++;
      stats.lastTrade = Date.now();
      this.botStats.set(botId, stats);
    }
    
    return position;
  }

  closePosition(positionId: string): Position | null {
    const position = this.portfolio.positions.find((p) => p.id === positionId);
    if (!position || position.status !== 'open') return null;

    const price = this.marketPrices.get(position.marketId);
    if (!price) return null;

    const currentOdds = position.outcome === 'YES' ? price.yesPrice : price.noPrice;
    const stake = position.stake || (position.amount / position.odds);
    const currentValue = stake * currentOdds;
    const exitFee = currentValue * FEE_PERCENTAGE;
    const netValue = currentValue - exitFee;
    
    this.portfolio.balance += netValue;
    position.status = 'closed';
    position.pnl = netValue - position.amount - (position.fee || 0);

    this.recalculateStats();
    return position;
  }

  settlePosition(positionId: string, winningOutcome: 'YES' | 'NO'): Position | null {
    const position = this.portfolio.positions.find((p) => p.id === positionId);
    if (!position || position.status !== 'open') return null;

    const won = position.outcome === winningOutcome;
    position.status = 'settled';
    
    const stake = position.stake || (position.amount / position.odds);
    const payout = won ? stake : 0;
    const exitFee = payout * FEE_PERCENTAGE;
    const netPayout = payout - exitFee;
    const profit = netPayout - position.amount - (position.fee || 0);
    
    position.pnl = profit;
    this.portfolio.balance += netPayout;

    this.recalculateStats();
    return position;
  }

  settleAllPositions(winningOutcome: 'YES' | 'NO'): Position[] {
    const openPositions = this.portfolio.positions.filter(p => p.status === 'open');
    const settled: Position[] = [];
    
    for (const pos of openPositions) {
      const settledPos = this.settlePosition(pos.id, winningOutcome);
      if (settledPos) settled.push(settledPos);
    }
    
    return settled;
  }

  private recalculateStats(): void {
    const closedPositions = this.portfolio.positions.filter(
      (p) => p.status === 'closed' || p.status === 'settled'
    );

    if (closedPositions.length === 0) {
      this.portfolio.totalPnL = 0;
      this.portfolio.winRate = 0;
      this.portfolio.roi = 0;
      return;
    }

    const totalPnL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const winningTrades = closedPositions.filter((p) => (p.pnl || 0) > 0).length;
    const winRate = winningTrades / closedPositions.length;
    const roi = totalPnL / this.portfolio.initialBalance;

    this.portfolio.totalPnL = totalPnL;
    this.portfolio.winRate = winRate;
    this.portfolio.roi = roi;
  }

  getPosition(positionId: string): Position | undefined {
    return this.portfolio.positions.find((p) => p.id === positionId);
  }

  getAllPositions(): Position[] {
    return [...this.portfolio.positions];
  }

  getOpenPositions(): Position[] {
    return this.portfolio.positions.filter((p) => p.status === 'open');
  }

  getClosedPositions(): Position[] {
    return this.portfolio.positions.filter((p) => p.status === 'closed' || p.status === 'settled');
  }

  getBotStats(botId: string): { trades: number; wins: number; pnl: number; lastTrade: number } {
    const stats = this.botStats.get(botId) || { trades: 0, wins: 0, pnl: 0, lastTrade: 0 };
    
    const botPrefix = botId + "-";
    const botPositions = this.portfolio.positions.filter(p => p.id.startsWith(botPrefix));
    const closedPositions = botPositions.filter(p => p.status === 'closed' || p.status === 'settled');
    const wins = closedPositions.filter(p => (p.pnl || 0) > 0).length;
    const pnl = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    
    return { trades: closedPositions.length, wins, pnl, lastTrade: stats.lastTrade };
  }

  reset(): void {
    this.portfolio = {
      balance: INITIAL_BALANCE,
      positions: [],
      totalPnL: 0,
      winRate: 0,
      roi: 0,
      initialBalance: INITIAL_BALANCE,
    };
    this.botStats.clear();
  }
}

export type StrategyType = 'random' | 'momentum' | 'mean_reversion' | 'contrarian' | 'volatility';

export interface BotStrategy {
  name: string;
  description: string;
  execute: (
    engine: TradingEngine,
    marketId: string,
    betSize: number
  ) => { outcome: 'YES' | 'NO'; confidence: number } | null;
}

export const strategies: Record<StrategyType, BotStrategy> = {
  random: {
    name: 'Random',
    description: 'Random YES/NO',
    execute: () => ({
      outcome: Math.random() > 0.5 ? 'YES' : 'NO',
      confidence: 0.5,
    }),
  },

  momentum: {
    name: 'Momentum',
    description: 'Follows price direction',
    execute: (engine) => {
      const price = engine.getCurrentPrice();
      if (!price) return null;
      
      const threshold = 0.03;
      if (price.yesPrice > 0.5 + threshold) {
        return { outcome: 'YES', confidence: price.yesPrice };
      } else if (price.yesPrice < 0.5 - threshold) {
        return { outcome: 'NO', confidence: 1 - price.yesPrice };
      }
      return null;
    },
  },

  mean_reversion: {
    name: 'Mean Reversion',
    description: 'Bets on return to 50%',
    execute: (engine) => {
      const price = engine.getCurrentPrice();
      if (!price) return null;
      
      const deviation = Math.abs(price.yesPrice - 0.5);
      if (deviation > 0.1) {
        return {
          outcome: price.yesPrice > 0.5 ? 'NO' : 'YES',
          confidence: deviation,
        };
      }
      return null;
    },
  },

  contrarian: {
    name: 'Contrarian',
    description: 'Opposite of momentum',
    execute: (engine) => {
      const price = engine.getCurrentPrice();
      if (!price) return null;
      
      const threshold = 0.05;
      if (price.yesPrice > 0.5 + threshold) {
        return { outcome: 'NO', confidence: price.yesPrice };
      } else if (price.yesPrice < 0.5 - threshold) {
        return { outcome: 'YES', confidence: 1 - price.yesPrice };
      }
      return null;
    },
  },

  volatility: {
    name: 'Volatility',
    description: 'High volatility scalper',
    execute: (engine) => {
      const price = engine.getCurrentPrice();
      if (!price) return null;
      
      const deviation = Math.abs(price.yesPrice - 0.5);
      if (deviation > 0.15) {
        return { outcome: 'YES', confidence: 0.8 };
      } else if (deviation < 0.05) {
        return { outcome: Math.random() > 0.5 ? 'YES' : 'NO', confidence: 0.5 };
      }
      return null;
    },
  },

  smart_trend: {
    name: 'Smart Trend',
    description: 'Uses price history for trend detection',
    execute: (engine) => {
      const price = engine.getCurrentPrice();
      const history = engine.getPriceHistory(engine.getCurrentMarketId() || '');
      if (!price || history.length < 10) return null;
      
      const recent = history.slice(-10);
      const older = history.slice(-20, -10);
      
      if (older.length === 0) return null;
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      
      const trend = recentAvg - olderAvg;
      const currentDeviation = Math.abs(price.yesPrice - 0.5);
      
      if (Math.abs(trend) > 0.02) {
        if (trend > 0 && currentDeviation < 0.3) {
          return { outcome: 'YES', confidence: 0.7 };
        } else if (trend < 0 && currentDeviation < 0.3) {
          return { outcome: 'NO', confidence: 0.7 };
        }
      }
      
      if (currentDeviation > 0.2) {
        return { outcome: 'NO', confidence: 0.6 };
      }
      
      return null;
    },
  },
};

export function getDefaultBotConfigs(): BotConfig[] {
  return [
    {
      id: 'bot-1',
      name: 'Random Bot',
      type: 'random',
      enabled: false,
      betSize: 0.5,
      interval: 3000,
      useKelly: false,
    },
    {
      id: 'bot-2',
      name: 'Momentum Bot',
      type: 'momentum',
      enabled: false,
      betSize: 1,
      interval: 5000,
      useKelly: false,
    },
    {
      id: 'bot-3',
      name: 'Smart Trend',
      type: 'smart_trend',
      enabled: false,
      betSize: 1,
      interval: 8000,
      useKelly: true,
      kellyFraction: 0.25,
      maxBet: 5,
    },
    {
      id: 'bot-4',
      name: 'Mean Reversion',
      type: 'mean_reversion',
      enabled: false,
      betSize: 1,
      interval: 10000,
      useKelly: false,
    },
  ];
}
