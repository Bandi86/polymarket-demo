// Risk Manager - Manages trading risk controls and limits
// Implements per-bot and portfolio-level risk management

import { marketEngine } from "./market-engine";

export interface RiskSettings {
  // Per-bot limits
  maxDailyLoss: number;        // Stop bot if loss exceeds $X
  maxPositionSize: number;     // Max $ per position
  maxOpenPositions: number;    // Max concurrent positions
  maxDrawdownPercent: number;  // Stop at X% drawdown

  // Trading limits
  minConfidence: number;       // Only trade if confidence > X (0-1)
  cooldownAfterLoss: number;   // Wait X seconds after loss
  maxTradesPerHour: number;    // Rate limiting

  // Portfolio limits (global)
  portfolioMaxLoss: number;    // Total portfolio stop loss ($)
  portfolioMaxDrawdown: number; // Total portfolio max drawdown (%)
}

export interface BotRiskState {
  botId: string;
  dailyPnL: number;
  dailyTrades: number;
  currentDrawdown: number;
  lastLossTime: number | null;
  tradesThisHour: number;
  hourStartTime: number;
  paused: boolean;
  pauseReason: string | null;
}

export interface RiskWarning {
  botId: string;
  type: "daily_loss" | "drawdown" | "rate_limit" | "position_size" | "portfolio_loss";
  message: string;
  severity: "warning" | "critical";
  timestamp: number;
}

export interface RiskStatus {
  currentDrawdown: number;
  dailyPnL: number;
  tradesToday: number;
  warnings: RiskWarning[];
  actions: ("stop_trading" | "reduce_size")[];
  paused: boolean;
  pauseReason: string | null;
}

const DEFAULT_SETTINGS: RiskSettings = {
  maxDailyLoss: 5,              // Stop if loss > $5
  maxPositionSize: 3,           // Max $3 per position
  maxOpenPositions: 5,          // Max 5 open positions
  maxDrawdownPercent: 20,       // Stop at 20% drawdown

  minConfidence: 0.5,           // Min 50% confidence
  cooldownAfterLoss: 30,        // Wait 30s after loss
  maxTradesPerHour: 60,         // Max 60 trades/hour

  portfolioMaxLoss: 10,         // Stop if total loss > $10
  portfolioMaxDrawdown: 25,     // Stop at 25% total drawdown
};

export class RiskManager {
  private settings: RiskSettings;
  private botStates: Map<string, BotRiskState> = new Map();
  private warnings: RiskWarning[] = [];
  private lastResetDate: string = this.getTodayDate();
  private portfolioStartBalance: number = 0;

  constructor(settings: Partial<RiskSettings> = {}) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.initPortfolioStartBalance();
  }

  private getTodayDate(): string {
    return new Date().toISOString().split("T")[0];
  }

  private initPortfolioStartBalance(): void {
    const portfolio = marketEngine.getPortfolio();
    this.portfolioStartBalance = portfolio?.balance || 100;
  }

  // Get/Set settings
  getSettings(): RiskSettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<RiskSettings>): void {
    this.settings = { ...this.settings, ...updates };
  }

  // Initialize bot risk state
  initBot(botId: string): void {
    if (!this.botStates.has(botId)) {
      this.botStates.set(botId, {
        botId,
        dailyPnL: 0,
        dailyTrades: 0,
        currentDrawdown: 0,
        lastLossTime: null,
        tradesThisHour: 0,
        hourStartTime: Date.now(),
        paused: false,
        pauseReason: null,
      });
    }
  }

  // Check if a new position can be opened
  canOpenPosition(botId: string, amount: number, confidence?: number): { allowed: boolean; reason?: string } {
    this.checkDailyReset();
    this.initBot(botId);

    const state = this.botStates.get(botId)!;

    // Check if bot is paused
    if (state.paused) {
      return { allowed: false, reason: state.pauseReason || "Bot is paused" };
    }

    // Check position size
    if (amount > this.settings.maxPositionSize) {
      this.addWarning(botId, "position_size", `Position size $${amount.toFixed(2)} exceeds max $${this.settings.maxPositionSize}`, "warning");
      return { allowed: false, reason: `Max position size is $${this.settings.maxPositionSize}` };
    }

    // Check confidence
    if (confidence !== undefined && confidence < this.settings.minConfidence) {
      return { allowed: false, reason: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(this.settings.minConfidence * 100).toFixed(0)}%` };
    }

    // Check open positions
    const openPositions = marketEngine.getOpenPositions(botId);
    if (openPositions.length >= this.settings.maxOpenPositions) {
      return { allowed: false, reason: `Max ${this.settings.maxOpenPositions} open positions reached` };
    }

    // Check cooldown after loss
    if (state.lastLossTime && this.settings.cooldownAfterLoss > 0) {
      const timeSinceLoss = (Date.now() - state.lastLossTime) / 1000;
      if (timeSinceLoss < this.settings.cooldownAfterLoss) {
        const waitTime = Math.ceil(this.settings.cooldownAfterLoss - timeSinceLoss);
        return { allowed: false, reason: `Cooldown: wait ${waitTime}s after loss` };
      }
    }

    // Check rate limit (trades per hour)
    this.checkHourReset(state);
    if (state.tradesThisHour >= this.settings.maxTradesPerHour) {
      this.addWarning(botId, "rate_limit", `Rate limit reached: ${state.tradesThisHour}/${this.settings.maxTradesPerHour} trades/hour`, "warning");
      return { allowed: false, reason: `Rate limit: max ${this.settings.maxTradesPerHour} trades/hour` };
    }

    // Check daily loss
    if (state.dailyPnL < -this.settings.maxDailyLoss) {
      this.addWarning(botId, "daily_loss", `Daily loss $${Math.abs(state.dailyPnL).toFixed(2)} exceeds max $${this.settings.maxDailyLoss}`, "critical");
      return { allowed: false, reason: `Daily loss limit reached ($${this.settings.maxDailyLoss})` };
    }

    // Check portfolio limits
    const portfolio = marketEngine.getPortfolio();
    if (portfolio) {
      const portfolioPnL = portfolio.balance - this.portfolioStartBalance;
      if (portfolioPnL < -this.settings.portfolioMaxLoss) {
        this.addWarning(botId, "portfolio_loss", `Portfolio loss $${Math.abs(portfolioPnL).toFixed(2)} exceeds max $${this.settings.portfolioMaxLoss}`, "critical");
        return { allowed: false, reason: `Portfolio loss limit reached ($${this.settings.portfolioMaxLoss})` };
      }

      const drawdown = this.portfolioStartBalance > 0
        ? ((this.portfolioStartBalance - portfolio.balance) / this.portfolioStartBalance) * 100
        : 0;
      if (drawdown > this.settings.portfolioMaxDrawdown) {
        this.addWarning(botId, "portfolio_loss", `Portfolio drawdown ${drawdown.toFixed(1)}% exceeds max ${this.settings.portfolioMaxDrawdown}%`, "critical");
        return { allowed: false, reason: `Portfolio drawdown limit reached (${this.settings.portfolioMaxDrawdown}%)` };
      }
    }

    return { allowed: true };
  }

  // Record a trade result
  recordTrade(botId: string, pnl: number): void {
    this.checkDailyReset();
    this.initBot(botId);

    const state = this.botStates.get(botId)!;

    // Update daily P&L
    state.dailyPnL += pnl;
    state.dailyTrades++;
    state.tradesThisHour++;

    // Track loss for cooldown
    if (pnl < 0) {
      state.lastLossTime = Date.now();
    }

    // Check for daily loss limit
    if (state.dailyPnL <= -this.settings.maxDailyLoss) {
      this.pauseBot(botId, `Daily loss limit reached: $${Math.abs(state.dailyPnL).toFixed(2)} loss`);
    }

    // Check drawdown
    const botPortfolio = marketEngine.getBotPortfolio(botId);
    if (botPortfolio) {
      const drawdown = botPortfolio.initialBalance > 0
        ? ((botPortfolio.initialBalance - botPortfolio.balance) / botPortfolio.initialBalance) * 100
        : 0;
      state.currentDrawdown = drawdown;

      if (drawdown >= this.settings.maxDrawdownPercent) {
        this.pauseBot(botId, `Drawdown limit reached: ${drawdown.toFixed(1)}%`);
      }
    }

    this.botStates.set(botId, state);
  }

  // Check if bot should be paused
  shouldPause(botId: string): boolean {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    return state.paused;
  }

  // Pause a bot
  pauseBot(botId: string, reason: string): void {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    state.paused = true;
    state.pauseReason = reason;
    this.botStates.set(botId, state);
    this.addWarning(botId, "drawdown", reason, "critical");
  }

  // Resume a bot
  resumeBot(botId: string): void {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    state.paused = false;
    state.pauseReason = null;
    this.botStates.set(botId, state);
  }

  // Get bot risk status
  getBotRiskStatus(botId: string): RiskStatus {
    this.checkDailyReset();
    this.initBot(botId);

    const state = this.botStates.get(botId)!;
    const portfolio = marketEngine.getBotPortfolio(botId);

    const botWarnings = this.warnings
      .filter(w => w.botId === botId)
      .slice(0, 10);

    const actions: ("stop_trading" | "reduce_size")[] = [];

    if (state.dailyPnL < -this.settings.maxDailyLoss * 0.8) {
      actions.push("reduce_size");
    }
    if (state.paused || state.currentDrawdown >= this.settings.maxDrawdownPercent * 0.8) {
      actions.push("stop_trading");
    }

    return {
      currentDrawdown: state.currentDrawdown,
      dailyPnL: state.dailyPnL,
      tradesToday: state.dailyTrades,
      warnings: botWarnings,
      actions,
      paused: state.paused,
      pauseReason: state.pauseReason,
    };
  }

  // Get all warnings
  getWarnings(limit = 50): RiskWarning[] {
    return this.warnings.slice(0, limit);
  }

  // Clear warnings for a bot
  clearWarnings(botId: string): void {
    this.warnings = this.warnings.filter(w => w.botId !== botId);
  }

  // Reset bot state
  resetBot(botId: string): void {
    this.botStates.delete(botId);
    this.clearWarnings(botId);
  }

  // Reset all
  resetAll(): void {
    this.botStates.clear();
    this.warnings = [];
    this.initPortfolioStartBalance();
  }

  // Private helpers
  private checkDailyReset(): void {
    const today = this.getTodayDate();
    if (today !== this.lastResetDate) {
      // Reset daily counters
      for (const [id, state] of this.botStates) {
        state.dailyPnL = 0;
        state.dailyTrades = 0;
        state.tradesThisHour = 0;
        state.hourStartTime = Date.now();
        // Don't reset paused state - manual resume required
        this.botStates.set(id, state);
      }
      this.lastResetDate = today;
      this.initPortfolioStartBalance();
    }
  }

  private checkHourReset(state: BotRiskState): void {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    if (now - state.hourStartTime >= hourMs) {
      state.tradesThisHour = 0;
      state.hourStartTime = now;
    }
  }

  private addWarning(botId: string, type: RiskWarning["type"], message: string, severity: RiskWarning["severity"]): void {
    this.warnings.unshift({
      botId,
      type,
      message,
      severity,
      timestamp: Date.now(),
    });

    // Keep only last 100 warnings
    if (this.warnings.length > 100) {
      this.warnings.pop();
    }
  }
}

// Singleton instance
export const riskManager = new RiskManager();