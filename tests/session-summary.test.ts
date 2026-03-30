import { describe, it, expect } from "vitest";
import { SessionSummaryGenerator } from "../src/lib/session-summary-generator";
import type { BotSessionRow, PositionRow } from "../src/lib/database";

describe("SessionSummaryGenerator", () => {
  it("generates markdown summary for sessions", () => {
    const gen = new SessionSummaryGenerator();
    const sessions: BotSessionRow[] = [
      {
        id: "s1",
        bot_id: "bot-1",
        bot_name: "Window Delta",
        strategy: "window_delta",
        total_pnl: 5.50,
        total_trades: 10,
        winning_trades: 8,
        losing_trades: 2,
        start_time: Date.now() - 3600000,
        end_time: Date.now(),
        start_balance: 10,
        end_balance: 15.50,
        status: "completed",
        max_drawdown: 5,
        sharpe_ratio: 1.5,
        strategy_config: '{"minDelta": 0.07}',
        bot_config: '{"betSize": 1}',
        session_notes: null,
      },
    ];
    const positions: PositionRow[] = [];

    const summary = gen.generate(sessions, positions);
    expect(summary).toContain("# Bot Session Summary");
    expect(summary).toContain("Window Delta");
    expect(summary).toContain("+55%");
  });

  it("calculates ROI correctly", () => {
    const gen = new SessionSummaryGenerator();
    const roi = gen.calculateROI(10, 15.5);
    expect(roi).toBeCloseTo(55, 5);
  });

  it("handles negative ROI", () => {
    const gen = new SessionSummaryGenerator();
    const roi = gen.calculateROI(10, 8);
    expect(roi).toBe(-20);
  });

  it("handles zero start balance", () => {
    const gen = new SessionSummaryGenerator();
    const roi = gen.calculateROI(0, 10);
    expect(roi).toBe(0);
  });

  it("ranks bots by performance", () => {
    const gen = new SessionSummaryGenerator();
    const sessions: BotSessionRow[] = [
      {
        id: "s1", bot_id: "bot-a", bot_name: "Bot A", strategy: "a",
        total_pnl: 5, start_balance: 10, end_balance: 15,
        total_trades: 5, winning_trades: 3, losing_trades: 2,
        start_time: 0, end_time: 0, status: "completed",
        max_drawdown: 0, sharpe_ratio: 0, strategy_config: null,
        bot_config: null, session_notes: null,
      },
      {
        id: "s2", bot_id: "bot-b", bot_name: "Bot B", strategy: "b",
        total_pnl: 10, start_balance: 10, end_balance: 20,
        total_trades: 5, winning_trades: 4, losing_trades: 1,
        start_time: 0, end_time: 0, status: "completed",
        max_drawdown: 0, sharpe_ratio: 0, strategy_config: null,
        bot_config: null, session_notes: null,
      },
      {
        id: "s3", bot_id: "bot-c", bot_name: "Bot C", strategy: "c",
        total_pnl: -2, start_balance: 10, end_balance: 8,
        total_trades: 5, winning_trades: 1, losing_trades: 4,
        start_time: 0, end_time: 0, status: "completed",
        max_drawdown: 0, sharpe_ratio: 0, strategy_config: null,
        bot_config: null, session_notes: null,
      },
    ];

    const ranked = gen.rankByPerformance(sessions);
    expect(ranked[0].bot_name).toBe("Bot B");
    expect(ranked[2].bot_name).toBe("Bot C");
  });

  it("generates strategy analysis with insights", () => {
    const gen = new SessionSummaryGenerator();
    const sessions: BotSessionRow[] = [
      {
        id: "s1", bot_id: "bot-1", bot_name: "Winner", strategy: "window_delta",
        total_pnl: 150, start_balance: 10, end_balance: 160,
        total_trades: 10, winning_trades: 9, losing_trades: 1,
        start_time: 0, end_time: 0, status: "completed",
        max_drawdown: 0, sharpe_ratio: 0, strategy_config: '{"minDelta": 0.07}',
        bot_config: null, session_notes: null,
      },
    ];

    const analyses = gen.generateStrategyAnalyses(sessions, []);
    expect(analyses[0].roi).toBe(1500);
    expect(analyses[0].winRate).toBe(90);
    expect(analyses[0].insights.length).toBeGreaterThan(0);
  });

  it("generates recommendations for poor performers", () => {
    const gen = new SessionSummaryGenerator();
    const sessions: BotSessionRow[] = [
      {
        id: "s1", bot_id: "bot-1", bot_name: "Poor Bot", strategy: "test",
        total_pnl: -5, start_balance: 10, end_balance: 5,
        total_trades: 10, winning_trades: 2, losing_trades: 8,
        start_time: 0, end_time: 0, status: "completed",
        max_drawdown: 0, sharpe_ratio: 0, strategy_config: '{}',
        bot_config: null, session_notes: null,
      },
    ];

    const analyses = gen.generateStrategyAnalyses(sessions, []);
    const recs = gen.generateRecommendations(analyses);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]).toContain("Poor Bot");
  });
});