# Bot Analytics Dashboard Design

**Date:** 2026-03-11
**Status:** Approved
**Author:** Claude (via brainstorming session)

## Overview

A dedicated bot tracking and performance monitoring dashboard that allows users to:
1. Track which bot is doing what in real-time
2. Compare bot performance across sessions
3. Analyze historical performance for later review

## Requirements

- Each bot starts with $10 balance
- Multiple bots can run simultaneously with different strategies
- Users need to see real-time activity and make comparisons
- Historical data should be exportable for external analysis

## Design

### Page Structure

**Route:** `/bots`

**Access Points:**
1. Header button: "Bot Dashboard" next to refresh button
2. Link in existing BotManager panel footer

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: "Bot Dashboard"           [Live] [History] tabs │
│ [← Back to Trading]                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              Tab Content Area                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tab 1: Live Monitor

**Purpose:** Real-time view of all bots running simultaneously

**Summary Bar:**
- Active bots count: "5/10 Active"
- Total realized PnL across all bots
- Total open positions

**Bot Status Grid:**
Responsive grid (2-3 columns) with cards for each bot.

Each card displays:
- Status indicator: ● green (running) / ○ gray (stopped)
- Bot name + strategy
- Current balance
- Realized PnL with percentage (color-coded: green/red)
- Open positions count + unrealized PnL
- Total trades + win rate
- Last action with timestamp

**Sorting Options:**
- By PnL (default)
- By Win Rate
- By Number of Trades
- By Balance

**Activity Feed (Collapsible):**
- Shows recent TRADE/DECISION logs from all bots
- Real-time updates via existing SSE connection
- Expandable/collapsible at bottom of page

### Tab 2: Session History

**Purpose:** Deep dive into completed sessions for analysis and comparison

**Filters & Controls:**
- Strategy dropdown filter
- Date range picker (Last 24h, 7 days, 30 days, Custom)
- Sort dropdown (PnL, Win Rate, Date, Trades)
- Export button (CSV/JSON)

**Sessions Table:**
| Column | Description |
|--------|-------------|
| Bot | Bot name (abbreviated) |
| Strategy | Strategy type |
| Duration | Runtime of session |
| Trades | Total trades made |
| PnL | Realized profit/loss |
| Win% | Win rate percentage |
| Status | Completed/Error |

Rows are clickable to expand session detail.

**Session Detail Panel:**
Appears below table when row is clicked.

Contains:
- Session stats card:
  - Start/End balance
  - Peak balance
  - Max drawdown
  - Runtime
- Mini equity curve chart (sparkline)
- Collapsible trade log showing all trades with decisions

**Strategy Comparison:**
- Checkbox on each row
- "Compare" button appears when 2+ selected
- Opens comparison modal/view with:
  - Bar charts comparing: Avg PnL, Win Rate, ROI
  - Comparison table with aggregated metrics
  - Visual indicators for best performers

### Technical Architecture

**Frontend Components:**
- `BotDashboardPage.tsx` - Main page component
- `LiveMonitorTab.tsx` - Tab 1 content
- `SessionHistoryTab.tsx` - Tab 2 content
- `BotStatusCard.tsx` - Individual bot card
- `SessionDetailPanel.tsx` - Expanded session view
- `StrategyComparison.tsx` - Comparison modal/view

**Data Flow:**
- Reuse existing `useTradingData` hook for live bot data
- New `useBotSessions` hook for session history
- Extend `BotManager.getSessions()` for API endpoint
- SSE for real-time updates in Live Monitor

**API Endpoints (if needed):**
- `GET /api/bots/sessions` - List all sessions with filters
- `GET /api/bots/sessions/:id` - Single session detail
- `GET /api/bots/sessions/export` - Export sessions as CSV/JSON

**State Management:**
- URL params for filters/sorting (shareable links)
- Local state for UI interactions
- No global state changes needed

### Styling

- Use existing glass-card styling
- Match existing color palette and typography
- Responsive design: 3 cols on desktop, 2 on tablet, 1 on mobile
- Animations for status changes and updates

### Out of Scope

- Real-time price charts in session history
- Multiple session comparison beyond 5 sessions
- Advanced analytics (Sharpe ratio, etc.) - future enhancement
- Bot configuration editing (use existing BotManager)

## Success Criteria

1. User can see all bots' status at a glance
2. User can compare which strategy performs best
3. User can export session data for external analysis
4. Real-time updates feel responsive (< 1s latency)
5. Page loads in < 2s with 100 sessions

## Future Enhancements

- Equity curve charts for Live Monitor
- Advanced metrics (Sharpe ratio, max drawdown, etc.)
- Bot alerting (notify when PnL threshold reached)
- Session replay feature