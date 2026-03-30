// Competition Manager
// Handles bot competition state, leaderboard, and scoring

import type { BotConfig } from "../../types";
import { marketEngine } from "../market-engine";
import { generateId } from "../utils";

export interface LeaderboardEntry {
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
}

export interface CompetitionConfig {
  minTrades: number;
  duration: number | null;
  startBalance: number;
}

export interface CompetitionState {
  active: boolean;
  startTime: number;
  minTrades: number;
  startBalance: number;
  leaderboard: LeaderboardEntry[];
  winner: string | null;
  completedAt: number | null;
  config: CompetitionConfig;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD" | "SETTLED" | "LIVE_RISK";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

type AddLogFn = (botId: string, type: BotLog["type"], message: string, details?: Record<string, unknown>) => void;

export class CompetitionManager {
  private competition: CompetitionState;
  private addLog: AddLogFn;

  constructor(addLog: AddLogFn) {
    this.addLog = addLog;
    this.competition = this.createInitialState();
  }

  private createInitialState(): CompetitionState {
    return {
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
  }

  getState(): CompetitionState {
    if (this.competition.active) {
      this.updateLeaderboard(new Map());
    }
    return { ...this.competition };
  }

  isActive(): boolean {
    return this.competition.active;
  }

  getConfig(): CompetitionConfig {
    return this.competition.config;
  }

  getStartBalance(): number {
    return this.competition.startBalance;
  }

  getMinTrades(): number {
    return this.competition.minTrades;
  }

  start(
    bots: Map<string, BotConfig>,
    config?: { minTrades?: number; duration?: number | null; startBalance?: number },
    onStartBot?: (id: string) => void,
    onStopAll?: () => void
  ): CompetitionState {
    // Stop any existing competition
    if (this.competition.active) {
      this.stop(bots);
    }

    const minTrades = config?.minTrades ?? 50;
    const startBalance = config?.startBalance ?? 10;

    // Stop all bots first
    if (onStopAll) onStopAll();

    console.log(`[CompetitionManager] Starting competition with ${bots.size} bots`);

    // Reset and start all bots
    for (const [id, bot] of bots) {
      // Clear old positions first!
      marketEngine.clearBotPositions(id);

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
      bots.set(id, bot);

      // Start the bot
      if (onStartBot) onStartBot(id);
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
      bots: bots.size,
    });

    return this.getState();
  }

  stop(bots: Map<string, BotConfig>, onStopAll?: () => void): CompetitionState {
    if (!this.competition.active) {
      return this.getState();
    }

    // Mark as inactive FIRST
    this.competition.active = false;

    // Stop all bots
    if (onStopAll) onStopAll();

    // Calculate final leaderboard
    this.updateLeaderboard(bots);

    // Determine winner
    const qualified = this.competition.leaderboard.filter(b => b.trades >= this.competition.minTrades);
    if (qualified.length > 0) {
      this.competition.winner = qualified[0].botId;
    }

    this.competition.completedAt = Date.now();

    this.addCompetitionLog("Competition ended", {
      winner: this.competition.winner,
      leaderboard: this.competition.leaderboard.slice(0, 3),
    });

    return this.getState();
  }

  clear(): CompetitionState {
    this.competition = this.createInitialState();
    return this.getState();
  }

  updateLeaderboard(bots: Map<string, BotConfig>, stopCompetition?: () => void): void {
    const entries: LeaderboardEntry[] = [];

    for (const [id, bot] of bots) {
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

      if (a.pnl !== b.pnl) {
        return b.pnl - a.pnl;
      }

      return b.winRate - a.winRate;
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.competition.leaderboard = entries;

    // Check if competition should auto-end
    if (this.competition.active && this.competition.config.duration && stopCompetition) {
      const elapsed = Date.now() - this.competition.startTime;
      if (elapsed >= this.competition.config.duration) {
        stopCompetition();
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

    this.addLog("competition", "COMPETITION", message, details);
    console.log(`[Competition] ${message}`);
  }
}