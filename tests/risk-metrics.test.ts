import { describe, it, expect } from "vitest";
import { RiskMetricsCalculator } from "../src/lib/risk-manager";

describe("RiskMetricsCalculator", () => {
  it("calculates max drawdown correctly", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordBalance(100);
    calc.recordBalance(95);
    calc.recordBalance(90);
    calc.recordBalance(85);
    calc.recordBalance(92);

    const metrics = calc.getMetrics();
    expect(metrics.maxDrawdown).toBe(15); // 100 -> 85 = 15% decline
  });

  it("calculates sharpe ratio with sufficient trades", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(1.5);
    calc.recordTradePnl(-0.5);
    calc.recordTradePnl(2.0);
    calc.recordTradePnl(-1.0);
    calc.recordTradePnl(1.0);

    const metrics = calc.getMetrics();
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it("tracks win/loss streaks", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradeResult(true);
    calc.recordTradeResult(true);
    calc.recordTradeResult(true);
    calc.recordTradeResult(false);
    calc.recordTradeResult(false);
    calc.recordTradeResult(true);

    const metrics = calc.getMetrics();
    expect(metrics.longestWinStreak).toBe(3);
    expect(metrics.longestLossStreak).toBe(2);
  });

  it("returns zero sharpe with insufficient trades", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(1.0);

    const metrics = calc.getMetrics();
    expect(metrics.sharpeRatio).toBe(0);
  });

  it("calculates profit factor", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(2.0);  // win
    calc.recordTradePnl(1.0);  // win
    calc.recordTradePnl(-0.5); // loss
    calc.recordTradePnl(-1.0); // loss

    const metrics = calc.getMetrics();
    // gross_profit = 3, gross_loss = 1.5, factor = 2.0
    expect(metrics.profitFactor).toBe(2.0);
  });

  it("calculates win rate", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(1.0);
    calc.recordTradePnl(-0.5);
    calc.recordTradePnl(2.0);

    const metrics = calc.getMetrics();
    expect(metrics.winRate).toBeCloseTo(2/3, 2);
  });

  it("tracks best and worst trades", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(1.0);
    calc.recordTradePnl(-2.0);
    calc.recordTradePnl(3.0);

    const metrics = calc.getMetrics();
    expect(metrics.bestTrade).toBe(3.0);
    expect(metrics.worstTrade).toBe(-2.0);
  });

  it("calculates avg win and avg loss", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordTradePnl(2.0);
    calc.recordTradePnl(1.0);
    calc.recordTradePnl(-0.5);
    calc.recordTradePnl(-1.5);

    const metrics = calc.getMetrics();
    expect(metrics.avgWin).toBe(1.5); // (2 + 1) / 2
    expect(metrics.avgLoss).toBe(1.0); // (0.5 + 1.5) / 2
  });

  it("can be reset", () => {
    const calc = new RiskMetricsCalculator();
    calc.recordBalance(100);
    calc.recordTradePnl(1.0);
    calc.recordTradeResult(true);

    calc.reset();

    const metrics = calc.getMetrics();
    expect(metrics.maxDrawdown).toBe(0);
    expect(metrics.longestWinStreak).toBe(0);
  });
});