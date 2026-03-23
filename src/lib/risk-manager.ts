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

  // Kelly criterion settings
  kellyEnabled: boolean;       // Use Kelly criterion for position sizing
  kellyFraction: number;       // Fraction of Kelly to use (0-1, typically 0.25)
  kellyMinConfidence: number;  // Minimum confidence to apply Kelly

  // Circuit breaker
  circuitBreakerEnabled: boolean;
  consecutiveLossThreshold: number;

  // Auto-adjustment
  autoReduceOnLoss: boolean;
  autoIncreaseOnWin: boolean;
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
  consecutiveWins: number;
  consecutiveLosses: number;
  lastTradeResult: "win" | "loss" | null;
  currentBetMultiplier: number;
}

export interface RiskWarning {
  botId: string;
  type: "daily_loss" | "drawdown" | "rate_limit" | "position_size" | "portfolio_loss" | "circuit_breaker";
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
  maxOpenPositions: 999,        // No practical limit - let strategies trade freely
  maxDrawdownPercent: 20,       // Stop at 20% drawdown

  minConfidence: 0.55,          // Min 55% confidence (raised from 50%)
  cooldownAfterLoss: 15,        // Wait 15s after loss (reduced from 30s for 5m markets)
  maxTradesPerHour: 40,         // Max 40 trades/hour (reduced from 60 for quality)

  portfolioMaxLoss: 10,         // Stop if total loss > $10
  portfolioMaxDrawdown: 25,     // Stop at 25% total drawdown

  // Kelly criterion
  kellyEnabled: true,           // Use Kelly for position sizing
  kellyFraction: 0.25,          // Quarter Kelly for safety
  kellyMinConfidence: 0.55,     // Apply Kelly only above this confidence

  // Circuit breaker
  circuitBreakerEnabled: true,
  consecutiveLossThreshold: 5,  // Pause after 5 consecutive losses

  // Auto-adjustment
  autoReduceOnLoss: true,
  autoIncreaseOnWin: true,
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
        consecutiveWins: 0,
        consecutiveLosses: 0,
        lastTradeResult: null,
        currentBetMultiplier: 1,
      });
    }
  }

  /**
   * Calculate position size using Kelly Criterion
   * f* = (bp - q) / b
   * where:
   *   f* = optimal bet fraction
   *   b  = net odds (profit per $1 bet if you win)
   *   p  = probability of winning (confidence)
   *   q  = 1 - p (probability of losing)
   *
   * For prediction markets:
   *   b = (1 - price) / price = potential profit ratio
   *   if price = 0.6, b = 0.4/0.6 = 0.67 (bet $1 to win $0.67 profit)
   */
  calculateKellySize(
    confidence: number,
    price: number,
    bankroll: number,
    kellyFraction: number = this.settings.kellyFraction
  ): number {
    // Don't apply Kelly if confidence too low
    if (confidence < this.settings.kellyMinConfidence) {
      return 0;
    }

    // Calculate net odds
    const b = price > 0 && price < 1 ? (1 - price) / price : 1;

    // Kelly formula
    const p = confidence;
    const q = 1 - p;
    let kelly = (b * p - q) / b;

    // If negative, don't bet
    if (kelly <= 0) {
      return 0;
    }

    // Apply Kelly fraction for safety (typically 0.25 = quarter Kelly)
    kelly = kelly * kellyFraction;

    // Cap at 25% of bankroll for safety
    kelly = Math.min(kelly, 0.25);

    return bankroll * kelly;
  }

  /**
   * Get suggested bet size combining Kelly and risk limits
   */
  getSuggestedBetSize(
    botId: string,
    confidence: number,
    price: number,
    bankroll: number
  ): { size: number; method: string } {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;

    // Start with base calculation
    let size = bankroll * 0.1; // Default 10% of bankroll
    let method = "default_10pct";

    if (this.settings.kellyEnabled && confidence >= this.settings.kellyMinConfidence) {
      const kellySize = this.calculateKellySize(confidence, price, bankroll);
      if (kellySize > 0) {
        size = kellySize;
        method = "kelly";
      }
    }

    // Apply streak-based adjustments
    if (this.settings.autoReduceOnLoss && state.consecutiveLosses > 0) {
      const reductionFactor = Math.pow(0.5, Math.min(state.consecutiveLosses, 3));
      size = size * reductionFactor;
      method += "_reduced";
    }

    if (this.settings.autoIncreaseOnWin && state.consecutiveWins >= 3) {
      const increaseFactor = Math.min(1 + (state.consecutiveWins - 2) * 0.25, 2);
      size = size * increaseFactor;
      method += "_increased";
    }

    // Apply max position size limit
    size = Math.min(size, this.settings.maxPositionSize);

    // Ensure minimum bet
    size = Math.max(size, 0.1);

    return { size, method };
  }

  // Record a trade result for auto-adjustment tracking
  recordTradeResult(botId: string, won: boolean): void {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    
    if (won) {
      state.consecutiveWins++;
      state.consecutiveLosses = 0;
      state.lastTradeResult = "win";
    } else {
      state.consecutiveLosses++;
      state.consecutiveWins = 0;
      state.lastTradeResult = "loss";
      state.lastLossTime = Date.now();
    }
    
    state.dailyTrades++;
    state.dailyPnL += won ? 1 : -1; // Simplified
    
    // Check circuit breaker
    if (this.settings.consecutiveLossThreshold && 
        state.consecutiveLosses >= this.settings.consecutiveLossThreshold &&
        this.settings.circuitBreakerEnabled) {
      state.paused = true;
      state.pauseReason = `Circuit breaker: ${state.consecutiveLosses} consecutive losses`;
      this.addWarning(botId, "circuit_breaker", state.pauseReason, "critical");
    }
  }

  // Calculate adjusted bet size based on win/loss streaks
  getAdjustedBetSize(botId: string, baseBet: number): number {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    const { autoReduceOnLoss, autoIncreaseOnWin } = this.settings;
    
    let multiplier = 1;
    
    // Auto-reduce after losses (e.g., halve bet after 2 consecutive losses)
    if (autoReduceOnLoss && state.consecutiveLosses > 0) {
      const reductionFactor = Math.pow(0.5, Math.min(state.consecutiveLosses, 3)); // Max 3x reduction
      multiplier *= reductionFactor;
    }
    
    // Auto-increase after wins (e.g., increase by 25% after 3 consecutive wins)
    if (autoIncreaseOnWin && state.consecutiveWins >= 3) {
      const increaseFactor = Math.min(1 + (state.consecutiveWins - 2) * 0.25, 2); // Max 2x
      multiplier *= increaseFactor;
    }
    
    const adjustedBet = baseBet * multiplier;
    
    // Ensure within limits
    const maxBet = baseBet * 2; // Max 2x original
    const minBet = baseBet * 0.25; // Min 25% of original
    
    return Math.max(minBet, Math.min(maxBet, adjustedBet));
  }

  // Get bot streak info
  getBotStreakInfo(botId: string): { consecutiveWins: number; consecutiveLosses: number; isPaused: boolean; pauseReason: string | null } {
    this.initBot(botId);
    const state = this.botStates.get(botId)!;
    return {
      consecutiveWins: state.consecutiveWins,
      consecutiveLosses: state.consecutiveLosses,
      isPaused: state.paused,
      pauseReason: state.pauseReason,
    };
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