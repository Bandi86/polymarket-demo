// Unified Bot Manager - Manages trading bots with various strategies
// Implements isolated portfolios and session tracking

import type {
  BotConfig,
  BotSession,
  StrategyType,
  Outcome,
  TradingMode,
  Market,
  RiskMetrics,
} from "../types";
import { marketEngine } from "./market-engine";
import { dbService } from "./database";
import { generateId, clamp } from "./utils";
import { riskManager, RiskMetricsCalculator } from "./risk-manager";
import { strategyCoordinator } from "./strategy-coordinator";
import { parameterOptimizer } from "./parameter-optimizer";
import { polymarketProvider } from "./providers/polymarket-provider";
import { liveModeManager } from "./live-mode-manager";
import { broadcastToSSE } from "./global";
import { strategies } from "./strategies";
import { strategyConfig } from "./strategies/config";
import {
  BotLogger,
  type BotLog,
  CompetitionManager,
  type CompetitionState,
  buildStrategyContext,
  calculateBetSize,
  executeLiveTrade as executeLiveTradeFn,
  botEventBus,
  buildDecisionContext,
  calculate7FactorConfidence,
  checkStrategyOdds,
} from "./bot-manager/index";

// Re-export TradingMode type for backward compatibility
export type { TradingMode } from "../types";
export type { BotLog, CompetitionState };

// === Bot Manager ===

export interface BotManagerConfig {
  maxBots?: number;
  defaultInterval?: number;
}

export class BotManager {
  private bots: Map<string, BotConfig> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private sessions: BotSession[] = [];
  private currentSessions: Map<string, BotSession> = new Map();
  private config: Required<BotManagerConfig>;
  private logger: BotLogger;
  private competitionManager: CompetitionManager;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private metricsCalculators: Map<string, RiskMetricsCalculator> = new Map();

  // Trading mode: demo (simulated) or live (real Polymarket trades)
  private tradingMode: TradingMode = "demo";

  constructor(config: BotManagerConfig = {}) {
    this.config = {
      maxBots: config.maxBots ?? 20,
      defaultInterval: config.defaultInterval ?? 5000,
    };
    this.logger = new BotLogger();
    this.competitionManager = new CompetitionManager((botId, type, message, details) => {
      this.addLog(botId, type, message, details);
    });

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

  /** Add a log entry for a bot (public for external use like settlement events) */
  addLog(botId: string, type: BotLog["type"], message: string, details?: Record<string, unknown>): void {
    const bot = this.bots.get(botId);
    if (!bot) return;
    this.logger.addLog(botId, bot.name, type, message, details);
  }

  /** Subscribe to log updates */
  onLog(callback: (log: BotLog) => void): () => void {
    return this.logger.addListener(callback);
  }

  /** Get all logs */
  getLogs(limit = 50): BotLog[] {
    return this.logger.getLogs(limit);
  }

  /** Clear logs */
  clearLogs(): void {
    this.logger.clear();
  }

  /** Record settlement result for metrics tracking */
  recordSettlement(botId: string, won: boolean, pnl: number): void {
    const metricsCalc = this.metricsCalculators.get(botId);
    if (metricsCalc) {
      metricsCalc.recordTradePnl(pnl);
      metricsCalc.recordTradeResult(won);
      console.log(`[BotManager] Recorded settlement for ${botId}: ${won ? 'WIN' : 'LOSS'} PnL=$${pnl.toFixed(2)}`);
    }
  }

  private initDefaultBots(): void {
    const defaultConfigs: Array<Partial<BotConfig> & { id: string; name: string; strategy: StrategyType }> = [
      // === PRIMARY BOTS - These are the winners based on research ===
      // maxBet is a PERCENTAGE of bankroll (e.g., 0.20 = 20% max)
      // kellyFraction reduced to ~0.35 (quarter-Kelly approach for stability)
      { id: "bot-window-delta", name: "Window Delta", strategy: "window_delta", interval: 2000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-sniper", name: "T-10 Sniper", strategy: "last_seconds_scalp", interval: 500, betSize: 1.0, maxBet: 0.15, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-oracle-lag", name: "Oracle Lag", strategy: "binance_signal", interval: 1000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-monte-carlo", name: "Monte Carlo", strategy: "monte_carlo", interval: 5000, betSize: 0.5, maxBet: 0.12, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-fair-value", name: "Fair Value Arb", strategy: "fair_value", interval: 3000, betSize: 0.75, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },

      // === SECONDARY BOTS - Complementary strategies ===
      { id: "bot-momentum", name: "BTC Momentum", strategy: "momentum", interval: 4000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-smart-trend", name: "Smart Trend", strategy: "smart_trend", interval: 8000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-contrarian", name: "Contrarian", strategy: "contrarian", interval: 6000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-arbitrage", name: "Arbitrage", strategy: "arbitrage", interval: 5000, betSize: 0.75, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
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

    // Initialize metrics calculator for this session
    this.metricsCalculators.set(id, new RiskMetricsCalculator());

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

    // Clean up metrics calculator
    this.metricsCalculators.delete(id);

    // Only clear runTime - do NOT clear enabled flag as it may be set by caller
    const bot = this.bots.get(id);
    if (bot) {
      bot.runTime = 0;
      this.bots.set(id, bot);
    }
  }

  private saveBotSessionToDB(session: BotSession, bot?: BotConfig | null): void {
    // Get risk metrics
    const metricsCalc = this.metricsCalculators.get(session.botId);
    const metrics: RiskMetrics = metricsCalc ? metricsCalc.getMetrics() : {
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
    };

    // Get strategy config
    const strategyConf: Record<string, unknown> = bot ? { ...strategyConfig[bot.strategy] } : {};

    // Get bot config
    const botConf = bot ? {
      betSize: bot.betSize,
      maxBet: bot.maxBet,
      useKelly: bot.useKelly,
      kellyFraction: bot.kellyFraction,
      interval: bot.interval,
    } : {};

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
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      strategyConfig: strategyConf,
      botConfig: botConf,
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

    // Build context using extracted function - include BTC start price for delta calculation
    const btcStartPrice = marketEngine.getMarketStartBtcPrice();
    const context = buildStrategyContext({
      id: market.id,
      startTime: market.startTime,
      endTime: market.endTime,
      startPrice: market.startPrice,
      outcomePrices: market.outcomePrices,
      yesPriceHistory: market.yesPriceHistory,
      tokens: market.tokens,
      status: market.status,
      btcStartPrice: btcStartPrice ?? undefined,
    });

    // Execute strategy with error handling to prevent silent failures
    let decision: { action: Outcome | null; confidence: number; reason?: string };
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
          currentPrice: context.currentPrice,
          timeRemaining: context.timeRemaining,
          confidence: decision.confidence,
        });
      }
      return;
    }

    // At this point, decision.action is guaranteed to be non-null
    const action = decision.action;
    const yesPrice = context.marketPrice.yesPrice;
    const noPrice = context.marketPrice.noPrice;

    // Check if bot already has an open position on this market - one position per market
    const existingPositions = marketEngine.getOpenPositions(id);
    const hasPositionOnMarket = existingPositions.some(p => p.marketId === market.id);
    if (hasPositionOnMarket) {
      return;
    }

    // CRITICAL: Check odds range - avoid 40-60¢ loss zone
    const oddsCheck = checkStrategyOdds(action, yesPrice, noPrice, bot.strategy);
    if (!oddsCheck.valid) {
      this.addLog(id, "ODDS", `Odds blocked: ${oddsCheck.reason}`, {
        action,
        odds: oddsCheck.odds,
        yesPrice,
        noPrice,
        reason: oddsCheck.reason,
      });
      return;
    }

    // Calculate 7-factor confidence for enhanced scoring
    const confidenceResult = calculate7FactorConfidence(context, action, { ...strategyConfig[bot.strategy] });
    const enhancedConfidence = (decision.confidence + confidenceResult.score) / 2;

    // Log the decision to trade
    this.addLog(id, "DECISION", `Trade decision: ${action} - ${decision.reason}`, {
      action,
      confidence: decision.confidence,
      enhancedConfidence,
      factors: confidenceResult.factors,
      reason: decision.reason,
      yesPrice,
      noPrice,
      odds: oddsCheck.odds,
      timeRemaining: context.timeRemaining,
      volatility: context.volatility.toFixed(4),
      momentum: context.momentum.toFixed(4),
      btcPriceChange: ((context.btcPriceChange ?? 0) * 100).toFixed(3) + '%',
    });

    // Calculate bet size using extracted function
    const portfolio = marketEngine.getBotPortfolio(id);
    let betSize = calculateBetSize(bot, action, yesPrice, noPrice, portfolio.balance);

    // Adjust bet size based on ENHANCED confidence (not original)
    betSize = betSize * (0.5 + enhancedConfidence * 0.5);
    betSize = Math.max(1, betSize); // Minimum $1 bet

    // Risk check: Can open position?
    const riskCheck = riskManager.canOpenPosition(id, betSize, enhancedConfidence);
    if (!riskCheck.allowed) {
      this.addLog(id, "RISK", `Trade blocked: ${riskCheck.reason}`, {
        betSize,
        confidence: decision.confidence,
      });
      return;
    }

    // Live mode specific checks
    if (this.tradingMode === "live") {
      const liveCheck = liveModeManager.canBotTrade(id, bot);
      if (!liveCheck.allowed) {
        this.addLog(id, "LIVE_RISK", `Live trade blocked: ${liveCheck.reason}`, {
          betSize,
          confidence: decision.confidence,
          reason: liveCheck.reason,
        });
        return;
      }

      // Adjust bet size based on live mode constraints
      const liveBetSize = liveModeManager.calculateLiveBetSize(id, decision.confidence);
      if (liveBetSize < betSize) {
        betSize = liveBetSize;
        this.addLog(id, "LIVE_RISK", `Bet size reduced to $${betSize.toFixed(2)} for live mode`, {
          originalBetSize: betSize,
          adjustedBetSize: liveBetSize,
        });
      }
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
        // Record balance for drawdown tracking
        const metricsCalc = this.metricsCalculators.get(id);
        if (metricsCalc) {
          const newBalance = portfolio.balance - finalBetSize - adjustedFee;
          metricsCalc.recordBalance(newBalance);
        }

        // Build and save decision context
        const decisionContext = buildDecisionContext(
          bot,
          context,
          { action, confidence: decision.confidence, reason: decision.reason },
          betSize,
          finalBetSize,
          riskCheck
        );

        // Ensure market exists in DB before saving position (required for foreign key constraint)
        dbService.saveMarket({
          id: market.id,
          question: market.question || "BTC Prediction Market",
          description: market.description || "",
          startTime: market.startTime,
          endTime: market.endTime,
          startPrice: market.startPrice || 0.5,
          endPrice: null,
          status: "active",
          result: null,
          outcomeYes: parseFloat(market.outcomePrices?.yes || "0.5"),
          outcomeNo: parseFloat(market.outcomePrices?.no || "0.5"),
          volume: 0,
          liquidity: 0,
          category: "Crypto",
        }).catch(e => console.error("[BotManager] DB market save error:", e));

        // Save position with decision context to DB
        dbService.savePosition({
          id: position.id,
          marketId: market.id,
          outcome: position.outcome,
          amount: position.amount,
          odds: position.odds,
          stake: position.stake,
          fee: position.fee,
          timestamp: position.timestamp,
          status: "open",
          pnl: null,
          botId: id,
          botName: bot.name,
          decisionContext: decisionContext as unknown as Record<string, unknown>,
          btcPrice: context.btcPrice,
          timeRemaining: context.timeRemaining,
        }).catch(e => console.error("[BotManager] DB save error:", e));

        // Confirm execution with coordinator
        strategyCoordinator.confirmExecution(market.id, id, action, finalBetSize);

        // Emit position opened event
        botEventBus.emitPositionOpened({
          botId: id,
          positionId: position.id,
          marketId: market.id,
          outcome: action,
          amount: finalBetSize,
          entryPrice: position.odds,
        });

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
    market: Market,
    action: Outcome,
    _confidence: number, // Reserved for future use (Kelly sizing in live mode)
    betSize: number
  ): Promise<void> {
    await executeLiveTradeFn(botId, market, action, betSize, (type, message, details) => {
      this.addLog(botId, type as BotLog["type"], message, details);

      // Record trade in live mode manager if it was a successful trade
      if (type === "TRADE" && details) {
        liveModeManager.recordLiveTrade(botId, {
          outcome: action,
          amount: betSize,
          price: (details.fillPrice as number) || 0.5,
          marketId: market.id,
        });
      }
    });
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

    return this.competitionManager.start(
      this.bots,
      config,
      (id) => this.startBot(id),
      () => this.stopAllBots()
    );
  }

  stopCompetition(): CompetitionState {
    return this.competitionManager.stop(
      this.bots,
      () => this.stopAllBots()
    );
  }

  getCompetitionState(): CompetitionState {
    return this.competitionManager.getState();
  }

  clearCompetition(): CompetitionState {
    return this.competitionManager.clear();
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
