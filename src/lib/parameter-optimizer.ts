// Self-Improving Parameter Optimizer
// Uses genetic algorithm / hill-climbing to optimize bot parameters
// Tracks performance across sessions and adapts based on market conditions

import type { StrategyType } from "../types";

export interface OptimizableParameters {
  betSize: number;
  interval: number;
  kellyFraction: number;
  maxBet: number;
  stopLoss: number;
  takeProfit: number;
  // Strategy-specific parameters
  threshold?: number; // For momentum, mean reversion
  rsiPeriod?: number;
  emaShort?: number;
  emaLong?: number;
}

export interface ParameterPerformance {
  parameters: OptimizableParameters;
  strategy: StrategyType;
  trades: number;
  wins: number;
  pnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  fitness: number; // Combined score
  generations: number; // How many times this lineage has evolved
  lastUpdated: number;
}

export interface MarketCondition {
  volatility: "low" | "medium" | "high";
  trend: "up" | "down" | "sideways";
  timeRemaining: number; // As fraction of market duration
}

interface OptimizationConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismCount: number;
  minTradesForEvaluation: number;
  fitnessWeights: {
    pnl: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

const DEFAULT_CONFIG: OptimizationConfig = {
  populationSize: 10,
  mutationRate: 0.2,
  crossoverRate: 0.7,
  elitismCount: 2,
  minTradesForEvaluation: 10,
  fitnessWeights: {
    pnl: 0.4,
    winRate: 0.2,
    sharpeRatio: 0.3,
    maxDrawdown: 0.1,
  },
};

// Default parameter bounds for strategies without specific bounds
const DEFAULT_BOUNDS: Record<string, [number, number]> = {
  betSize: [0.1, 2.0],
  interval: [1000, 15000],
  kellyFraction: [0.1, 0.8],
  maxBet: [0.5, 3.0],
  stopLoss: [0.05, 0.2],
  takeProfit: [0.1, 0.4],
};

// Parameter bounds by strategy
const PARAMETER_BOUNDS: Record<StrategyType, Record<string, [number, number]>> = {
  // === NEW STRATEGIES (Option A - Change the Game) ===
  volatility_breakout: {
    betSize: [0.5, 2.0],
    interval: [2000, 6000],
    kellyFraction: [0.2, 0.5],
  },
  time_pattern: {
    betSize: [0.5, 2.0],
    interval: [3000, 8000],
    kellyFraction: [0.2, 0.5],
  },
  price_reversion: {
    betSize: [0.5, 2.0],
    interval: [3000, 6000],
    kellyFraction: [0.2, 0.5],
  },
  binance_velocity: {
    betSize: [0.5, 2.0],
    interval: [1500, 4000],
    kellyFraction: [0.2, 0.5],
  },
  sniper_value: {
    betSize: [1.0, 5.0],        // Up to $5 per trade as per strategy
    interval: [2000, 5000],
    kellyFraction: [0.2, 0.5],
  },
  // === LEGACY STRATEGIES ===
  window_delta: {
    betSize: [0.5, 2.0],
    interval: [1500, 5000],
    kellyFraction: [0.2, 0.8],
    threshold: [0.03, 0.15], // delta threshold %
  },
  last_seconds_scalp: {
    betSize: [0.5, 2.5],
    interval: [300, 1000], // Very fast for sniper
    kellyFraction: [0.2, 0.7],
    threshold: [0.02, 0.08], // min delta for snipe
  },
  binance_signal: {
    betSize: [0.5, 2.0],
    interval: [800, 2000],
    kellyFraction: [0.2, 0.8],
    threshold: [0.02, 0.06],
  },
  monte_carlo: {
    betSize: [0.3, 1.5],
    interval: [3000, 10000],
    kellyFraction: [0.2, 0.7],
  },
  fair_value: {
    betSize: [0.3, 1.5],
    interval: [2000, 8000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.04, 0.10], // min edge %
  },
  momentum: {
    betSize: [0.3, 1.5],
    interval: [3000, 10000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.03, 0.08],
  },
  mean_reversion: {
    betSize: [0.3, 1.5],
    interval: [3000, 10000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.15, 0.30], // extreme delta for reversion
  },
  trend: {
    betSize: [0.3, 1.5],
    interval: [5000, 15000],
    kellyFraction: [0.2, 0.6],
  },
  smart_trend: {
    betSize: [0.3, 1.5],
    interval: [5000, 15000],
    kellyFraction: [0.2, 0.6],
  },
  contrarian: {
    betSize: [0.3, 1.5],
    interval: [4000, 12000],
    kellyFraction: [0.2, 0.6],
    threshold: [0.65, 0.80], // extreme price threshold
  },
  volatility: {
    betSize: [0.3, 2.0],
    interval: [3000, 10000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.05, 0.12],
  },
  anomaly: {
    betSize: [0.5, 2.0],
    interval: [2000, 8000],
    kellyFraction: [0.2, 0.7],
  },
  momentum_burst: {
    betSize: [0.3, 2.0],
    interval: [2000, 8000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.05, 0.15],
  },
  grid_trading: {
    betSize: [0.2, 1.0],
    interval: [5000, 15000],
    kellyFraction: [0.1, 0.5],
  },
  market_making: {
    betSize: [0.2, 1.0],
    interval: [3000, 10000],
    kellyFraction: [0.1, 0.5],
  },
  arbitrage: {
    betSize: [0.3, 1.5],
    interval: [3000, 10000],
    kellyFraction: [0.2, 0.7],
    threshold: [0.05, 0.12], // min edge
  },
  random: {
    betSize: [0.1, 0.5],
    interval: [5000, 15000],
    kellyFraction: [0.1, 0.3],
  },
};

class ParameterOptimizer {
  private performanceHistory: Map<string, ParameterPerformance[]> = new Map();
  private currentPopulation: Map<string, ParameterPerformance[]> = new Map();
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record performance of a parameter set.
   */
  recordPerformance(
    strategy: StrategyType,
    botId: string,
    parameters: OptimizableParameters,
    stats: {
      trades: number;
      wins: number;
      pnl: number;
      sharpeRatio: number;
      maxDrawdown: number;
    }
  ): void {
    const fitness = this.calculateFitness(stats);
    const performance: ParameterPerformance = {
      parameters,
      strategy,
      trades: stats.trades,
      wins: stats.wins,
      pnl: stats.pnl,
      sharpeRatio: stats.sharpeRatio,
      maxDrawdown: stats.maxDrawdown,
      fitness,
      generations: this.getGenerationCount(strategy, botId),
      lastUpdated: Date.now(),
    };

    // Add to history
    const historyKey = `${strategy}-${botId}`;
    const history = this.performanceHistory.get(historyKey) || [];
    history.push(performance);
    this.performanceHistory.set(historyKey, history);

    // Update population
    const popKey = strategy;
    const population = this.currentPopulation.get(popKey) || [];
    const existingIndex = population.findIndex(
      p => JSON.stringify(p.parameters) === JSON.stringify(parameters)
    );

    if (existingIndex >= 0) {
      population[existingIndex] = performance;
    } else {
      population.push(performance);
    }

    // Sort by fitness and trim
    population.sort((a, b) => b.fitness - a.fitness);
    if (population.length > this.config.populationSize) {
      population.length = this.config.populationSize;
    }

    this.currentPopulation.set(popKey, population);
  }

  /**
   * Get optimized parameters for a bot, potentially evolving from current.
   */
  getOptimizedParameters(
    strategy: StrategyType,
    currentParams: OptimizableParameters,
    marketCondition?: MarketCondition
  ): OptimizableParameters {
    const population = this.currentPopulation.get(strategy) || [];

    // If not enough data, return current parameters with slight randomization
    if (population.length < 2 || population[0].trades < this.config.minTradesForEvaluation) {
      return this.mutateParameters(strategy, currentParams, 0.1);
    }

    // Get best performer
    const best = population[0];

    // Apply market condition adjustments
    if (marketCondition) {
      return this.adjustForMarketCondition(strategy, best.parameters, marketCondition);
    }

    // Return best parameters with small random perturbation
    return this.mutateParameters(strategy, best.parameters, 0.05);
  }

  /**
   * Evolve parameters for next generation.
   */
  evolveParameters(strategy: StrategyType): OptimizableParameters[] {
    const population = this.currentPopulation.get(strategy) || [];

    if (population.length < 2) {
      return this.generateRandomPopulation(strategy);
    }

    const newPopulation: ParameterPerformance[] = [];

    // Elitism: keep top performers
    for (let i = 0; i < Math.min(this.config.elitismCount, population.length); i++) {
      newPopulation.push({
        ...population[i],
        generations: population[i].generations + 1,
      });
    }

    // Generate rest through crossover and mutation
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.selectParent(population);
      const parent2 = this.selectParent(population);

      if (Math.random() < this.config.crossoverRate) {
        const child = this.crossover(strategy, parent1.parameters, parent2.parameters);
        const mutated = this.mutateParameters(strategy, child, this.config.mutationRate);
        newPopulation.push({
          parameters: mutated,
          strategy,
          trades: 0,
          wins: 0,
          pnl: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          fitness: 0,
          generations: Math.max(parent1.generations, parent2.generations) + 1,
          lastUpdated: Date.now(),
        });
      } else {
        const mutated = this.mutateParameters(strategy, parent1.parameters, this.config.mutationRate);
        newPopulation.push({
          parameters: mutated,
          strategy,
          trades: 0,
          wins: 0,
          pnl: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          fitness: 0,
          generations: parent1.generations + 1,
          lastUpdated: Date.now(),
        });
      }
    }

    // Update population
    this.currentPopulation.set(strategy, newPopulation);

    return newPopulation.map(p => p.parameters);
  }

  /**
   * Get top performing parameters for a strategy.
   */
  getTopPerformers(strategy: StrategyType, count: number = 3): ParameterPerformance[] {
    const population = this.currentPopulation.get(strategy) || [];
    return population.slice(0, count);
  }

  /**
   * Get performance history for a specific bot.
   */
  getHistory(strategy: StrategyType, botId: string): ParameterPerformance[] {
    return this.performanceHistory.get(`${strategy}-${botId}`) || [];
  }

  /**
   * Calculate fitness score from performance stats.
   */
  private calculateFitness(stats: {
    trades: number;
    wins: number;
    pnl: number;
    sharpeRatio: number;
    maxDrawdown: number;
  }): number {
    if (stats.trades < this.config.minTradesForEvaluation) {
      return 0;
    }

    const winRate = stats.trades > 0 ? stats.wins / stats.trades : 0;
    const normalizedPnl = Math.tanh(stats.pnl / 10); // Normalize to [-1, 1]
    const normalizedSharpe = Math.tanh(stats.sharpeRatio / 2);
    const normalizedDrawdown = stats.maxDrawdown < 0 ? -stats.maxDrawdown : 0;

    const { fitnessWeights } = this.config;

    return (
      normalizedPnl * fitnessWeights.pnl +
      winRate * fitnessWeights.winRate +
      normalizedSharpe * fitnessWeights.sharpeRatio -
      normalizedDrawdown * fitnessWeights.maxDrawdown
    );
  }

  /**
   * Select a parent using tournament selection.
   */
  private selectParent(population: ParameterPerformance[]): ParameterPerformance {
    const tournamentSize = 3;
    const tournament: ParameterPerformance[] = [];

    for (let i = 0; i < tournamentSize; i++) {
      const index = Math.floor(Math.random() * population.length);
      tournament.push(population[index]);
    }

    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0];
  }

  /**
   * Crossover two parameter sets.
   */
  private crossover(
    strategy: StrategyType,
    parent1: OptimizableParameters,
    parent2: OptimizableParameters
  ): OptimizableParameters {
    const bounds = PARAMETER_BOUNDS[strategy];
    const child: OptimizableParameters = { ...parent1 };

    for (const key of Object.keys(bounds)) {
      const k = key as keyof OptimizableParameters;
      // Only copy if parent2 has a defined value for this key
      if (Math.random() < 0.5 && parent2[k] !== undefined) {
        (child as any)[k] = parent2[k];
      }
    }

    return child;
  }

  /**
   * Mutate parameters within bounds.
   */
  private mutateParameters(
    strategy: StrategyType,
    params: OptimizableParameters,
    mutationRate: number
  ): OptimizableParameters {
    const bounds = PARAMETER_BOUNDS[strategy] || DEFAULT_BOUNDS;
    const mutated: OptimizableParameters = { ...params };

    for (const key of Object.keys(bounds)) {
      if (Math.random() < mutationRate) {
        const k = key as keyof OptimizableParameters;
        const [min, max] = bounds[key];
        const range = max - min;
        const mutation = (Math.random() - 0.5) * 2 * range * mutationRate;
        const newValue = (mutated[k] as number) + mutation;
        (mutated as any)[k] = Math.max(min, Math.min(max, newValue));
      }
    }

    return mutated;
  }

  /**
   * Adjust parameters based on market conditions.
   */
  private adjustForMarketCondition(
    strategy: StrategyType,
    params: OptimizableParameters,
    condition: MarketCondition
  ): OptimizableParameters {
    const adjusted = { ...params };

    // Reduce bet size in high volatility
    if (condition.volatility === "high") {
      adjusted.betSize *= 0.7;
    } else if (condition.volatility === "low") {
      adjusted.betSize *= 1.2;
    }

    // Tighten stop loss in trending markets
    if (condition.trend !== "sideways") {
      adjusted.stopLoss *= 0.8;
    }

    // Adjust interval based on time remaining
    if (condition.timeRemaining < 0.25) {
      adjusted.interval *= 0.7; // Trade more frequently near end
    }

    // Clamp to bounds
    const bounds = PARAMETER_BOUNDS[strategy] || DEFAULT_BOUNDS;
    for (const key of Object.keys(bounds)) {
      const k = key as keyof OptimizableParameters;
      const [min, max] = bounds[key];
      if (adjusted[k] !== undefined) {
        (adjusted as any)[k] = Math.max(min, Math.min(max, adjusted[k] as number));
      }
    }

    return adjusted;
  }

  /**
   * Generate a random initial population.
   */
  private generateRandomPopulation(strategy: StrategyType): OptimizableParameters[] {
    const bounds = PARAMETER_BOUNDS[strategy] || DEFAULT_BOUNDS;
    const population: OptimizableParameters[] = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const params: OptimizableParameters = {
        betSize: 0.5,
        interval: 5000,
        kellyFraction: 0.5,
        maxBet: 1.0,
        stopLoss: 0.1,
        takeProfit: 0.2,
      };

      for (const key of Object.keys(bounds)) {
        const k = key as keyof OptimizableParameters;
        const [min, max] = bounds[key];
        (params as any)[k] = min + Math.random() * (max - min);
      }

      population.push(params);
    }

    return population;
  }

  /**
   * Get generation count for a bot's lineage.
   */
  private getGenerationCount(strategy: StrategyType, botId: string): number {
    const history = this.performanceHistory.get(`${strategy}-${botId}`) || [];
    if (history.length === 0) return 0;
    return Math.max(...history.map(h => h.generations)) + 1;
  }

  /**
   * Reset optimizer state.
   */
  reset(strategy?: StrategyType): void {
    if (strategy) {
      this.currentPopulation.delete(strategy);
      for (const key of this.performanceHistory.keys()) {
        if (key.startsWith(strategy)) {
          this.performanceHistory.delete(key);
        }
      }
    } else {
      this.currentPopulation.clear();
      this.performanceHistory.clear();
    }
  }
}

// Singleton instance
export const parameterOptimizer = new ParameterOptimizer();