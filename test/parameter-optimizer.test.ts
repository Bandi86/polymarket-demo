/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parameterOptimizer } from '../src/lib/parameter-optimizer';
import type { OptimizableParameters } from '../src/lib/parameter-optimizer';
import type { StrategyType } from '../src/types';

describe('ParameterOptimizer', () => {
  beforeEach(() => {
    parameterOptimizer.reset();
  });

  const testParams: OptimizableParameters = {
    betSize: 0.5,
    interval: 5000,
    kellyFraction: 0.5,
    maxBet: 1.0,
    stopLoss: 0.1,
    takeProfit: 0.2,
  };

  describe('recordPerformance', () => {
    it('should record performance for a bot', () => {
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        {
          trades: 15,
          wins: 10,
          pnl: 2.5,
          sharpeRatio: 1.2,
          maxDrawdown: -0.05,
        }
      );

      const history = parameterOptimizer.getHistory('momentum', 'test-bot-1');
      expect(history).toHaveLength(1);
      expect(history[0].trades).toBe(15);
      expect(history[0].pnl).toBe(2.5);
    });

    it('should calculate fitness score', () => {
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        {
          trades: 20,
          wins: 15,
          pnl: 5.0,
          sharpeRatio: 2.0,
          maxDrawdown: -0.02,
        }
      );

      const history = parameterOptimizer.getHistory('momentum', 'test-bot-1');
      expect(history[0].fitness).toBeGreaterThan(0);
    });

    it('should return 0 fitness for insufficient trades', () => {
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        {
          trades: 5,
          wins: 3,
          pnl: 1.0,
          sharpeRatio: 1.0,
          maxDrawdown: -0.05,
        }
      );

      const history = parameterOptimizer.getHistory('momentum', 'test-bot-1');
      expect(history[0].fitness).toBe(0);
    });
  });

  describe('getOptimizedParameters', () => {
    it('should return mutated params when not enough data', () => {
      const params = parameterOptimizer.getOptimizedParameters(
        'momentum',
        testParams
      );

      // Should be slightly different due to small mutation
      expect(params).toBeDefined();
      expect(params.betSize).toBeGreaterThan(0);
    });

    it('should return optimized params with performance data', () => {
      // Record enough performance data
      for (let i = 0; i < 3; i++) {
        parameterOptimizer.recordPerformance(
          'momentum',
          `test-bot-${i}`,
          { ...testParams, betSize: 0.5 + i * 0.1 },
          {
            trades: 15,
            wins: 10 + i,
            pnl: 2.0 + i,
            sharpeRatio: 1.0 + i * 0.2,
            maxDrawdown: -0.05,
          }
        );
      }

      const params = parameterOptimizer.getOptimizedParameters(
        'momentum',
        testParams
      );

      expect(params).toBeDefined();
      expect(params.betSize).toBeGreaterThan(0);
      expect(params.betSize).toBeLessThan(3);
    });
  });

  describe('evolveParameters', () => {
    it('should generate new population', () => {
      // First record some performance data
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        {
          trades: 20,
          wins: 15,
          pnl: 3.0,
          sharpeRatio: 1.5,
          maxDrawdown: -0.03,
        }
      );

      const newPopulation = parameterOptimizer.evolveParameters('momentum');

      expect(newPopulation).toBeDefined();
      expect(newPopulation.length).toBeGreaterThan(0);
      newPopulation.forEach(params => {
        expect(params.betSize).toBeGreaterThanOrEqual(0.1);
        expect(params.betSize).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('getTopPerformers', () => {
    it('should return top performers sorted by fitness', () => {
      // Record multiple performances with different results
      parameterOptimizer.recordPerformance(
        'mean_reversion',
        'bot-1',
        testParams,
        {
          trades: 15,
          wins: 8,
          pnl: 1.0,
          sharpeRatio: 0.8,
          maxDrawdown: -0.05,
        }
      );

      parameterOptimizer.recordPerformance(
        'mean_reversion',
        'bot-2',
        { ...testParams, betSize: 0.8 },
        {
          trades: 20,
          wins: 15,
          pnl: 4.0,
          sharpeRatio: 2.0,
          maxDrawdown: -0.02,
        }
      );

      const top = parameterOptimizer.getTopPerformers('mean_reversion', 2);

      expect(top.length).toBeLessThanOrEqual(2);
      if (top.length >= 2) {
        expect(top[0].fitness).toBeGreaterThanOrEqual(top[1].fitness);
      }
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        {
          trades: 15,
          wins: 10,
          pnl: 2.0,
          sharpeRatio: 1.0,
          maxDrawdown: -0.05,
        }
      );

      parameterOptimizer.reset();

      const history = parameterOptimizer.getHistory('momentum', 'test-bot-1');
      expect(history).toHaveLength(0);
    });

    it('should clear data for specific strategy', () => {
      parameterOptimizer.recordPerformance(
        'momentum',
        'test-bot-1',
        testParams,
        { trades: 15, wins: 10, pnl: 2.0, sharpeRatio: 1.0, maxDrawdown: -0.05 }
      );

      parameterOptimizer.recordPerformance(
        'mean_reversion',
        'test-bot-2',
        testParams,
        { trades: 15, wins: 10, pnl: 2.0, sharpeRatio: 1.0, maxDrawdown: -0.05 }
      );

      parameterOptimizer.reset('momentum');

      const historyMomentum = parameterOptimizer.getHistory('momentum', 'test-bot-1');
      const historyMeanRev = parameterOptimizer.getHistory('mean_reversion', 'test-bot-2');

      expect(historyMomentum).toHaveLength(0);
      expect(historyMeanRev).toHaveLength(1);
    });
  });
});