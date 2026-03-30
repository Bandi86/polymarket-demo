# Bot Logging & Documentation System Design

**Date:** 2026-03-30
**Status:** Approved for Implementation
**Author:** Claude Code Session

---

## Problem Statement

The current bot trading system has critical gaps in logging and documentation:

1. **Risk metrics not calculated** - `max_drawdown` and `sharpe_ratio` always 0
2. **Strategy thresholds not stored** - Can't know what config was active during sessions
3. **Logs lost after session** - BotLogger only keeps 100 logs in memory, never persisted
4. **No trade decision details** - See trade results but not WHY decisions were made
5. **No session summaries** - No aggregated documentation after runs
6. **No config history** - When thresholds change, previous versions are lost

**Impact:** Cannot debug why sessions fail, cannot compare working vs non-working configs, cannot track improvements.

---

## Solution Overview

Implement a comprehensive logging and documentation system with:

1. **Extended database schema** - Store config, decision context, risk metrics
2. **Risk metrics calculator** - Calculate Sharpe, drawdown, streaks
3. **Decision context logging** - Full "why" for each trade
4. **Session summaries** - Auto-generated markdown reports
5. **Config version tracking** - Strategy thresholds stored with each session

---

## Section 1: Database Schema Changes

### Extend bot_sessions Table

```sql
ALTER TABLE bot_sessions ADD COLUMN strategy_config JSON;
ALTER TABLE bot_sessions ADD COLUMN bot_config JSON;
ALTER TABLE bot_sessions ADD COLUMN session_notes TEXT;
```

**strategy_config:** Stores thresholds active at session start
```json
{
  "minDelta": 0.07,
  "minTimeRemaining": 3000,
  "maxTimeRemaining": 270000,
  "minEdge": 0.07
}
```

**bot_config:** Full bot settings for reference
```json
{
  "betSize": 2,
  "maxBet": 0.25,
  "useKelly": true,
  "kellyFraction": 0.25,
  "interval": 5000
}
```

**session_notes:** Auto-summary or manual notes (TEXT field)

### Extend positions Table

```sql
ALTER TABLE positions ADD COLUMN decision_context JSON;
ALTER TABLE positions ADD COLUMN btc_price REAL;
ALTER TABLE positions ADD COLUMN time_remaining INTEGER;
```

**decision_context:** Full context for trade decision (see Section 3)
**btc_price:** BTC price at moment of trade
**time_remaining:** Seconds left in market at trade time

### Add session_logs Table

```sql
CREATE TABLE session_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  bot_id TEXT,
  type TEXT,
  message TEXT,
  details JSON,
  timestamp INTEGER,
  FOREIGN KEY (session_id) REFERENCES bot_sessions(id)
);

CREATE INDEX idx_session_logs_session ON session_logs(session_id);
CREATE INDEX idx_session_logs_bot ON session_logs(bot_id);
```

**Purpose:** Persist all in-memory BotLogger logs to database for later analysis.

---

## Section 2: Risk Metrics Calculation

### Metrics to Calculate

| Metric | Calculation | Update Frequency |
|--------|-------------|------------------|
| `max_drawdown` | Peak-to-trough decline % | Continuous |
| `sharpe_ratio` | avg_pnl / std_dev_pnl | End of session (need 5+ trades) |
| `win_rate` | wins / total_trades | Continuous |
| `profit_factor` | gross_profit / gross_loss | End of session |
| `avg_win` | avg pnl of winning trades | End of session |
| `avg_loss` | avg pnl of losing trades | End of session |
| `best_trade` | Highest single trade pnl | Continuous |
| `worst_trade` | Lowest single trade pnl | Continuous |
| `longest_win_streak` | Consecutive wins | Continuous |
| `longest_loss_streak` | Consecutive losses | Continuous |

### Implementation: RiskMetricsCalculator Class

```typescript
class RiskMetricsCalculator {
  private balanceHistory: number[] = [];
  private tradePnls: number[] = [];

  recordBalance(balance: number): void;
  recordTradePnl(pnl: number): void;

  calculateMaxDrawdown(): number;
  calculateSharpeRatio(): number;
  calculateProfitFactor(): number;
  getMetrics(): RiskMetrics;
}
```

**Usage:**
- BotManager creates instance per bot at session start
- `recordBalance()` called after each trade settlement
- `recordTradePnl()` called when position closes
- At session end: `getMetrics()` returns all metrics for DB save

### Integration Points

1. **BotManager.startBot():** Create RiskMetricsCalculator per bot
2. **MarketEngine.settlePosition():** Call `recordBalance()` and `recordTradePnl()`
3. **BotManager.stopBot():** Calculate final metrics, save to session

---

## Section 3: Decision Context Logging

### DecisionContext Interface

```typescript
interface DecisionContext {
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
```

### Implementation

**New function:** `buildDecisionContext()` in strategy-executor.ts

```typescript
export function buildDecisionContext(
  bot: BotConfig,
  context: StrategyContext,
  decision: { action: Outcome; confidence: number; reason?: string },
  betSize: number,
  riskCheck: { allowed: boolean; reason?: string }
): DecisionContext;
```

**Integration:**
- Called in `BotManager.executeBotStrategy()` after decision
- Stored in `decision_context` column when position created
- Enables querying: "Show all trades where btcDelta > 0.1"

---

## Section 4: Auto-Generated Session Summaries

### Summary Structure

**File location:** `docs/sessions/YYYY-MM-DD-HH-MM-session-summary.md`

**Sections:**

1. **Header:** Date, duration, mode, bot count, market count
2. **Bot Performance Ranking:** Table sorted by ROI with notes
3. **Strategy Analysis:** Per-strategy deep dive with config, insights, recommendations
4. **Risk Metrics Summary:** Portfolio-level and per-bot metrics
5. **Recommendations for Next Session:** Actionable suggestions based on analysis
6. **Footer:** Generation timestamp, session IDs

### Implementation: SessionSummaryGenerator

```typescript
class SessionSummaryGenerator {
  generate(sessions: BotSession[], positions: Position[]): string;
  generatePerStrategyAnalysis(session: BotSession, positions: Position[]): StrategyAnalysis;
  generateRecommendations(analyses: StrategyAnalysis[]): string;
}
```

**Trigger:**
- Auto-generate when competition/session ends
- Save to `docs/sessions/`
- Also store in `session_notes` column (first 500 chars as preview)

---

## Section 5: Config Version Tracking

### Strategy Config Snapshot

**At session start:** Store current strategy thresholds in `strategy_config` column.

**Why:** Enables comparison of sessions with different configs.

**Example query:**
```sql
SELECT bot_name, total_pnl, strategy_config->>'minDelta' as minDelta
FROM bot_sessions
WHERE bot_id = 'bot-window-delta'
ORDER BY start_time DESC;
```

**Result:** Shows ROI vs minDelta threshold, reveals optimal values.

### Config Change Logging

**New endpoint:** `POST /api/config/update`

When thresholds are manually changed:
1. Log to `session_logs` with type "CONFIG_CHANGE"
2. Include old and new values in details

---

## Implementation Plan Summary

### Files to Modify

1. **src/lib/database.ts:**
   - Add schema migrations for new columns
   - Add `saveSessionLog()` and `getSessionLogs()` methods

2. **src/lib/bot-manager.ts:**
   - Store strategy config at session start
   - Integrate RiskMetricsCalculator
   - Call `buildDecisionContext()` for each trade

3. **src/lib/bot-manager/strategy-executor.ts:**
   - Add `buildDecisionContext()` function

4. **src/lib/risk-manager.ts:**
   - Add `RiskMetricsCalculator` class

5. **src/lib/session-summary-generator.ts:** (NEW FILE)
   - Generate markdown summaries

6. **src/server.ts:**
   - Add `/api/session/:id/summary` endpoint

### Migration Strategy

1. **Safe migration:** SQLite ALTER TABLE supports ADD COLUMN
2. **Backward compatible:** New columns nullable or default to empty JSON
3. **Existing data:** Fill empty for past sessions (no retroactive calculation)

### Testing

1. Run session with new logging enabled
2. Verify decision context stored in DB
3. Verify session summary generated correctly
4. Verify risk metrics calculated and non-zero

---

## Success Criteria

1. **All risk metrics calculated:** No more 0 values for max_drawdown, sharpe_ratio
2. **Decision context queryable:** Can see why each trade was made
3. **Session summaries generated:** Markdown reports in docs/sessions/
4. **Config comparison possible:** Query shows threshold vs performance correlation
5. **Logs persisted:** All BotLogger logs saved to session_logs table

---

## Appendix: Example Queries

### Find best performing config for Window Delta

```sql
SELECT
  strategy_config->>'minDelta' as minDelta,
  AVG(total_pnl) as avgPnl,
  COUNT(*) as sessions
FROM bot_sessions
WHERE bot_id = 'bot-window-delta' AND total_trades > 5
GROUP BY strategy_config->>'minDelta'
ORDER BY avgPnl DESC;
```

### Show all trades with high confidence but losses

```sql
SELECT
  bot_name,
  outcome,
  odds,
  pnl,
  decision_context->>'confidence' as confidence,
  decision_context->>'reason' as reason
FROM positions
WHERE pnl < 0 AND decision_context->>'confidence' > 0.8
ORDER BY pnl DESC;
```

### Session logs for debugging

```sql
SELECT timestamp, type, message, details
FROM session_logs
WHERE session_id = 'session-1774792466515-ac91sje'
ORDER BY timestamp;
```