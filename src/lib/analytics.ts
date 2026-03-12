// Analytics Library - Performance calculations and strategy analysis
// Implements correlation matrix, performance metrics, and market phase analysis

import { marketEngine } from "./market-engine";
import { botManager } from "./bot-manager";
import type { Position } from "../types";

export interface CorrelationMatrix {
  strategies: string[];
  matrix: number[][]; // -1 to 1 correlation
  timestamp: number;
}

export interface PerformanceByPhase {
  trending_up: PhasePerformance;
  trending_down: PhasePerformance;
  ranging: PhasePerformance;
  volatile: PhasePerformance;
}

export interface PhasePerformance {
  trades: number;
  wins: number;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
  avgConfidence: number;
}

export interface TradeDistribution {
  wins: number[];
  losses: number[];
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  winCount: number;
  lossCount: number;
  profitFactor: number;
}

export interface TimeBasedPerformance {
  intervals: Array<{
    hour: number;
    trades: number;
    wins: number;
    pnl: number;
    winRate: number;
  }>;
}

export interface DrawdownData {
  current: number;
  max: number;
  points: Array<{
    timestamp: number;
    value: number;
    balance: number;
  }>;
}

export interface RollingMetrics {
  sharpeRatios: Array<{
    timestamp: number;
    value: number;
  }>;
  avgSharpe: number;
  currentSharpe: number;
}

export interface StrategyAnalytics {
  strategyId: string;
  strategyName: string;
  correlationMatrix: CorrelationMatrix;
  performanceByPhase: PerformanceByPhase;
  tradeDistribution: TradeDistribution;
  drawdownData: DrawdownData;
  rollingSharpe: RollingMetrics;
}

export type MarketPhase = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface MarketConditionAnalysis {
  phase: MarketPhase;
  confidence: number;
  recommendedStrategy: string;
  reason: string;
  metrics: {
    trendStrength: number;
    volatilityLevel: number;
    pricePosition: number; // 0-1 where price is in range
  };
}

// Calculate correlation between two arrays
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

// Get P&L series for a bot from its positions
function getPnLSeries(positions: Position[]): number[] {
  return positions
    .filter(p => p.pnl !== null)
    .map(p => p.pnl || 0);
}

// Calculate strategy correlation matrix
export function calculateStrategyCorrelationMatrix(): CorrelationMatrix {
  const bots = botManager.getBots();
  const strategies = [...new Set(bots.map(b => b.strategy))];

  // Get P&L series for each strategy
  const pnlSeries: Map<string, number[]> = new Map();

  for (const bot of bots) {
    const portfolio = marketEngine.getBotPortfolio(bot.id);
    const positions = portfolio.positions || [];
    const pnl = getPnLSeries(positions);

    if (!pnlSeries.has(bot.strategy)) {
      pnlSeries.set(bot.strategy, []);
    }

    // Accumulate P&L for this strategy
    const existing = pnlSeries.get(bot.strategy) || [];
    pnlSeries.set(bot.strategy, [...existing, ...pnl]);
  }

  // Normalize series lengths by padding with zeros
  const maxLength = Math.max(...Array.from(pnlSeries.values()).map(s => s.length));
  for (const [strategy, series] of pnlSeries) {
    while (series.length < maxLength) {
      series.push(0);
    }
  }

  // Calculate correlation matrix
  const matrix: number[][] = [];

  for (let i = 0; i < strategies.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < strategies.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        const seriesI = pnlSeries.get(strategies[i]) || [];
        const seriesJ = pnlSeries.get(strategies[j]) || [];
        matrix[i][j] = calculateCorrelation(seriesI, seriesJ);
      }
    }
  }

  return {
    strategies,
    matrix,
    timestamp: Date.now(),
  };
}

// Analyze market phase from price history
export function analyzeMarketPhase(priceHistory: number[]): MarketConditionAnalysis {
  if (priceHistory.length < 10) {
    return {
      phase: "ranging",
      confidence: 0.3,
      recommendedStrategy: "random",
      reason: "Insufficient data",
      metrics: {
        trendStrength: 0,
        volatilityLevel: 0,
        pricePosition: 0.5,
      },
    };
  }

  // Calculate volatility (standard deviation of returns)
  const returns: number[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    returns.push((priceHistory[i] - priceHistory[i - 1]) / priceHistory[i - 1]);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Calculate trend strength (linear regression slope)
  const n = priceHistory.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = priceHistory.reduce((a, b) => a + b, 0);
  const sumXY = priceHistory.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const trendStrength = slope * n; // Normalize by length

  // Price position in range
  const min = Math.min(...priceHistory);
  const max = Math.max(...priceHistory);
  const range = max - min;
  const pricePosition = range > 0 ? (priceHistory[priceHistory.length - 1] - min) / range : 0.5;

  // Determine phase
  let phase: MarketPhase;
  let confidence: number;
  let recommendedStrategy: string;
  let reason: string;

  // Volatility threshold (0.002 = 0.2% std dev)
  const isVolatile = volatility > 0.002;
  // Trend threshold
  const isTrendingUp = trendStrength > 0.001;
  const isTrendingDown = trendStrength < -0.001;

  if (isVolatile) {
    phase = "volatile";
    confidence = Math.min(0.9, volatility * 200);
    recommendedStrategy = "momentum_burst";
    reason = `High volatility: ${(volatility * 100).toFixed(2)}% std dev`;
  } else if (isTrendingUp) {
    phase = "trending_up";
    confidence = Math.min(0.85, Math.abs(trendStrength) * 100);
    recommendedStrategy = "momentum";
    reason = `Uptrend: +${(trendStrength * 100).toFixed(2)}% slope`;
  } else if (isTrendingDown) {
    phase = "trending_down";
    confidence = Math.min(0.85, Math.abs(trendStrength) * 100);
    recommendedStrategy = "momentum";
    reason = `Downtrend: ${(trendStrength * 100).toFixed(2)}% slope`;
  } else {
    phase = "ranging";
    confidence = 0.6;
    recommendedStrategy = "mean_reversion";
    reason = `Price ranging between ${min.toFixed(3)} and ${max.toFixed(3)}`;
  }

  return {
    phase,
    confidence,
    recommendedStrategy,
    reason,
    metrics: {
      trendStrength,
      volatilityLevel: volatility,
      pricePosition,
    },
  };
}

// Calculate performance by market phase
export function calculatePerformanceByPhase(
  positions: Position[],
  marketPhases: Map<number, MarketPhase>
): PerformanceByPhase {
  const phaseStats: Record<MarketPhase, { trades: number; wins: number; pnl: number; confidences: number[] }> = {
    trending_up: { trades: 0, wins: 0, pnl: 0, confidences: [] },
    trending_down: { trades: 0, wins: 0, pnl: 0, confidences: [] },
    ranging: { trades: 0, wins: 0, pnl: 0, confidences: [] },
    volatile: { trades: 0, wins: 0, pnl: 0, confidences: [] },
  };

  for (const position of positions) {
    if (position.pnl === null) continue;

    const phase = marketPhases.get(position.timestamp) || "ranging";
    const stats = phaseStats[phase];

    stats.trades++;
    stats.pnl += position.pnl;
    if (position.pnl > 0) {
      stats.wins++;
    }
    // Confidence not stored in position, use default
    stats.confidences.push(0.5);
  }

  const result: PerformanceByPhase = {
    trending_up: calculatePhasePerformance(phaseStats.trending_up),
    trending_down: calculatePhasePerformance(phaseStats.trending_down),
    ranging: calculatePhasePerformance(phaseStats.ranging),
    volatile: calculatePhasePerformance(phaseStats.volatile),
  };

  return result;
}

function calculatePhasePerformance(stats: { trades: number; wins: number; pnl: number; confidences: number[] }): PhasePerformance {
  return {
    trades: stats.trades,
    wins: stats.wins,
    winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
    avgPnL: stats.trades > 0 ? stats.pnl / stats.trades : 0,
    totalPnL: stats.pnl,
    avgConfidence: stats.confidences.length > 0
      ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
      : 0,
  };
}

// Calculate trade distribution
export function calculateTradeDistribution(positions: Position[]): TradeDistribution {
  const wins: number[] = [];
  const losses: number[] = [];

  for (const position of positions) {
    if (position.pnl === null) continue;

    if (position.pnl > 0) {
      wins.push(position.pnl);
    } else if (position.pnl < 0) {
      losses.push(Math.abs(position.pnl));
    }
  }

  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const largestLoss = losses.length > 0 ? Math.max(...losses) : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? 999 : 0);

  return {
    wins,
    losses,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    winCount: wins.length,
    lossCount: losses.length,
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
  };
}

// Calculate time-based performance (by hour)
export function calculateTimeBasedPerformance(positions: Position[]): TimeBasedPerformance {
  const hourStats: Map<number, { trades: number; wins: number; pnl: number }> = new Map();

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourStats.set(i, { trades: 0, wins: 0, pnl: 0 });
  }

  for (const position of positions) {
    if (position.pnl === null) continue;

    const hour = new Date(position.timestamp).getHours();
    const stats = hourStats.get(hour) || { trades: 0, wins: 0, pnl: 0 };

    stats.trades++;
    stats.pnl += position.pnl;
    if (position.pnl > 0) {
      stats.wins++;
    }
    hourStats.set(hour, stats);
  }

  const intervals = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      trades: stats.trades,
      wins: stats.wins,
      pnl: stats.pnl,
      winRate: stats.trades > 0 ? stats.wins / stats.trades : 0,
    }))
    .sort((a, b) => a.hour - b.hour);

  return { intervals };
}

// Calculate drawdown data
export function calculateDrawdown(
  positions: Position[],
  initialBalance: number
): DrawdownData {
  if (positions.length === 0) {
    return {
      current: 0,
      max: 0,
      points: [],
    };
  }

  // Sort positions by time
  const sorted = [...positions]
    .filter(p => p.pnl !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  let balance = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;
  const points: DrawdownData["points"] = [];

  for (const position of sorted) {
    if (position.pnl !== null) {
      balance += position.pnl;
      peak = Math.max(peak, balance);

      const drawdown = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);

      points.push({
        timestamp: position.timestamp,
        value: drawdown,
        balance,
      });
    }
  }

  const currentDrawdown = peak > 0 ? ((peak - balance) / peak) * 100 : 0;

  return {
    current: currentDrawdown,
    max: maxDrawdown,
    points,
  };
}

// Calculate rolling Sharpe ratio
export function calculateRollingSharpe(
  positions: Position[],
  windowSize: number = 20
): RollingMetrics {
  const sorted = [...positions]
    .filter(p => p.pnl !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const pnls = sorted.map(p => p.pnl || 0);

  if (pnls.length < windowSize) {
    return {
      sharpeRatios: [],
      avgSharpe: 0,
      currentSharpe: 0,
    };
  }

  const sharpeRatios: RollingMetrics["sharpeRatios"] = [];

  for (let i = windowSize; i <= pnls.length; i++) {
    const window = pnls.slice(i - windowSize, i);
    const avgReturn = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);

    // Annualized Sharpe (assuming ~250 trades per year)
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(250) : 0;

    sharpeRatios.push({
      timestamp: sorted[i - 1].timestamp,
      value: isFinite(sharpe) ? sharpe : 0,
    });
  }

  const values = sharpeRatios.map(s => s.value);
  const avgSharpe = values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
  const currentSharpe = values.length > 0 ? values[values.length - 1] : 0;

  return {
    sharpeRatios,
    avgSharpe,
    currentSharpe,
  };
}

// Get strategy performance ranking
export function getStrategyPerformanceRanking(): Array<{
  strategy: string;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
  trades: number;
  sharpe: number;
}> {
  const bots = botManager.getBots();
  const strategyStats: Map<string, { pnl: number[]; wins: number; trades: number }> = new Map();

  for (const bot of bots) {
    const portfolio = marketEngine.getBotPortfolio(bot.id);
    const positions = portfolio.positions || [];

    if (!strategyStats.has(bot.strategy)) {
      strategyStats.set(bot.strategy, { pnl: [], wins: 0, trades: 0 });
    }

    const stats = strategyStats.get(bot.strategy)!;

    for (const pos of positions) {
      if (pos.pnl !== null) {
        stats.pnl.push(pos.pnl);
        stats.trades++;
        if (pos.pnl > 0) {
          stats.wins++;
        }
      }
    }
  }

  const rankings = Array.from(strategyStats.entries())
    .map(([strategy, stats]) => {
      const avgPnL = stats.pnl.length > 0
        ? stats.pnl.reduce((a, b) => a + b, 0) / stats.pnl.length
        : 0;
      const totalPnL = stats.pnl.reduce((a, b) => a + b, 0);
      const winRate = stats.trades > 0 ? stats.wins / stats.trades : 0;

      // Calculate Sharpe
      const avg = avgPnL;
      const variance = stats.pnl.length > 1
        ? stats.pnl.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / stats.pnl.length
        : 0;
      const stdDev = Math.sqrt(variance);
      const sharpe = stdDev > 0 ? (avg / stdDev) * Math.sqrt(250) : 0;

      return {
        strategy,
        winRate,
        avgPnL,
        totalPnL,
        trades: stats.trades,
        sharpe: isFinite(sharpe) ? sharpe : 0,
      };
    })
    .sort((a, b) => b.sharpe - a.sharpe);

  return rankings;
}

// Get analytics for a specific bot
export function getBotAnalytics(botId: string): StrategyAnalytics | null {
  const bot = botManager.getBot(botId);
  if (!bot) return null;

  const portfolio = marketEngine.getBotPortfolio(botId);
  const positions = portfolio.positions || [];

  return {
    strategyId: bot.strategy,
    strategyName: bot.name,
    correlationMatrix: calculateStrategyCorrelationMatrix(),
    performanceByPhase: calculatePerformanceByPhase(positions, new Map()),
    tradeDistribution: calculateTradeDistribution(positions),
    drawdownData: calculateDrawdown(positions, portfolio.initialBalance),
    rollingSharpe: calculateRollingSharpe(positions),
  };
}

// Export singleton analytics service
export const analyticsService = {
  calculateStrategyCorrelationMatrix,
  analyzeMarketPhase,
  calculatePerformanceByPhase,
  calculateTradeDistribution,
  calculateTimeBasedPerformance,
  calculateDrawdown,
  calculateRollingSharpe,
  getStrategyPerformanceRanking,
  getBotAnalytics,
};