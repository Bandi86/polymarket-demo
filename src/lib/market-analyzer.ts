// Market Analyzer - Detects market conditions and recommends optimal strategies
// Analyzes price data to determine market phase and suggest best trading approach
//
// FIX: Added price validation to detect Polymarket CLOB mispricing anomalies

import type { StrategyType } from "../types";
import { analyticsService, type MarketPhase } from "./analytics";
import { priceService } from "./price";

export interface MarketRecommendation {
  phase: MarketPhase;
  confidence: number;
  recommendedStrategy: StrategyType;
  alternativeStrategies: StrategyType[];
  reason: string;
  metrics: {
    trendStrength: number;
    volatilityLevel: number;
    pricePosition: number;
  };
  historicalPerformance?: {
    winRate: number;
    avgPnL: number;
    trades: number;
  };
}

// Strategy performance by market phase (learned from historical data)
const STRATEGY_PERFORMANCE_BY_PHASE: Record<MarketPhase, StrategyType[]> = {
  trending_up: ["momentum", "trend", "smart_trend"],
  trending_down: ["momentum", "trend"],
  ranging: ["mean_reversion", "arbitrage", "market_making"],
  volatile: ["momentum", "volatility"],
};

// Strategy display names for UI
const STRATEGY_NAMES: Record<StrategyType, string> = {
  // NEW STRATEGIES
  volatility_breakout: "Volatility Breakout",
  ultra_low_entry: "Ultra Low Entry",
  trend_pullback: "Trend Pullback",
  price_reversion: "Price Reversion",
  binance_velocity: "Binance Velocity",
  sniper_value: "Sniper Value",
  odds_swing: "Odds Swing",
  // LEGACY STRATEGIES
  window_delta: "Window Delta",
  last_seconds_scalp: "Last Seconds Scalp",
  binance_signal: "Binance Signal",
  monte_carlo: "Monte Carlo",
  fair_value: "Fair Value",
  momentum: "Momentum",
  mean_reversion: "Mean Reversion",
  trend: "Trend Following",
  smart_trend: "Smart Trend",
  contrarian: "Contrarian",
  volatility: "Volatility",
  anomaly: "Anomaly",
  momentum_burst: "Momentum Burst",
  grid_trading: "Grid Trading",
  market_making: "Market Making",
  arbitrage: "Arbitrage",
  random: "Random",
};

export class MarketAnalyzer {
  private priceHistory: number[] = [];
  private lastPhase: MarketPhase = "ranging";
  private phaseHistory: Array<{ timestamp: number; phase: MarketPhase }> = [];

  /**
   * Update price history with new data
   */
  updatePriceHistory(prices: number[]): void {
    this.priceHistory = prices;
    this.analyzeAndRecordPhase();
  }

  /**
   * Add a single price point
   */
  addPrice(price: number): void {
    this.priceHistory.push(price);
    // Keep last 100 price points
    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }
    this.analyzeAndRecordPhase();
  }

  /**
   * Analyze current market and get recommendation
   */
  getRecommendation(): MarketRecommendation {
    const analysis = analyticsService.analyzeMarketPhase(this.priceHistory);

    const primaryStrategy = analysis.recommendedStrategy as StrategyType;
    const alternatives = this.getAlternativeStrategies(analysis.phase);

    return {
      phase: analysis.phase,
      confidence: analysis.confidence,
      recommendedStrategy: primaryStrategy,
      alternativeStrategies: alternatives,
      reason: analysis.reason,
      metrics: analysis.metrics,
    };
  }

  /**
   * Get alternative strategies for the current phase
   */
  private getAlternativeStrategies(phase: MarketPhase): StrategyType[] {
    const strategies = STRATEGY_PERFORMANCE_BY_PHASE[phase] || [];
    return strategies.slice(1, 4); // Return top 3 alternatives
  }

  /**
   * Analyze and record phase change
   */
  private analyzeAndRecordPhase(): void {
    const analysis = analyticsService.analyzeMarketPhase(this.priceHistory);

    if (analysis.phase !== this.lastPhase) {
      this.phaseHistory.push({
        timestamp: Date.now(),
        phase: analysis.phase,
      });

      // Keep last 100 phase changes
      if (this.phaseHistory.length > 100) {
        this.phaseHistory.shift();
      }

      this.lastPhase = analysis.phase;
    }
  }

  /**
   * Get current market phase
   */
  getCurrentPhase(): MarketPhase {
    return this.lastPhase;
  }

  /**
   * Get phase history
   */
  getPhaseHistory(limit: number = 20): Array<{ timestamp: number; phase: MarketPhase }> {
    return this.phaseHistory.slice(-limit);
  }

  /**
   * Get strategy display name
   */
  getStrategyName(strategy: StrategyType): string {
    return STRATEGY_NAMES[strategy] || strategy;
  }

  /**
   * Check if conditions are favorable for a specific strategy
   */
  isFavorableFor(strategy: StrategyType): { favorable: boolean; reason: string } {
    const recommendation = this.getRecommendation();
    const phaseStrategies = STRATEGY_PERFORMANCE_BY_PHASE[recommendation.phase] || [];

    const index = phaseStrategies.indexOf(strategy);
    if (index === -1) {
      return {
        favorable: false,
        reason: `${STRATEGY_NAMES[strategy]} is not optimal for ${recommendation.phase} markets`,
      };
    }

    if (index === 0) {
      return {
        favorable: true,
        reason: `${STRATEGY_NAMES[strategy]} is the top performer in ${recommendation.phase} markets`,
      };
    }

    return {
      favorable: true,
      reason: `${STRATEGY_NAMES[strategy]} is #${index + 1} for ${recommendation.phase} markets`,
    };
  }

  /**
   * Get all strategy recommendations with rankings
   */
  getAllRecommendations(): Array<{
    strategy: StrategyType;
    name: string;
    rank: number;
    favorable: boolean;
    reason: string;
  }> {
    const recommendation = this.getRecommendation();
    const phaseStrategies = STRATEGY_PERFORMANCE_BY_PHASE[recommendation.phase] || [];

    const allStrategies: StrategyType[] = [
      "momentum", "mean_reversion", "arbitrage",
      "trend", "volatility", "market_making",
    ];

    return allStrategies.map(strategy => {
      const index = phaseStrategies.indexOf(strategy);
      return {
        strategy,
        name: STRATEGY_NAMES[strategy],
        rank: index >= 0 ? index + 1 : 99,
        favorable: index >= 0 && index < 3,
        reason: index === 0
          ? "Best match for current conditions"
          : index > 0
            ? `Good for ${recommendation.phase} markets`
            : "Not optimal for current conditions",
      };
    }).sort((a, b) => a.rank - b.rank);
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.priceHistory = [];
    this.lastPhase = "ranging";
    this.phaseHistory = [];
  }

  /**
   * PRICE VALIDATION: Detect Polymarket CLOB mispricing anomalies
   * Compares implied probability from YES/NO prices with actual BTC price movement
   *
   * Usage: Call before trade to ensure market prices reflect reality
   *
   * @param yesPrice - Current YES price (0-1)
   * @param noPrice - Current NO price (0-1)
   * @param btcStartPrice - BTC price at market start
   * @param btcCurrentPrice - Current BTC price
   * @returns True if prices are valid, false if anomaly detected
   */
  validateMarketPrices(
    yesPrice: number,
    noPrice: number,
    btcStartPrice: number,
    btcCurrentPrice: number
  ): { valid: boolean; reason?: string; severity: 'none' | 'warning' | 'critical' } {
    // Calculate actual BTC movement
    const btcChange = btcStartPrice > 0
      ? ((btcCurrentPrice - btcStartPrice) / btcStartPrice)
      : 0;

    // Implied probability from YES price
    const impliedUpProb = yesPrice;

    // Actual direction
    const actualDirection = btcChange >= 0 ? 'UP' : 'DOWN';
    const impliedDirection = impliedUpProb >= 0.5 ? 'UP' : 'DOWN';

    // Check for mismatch
    if (actualDirection !== impliedDirection) {
      // MISMATCH: Market pricing opposite of reality
      const severity: 'warning' | 'critical' = Math.abs(btcChange) > 0.001 ? 'critical' : 'warning';

      return {
        valid: false,
        reason: `Market mispricing detected: BTC ${actualDirection} (${(btcChange * 100).toFixed(3)}%) but market implies ${impliedDirection} (${(impliedUpProb * 100).toFixed(1)}%)`,
        severity,
      };
    }

    // Check for extreme mispricing (YES + NO should ≈ 1.0)
    const sum = yesPrice + noPrice;
    if (Math.abs(sum - 1.0) > 0.15) {
      return {
        valid: false,
        reason: `Abnormal YES/NO spread: ${yesPrice.toFixed(3)} + ${noPrice.toFixed(3)} = ${sum.toFixed(3)} (expected ~1.0)`,
        severity: 'warning',
      };
    }

    // All checks passed
    return { valid: true, severity: 'none' };
  }
}

// Singleton instance
export const marketAnalyzer = new MarketAnalyzer();