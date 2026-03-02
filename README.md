# Polymarket Bitcoin Trading Simulator

A real-time Bitcoin prediction market trading simulator with live Polymarket data integration.

## Features

- **Real-time Bitcoin Prices** - Live price data from CoinGecko API
- **Polymarket Integration** - Connects to Polymarket's real-time data WebSocket and Gamma API
- **5-Minute Markets** - Simulates short-term prediction markets
- **Trading Bot Strategies** - Multiple bot strategies (Random, Momentum, Mean Reversion, Smart Trend)
- **Kelly Criterion** - Advanced bet sizing with Kelly criterion
- **2% Trading Fees** - Realistic fee simulation matching Polymarket
- **Live Charts** - Price history visualization with market sentiment bar
- **Session Tracking** - SQL-based trade history and session statistics

## Installation

```bash
bun install
```

## Development

```bash
bun run dev
```

## Production

```bash
bun run build
bun run start
```

## Data Sources

- **BTC Price**: CoinGecko API (fallback) + Polymarket WebSocket (primary)
- **Market Data**: Polymarket Gamma API
- **Real-time Updates**: Polymarket Real-Time Data Client (WebSocket)

## Usage

1. Open http://localhost:3000 in your browser
2. Click "🔗 Real Data" to use live Polymarket data
3. Place manual trades with YES/NO buttons
4. Start trading bots with different strategies
5. Monitor your portfolio and P&L

## Trading

- **Bet Amount**: Select your wager ($0.25 - $2+)
- **YES**: Bet that BTC will go UP
- **NO**: Bet that BTC will go DOWN
- **2% Fee**: Applied to all trades (entry and exit)

## Bot Strategies

| Strategy | Description |
|----------|-------------|
| Random | Random YES/NO selection |
| Momentum | Follows price direction |
| Mean Reversion | Bets on return to 50% |
| Smart Trend | Uses price history for trend detection |
| Contrarian | Opposite of momentum |

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19 + TypeScript
- **Styling**: CSS (custom)
- **Database**: SQLite (bun:sqlite)
- **APIs**: CoinGecko, Polymarket Gamma, Polymarket RTDS

## License

MIT
