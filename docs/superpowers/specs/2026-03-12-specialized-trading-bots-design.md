# 6 Specialized Trading Bots Design

## Overview

Replace the current 15 generic strategies with 6 highly specialized bots, each with specific entry/exit rules, timing logic, and risk profiles.

## Bot Specifications

### BOT-01: Momentum Chaser

| Attribute | Value |
|-----------|-------|
| ID | `momentum_chaser` |
| Win Rate | 58–64% |
| Risk | Medium |
| Entry Timing | T−30s before window close |
| Signal Threshold | ±0.02% price delta from open |
| Max Token Price | 0.88 (avoid expensive tokens) |
| Bet Sizing | Flat $5–$10 per trade |

**Strategy Logic:**
1. At T−60s: Fetch Binance BTCUSDT 1m candle to get window open price
2. At T−30s: Get current BTC spot price from Binance
3. Compute delta = (current − open) / open × 100
4. If delta > +0.02% → BUY YES/UP token
5. If delta < −0.02% → BUY NO/DOWN token
6. If |delta| < 0.02% → SKIP (too uncertain)
7. Check token price: skip if target > 0.88 (too expensive)

**Category:** `momentum`

---

### BOT-02: Mean Reversion Sniper

| Attribute | Value |
|-----------|-------|
| ID | `mean_reversion_sniper` |
| Win Rate | 55–62% |
| Risk | Med-High |
| Trigger | Token price > 0.93 while BTC delta < 0.01% |
| Entry | Buy the cheaper token (fade the spike) |
| Exit | Hold until settlement |

**Strategy Logic:**
1. Monitor YES/NO token prices continuously
2. Detect when one token > 0.93
3. Check BTC price delta < 0.01% (no real underlying move)
4. Market is overreacting → fade the spike
5. Buy the opposite (cheaper) token

**Category:** `mean_reversion`

---

### BOT-03: Sum-to-One Arbitrage

| Attribute | Value |
|-----------|-------|
| ID | `sum_to_one_arb` |
| Win Rate | ~100% when opportunity exists |
| Risk | Low |
| Trigger | YES ask + NO ask < 0.98 |
| Profit | Guaranteed 2%+ edge |

**Strategy Logic:**
1. Monitor order book asks for both YES and NO tokens
2. Calculate sum of best asks
3. If sum < 0.98:
   - Buy both tokens simultaneously
   - Guaranteed profit at settlement (one pays $1)
4. Size positions to maximize edge

**Category:** `arbitrage`

---

### BOT-04: Whale Follower

| Attribute | Value |
|-----------|-------|
| ID | `whale_follower` |
| Win Rate | 56–63% |
| Risk | Medium |
| Min Trade Size | $200 |
| Source | WebSocket trade feed |
| Filter | High win-rate wallets only |

**Strategy Logic:**
1. Subscribe to Polymarket WebSocket trade feed
2. Filter for trades > $200
3. Track wallet win rates over time
4. Copy trades from wallets with >55% win rate
5. Follow within 2 seconds of whale trade

**Category:** `social`

---

### BOT-05: TA Signal Engine

| Attribute | Value |
|-----------|-------|
| ID | `ta_signal_engine` |
| Win Rate | 55–61% |
| Risk | Medium |
| Indicators | EMA9, EMA21, RSI(14) |
| Timeframe | 1-min candles |
| Source | Binance BTCUSDT |

**Strategy Logic:**
1. Fetch 20+ 1-min Binance BTCUSDT candles
2. Calculate EMA9 and EMA21 from close prices
3. Calculate RSI(14) from price changes
4. Bullish signal: EMA9 > EMA21 AND RSI < 70 (not overbought) → BUY YES
5. Bearish signal: EMA9 < EMA21 AND RSI > 30 (not oversold) → BUY NO
6. Skip if RSI in extreme zone (RSI > 80 or RSI < 20)

**Category:** `technical`

---

### BOT-06: Market Maker

| Attribute | Value |
|-----------|-------|
| ID | `market_maker` |
| Win Rate | N/A (spread income) |
| Risk | Low-Med |
| Spread Target | 2-3 cents |
| Cancel Timing | T−60s before settlement |

**Strategy Logic:**
1. Calculate mid-price from order book
2. Post bid slightly below mid (e.g., mid - 0.015)
3. Post ask slightly above mid (e.g., mid + 0.015)
4. Earn spread when both sides fill
5. Cancel all orders at T−60s to avoid settlement risk
6. Track filled positions for P&L

**Category:** `market_making`

---

## Implementation Changes

### 1. Update StrategyType in `src/types/index.ts`

```typescript
export type StrategyType =
  | "momentum_chaser"
  | "mean_reversion_sniper"
  | "sum_to_one_arb"
  | "whale_follower"
  | "ta_signal_engine"
  | "market_maker";
```

### 2. Update StrategyCategory in `src/types/index.ts`

```typescript
export type StrategyCategory =
  | "momentum"
  | "mean_reversion"
  | "arbitrage"
  | "social"
  | "technical"
  | "market_making";
```

### 3. Replace strategies in `src/lib/bot-manager.ts`

- Remove all 15 existing strategies
- Implement 6 new strategies with exact logic from specs
- Update default bot configs with new IDs and parameters

### 4. Update `src/lib/market-analyzer.ts`

- Update `STRATEGY_NAMES` with new strategy names
- Update `STRATEGY_PERFORMANCE_BY_PHASE` mappings

### 5. Update UI components

- `src/components/bot-management.tsx` - Display new bot info
- Update any hardcoded strategy references

---

## Technical Notes

### EMA Calculation

```typescript
function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [prices[0]];

  for (let i = 1; i < prices.length; i++) {
    ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
  }

  return ema;
}
```

### RSI Calculation

```typescript
function calculateRSI(prices: number[], period: number = 14): number {
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
```

### Order Book Sum-to-One Check

```typescript
function checkArbitrage(orderBook: OrderBook): { opportunity: boolean; edge: number } {
  const yesAsk = orderBook.yesAsks[0]?.price ?? 1;
  const noAsk = orderBook.noAsks[0]?.price ?? 1;
  const sum = yesAsk + noAsk;

  return {
    opportunity: sum < 0.98,
    edge: 1 - sum,
  };
}
```

---

## Risk Profiles

| Bot | Risk Level | Max Position | Stop Loss | Notes |
|-----|------------|--------------|-----------|-------|
| Momentum Chaser | Medium | $10 | N/A | Late entry reduces edge |
| Mean Reversion Sniper | Med-High | $5 | N/A | Fading strong moves |
| Sum-to-One Arb | Low | $20 | N/A | Guaranteed profit |
| Whale Follower | Medium | $15 | N/A | Dependent on whale accuracy |
| TA Signal Engine | Medium | $8 | N/A | Technical analysis |
| Market Maker | Low-Med | $10 | N/A | Spread capture |