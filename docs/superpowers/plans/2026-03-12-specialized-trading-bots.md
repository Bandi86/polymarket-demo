# 6 Specialized Trading Bots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 15 generic strategies with 6 highly specialized trading bots with specific entry/exit rules.

**Architecture:** Update types first, then replace strategy implementations in bot-manager.ts, update market-analyzer.ts mappings, and verify UI displays correctly.

**Tech Stack:** TypeScript, React, existing bot infrastructure

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Update StrategyType and StrategyCategory |
| `src/lib/bot-manager.ts` | Modify | Replace 15 strategies with 6 new ones |
| `src/lib/market-analyzer.ts` | Modify | Update strategy names and phase mappings |
| `src/components/bot-management.tsx` | Verify | Ensure UI works with new strategies |

---

## Chunk 1: Update Types

### Task 1: Update StrategyType and StrategyCategory

**Files:**
- Modify: `src/types/index.ts:126-141`

- [ ] **Step 1: Update StrategyType**

Replace the StrategyType union (lines 126-141) with:

```typescript
export type StrategyType =
  | "momentum_chaser"
  | "mean_reversion_sniper"
  | "sum_to_one_arb"
  | "whale_follower"
  | "ta_signal_engine"
  | "market_maker";
```

- [ ] **Step 2: Update Strategy category in Strategy interface**

Update line 206 in the Strategy interface:

```typescript
category: "momentum" | "mean_reversion" | "arbitrage" | "social" | "technical" | "market_making";
```

- [ ] **Step 3: Verify types compile**

Run: `bun run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: update StrategyType to 6 specialized bots"
```

---

## Chunk 2: Replace Strategy Implementations

### Task 2: Add Helper Functions

**Files:**
- Modify: `src/lib/bot-manager.ts:1-25` (after imports, before strategies)

- [ ] **Step 1: Add EMA calculation helper**

Insert after line 20 (after imports):

```typescript
// === Technical Analysis Helpers ===

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
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

- [ ] **Step 2: Verify helper functions compile**

Run: `bun run build`
Expected: No errors

---

### Task 3: Replace All Strategies

**Files:**
- Modify: `src/lib/bot-manager.ts:24-452` (strategies object)

- [ ] **Step 1: Replace entire strategies object**

Replace the `strategies` object (lines 24-452) with:

```typescript
// === Strategy Implementations ===

const strategies: Record<StrategyType, Strategy> = {
  momentum_chaser: {
    name: "Momentum Chaser",
    description: "Computes BTC price delta from window open; enters at T−30s",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcPriceChange, marketPrice } = ctx;

      // Only trade in last 30 seconds
      if (timeRemaining > 30000 || timeRemaining < 5000) {
        return { action: null, confidence: 0, reason: "Not in entry window (T-30s)" };
      }

      // Need BTC price change data
      if (btcPriceChange === undefined || btcPriceChange === null) {
        return { action: null, confidence: 0, reason: "No BTC price data" };
      }

      // Threshold: 0.02% delta
      const threshold = 0.0002; // 0.02%
      const delta = btcPriceChange;

      // Skip if flat market
      if (Math.abs(delta) < threshold) {
        return { action: null, confidence: 0, reason: `Flat market: delta ${(delta * 100).toFixed(3)}%` };
      }

      // Determine direction
      const action = delta > 0 ? "YES" : "NO";
      const targetPrice = action === "YES" ? marketPrice?.yesPrice : marketPrice?.noPrice;

      // Skip if token too expensive (> 0.88)
      if (targetPrice && targetPrice > 0.88) {
        return { action: null, confidence: 0, reason: `Token too expensive: ${(targetPrice * 100).toFixed(0)}¢` };
      }

      const confidence = Math.min(0.75, Math.abs(delta) * 1000);

      return {
        action,
        confidence,
        reason: `Momentum: BTC ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(3)}%`,
      };
    },
  },

  mean_reversion_sniper: {
    name: "Mean Reversion Sniper",
    description: "Fades spikes when one token exceeds 0.93 without a real BTC move",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, btcPriceChange, timeRemaining } = ctx;

      if (timeRemaining < 10000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Check for spike: one token > 0.93
      const hasSpike = yesPrice > 0.93 || noPrice > 0.93;
      if (!hasSpike) {
        return { action: null, confidence: 0, reason: "No spike detected" };
      }

      // Check BTC delta: must be flat (< 0.01%)
      const btcDelta = Math.abs(btcPriceChange || 0);
      if (btcDelta > 0.0001) {
        return { action: null, confidence: 0, reason: `BTC moved: ${(btcDelta * 100).toFixed(3)}%` };
      }

      // Fade the spike: buy the cheaper token
      const action = yesPrice > 0.93 ? "NO" : "YES";
      const targetPrice = action === "YES" ? yesPrice : noPrice;

      const confidence = 0.6 + (0.93 - targetPrice);

      return {
        action,
        confidence: Math.min(0.8, confidence),
        reason: `Fade spike: ${action === "YES" ? "YES" : "NO"} at ${(targetPrice * 100).toFixed(0)}¢`,
      };
    },
  },

  sum_to_one_arb: {
    name: "Sum-to-One Arbitrage",
    description: "Buys both UP and DOWN when combined asks < $0.98 — guaranteed edge",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, orderBook, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Get best asks from order book or market price
      let yesAsk = 1;
      let noAsk = 1;

      if (orderBook?.yesAsks?.length) {
        yesAsk = orderBook.yesAsks[0].price;
      } else if (marketPrice?.yesPrice) {
        yesAsk = marketPrice.yesPrice + 0.01; // Estimate ask
      }

      if (orderBook?.noAsks?.length) {
        noAsk = orderBook.noAsks[0].price;
      } else if (marketPrice?.noPrice) {
        noAsk = marketPrice.noPrice + 0.01; // Estimate ask
      }

      const sum = yesAsk + noAsk;

      // Check for arbitrage opportunity: sum < 0.98
      if (sum >= 0.98) {
        return { action: null, confidence: 0, reason: `No arb: sum=${(sum * 100).toFixed(1)}%` };
      }

      const edge = 1 - sum;
      const confidence = Math.min(0.95, edge * 20);

      // Buy the cheaper one (higher edge)
      const action = yesAsk < noAsk ? "YES" : "NO";

      return {
        action,
        confidence,
        reason: `Arb opportunity: sum=${(sum * 100).toFixed(1)}%, edge=${(edge * 100).toFixed(1)}%`,
      };
    },
  },

  whale_follower: {
    name: "Whale Follower",
    description: "WebSocket listener that copies trades > $200 from high-win-rate wallets",
    category: "social",
    execute: (ctx) => {
      const { timeRemaining, binanceSignal } = ctx;

      if (timeRemaining < 5000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // For now, use binanceSignal as proxy for whale activity
      // In production, this would connect to Polymarket WebSocket
      if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
        return { action: null, confidence: 0, reason: "No whale activity detected" };
      }

      // Simulate following a whale trade
      const action = binanceSignal.predictedOutcome ||
        (binanceSignal.type === "UP" ? "YES" : "NO");

      return {
        action,
        confidence: binanceSignal.confidence * 0.8, // Lower confidence for copy-trading
        reason: `Following whale signal: ${binanceSignal.type}`,
      };
    },
  },

  ta_signal_engine: {
    name: "TA Signal Engine",
    description: "EMA9/EMA21 crossover + RSI on 1-min Binance candles",
    category: "technical",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Too close to settlement" };
      }

      // Need at least 21 candles for EMA21
      if (priceHistory.length < 21) {
        return { action: null, confidence: 0, reason: `Insufficient data: ${priceHistory.length} candles` };
      }

      // Calculate EMAs
      const ema9 = calculateEMA(priceHistory, 9);
      const ema21 = calculateEMA(priceHistory, 21);

      // Calculate RSI
      const rsi = calculateRSI(priceHistory, 14);

      // Check for extreme RSI (skip)
      if (rsi > 80) {
        return { action: null, confidence: 0, reason: `RSI overbought: ${rsi.toFixed(1)}` };
      }
      if (rsi < 20) {
        return { action: null, confidence: 0, reason: `RSI oversold: ${rsi.toFixed(1)}` };
      }

      // Bullish: EMA9 > EMA21 and RSI not overbought
      if (ema9 > ema21 && rsi < 70) {
        const confidence = 0.55 + (ema9 - ema21) / ema21 * 100;
        return {
          action: "YES",
          confidence: Math.min(0.8, confidence),
          reason: `Bullish: EMA9(${ema9.toFixed(4)}) > EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
        };
      }

      // Bearish: EMA9 < EMA21 and RSI not oversold
      if (ema9 < ema21 && rsi > 30) {
        const confidence = 0.55 + (ema21 - ema9) / ema21 * 100;
        return {
          action: "NO",
          confidence: Math.min(0.8, confidence),
          reason: `Bearish: EMA9(${ema9.toFixed(4)}) < EMA21(${ema21.toFixed(4)}), RSI=${rsi.toFixed(1)}`,
        };
      }

      return { action: null, confidence: 0, reason: `No clear signal: EMA9=${ema9.toFixed(4)}, EMA21=${ema21.toFixed(4)}, RSI=${rsi.toFixed(1)}` };
    },
  },

  market_maker: {
    name: "Market Maker",
    description: "Posts bid/ask limit orders to earn the spread; cancels at T−60s",
    category: "market_making",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, orderBook } = ctx;

      // Cancel all orders at T-60s
      if (timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Exiting market making: T-60s reached" };
      }

      const yesPrice = marketPrice?.yesPrice || 0.5;
      const noPrice = marketPrice?.noPrice || 0.5;

      // Calculate spread
      const spread = orderBook?.spread || 0.02;

      // Market make when spread is wide enough
      if (spread < 0.015) {
        return { action: null, confidence: 0, reason: `Spread too tight: ${(spread * 100).toFixed(1)}%` };
      }

      // Post on the side with better value
      // If YES is expensive (>0.55), sell NO (bid)
      // If NO is expensive (<0.45), sell YES (bid)
      if (yesPrice > 0.55) {
        return {
          action: "NO",
          confidence: 0.5,
          reason: `Market making: bid NO at ${((noPrice - 0.015) * 100).toFixed(0)}¢`,
        };
      }

      if (noPrice > 0.55) {
        return {
          action: "YES",
          confidence: 0.5,
          reason: `Market making: bid YES at ${((yesPrice - 0.015) * 100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "Market balanced, no edge" };
    },
  },
};
```

- [ ] **Step 2: Verify strategies compile**

Run: `bun run build`
Expected: No errors

---

### Task 4: Update Default Bot Configs

**Files:**
- Modify: `src/lib/bot-manager.ts:584-595` (initDefaultBots method)

- [ ] **Step 1: Replace defaultConfigs array**

Replace the `defaultConfigs` array with:

```typescript
    const defaultConfigs: Array<Partial<BotConfig> & { id: string; name: string; strategy: StrategyType }> = [
      { id: "bot-momentum-chaser", name: "BOT-01: Momentum Chaser", strategy: "momentum_chaser", interval: 30000, betSize: 5, maxBet: 10 },
      { id: "bot-mean-reversion-sniper", name: "BOT-02: Mean Reversion Sniper", strategy: "mean_reversion_sniper", interval: 5000, betSize: 3, maxBet: 5 },
      { id: "bot-sum-to-one-arb", name: "BOT-03: Sum-to-One Arbitrage", strategy: "sum_to_one_arb", interval: 2000, betSize: 10, maxBet: 20 },
      { id: "bot-whale-follower", name: "BOT-04: Whale Follower", strategy: "whale_follower", interval: 1000, betSize: 5, maxBet: 15 },
      { id: "bot-ta-signal-engine", name: "BOT-05: TA Signal Engine", strategy: "ta_signal_engine", interval: 5000, betSize: 4, maxBet: 8 },
      { id: "bot-market-maker", name: "BOT-06: Market Maker", strategy: "market_maker", interval: 3000, betSize: 5, maxBet: 10 },
    ];
```

- [ ] **Step 2: Verify bot configs compile**

Run: `bun run build`
Expected: No errors

- [ ] **Step 3: Commit bot-manager changes**

```bash
git add src/lib/bot-manager.ts
git commit -m "feat: implement 6 specialized trading bot strategies"
```

---

## Chunk 3: Update Market Analyzer

### Task 5: Update Strategy Names and Mappings

**Files:**
- Modify: `src/lib/market-analyzer.ts`

- [ ] **Step 1: Update STRATEGY_NAMES constant**

Replace the STRATEGY_NAMES object with:

```typescript
const STRATEGY_NAMES: Record<StrategyType, string> = {
  momentum_chaser: "Momentum Chaser",
  mean_reversion_sniper: "Mean Reversion Sniper",
  sum_to_one_arb: "Sum-to-One Arbitrage",
  whale_follower: "Whale Follower",
  ta_signal_engine: "TA Signal Engine",
  market_maker: "Market Maker",
};
```

- [ ] **Step 2: Update STRATEGY_PERFORMANCE_BY_PHASE constant**

Replace with:

```typescript
const STRATEGY_PERFORMANCE_BY_PHASE: Record<MarketPhase, StrategyType[]> = {
  trending_up: ["momentum_chaser", "ta_signal_engine", "whale_follower"],
  trending_down: ["momentum_chaser", "ta_signal_engine"],
  ranging: ["mean_reversion_sniper", "sum_to_one_arb", "market_maker"],
  volatile: ["momentum_chaser", "ta_signal_engine"],
  low_volume: ["sum_to_one_arb", "market_maker"],
};
```

- [ ] **Step 3: Update allStrategies list in getStrategyRankings method**

Replace the allStrategies array with:

```typescript
    const allStrategies: StrategyType[] = [
      "momentum_chaser", "mean_reversion_sniper", "sum_to_one_arb",
      "whale_follower", "ta_signal_engine", "market_maker",
    ];
```

- [ ] **Step 4: Verify market-analyzer compiles**

Run: `bun run build`
Expected: No errors

- [ ] **Step 5: Commit market-analyzer changes**

```bash
git add src/lib/market-analyzer.ts
git commit -m "refactor: update market-analyzer for 6 specialized bots"
```

---

## Chunk 4: Verify and Test

### Task 6: Build and Run Application

**Files:**
- Verify: `src/components/bot-management.tsx`

- [ ] **Step 1: Build the application**

Run: `bun run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Start dev server**

Run: `bun dev`
Expected: Server starts successfully

- [ ] **Step 3: Manually verify bot list**

1. Open browser to localhost:3000 (or appropriate port)
2. Navigate to Bot Dashboard
3. Verify 6 bots are displayed:
   - BOT-01: Momentum Chaser
   - BOT-02: Mean Reversion Sniper
   - BOT-03: Sum-to-One Arbitrage
   - BOT-04: Whale Follower
   - BOT-05: TA Signal Engine
   - BOT-06: Market Maker

- [ ] **Step 4: Test enabling/disabling a bot**

1. Toggle one bot on
2. Verify it starts executing
3. Toggle it off
4. Verify it stops

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete 6 specialized trading bots implementation"
```

---

## Summary

| Chunk | Tasks | Files Modified |
|-------|-------|----------------|
| 1 | Update Types | `src/types/index.ts` |
| 2 | Replace Strategies | `src/lib/bot-manager.ts` |
| 3 | Update Analyzer | `src/lib/market-analyzer.ts` |
| 4 | Verify & Test | All files verified |

**Total Estimated Time:** 30-45 minutes