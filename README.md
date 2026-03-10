# BTC Trading Simulator v2.0

A clean, real-time Bitcoin prediction market simulator with live price data from Binance.

## What's New in v2.0

**Complete rebuild from scratch** with lessons learned from v1:

- **Real BTC prices** from Binance API (no fake prices)
- **Clean architecture** with proper separation of concerns
- **Simulated 5-minute markets** that settle based on actual price movements
- **Isolated bot portfolios** - each bot has its own balance tracking
- **Real-time charts** with live price history
- **Modern Theme System** - Dark/light mode with CSS variables
- **Animation System** - Framer Motion powered UI
- **Portfolio Analytics** - P&L charts and performance metrics
- **Order Book** - Real-time order book visualization
- **Market Browser** - Filterable market discovery
- **PWA Support** - Installable app with offline support

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
- **One-click close all positions**
- **Position size calculator with risk %**
- **Take Profit / Stop Loss orders**

### Modern UI
- **Dark/Light/System theme** support
- **Glassmorphism effects** with backdrop-filter
- **Animated components** powered by Framer Motion
- **Real-time price tickers** with rolling animations
- **Loading skeletons** for all data sections

### Charts & Visualization
- **Custom Recharts integration** with YES/NO history
- **Order book** with bid/ask spread visualization
- **Depth chart** showing market depth
- **Volume profile** display
- **Real-time candlestick** updates
- **Animated chart** entry effects

### Market Browser
- Filter by asset (BTC, ETH, SOL, XRP)
- Filter by timeframe (5m, 15m, 1h, 4h, 1d)
- Filter by volume/liquidity
- Search markets by keyword
- Favorite/bookmark markets

### Portfolio Analytics
- **P&L chart** with multiple timeframes
- **Win/loss distribution** chart
- **Performance metrics:**
  - Sharpe ratio
  - Sortino ratio
  - Calmar ratio
  - Max drawdown with recovery time
- **Trade history** with export to CSV
- **Market sentiment** indicator (YES vs NO ratio)

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
│   ├── App.tsx          # React frontend
│   ├── market-browser.tsx      # Market discovery
│   ├── order-book.tsx          # Order book visualization
│   ├── portfolio-analytics.tsx # P&L and metrics
│   ├── trade-feed.tsx          # Recent trades
│   ├── countdown-timer.tsx     # Market countdown
│   ├── connection-status.tsx   # Connection indicator
│   └── ui/               # Reusable UI components
├── lib/
│   ├── price-service.ts # Binance price fetching
│   ├── market-engine.ts # Market logic
│   ├── bot-manager.ts   # Bot strategies
│   └── theme-context.tsx # Theme provider
├── hooks/
│   ├── useTradingData.ts
│   └── usePWA.ts        # PWA hooks
├── types.ts             # TypeScript types
├── server.ts            # Bun server + API routes
├── index.tsx            # React entry point
├── index.html           # HTML template
└── styles/
    └── globals.css      # Styling with CSS variables
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
| GET | /api/sse | Server-sent events for real-time updates |

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19
- **Styling**: Tailwind CSS v4 with CSS variables
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Price Data**: Binance API
- **No database** - in-memory state
- **PWA**: Service Worker, Web Manifest, offline support

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
