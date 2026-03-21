# Polymarket Trading Demo - Project Guide

## Overview

A real-time Bitcoin/crypto prediction market simulator with automated trading bots. Uses live price data from Binance and creates simulated 5-minute markets for UP/DOWN predictions.

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:3000

## Architecture

```
src/
├── components/           # React UI components
│   ├── App.tsx          # Main app with routing/tabs
│   ├── TopDashboard.tsx # Header with global controls
│   ├── BotStatusCard.tsx # Individual bot monitoring cards
│   ├── LiveMonitorTab.tsx # Bot monitoring dashboard
│   ├── CompetitionTab.tsx # Strategy competition view
│   └── SessionSummaryModal.tsx # End-of-session results
├── lib/                  # Core business logic
│   ├── bot-manager.ts   # Bot strategies, competition logic
│   ├── market-engine.ts # Market creation, settlement
│   ├── market-analyzer.ts # Technical analysis
│   ├── risk-manager.ts  # Risk management
│   ├── strategy-coordinator.ts # Multi-bot coordination
│   ├── database.ts      # SQLite persistence
│   └── providers/       # External data providers
├── hooks/
│   └── useTradingData.ts # Main data fetching/SSE hook
├── types/
│   └── index.ts         # TypeScript interfaces
└── server.ts            # Bun server + API routes
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/bot-manager.ts` | Bot strategies, competition state, portfolio tracking |
| `src/lib/market-engine.ts` | Market lifecycle, position settlement |
| `src/hooks/useTradingData.ts` | Frontend state management, SSE handling |
| `src/server.ts` | API endpoints, SSE broadcasting |
| `src/types/index.ts` | All TypeScript interfaces |

## Data Types

### Position
```typescript
interface Position {
  id: string;
  marketId: string;
  outcome: "YES" | "NO";
  amount: number;      // Number of shares
  odds: number;        // Entry price (0-1)
  stake: number;       // USD invested
  fee: number;
  timestamp: number;
  status: "open" | "closed" | "settled";
  pnl: number | null;
  botId?: string;
}
```
**Important:** Entry price is stored in `odds` field, NOT `entryPrice` or `avgEntry`.

### BotData
```typescript
interface BotData {
  id: string;
  name: string;
  strategy: string;
  enabled: boolean;
  interval: number;
  betSize: number;
  maxBet: number;        // Percentage of bankroll (e.g., 0.25 = 25%)
  useKelly: boolean;
  kellyFraction: number;
  runTime?: number;      // Timestamp when started
  stats: {
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
    winRate: number;
    // ...
  };
  portfolio: {
    balance: number;
    closedPositions: Position[];
  };
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market` | Current market state |
| GET | `/api/portfolio` | User portfolio |
| GET | `/api/bots` | List all bots |
| POST | `/api/bots/:id/toggle` | Start/stop a bot |
| POST | `/api/bots/run-all` | Start all bots |
| POST | `/api/bots/stop-all` | Stop all bots |
| POST | `/api/bots/reset-all` | Reset bot balances |
| POST | `/api/trade` | Place manual trade |
| POST | `/api/reset` | Full system reset |
| GET | `/api/sse` | Server-sent events for real-time updates |
| GET | `/api/competition/status` | Competition state |
| POST | `/api/competition/start` | Start competition |
| POST | `/api/competition/stop` | Stop competition |
| POST | `/api/competition/clear` | Clear competition state |

## SSE Message Types

| Type | Description |
|------|-------------|
| `connected` | Initial data on connection |
| `market` | Price/market updates |
| `competition` | Competition state changes |
| `bot_log` | New bot activity log |

## Competition/Session Flow

1. User starts competition via Quick Run (15m, 30m, 1h, 2h) or custom config
2. All bots reset to start balance, competition starts
3. Bots trade automatically based on strategies
4. When duration ends or user stops:
   - Competition marked inactive
   - `completedAt` timestamp set
   - Session summary modal shows results
5. User closes modal → system resets to fresh state

## Bot Strategies

| Strategy | Description |
|----------|-------------|
| `random` | Randomly buys YES or NO |
| `momentum` | Follows recent price momentum |
| `mean_reversion` | Bets against extreme prices |
| `trend` | Follows established trends |
| `fair_value` | Bets when price deviates from 0.5 |
| `window_delta` | Compares BTC price change over time window |
| `binance_signal` | Uses Binance price movement signals |
| `last_seconds_scalp` | Quick scalps in final seconds |

## Common Issues & Solutions

### Entry price shows 0.0¢
Position uses `odds` field for entry price. Always access as `position.odds`, not `entryPrice` or `avgEntry`.

### Competition state not updating
Competition state is broadcast via SSE. Check that:
1. SSE connection is active
2. `useTradingData` is handling `competition` message type

### Values not resetting after session
Call `/api/competition/clear` endpoint which resets competition state and broadcasts via SSE.

## Testing

```bash
bun run test        # Run tests in watch mode
bun run test:run    # Run tests once
```

## Database

SQLite database stored at `data/polymarket.db`:
- `bot_sessions` - Historical session data
- `positions` - All positions (open/closed)
- `trades` - Trade history

Query examples:
```sql
-- Get bot sessions
SELECT bot_name, start_balance, end_balance, total_trades, winning_trades
FROM bot_sessions ORDER BY start_time DESC LIMIT 10;

-- Get positions for a bot
SELECT * FROM positions WHERE bot_id = 'bot-window-delta';
```

## Development Notes

- **Runtime**: Bun (never use npm/yarn)
- **Styling**: Tailwind CSS v4 + inline styles
- **State**: React hooks + SSE for real-time
- **No build step needed** - Bun handles TypeScript directly
- **Hot reload** - `bun --hot src/server.ts`