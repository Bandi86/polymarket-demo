# Bot Dashboard Enhancement Design

**Date**: 2026-03-11
**Author**: Claude
**Status**: In Progress

## Overview

Enhance the Bot Analytics Dashboard with individual bot controls, debugging capabilities, parameter tuning, strategy builder, backtesting mode, and AI-powered insights.

## Goals

1. Enable control of individual bots (start/stop/configure)
2. Provide visibility into why bots are or aren't trading
3. Allow parameter tuning for optimization
4. Enable strategy experimentation and backtesting
5. Add AI-powered insights for better decision-making

## Architecture

### Component Structure

```
src/components/
├── BotDashboardPage.tsx       # Main dashboard with tabs
├── LiveMonitorTab.tsx         # Real-time bot grid
├── SessionHistoryTab.tsx      # Historical sessions
├── StrategyLabTab.tsx         # NEW: Strategy builder & backtesting
├── BotStatusCard.tsx          # ENHANCED: Individual bot card
├── BotDebugPanel.tsx          # NEW: Debug panel for bots
├── BotConfigPanel.tsx         # NEW: Parameter tuning
└── BotInsightsPanel.tsx       # NEW: AI insights
```

### API Endpoints (Already Exists)

- `POST /api/bots/:id/toggle` - Start/stop individual bot
- `POST /api/bots/:id/config` - Update bot parameters
- `GET /api/strategy/analyze` - Get strategy analysis
- `GET /api/sessions` - Get session history

## Implementation Phases

### Phase 1: Individual Bot Controls + Debug

**Changes to `BotStatusCard.tsx`**:
- Add toggle button for individual bot start/stop
- Show session duration timer
- Display current YES/NO prices
- Add expandable debug section

**New Component: `BotDebugPanel.tsx`**:
- Real-time decision logic display
- Signal indicators (momentum, volatility, fair value)
- "Why no trades" explanation
- Last action timestamp

### Phase 2: Parameter Tuning

**New Component: `BotConfigPanel.tsx`**:
- Bet size slider ($0.50 - $5.00)
- Interval slider (5s - 60s)
- Strategy-specific parameters
- Immediate preview

### Phase 3: Strategy Builder + Backtesting

**New Tab: Strategy Lab** (`StrategyLabTab.tsx`):
- Visual strategy condition builder
- Historical data backtest
- Performance comparison charts
- Save/load configurations

### Phase 4: AI-Powered Insights

**Enhanced Activity Feed**:
- AI-generated explanations
- Pattern alerts
- Performance predictions

## UI Design

### BotStatusCard Enhanced Layout

```
┌─────────────────────────────────────┐
│ 🟢 Bot Name        [Strategy] [⚙️]  │
│ ─────────────────────────────────── │
│ Balance: $10.50    P&L: +$0.50      │
│ Trades: 12         Win Rate: 58%    │
│ ─────────────────────────────────── │
│ Timer: 5m 32s     YES: 0.52 NO: 0.48│
│ ─────────────────────────────────── │
│ Positions: 2 (+$1.20 unrealized)    │
│ ─────────────────────────────────── │
│ [▶ Start] [⏹ Stop] [🔧 Debug]      │
│ ─────────────────────────────────── │
│ Debug Panel (collapsed by default)  │
│ • Last signal: MOMENTUM_UP          │
│ • Conditions: 2/3 met               │
│ • Why no trade: Volatility too low  │
└─────────────────────────────────────┘
```

### Landing Page Enhancements

- Mini bot status indicators in header
- Quick bot controls in BotPanel
- Performance sparklines

## Technical Considerations

1. **Real-time Updates**: Use existing SSE infrastructure
2. **State Management**: React hooks with local state
3. **Performance**: Debounce rapid config changes
4. **Error Handling**: Graceful fallback for API failures

## Testing Strategy

- Unit tests for new components
- Integration tests for API calls
- E2E tests for bot control flow

## Success Criteria

- User can start/stop individual bots
- Debug panel shows actionable information
- Parameter changes reflect immediately
- Backtesting produces meaningful results
- AI insights are helpful and accurate