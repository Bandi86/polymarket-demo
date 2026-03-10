import { describe, it, expect } from 'vitest';

describe('Timeframe Configuration', () => {
  const TIMEFRAMES = [
    { id: "5" as const, label: "5m", duration: 5 * 60 * 1000 },
    { id: "15" as const, label: "15m", duration: 15 * 60 * 1000 },
    { id: "60" as const, label: "1h", duration: 60 * 60 * 1000 },
    { id: "240" as const, label: "4h", duration: 4 * 60 * 60 * 1000 },
    { id: "D" as const, label: "1d", duration: 24 * 60 * 60 * 1000 },
  ];

  describe('Timeframe durations', () => {
    it('5 minute should be 300000ms', () => {
      const tf = TIMEFRAMES.find(t => t.id === "5");
      expect(tf?.duration).toBe(300000);
    });

    it('15 minute should be 900000ms', () => {
      const tf = TIMEFRAMES.find(t => t.id === "15");
      expect(tf?.duration).toBe(900000);
    });

    it('1 hour should be 3600000ms', () => {
      const tf = TIMEFRAMES.find(t => t.id === "60");
      expect(tf?.duration).toBe(3600000);
    });
  });

  describe('Countdown formatting', () => {
    const formatCountdown = (ms: number): string => {
      if (ms <= 0) return "Expired";
      const hours = Math.floor(ms / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1_000);
      if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
      return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    it('should return Expired for 0', () => {
      expect(formatCountdown(0)).toBe("Expired");
    });

    it('should return Expired for negative', () => {
      expect(formatCountdown(-1000)).toBe("Expired");
    });

    it('should format seconds only', () => {
      expect(formatCountdown(59000)).toBe("00:59");
    });

    it('should format minutes and seconds', () => {
      expect(formatCountdown(125000)).toBe("02:05");
    });

    it('should format hours when applicable', () => {
      expect(formatCountdown(3661000)).toBe("1h 01m 01s");
    });
  });

  describe('Time remaining calculation', () => {
    it('should calculate correct remaining time', () => {
      const now = Date.now();
      const endTime = now + 300000; // 5 minutes from now
      const timeRemaining = Math.max(0, endTime - now);
      expect(timeRemaining).toBe(300000);
    });

    it('should return 0 when expired', () => {
      const now = Date.now();
      const endTime = now - 60000; // 1 minute ago
      const timeRemaining = Math.max(0, endTime - now);
      expect(timeRemaining).toBe(0);
    });
  });
});

describe('Trading Calculations', () => {
  const calculatePayout = (betAmount: number, odds: number, won: boolean, feeRate = 0.02) => {
    if (!won) return 0;
    const payout = betAmount / odds;
    const fee = payout * feeRate;
    return payout - fee;
  };

  describe('Profit calculation', () => {
    it('should calculate win with YES (up)', () => {
      const payout = calculatePayout(10, 0.5, true);
      expect(payout).toBe(19.6); // 10/0.5 = 20, minus 2% fee = 19.6
    });

    it('should calculate loss correctly', () => {
      const payout = calculatePayout(10, 0.5, false);
      expect(payout).toBe(0);
    });

    it('should handle different odds', () => {
      const payout = calculatePayout(10, 0.3, true);
      expect(payout).toBeCloseTo(32.667, 1); // 10/0.3 = 33.33, minus 2% fee = 32.67
    });
  });

  describe('Fee calculations', () => {
    const calculateFee = (amount: number, feeRate = 0.02) => amount * feeRate;

    it('should calculate 2% fee', () => {
      expect(calculateFee(100)).toBe(2);
    });

    it('should handle small amounts', () => {
      expect(calculateFee(0.5)).toBe(0.01);
    });
  });
});
