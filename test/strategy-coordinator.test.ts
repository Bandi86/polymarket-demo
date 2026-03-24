/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { strategyCoordinator } from '../src/lib/strategy-coordinator';

describe('StrategyCoordinator', () => {
  beforeEach(() => {
    strategyCoordinator.resetMarket('test-market');
  });

  describe('registerDecision', () => {
    it('should allow trade when no conflicts', () => {
      const result = strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 1.0,
        },
        100
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Trade approved');
    });

    it('should block conflicting trades in strict mode', () => {
      // First bot takes YES
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 1.0,
        },
        100
      );

      // Second bot tries NO - should be blocked
      const result = strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-2',
          botName: 'Test Bot 2',
          strategy: 'mean_reversion',
          action: 'NO',
          confidence: 0.7,
          betSize: 1.0,
        },
        100
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Conflict');
    });

    it('should allow same outcome from different bots', () => {
      // First bot takes YES
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 1.0,
        },
        100
      );

      // Second bot also takes YES - should be allowed
      const result = strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-2',
          botName: 'Test Bot 2',
          strategy: 'trend',
          action: 'YES',
          confidence: 0.7,
          betSize: 1.0,
        },
        100
      );

      expect(result.allowed).toBe(true);
    });

    it('should reduce bet size when exposure limit exceeded', () => {
      // Total balance is 100, max exposure is 40%
      // Take 30% exposure first
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 30,
        },
        100
      );

      // Try to take another 20% - should be reduced
      const result = strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-2',
          botName: 'Test Bot 2',
          strategy: 'trend',
          action: 'YES',
          confidence: 0.7,
          betSize: 20,
        },
        100
      );

      expect(result.allowed).toBe(true);
      expect(result.adjustedBetSize).toBeDefined();
      expect(result.adjustedBetSize).toBeLessThan(20);
    });
  });

  describe('confirmExecution', () => {
    it('should track exposure after execution', () => {
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 10,
        },
        100
      );

      strategyCoordinator.confirmExecution('test-market', 'bot-1', 'YES', 10);

      const exposure = strategyCoordinator.getMarketExposure('test-market');
      expect(exposure.yes).toBe(10);
      expect(exposure.no).toBe(0);
    });
  });

  describe('resetMarket', () => {
    it('should clear all state for a market', () => {
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 10,
        },
        100
      );
      strategyCoordinator.confirmExecution('test-market', 'bot-1', 'YES', 10);

      strategyCoordinator.resetMarket('test-market');

      const exposure = strategyCoordinator.getMarketExposure('test-market');
      expect(exposure.yes).toBe(0);
      expect(exposure.no).toBe(0);

      const pending = strategyCoordinator.getPendingDecisions('test-market');
      expect(pending).toHaveLength(0);
    });
  });

  describe('getPendingDecisions', () => {
    it('should return all pending decisions for a market', () => {
      strategyCoordinator.registerDecision(
        'test-market',
        {
          botId: 'bot-1',
          botName: 'Test Bot 1',
          strategy: 'momentum',
          action: 'YES',
          confidence: 0.8,
          betSize: 10,
        },
        100
      );

      const pending = strategyCoordinator.getPendingDecisions('test-market');
      expect(pending).toHaveLength(1);
      expect(pending[0].botId).toBe('bot-1');
      expect(pending[0].action).toBe('YES');
    });
  });
});