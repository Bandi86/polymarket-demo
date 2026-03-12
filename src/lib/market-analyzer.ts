// Market Analyzer - Detects market conditions and recommends optimal strategies
// Analyzes price data to determine market phase and suggest best trading approach

import type { StrategyType } from "../types";
import { analyticsService, type MarketPhase } from "./analytics";

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
  trending_up: ["momentum_chaser", "ta_signal_engine", "whale_follower"],
  trending_down: ["momentum_chaser", "ta_signal_engine"],
  ranging: ["mean_reversion_sniper", "sum_to_one_arb", "market_maker"],
  volatile: ["momentum_chaser", "ta_signal_engine"],
};

// Strategy display names for UI
const STRATEGY_NAMES: Record<StrategyType, string> = {
  momentum_chaser: "Momentum Chaser",
  mean_reversion_sniper: "Mean Reversion Sniper",
  sum_to_one_arb: "Sum-to-One Arbitrage",
  whale_follower: "Whale Follower",
  ta_signal_engine: "TA Signal Engine",
  market_maker: "Market Maker",
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
      "momentum_chaser", "mean_reversion_sniper", "sum_to_one_arb",
      "whale_follower", "ta_signal_engine", "market_maker",
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
}

// Singleton instance
export const marketAnalyzer = new MarketAnalyzer();