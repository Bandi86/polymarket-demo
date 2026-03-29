// Live Mode Manager
// Dedicated manager for real Polymarket trading
// Handles balance sync, risk management, and 24/7 operation

import { polymarketProvider } from "./providers/polymarket-provider";
import { marketEngine } from "./market-engine";
import { broadcastToSSE } from "./global";
import type { BotConfig, Position } from "../types";

export interface LiveBotSettings {
  botId: string;
  enabled: boolean;
  maxBankrollPercent: number;  // Max % of total bankroll this bot can use
  riskLevel: "conservative" | "moderate" | "aggressive";
  autoStopLoss: number;        // Auto-stop if loss exceeds this %
  dailyProfitTarget: number;   // Stop trading if daily profit target reached
  maxDailyTrades: number;      // Max trades per day (0 = unlimited)
  cooldownAfterLoss: number;   // Minutes to wait after a loss
  enabledTimeframes: string[]; // Which timeframes to trade
  enabledHours: { start: number; end: number }; // Trading hours (0-24)
}

export interface LiveStats {
  dailyPnL: number;
  dailyTrades: number;
  dailyWins: number;
  dailyLosses: number;
  weeklyPnL: number;
  weeklyTrades: number;
  monthlyPnL: number;
  monthlyTrades: number;
  totalVolume: number;
  avgTradeSize: number;
  bestTrade: { profit: number; market: string; timestamp: number } | null;
  worstTrade: { loss: number; market: string; timestamp: number } | null;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  winStreak: number;
  lossStreak: number;
  lastTradeTime: number | null;
  lastBalanceSync: number | null;
  sessionStartTime: number | null;
}

export interface LivePosition {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: "YES" | "NO";
  shares: number;
  entryPrice: number;
  currentPrice: number;
  value: number;
  unrealizedPnL: number;
  pnlPercent: number;
  openTime: number;
  botId: string;
}

export interface LiveModeState {
  isLiveMode: boolean;
  isConnected: boolean;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  totalBankroll: number;       // User's total deposited amount
  allocatedBankroll: number;   // Amount allocated to bots
  freeBankroll: number;        // Unallocated amount
  positions: LivePosition[];
  stats: LiveStats;
  botSettings: Map<string, LiveBotSettings>;
  healthStatus: {
    lastHeartbeat: number;
    apiLatency: number;
    errorCount: number;
    warningCount: number;
    status: "healthy" | "degraded" | "critical" | "offline";
  };
  alerts: LiveAlert[];
  sessionStartTime?: number;  // When live mode was enabled
}

export interface LiveAlert {
  id: string;
  type: "warning" | "error" | "info" | "critical";
  message: string;
  timestamp: number;
  acknowledged: boolean;
  details?: Record<string, unknown>;
}

export class LiveModeManager {
  private state: LiveModeState;
  private balanceSyncInterval: ReturnType<typeof setInterval> | null = null;
  private positionSyncInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private statsSaveInterval: ReturnType<typeof setInterval> | null = null;
  private cooldownTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private readonly BALANCE_SYNC_INTERVAL = 30000;  // 30 seconds
  private readonly POSITION_SYNC_INTERVAL = 10000; // 10 seconds
  private readonly HEALTH_CHECK_INTERVAL = 60000;  // 1 minute
  private readonly STATS_SAVE_INTERVAL = 300000;   // 5 minutes

  // Daily stats reset tracking
  private lastDailyReset: number = Date.now();

  constructor() {
    this.state = this.getInitialState();
    this.loadState();
  }

  private getInitialState(): LiveModeState {
    return {
      isLiveMode: false,
      isConnected: false,
      balance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      totalBankroll: 0,
      allocatedBankroll: 0,
      freeBankroll: 0,
      positions: [],
      stats: this.getInitialStats(),
      botSettings: new Map(),
      healthStatus: {
        lastHeartbeat: Date.now(),
        apiLatency: 0,
        errorCount: 0,
        warningCount: 0,
        status: "offline",
      },
      alerts: [],
    };
  }

  private getInitialStats(): LiveStats {
    return {
      dailyPnL: 0,
      dailyTrades: 0,
      dailyWins: 0,
      dailyLosses: 0,
      weeklyPnL: 0,
      weeklyTrades: 0,
      monthlyPnL: 0,
      monthlyTrades: 0,
      totalVolume: 0,
      avgTradeSize: 0,
      bestTrade: null,
      worstTrade: null,
      sharpeRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      winStreak: 0,
      lossStreak: 0,
      lastTradeTime: null,
      lastBalanceSync: null,
      sessionStartTime: null,
    };
  }

  // === MODE SWITCHING ===

  async enableLiveMode(): Promise<{ success: boolean; error?: string }> {
    if (this.state.isLiveMode) {
      return { success: true };
    }

    // Check credentials
    if (!polymarketProvider.hasPrivateKey()) {
      return { success: false, error: "No private key configured. Add POLYMARKET_PRIVATE_KEY to .env" };
    }

    // Test connection and get balance
    const balanceResult = await this.syncBalance();
    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error || "Failed to connect to Polymarket" };
    }

    // Check if there's actual balance
    if (balanceResult.balance <= 0) {
      return { success: false, error: "No USDC balance found. Deposit USDC to your Polymarket account first." };
    }

    this.state.isLiveMode = true;
    this.state.isConnected = true;
    this.state.totalBankroll = balanceResult.balance;
    this.state.sessionStartTime = Date.now();

    // Start background processes
    this.startBackgroundProcesses();

    // Load live positions
    await this.syncPositions();

    this.addAlert("info", `Live mode enabled. Balance: $${this.state.balance.toFixed(2)}`);
    this.broadcastState();

    // Save state
    this.saveState();

    return { success: true };
  }

  disableLiveMode(): void {
    if (!this.state.isLiveMode) return;

    this.state.isLiveMode = false;
    this.state.isConnected = false;
    this.stopBackgroundProcesses();

    this.addAlert("info", "Live mode disabled");
    this.broadcastState();
    this.saveState();
  }

  isLiveMode(): boolean {
    return this.state.isLiveMode;
  }

  // === BALANCE MANAGEMENT ===

  async syncBalance(): Promise<{ success: boolean; balance: number; error?: string }> {
    const startTime = Date.now();

    try {
      const result = await polymarketProvider.fetchAccountBalance();
      const latency = Date.now() - startTime;

      if (!result.success) {
        this.state.healthStatus.errorCount++;
        this.addAlert("error", `Balance sync failed: ${result.error}`);
        return { success: false, balance: 0, error: result.error };
      }

      const previousBalance = this.state.balance;

      this.state.balance = result.balance;
      this.state.availableBalance = result.available;
      this.state.lockedBalance = result.locked;
      this.state.healthStatus.apiLatency = latency;
      this.state.healthStatus.lastHeartbeat = Date.now();
      this.state.stats.lastBalanceSync = Date.now();

      // Update total bankroll if balance increased (deposit detected)
      if (result.balance > this.state.totalBankroll) {
        const deposit = result.balance - this.state.totalBankroll;
        this.state.totalBankroll = result.balance;
        this.addAlert("info", `Deposit detected: +$${deposit.toFixed(2)} (New total: $${result.balance.toFixed(2)})`);
      }

      // Calculate free bankroll
      this.recalculateBankrollAllocation();

      // Check for balance drop (withdrawal or loss)
      if (result.balance < previousBalance && previousBalance > 0) {
        const drop = previousBalance - result.balance;
        const dropPercent = (drop / previousBalance) * 100;

        if (dropPercent > 5) {
          this.addAlert("warning", `Balance dropped ${dropPercent.toFixed(1)}% ($${drop.toFixed(2)})`);
        }
      }

      // Update health status
      if (this.state.healthStatus.errorCount > 0) {
        this.state.healthStatus.errorCount = Math.max(0, this.state.healthStatus.errorCount - 1);
      }
      this.updateHealthStatus();

      this.broadcastState();
      return { success: true, balance: result.balance };
    } catch (error) {
      this.state.healthStatus.errorCount++;
      this.updateHealthStatus();
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.addAlert("error", `Balance sync error: ${errorMsg}`);
      return { success: false, balance: 0, error: errorMsg };
    }
  }

  private recalculateBankrollAllocation(): void {
    // Calculate how much bankroll is allocated to bots
    let allocated = 0;

    for (const [, settings] of this.state.botSettings) {
      if (settings.enabled) {
        allocated += this.state.totalBankroll * (settings.maxBankrollPercent / 100);
      }
    }

    this.state.allocatedBankroll = Math.min(allocated, this.state.totalBankroll);
    this.state.freeBankroll = this.state.totalBankroll - this.state.allocatedBankroll;
  }

  // === POSITION MANAGEMENT ===

  async syncPositions(): Promise<{ success: boolean; positions: LivePosition[] }> {
    if (!this.state.isLiveMode) {
      return { success: false, positions: [] };
    }

    try {
      const result = await polymarketProvider.fetchPositions();

      if (!result.success) {
        this.addAlert("error", `Position sync failed: ${result.error}`);
        return { success: false, positions: [] };
      }

      // Transform to LivePosition format
      this.state.positions = result.positions.map((p, i) => ({
        id: `live-pos-${i}`,
        marketId: p.market,
        marketQuestion: p.market, // Would need to fetch market details for actual question
        outcome: p.outcome as "YES" | "NO",
        shares: p.shares,
        entryPrice: p.avgPrice,
        currentPrice: p.currentValue / p.shares,
        value: p.currentValue,
        unrealizedPnL: p.currentValue - (p.shares * p.avgPrice),
        pnlPercent: ((p.currentValue / (p.shares * p.avgPrice)) - 1) * 100,
        openTime: Date.now(), // Would need actual open time
        botId: "live", // Would need to track which bot opened
      }));

      this.broadcastState();
      return { success: true, positions: this.state.positions };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.addAlert("error", `Position sync error: ${errorMsg}`);
      return { success: false, positions: [] };
    }
  }

  // === BOT SETTINGS ===

  getBotSettings(botId: string): LiveBotSettings {
    const existing = this.state.botSettings.get(botId);
    if (existing) return existing;

    // Create default settings
    const defaults: LiveBotSettings = {
      botId,
      enabled: false,
      maxBankrollPercent: 10,  // 10% of bankroll by default
      riskLevel: "moderate",
      autoStopLoss: 20,        // Stop if 20% loss
      dailyProfitTarget: 50,   // $50 daily profit target
      maxDailyTrades: 0,       // Unlimited
      cooldownAfterLoss: 5,    // 5 minute cooldown
      enabledTimeframes: ["5", "15", "60"],
      enabledHours: { start: 0, end: 24 }, // 24/7
    };

    this.state.botSettings.set(botId, defaults);
    return defaults;
  }

  updateBotSettings(botId: string, settings: Partial<LiveBotSettings>): LiveBotSettings {
    const current = this.getBotSettings(botId);
    const updated = { ...current, ...settings };
    this.state.botSettings.set(botId, updated);

    this.recalculateBankrollAllocation();
    this.broadcastState();
    this.saveState();

    return updated;
  }

  isBotInCooldown(botId: string): boolean {
    return this.cooldownTimers.has(botId);
  }

  setBotCooldown(botId: string, minutes: number): void {
    // Clear existing cooldown
    const existing = this.cooldownTimers.get(botId);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new cooldown
    const timer = setTimeout(() => {
      this.cooldownTimers.delete(botId);
      this.addAlert("info", `Bot ${botId} cooldown ended, ready to trade`);
    }, minutes * 60 * 1000);

    this.cooldownTimers.set(botId, timer);
    this.addAlert("warning", `Bot ${botId} in cooldown for ${minutes} minutes`);
  }

  // === RISK MANAGEMENT ===

  canBotTrade(botId: string, bot: BotConfig): { allowed: boolean; reason?: string } {
    if (!this.state.isLiveMode) {
      return { allowed: false, reason: "Not in live mode" };
    }

    const settings = this.getBotSettings(botId);

    // Check if bot is enabled for live trading
    if (!settings.enabled) {
      return { allowed: false, reason: "Bot not enabled for live trading" };
    }

    // Check cooldown
    if (this.isBotInCooldown(botId)) {
      return { allowed: false, reason: "Bot in cooldown" };
    }

    // Check trading hours
    const currentHour = new Date().getHours();
    if (currentHour < settings.enabledHours.start || currentHour >= settings.enabledHours.end) {
      return { allowed: false, reason: `Outside trading hours (${settings.enabledHours.start}-${settings.enabledHours.end})` };
    }

    // Check daily trade limit
    if (settings.maxDailyTrades > 0 && this.state.stats.dailyTrades >= settings.maxDailyTrades) {
      return { allowed: false, reason: `Daily trade limit reached (${settings.maxDailyTrades})` };
    }

    // Check daily profit target
    if (settings.dailyProfitTarget > 0 && this.state.stats.dailyPnL >= settings.dailyProfitTarget) {
      return { allowed: false, reason: `Daily profit target reached ($${settings.dailyProfitTarget})` };
    }

    // Check auto stop-loss
    if (settings.autoStopLoss > 0) {
      const lossPercent = (this.state.stats.dailyPnL / this.state.totalBankroll) * 100;
      if (lossPercent <= -settings.autoStopLoss) {
        return { allowed: false, reason: `Auto stop-loss triggered (${lossPercent.toFixed(1)}% loss)` };
      }
    }

    // Check available balance
    const maxBetAmount = this.state.totalBankroll * (settings.maxBankrollPercent / 100);
    if (this.state.availableBalance < maxBetAmount * 0.1) { // Need at least 10% of max bet
      return { allowed: false, reason: "Insufficient available balance" };
    }

    return { allowed: true };
  }

  calculateLiveBetSize(botId: string, confidence: number): number {
    const settings = this.getBotSettings(botId);
    const maxBankrollAmount = this.state.totalBankroll * (settings.maxBankrollPercent / 100);

    // Adjust based on risk level
    const riskMultiplier = {
      conservative: 0.5,
      moderate: 1.0,
      aggressive: 1.5,
    }[settings.riskLevel];

    // Kelly-inspired sizing
    const kellySize = Math.max(0, (confidence - 0.5) * 2); // 0-1 range
    const baseSize = maxBankrollAmount * riskMultiplier * kellySize;

    // Don't exceed available balance
    return Math.min(baseSize, this.state.availableBalance * 0.95); // Keep 5% reserve
  }

  // === STATS TRACKING ===

  recordLiveTrade(botId: string, trade: {
    outcome: "YES" | "NO";
    amount: number;
    price: number;
    pnl?: number;
    marketId: string;
  }): void {
    // Update daily stats
    this.state.stats.dailyTrades++;
    this.state.stats.monthlyTrades++;
    this.state.stats.totalVolume += trade.amount;

    if (trade.pnl !== undefined) {
      if (trade.pnl > 0) {
        this.state.stats.dailyWins++;
        this.state.stats.winStreak++;
        this.state.stats.lossStreak = 0;

        // Track best trade
        if (!this.state.stats.bestTrade || trade.pnl > this.state.stats.bestTrade.profit) {
          this.state.stats.bestTrade = {
            profit: trade.pnl,
            market: trade.marketId,
            timestamp: Date.now(),
          };
        }
      } else {
        this.state.stats.dailyLosses++;
        this.state.stats.lossStreak++;
        this.state.stats.winStreak = 0;

        // Track worst trade
        if (!this.state.stats.worstTrade || trade.pnl < this.state.stats.worstTrade.loss) {
          this.state.stats.worstTrade = {
            loss: trade.pnl,
            market: trade.marketId,
            timestamp: Date.now(),
          };
        }

        // Apply cooldown if configured
        const settings = this.getBotSettings(botId);
        if (settings.cooldownAfterLoss > 0) {
          this.setBotCooldown(botId, settings.cooldownAfterLoss);
        }
      }

      this.state.stats.dailyPnL += trade.pnl;
      this.state.stats.monthlyPnL += trade.pnl;
    }

    this.state.stats.lastTradeTime = Date.now();
    this.state.stats.avgTradeSize = this.state.stats.totalVolume / this.state.stats.dailyTrades;

    this.broadcastState();
    this.saveState();
  }

  // === HEALTH & MONITORING ===

  private startBackgroundProcesses(): void {
    // Balance sync
    this.balanceSyncInterval = setInterval(
      () => this.syncBalance(),
      this.BALANCE_SYNC_INTERVAL
    );

    // Position sync
    this.positionSyncInterval = setInterval(
      () => this.syncPositions(),
      this.POSITION_SYNC_INTERVAL
    );

    // Health check
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.HEALTH_CHECK_INTERVAL
    );

    // Stats save
    this.statsSaveInterval = setInterval(
      () => this.saveState(),
      this.STATS_SAVE_INTERVAL
    );

    console.log("[LiveModeManager] Background processes started");
  }

  private stopBackgroundProcesses(): void {
    if (this.balanceSyncInterval) {
      clearInterval(this.balanceSyncInterval);
      this.balanceSyncInterval = null;
    }
    if (this.positionSyncInterval) {
      clearInterval(this.positionSyncInterval);
      this.positionSyncInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.statsSaveInterval) {
      clearInterval(this.statsSaveInterval);
      this.statsSaveInterval = null;
    }

    console.log("[LiveModeManager] Background processes stopped");
  }

  private async performHealthCheck(): Promise<void> {
    const now = Date.now();

    // Check if we had a recent heartbeat
    const timeSinceHeartbeat = now - this.state.healthStatus.lastHeartbeat;
    if (timeSinceHeartbeat > 120000) { // 2 minutes
      this.addAlert("warning", "No heartbeat for 2 minutes, attempting reconnect");
      await this.syncBalance();
    }

    // Check error count
    if (this.state.healthStatus.errorCount >= 5) {
      this.state.healthStatus.status = "critical";
      this.addAlert("critical", "Critical: 5+ consecutive errors detected");
    }

    // Check daily reset
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    if (this.lastDailyReset < dayStart.getTime()) {
      this.resetDailyStats();
      this.lastDailyReset = dayStart.getTime();
    }

    this.updateHealthStatus();
    this.broadcastState();
  }

  private updateHealthStatus(): void {
    const { errorCount, warningCount } = this.state.healthStatus;

    if (errorCount >= 5) {
      this.state.healthStatus.status = "critical";
    } else if (errorCount >= 3 || warningCount >= 5) {
      this.state.healthStatus.status = "degraded";
    } else if (this.state.isConnected) {
      this.state.healthStatus.status = "healthy";
    } else {
      this.state.healthStatus.status = "offline";
    }
  }

  private resetDailyStats(): void {
    // Archive yesterday's stats before reset
    this.state.stats.dailyPnL = 0;
    this.state.stats.dailyTrades = 0;
    this.state.stats.dailyWins = 0;
    this.state.stats.dailyLosses = 0;

    this.addAlert("info", "Daily stats reset for new trading day");
  }

  // === ALERTS ===

  private addAlert(type: LiveAlert["type"], message: string, details?: Record<string, unknown>): void {
    const alert: LiveAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      timestamp: Date.now(),
      acknowledged: false,
      details,
    };

    this.state.alerts.unshift(alert);

    // Keep only last 50 alerts
    if (this.state.alerts.length > 50) {
      this.state.alerts = this.state.alerts.slice(0, 50);
    }

    // Log critical alerts
    if (type === "critical" || type === "error") {
      console.error(`[LiveModeManager] ${type.toUpperCase()}: ${message}`);
    }

    this.broadcastState();
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.broadcastState();
    }
  }

  clearAlerts(): void {
    this.state.alerts = [];
    this.broadcastState();
  }

  // === STATE MANAGEMENT ===

  getState(): LiveModeState {
    return { ...this.state };
  }

  private broadcastState(): void {
    broadcastToSSE("live_mode_state", this.getState());
  }

  private saveState(): void {
    try {
      const stateToSave = {
        ...this.state,
        botSettings: Object.fromEntries(this.state.botSettings),
      };

      // Only save to localStorage in browser environment
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.setItem("liveModeState", JSON.stringify(stateToSave));
      }
    } catch (error) {
      console.error("[LiveModeManager] Failed to save state:", error);
    }
  }

  private loadState(): void {
    try {
      // Only load from localStorage in browser environment
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("liveModeState");
        if (saved) {
          const parsed = JSON.parse(saved);
          this.state = {
            ...this.getInitialState(),
            ...parsed,
            botSettings: new Map(Object.entries(parsed.botSettings || {})),
          };
        }
      }
    } catch (error) {
      console.error("[LiveModeManager] Failed to load state:", error);
    }
  }

  // === CLEANUP ===

  destroy(): void {
    this.stopBackgroundProcesses();

    // Clear cooldown timers
    for (const timer of this.cooldownTimers.values()) {
      clearTimeout(timer);
    }
    this.cooldownTimers.clear();

    this.saveState();
  }
}

// Singleton instance
export const liveModeManager = new LiveModeManager();