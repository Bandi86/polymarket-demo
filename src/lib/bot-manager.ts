// Unified Bot Manager - Manages trading bots with various strategies
// Implements isolated portfolios and session tracking

import type {
  BotConfig,
  BotStats,
  BotSession,
  Position,
  StrategyType,
  StrategyContext,
  Strategy,
  Portfolio,
  Outcome,
} from "../types";
import { marketEngine } from "./market-engine";
import { dbService } from "./database";
import { generateId, clamp } from "./utils";
import { binanceKlineProvider } from "./providers/binance-kline-provider";
import { priceService } from "./price";
import { riskManager } from "./risk-manager";

// === Technical Analysis Helpers ===

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// === Strategy Implementations ===

const strategies: Record<StrategyType, Strategy> = {
  momentum_chaser: {
    name: "Momentum Chaser",
    description: "Computes BTC price delta from window open; enters at T−60s",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcPriceChange, marketPrice } = ctx;

      // Extended entry window: T-60s to T-5s
      if (timeRemaining > 60000 || timeRemaining < 5000) {
        return { action: null, confidence: 0, reason: "Not in entry window (T-60s)" };
      }

      // Need BTC price change data
      if (btcPriceChange === undefined || btcPriceChange === null) {
        return { action: null, confidence: 0, reason: "No BTC price data" };
      }

      // Lowered threshold: 0.01% delta (was 0.02%)
      const threshold = 0.0001; // 0.01%
      const delta = btcPriceChange;

      // Skip if flat market
      if (Math.abs(delta) < threshold) {
        return { action: null, confidence: 0, reason: `Flat market: delta ${(delta * 100).toFixed(3)}%` };
      }

      // Determine direction
      const action = delta > 0 ? "YES" : "NO";

      // Calculate confidence based on momentum strength
      const confidence = Math.min(0.75, 0.5 + Math.abs(delta) * 500);

      return {
        action,
        confidence,
        reason: `Momentum: BTC ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(3)}%`,
      };
    },
  },

  mean_reversion_sniper: {
    name: "Mean Reversion Sniper",
    description: "Fades spikes when one token exceeds 0.88 without a real BTC move",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, btcPriceChange, timeRemaining } = ctx;

      if (timeRemaining < 10000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Lowered spike threshold: 88% (was 93%)
      const hasSpike = yesPrice > 0.88 || noPrice > 0.88;
      if (!hasSpike) {
        return { action: null, confidence: 0, reason: `No spike detected (need >88%)` };
      }

      // Increased BTC delta tolerance: 0.03% (was 0.01%)
      const btcDelta = Math.abs(btcPriceChange || 0);
      if (btcDelta > 0.0003) {
        return { action: null, confidence: 0, reason: `BTC moved: ${(btcDelta * 100).toFixed(3)}%` };
      }

      // Fade the spike: buy the cheaper token
      const action = yesPrice > 0.88 ? "NO" : "YES";
      const targetPrice = action === "YES" ? yesPrice : noPrice;

      // Higher confidence for larger spikes
      const spikeSize = Math.max(yesPrice, noPrice) - 0.88;
      const confidence = Math.min(0.85, 0.55 + spikeSize * 2);

      return {
        action,
        confidence,
        reason: `Fade spike: ${action === "YES" ? "YES" : "NO"} at ${(targetPrice * 100).toFixed(0)}¢`,
      };
    },
  },

  sum_to_one_arb: {
    name: "Sum-to-One Arbitrage",
    description: "Buys both UP and DOWN when combined asks < $0.99 — guaranteed edge",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, orderBook, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Get best asks from order book or market price
      let yesAsk = 1;
      let noAsk = 1;

      if (orderBook?.yesAsks?.length) {
        yesAsk = orderBook.yesAsks[0].price;
      } else if (marketPrice?.yesPrice) {
        yesAsk = marketPrice.yesPrice + 0.01; // Estimate ask
      }

      if (orderBook?.noAsks?.length) {
        noAsk = orderBook.noAsks[0].price;
      } else if (marketPrice?.noPrice) {
        noAsk = marketPrice.noPrice + 0.01; // Estimate ask
      }

      const sum = yesAsk + noAsk;

      // Increased threshold: 99% (was 98%)
      if (sum >= 0.99) {
        return { action: null, confidence: 0, reason: `No arb: sum=${(sum * 100).toFixed(1)}%` };
      }

      const edge = 1 - sum;
      const confidence = Math.min(0.95, 0.6 + edge * 20);

      // Buy the cheaper one for higher potential return
      const action = yesAsk < noAsk ? "YES" : "NO";

      return {
        action,
        confidence,
        reason: `Arb opportunity: sum=${(sum * 100).toFixed(1)}%, edge=${(edge * 100).toFixed(1)}%`,
      };
    },
  },

  whale_follower: {
    name: "Whale Follower",
    description: "Follows whale signals or BTC momentum as fallback",
    category: "social",
    execute: (ctx) => {
      const { timeRemaining, binanceSignal, btcPriceChange, marketPrice } = ctx;

      if (timeRemaining < 5000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Primary: Use binanceSignal if available
      if (binanceSignal && binanceSignal.type !== "NEUTRAL") {
        const action = binanceSignal.predictedOutcome ||
          (binanceSignal.type === "UP" ? "YES" : "NO");

        return {
          action,
          confidence: binanceSignal.confidence * 0.8,
          reason: `Following whale signal: ${binanceSignal.type}`,
        };
      }

      // Fallback: Use BTC price momentum
      if (btcPriceChange !== undefined && btcPriceChange !== null) {
        const threshold = 0.0005; // 0.05% threshold for momentum
        if (Math.abs(btcPriceChange) > threshold) {
          const action = btcPriceChange > 0 ? "YES" : "NO";
          const confidence = Math.min(0.65, 0.4 + Math.abs(btcPriceChange) * 200);
          return {
            action,
            confidence,
            reason: `BTC momentum fallback: ${btcPriceChange > 0 ? "+" : ""}${(btcPriceChange * 100).toFixed(3)}%`,
          };
        }
      }

      // Secondary fallback: Follow price imbalance
      const yesPrice = marketPrice?.yesPrice || 0.5;
      if (yesPrice > 0.65) {
        return {
          action: "NO",
          confidence: 0.5,
          reason: `Price imbalance: YES at ${(yesPrice * 100).toFixed(0)}¢`,
        };
      }
      if (yesPrice < 0.35) {
        return {
          action: "YES",
          confidence: 0.5,
          reason: `Price imbalance: YES at ${(yesPrice * 100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "No whale activity or momentum detected" };
    },
  },

  ta_signal_engine: {
    name: "TA Signal Engine",
    description: "EMA9/EMA21 crossover + RSI on 1-min Binance candles",
    category: "technical",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Reduced required candles: 14 (was 21)
      if (priceHistory.length < 14) {
        return { action: null, confidence: 0, reason: `Insufficient data: ${priceHistory.length} candles (need 14)` };
      }

      // Calculate EMAs
      const ema9 = calculateEMA(priceHistory, 9);
      const ema21 = calculateEMA(priceHistory, 14); // Use 14 instead of 21

      // Calculate RSI
      const rsi = calculateRSI(priceHistory, 14);

      // Widened RSI bands: 15-85 (was 20-80)
      if (rsi > 85) {
        return { action: null, confidence: 0, reason: `RSI overbought: ${rsi.toFixed(1)}` };
      }
      if (rsi < 15) {
        return { action: null, confidence: 0, reason: `RSI oversold: ${rsi.toFixed(1)}` };
      }

      // Bullish: EMA9 > EMA21 and RSI not overbought
      if (ema9 > ema21 && rsi < 75) {
        const confidence = 0.5 + (ema9 - ema21) / ema21 * 50;
        return {
          action: "YES",
          confidence: Math.min(0.8, confidence),
          reason: `Bullish: EMA9(${ema9.toFixed(4)}) > EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
        };
      }

      // Bearish: EMA9 < EMA21 and RSI not oversold
      if (ema9 < ema21 && rsi > 25) {
        const confidence = 0.5 + (ema21 - ema9) / ema21 * 50;
        return {
          action: "NO",
          confidence: Math.min(0.8, confidence),
          reason: `Bearish: EMA9(${ema9.toFixed(4)}) < EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
        };
      }

      return { action: null, confidence: 0, reason: `No clear signal: EMA9=${ema9.toFixed(4)}, EMA21=${ema21.toFixed(4)}, RSI=${rsi.toFixed(1)}` };
    },
  },

  market_maker: {
    name: "Market Maker",
    description: "Posts bid/ask limit orders to earn the spread; cancels at T−60s",
    category: "market_making",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, orderBook } = ctx;

      // Cancel all orders at T-60s
      if (timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Exiting market making: T-60s reached" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Calculate spread
      const spread = orderBook?.spread || 0.02;

      // Market make when spread is wide enough
      if (spread < 0.015) {
        return { action: null, confidence: 0, reason: `Spread too tight: ${(spread * 100).toFixed(1)}%` };
      }

      // Post on the side with better value
      // If YES is expensive (>0.55), sell NO (bid)
      // If NO is expensive (<0.45), sell YES (bid)
      if (yesPrice > 0.55) {
        return {
          action: "NO",
          confidence: 0.5,
          reason: `Market making: bid NO at ${((noPrice - 0.015) * 100).toFixed(0)}¢`,
        };
      }

      if (noPrice > 0.55) {
        return {
          action: "YES",
          confidence: 0.5,
          reason: `Market making: bid YES at ${((yesPrice - 0.015) * 100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "Market balanced, no edge" };
    },
  },
};

// === Bot Manager ===

export interface BotManagerConfig {
  maxBots?: number;
  defaultInterval?: number;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface CompetitionState {
  active: boolean;
  startTime: number;
  minTrades: number;
  startBalance: number;
  leaderboard: Array<{
    botId: string;
    botName: string;
    strategy: string;
    rank: number;
    trades: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    pnl: number;
    roi: number;
    balance: number;
  }>;
  winner: string | null;
  completedAt: number | null;
  config: {
    minTrades: number;
    duration: number | null; // null = no time limit
    startBalance: number;
  };
}

export class BotManager {
  private bots: Map<string, BotConfig> = new Map();
  private intervals: Map<string, Timer> = new Map();
  private sessions: BotSession[] = [];
  private currentSessions: Map<string, BotSession> = new Map();
  private config: Required<BotManagerConfig>;
  private logs: BotLog[] = [];
  private logListeners: Array<(log: BotLog) => void> = [];
  private competition: CompetitionState = {
    active: false,
    startTime: 0,
    minTrades: 50,
    startBalance: 10,
    leaderboard: [],
    winner: null,
    completedAt: null,
    config: {
      minTrades: 50,
      duration: null,
      startBalance: 10,
    },
  };

  constructor(config: BotManagerConfig = {}) {
    this.config = {
      maxBots: config.maxBots ?? 20,
      defaultInterval: config.defaultInterval ?? 5000,
    };

    this.initDefaultBots();
  }

  /** Add a log entry */
  private addLog(botId: string, type: BotLog["type"], message: string, details?: Record<string, unknown>): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const log: BotLog = {
      id: generateId("log"),
      botId,
      botName: bot.name,
      type,
      message,
      details,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    if (this.logs.length > 100) {
      this.logs.pop();
    }

    // Notify listeners
    for (const listener of this.logListeners) {
      try {
        listener(log);
      } catch (e) {
        console.error("[BotManager] Log listener error:", e);
      }
    }

    console.log(`[BotManager] ${bot.name}: ${message}`);
  }

  /** Subscribe to log updates */
  onLog(callback: (log: BotLog) => void): () => void {
    this.logListeners.push(callback);
    return () => {
      const index = this.logListeners.indexOf(callback);
      if (index > -1) {
        this.logListeners.splice(index, 1);
      }
    };
  }

  /** Get all logs */
  getLogs(limit = 50): BotLog[] {
    return this.logs.slice(0, limit);
  }

  /** Clear logs */
  clearLogs(): void {
    this.logs = [];
  }

  private initDefaultBots(): void {
    const defaultConfigs: Array<Partial<BotConfig> & { id: string; name: string; strategy: StrategyType }> = [
      { id: "bot-momentum-chaser", name: "BOT-01: Momentum Chaser", strategy: "momentum_chaser", interval: 30000, betSize: 5, maxBet: 10, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-mean-reversion-sniper", name: "BOT-02: Mean Reversion Sniper", strategy: "mean_reversion_sniper", interval: 5000, betSize: 3, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-sum-to-one-arb", name: "BOT-03: Sum-to-One Arbitrage", strategy: "sum_to_one_arb", interval: 2000, betSize: 10, maxBet: 20, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-whale-follower", name: "BOT-04: Whale Follower", strategy: "whale_follower", interval: 1000, betSize: 5, maxBet: 15, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-ta-signal-engine", name: "BOT-05: TA Signal Engine", strategy: "ta_signal_engine", interval: 5000, betSize: 4, maxBet: 8, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-market-maker", name: "BOT-06: Market Maker", strategy: "market_maker", interval: 3000, betSize: 5, maxBet: 10, useKelly: true, kellyFraction: 0.5 },
    ];

    for (const cfg of defaultConfigs) {
      this.createBot({
        id: cfg.id,
        name: cfg.name,
        strategy: cfg.strategy,
        type: cfg.strategy,
        enabled: false,
        interval: cfg.interval ?? this.config.defaultInterval,
        betSize: cfg.betSize ?? 0.5,
        useKelly: cfg.useKelly ?? false,
        kellyFraction: 0.25,
        maxBet: 3,
        stopLoss: 0.1,
        takeProfit: 0.2,
        maxPositions: 5,
        stats: {
          trades: 0,
          wins: 0,
          losses: 0,
          pnl: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          maxConsecutiveWins: 0,
          maxConsecutiveLosses: 0,
        },
        runTime: 0,
        portfolio: marketEngine.getBotPortfolio(cfg.id),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  createBot(config: BotConfig): BotConfig {
    if (this.bots.size >= this.config.maxBots) {
      throw new Error("Maximum number of bots reached");
    }

    marketEngine.initBotPortfolio(config.id);

    const bot: BotConfig = {
      ...config,
      portfolio: marketEngine.getBotPortfolio(config.id),
      updatedAt: Date.now(),
    };

    this.bots.set(config.id, bot);

    return bot;
  }

  getBots(): BotConfig[] {
    return Array.from(this.bots.values()).map((bot) => {
      const portfolio = marketEngine.getBotPortfolio(bot.id);
      this.syncStatsFromPortfolio(bot.id);
      return {
        ...bot,
        portfolio,
        stats: { ...bot.stats },
      };
    });
  }

  /** Recompute bot stats from settled portfolio positions (source of truth) */
  private syncStatsFromPortfolio(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const portfolio = marketEngine.getBotPortfolio(botId);
    const closedPositions = portfolio.closedPositions || [];

    bot.stats.trades = portfolio.totalTrades;
    bot.stats.wins = portfolio.winningTrades;
    bot.stats.losses = portfolio.losingTrades;
    bot.stats.pnl = portfolio.totalPnL;
    bot.stats.winRate = portfolio.winRate;

    // Recompute avgWin/avgLoss from closed positions
    const wins = closedPositions.filter(p => (p.pnl || 0) > 0);
    const losses = closedPositions.filter(p => (p.pnl || 0) <= 0 && p.pnl !== null);

    bot.stats.avgWin = wins.length > 0
      ? wins.reduce((s, p) => s + (p.pnl || 0), 0) / wins.length
      : 0;
    bot.stats.avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((s, p) => s + (p.pnl || 0), 0) / losses.length)
      : 0;

    // Profit factor = gross profit / gross loss
    const grossProfit = wins.reduce((s, p) => s + (p.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + (p.pnl || 0), 0));
    bot.stats.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // Consecutive wins/losses
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    for (const pos of closedPositions) {
      if ((pos.pnl || 0) > 0) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
      }
    }
    bot.stats.maxConsecutiveWins = maxWinStreak;
    bot.stats.maxConsecutiveLosses = maxLossStreak;

    if (closedPositions.length > 0) {
      bot.stats.lastTradeTime = closedPositions[0].exitTime || closedPositions[0].timestamp;
    }

    this.bots.set(botId, bot);
  }

  getBot(id: string): BotConfig | undefined {
    const bot = this.bots.get(id);
    if (!bot) return undefined;
    return {
      ...bot,
      portfolio: marketEngine.getBotPortfolio(id),
    };
  }

  toggleBot(id: string): BotConfig | null {
    const bot = this.bots.get(id);
    if (!bot) return null;

    const newEnabled = !bot.enabled;
    bot.enabled = newEnabled;

    if (newEnabled) {
      this.startBot(id);
    } else {
      this.stopBot(id);
    }

    // Ensure the bot state is saved
    this.bots.set(id, bot);

    console.log(`[BotManager] Bot ${id} toggled to ${newEnabled ? 'enabled' : 'disabled'}`);

    return { ...bot, portfolio: marketEngine.getBotPortfolio(id) };
  }

  private startBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) return;

    // Clear existing interval
    this.stopBot(id);

    // Start session
    const portfolio = marketEngine.getBotPortfolio(id);
    const market = marketEngine.getCurrentMarket();
    const session: BotSession = {
      id: generateId("session"),
      botId: id,
      botName: bot.name,
      strategy: bot.strategy,
      startTime: Date.now(),
      endTime: null,
      startBalance: portfolio.balance,
      endBalance: null,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      status: "running",
    };
    this.currentSessions.set(id, session);

    // Log bot start
    this.addLog(id, "START", `Bot started - Strategy: ${bot.strategy}, Interval: ${bot.interval}ms`, {
      strategy: bot.strategy,
      interval: bot.interval,
      betSize: bot.betSize,
      useKelly: bot.useKelly,
      marketId: market?.id,
      marketQuestion: market?.question,
    });

    // Start execution loop
    const intervalId = setInterval(() => {
      this.executeBotStrategy(id);
    }, bot.interval);

    this.intervals.set(id, intervalId);
    bot.runTime = Date.now();
  }

  private stopBot(id: string): void {
    const intervalId = this.intervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(id);
    }

    // Complete session
    const session = this.currentSessions.get(id);
    if (session) {
      const portfolio = marketEngine.getBotPortfolio(id);
      const bot = this.bots.get(id);

      session.endTime = Date.now();
      session.endBalance = portfolio.balance;
      session.totalPnL = portfolio.totalPnL;
      session.totalTrades = portfolio.totalTrades;
      session.winningTrades = portfolio.winningTrades;
      session.losingTrades = portfolio.losingTrades;
      session.status = "completed";

      // Log bot stop
      const runtime = Date.now() - session.startTime;
      this.addLog(id, "STOP", `Bot stopped - Runtime: ${Math.floor(runtime / 1000)}s, P&L: $${portfolio.totalPnL.toFixed(2)}, Trades: ${portfolio.totalTrades}`, {
        runtime,
        totalPnL: portfolio.totalPnL,
        totalTrades: portfolio.totalTrades,
        winRate: portfolio.winRate,
        endBalance: portfolio.balance,
      });

      this.sessions.unshift(session);
      this.currentSessions.delete(id);

      // Keep only last 100 sessions
      if (this.sessions.length > 100) {
        this.sessions.pop();
      }

      // Save to database
      this.saveBotSessionToDB(session, bot);
    }

    // Only clear runTime - do NOT clear enabled flag as it may be set by caller
    const bot = this.bots.get(id);
    if (bot) {
      bot.runTime = 0;
      this.bots.set(id, bot);
    }
  }

  private saveBotSessionToDB(session: BotSession, bot?: BotConfig | null): void {
    dbService.saveBotSession({
      id: session.id,
      botId: session.botId,
      botName: session.botName,
      strategy: session.strategy,
      startTime: session.startTime,
      endTime: session.endTime,
      startBalance: session.startBalance,
      endBalance: session.endBalance,
      totalTrades: session.totalTrades,
      winningTrades: session.winningTrades,
      losingTrades: session.losingTrades,
      totalPnL: session.totalPnL,
      status: session.status,
      maxDrawdown: 0,
      sharpeRatio: 0,
    }).catch((e) => console.error("[BotManager] DB save error:", e));
  }

  private executeBotStrategy(id: string): void {
    const bot = this.bots.get(id);
    if (!bot || !bot.enabled) return;

    // Risk check: Is bot paused?
    if (riskManager.shouldPause(id)) {
      const status = riskManager.getBotRiskStatus(id);
      if (status.paused && status.pauseReason) {
        this.addLog(id, "RISK", `Bot paused: ${status.pauseReason}`);
      }
      return;
    }

    const market = marketEngine.getCurrentMarket();
    if (!market || market.status !== "active") return;

    const strategy = strategies[bot.strategy];
    if (!strategy) return;

    // Build context from Polymarket odds data (NOT BTC price)
    const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
    const yesPriceHistory = market.yesPriceHistory || [];
    const priceHistory = yesPriceHistory.map((p) => p.price);
    const timeRemaining = marketEngine.getTimeRemaining();
    const totalDuration = market.endTime - market.startTime;

    // Calculate volatility from YES price changes
    let volatility = 0;
    if (priceHistory.length >= 5) {
      const changes: number[] = [];
      for (let i = 1; i < priceHistory.length; i++) {
        changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]));
      }
      volatility = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    // Calculate momentum from YES price trend
    let momentum = 0;
    if (priceHistory.length >= 3) {
      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-6, -3);
      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        momentum = recentAvg - olderAvg;
      }
    }

    // Get Binance signal data for predictive strategies
    const lastSignal = binanceKlineProvider.getLastSignal();
    const binanceSignal = lastSignal ? {
      type: lastSignal.type,
      changePercent: lastSignal.changePercent,
      confidence: lastSignal.confidence,
      timestamp: lastSignal.timestamp,
      predictedOutcome: lastSignal.predictedOutcome,
    } : undefined;

    // Get BTC price and change
    const btcPrice = priceService.getPrice();
    const btcPriceHistory = priceService.getPriceHistory(10);
    const btcPriceChange = btcPriceHistory.length >= 2
      ? (btcPrice - btcPriceHistory[0].price) / btcPriceHistory[0].price
      : 0;

    const context: StrategyContext = {
      currentPrice: yesPrice,
      startPrice: market.startPrice || 0.5,
      priceHistory,
      timeRemaining,
      marketDuration: totalDuration,
      marketPrice: { yesPrice, noPrice },
      volatility,
      momentum,
      binanceSignal,
      btcPrice,
      btcPriceChange,
    };

    const decision = strategy.execute(context);

    // Log decision even if no action
    if (!decision.action) {
      // Only log occasionally to avoid spam (every 10th check)
      if (Math.random() < 0.1) {
        this.addLog(id, "DECISION", `No trade - ${decision.reason}`, {
          yesPrice,
          noPrice,
          timeRemaining,
          confidence: decision.confidence,
        });
      }
      return;
    }

    // Log the decision to trade
    this.addLog(id, "DECISION", `Trade decision: ${decision.action} - ${decision.reason}`, {
      action: decision.action,
      confidence: decision.confidence,
      reason: decision.reason,
      yesPrice,
      noPrice,
      timeRemaining,
      volatility: volatility.toFixed(4),
      momentum: momentum.toFixed(4),
      btcPriceChange: (btcPriceChange * 100).toFixed(3) + '%',
    });

    // Calculate bet size
    let betSize = bot.betSize;

    // Kelly criterion for position sizing
    // f* = (p*b - q) / b where p=win prob, q=loss prob, b=net odds
    // For prediction markets: if betting YES at price P, you win (1-P)/P per unit bet
    if (bot.useKelly || bot.useKelly === undefined) {
      const portfolio = marketEngine.getBotPortfolio(id);

      // Use historical win rate if available, otherwise use price-based probability
      const botStats = bot.stats;
      const winProbability = botStats.trades >= 5
        ? botStats.winRate
        : (decision.action === "YES" ? 1 - yesPrice : 1 - noPrice);

      // Net odds: amount won per unit bet
      // If YES at 0.60, you pay 0.60 to win 1.00, so net odds = (1-0.60)/0.60 = 0.67
      // If NO at 0.40, you pay 0.40 to win 1.00, so net odds = (1-0.40)/0.40 = 1.5
      const price = decision.action === "YES" ? yesPrice : noPrice;
      const netOdds = (1 - price) / price;

      // Kelly formula: f* = (p*b - q) / b
      // where p = winProbability, q = 1 - p, b = netOdds
      const q = 1 - winProbability;
      const kellyFraction = (winProbability * netOdds - q) / netOdds;

      // Apply half-Kelly (more conservative) and user's kelly fraction
      const halfKelly = Math.max(0, kellyFraction * 0.5 * (bot.kellyFraction || 0.5));

      // Calculate bet size
      const kellyBet = portfolio.balance * halfKelly;

      // Cap at max bet and 25% of bankroll for safety
      betSize = Math.min(kellyBet, bot.maxBet || betSize, portfolio.balance * 0.25);
      betSize = Math.max(0.1, betSize);

      // Log Kelly calculation for transparency
      if (kellyBet > 0) {
        console.log(`[BotManager] Kelly: ${bot.name} | WinProb: ${(winProbability * 100).toFixed(1)}% | Odds: ${netOdds.toFixed(2)} | Fraction: ${(halfKelly * 100).toFixed(1)}% | Bet: $${betSize.toFixed(2)}`);
      }
    }

    // Adjust bet size based on confidence
    betSize = betSize * (0.5 + decision.confidence * 0.5);

    const portfolio = marketEngine.getBotPortfolio(id);
    const fee = betSize * 0.02;

    // Risk check: Can open position?
    const riskCheck = riskManager.canOpenPosition(id, betSize, decision.confidence);
    if (!riskCheck.allowed) {
      this.addLog(id, "RISK", `Trade blocked: ${riskCheck.reason}`, {
        betSize,
        confidence: decision.confidence,
      });
      return;
    }

    if (portfolio.balance < betSize + fee) {
      this.addLog(id, "ERROR", `Insufficient balance for trade - Required: $${(betSize + fee).toFixed(2)}, Available: $${portfolio.balance.toFixed(2)}`);
      return;
    }

    const position = marketEngine.placeTrade(decision.action, betSize, id);
    if (position) {
      this.addLog(id, "TRADE", `Executed ${decision.action} trade for $${betSize.toFixed(2)} at ${position.odds.toFixed(3)} odds`, {
        action: decision.action,
        amount: betSize,
        odds: position.odds,
        fee: position.fee,
        positionId: position.id,
        confidence: decision.confidence,
        balanceAfter: portfolio.balance - betSize - fee,
        openPositions: portfolio.openPositions.length + 1,
        kellyUsed: bot.useKelly,
        strategy: bot.strategy,
      });
      // Note: stats are synced from portfolio on getBots() / after market settlement
      // Do NOT call updateBotStats here — position.pnl is null at placement time
    }
  }

  // updateBotStats removed — stats are now derived from portfolio settled positions
  // via syncStatsFromPortfolio() called in getBots()

  updateBotConfig(id: string, updates: Partial<BotConfig>): BotConfig | null {
    const bot = this.bots.get(id);
    if (!bot) return null;

    if (updates.betSize !== undefined) bot.betSize = Math.max(0.01, updates.betSize);
    if (updates.interval !== undefined) bot.interval = Math.max(1000, updates.interval);
    if (updates.useKelly !== undefined) bot.useKelly = updates.useKelly;
    if (updates.kellyFraction !== undefined) bot.kellyFraction = clamp(updates.kellyFraction, 0.01, 1);
    if (updates.maxBet !== undefined) bot.maxBet = Math.max(0.1, updates.maxBet);
    if (updates.stopLoss !== undefined) bot.stopLoss = updates.stopLoss;
    if (updates.takeProfit !== undefined) bot.takeProfit = updates.takeProfit;
    if (updates.maxPositions !== undefined) bot.maxPositions = Math.max(1, updates.maxPositions);

    bot.updatedAt = Date.now();

    // Restart bot if running to apply new interval
    if (bot.enabled && updates.interval !== undefined) {
      this.startBot(id);
    }

    this.bots.set(id, bot);
    return { ...bot, portfolio: marketEngine.getBotPortfolio(id) };
  }

  deleteBot(id: string): boolean {
    this.stopBot(id);
    return this.bots.delete(id);
  }

  stopAllBots(): void {
    for (const [id, bot] of this.bots) {
      bot.enabled = false;
      this.bots.set(id, bot);
      this.stopBot(id);
    }
  }

  runAllBots(config?: { betSize?: number; interval?: number }): void {
    for (const [id, bot] of this.bots) {
      if (config?.betSize) bot.betSize = config.betSize;
      if (config?.interval) bot.interval = config.interval;
      bot.enabled = true;
      this.bots.set(id, bot);
      this.startBot(id);
    }
  }

  resetAllBots(): void {
    this.stopAllBots();
    this.bots.clear();
    this.sessions = [];
    this.currentSessions.clear();
    this.initDefaultBots();
  }

  getSessions(): BotSession[] {
    return [...this.sessions];
  }

  getActiveSessions(): BotSession[] {
    return Array.from(this.currentSessions.values());
  }

  getStrategies(): Array<{ type: StrategyType; name: string; description: string; category: string }> {
    return Object.entries(strategies).map(([type, strategy]) => ({
      type: type as StrategyType,
      name: strategy.name,
      description: strategy.description,
      category: strategy.category,
    }));
  }

  // === Competition Mode ===

  startCompetition(config?: { minTrades?: number; duration?: number | null; startBalance?: number }): CompetitionState {
    // Stop any existing competition
    if (this.competition.active) {
      this.stopCompetition();
    }

    const minTrades = config?.minTrades ?? 50;
    const startBalance = config?.startBalance ?? 10;

    // Reset all bots to equal starting conditions
    this.stopAllBots();

    for (const [id, bot] of this.bots) {
      // Reset portfolio
      marketEngine.initBotPortfolio(id);
      const portfolio = marketEngine.getBotPortfolio(id);
      portfolio.balance = startBalance;
      portfolio.initialBalance = startBalance;

      // Reset stats
      bot.stats = {
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
      };
      bot.enabled = true;
      bot.portfolio = portfolio;
      this.bots.set(id, bot);

      // Start the bot
      this.startBot(id);
    }

    // Initialize competition state
    this.competition = {
      active: true,
      startTime: Date.now(),
      minTrades,
      startBalance,
      leaderboard: [],
      winner: null,
      completedAt: null,
      config: {
        minTrades,
        duration: config?.duration ?? null,
        startBalance,
      },
    };

    this.addCompetitionLog("Competition started", {
      minTrades,
      startBalance,
      bots: this.bots.size,
    });

    return this.getCompetitionState();
  }

  stopCompetition(): CompetitionState {
    if (!this.competition.active) {
      return this.getCompetitionState();
    }

    // Stop all bots
    this.stopAllBots();

    // Calculate final leaderboard
    this.updateLeaderboard();

    // Determine winner (highest P&L with min trades)
    const qualified = this.competition.leaderboard.filter(b => b.trades >= this.competition.minTrades);
    if (qualified.length > 0) {
      this.competition.winner = qualified[0].botId;
    }

    this.competition.active = false;
    this.competition.completedAt = Date.now();

    this.addCompetitionLog("Competition ended", {
      winner: this.competition.winner,
      leaderboard: this.competition.leaderboard.slice(0, 3),
    });

    return this.getCompetitionState();
  }

  getCompetitionState(): CompetitionState {
    if (this.competition.active) {
      this.updateLeaderboard();
    }
    return { ...this.competition };
  }

  private updateLeaderboard(): void {
    const entries: CompetitionState["leaderboard"] = [];

    for (const [id, bot] of this.bots) {
      const portfolio = marketEngine.getBotPortfolio(id);
      const pnl = bot.stats.pnl || portfolio.totalPnL;
      const trades = bot.stats.trades || portfolio.totalTrades;
      const winRate = bot.stats.winRate || portfolio.winRate;

      // Calculate Sharpe ratio (simplified)
      const avgWin = bot.stats.avgWin || 0;
      const avgLoss = bot.stats.avgLoss || 0;
      const sharpeRatio = trades >= 5 ? (avgWin - avgLoss) / Math.max(0.01, (avgWin + avgLoss) / 2) : 0;

      // Calculate profit factor
      const profitFactor = bot.stats.profitFactor || (avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0);

      // Calculate ROI
      const roi = this.competition.startBalance > 0
        ? ((portfolio.balance - this.competition.startBalance) / this.competition.startBalance) * 100
        : 0;

      entries.push({
        botId: id,
        botName: bot.name,
        strategy: bot.strategy,
        rank: 0,
        trades,
        winRate,
        profitFactor: isFinite(profitFactor) ? profitFactor : 0,
        sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
        pnl,
        roi,
        balance: portfolio.balance,
      });
    }

    // Sort by: trades qualified → P&L → win rate
    entries.sort((a, b) => {
      const aQualified = a.trades >= this.competition.minTrades;
      const bQualified = b.trades >= this.competition.minTrades;

      if (aQualified !== bQualified) {
        return aQualified ? -1 : 1;
      }

      // Both qualified or not - sort by P&L
      if (a.pnl !== b.pnl) {
        return b.pnl - a.pnl;
      }

      // Tie-breaker: win rate
      return b.winRate - a.winRate;
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.competition.leaderboard = entries;

    // Check if competition should auto-end
    if (this.competition.active && this.competition.config.duration) {
      const elapsed = Date.now() - this.competition.startTime;
      if (elapsed >= this.competition.config.duration) {
        this.stopCompetition();
      }
    }
  }

  private addCompetitionLog(message: string, details?: Record<string, unknown>): void {
    const log: BotLog = {
      id: generateId("log"),
      botId: "competition",
      botName: "Competition",
      type: "COMPETITION",
      message,
      details,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    if (this.logs.length > 100) {
      this.logs.pop();
    }

    for (const listener of this.logListeners) {
      try {
        listener(log);
      } catch (e) {
        console.error("[BotManager] Log listener error:", e);
      }
    }

    console.log(`[Competition] ${message}`);
  }

  dispose(): void {
    this.stopAllBots();
    this.intervals.clear();
  }
}

// Singleton instance
export const botManager = new BotManager();
