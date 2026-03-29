---
name: bot-strategy-ui-full-refactor
description: Teljes refactor: stratégia split, UI extend, event system, config system
type: project
---

# Bot Strategy & UI Full Refactor Design

## Overview

Ez a refactor 4 fő elemet tartalmaz, prioritási sorrendben:
1. **Stratégia Split** - Minden stratégia külön fájlba
2. **UI Extend** - BotCard bővítés + Live Log panel + Diagnostics
3. **Event System** - Central EventBus + Trade events
4. **Config System** - Runtime configurable thresholds

## Goals

- **Stratégia diagnosztika javítása** - könnyebb debug, tuning
- **UI láthatóság** - last action, delta info, live log
- **Architektúra** - event-driven, modular
- **Cél elérése** - 3-4$/hour profit (9 bot összesen)

---

## 1. STRATÉGIA SPLIT

### Current State
- `src/lib/strategies/all-strategies.ts` - 674 lines, 9 strategies inline
- Nehezen debugolható, threshold-ok hard-coded

### Proposed Structure

```
src/lib/strategies/
├── index.ts              # Registry + exports
├── types.ts              # Strategy interface, StrategyContext
├── base.ts               # Base strategy helpers
├── config.ts             # Strategy thresholds (configurable)
│
├── strategies/
│   ├── window-delta.ts   # #1 Window Delta
│   ├── oracle-lag.ts     # #2 Oracle Lag (Binance signal)
│   ├── t10-sniper.ts     # #3 T-10 Sniper
│   ├── monte-carlo.ts    # #4 Monte Carlo
│   ├── fair-value.ts     # #5 Fair Value Arb
│   ├── momentum.ts       # #6 BTC Momentum
│   ├── smart-trend.ts    # #7 Smart Trend
│   ├── contrarian.ts     # #8 Contrarian
│   ├── arbitrage.ts      # #9 Arbitrage
│   └── _disabled.ts      # Inactive strategies
```

### Strategy Interface

```typescript
// types.ts
export interface Strategy {
  name: string;
  description: string;
  category: "momentum" | "arbitrage" | "trend" | "mean_reversion" | "other";
  execute: (ctx: StrategyContext) => StrategyDecision;
  getDefaultConfig?: () => StrategyThresholds;
}

export interface StrategyThresholds {
  minDelta?: number;        // Minimum BTC delta %
  minConfidence?: number;   // Minimum confidence to trade
  minPrice?: number;        // Minimum price to buy (cents)
  maxPrice?: number;        // Maximum price to buy (cents)
  minTimeRemaining?: number; // Min time before market close (ms)
  maxTimeRemaining?: number; // Max time from market start (ms)
}

export interface StrategyDecision {
  action: "YES" | "NO" | null;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
}
```

### Config File

```typescript
// config.ts
export const strategyConfig: Record<StrategyType, StrategyThresholds> = {
  window_delta: {
    minDelta: 0.07,        // Strong: 0.12, Medium: 0.07
    minConfidence: 0.55,
    minPrice: 30,          // Don't buy below 30¢
    maxPrice: 70,          // Don't buy above 70¢
    minTimeRemaining: 3000,
    maxTimeRemaining: 270000,
  },
  fair_value: {
    minDelta: 0.04,
    minEdge: 0.07,         // Minimum edge to trade
    minPrice: 30,
    maxPrice: 65,          // Tighter range
    minTimeRemaining: 15000,
  },
  // ... all strategies
};
```

### Fixes for Problematic Strategies

#### Fair Value Arb (current: -$5.49, 36% win)
- **Issue**: Trading at extreme prices (>70¢), too many trades
- **Fix**: Tighter price range (30-65¢), higher minEdge (0.07→0.10)
- **Fix**: Add delta confirmation (>0.04% required)

#### Oracle Lag (current: 0 trades)
- **Issue**: Binance signal not arriving or rejected
- **Fix**: Add fallback to window delta if signal expired
- **Fix**: Relax price limits slightly (25-75¢ for oracle)
- **Fix**: Add signal freshness check (max 8s old)

#### BTC Momentum (current: -$2.30, 47% win)
- **Issue**: Threshold too low, trades at wrong prices
- **Fix**: Higher momentum threshold (0.05→0.07%)
- **Fix**: Price limits (30-70¢)

#### Window Delta (current: only 2 trades)
- **Issue**: Too passive, threshold too high
- **Fix**: Lower minDelta for medium signals (0.07→0.05)
- **Fix**: Add bonus for aligned Binance signal

---

## 2. UI EXTEND

### Current State
- `BotStatusCard` - basic balance + trades display
- No activity indicator, no reason display, no diagnostics

### Proposed Components

```
src/components/
├── bot-card/
│   ├── BotCardExtended.tsx    # Main card with all info
│   ├── BotStatusBadge.tsx     # ACTIVE/PASSIVE/PAUSED/ERROR
│   ├── BotLastAction.tsx      # Last decision + reason
│   ├── BotDeltaInfo.tsx       # BTC delta + direction
│   ├── BotTradeStats.tsx      # Win rate, avg win/loss
│   └── BotConfigBadge.tsx     # Kelly, interval badges
│
├── dashboard/
│   ├── LiveLogPanel.tsx       # Real-time trade feed
│   ├── DiagnosticsPanel.tsx   # BTC delta, signal, price
│   ├── MarketStatusPanel.tsx  # Current market info
│   └── StrategyHeatmap.tsx    # Which strategies active
```

### BotCardExtended Layout

```
┌─────────────────────────────────────┐
│ Window Delta          $9.43 ▼0.57   │
│ ─────────────────────────────────── │
│ ⏱️ Last: 3m ago                      │
│ Δ BTC: +0.08% → UP signal           │
│ ─────────────────────────────────── │
│ Last action:                        │
│ "Delta túl kicsi: 0.04%"            │
│ ─────────────────────────────────── │
│ [PASSIVE] [Kelly:35%] [2s interval] │
│ ─────────────────────────────────── │
│ 2 trades | 50% win | -$0.57         │
│ Avg win: $0.45 | Avg loss: $0.32    │
└─────────────────────────────────────┘
```

### LiveLogPanel

Real-time scrolling log of trade events:
```
┌─────────────────────────────────────┐
│ 🔴 LIVE TRADE LOG                   │
│ ─────────────────────────────────── │
│ 10:45:23 Fair Value: NO @ 35¢      │
│            Reason: edge=0.12        │
│ 10:44:15 Contrarian: YES @ 48¢ ✓   │
│            Filled, +$0.93 profit    │
│ 10:43:02 Window Delta: SKIP        │
│            Reason: delta 0.04%      │
└─────────────────────────────────────┘
```

### DiagnosticsPanel

```
┌─────────────────────────────────────┐
│ 📊 DIAGNOSTICS                       │
│ ─────────────────────────────────── │
│ BTC Delta:     +0.08%               │
│ Binance Signal: UP (fresh 2s)       │
│ Market Price:  YES 52¢ NO 48¢      │
│ Time Left:     2m 34s               │
│ ─────────────────────────────────── │
│ Active Signals:                     │
│ ✓ Oracle Lag: UP, conf 0.72        │
│ ✓ Window Delta: UP, conf 0.65      │
│ ✗ T-10 Sniper: outside window      │
└─────────────────────────────────────┘
```

---

## 3. EVENT SYSTEM

### Current State
- SSE broadcasting for UI updates
- No structured event bus
- Trade events not captured centrally

### Proposed Architecture

```typescript
// src/lib/events/event-bus.ts
export type BotEvent =
  | { type: "TRADE_DECISION"; botId; action; confidence; reason }
  | { type: "TRADE_EXECUTED"; botId; positionId; outcome; amount; price }
  | { type: "POSITION_SETTLED"; botId; positionId; pnl }
  | { type: "BOT_STARTED"; botId; strategy }
  | { type: "BOT_STOPPED"; botId; reason }
  | { type: "SIGNAL_RECEIVED"; source; type; confidence }
  | { type: "MARKET_CREATED"; marketId; startTime }
  | { type: "MARKET_SETTLED"; marketId; outcome };

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  emit(event: BotEvent): void;
  on(eventType: string, handler: EventHandler): () => void;
  once(eventType: string, handler: EventHandler): void;
}

// Singleton
export const eventBus = new EventBus();
```

### Integration Points

1. **Strategy Executor** - emits TRADE_DECISION
2. **Market Engine** - emits TRADE_EXECUTED, POSITION_SETTLED
3. **Binance Provider** - emits SIGNAL_RECEIVED
4. **Bot Manager** - emits BOT_STARTED, BOT_STOPPED
5. **UI Components** - subscribe to events for real-time updates

---

## 4. CONFIG SYSTEM

### Current State
- Hard-coded thresholds in strategies
- No runtime tuning capability

### Proposed System

```typescript
// src/lib/config/runtime-config.ts
export interface RuntimeConfig {
  strategies: StrategyThresholds;
  risk: RiskThresholds;
  ui: UIConfig;
}

export class ConfigManager {
  private config: RuntimeConfig;

  getStrategyConfig(strategy: StrategyType): StrategyThresholds;
  updateStrategyConfig(strategy: StrategyType, updates: Partial<StrategyThresholds>): void;

  // Hot reload from file
  reload(): void;

  // Save current config
  save(): void;
}

// UI endpoint: POST /api/config/strategy/:name
// Body: { minDelta: 0.08, minPrice: 35, ... }
```

### Config File Location

`config/strategies.json` - editable, hot-reloadable

```json
{
  "window_delta": {
    "minDelta": 0.07,
    "minConfidence": 0.55,
    "minPrice": 30,
    "maxPrice": 70
  },
  "fair_value": {
    "minDelta": 0.04,
    "minEdge": 0.10,
    "minPrice": 30,
    "maxPrice": 65
  }
}
```

---

## Implementation Order

### Phase 1: Strategy Split + Fixes
1. Create strategy directory structure
2. Extract each strategy to separate file
3. Add configurable thresholds
4. Fix Fair Value, Oracle Lag, Momentum thresholds
5. Test with 30-minute run

### Phase 2: UI Extend
1. Create BotCardExtended component
2. Add sub-components (Badge, LastAction, DeltaInfo)
3. Create LiveLogPanel
4. Create DiagnosticsPanel
5. Integrate into CompetitionTab

### Phase 3: Event System
1. Create EventBus class
2. Integrate into BotManager
3. Integrate into MarketEngine
4. Subscribe UI components to events

### Phase 4: Config System
1. Create ConfigManager
2. Add API endpoints for config update
3. Create config file
4. Add hot reload

---

## Success Criteria

- **Win rate**: 50%+ overall (currently 49%)
- **Profit**: $3-4/hour (currently -$8/2h = -$4/hour)
- **Fair Value**: Reduce losses, 50%+ win rate
- **Oracle Lag**: Actually trades (>0 trades)
- **UI**: Clear diagnostics, live log visible

---

## Why

**Why stratégia split first:**
- Biggest loss source is strategy bugs
- Can't fix without clear visibility
- Modular code = easier tuning

**Why UI extend second:**
- Diagnostics needed to verify fixes work
- Live log shows real-time activity
- Better visibility = faster debugging

**Why event system third:**
- Architectural foundation for UI updates
- Clean separation of concerns
- Enables future features (analytics, notifications)

**Why config system fourth:**
- Runtime tuning without restart
- Experiment with thresholds
- Nice-to-have, not critical

---

## How to Apply

1. Create strategy files one by one, test after each
2. Build UI components incrementally
3. Integrate event bus after strategies stabilized
4. Add config system when architecture settled