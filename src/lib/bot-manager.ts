// Unified Bot Manager - Manages trading bots with various strategies
// Implements isolated portfolios and session tracking

import type {
  BotConfig,
  BotSession,
  StrategyType,
  StrategyContext,
  Outcome,
  TradingMode,
} from "../types";
import { marketEngine } from "./market-engine";
import { dbService } from "./database";
import { generateId, clamp } from "./utils";
import { binanceKlineProvider } from "./providers/binance-kline-provider";
import { priceService } from "./price";
import { riskManager } from "./risk-manager";
import { strategyCoordinator } from "./strategy-coordinator";
import { parameterOptimizer } from "./parameter-optimizer";
import { polymarketProvider } from "./providers/polymarket-provider";
import { broadcastToSSE } from "./global";
import { strategies } from "./strategies";

// Re-export TradingMode type for backward compatibility
export type { TradingMode } from "../types";

// === Bot Manager ===

export interface BotManagerConfig {
  maxBots?: number;
  defaultInterval?: number;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD" | "SETTLED";
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
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private sessions: BotSession[] = [];
  private currentSessions: Map<string, BotSession> = new Map();
  private config: Required<BotManagerConfig>;
  private logs: BotLog[] = [];
  private logListeners: Array<(log: BotLog) => void> = [];
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
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

  // Trading mode: demo (simulated) or live (real Polymarket trades)
  private tradingMode: TradingMode = "demo";

  constructor(config: BotManagerConfig = {}) {
    this.config = {
      maxBots: config.maxBots ?? 20,
      defaultInterval: config.defaultInterval ?? 5000,
    };

    this.initDefaultBots();
    this.startAutoSave();
  }

  /** Auto-save sessions every 60 seconds to prevent data loss */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveAllActiveSessions();
    }, 60000); // Save every 60 seconds
  }

  /** Save all currently active sessions to database */
  private saveAllActiveSessions(): void {
    for (const [botId, session] of this.currentSessions) {
      const portfolio = marketEngine.getBotPortfolio(botId);
      if (!portfolio) continue;

      // Update session with current state
      session.endBalance = portfolio.balance;
      session.totalPnL = portfolio.totalPnL;
      session.totalTrades = portfolio.totalTrades;
      session.winningTrades = portfolio.winningTrades;
      session.losingTrades = portfolio.losingTrades;
      session.endTime = Date.now(); // Update end time for auto-save

      // Save to database with "running" status
      this.saveBotSessionToDB(session, this.bots.get(botId));
    }

    if (this.currentSessions.size > 0) {
      console.log(`[BotManager] Auto-saved ${this.currentSessions.size} active sessions`);
    }
  }

  /** Add a log entry */
  /** Add a log entry for a bot (public for external use like settlement events) */
  addLog(botId: string, type: BotLog["type"], message: string, details?: Record<string, unknown>): void {
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
      // === PRIMARY BOTS - These are the winners based on research ===
      // maxBet is a PERCENTAGE of bankroll (e.g., 0.20 = 20% max)
      // kellyFraction reduced to ~0.35 (quarter-Kelly approach for stability)
      { id: "bot-window-delta", name: "Window Delta", strategy: "window_delta", interval: 2000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-sniper", name: "T-10 Sniper", strategy: "last_seconds_scalp", interval: 300, betSize: 1.0, maxBet: 0.15, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-oracle-lag", name: "Oracle Lag", strategy: "binance_signal", interval: 1000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-monte-carlo", name: "Monte Carlo", strategy: "monte_carlo", interval: 5000, betSize: 0.5, maxBet: 0.12, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-fair-value", name: "Fair Value Arb", strategy: "fair_value", interval: 3000, betSize: 0.75, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },

      // === SECONDARY BOTS - Complementary strategies ===
      { id: "bot-momentum", name: "BTC Momentum", strategy: "momentum", interval: 4000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-smart-trend", name: "Smart Trend", strategy: "smart_trend", interval: 8000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-contrarian", name: "Contrarian", strategy: "contrarian", interval: 6000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-arbitrage", name: "Arbitrage", strategy: "arbitrage", interval: 5000, betSize: 0.75, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      // grid_trading, market_making, random removed from defaults — not profitable on 5m
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
        kellyFraction: cfg.kellyFraction ?? 0.25,
        maxBet: cfg.maxBet ?? 0.25, // Percentage of bankroll (default 25%)
        stopLoss: 0.1,
        takeProfit: 0.2,
        maxPositions: 999, // No practical limit - let strategies trade freely
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

    // Get fresh bot state after startBot/stopBot modified it
    const updatedBot = this.bots.get(id);
    if (!updatedBot) return null;

    console.log(`[BotManager] Bot ${id} toggled to ${newEnabled ? 'enabled' : 'disabled'}, runTime: ${updatedBot.runTime}`);

    return { ...updatedBot, portfolio: marketEngine.getBotPortfolio(id) };
  }

  private startBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) return;

    // Clear existing interval
    this.stopBot(id);

    // Apply optimized parameters if available
    const optimizedParams = parameterOptimizer.getOptimizedParameters(
      bot.strategy,
      {
        betSize: bot.betSize,
        interval: bot.interval,
        kellyFraction: bot.kellyFraction,
        maxBet: bot.maxBet,
        stopLoss: bot.stopLoss,
        takeProfit: bot.takeProfit,
      }
    );

    // Update bot with optimized parameters (with small randomization for exploration)
    if (bot.useKelly || bot.useKelly === undefined) {
      bot.betSize = optimizedParams.betSize;
      bot.interval = Math.round(optimizedParams.interval);
      bot.kellyFraction = optimizedParams.kellyFraction;
      bot.maxBet = optimizedParams.maxBet;
    }

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

      // Record performance for parameter optimization
      if (bot && portfolio.totalTrades >= 5) {
        parameterOptimizer.recordPerformance(
          bot.strategy,
          id,
          {
            betSize: bot.betSize,
            interval: bot.interval,
            kellyFraction: bot.kellyFraction,
            maxBet: bot.maxBet,
            stopLoss: bot.stopLoss,
            takeProfit: bot.takeProfit,
          },
          {
            trades: portfolio.totalTrades,
            wins: portfolio.winningTrades,
            pnl: portfolio.totalPnL,
            sharpeRatio: portfolio.sharpeRatio,
            maxDrawdown: portfolio.maxDrawdown,
          }
        );
      }
    }

    // Only clear runTime - do NOT clear enabled flag as it may be set by caller
    const bot = this.bots.get(id);
    if (bot) {
      bot.runTime = 0;
      this.bots.set(id, bot);
    }
  }

  private saveBotSessionToDB(session: BotSession, _bot?: BotConfig | null): void {
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

  private async executeBotStrategy(id: string): Promise<void> {
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
    const btcHistory = priceService.getPriceHistory(200);
    const btcPriceHistory = btcHistory.slice(-20).map(p => p.price);
    const btcPriceChange = btcHistory.length >= 2
      ? (btcPrice - btcHistory[0].price) / btcHistory[0].price
      : 0;

    // Calculate BTC window open price - the BTC price when the market window opened
    let btcWindowOpen = btcPrice; // default: current price
    if (btcHistory.length > 0 && market.startTime) {
      // Find the BTC price closest to the market start time
      const windowOpenTime = market.startTime;
      const closest = btcHistory.reduce((prev, curr) =>
        Math.abs(curr.timestamp - windowOpenTime) < Math.abs(prev.timestamp - windowOpenTime)
        ? curr : prev
      );
      btcWindowOpen = closest.price;
    }

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
      btcWindowOpen,
      btcPriceHistory,
    };

    // Execute strategy with error handling to prevent silent failures
    let decision: { action: import("../types").Outcome | null; confidence: number; reason?: string };
    try {
      decision = strategy.execute(context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addLog(id, "ERROR", `Strategy execution failed: ${errorMessage}`, {
        strategy: bot.strategy,
        error: errorMessage,
      });
      console.error(`[BotManager] Strategy error for ${bot.name}:`, error);
      return;
    }

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

    // At this point, decision.action is guaranteed to be non-null
    const action = decision.action;

    // Check if bot already has an open position on this market - one position per market
    const existingPositions = marketEngine.getOpenPositions(id);
    const hasPositionOnMarket = existingPositions.some(p => p.marketId === market.id);
    if (hasPositionOnMarket) {
      // Already have a position on this market, skip
      return;
    }

    // Log the decision to trade
    this.addLog(id, "DECISION", `Trade decision: ${action} - ${decision.reason}`, {
      action: action,
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
        : (action === "YES" ? 1 - yesPrice : 1 - noPrice);

      // Net odds: amount won per unit bet
      // If YES at 0.60, you pay 0.60 to win 1.00, so net odds = (1-0.60)/0.60 = 0.67
      // If NO at 0.40, you pay 0.40 to win 1.00, so net odds = (1-0.40)/0.40 = 1.5
      const price = action === "YES" ? yesPrice : noPrice;
      const netOdds = (1 - price) / price;

      // Kelly formula: f* = (p*b - q) / b
      // where p = winProbability, q = 1 - p, b = netOdds
      const q = 1 - winProbability;
      const kellyFraction = (winProbability * netOdds - q) / netOdds;

      // Apply half-Kelly (more conservative) and user's kelly fraction
      const halfKelly = Math.max(0, kellyFraction * 0.5 * (bot.kellyFraction || 0.5));

      // Calculate bet size
      const kellyBet = portfolio.balance * halfKelly;

      // maxBet is now a PERCENTAGE of bankroll (e.g., 0.25 = 25% max)
      const maxBetPercent = bot.maxBet || 0.25; // Default 25% of bankroll
      const maxBetAmount = portfolio.balance * maxBetPercent;

      // Cap at maxBet percentage of bankroll
      betSize = Math.min(kellyBet, maxBetAmount);
      betSize = Math.max(1, betSize); // Minimum $1 bet

      // Log Kelly calculation for transparency
      if (kellyBet > 0) {
        console.log(`[BotManager] Kelly: ${bot.name} | WinProb: ${(winProbability * 100).toFixed(1)}% | Odds: ${netOdds.toFixed(2)} | Fraction: ${(halfKelly * 100).toFixed(1)}% | Balance: $${portfolio.balance.toFixed(2)} | MaxBet: $${maxBetAmount.toFixed(2)} | Bet: $${betSize.toFixed(2)}`);
      }
    } else {
      // No Kelly - use percentage-based bet sizing
      const portfolio = marketEngine.getBotPortfolio(id);
      const maxBetPercent = bot.maxBet || 0.25;
      const maxBetAmount = portfolio.balance * maxBetPercent;
      betSize = Math.min(bot.betSize, maxBetAmount);
      betSize = Math.max(1, betSize);
    }

    // Adjust bet size based on confidence
    betSize = betSize * (0.5 + decision.confidence * 0.5);
    betSize = Math.max(1, betSize); // Minimum $1 bet (after confidence adjustment)

    const portfolio = marketEngine.getBotPortfolio(id);

    // Risk check: Can open position?
    const riskCheck = riskManager.canOpenPosition(id, betSize, decision.confidence);
    if (!riskCheck.allowed) {
      this.addLog(id, "RISK", `Trade blocked: ${riskCheck.reason}`, {
        betSize,
        confidence: decision.confidence,
      });
      return;
    }

    // Coordinator check: Prevent conflicting trades between bots
    const totalBalance = Array.from(this.bots.values())
      .reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
    const coordination = strategyCoordinator.registerDecision(
      market.id,
      {
        botId: id,
        botName: bot.name,
        strategy: bot.strategy,
        action: action,
        confidence: decision.confidence,
        betSize,
      },
      totalBalance
    );

    if (!coordination.allowed) {
      this.addLog(id, "COORD", `Trade blocked by coordinator: ${coordination.reason}`, {
        action: action,
        betSize,
        reason: coordination.reason,
      });
      return;
    }

    // Log coordinator warnings
    if (coordination.warnings && coordination.warnings.length > 0) {
      this.addLog(id, "COORD", `Warnings: ${coordination.warnings.join("; ")}`, {
        warnings: coordination.warnings,
      });
    }

    // Use adjusted bet size if coordinator reduced it
    const finalBetSize = coordination.adjustedBetSize ?? betSize;
    const adjustedFee = finalBetSize * 0.02;

    if (portfolio.balance < finalBetSize + adjustedFee) {
      strategyCoordinator.cancelDecision(market.id, id);
      this.addLog(id, "ERROR", `Insufficient balance for trade - Required: $${(finalBetSize + adjustedFee).toFixed(2)}, Available: $${portfolio.balance.toFixed(2)}`);
      return;
    }

    // Execute trade based on trading mode
    if (this.tradingMode === "live") {
      // LIVE MODE: Place real order on Polymarket
      await this.executeLiveTrade(id, market, action, decision.confidence, finalBetSize);
    } else {
      // DEMO MODE: Use simulated market engine
      const position = marketEngine.placeTrade(action, finalBetSize, id);
      if (position) {
        // Confirm execution with coordinator
        strategyCoordinator.confirmExecution(market.id, id, action, finalBetSize);

        // Get market price for display (without slippage)
        const marketPrice = action === "YES"
          ? parseFloat(market.outcomePrices?.yes || "0.5")
          : parseFloat(market.outcomePrices?.no || "0.5");

        this.addLog(id, "TRADE", `Bought ${action} $${finalBetSize.toFixed(2)} @ ${(marketPrice * 100).toFixed(1)}¢`, {
          action: action,
          amount: finalBetSize,
          marketPrice,
          fillPrice: position.odds,
          slippage: position.odds - marketPrice,
          fee: position.fee,
          positionId: position.id,
          confidence: decision.confidence,
          balanceAfter: portfolio.balance - finalBetSize - adjustedFee,
          openPositions: portfolio.openPositions.length + 1,
          kellyUsed: bot.useKelly,
          strategy: bot.strategy,
          coordinatorAdjusted: coordination.adjustedBetSize !== undefined,
          mode: "demo",
        });
        // Broadcast updated bots to all SSE clients
        broadcastToSSE("bots", this.getBots());
      } else {
        // Trade failed, cancel with coordinator
        strategyCoordinator.cancelDecision(market.id, id);
      }
    }
  }

  /** Execute a live trade on Polymarket */
  private async executeLiveTrade(
    botId: string,
    market: { id: string; tokens?: { token_id: string; outcome: string }[]; outcomePrices?: { yes: string; no: string } },
    action: Outcome,
    confidence: number,
    betSize: number
  ): Promise<void> {
    try {
      // Get token ID for the outcome
      let tokenId: string | undefined;
      if (market.tokens && market.tokens.length > 0) {
        const token = market.tokens.find(t =>
          (action === "YES" && (t.outcome.toLowerCase() === "yes" || t.outcome.toLowerCase().includes("up"))) ||
          (action === "NO" && (t.outcome.toLowerCase() === "no" || t.outcome.toLowerCase().includes("down")))
        );
        tokenId = token?.token_id;
      }

      if (!tokenId) {
        this.addLog(botId, "ERROR", `Cannot find token for ${action} outcome in live mode`, {
          action: action,
          marketId: market.id,
        });
        return;
      }

      // Get current price
      const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
      const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
      const price = action === "YES" ? yesPrice : noPrice;

      // Calculate size (number of shares)
      const size = betSize / price;

      this.addLog(botId, "TRADE", `LIVE: Placing ${action} order for $${betSize.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`, {
        action: action,
        amount: betSize,
        price,
        size,
        tokenId,
        mode: "live",
      });

      // Place order on Polymarket
      const result = await polymarketProvider.placeOrder({
        tokenId,
        side: "BUY",
        price,
        size,
      });

      if (result.success) {
        this.addLog(botId, "TRADE", `✅ LIVE order placed: ${action} $${betSize.toFixed(2)} @ ${(price * 100).toFixed(1)}¢`, {
          orderId: result.orderId,
          action: action,
          amount: betSize,
          price,
          size,
          mode: "live",
        });
      } else {
        this.addLog(botId, "ERROR", `❌ LIVE order failed: ${result.error}`, {
          error: result.error,
          action: action,
          amount: betSize,
          mode: "live",
        });
      }
    } catch (error) {
      this.addLog(botId, "ERROR", `LIVE trade exception: ${error instanceof Error ? error.message : "Unknown error"}`, {
        error: error instanceof Error ? error.message : "Unknown",
        mode: "live",
      });
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

  resetBot(id: string): BotConfig | null {
    const bot = this.bots.get(id);
    if (!bot) return null;

    // Stop the bot if running
    if (bot.enabled) {
      this.stopBot(id);
    }

    // Clear all positions for this bot from market engine
    marketEngine.clearBotPositions(id);

    // Reset the ACTUAL portfolio in marketEngine (source of truth)
    const portfolio = marketEngine.initBotPortfolio(id, 10);

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

    // Clear session
    this.currentSessions.delete(id);

    // Reset runTime
    bot.runTime = 0;

    // Update bot with fresh portfolio reference
    bot.portfolio = portfolio;

    // Save updated bot to map
    this.bots.set(id, bot);

    return bot;
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
    // KRITIKUS: Demo módban csak szimulált kereskedés engedélyezett
    if (this.tradingMode === "live") {
      console.error("[BotManager] ERROR: Cannot start competition in live mode! Switching to demo mode.");
      this.tradingMode = "demo";
      this.addLog("system", "RISK", "Competition automatically switched to demo mode (live mode not allowed)");
    }

    // Stop any existing competition
    if (this.competition.active) {
      this.stopCompetition();
    }

    const minTrades = config?.minTrades ?? 50;
    const startBalance = config?.startBalance ?? 10;

    // Reset all bots to equal starting conditions
    this.stopAllBots();

    console.log(`[BotManager] Starting competition with ${this.bots.size} bots`);

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
      console.log(`[BotManager] Starting bot: ${bot.name} (${id})`);
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

    // Mark as inactive FIRST to prevent recursion from updateLeaderboard
    this.competition.active = false;

    // Stop all bots
    this.stopAllBots();

    // Calculate final leaderboard
    this.updateLeaderboard();

    // Determine winner (highest P&L with min trades)
    const qualified = this.competition.leaderboard.filter(b => b.trades >= this.competition.minTrades);
    if (qualified.length > 0) {
      this.competition.winner = qualified[0].botId;
    }

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

  clearCompetition(): CompetitionState {
    // Reset competition to initial state
    this.competition = {
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
    return this.getCompetitionState();
  }

  // === Trading Mode Management ===

  /** Get current trading mode */
  getTradingMode(): TradingMode {
    return this.tradingMode;
  }

  /** Set trading mode */
  setTradingMode(mode: TradingMode): void {
    const previousMode = this.tradingMode;
    this.tradingMode = mode;

    console.log(`[BotManager] Trading mode changed: ${previousMode} -> ${mode}`);

    // Log mode change for all running bots
    if (previousMode !== mode) {
      for (const [id, bot] of this.bots) {
        if (bot.enabled) {
          this.addLog(id, "DECISION", `Trading mode changed to ${mode.toUpperCase()}`, { mode });
        }
      }
    }
  }

  /** Check if in live mode */
  isLiveMode(): boolean {
    return this.tradingMode === "live";
  }

  /** Check if live trading is possible (has credentials and balance) */
  canTradeLive(): { allowed: boolean; reason?: string } {
    if (this.tradingMode !== "live") {
      return { allowed: false, reason: "Not in live mode" };
    }

    // Check if we have API credentials
    if (!polymarketProvider.hasCredentials()) {
      return { allowed: false, reason: "Missing Polymarket API credentials" };
    }

    // The actual balance check should be done via API before trading
    // For now, we return allowed but warn about balance
    return { allowed: true };
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
    // Save all active sessions before shutdown
    this.saveAllActiveSessions();

    // Clear auto-save interval
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.stopAllBots();
    this.intervals.clear();
  }

  /** Force save all sessions immediately (call on shutdown) */
  forceSaveAll(): void {
    this.saveAllActiveSessions();
  }
}

// Singleton instance
export const botManager = new BotManager();
