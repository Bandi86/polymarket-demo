# BTC Trading Simulator v2.0

A clean, real-time Bitcoin prediction market simulator with live price data from Binance.

## What's New in v2.0

**Complete rebuild from scratch** with lessons learned from v1:

- **Real BTC prices** from Binance API (no fake prices)
- **Clean architecture** with proper separation of concerns
- **Simulated 5-minute markets** that settle based on actual price movements
- **Isolated bot portfolios** - each bot has its own balance tracking
- **Real-time charts** with live price history

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:3000

## Features

### Real-Time Price Data
- Live BTC/USD prices from Binance
- Price history chart with auto-updates
- Market direction indicator (UP/DOWN)

### 5-Minute Markets
- Markets start every 5 minutes
- Settlement based on real price movement
- YES = price goes UP, NO = price goes DOWN

### Trading
- Manual trading with customizable bet amounts
- 2% fee on all trades
- Position tracking with P&L

### Bot Strategies
Each bot has an isolated portfolio (starts with $100):

| Strategy | Description |
|----------|-------------|
| Random | Flips a coin |
| Momentum | Follows price direction |
| Mean Reversion | Bets against extreme moves |
| Trend | Uses price history trend |

## Architecture

```
src/
├── components/
│   └── App.tsx          # React frontend
├── lib/
│   ├── price-service.ts # Binance price fetching
│   ├── market-engine.ts # Market logic
│   └── bot-manager.ts   # Bot strategies
├── types.ts             # TypeScript types
├── server.ts            # Bun server + API routes
├── index.tsx            # React entry point
├── index.html           # HTML template
└── styles.css           # Styling
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/market | Current market state |
| GET | /api/market/history | Market history |
| POST | /api/trade | Place a trade |
| GET | /api/portfolio | User portfolio |
| GET | /api/bots | List all bots |
| POST | /api/bots/:id/toggle | Start/stop a bot |
| POST | /api/bots/:id/config | Update bot config |
| POST | /api/reset | Reset everything |

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19
- **Styling**: Plain CSS
- **Price Data**: Binance API
- **No database** - in-memory state

## v1 Archive

The original implementation is preserved in `v1-archive/` for reference.

### Key Issues Fixed in v2.0:
1. ❌ v1 had duplicate function definitions (syntax errors)
2. ❌ v1 used fake prices from `calculateYesPrice()`
3. ❌ v1 had broken API endpoints
4. ❌ v1 mixed everything in one 800+ line file
5. ❌ v1 bot portfolios weren't properly isolated

## License

MIT