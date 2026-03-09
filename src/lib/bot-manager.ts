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

// === Strategy Implementations ===

const strategies: Record<StrategyType, Strategy> = {
  random: {
    name: "Random",
    description: "Flips a coin to decide",
    category: "other",
    execute: () => ({
      action: Math.random() > 0.5 ? "YES" : "NO",
      confidence: 0.5,
      reason: "Random selection",
    }),
  },

  momentum: {
    name: "Momentum",
    description: "Follows price direction",
    category: "momentum",
    execute: (ctx) => {
      const { startPrice, currentPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const change = (currentPrice - startPrice) / startPrice;
      const threshold = 0.001;

      if (change > threshold) {
        return { action: "YES", confidence: Math.min(0.8, change * 100), reason: `Positive momentum: ${(change * 100).toFixed(2)}%` };
      }
      if (change < -threshold) {
        return { action: "NO", confidence: Math.min(0.8, -change * 100), reason: `Negative momentum: ${(change * 100).toFixed(2)}%` };
      }
      return { action: null, confidence: 0, reason: "No clear momentum" };
    },
  },

  mean_reversion: {
    name: "Mean Reversion",
    description: "Bets against extreme moves",
    category: "mean_reversion",
    execute: (ctx) => {
      const { startPrice, currentPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const change = (currentPrice - startPrice) / startPrice;
      const threshold = 0.002;

      if (change > threshold) {
        return { action: "NO", confidence: Math.min(0.75, change * 50), reason: `Overbought: ${(change * 100).toFixed(2)}%` };
      }
      if (change < -threshold) {
        return { action: "YES", confidence: Math.min(0.75, -change * 50), reason: `Oversold: ${(change * 100).toFixed(2)}%` };
      }
      return { action: null, confidence: 0, reason: "No extreme move detected" };
    },
  },

  trend: {
    name: "Trend",
    description: "Uses price history trend",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining } = ctx;

      if (priceHistory.length < 10) {
        return { action: null, confidence: 0, reason: "Insufficient data" };
      }
      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const recent = priceHistory.slice(-5);
      const older = priceHistory.slice(-10, -5);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      const trend = (recentAvg - olderAvg) / olderAvg;

      if (trend > 0.0005) {
        return { action: "YES", confidence: Math.min(0.8, trend * 500), reason: `Uptrend: ${(trend * 100).toFixed(3)}%` };
      }
      if (trend < -0.0005) {
        return { action: "NO", confidence: Math.min(0.8, -trend * 500), reason: `Downtrend: ${(trend * 100).toFixed(3)}%` };
      }
      return { action: null, confidence: 0, reason: "No clear trend" };
    },
  },

  smart_trend: {
    name: "Smart Trend",
    description: "Trend following with confirmation",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining } = ctx;

      if (priceHistory.length < 15) {
        return { action: null, confidence: 0, reason: "Insufficient data" };
      }
      if (timeRemaining < 45000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const shortTerm = priceHistory.slice(-3);
      const mediumTerm = priceHistory.slice(-8);
      const longTerm = priceHistory.slice(-15);

      const shortAvg = shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length;
      const mediumAvg = mediumTerm.reduce((a, b) => a + b, 0) / mediumTerm.length;
      const longAvg = longTerm.reduce((a, b) => a + b, 0) / longTerm.length;

      const shortTrend = shortAvg > mediumAvg;
      const mediumTrend = mediumAvg > longAvg;

      if (shortTrend && mediumTrend) {
        return { action: "YES", confidence: 0.75, reason: "Multi-timeframe bullish" };
      }
      if (!shortTrend && !mediumTrend) {
        return { action: "NO", confidence: 0.75, reason: "Multi-timeframe bearish" };
      }
      return { action: null, confidence: 0, reason: "Mixed signals" };
    },
  },

  contrarian: {
    name: "Contrarian",
    description: "Bets against the crowd",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;

      if (yesPrice > 0.7) {
        return { action: "NO", confidence: (yesPrice - 0.5) * 1.5, reason: `YES overpriced at ${(yesPrice * 100).toFixed(1)}%` };
      }
      if (yesPrice < 0.3) {
        return { action: "YES", confidence: (0.5 - yesPrice) * 1.5, reason: `NO overpriced at ${((1 - yesPrice) * 100).toFixed(1)}%` };
      }
      return { action: null, confidence: 0, reason: "No pricing anomaly" };
    },
  },

  volatility: {
    name: "Volatility",
    description: "Trades on volatility breakouts",
    category: "momentum",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, volatility } = ctx;

      if (priceHistory.length < 20 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Insufficient data or time" };
      }

      if (volatility < 0.0005) {
        return { action: null, confidence: 0, reason: "Too little volatility" };
      }

      const recent = priceHistory.slice(-5);
      const prev = priceHistory.slice(-10, -5);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;

      const change = (recentAvg - prevAvg) / prevAvg;

      if (change > 0.001) {
        return { action: "YES", confidence: Math.min(0.8, volatility * 500), reason: "Volatility breakout up" };
      }
      if (change < -0.001) {
        return { action: "NO", confidence: Math.min(0.8, volatility * 500), reason: "Volatility breakout down" };
      }
      return { action: null, confidence: 0, reason: "No breakout detected" };
    },
  },

  fair_value: {
    name: "Fair Value",
    description: "Trades on price divergences",
    category: "arbitrage",
    execute: (ctx) => {
      const { startPrice, currentPrice, marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const priceChange = (currentPrice - startPrice) / startPrice;
      const fairValueYes = 0.5 + priceChange * 3;
      const clampedFairValue = Math.max(0.05, Math.min(0.95, fairValueYes));

      const marketYesPrice = marketPrice?.yesPrice || 0.5;
      const edge = clampedFairValue - marketYesPrice;

      if (edge > 0.05) {
        return { action: "YES", confidence: Math.min(0.9, edge * 5), reason: `Undervalued by ${(edge * 100).toFixed(1)}%` };
      }
      if (edge < -0.05) {
        return { action: "NO", confidence: Math.min(0.9, -edge * 5), reason: `Overvalued by ${(-edge * 100).toFixed(1)}%` };
      }
      return { action: null, confidence: 0, reason: `Edge only ${(Math.abs(edge) * 100).toFixed(1)}%` };
    },
  },

  anomaly: {
    name: "Anomaly",
    description: "Arbitrages mispriced markets",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const sum = yesPrice + noPrice;

      if (sum < 0.98) {
        return {
          action: yesPrice < noPrice ? "YES" : "NO",
          confidence: (1 - sum) * 10,
          reason: `Arbitrage: sum=${(sum * 100).toFixed(1)}%`,
        };
      }
      return { action: null, confidence: 0, reason: "No arbitrage opportunity" };
    },
  },

  momentum_burst: {
    name: "Momentum Burst",
    description: "Catches quick momentum moves",
    category: "momentum",
    execute: (ctx) => {
      const { priceHistory, timeRemaining } = ctx;

      if (priceHistory.length < 5 || timeRemaining < 20000) {
        return { action: null, confidence: 0, reason: "Insufficient data or time" };
      }

      const latest = priceHistory[priceHistory.length - 1];
      const prev = priceHistory[priceHistory.length - 3];
      const old = priceHistory[priceHistory.length - 5];

      const quickChange = (latest - prev) / prev;
      const sustained = (latest - old) / old;

      if (quickChange > 0.0008 && sustained > 0) {
        return { action: "YES", confidence: Math.min(0.8, quickChange * 500), reason: "Quick momentum burst up" };
      }
      if (quickChange < -0.0008 && sustained < 0) {
        return { action: "NO", confidence: Math.min(0.8, -quickChange * 500), reason: "Quick momentum burst down" };
      }
      return { action: null, confidence: 0, reason: "No burst detected" };
    },
  },

  grid_trading: {
    name: "Grid Trading",
    description: "Places trades at grid levels",
    category: "other",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, priceHistory } = ctx;

      if (timeRemaining < 60000 || priceHistory.length < 10) {
        return { action: null, confidence: 0, reason: "Insufficient time or data" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const range = 0.05;
      const center = 0.5;

      if (yesPrice < center - range) {
        return { action: "YES", confidence: 0.6, reason: `Price at grid lower: ${(yesPrice * 100).toFixed(1)}%` };
      }
      if (yesPrice > center + range) {
        return { action: "NO", confidence: 0.6, reason: `Price at grid upper: ${(yesPrice * 100).toFixed(1)}%` };
      }

      return { action: null, confidence: 0, reason: "Price in middle grid" };
    },
  },

  market_making: {
    name: "Market Maker",
    description: "Provides liquidity at spread",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const spread = 0.02;

      if (yesPrice > 0.55) {
        return { action: "NO", confidence: 0.5, reason: "Capture spread at upper bound" };
      }
      if (yesPrice < 0.45) {
        return { action: "YES", confidence: 0.5, reason: "Capture spread at lower bound" };
      }

      return { action: null, confidence: 0, reason: "No edge in spread" };
    },
  },

  arbitrage: {
    name: "Arbitrage",
    description: "Exploits price inefficiencies",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, startPrice, currentPrice } = ctx;

      if (timeRemaining < 45000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const priceChange = (currentPrice - startPrice) / startPrice;
      const impliedProbability = 0.5 + priceChange * 2;

      const edge = Math.abs(impliedProbability - yesPrice);

      if (edge > 0.08) {
        const action = impliedProbability > yesPrice ? "YES" : "NO";
        return { action, confidence: Math.min(0.85, edge * 5), reason: `Large edge: ${(edge * 100).toFixed(1)}%` };
      }

      return { action: null, confidence: 0, reason: `Edge only ${(edge * 100).toFixed(1)}%` };
    },
  },

  binance_signal: {
    name: "Binance Signal",
    description: "Predicts market using Binance price delay (4-12s oracle lag)",
    category: "momentum",
    execute: (ctx) => {
      const { binanceSignal, timeRemaining } = ctx;

      // Need Binance signal data
      if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
        return { action: null, confidence: 0, reason: "No Binance signal" };
      }

      // Signal age check - signal should be fresh (< 8 seconds old)
      const signalAge = Date.now() - binanceSignal.timestamp;
      if (signalAge > 8000) {
        return { action: null, confidence: 0, reason: `Signal too old (${(signalAge / 1000).toFixed(1)}s)` };
      }

      // Don't trade too close to settlement
      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Get the predicted outcome - default based on signal type if not provided
      const action = binanceSignal.predictedOutcome ?? (binanceSignal.type === "UP" ? "YES" : "NO");

      // Higher confidence for larger moves
      const confidence = Math.min(0.95, binanceSignal.confidence);

      return {
        action,
        confidence,
        reason: `Binance ${binanceSignal.type}: ${binanceSignal.changePercent >= 0 ? "+" : ""}${binanceSignal.changePercent.toFixed(4)}%`,
      };
    },
  },

  last_seconds_scalp: {
    name: "Last Seconds Scalp",
    description: "Enters in final seconds when outcome is predictable",
    category: "arbitrage",
    execute: (ctx) => {
      const { binanceSignal, timeRemaining, marketPrice, btcPriceChange } = ctx;

      // Only active in the last 3-12 seconds
      if (timeRemaining > 12000 || timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Not in scalp window" };
      }

      // Need BTC price change data
      if (btcPriceChange === undefined || Math.abs(btcPriceChange) < 0.005) {
        return { action: null, confidence: 0, reason: "BTC move too small" };
      }

      // Direction based on BTC change
      const action = btcPriceChange > 0 ? "YES" : "NO";
      const confidence = Math.min(0.9, Math.abs(btcPriceChange) * 50);

      // Check if odds are favorable (high ROI)
      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const targetPrice = action === "YES" ? yesPrice : noPrice;

      // If odds are already very low (high ROI opportunity)
      if (targetPrice < 0.3) {
        return {
          action,
          confidence: Math.min(0.95, confidence + 0.2),
          reason: `Scalp: ${action} at ${(targetPrice * 100).toFixed(0)}¢ (ROI: ${((1 / targetPrice - 1) * 100).toFixed(0)}%)`,
        };
      }

      // Only scalp if we have high confidence
      if (confidence > 0.6) {
        return {
          action,
          confidence,
          reason: `Last-second scalp: BTC ${btcPriceChange >= 0 ? "+" : ""}${(btcPriceChange * 100).toFixed(2)}%`,
        };
      }

      return { action: null, confidence: 0, reason: "Confidence too low for scalp" };
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
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export class BotManager {
  private bots: Map<string, BotConfig> = new Map();
  private intervals: Map<string, Timer> = new Map();
  private sessions: BotSession[] = [];
  private currentSessions: Map<string, BotSession> = new Map();
  private config: Required<BotManagerConfig>;
  private logs: BotLog[] = [];
  private logListeners: Array<(log: BotLog) => void> = [];

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
      { id: "bot-random", name: "Random Bot", strategy: "random", interval: 5000, betSize: 0.5 },
      { id: "bot-momentum", name: "Momentum Bot", strategy: "momentum", interval: 5000, betSize: 0.5, useKelly: true },
      { id: "bot-mean-reversion", name: "Mean Reversion", strategy: "mean_reversion", interval: 8000, betSize: 0.5, useKelly: true },
      { id: "bot-smart-trend", name: "Smart Trend", strategy: "smart_trend", interval: 10000, betSize: 0.5, useKelly: true },
      { id: "bot-contrarian", name: "Contrarian", strategy: "contrarian", interval: 7000, betSize: 0.5, useKelly: true },
      { id: "bot-fair-value", name: "Fair Value", strategy: "fair_value", interval: 6000, betSize: 0.5, useKelly: true },
      { id: "bot-arbitrage", name: "Arbitrage", strategy: "arbitrage", interval: 8000, betSize: 1, useKelly: true },
      { id: "bot-grid", name: "Grid Trader", strategy: "grid_trading", interval: 10000, betSize: 0.3 },
      { id: "bot-binance-signal", name: "Binance Signal", strategy: "binance_signal", interval: 1000, betSize: 1, useKelly: true, maxPositions: 3 },
      { id: "bot-last-seconds", name: "Last Seconds Scalp", strategy: "last_seconds_scalp", interval: 500, betSize: 2, useKelly: false, maxPositions: 2 },
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
    return Array.from(this.bots.values()).map((bot) => ({
      ...bot,
      portfolio: marketEngine.getBotPortfolio(bot.id),
    }));
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

    bot.enabled = !bot.enabled;

    if (bot.enabled) {
      this.startBot(id);
    } else {
      this.stopBot(id);
    }

    this.bots.set(id, bot);
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

    const market = marketEngine.getCurrentMarket();
    if (!market || market.status !== "active") return;

    const strategy = strategies[bot.strategy];
    if (!strategy) return;

    // Check max positions
    const openPositions = marketEngine.getOpenPositions(id);
    if (openPositions.length >= bot.maxPositions) {
      return;
    }

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
    });

    // Calculate bet size
    let betSize = bot.betSize;

    if (bot.useKelly) {
      const portfolio = marketEngine.getBotPortfolio(id);
      const edge = Math.abs(yesPrice - 0.5);
      const odds = decision.action === "YES" ? yesPrice : noPrice;

      const kellyBet = portfolio.balance * edge * (bot.kellyFraction || 0.25);
      betSize = Math.min(kellyBet, bot.maxBet || betSize, portfolio.balance * 0.1);
      betSize = Math.max(0.1, betSize);
    }

    // Adjust bet size based on confidence
    betSize = betSize * (0.5 + decision.confidence * 0.5);

    const portfolio = marketEngine.getBotPortfolio(id);
    const fee = betSize * 0.02;

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
      });
      this.updateBotStats(id, position);
    }
  }

  private updateBotStats(botId: string, position: Position): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    bot.stats.trades++;

    if (position.pnl !== null) {
      if (position.pnl > 0) {
        bot.stats.wins++;
        bot.stats.avgWin = (bot.stats.avgWin * (bot.stats.wins - 1) + position.pnl) / bot.stats.wins;
      } else {
        bot.stats.losses++;
        bot.stats.avgLoss = (bot.stats.avgLoss * (bot.stats.losses - 1) + Math.abs(position.pnl)) / bot.stats.losses;
      }

      bot.stats.pnl += position.pnl;
      bot.stats.winRate = bot.stats.trades > 0 ? bot.stats.wins / bot.stats.trades : 0;

      if (bot.stats.avgLoss > 0) {
        bot.stats.profitFactor = (bot.stats.wins * bot.stats.avgWin) / (bot.stats.losses * bot.stats.avgLoss);
      }
    }

    this.bots.set(botId, bot);
  }

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
    for (const [id] of this.bots) {
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

  dispose(): void {
    this.stopAllBots();
    this.intervals.clear();
  }
}

// Singleton instance
export const botManager = new BotManager();
