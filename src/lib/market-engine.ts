// Unified Market Engine - Manages Polymarket prediction markets
// Uses real data from Polymarket API with auto-rollover

import type { Market, Position, Portfolio, MarketHistory, Trade } from "../types";
import { priceService } from "./price";
import { dbService } from "./database";
import { polymarketProvider } from "./providers/polymarket-provider";

const FEE_RATE = 0.02; // 2%
const MARKET_PRICE_UPDATE_INTERVAL = 200; // 200ms - faster updates for real-time feel
const MARKET_SWITCH_COOLDOWN = 3000; // 3 seconds between switches

export interface MarketEngineConfig {
  feeRate?: number;
  startingBalance?: number;
  timeframe?: string;
  asset?: string;
  /** Base bid-ask spread (fraction 0-1, default 0.01 = 1%) */
  baseSpread?: number;
  /** Max random slippage above spread (fraction 0-1, default 0.01 = 1%) */
  maxSlippage?: number;
  /** Whether slippage is enabled (default true) */
  slippageEnabled?: boolean;
}

export class MarketEngine {
  private currentMarket: Market | null = null;
  private availableMarkets: Market[] = [];
  private positions: Map<string, Position> = new Map();
  private portfolios: Map<string, Portfolio> = new Map();
  private mainPortfolio: Portfolio;
  private marketHistory: Map<string, MarketHistory> = new Map();
  private mode: "real" | "simulated" = "real";
  private config: Required<MarketEngineConfig>;
  private priceUpdateTimer: Timer | null = null;
  private lastMarketSwitch = 0;
  private settledMarketIds: Set<string> = new Set();
  private priceUpdateCallbacks: Array<(price: { yes: number; no: number; timestamp: number }) => void> = [];
  /** BTC price at market start - used for realistic settlement */
  private marketStartBtcPrice: number | null = null;

  constructor(config: MarketEngineConfig = {}) {
    this.config = {
      feeRate: config.feeRate ?? FEE_RATE,
      startingBalance: config.startingBalance ?? 10,
      timeframe: config.timeframe ?? "5",
      asset: config.asset ?? "BTC",
      baseSpread: config.baseSpread ?? 0.01,
      maxSlippage: config.maxSlippage ?? 0.01,
      slippageEnabled: config.slippageEnabled ?? true,
    };

    this.mainPortfolio = this.createEmptyPortfolio();
    this.startNewMarket();
  }

  /** Subscribe to price updates */
  onPriceUpdate(callback: (price: { yes: number; no: number; timestamp: number }) => void): () => void {
    this.priceUpdateCallbacks.push(callback);
    return () => {
      const index = this.priceUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.priceUpdateCallbacks.splice(index, 1);
      }
    };
  }

  /** Get current timeframe */
  getTimeframe(): string {
    return this.config.timeframe;
  }

  /** Get current asset */
  getAsset(): string {
    return this.config.asset;
  }

  /** Switch to a different timeframe */
  async setTimeframe(timeframe: string): Promise<boolean> {
    // Prevent rapid switching
    if (Date.now() - this.lastMarketSwitch < MARKET_SWITCH_COOLDOWN) {
      console.log("[MarketEngine] Market switch cooldown active");
      return false;
    }

    this.config.timeframe = timeframe;
    polymarketProvider.setTimeframe(timeframe);

    // Settle current market if exists
    if (this.currentMarket) {
      const finalYes = parseFloat(this.currentMarket.outcomePrices.yes);
      this.settleMarket(finalYes);
    }

    // Clear cache and fetch new markets
    polymarketProvider.clearCache();
    await this.startNewMarket();

    this.lastMarketSwitch = Date.now();
    return true;
  }

  /** Switch to a different asset */
  async setAsset(asset: string): Promise<boolean> {
    if (Date.now() - this.lastMarketSwitch < MARKET_SWITCH_COOLDOWN) {
      console.log("[MarketEngine] Market switch cooldown active");
      return false;
    }

    this.config.asset = asset;

    // Find market for this asset
    const markets = await polymarketProvider.fetchActiveMarkets(this.config.timeframe);
    const assetMarket = markets.find(m =>
      m.asset === asset || m.category?.startsWith(asset)
    );

    if (assetMarket) {
      if (this.currentMarket) {
        const finalYes = parseFloat(this.currentMarket.outcomePrices.yes);
        this.settleMarket(finalYes);
      }
      this.setActiveMarket(assetMarket);
      this.lastMarketSwitch = Date.now();
      return true;
    }

    return false;
  }

  private createEmptyPortfolio(): Portfolio {
    return {
      balance: this.config.startingBalance,
      initialBalance: this.config.startingBalance,
      positions: [],
      totalPnL: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      roi: 0,
      openPositions: [],
      closedPositions: [],
      maxDrawdown: 0,
      sharpeRatio: 0,
    };
  }

  private async saveToDatabase(market: Market, positions: Position[]): Promise<void> {
    try {
      await dbService.saveMarket({
        id: market.id,
        question: market.question,
        description: market.description,
        startTime: market.startTime,
        endTime: market.endTime,
        startPrice: market.startPrice,
        endPrice: market.endPrice,
        status: market.status,
        result: market.result,
        outcomeYes: parseFloat(market.outcomePrices?.yes || "0.5"),
        outcomeNo: parseFloat(market.outcomePrices?.no || "0.5"),
        volume: market.volumeNum || 0,
        liquidity: market.liquidity || 0,
        category: market.category || "Crypto",
      });

      for (const pos of positions) {
        await dbService.savePosition({
          id: pos.id,
          marketId: pos.marketId,
          outcome: pos.outcome,
          amount: pos.amount,
          odds: pos.odds,
          stake: pos.stake,
          fee: pos.fee,
          timestamp: pos.timestamp,
          status: pos.status,
          pnl: pos.pnl,
          botId: pos.botId || null,
          botName: pos.botId ? `bot-${pos.botId}` : null,
        });
      }
    } catch (error) {
      console.error("[MarketEngine] Database save error:", error);
    }
  }

  private async startNewMarket(): Promise<void> {
    const markets = await polymarketProvider.fetchActiveMarkets(this.config.timeframe);
    this.availableMarkets = markets;

    const now = Date.now();
    // Filter markets: not settled, not expired, and has at least 30s remaining
    const validMarkets = markets.filter(m => 
      !this.settledMarketIds.has(m.id) && 
      m.endTime > now + 30000 && 
      m.status === "active"
    );

    if (validMarkets.length === 0) {
      console.warn(`[MarketEngine] No valid Polymarket markets found for ${this.config.timeframe} (checked ${markets.length}), retrying in 10s...`);
      // If we are stuck, we might need to clear settledMarketIds if it's too large, but for now just wait
      if (this.settledMarketIds.size > 100) this.settledMarketIds.clear();
      
      setTimeout(() => this.startNewMarket(), 10000);
      return;
    }

    // Find market for current asset, or use first available
    const assetMarket = validMarkets.find(m =>
      m.asset === this.config.asset || m.category?.startsWith(this.config.asset)
    );

    this.setActiveMarket(assetMarket || validMarkets[0]);
  }

  private setActiveMarket(market: Market): void {
    // Initialize YES price history with current price
    market.yesPriceHistory = [
      { timestamp: Date.now(), price: parseFloat(market.outcomePrices.yes) },
    ];

    this.currentMarket = market;

    // Record BTC price at market start for realistic settlement
    // If price service not ready, wait for it or fetch directly
    if (priceService.isReady()) {
      this.marketStartBtcPrice = priceService.getPrice();
      console.log(`[MarketEngine] BTC at market start: $${this.marketStartBtcPrice?.toFixed(2)}`);
    } else {
      // Fetch price directly from Binance API if service not ready
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        .then(res => res.json())
        .then(data => {
          this.marketStartBtcPrice = parseFloat(data.price);
          console.log(`[MarketEngine] BTC at market start (fetched): $${this.marketStartBtcPrice?.toFixed(2)}`);
        })
        .catch(err => {
          console.error("[MarketEngine] Failed to fetch BTC price:", err);
          // Fallback: wait for price service to be ready
          priceService.onReady(() => {
            if (!this.marketStartBtcPrice) {
              this.marketStartBtcPrice = priceService.getPrice();
              console.log(`[MarketEngine] BTC at market start (onReady): $${this.marketStartBtcPrice?.toFixed(2)}`);
            }
          });
        });
    }

    // Update config from market data
    if (market.timeframe) {
      this.config.timeframe = market.timeframe;
    }
    if (market.asset) {
      this.config.asset = market.asset;
    }

    this.startPriceUpdateTimer();

    console.log(`[MarketEngine] Active market: "${market.question}"`);
    console.log(`[MarketEngine]   Asset: ${this.config.asset} | Timeframe: ${this.config.timeframe}m`);
    console.log(`[MarketEngine]   YES=${market.outcomePrices.yes} | Ends: ${new Date(market.endTime).toLocaleString()}`);
  }

  private startPriceUpdateTimer(): void {
    if (this.priceUpdateTimer) {
      clearTimeout(this.priceUpdateTimer);
    }
    this.scheduleNextPriceUpdate();
  }

  private scheduleNextPriceUpdate(): void {
    this.priceUpdateTimer = setTimeout(async () => {
      try {
        await this.updateMarketPrices();
      } finally {
        if (this.currentMarket && this.currentMarket.status === "active") {
          this.scheduleNextPriceUpdate();
        }
      }
    }, MARKET_PRICE_UPDATE_INTERVAL);
  }

  private async updateMarketPrices(): Promise<void> {
    if (!this.currentMarket) return;

    // Check if market has expired
    if (Date.now() > this.currentMarket.endTime) {
      console.log("[MarketEngine] Market expired, settling and rolling over...");
      const finalYes = parseFloat(this.currentMarket.outcomePrices.yes);
      this.settleMarket(finalYes);
      return;
    }

    // Always fetch real prices from Polymarket API
    const prices = await polymarketProvider.fetchMarketPriceByMarketId(this.currentMarket.id, this.currentMarket.tokens);
    if (prices) {
      const oldYesPrice = parseFloat(this.currentMarket.outcomePrices.yes);
      this.currentMarket.outcomePrices = prices;
      const newYesPrice = parseFloat(prices.yes);

      // Only log if price changed significantly
      if (Math.abs(newYesPrice - oldYesPrice) > 0.001) {
        console.log(`[MarketEngine] Price update: YES=${prices.yes} NO=${prices.no}`);
      }

      // Notify subscribers
      const timestamp = Date.now();
      for (const callback of this.priceUpdateCallbacks) {
        try {
          callback({
            yes: newYesPrice,
            no: parseFloat(prices.no),
            timestamp,
          });
        } catch (e) {
          console.error("[MarketEngine] Price callback error:", e);
        }
      }
    } else {
      console.warn(`[MarketEngine] Failed to fetch prices for market ${this.currentMarket.id}`);
    }

    // Track YES price history for chart
    if (!this.currentMarket.yesPriceHistory) {
      this.currentMarket.yesPriceHistory = [];
    }
    this.currentMarket.yesPriceHistory.push({
      timestamp: Date.now(),
      price: parseFloat(this.currentMarket.outcomePrices.yes),
    });
    // Keep last 200 data points
    if (this.currentMarket.yesPriceHistory.length > 200) {
      this.currentMarket.yesPriceHistory.shift();
    }
  }

  private settleMarket(finalYesPrice: number): Market | null {
    if (!this.currentMarket) return null;

    const market = this.currentMarket;
    market.endPrice = finalYesPrice;
    market.status = "settled";

    // Use actual BTC price movement for settlement (not market sentiment)
    const currentBtcPrice = priceService.getPrice();
    const btcStartPrice = this.marketStartBtcPrice || currentBtcPrice;
    const btcChange = currentBtcPrice - btcStartPrice;
    const btcChangePercent = (btcChange / btcStartPrice) * 100;
    market.result = btcChange >= 0 ? "UP" : "DOWN";

    console.log(`[MarketEngine] SETTLEMENT: BTC $${btcStartPrice.toFixed(2)} → $${currentBtcPrice.toFixed(2)} (${btcChangePercent >= 0 ? '+' : ''}${btcChangePercent.toFixed(3)}%) → ${market.result}`);

    // Add to settled set to avoid immediate rollover back to this market
    this.settledMarketIds.add(market.id);

    // Settle all open positions
    const marketPositions: Position[] = [];

    for (const [, position] of this.positions) {
      if (position.marketId !== market.id || position.status !== "open") continue;

      const won =
        (position.outcome === "YES" && market.result === "UP") ||
        (position.outcome === "NO" && market.result === "DOWN");

      position.status = "settled";
      const payout = won ? position.stake : 0;
      position.pnl = payout - position.amount - position.fee;
      position.exitPrice = finalYesPrice;
      position.exitTime = Date.now();
      position.currentValue = payout;
      position.unrealizedPnl = position.pnl;

      // Enhanced settlement logging
      console.log(`[MarketEngine] SETTLEMENT: ${position.botId || 'manual'} | ${position.outcome} | ${won ? 'WON' : 'LOST'} | Entry: ${position.odds.toFixed(3)} | Exit: ${finalYesPrice.toFixed(3)} | PnL: $${position.pnl.toFixed(2)} | Market: ${market.result} (YES=${finalYesPrice.toFixed(3)})`);

      // Update portfolio
      const portfolio = position.botId
        ? this.portfolios.get(position.botId)
        : this.mainPortfolio;

      if (portfolio) {
        if (won) {
          portfolio.balance += payout;
          portfolio.winningTrades++;
        } else {
          portfolio.losingTrades++;
        }

        portfolio.totalTrades++;
        portfolio.totalPnL += position.pnl;
        portfolio.winRate = portfolio.totalTrades > 0 ? portfolio.winningTrades / portfolio.totalTrades : 0;
        portfolio.roi = (portfolio.totalPnL / portfolio.initialBalance) * 100;

        portfolio.openPositions = portfolio.openPositions.filter((p) => p.id !== position.id);
        portfolio.closedPositions.unshift(position);
        this.updatePortfolioMetrics(portfolio);
      }

      marketPositions.push(position);
    }

    // Add to history
    this.marketHistory.set(market.id, {
      id: market.id,
      result: market.result,
      startPrice: market.startPrice,
      endPrice: finalYesPrice,
      startTime: market.startTime,
      endTime: Date.now(),
      volume: market.volumeNum || 0,
    });

    // Save to DB async
    this.saveToDatabase(market, marketPositions).catch((e) =>
      console.error("[MarketEngine] DB save error:", e)
    );

    // Clear cache to ensure fresh markets are fetched
    polymarketProvider.clearCache();

    // Auto-rollover to next market
    this.startNewMarket();

    return market;
  }

  private updatePortfolioMetrics(portfolio: Portfolio): void {
    const equityCurve = [portfolio.initialBalance];
    let runningBalance = portfolio.initialBalance;

    for (const pos of portfolio.closedPositions) {
      runningBalance += pos.pnl || 0;
      equityCurve.push(runningBalance);
    }

    let peak = equityCurve[0];
    let maxDrawdown = 0;

    for (const value of equityCurve) {
      if (value > peak) peak = value;
      const drawdown = (peak - value) / (peak || 1);
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    portfolio.maxDrawdown = maxDrawdown;

    if (portfolio.closedPositions.length >= 2) {
      const returns = portfolio.closedPositions.map((p) => (p.pnl || 0) / (portfolio.initialBalance || 1));
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      portfolio.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    }
  }

  /**
   * Calculate slippage for a trade based on amount and current odds.
   * Returns a positive number (buyer pays more) or 0 if disabled.
   * Components: base spread + random slippage + size impact.
   */
  private calculateSlippage(amount: number, currentOdds: number): number {
    if (!this.config.slippageEnabled) return 0;

    // 1) Half-spread: buyer pays above mid-price
    const halfSpread = this.config.baseSpread / 2;

    // 2) Random slippage component (uniform 0..maxSlippage)
    const randomSlippage = Math.random() * this.config.maxSlippage;

    // 3) Size-based impact: larger bets move price more
    //    Linear scaling: $1 = 0%, $5 = 0.5%, $10 = 1%
    const sizeImpact = Math.max(0, (amount - 1) * 0.001);

    // Total slippage — capped to prevent odds > 0.99 or < 0.01
    const totalSlippage = halfSpread + randomSlippage + sizeImpact;

    return totalSlippage;
  }

  // === Public API ===

  getCurrentMarket(): Market | null {
    return this.currentMarket;
  }

  getAvailableMarkets(): Market[] {
    return this.availableMarkets;
  }

  getMarketHistory(limit: number = 50): MarketHistory[] {
    return Array.from(this.marketHistory.values()).slice(-limit);
  }

  getTimeRemaining(): number {
    if (!this.currentMarket) return 0;
    return Math.max(0, this.currentMarket.endTime - Date.now());
  }

  getProgress(): number {
    if (!this.currentMarket) return 0;
    const totalDuration = this.currentMarket.endTime - this.currentMarket.startTime;
    if (totalDuration <= 0) return 100;
    const elapsed = Date.now() - this.currentMarket.startTime;
    return Math.min(100, (elapsed / totalDuration) * 100);
  }

  /** Switch to a different market by ID */
  async switchMarket(marketId: string): Promise<boolean> {
    // Settle current market first
    if (this.currentMarket) {
      const finalYes = parseFloat(this.currentMarket.outcomePrices.yes);
      this.settleMarket(finalYes);
    }

    // Find the target market
    const markets = await polymarketProvider.fetchAllCryptoMarkets();
    const target = markets.find((m) => m.id === marketId);
    if (!target) return false;

    this.setActiveMarket(target);
    return true;
  }

  placeTrade(outcome: "YES" | "NO", amount: number, botId?: string): Position | null {
    if (!this.currentMarket || this.currentMarket.status !== "active") {
      console.error("[MarketEngine] No active market");
      return null;
    }

    const portfolio = botId
      ? this.portfolios.get(botId) || this.createEmptyPortfolio()
      : this.mainPortfolio;

    const fee = amount * this.config.feeRate;
    const totalCost = amount + fee;

    if (portfolio.balance < totalCost) {
      return null;
    }

    if (amount < 0.01) {
      return null;
    }

    const yesPrice = parseFloat(this.currentMarket.outcomePrices.yes);
    const rawOdds = outcome === "YES" ? yesPrice : 1 - yesPrice;

    // Apply slippage: buyer gets slightly worse fill price
    const slippage = this.calculateSlippage(amount, rawOdds);
    const odds = Math.max(0.01, Math.min(0.99, rawOdds + slippage));

    const position: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      marketId: this.currentMarket.id,
      outcome,
      amount,
      odds,
      stake: amount / odds,
      fee,
      timestamp: Date.now(),
      status: "open",
      pnl: null,
      botId,
      unrealizedPnl: 0,
    };

    portfolio.balance -= totalCost;
    portfolio.positions.push(position);
    portfolio.openPositions.push(position);

    if (botId) {
      this.portfolios.set(botId, portfolio);
    }

    this.positions.set(position.id, position);
    return position;
  }

  closePosition(positionId: string): Position | null {
    const position = this.positions.get(positionId);
    if (!position || position.status !== "open") return null;

    const currentMarket = this.getCurrentMarket();
    if (!currentMarket) return null;

    const currentYesPrice = parseFloat(currentMarket.outcomePrices.yes);
    const currentOdds = position.outcome === "YES" ? currentYesPrice : 1 - currentYesPrice;

    const exitValue = position.amount * (currentOdds / position.odds) * 0.98; // 2% exit fee
    const pnl = exitValue - position.amount - position.fee;

    position.status = "closed";
    position.pnl = pnl;
    position.exitPrice = currentOdds;
    position.exitTime = Date.now();
    position.currentValue = exitValue;
    position.unrealizedPnl = pnl;

    const portfolio = position.botId
      ? this.portfolios.get(position.botId)
      : this.mainPortfolio;

    if (portfolio) {
      portfolio.balance += exitValue;
      portfolio.totalPnL += pnl;
      portfolio.openPositions = portfolio.openPositions.filter((p) => p.id !== positionId);
      portfolio.closedPositions.unshift(position);

      if (pnl > 0) {
        portfolio.winningTrades++;
      } else {
        portfolio.losingTrades++;
      }
      portfolio.totalTrades++;
      portfolio.winRate = portfolio.totalTrades > 0 ? portfolio.winningTrades / portfolio.totalTrades : 0;
      portfolio.roi = (portfolio.totalPnL / portfolio.initialBalance) * 100;
      this.updatePortfolioMetrics(portfolio);
    }

    return position;
  }

  getPortfolio(botId?: string): Portfolio {
    if (botId) {
      const portfolio = this.portfolios.get(botId);
      if (portfolio) {
        const currentMarket = this.getCurrentMarket();
        if (currentMarket) {
          const yesPrice = parseFloat(currentMarket.outcomePrices.yes);
          portfolio.openPositions = portfolio.openPositions.map((pos) => {
            if (pos.status !== "open") return pos;
            const currentOdds = pos.outcome === "YES" ? yesPrice : 1 - yesPrice;
            const currentValue = pos.amount * (currentOdds / pos.odds);
            const unrealizedPnl = currentValue - pos.amount - pos.fee;
            return { ...pos, currentValue, unrealizedPnl };
          });
        }
        return { ...portfolio };
      }
      return this.createEmptyPortfolio();
    }

    this.updateMainPortfolio();
    return { ...this.mainPortfolio };
  }

  private updateMainPortfolio(): void {
    const allPositions = Array.from(this.positions.values());
    const settled = allPositions.filter((p) => p.status === "settled" || p.status === "closed");
    const open = allPositions.filter((p) => p.status === "open" && !p.botId);

    this.mainPortfolio.totalTrades = settled.filter((p) => !p.botId).length;
    this.mainPortfolio.winningTrades = settled.filter((p) => !p.botId && (p.pnl || 0) > 0).length;
    this.mainPortfolio.losingTrades = settled.filter((p) => !p.botId && (p.pnl || 0) <= 0).length;
    this.mainPortfolio.totalPnL = settled.filter((p) => !p.botId).reduce((sum, p) => sum + (p.pnl || 0), 0);
    this.mainPortfolio.winRate = this.mainPortfolio.totalTrades > 0 ? this.mainPortfolio.winningTrades / this.mainPortfolio.totalTrades : 0;
    this.mainPortfolio.roi = (this.mainPortfolio.totalPnL / this.mainPortfolio.initialBalance) * 100;
    this.mainPortfolio.openPositions = open;
    this.mainPortfolio.closedPositions = settled.filter((p) => !p.botId).slice(0, 50);
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  getOpenPositions(botId?: string): Position[] {
    return Array.from(this.positions.values()).filter(
      (p) => p.status === "open" && (botId === undefined || p.botId === botId)
    );
  }

  getClosedPositions(botId?: string): Position[] {
    const positions = Array.from(this.positions.values());
    if (botId) {
      return positions.filter((p) => (p.status === "settled" || p.status === "closed") && p.botId === botId);
    }
    return positions.filter((p) => p.status === "settled" || p.status === "closed");
  }

  initBotPortfolio(botId: string, startingBalance?: number): Portfolio {
    if (!this.portfolios.has(botId)) {
      this.portfolios.set(botId, this.createEmptyPortfolio());
      if (startingBalance !== undefined) {
        const portfolio = this.portfolios.get(botId)!;
        portfolio.balance = startingBalance;
        portfolio.initialBalance = startingBalance;
      }
    }
    return this.portfolios.get(botId)!;
  }

  getBotPortfolio(botId: string): Portfolio {
    return this.portfolios.get(botId) || this.createEmptyPortfolio();
  }

  getMarketStats(): { totalMarkets: number; totalPositions: number; totalVolume: number; activePositions: number } {
    const allPositions = Array.from(this.positions.values());
    return {
      totalMarkets: this.marketHistory.size + (this.currentMarket ? 1 : 0),
      totalPositions: allPositions.length,
      totalVolume: allPositions.reduce((sum, p) => sum + p.amount, 0),
      activePositions: allPositions.filter((p) => p.status === "open").length,
    };
  }

  /** Get YES price history for charts */
  getYesPriceHistory(): { timestamp: number; price: number }[] {
    return this.currentMarket?.yesPriceHistory || [];
  }

  setMode(mode: "real" | "simulated", startingBalance?: number): void {
    this.mode = mode;
    if (startingBalance !== undefined) {
      this.config.startingBalance = startingBalance;
      this.mainPortfolio.balance = startingBalance;
      this.mainPortfolio.initialBalance = startingBalance;
    }
  }

  getMode(): "real" | "simulated" {
    return this.mode;
  }

  forceNewMarket(): void {
    if (this.currentMarket) {
      const finalYes = parseFloat(this.currentMarket.outcomePrices.yes);
      this.settleMarket(finalYes);
    } else {
      this.startNewMarket();
    }
  }

  reset(): void {
    this.mainPortfolio = this.createEmptyPortfolio();
    this.portfolios.clear();
    this.positions.clear();
    this.marketHistory.clear();
    this.startNewMarket();
  }

  async disposing(): Promise<void> {
    if (this.priceUpdateTimer) clearInterval(this.priceUpdateTimer);
    if (this.currentMarket) {
      const positions = Array.from(this.positions.values());
      await this.saveToDatabase(this.currentMarket, positions);
    }
  }
}

// Singleton instance
export const marketEngine = new MarketEngine();
