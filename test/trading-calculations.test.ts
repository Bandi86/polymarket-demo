import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Comprehensive trading calculation tests
 * These tests verify the core trading logic is mathematically correct
 */

describe('Trading Math - Core Calculations', () => {
  describe('Position sizing', () => {
    const calculatePositionSize = (betAmount: number, odds: number): number => {
      // Number of shares = bet amount / odds
      return betAmount / odds;
    };

    it('should calculate correct shares for 50% odds', () => {
      const shares = calculatePositionSize(10, 0.5);
      expect(shares).toBe(20); // 10 / 0.5 = 20 shares
    });

    it('should calculate correct shares for 30% odds', () => {
      const shares = calculatePositionSize(10, 0.3);
      expect(shares).toBeCloseTo(33.33, 1);
    });

    it('should calculate correct shares for 70% odds', () => {
      const shares = calculatePositionSize(10, 0.7);
      expect(shares).toBeCloseTo(14.29, 1);
    });

    it('should handle very low odds (high risk/high reward)', () => {
      const shares = calculatePositionSize(10, 0.05);
      expect(shares).toBe(200); // 10 / 0.05 = 200 shares
    });

    it('should handle very high odds (low risk/low reward)', () => {
      const shares = calculatePositionSize(10, 0.95);
      expect(shares).toBeCloseTo(10.53, 1);
    });
  });

  describe('Payout calculations', () => {
    const calculatePayout = (
      betAmount: number,
      odds: number,
      won: boolean,
      feeRate: number = 0.02
    ): { gross: number; fee: number; net: number } => {
      if (!won) {
        return { gross: 0, fee: 0, net: 0 };
      }
      const gross = betAmount / odds;
      const fee = gross * feeRate;
      const net = gross - fee;
      return { gross, fee, net };
    };

    it('should calculate correct payout for winning YES at 50%', () => {
      const result = calculatePayout(10, 0.5, true);
      expect(result.gross).toBe(20);
      expect(result.fee).toBe(0.4); // 2% of 20
      expect(result.net).toBe(19.6);
    });

    it('should return 0 for losing position', () => {
      const result = calculatePayout(10, 0.5, false);
      expect(result.gross).toBe(0);
      expect(result.net).toBe(0);
    });

    it('should calculate correct payout for low odds winner', () => {
      // Betting on YES at 10¢ - high risk, high reward
      const result = calculatePayout(10, 0.1, true);
      expect(result.gross).toBe(100);
      expect(result.fee).toBe(2);
      expect(result.net).toBe(98);
    });

    it('should calculate correct payout for high odds winner', () => {
      // Betting on YES at 90¢ - low risk, low reward
      const result = calculatePayout(10, 0.9, true);
      expect(result.gross).toBeCloseTo(11.11, 2);
      expect(result.net).toBeCloseTo(10.89, 2);
    });
  });

  describe('Profit/Loss calculations', () => {
    const calculatePnL = (
      betAmount: number,
      odds: number,
      won: boolean,
      feeRate: number = 0.02
    ): number => {
      const fee = betAmount * feeRate;
      if (!won) {
        return -(betAmount + fee); // Lose bet amount + fee
      }
      const payout = betAmount / odds;
      const exitFee = payout * feeRate;
      const netPayout = payout - exitFee;
      return netPayout - betAmount - fee; // Profit after costs
    };

    it('should calculate correct PnL for 50% odds win', () => {
      const pnl = calculatePnL(10, 0.5, true);
      // Win: 20 payout - 0.4 exit fee = 19.6
      // Cost: 10 bet + 0.2 fee = 10.2
      // PnL: 19.6 - 10.2 = 9.4
      expect(pnl).toBeCloseTo(9.4, 1);
    });

    it('should calculate correct PnL for 50% odds loss', () => {
      const pnl = calculatePnL(10, 0.5, false);
      // Lose bet amount + fee = -10.2
      expect(pnl).toBeCloseTo(-10.2, 1);
    });

    it('should calculate correct PnL for low odds win (high reward)', () => {
      const pnl = calculatePnL(10, 0.1, true);
      // Win: 100 payout - 2 fee = 98
      // Cost: 10 bet + 0.2 fee = 10.2
      // PnL: 98 - 10.2 = 87.8
      expect(pnl).toBeCloseTo(87.8, 1);
    });

    it('should calculate correct PnL for high odds win (low reward)', () => {
      const pnl = calculatePnL(10, 0.9, true);
      // Win: 11.11 payout - 0.22 fee = 10.89
      // Cost: 10 bet + 0.2 fee = 10.2
      // PnL: 10.89 - 10.2 = 0.69
      expect(pnl).toBeCloseTo(0.69, 1);
    });
  });

  describe('ROI calculations', () => {
    const calculateROI = (
      betAmount: number,
      odds: number,
      won: boolean,
      feeRate: number = 0.02
    ): number => {
      const fee = betAmount * feeRate;
      const totalCost = betAmount + fee;

      if (!won) {
        return -100; // -100% ROI on loss
      }

      const payout = betAmount / odds;
      const exitFee = payout * feeRate;
      const netPayout = payout - exitFee;
      const profit = netPayout - totalCost;

      return (profit / totalCost) * 100;
    };

    it('should calculate ~94% ROI for 50% odds win', () => {
      const roi = calculateROI(10, 0.5, true);
      // PnL: 9.4, Cost: 10.2
      // ROI: 9.4 / 10.2 * 100 = 92.2%
      expect(roi).toBeCloseTo(92.2, 0);
    });

    it('should calculate -100% ROI for loss', () => {
      const roi = calculateROI(10, 0.5, false);
      expect(roi).toBe(-100);
    });

    it('should calculate high ROI for low odds win', () => {
      const roi = calculateROI(10, 0.1, true);
      // PnL: 87.8, Cost: 10.2
      // ROI: 87.8 / 10.2 * 100 = 860.8%
      expect(roi).toBeCloseTo(860.8, 0);
    });
  });

  describe('Win rate calculations', () => {
    const calculateWinRate = (wins: number, losses: number): number => {
      const total = wins + losses;
      return total > 0 ? wins / total : 0;
    };

    it('should calculate 50% win rate', () => {
      expect(calculateWinRate(5, 5)).toBe(0.5);
    });

    it('should calculate 100% win rate', () => {
      expect(calculateWinRate(10, 0)).toBe(1);
    });

    it('should calculate 0% win rate', () => {
      expect(calculateWinRate(0, 10)).toBe(0);
    });

    it('should handle no trades', () => {
      expect(calculateWinRate(0, 0)).toBe(0);
    });
  });

  describe('Kelly Criterion calculations', () => {
    /**
     * Kelly formula: f* = (bp - q) / b
     * where:
     *   f* = fraction of bankroll to bet
     *   b = odds (decimal, e.g., 2.0 for even money)
     *   p = probability of winning
     *   q = probability of losing (1 - p)
     */
    const calculateKelly = (
      winProbability: number,
      odds: number, // Decimal odds (e.g., 2.0 for 1:1, 3.0 for 2:1)
      kellyFraction: number = 0.25 // Default to quarter Kelly
    ): number => {
      const b = odds - 1; // Net odds
      const q = 1 - winProbability;
      const kelly = (b * winProbability - q) / b;
      return Math.max(0, kelly * kellyFraction);
    };

    it('should calculate correct Kelly for even money (50% win prob)', () => {
      // Fair bet: 50% win at 2.0 odds
      // Kelly = (1 * 0.5 - 0.5) / 1 = 0
      const kelly = calculateKelly(0.5, 2.0);
      expect(kelly).toBe(0);
    });

    it('should calculate positive Kelly for favorable bet', () => {
      // 60% win probability at 2.0 odds
      // Kelly = (1 * 0.6 - 0.4) / 1 = 0.2
      // Quarter Kelly = 0.2 * 0.25 = 0.05
      const kelly = calculateKelly(0.6, 2.0);
      expect(kelly).toBeCloseTo(0.05, 2);
    });

    it('should return 0 for negative expectation', () => {
      // 40% win probability at 2.0 odds
      // Kelly = (1 * 0.4 - 0.6) / 1 = -0.2 (don't bet)
      const kelly = calculateKelly(0.4, 2.0);
      expect(kelly).toBe(0);
    });

    it('should handle high odds correctly', () => {
      // 20% win probability at 6.0 odds (5:1 payout)
      // b = 5, Kelly = (5 * 0.2 - 0.8) / 5 = 0.2 / 5 = 0.04
      // Quarter Kelly = 0.04 * 0.25 = 0.01
      const kelly = calculateKelly(0.2, 6.0);
      expect(kelly).toBeCloseTo(0.01, 2);
    });
  });

  describe('Slippage calculations', () => {
    const calculateSlippage = (
      amount: number,
      odds: number,
      baseSpread: number = 0.001,
      maxSizeImpact: number = 0.05
    ): number => {
      // Size impact: 0.1% per dollar over $1
      const sizeImpact = Math.max(0, (amount - 1) * 0.001);
      const totalSlippage = Math.min(sizeImpact, maxSizeImpact);
      return totalSlippage;
    };

    it('should apply no slippage for $1 bet', () => {
      const slippage = calculateSlippage(1, 0.5);
      expect(slippage).toBe(0);
    });

    it('should apply 1% slippage for $11 bet', () => {
      const slippage = calculateSlippage(11, 0.5);
      expect(slippage).toBe(0.01);
    });

    it('should cap slippage at max', () => {
      const slippage = calculateSlippage(100, 0.5);
      // Would be 9.9% but capped at 5%
      expect(slippage).toBe(0.05);
    });

    it('should adjust odds correctly with slippage', () => {
      const odds = 0.5;
      const slippage = 0.01;
      const adjustedOdds = odds + slippage;
      expect(adjustedOdds).toBe(0.51);
    });
  });
});

describe('Position Settlement Logic', () => {
  describe('Market resolution', () => {
    const resolveMarket = (
      startPrice: number,
      endPrice: number,
      position: 'YES' | 'NO'
    ): { won: boolean; priceDirection: 'UP' | 'DOWN' } => {
      const direction = endPrice >= startPrice ? 'UP' : 'DOWN';
      const won = (direction === 'UP' && position === 'YES') ||
                  (direction === 'DOWN' && position === 'NO');
      return { won, priceDirection: direction };
    };

    it('should win YES when price goes UP', () => {
      const result = resolveMarket(100, 110, 'YES');
      expect(result.won).toBe(true);
      expect(result.priceDirection).toBe('UP');
    });

    it('should lose YES when price goes DOWN', () => {
      const result = resolveMarket(100, 90, 'YES');
      expect(result.won).toBe(false);
      expect(result.priceDirection).toBe('DOWN');
    });

    it('should win NO when price goes DOWN', () => {
      const result = resolveMarket(100, 90, 'NO');
      expect(result.won).toBe(true);
      expect(result.priceDirection).toBe('DOWN');
    });

    it('should lose NO when price goes UP', () => {
      const result = resolveMarket(100, 110, 'NO');
      expect(result.won).toBe(false);
      expect(result.priceDirection).toBe('UP');
    });

    it('should win YES when price stays same (UP wins ties)', () => {
      const result = resolveMarket(100, 100, 'YES');
      expect(result.won).toBe(true);
      expect(result.priceDirection).toBe('UP');
    });
  });

  describe('Balance updates', () => {
    const updateBalanceAfterTrade = (
      currentBalance: number,
      betAmount: number,
      fee: number,
      won: boolean,
      payout: number
    ): number => {
      // Deduct bet + fee
      const balanceAfterBet = currentBalance - betAmount - fee;

      if (won) {
        return balanceAfterBet + payout;
      }

      return balanceAfterBet;
    };

    it('should correctly update balance on win', () => {
      // Start with 100, bet 10, fee 0.2, win with payout 20
      const newBalance = updateBalanceAfterTrade(100, 10, 0.2, true, 20);
      expect(newBalance).toBe(109.8); // 100 - 10 - 0.2 + 20
    });

    it('should correctly update balance on loss', () => {
      const newBalance = updateBalanceAfterTrade(100, 10, 0.2, false, 0);
      expect(newBalance).toBe(89.8); // 100 - 10 - 0.2
    });
  });
});

describe('Live Mode Validation', () => {
  describe('Balance checks', () => {
    const canPlaceLiveTrade = (
      balance: number,
      betAmount: number,
      feeRate: number = 0.02
    ): { allowed: boolean; reason?: string } => {
      const totalCost = betAmount * (1 + feeRate);

      if (balance <= 0) {
        return { allowed: false, reason: 'No balance available' };
      }

      if (balance < totalCost) {
        return { allowed: false, reason: `Insufficient balance. Need $${totalCost.toFixed(2)}, have $${balance.toFixed(2)}` };
      }

      return { allowed: true };
    };

    it('should allow trade with sufficient balance', () => {
      const result = canPlaceLiveTrade(100, 10);
      expect(result.allowed).toBe(true);
    });

    it('should block trade with zero balance', () => {
      const result = canPlaceLiveTrade(0, 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No balance');
    });

    it('should block trade with insufficient balance', () => {
      const result = canPlaceLiveTrade(5, 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient');
    });

    it('should account for fees in balance check', () => {
      // Balance exactly equals bet + fee
      const result = canPlaceLiveTrade(10.2, 10);
      expect(result.allowed).toBe(true);
    });
  });
});