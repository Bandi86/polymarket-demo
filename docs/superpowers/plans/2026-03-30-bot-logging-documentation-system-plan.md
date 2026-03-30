# Bot Logging & Documentation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive logging with risk metrics calculation, decision context tracking, and auto-generated session summaries.

**Architecture:** Extend existing database schema with new columns and session_logs table, add RiskMetricsCalculator class, integrate decision context logging into trade execution, and create SessionSummaryGenerator for markdown reports.

**Tech Stack:** Bun, TypeScript, SQLite (better-sqlite3), React

---

## File Structure

| File | Purpose | Action |
|------|---------|--------|
| `src/lib/database.ts` | Schema migrations + session_logs methods | Modify |
| `src/types/session.types.ts` | DecisionContext, RiskMetrics types | Modify |
| `src/lib/risk-manager.ts` | RiskMetricsCalculator class | Modify |
| `src/lib/bot-manager/strategy-executor.ts` | buildDecisionContext() function | Modify |
| `src/lib/bot-manager.ts` | Config storage, metrics integration | Modify |
| `src/lib/session-summary-generator.ts` | Markdown report generator | Create |
| `src/lib/global.ts` | Export session summary generator | Modify |
| `tests/risk-metrics.test.ts` | Unit tests for metrics calculator | Create |
| `tests/session-summary.test.ts` | Unit tests for summary generator | Create |

---

## Task 1: Add Types for DecisionContext and RiskMetrics

**Files:**
- Modify: `src/types/session.types.ts`

- [ ] **Step 1: Add DecisionContext interface**

```typescript
// Add to src/types/session.types.ts after BotLog interface

export interface DecisionContext {
  // Strategy decision
  strategy: string;
  action: "YES" | "NO";
  confidence: number;
  reason: string;

  // Market state at decision time
  yesPrice: number;
  noPrice: number;
  btcPrice: number;
  btcDelta: number;
  timeRemaining: number;
  marketDuration: number;

  // Strategy-specific signals
  binanceSignal?: {
    type: "bullish" | "bearish";
    changePercent: number;
    confidence: number;
    age: number;
  };
  windowDelta?: number;
  edge?: number;

  // Thresholds used
  thresholdsUsed: Record<string, number>;

  // Risk checks
  riskChecksPassed: boolean;
  kellyFractionUsed?: number;
  coordinationChecks?: string;

  // Bet sizing
  rawBetSize: number;
  finalBetSize: number;
  balanceAtDecision: number;
}

export interface RiskMetrics {
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface SessionLog {
  id: string;
  sessionId: string;
  botId: string;
  type: string;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: number;
}
```

- [ ] **Step 2: Update barrel file**

```typescript
// Add to src/types/index.ts exports
export type { DecisionContext, RiskMetrics, SessionLog } from "./session.types";
```

- [ ] **Step 3: Commit types**

```bash
git add src/types/session.types.ts src/types/index.ts
git commit -m "types: add DecisionContext, RiskMetrics, and SessionLog types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Extend Database Schema

**Files:**
- Modify: `src/lib/database.ts:120-215`

- [ ] **Step 1: Add new columns to schema creation**

In `createSchema()` method, after existing CREATE TABLE statements, add ALTER TABLE statements:

```typescript
// In src/lib/database.ts, modify createSchema() method
// Add after the existing CREATE INDEX statements (around line 214)

// Extend bot_sessions table
this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN strategy_config TEXT`);
this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN bot_config TEXT`);
this.db.exec(`ALTER TABLE bot_sessions ADD COLUMN session_notes TEXT`);

// Extend positions table
this.db.exec(`ALTER TABLE positions ADD COLUMN decision_context TEXT`);
this.db.exec(`ALTER TABLE positions ADD COLUMN btc_price REAL`);
this.db.exec(`ALTER TABLE positions ADD COLUMN time_remaining INTEGER`);

// Create session_logs table
this.db.exec(`
  CREATE TABLE IF NOT EXISTS session_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    bot_id TEXT,
    type TEXT,
    message TEXT,
    details TEXT,
    timestamp INTEGER,
    FOREIGN KEY (session_id) REFERENCES bot_sessions(id)
  )
`);

this.db.exec(`CREATE INDEX IF NOT EXISTS idx_session_logs_session ON session_logs(session_id)`);
this.db.exec(`CREATE INDEX IF NOT EXISTS idx_session_logs_bot ON session_logs(bot_id)`);
```

- [ ] **Step 2: Add BotSessionRow extensions**

```typescript
// In src/lib/database.ts, modify BotSessionRow interface (around line 49)
export interface BotSessionRow {
  id: string;
  bot_id: string;
  bot_name: string;
  strategy: string;
  start_time: number;
  end_time: number | null;
  start_balance: number;
  end_balance: number | null;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  status: string;
  max_drawdown: number;
  sharpe_ratio: number;
  strategy_config: string | null;  // NEW
  bot_config: string | null;       // NEW
  session_notes: string | null;    // NEW
}

// Modify PositionRow interface (around line 34)
export interface PositionRow {
  id: string;
  market_id: string;
  outcome: string;
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: string;
  pnl: number | null;
  bot_id: string | null;
  bot_name: string | null;
  decision_context: string | null;  // NEW
  btc_price: number | null;         // NEW
  time_remaining: number | null;    // NEW
}

// Add SessionLogRow interface
export interface SessionLogRow {
  id: string;
  session_id: string;
  bot_id: string;
  type: string;
  message: string;
  details: string | null;
  timestamp: number;
}
```

- [ ] **Step 3: Update saveBotSession method**

```typescript
// Modify saveBotSession method (around line 345) to include new fields
async saveBotSession(session: {
  id: string;
  botId: string;
  botName: string;
  strategy: string;
  startTime: number;
  endTime: number | null;
  startBalance: number;
  endBalance: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  status: "running" | "completed" | "paused";
  maxDrawdown?: number;
  sharpeRatio?: number;
  strategyConfig?: Record<string, unknown>;  // NEW
  botConfig?: Record<string, unknown>;       // NEW
  sessionNotes?: string;                     // NEW
}): Promise<void> {
  if (!this.db) return;

  const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO bot_sessions
    (id, bot_id, bot_name, strategy, start_time, end_time, start_balance,
     end_balance, total_trades, winning_trades, losing_trades, total_pnl,
     status, max_drawdown, sharpe_ratio, strategy_config, bot_config, session_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    session.id,
    session.botId,
    session.botName,
    session.strategy,
    session.startTime,
    session.endTime,
    session.startBalance,
    session.endBalance,
    session.totalTrades,
    session.winningTrades,
    session.losingTrades,
    session.totalPnL,
    session.status,
    session.maxDrawdown ?? 0,
    session.sharpeRatio ?? 0,
    session.strategyConfig ? JSON.stringify(session.strategyConfig) : null,
    session.botConfig ? JSON.stringify(session.botConfig) : null,
    session.sessionNotes ?? null
  );
}
```

- [ ] **Step 4: Add savePosition with decision context**

```typescript
// Modify savePosition method (around line 280) to include new fields
async savePosition(position: {
  id: string;
  marketId: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  stake: number;
  fee: number;
  timestamp: number;
  status: "open" | "closed" | "settled";
  pnl: number | null;
  botId?: string | null;
  botName?: string | null;
  decisionContext?: Record<string, unknown>;  // NEW
  btcPrice?: number;                          // NEW
  timeRemaining?: number;                     // NEW
}): Promise<void> {
  if (!this.db) return;

  const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO positions
    (id, market_id, outcome, amount, odds, stake, fee, timestamp, status,
     pnl, bot_id, bot_name, decision_context, btc_price, time_remaining)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    position.id,
    position.marketId,
    position.outcome,
    position.amount,
    position.odds,
    position.stake,
    position.fee,
    position.timestamp,
    position.status,
    position.pnl,
    position.botId || null,
    position.botName || null,
    position.decisionContext ? JSON.stringify(position.decisionContext) : null,
    position.btcPrice ?? null,
    position.timeRemaining ?? null
  );
}
```

- [ ] **Step 5: Add session_logs methods**

```typescript
// Add new methods to DatabaseService class (after getPositionsByBot)

async saveSessionLog(log: {
  id: string;
  sessionId: string;
  botId: string;
  type: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}): Promise<void> {
  if (!this.db) return;

  const stmt = this.db.prepare(`
    INSERT INTO session_logs
    (id, session_id, bot_id, type, message, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.id,
    log.sessionId,
    log.botId,
    log.type,
    log.message,
    log.details ? JSON.stringify(log.details) : null,
    log.timestamp
  );
}

async getSessionLogs(sessionId: string): Promise<SessionLogRow[]> {
  if (!this.db) return [];

  const stmt = this.db.prepare(
    "SELECT * FROM session_logs WHERE session_id = ? ORDER BY timestamp"
  );
  return stmt.all(sessionId) as SessionLogRow[];
}

async getBotSessionLogs(botId: string, limit: number = 100): Promise<SessionLogRow[]> {
  if (!this.db) return [];

  const stmt = this.db.prepare(
    "SELECT * FROM session_logs WHERE bot_id = ? ORDER BY timestamp DESC LIMIT ?"
  );
  return stmt.all(botId, limit) as SessionLogRow[];
}
```

- [ ] **Step 6: Commit database changes**

```bash
git add src/lib/database.ts
git commit -m "feat(db): extend schema for logging and risk metrics

- Add strategy_config, bot_config, session_notes to bot_sessions
- Add decision_context, btc_price, time_remaining to positions
- Add session_logs table for persisted logs
- Add saveSessionLog, getSessionLogs methods

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add RiskMetricsCalculator Class

**Files:**
- Modify: `src/lib/risk-manager.ts`
- Create: `tests/risk-metrics.test.ts`

- [ ] **Step 1: Write failing test for RiskMetricsCalculator**

```typescript
// Create tests/risk-metrics.test.ts

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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/risk-metrics.test.ts
```

Expected: FAIL - "RiskMetricsCalculator is not defined"

- [ ] **Step 3: Add RiskMetricsCalculator class**

```typescript
// Add to src/lib/risk-manager.ts after RiskManager class

import type { RiskMetrics } from "../types";

export class RiskMetricsCalculator {
  private balanceHistory: number[] = [];
  private peakBalance: number = 0;
  private tradePnls: number[] = [];
  private currentWinStreak: number = 0;
  private currentLossStreak: number = 0;
  private longestWinStreak: number = 0;
  private longestLossStreak: number = 0;
  private bestTrade: number = 0;
  private worstTrade: number = 0;

  /**
   * Record balance snapshot for drawdown calculation
   */
  recordBalance(balance: number): void {
    this.balanceHistory.push(balance);

    // Update peak for drawdown calculation
    if (balance > this.peakBalance) {
      this.peakBalance = balance;
    }
  }

  /**
   * Record trade P&L for Sharpe and profit factor
   */
  recordTradePnl(pnl: number): void {
    this.tradePnls.push(pnl);

    // Track best/worst
    if (pnl > this.bestTrade) {
      this.bestTrade = pnl;
    }
    if (pnl < this.worstTrade) {
      this.worstTrade = pnl;
    }
  }

  /**
   * Record trade result for streak tracking
   */
  recordTradeResult(won: boolean): void {
    if (won) {
      this.currentWinStreak++;
      this.currentLossStreak = 0;
      this.longestWinStreak = Math.max(this.longestWinStreak, this.currentWinStreak);
    } else {
      this.currentLossStreak++;
      this.currentWinStreak = 0;
      this.longestLossStreak = Math.max(this.longestLossStreak, this.currentLossStreak);
    }
  }

  /**
   * Calculate maximum drawdown percentage
   */
  calculateMaxDrawdown(): number {
    if (this.peakBalance === 0 || this.balanceHistory.length === 0) return 0;

    let maxDrawdown = 0;
    for (const balance of this.balanceHistory) {
      const drawdown = ((this.peakBalance - balance) / this.peakBalance) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    return maxDrawdown;
  }

  /**
   * Calculate Sharpe ratio (simplified: avg_pnl / std_dev)
   */
  calculateSharpeRatio(): number {
    if (this.tradePnls.length < 5) return 0;

    const avg = this.tradePnls.reduce((a, b) => a + b, 0) / this.tradePnls.length;
    const variance = this.tradePnls.reduce((sum, pnl) => sum + Math.pow(pnl - avg, 2), 0) / this.tradePnls.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return avg > 0 ? 999 : 0;
    return avg / stdDev;
  }

  /**
   * Calculate profit factor (gross profit / gross loss)
   */
  calculateProfitFactor(): number {
    const wins = this.tradePnls.filter(p => p > 0);
    const losses = this.tradePnls.filter(p => p < 0);

    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

    if (grossLoss === 0) return grossProfit > 0 ? 999 : 0;
    return grossProfit / grossLoss;
  }

  /**
   * Get all calculated metrics
   */
  getMetrics(): RiskMetrics {
    const wins = this.tradePnls.filter(p => p > 0);
    const losses = this.tradePnls.filter(p => p < 0);

    return {
      maxDrawdown: this.calculateMaxDrawdown(),
      sharpeRatio: this.calculateSharpeRatio(),
      winRate: this.tradePnls.length > 0 ? wins.length / this.tradePnls.length : 0,
      profitFactor: this.calculateProfitFactor(),
      avgWin: wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0,
      bestTrade: this.bestTrade,
      worstTrade: this.worstTrade,
      longestWinStreak: this.longestWinStreak,
      longestLossStreak: this.longestLossStreak,
    };
  }

  /**
   * Reset calculator for new session
   */
  reset(): void {
    this.balanceHistory = [];
    this.peakBalance = 0;
    this.tradePnls = [];
    this.currentWinStreak = 0;
    this.currentLossStreak = 0;
    this.longestWinStreak = 0;
    this.longestLossStreak = 0;
    this.bestTrade = 0;
    this.worstTrade = 0;
  }
}
```

- [ ] **Step 4: Add export to existing riskManager export**

```typescript
// At end of src/lib/risk-manager.ts, update export
export const riskManager = new RiskManager();
// RiskMetricsCalculator is already exported via class definition above
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun test tests/risk-metrics.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit RiskMetricsCalculator**

```bash
git add src/lib/risk-manager.ts tests/risk-metrics.test.ts
git commit -m "feat(risk): add RiskMetricsCalculator class

- Track balance history for drawdown
- Calculate Sharpe ratio with 5+ trades minimum
- Track win/loss streaks
- Add unit tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Add buildDecisionContext Function

**Files:**
- Modify: `src/lib/bot-manager/strategy-executor.ts`

- [ ] **Step 1: Add import for strategyConfig**

```typescript
// Add to imports in src/lib/bot-manager/strategy-executor.ts
import { strategyConfig } from "../strategies/config";
import type { DecisionContext } from "../../types";
```

- [ ] **Step 2: Add buildDecisionContext function**

```typescript
// Add to src/lib/bot-manager/strategy-executor.ts after cancelDecision function

/**
 * Build full decision context for logging
 */
export function buildDecisionContext(
  bot: BotConfig,
  context: StrategyContext,
  decision: { action: Outcome; confidence: number; reason?: string },
  rawBetSize: number,
  finalBetSize: number,
  riskCheck: { allowed: boolean; reason?: string }
): DecisionContext {
  // Get thresholds used for this strategy
  const thresholdsUsed = strategyConfig[bot.strategy] || {};

  // Calculate BTC delta
  const btcDelta = context.btcWindowOpen > 0
    ? ((context.btcPrice - context.btcWindowOpen) / context.btcWindowOpen) * 100
    : 0;

  // Build decision context
  return {
    strategy: bot.strategy,
    action: decision.action,
    confidence: decision.confidence,
    reason: decision.reason || "No reason provided",

    yesPrice: context.marketPrice.yesPrice,
    noPrice: context.marketPrice.noPrice,
    btcPrice: context.btcPrice,
    btcDelta,
    timeRemaining: context.timeRemaining,
    marketDuration: context.marketDuration,

    // Strategy-specific signals
    binanceSignal: context.binanceSignal ? {
      type: context.binanceSignal.type,
      changePercent: context.binanceSignal.changePercent,
      confidence: context.binanceSignal.confidence,
      age: Date.now() - context.binanceSignal.timestamp,
    } : undefined,

    windowDelta: bot.strategy === "window_delta" ? btcDelta : undefined,
    edge: thresholdsUsed.minEdge || undefined,

    thresholdsUsed,

    riskChecksPassed: riskCheck.allowed,
    kellyFractionUsed: bot.useKelly ? bot.kellyFraction : undefined,

    rawBetSize,
    finalBetSize,
    balanceAtDecision: bot.portfolio?.balance || 0,
  };
}
```

- [ ] **Step 3: Update exports**

```typescript
// Update export in src/lib/bot-manager/index.ts
export {
  buildStrategyContext,
  calculateBetSize,
  executeStrategy,
  executeLiveTrade,
  checkRiskConstraints,
  checkCoordination,
  confirmExecution,
  cancelDecision,
  buildDecisionContext,  // NEW
  type MarketInfo,
  type TradeDecision,
  type StrategyExecutionResult,
} from "./strategy-executor";
```

- [ ] **Step 4: Commit decision context builder**

```bash
git add src/lib/bot-manager/strategy-executor.ts src/lib/bot-manager/index.ts
git commit -m "feat(strategy): add buildDecisionContext for trade logging

- Capture full context at trade decision time
- Include thresholds used, BTC delta, signals
- Enable debugging why trades were made

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Integrate Metrics and Decision Context into BotManager

**Files:**
- Modify: `src/lib/bot-manager.ts`

- [ ] **Step 1: Add imports and metrics calculator tracking**

```typescript
// Add to imports in src/lib/bot-manager.ts
import { RiskMetricsCalculator } from "./risk-manager";
import { strategyConfig } from "./strategies/config";
import { buildDecisionContext } from "./bot-manager/strategy-executor";
import type { DecisionContext, RiskMetrics } from "../types";
```

```typescript
// Add private property to BotManager class (after sessions property)
private metricsCalculators: Map<string, RiskMetricsCalculator> = new Map();
```

- [ ] **Step 2: Initialize metrics calculator in startBot**

```typescript
// In startBot method (around line 290), add after creating interval:
// Initialize risk metrics calculator for this session
this.metricsCalculators.set(id, new RiskMetricsCalculator());
```

- [ ] **Step 3: Record balance after trade execution**

```typescript
// In executeBotStrategy, after position created (around line 625)
// Add after "const position = marketEngine.placeTrade..."
if (position) {
  // Record balance for drawdown tracking
  const metricsCalc = this.metricsCalculators.get(id);
  if (metricsCalc) {
    const newBalance = portfolio.balance - finalBetSize - adjustedFee;
    metricsCalc.recordBalance(newBalance);
  }

  // Build and save decision context
  const decisionContext = buildDecisionContext(
    bot,
    context,
    decision,
    betSize,
    finalBetSize,
    riskCheck
  );

  // Save position with decision context to DB
  dbService.savePosition({
    id: position.id,
    marketId: market.id,
    outcome: position.outcome,
    amount: position.amount,
    odds: position.odds,
    stake: position.stake,
    fee: position.fee,
    timestamp: position.timestamp,
    status: "open",
    pnl: null,
    botId: id,
    botName: bot.name,
    decisionContext,
    btcPrice: context.btcPrice,
    timeRemaining: context.timeRemaining,
  }).catch(e => console.error("[BotManager] DB save error:", e));
}
```

- [ ] **Step 4: Update saveBotSessionToDB with config and metrics**

```typescript
// Modify saveBotSessionToDB method (around line 431)
private saveBotSessionToDB(session: BotSession, bot?: BotConfig | null): void {
  // Get risk metrics
  const metricsCalc = this.metricsCalculators.get(session.botId);
  const metrics: RiskMetrics = metricsCalc ? metricsCalc.getMetrics() : {
    maxDrawdown: 0,
    sharpeRatio: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    bestTrade: 0,
    worstTrade: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
  };

  // Get strategy config
  const strategyConf = bot ? strategyConfig[bot.strategy] : {};

  // Get bot config
  const botConf = bot ? {
    betSize: bot.betSize,
    maxBet: bot.maxBet,
    useKelly: bot.useKelly,
    kellyFraction: bot.kellyFraction,
    interval: bot.interval,
  } : {};

  dbService.saveBotSession({
    id: session.id,
    botId: session.botId,
    botName: session.botName,
    strategy: session.strategy,
    startTime: session.startTime,
    endTime: session.endTime,
    startBalance: session.startBalance,
    endBalance: session.endBalance,
    totalTrades: session.totalTrades,
    winningTrades: session.winningTrades,
    losingTrades: session.losingTrades,
    totalPnL: session.totalPnL,
    status: session.status,
    maxDrawdown: metrics.maxDrawdown,
    sharpeRatio: metrics.sharpeRatio,
    strategyConfig: strategyConf,
    botConfig: botConf,
  }).catch((e) => console.error("[BotManager] DB save error:", e));
}
```

- [ ] **Step 5: Record trade PnL on settlement**

```typescript
// In settlement handling, find where positions are settled
// Add after "const pnl = position.pnl || 0;"

// Record trade result for metrics
const metricsCalc = this.metricsCalculators.get(botId);
if (metricsCalc && position.pnl !== null) {
  metricsCalc.recordTradePnl(position.pnl);
  metricsCalc.recordTradeResult(position.pnl > 0);
  metricsCalc.recordBalance(portfolio.balance);
}
```

- [ ] **Step 6: Clean up metrics calculator on stop**

```typescript
// In stopBot method, add before clearing interval:
// Clean up metrics calculator
this.metricsCalculators.delete(id);
```

- [ ] **Step 7: Store config at session start in startCompetition**

```typescript
// Find startCompetition method in competition-manager.ts or bot-manager.ts
// When creating sessions, add strategy_config and bot_config:

for (const bot of this.getBots()) {
  const session: BotSession = {
    id: generateId("session"),
    botId: bot.id,
    botName: bot.name,
    strategy: bot.strategy,
    startTime: Date.now(),
    endTime: null,
    startBalance: portfolio.balance,
    endBalance: null,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    status: "running",
  };

  // Initialize metrics calculator
  this.metricsCalculators.set(bot.id, new RiskMetricsCalculator());

  this.currentSessions.set(bot.id, session);
}
```

- [ ] **Step 8: Commit BotManager integration**

```bash
git add src/lib/bot-manager.ts
git commit -m "feat(bot): integrate risk metrics and decision context logging

- Initialize RiskMetricsCalculator per bot session
- Record balance after each trade for drawdown
- Build and save decision context to DB
- Store strategy config and bot config with sessions
- Clean up metrics calculator on stop

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Create SessionSummaryGenerator

**Files:**
- Create: `src/lib/session-summary-generator.ts`
- Create: `tests/session-summary.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Create tests/session-summary.test.ts

import { describe, it, expect } from "vitest";
import { SessionSummaryGenerator } from "../src/lib/session-summary-generator";

describe("SessionSummaryGenerator", () => {
  it("generates markdown summary for sessions", () => {
    const gen = new SessionSummaryGenerator();
    const sessions = [
      {
        id: "s1",
        bot_name: "Window Delta",
        strategy: "window_delta",
        total_pnl: 5.50,
        total_trades: 10,
        winning_trades: 8,
        start_balance: 10,
        end_balance: 15.50,
        strategy_config: '{"minDelta": 0.07}',
      },
    ];
    const positions = [];

    const summary = gen.generate(sessions, positions);
    expect(summary).toContain("# Bot Session Summary");
    expect(summary).toContain("Window Delta");
    expect(summary).toContain("+55%");
  });

  it("calculates ROI correctly", () => {
    const gen = new SessionSummaryGenerator();
    const roi = gen.calculateROI(10, 15.5);
    expect(roi).toBe(55);
  });

  it("ranks bots by performance", () => {
    const gen = new SessionSummaryGenerator();
    const sessions = [
      { bot_name: "Bot A", total_pnl: 5, start_balance: 10 },
      { bot_name: "Bot B", total_pnl: 10, start_balance: 10 },
      { bot_name: "Bot C", total_pnl: -2, start_balance: 10 },
    ];

    const ranked = gen.rankByPerformance(sessions);
    expect(ranked[0].bot_name).toBe("Bot B");
    expect(ranked[2].bot_name).toBe("Bot C");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/session-summary.test.ts
```

Expected: FAIL - "SessionSummaryGenerator is not defined"

- [ ] **Step 3: Create SessionSummaryGenerator class**

```typescript
// Create src/lib/session-summary-generator.ts

import type { BotSessionRow, PositionRow } from "./database";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface StrategyAnalysis {
  strategy: string;
  botName: string;
  roi: number;
  winRate: number;
  trades: number;
  config: Record<string, unknown>;
  insights: string[];
  recommendation: string;
}

export class SessionSummaryGenerator {
  /**
   * Generate markdown summary for sessions
   */
  generate(sessions: BotSessionRow[], positions: PositionRow[]): string {
    const timestamp = new Date().toISOString();
    const duration = this.calculateDuration(sessions);
    const rankedSessions = this.rankByPerformance(sessions);

    let md = `# Bot Session Summary - ${timestamp.split("T")[0]}\n\n`;
    md += `**Generated:** ${timestamp}\n\n`;

    // Overview section
    md += `## Competition Overview\n\n`;
    md += `- **Duration:** ${duration}\n`;
    md += `- **Total bots:** ${sessions.length}\n`;
    md += `- **Total trades:** ${sessions.reduce((s, r) => s + r.total_trades, 0)}\n\n`;

    // Performance ranking table
    md += `## Bot Performance Ranking\n\n`;
    md += `| Rank | Bot | Strategy | Trades | Win Rate | ROI | Notes |\n`;
    md += `|------|-----|----------|--------|----------|-----|-------|\n`;

    rankedSessions.forEach((s, i) => {
      const roi = this.calculateROI(s.start_balance, s.end_balance || s.start_balance);
      const winRate = s.total_trades > 0 ? ((s.winning_trades / s.total_trades) * 100).toFixed(0) : "0";
      const note = roi > 50 ? "Excellent!" : roi > 0 ? "Good" : roi < -20 ? "Poor" : "";
      md += `| ${i + 1} | ${s.bot_name} | ${s.strategy} | ${s.total_trades} | ${winRate}% | ${roi > 0 ? "+" : ""}${roi}% | ${note} |\n`;
    });

    md += "\n";

    // Strategy analysis section
    md += `## Strategy Analysis\n\n`;
    const analyses = this.generateStrategyAnalyses(sessions, positions);
    analyses.forEach(a => {
      md += `### ${a.botName} (${a.strategy})\n\n`;
      md += `- **Config:** ${JSON.stringify(a.config)}\n`;
      md += `- **ROI:** ${a.roi > 0 ? "+" : ""}${a.roi}%\n`;
      md += `- **Win Rate:** ${a.winRate.toFixed(0)}%\n`;
      md += `- **Trades:** ${a.trades}\n`;
      if (a.insights.length > 0) {
        md += `- **Insights:**\n`;
        a.insights.forEach(ins => md += `  - ${ins}\n`);
      }
      md += `- **Recommendation:** ${a.recommendation}\n\n`;
    });

    // Recommendations section
    md += `## Recommendations for Next Session\n\n`;
    const recommendations = this.generateRecommendations(analyses);
    recommendations.forEach((rec, i) => {
      md += `${i + 1}. ${rec}\n`;
    });

    md += "\n---\n";
    md += `Session IDs: ${sessions.map(s => s.id).join(", ")}\n`;

    return md;
  }

  /**
   * Calculate ROI percentage
   */
  calculateROI(start: number, end: number): number {
    if (start === 0) return 0;
    return ((end - start) / start) * 100;
  }

  /**
   * Rank sessions by performance (ROI)
   */
  rankByPerformance(sessions: BotSessionRow[]): BotSessionRow[] {
    return [...sessions].sort((a, b) => {
      const roiA = this.calculateROI(a.start_balance, a.end_balance || a.start_balance);
      const roiB = this.calculateROI(b.start_balance, b.end_balance || b.start_balance);
      return roiB - roiA;
    });
  }

  /**
   * Generate per-strategy analysis
   */
  generateStrategyAnalyses(sessions: BotSessionRow[], positions: PositionRow[]): StrategyAnalysis[] {
    return sessions.map(s => {
      const roi = this.calculateROI(s.start_balance, s.end_balance || s.start_balance);
      const winRate = s.total_trades > 0 ? (s.winning_trades / s.total_trades) * 100 : 0;
      const config = s.strategy_config ? JSON.parse(s.strategy_config) : {};
      const botPositions = positions.filter(p => p.bot_id === s.bot_id);

      const insights: string[] = [];
      let recommendation = "Keep current settings";

      // Generate insights based on performance
      if (roi > 100) {
        insights.push("Outstanding performance - analyze what conditions led to success");
      }
      if (winRate > 80 && s.total_trades >= 5) {
        insights.push("High win rate with sufficient trades - strategy is working well");
      }
      if (winRate < 40 && s.total_trades >= 5) {
        recommendation = `Consider adjusting thresholds - current win rate ${winRate.toFixed(0)}% is below target`;
      }
      if (s.total_trades < 3 && roi < 0) {
        recommendation = "Strategy may be too conservative - consider lowering thresholds";
      }

      // Check for lucky outlier trades
      if (botPositions.length > 0) {
        const pnls = botPositions.filter(p => p.pnl !== null).map(p => p.pnl!);
        if (pnls.length > 0) {
          const maxPnl = Math.max(...pnls);
          const avgPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
          if (maxPnl > avgPnl * 3) {
            insights.push(`Best trade ($${maxPnl.toFixed(2)}) is 3x+ avg - may be luck, not strategy`);
          }
        }
      }

      return {
        strategy: s.strategy,
        botName: s.bot_name,
        roi,
        winRate,
        trades: s.total_trades,
        config,
        insights,
        recommendation,
      };
    });
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(analyses: StrategyAnalysis[]): string[] {
    const recs: string[] = [];

    // Top performer recommendation
    const top = analyses.reduce((best, a) => a.roi > best.roi ? a : best, analyses[0]);
    if (top.roi > 50) {
      recs.push(`${top.botName} is top performer - keep ${top.strategy} config: ${JSON.stringify(top.config)}`);
    }

    // Poor performers
    const poor = analyses.filter(a => a.roi < -20);
    poor.forEach(a => {
      recs.push(`${a.botName} underperforming - ${a.recommendation}`);
    });

    // Strategies needing more trades
    const lowTrade = analyses.filter(a => a.trades < 3);
    lowTrade.forEach(a => {
      recs.push(`${a.botName} only ${a.trades} trades - consider lowering thresholds to increase activity`);
    });

    return recs;
  }

  /**
   * Calculate session duration from sessions
   */
  private calculateDuration(sessions: BotSessionRow[]): string {
    if (sessions.length === 0) return "N/A";

    const startTimes = sessions.map(s => s.start_time);
    const endTimes = sessions.map(s => s.end_time || Date.now());

    const minStart = Math.min(...startTimes);
    const maxEnd = Math.max(...endTimes);

    const durationMs = maxEnd - minStart;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Save summary to file
   */
  saveToFile(summary: string, directory: string = "docs/sessions"): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T");
    const filename = `${timestamp[0]}-${timestamp[1].slice(0, 8)}-session-summary.md`;
    const filepath = `${directory}/${filename}`;

    // Ensure directory exists
    if (!existsSync(dirname(filepath))) {
      mkdirSync(dirname(filepath), { recursive: true });
    }

    writeFileSync(filepath, summary, "utf-8");
    return filepath;
  }
}

// Singleton instance
export const sessionSummaryGenerator = new SessionSummaryGenerator();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/session-summary.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit SessionSummaryGenerator**

```bash
git add src/lib/session-summary-generator.ts tests/session-summary.test.ts
git commit -m "feat(summary): add SessionSummaryGenerator for markdown reports

- Generate performance ranking table
- Analyze strategy performance with insights
- Provide actionable recommendations
- Save to docs/sessions directory

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Add Session Summary API Endpoint

**Files:**
- Modify: `src/lib/global.ts`
- Find and modify: API routes file (check for server or routes file)

- [ ] **Step 1: Find the API routes file**

```bash
grep -r "api/bots" src/ --include="*.ts" -l
```

- [ ] **Step 2: Add export to global.ts**

```typescript
// Add to src/lib/global.ts
export { sessionSummaryGenerator } from "./session-summary-generator";
```

- [ ] **Step 3: Add session summary endpoint**

Locate the API routes section and add:

```typescript
// Add API endpoint for session summary
// GET /api/session/:id/summary
app.get("/api/session/:id/summary", async (req, res) => {
  const sessionId = req.params.id;

  try {
    const session = await dbService.getBotSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const positions = await dbService.getPositionsByBot(session.bot_id);
    const logs = await dbService.getSessionLogs(sessionId);

    const summary = sessionSummaryGenerator.generate([session], positions);

    // Save summary to file
    const filepath = sessionSummaryGenerator.saveToFile(summary);

    res.json({
      summary,
      filepath,
      session,
      positions: positions.length,
      logs: logs.length,
    });
  } catch (error) {
    console.error("[API] Session summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

// POST /api/competition/summary - Generate summary for all sessions in competition
app.post("/api/competition/summary", async (req, res) => {
  try {
    const sessions = await dbService.getAllBotSessions(50);
    const allPositions: PositionRow[] = [];

    for (const session of sessions) {
      const positions = await dbService.getPositionsByBot(session.bot_id);
      allPositions.push(...positions);
    }

    const summary = sessionSummaryGenerator.generate(sessions, allPositions);
    const filepath = sessionSummaryGenerator.saveToFile(summary);

    res.json({
      summary,
      filepath,
      sessions: sessions.length,
      positions: allPositions.length,
    });
  } catch (error) {
    console.error("[API] Competition summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});
```

- [ ] **Step 4: Auto-generate summary on competition end**

```typescript
// In competition stop handler, add summary generation
// After "competitionManager.stopCompetition()":

const sessions = await dbService.getAllBotSessions(20);
const positions = [];
for (const s of sessions) {
  const p = await dbService.getPositionsByBot(s.bot_id);
  positions.push(...p);
}
const summary = sessionSummaryGenerator.generate(sessions, positions);
const filepath = sessionSummaryGenerator.saveToFile(summary);

// Broadcast summary via SSE
broadcastToSSE({
  type: "summary_generated",
  data: { filepath, sessions: sessions.length }
});
```

- [ ] **Step 5: Commit API endpoints**

```bash
git add src/lib/global.ts [api-file]
git commit -m "feat(api): add session summary endpoints

- GET /api/session/:id/summary for single session
- POST /api/competition/summary for all sessions
- Auto-generate summary on competition end

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Run Integration Test

**Files:**
- No new files, run existing test suite

- [ ] **Step 1: Run all tests to verify no regressions**

```bash
bun test
```

Expected: All tests pass

- [ ] **Step 2: Run database migration test**

```bash
# Start dev server to trigger DB schema update
bun dev &
sleep 3

# Check schema was updated
sqlite3 data/polymarket.db ".schema bot_sessions" | grep strategy_config
sqlite3 data/polymarket.db ".schema positions" | grep decision_context
sqlite3 data/polymarket.db ".schema session_logs"
```

Expected: Schema shows new columns and session_logs table

- [ ] **Step 3: Kill dev server and commit**

```bash
pkill -f "bun dev"
```

---

## Task 9: Final Commit and Verification

- [ ] **Step 1: Verify DB has new columns**

```bash
sqlite3 data/polymarket.db "PRAGMA table_info(bot_sessions);"
sqlite3 data/polymarket.db "PRAGMA table_info(positions);"
sqlite3 data/polymarket.db "PRAGMA table_info(session_logs);"
```

Expected: New columns visible in output

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

- [ ] **Step 3: Create final commit with all changes**

```bash
git add -A
git status
git commit -m "feat(logging): complete bot logging and documentation system

- Extended DB schema for risk metrics, decision context, session logs
- RiskMetricsCalculator calculates Sharpe, drawdown, streaks
- buildDecisionContext captures full trade reasoning
- SessionSummaryGenerator creates markdown reports
- API endpoints for session summaries
- Auto-summary on competition end

Success criteria:
- Risk metrics now calculated (no more 0 values)
- Decision context queryable in DB
- Session summaries saved to docs/sessions/
- Config stored with sessions for comparison

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Success Criteria Checklist

- [ ] All risk metrics calculated (max_drawdown, sharpe_ratio non-zero after 5+ trades)
- [ ] Decision context stored in positions.decision_context column
- [ ] Strategy config stored in bot_sessions.strategy_config column
- [ ] Session logs persisted to session_logs table
- [ ] Session summaries generated as markdown files in docs/sessions/
- [ ] API endpoints `/api/session/:id/summary` and `/api/competition/summary` working
- [ ] All existing tests still pass