# Polymarket Trading Demo

A real-time Bitcoin/crypto prediction market simulator with automated trading bots. Uses live price data from Binance and creates simulated 5-minute markets for UP/DOWN predictions.

## Features

### Real-Time Trading
- Live BTC/ETH/SOL/XRP prices from Binance
- 5-minute prediction markets (UP/DOWN)
- Manual trading with customizable amounts
- Real-time order book visualization
- Position tracking with P&L

### Automated Trading Bots
- 12+ built-in strategies
- Isolated portfolios per bot
- Kelly Criterion bet sizing
- Competition mode for strategy comparison
- Session history and performance tracking

### Live Trading Mode
- **Demo Mode**: Trade with simulated balance (default)
- **Live Mode**: Connect to Polymarket for real USDC trading
- MetaMask wallet integration
- Real-time live balance from Polymarket
- Warning system for live mode activation

### Modern UI
- Dark/Light theme support
- Real-time SSE updates
- Glassmorphism design
- Animated components with Framer Motion
- Responsive layout
- Demo/Live mode toggle with clear visual indicators

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:3000

## Screenshots

The dashboard features:
- **Top Dashboard**: Asset/timeframe selectors, quick run buttons, global stats
- **Monitor Tab**: Bot cards with running time, portfolio growth, recent trades
- **Competition Tab**: Leaderboard, strategy performance, export data
- **Manual Trade Tab**: Chart, order book, trading panel

## Bot Strategies

| Strategy | Description |
|----------|-------------|
| Random | Randomly buys YES or NO |
| Momentum | Follows price momentum direction |
| Mean Reversion | Bets against extreme prices |
| Trend | Follows established trends |
| Smart Trend | Enhanced trend with confirmations |
| Fair Value | Bets when price deviates from 0.5 |
| Window Delta | Compares BTC price change over time |
| Binance Signal | Uses Binance price movements |
| Last Seconds Scalp | Quick scalps in final seconds |

## Architecture

```
src/
├── components/           # React UI components
│   ├── App.tsx          # Main app
│   ├── TopDashboard.tsx # Header with controls
│   ├── BotStatusCard.tsx # Bot monitoring
│   ├── LiveMonitorTab.tsx # Bot dashboard
│   ├── CompetitionTab.tsx # Competition view
│   ├── SessionSummaryModal.tsx # Results modal
│   ├── TradingModeToggle.tsx # Demo/Live mode switch
│   ├── WalletButton.tsx # MetaMask wallet connection
│   ├── DepositModal.tsx # USDC deposit modal
│   ├── LivePositionsPanel.tsx # Live Polymarket positions
│   └── TradeHistoryPanel.tsx # Trade history from Polymarket
├── lib/                  # Core logic
│   ├── bot-manager.ts   # Bot strategies, trading mode, competition
│   ├── market-engine.ts # Market lifecycle
│   ├── risk-manager.ts  # Risk management
│   ├── database.ts      # SQLite persistence
│   └── providers/       # External data
│       └── polymarket-provider.ts # Polymarket CLOB API
├── hooks/
│   ├── useTradingData.ts # State management
│   └── useWallet.ts      # MetaMask wallet hook
├── types/
│   └── index.ts         # TypeScript types
└── server.ts            # Bun server + API
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market` | Current market state |
| GET | `/api/portfolio` | User portfolio |
| GET | `/api/bots` | List all bots |
| POST | `/api/bots/:id/toggle` | Start/stop bot |
| POST | `/api/bots/run-all` | Start all bots |
| POST | `/api/bots/stop-all` | Stop all bots |
| POST | `/api/trade` | Place manual trade |
| POST | `/api/reset` | Full system reset |
| GET | `/api/sse` | Real-time updates |
| GET | `/api/competition/status` | Competition state |
| POST | `/api/competition/start` | Start competition |
| POST | `/api/competition/stop` | Stop competition |
| POST | `/api/competition/clear` | Clear competition |
| GET | `/api/account` | Account info (mode, balance) |
| GET | `/api/account/balance` | Live Polymarket balance |
| POST | `/api/account/mode` | Switch demo/live mode |
| GET | `/api/orders/positions` | Live positions from Polymarket |
| GET | `/api/orders/trades` | Trade history from Polymarket |
| POST | `/api/orders/place` | Place order on Polymarket |
| POST | `/api/orders/cancel` | Cancel order on Polymarket |

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **Database**: SQLite
- **Real-time**: Server-Sent Events (SSE)
- **Price Data**: Binance API

## Testing

```bash
bun run test        # Run tests in watch mode
bun run test:run    # Run tests once
```

## Project Structure Details

### Key Files

- `src/lib/bot-manager.ts` - All bot logic, strategies, competition state
- `src/lib/market-engine.ts` - Market creation, position settlement
- `src/hooks/useTradingData.ts` - Frontend state, SSE handling
- `src/types/index.ts` - All TypeScript interfaces

### Data Persistence

SQLite database at `data/polymarket.db`:
- `bot_sessions` - Historical session performance
- `positions` - All trading positions
- `trades` - Trade execution history

## Development

```bash
# Development with hot reload
bun run dev

# Build for production
bun run build

# Run tests
bun run test:run
```

## Configuration

Bot configuration options:
- `betSize` - Base bet amount in USD
- `interval` - Trading interval in seconds
- `maxBet` - Maximum bet as percentage of bankroll
- `useKelly` - Enable Kelly Criterion sizing
- `kellyFraction` - Kelly fraction (0.1-1.0)

## License

MIT