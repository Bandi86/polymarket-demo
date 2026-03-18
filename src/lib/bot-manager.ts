// Unified Bot Manager - Manages trading bots with various strategies
// Implements isolated portfolios and session tracking

import type {
  BotConfig,
  BotSession,
  StrategyType,
  StrategyContext,
  Strategy,
  Outcome,
} from "../types";
import { marketEngine } from "./market-engine";
import { dbService } from "./database";
import { generateId, clamp } from "./utils";
import { binanceKlineProvider } from "./providers/binance-kline-provider";
import { priceService } from "./price";
import { riskManager } from "./risk-manager";
import { strategyCoordinator } from "./strategy-coordinator";
import { parameterOptimizer } from "./parameter-optimizer";

// === Strategy Implementations ===

const strategies: Record<StrategyType, Strategy> = {
  // === SPECTRUM POSITION 1: AGGRESSIVE - Always trades ===
  momentum_chaser: {
    name: "BTC Pure",
    description: "Follows BTC direction - only trades when market price is attractive",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange, marketPrice } = ctx;

      // Don't trade in last 30 seconds
      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Need BTC price data
      if (btcPriceChange === undefined || btcPriceChange === null) {
        return { action: null, confidence: 0, reason: "No BTC price data" };
      }

      // Minimum BTC movement threshold (0.01% = 0.0001)
      const delta = btcPriceChange;
      if (Math.abs(delta) < 0.0001) {
        return { action: null, confidence: 0, reason: `BTC movement too small (${(delta * 100).toFixed(4)}%)` };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Max buy price to ensure profitable trades after fees (80¢)
      const MAX_BUY_PRICE = 0.80;

      // Determine direction based on BTC delta
      // Only trade if the price is attractive (not too expensive)
      if (delta >= 0) {
        // BTC going UP - buy YES if it's cheap enough
        if (yesPrice <= MAX_BUY_PRICE) {
          const confidence = Math.min(0.75, 0.55 + Math.abs(delta) * 50);
          return {
            action: "YES",
            confidence,
            reason: `BTC Pure: BTC +${(delta * 100).toFixed(3)}% → YES at ${(yesPrice * 100).toFixed(0)}¢`,
          };
        } else {
          return { action: null, confidence: 0, reason: `BTC Pure: BTC up but YES too expensive (${(yesPrice * 100).toFixed(0)}¢)` };
        }
      } else {
        // BTC going DOWN - buy NO if it's cheap enough
        if (noPrice <= MAX_BUY_PRICE) {
          const confidence = Math.min(0.75, 0.55 + Math.abs(delta) * 50);
          return {
            action: "NO",
            confidence,
            reason: `BTC Pure: BTC -${(Math.abs(delta) * 100).toFixed(3)}% → NO at ${(noPrice * 100).toFixed(0)}¢`,
          };
        } else {
          return { action: null, confidence: 0, reason: `BTC Pure: BTC down but NO too expensive (${(noPrice * 100).toFixed(0)}¢)` };
        }
      }
    },
  },

  // === SPECTRUM POSITION 2: AGGRESSIVE - Late entry always trades ===
  mean_reversion_sniper: {
    name: "Quick Strike",
    description: "Late entry (T-90s to T-20s) - follows market consensus with good odds",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPriceChange } = ctx;

      // Only trade in the 20-90 second window
      if (timeRemaining > 90000 || timeRemaining < 20000) {
        return { action: null, confidence: 0, reason: "Not in entry window (20-90s)" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Never buy at extreme prices - fees make it -EV
      // Max buy price = 0.80 (80¢) to ensure profitable trades after fees
      const MAX_BUY_PRICE = 0.80;

      // If market has clear direction, follow it - but only at good prices
      if (yesPrice > noPrice + 0.02 && yesPrice <= MAX_BUY_PRICE) {
        return {
          action: "YES",
          confidence: 0.60,
          reason: `Quick Strike: Market bullish ${(yesPrice * 100).toFixed(0)}¢ → YES`,
        };
      }

      if (noPrice > yesPrice + 0.02 && noPrice <= MAX_BUY_PRICE) {
        return {
          action: "NO",
          confidence: 0.60,
          reason: `Quick Strike: Market bearish ${(noPrice * 100).toFixed(0)}¢ → NO`,
        };
      }

      // Market direction clear but price too extreme
      if (yesPrice > MAX_BUY_PRICE || noPrice > MAX_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `Price too extreme (>${(MAX_BUY_PRICE * 100).toFixed(0)}¢) - fees make it -EV` };
      }

      // Market is undecided (50-50), use BTC direction
      const btcDelta = btcPriceChange || 0;
      const action: Outcome = btcDelta >= 0 ? "YES" : "NO";

      return {
        action,
        confidence: 0.55,
        reason: `Quick Strike: Market undecided, BTC ${btcDelta >= 0 ? "+" : ""}${(btcDelta * 100).toFixed(3)}% → ${action}`,
      };
    },
  },

  // === SPECTRUM POSITION 3: BALANCED - Trades on alignment or strong contradiction ===
  sum_to_one_arb: {
    name: "Balanced Signal",
    description: "Trades when BTC and market align OR when BTC strongly contradicts market",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPriceChange } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const btcDelta = btcPriceChange || 0;

      // Determine market direction
      const marketExpectsUp = yesPrice > 0.55;
      const marketExpectsDown = noPrice > 0.55;

      // Need market to have an opinion
      if (!marketExpectsUp && !marketExpectsDown) {
        return { action: null, confidence: 0, reason: `Market undecided: YES ${(yesPrice * 100).toFixed(0)}¢` };
      }

      // BTC direction thresholds
      const btcUp = btcDelta > 0.0003;      // BTC up > 0.03%
      const btcDown = btcDelta < -0.0003;   // BTC down > 0.03%
      const btcStrongUp = btcDelta > 0.001; // BTC up > 0.1%
      const btcStrongDown = btcDelta < -0.001; // BTC down > 0.1%

      // Case 1: Market UP + BTC UP = Strong YES signal
      if (marketExpectsUp && btcUp) {
        return {
          action: "YES",
          confidence: 0.70,
          reason: `Balanced: Market & BTC both UP → YES`,
        };
      }

      // Case 2: Market DOWN + BTC DOWN = Strong NO signal
      if (marketExpectsDown && btcDown) {
        return {
          action: "NO",
          confidence: 0.70,
          reason: `Balanced: Market & BTC both DOWN → NO`,
        };
      }

      // Case 3: Market UP + BTC STRONGLY DOWN = Fade market, buy NO
      if (marketExpectsUp && btcStrongDown) {
        return {
          action: "NO",
          confidence: 0.65,
          reason: `Balanced: Fade UP market, BTC down ${(btcDelta * 100).toFixed(2)}%`,
        };
      }

      // Case 4: Market DOWN + BTC STRONGLY UP = Fade market, buy YES
      if (marketExpectsDown && btcStrongUp) {
        return {
          action: "YES",
          confidence: 0.65,
          reason: `Balanced: Fade DOWN market, BTC up +${(btcDelta * 100).toFixed(2)}%`,
        };
      }

      // Case 5: Weak contradiction - no trade
      return {
        action: null,
        confidence: 0,
        reason: `Balanced: BTC/Market contradiction too weak`,
      };
    },
  },

  // === SPECTRUM POSITION 4: BALANCED - Fades extreme prices ===
  whale_follower: {
    name: "Contrarian Lite",
    description: "Fades extreme prices (>75%) when BTC contradicts market direction",
    category: "mean_reversion",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPriceChange } = ctx;

      if (timeRemaining < 45000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const btcDelta = btcPriceChange || 0;

      // Extreme prices: market is confident
      const extremeUp = yesPrice > 0.75;   // Market expects UP
      const extremeDown = noPrice > 0.75;  // Market expects DOWN

      if (!extremeUp && !extremeDown) {
        return { action: null, confidence: 0, reason: `No extreme price (need >75%)` };
      }

      // BTC moving significantly (>0.03%)
      const btcUp = btcDelta > 0.0003;
      const btcDown = btcDelta < -0.0003;

      // Fade UP spike when BTC is going DOWN
      if (extremeUp && btcDown) {
        const confidence = Math.min(0.80, 0.60 + Math.abs(btcDelta) * 100);
        return {
          action: "NO",
          confidence,
          reason: `Contrarian: Fade UP spike, BTC down ${(btcDelta * 100).toFixed(2)}%`,
        };
      }

      // Fade DOWN spike when BTC is going UP
      if (extremeDown && btcUp) {
        const confidence = Math.min(0.80, 0.60 + Math.abs(btcDelta) * 100);
        return {
          action: "YES",
          confidence,
          reason: `Contrarian: Fade DOWN spike, BTC up +${(btcDelta * 100).toFixed(2)}%`,
        };
      }

      // Spike confirmed by BTC - no fade
      return { action: null, confidence: 0, reason: `Spike confirmed by BTC - no fade` };
    },
  },

  // === SPECTRUM POSITION 5: SELECTIVE - Strong signals only ===
  ta_signal_engine: {
    name: "High Conviction",
    description: "Only trades on strong signals with good risk/reward",
    category: "technical",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPriceChange } = ctx;

      // Only trade in 60-240s window
      if (timeRemaining > 240000 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Not in entry window (60-240s)" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const btcDelta = btcPriceChange || 0;

      // Max buy price for good risk/reward
      const MAX_BUY_PRICE = 0.70;

      // Strong BTC move threshold
      const strongBtcUp = btcDelta > 0.0008;   // > 0.08%
      const strongBtcDown = btcDelta < -0.0008;

      // Setup 1: Strong BTC + market alignment (but price must be good)
      if (strongBtcUp && yesPrice > 0.55 && yesPrice <= MAX_BUY_PRICE) {
        return {
          action: "YES",
          confidence: 0.72,
          reason: `High Conviction: BTC +${(btcDelta * 100).toFixed(2)}% + YES at ${(yesPrice * 100).toFixed(0)}¢`,
        };
      }

      if (strongBtcDown && noPrice > 0.55 && noPrice <= MAX_BUY_PRICE) {
        return {
          action: "NO",
          confidence: 0.72,
          reason: `High Conviction: BTC -${Math.abs(btcDelta * 100).toFixed(2)}% + NO at ${(noPrice * 100).toFixed(0)}¢`,
        };
      }

      // Skip if price too expensive
      if (strongBtcUp && yesPrice > MAX_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `High Conviction: BTC up but YES too expensive (${(yesPrice * 100).toFixed(0)}¢)` };
      }
      if (strongBtcDown && noPrice > MAX_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `High Conviction: BTC down but NO too expensive (${(noPrice * 100).toFixed(0)}¢)` };
      }

      // Setup 2: Large spread - buy the cheaper side ONLY if BTC confirms
      const spread = Math.abs(yesPrice - noPrice);
      if (spread > 0.03) {
        // Spread > 3%
        const cheaperSide: Outcome = yesPrice < noPrice ? "YES" : "NO";
        const cheaperPrice = Math.min(yesPrice, noPrice);

        // Only buy if:
        // 1. Price is attractive (< 35%)
        // 2. BTC direction STRONGLY CONFIRMS the trade (not just neutral)
        if (cheaperPrice < 0.35) {
          // Buying YES cheap - only if BTC is ACTUALLY going UP (not just flat)
          // Require btcDelta > 0.0005 (0.05%) to avoid false signals
          if (cheaperSide === "YES" && btcDelta > 0.0005) {
            return {
              action: "YES",
              confidence: 0.70,
              reason: `High Conviction: Cheap YES at ${(cheaperPrice * 100).toFixed(0)}¢ + BTC up ${(btcDelta * 100).toFixed(3)}%`,
            };
          }
          // Buying NO cheap - only if BTC is ACTUALLY going DOWN (not just flat)
          if (cheaperSide === "NO" && btcDelta < -0.0005) {
            return {
              action: "NO",
              confidence: 0.70,
              reason: `High Conviction: Cheap NO at ${(cheaperPrice * 100).toFixed(0)}¢ + BTC down ${(Math.abs(btcDelta) * 100).toFixed(3)}%`,
            };
          }
          // BTC doesn't confirm strongly enough - don't buy cheap side, it's cheap for a reason
          return { action: null, confidence: 0, reason: `High Conviction: Cheap ${cheaperSide} but BTC not moving enough (${(btcDelta * 100).toFixed(3)}%)` };
        }
      }

      return { action: null, confidence: 0, reason: `No high conviction setup` };
    },
  },

  // === SPECTRUM POSITION 6: ULTRA-SELECTIVE - Best setups only ===
  market_maker: {
    name: "Sniper",
    description: "Ultra-selective: only trades on very strong setups with high confidence",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPriceChange } = ctx;

      // Only trade in 60-180s window
      if (timeRemaining > 180000 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Not in entry window (60-180s)" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;
      const btcDelta = btcPriceChange || 0;

      // Strong BTC move thresholds (>0.08% - lowered for 5-minute markets)
      const veryStrongBtcUp = btcDelta > 0.0008;
      const veryStrongBtcDown = btcDelta < -0.0008;

      // Setup 1: Strong BTC move with market not yet reacted
      // BTC up 0.08%+ but market price still < 65%
      if (veryStrongBtcUp && yesPrice < 0.65) {
        return {
          action: "YES",
          confidence: 0.78,
          reason: `Sniper: BTC +${(btcDelta * 100).toFixed(2)}%, market lagging at ${(yesPrice * 100).toFixed(0)}¢`,
        };
      }

      if (veryStrongBtcDown && noPrice < 0.65) {
        return {
          action: "NO",
          confidence: 0.78,
          reason: `Sniper: BTC -${Math.abs(btcDelta * 100).toFixed(2)}%, market lagging at ${(noPrice * 100).toFixed(0)}¢`,
        };
      }

      // Setup 2: Extreme fade (>80% price + BTC contradiction) - lowered from 85%
      const extremeUp = yesPrice > 0.80;
      const extremeDown = noPrice > 0.80;

      if (extremeUp && veryStrongBtcDown) {
        return {
          action: "NO",
          confidence: 0.82,
          reason: `Sniper: Fade extreme UP at ${(yesPrice * 100).toFixed(0)}¢, BTC down ${Math.abs(btcDelta * 100).toFixed(2)}%`,
        };
      }

      if (extremeDown && veryStrongBtcUp) {
        return {
          action: "YES",
          confidence: 0.82,
          reason: `Sniper: Fade extreme DOWN at ${(noPrice * 100).toFixed(0)}¢, BTC up +${(btcDelta * 100).toFixed(2)}%`,
        };
      }

      return { action: null, confidence: 0, reason: `Sniper: No high-quality setup` };
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
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD";
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
      // Spectrum: Aggressive → Selective
      { id: "bot-momentum-chaser", name: "BOT-01: BTC Pure", strategy: "momentum_chaser", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-mean-reversion-sniper", name: "BOT-02: Quick Strike", strategy: "mean_reversion_sniper", interval: 3000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-sum-to-one-arb", name: "BOT-03: Balanced Signal", strategy: "sum_to_one_arb", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-whale-follower", name: "BOT-04: Contrarian Lite", strategy: "whale_follower", interval: 3000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-ta-signal-engine", name: "BOT-05: High Conviction", strategy: "ta_signal_engine", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
      { id: "bot-market-maker", name: "BOT-06: Sniper", strategy: "market_maker", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
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

    // Check if bot already has an open position on this market - one position per market
    const existingPositions = marketEngine.getOpenPositions(id);
    const hasPositionOnMarket = existingPositions.some(p => p.marketId === market.id);
    if (hasPositionOnMarket) {
      // Already have a position on this market, skip
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
      betSize = Math.max(1, betSize); // Minimum $1 bet

      // Log Kelly calculation for transparency
      if (kellyBet > 0) {
        console.log(`[BotManager] Kelly: ${bot.name} | WinProb: ${(winProbability * 100).toFixed(1)}% | Odds: ${netOdds.toFixed(2)} | Fraction: ${(halfKelly * 100).toFixed(1)}% | Bet: $${betSize.toFixed(2)}`);
      }
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
        action: decision.action,
        confidence: decision.confidence,
        betSize,
      },
      totalBalance
    );

    if (!coordination.allowed) {
      this.addLog(id, "COORD", `Trade blocked by coordinator: ${coordination.reason}`, {
        action: decision.action,
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

    const position = marketEngine.placeTrade(decision.action, finalBetSize, id);
    if (position) {
      // Confirm execution with coordinator
      strategyCoordinator.confirmExecution(market.id, id, decision.action, finalBetSize);

      this.addLog(id, "TRADE", `Executed ${decision.action} trade for $${finalBetSize.toFixed(2)} at ${position.odds.toFixed(3)} odds`, {
        action: decision.action,
        amount: finalBetSize,
        odds: position.odds,
        fee: position.fee,
        positionId: position.id,
        confidence: decision.confidence,
        balanceAfter: portfolio.balance - finalBetSize - adjustedFee,
        openPositions: portfolio.openPositions.length + 1,
        kellyUsed: bot.useKelly,
        strategy: bot.strategy,
        coordinatorAdjusted: coordination.adjustedBetSize !== undefined,
      });
      // Note: stats are synced from portfolio on getBots() / after market settlement
      // Do NOT call updateBotStats here — position.pnl is null at placement time
    } else {
      // Trade failed, cancel with coordinator
      strategyCoordinator.cancelDecision(market.id, id);
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
