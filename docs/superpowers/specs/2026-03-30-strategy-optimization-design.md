# Strategy Optimization Design

## Problem Analysis

### Historical Performance (All Sessions)

| Strategy | Trades | Wins | Losses | Win Rate | Total PnL |
|----------|--------|------|--------|----------|-----------|
| Window Delta | 242 | 194 | 48 | 80% | +$90.68 |
| T-10 Sniper | 79 | 51 | 28 | 64% | +$64.20 |
| Random Bot | 204 | 104 | 100 | 51% | +$46.19 |
| Fair Value | 411 | 207 | 204 | 50% | +$43.41 |
| Contrarian | 100 | 56 | 44 | 56% | +$26.84 |
| Momentum | 412 | 245 | 167 | 59% | +$7.95 |
| Monte Carlo | 248 | 90 | 158 | 36% | **-$22.68** |

### Critical Finding: Odds Range Analysis

| Odds Range | Trades | Win Rate | Avg Win | Avg Loss | Total PnL |
|------------|--------|----------|---------|----------|-----------|
| 0-20¢ | 601 | 7% | $15.40 | -$0.80 | +$233.42 |
| 20-40¢ | 1007 | 22% | $1.75 | -$0.70 | -$160.92 |
| 40-60¢ | 3264 | 50% | $0.51 | -$0.56 | -$90.68 |
| 60-80¢ | 1380 | 73% | $0.38 | -$0.96 | +$22.42 |
| 80-100¢ | 509 | 72% | $0.12 | -$0.29 | +$0.03 |

**Key Insight:** The 40-60¢ "fair value" zone is a loss leader. Strategies trading here lose money overall due to:
- 50% win rate (coin flip)
- Fees erode the small edge
- Avg win ($0.51) barely covers avg loss ($0.56)

### Why March 20 Was "Successful"

The March 20 session had ONE lucky trade:
- Fair Value bought YES at **3.2¢ odds** ($1.58 stake)
- Market result was UP (won)
- PnL: +$47.65

This was a lottery ticket that paid off. The 44 winning trades in 0-20¢ range account for all profit (+$233).

---

## Proposed Changes

### 1. Odds-Aware Strategy Filters

**Why:** Strategies currently don't consider the odds at which they're entering.

**Implementation:**
- Add `minOdds` and `maxOdds` thresholds to each strategy
- Block trades outside profitable ranges
- Each strategy should have a "sweet spot" based on its win rate

**Configuration:**
```typescript
// High confidence strategies (Window Delta, T-10 Sniper)
// Trade at 60-80¢ where 73% win rate is expected
minOdds: 0.60,
maxOdds: 0.85,

// Contrarian strategies
// Buy cheap (0-20¢) when market overreacts
minOdds: 0.05,
maxOdds: 0.25,
```

### 2. Dynamic Bet Sizing Based on Odds

**Why:** Fixed $1 bets don't account for risk/reward at different odds.

**Implementation:**
- At low odds (0-20¢): Bet smaller, expect high variance
- At high odds (60-80¢): Bet larger, expect consistent wins
- Use Kelly criterion adjusted for odds

**Formula:**
```typescript
// Expected value = (winProb * payout) - (1-winProb) * stake
// At 70¢ odds, payout = 1/0.70 = 1.43x
// Kelly: f* = (p*b - q) / b
// Where b = (1-price)/price (net odds)
```

### 3. Tick Trend Analyzer (NEW)

**Why:** Research showed 60%+ tick consistency predicts direction.

**Implementation:**
```typescript
class TickTrendAnalyzer {
  private ticks: number[] = []; // Last 10 price ticks
  private pollInterval = 2000; // 2 seconds

  getTrend(): { direction: 'UP' | 'DOWN' | 'NEUTRAL'; consistency: number } {
    if (this.ticks.length < 5) return { direction: 'NEUTRAL', consistency: 0 };

    let upMoves = 0, downMoves = 0;
    for (let i = 1; i < this.ticks.length; i++) {
      if (this.ticks[i] > this.ticks[i-1]) upMoves++;
      else if (this.ticks[i] < this.ticks[i-1]) downMoves++;
    }

    const total = upMoves + downMoves;
    const consistency = Math.max(upMoves, downMoves) / total;

    return {
      direction: upMoves > downMoves ? 'UP' : 'DOWN',
      consistency: consistency > 0.6 ? consistency : 0
    };
  }
}
```

### 4. Order Book Imbalance (NEW)

**Why:** Bid/ask volume ratio predicts short-term price movement.

**Implementation:**
```typescript
// In market-engine.ts or new provider
interface OrderBookImbalance {
  bidVolume: number;  // Total bids
  askVolume: number;  // Total asks
  ratio: number;      // bidVolume / askVolume
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

// ratio > 1.5 = bullish (more buyers)
// ratio < 0.67 = bearish (more sellers)
```

### 5. Confidence Scoring Enhancement

**Why:** Current confidence doesn't account for all factors.

**7-Factor Confidence Model:**
```typescript
function calculateConfidence(ctx: StrategyContext): number {
  let score = 0;
  let factors = 0;

  // 1. Window Delta (weight: 5)
  if (Math.abs(ctx.btcDelta) > 0.10) score += 5;
  else if (Math.abs(ctx.btcDelta) > 0.05) score += 3;
  factors += 5;

  // 2. Binance Signal (weight: 4)
  if (ctx.binanceSignal && ctx.binanceSignal.type !== 'NEUTRAL') {
    score += 4 * ctx.binanceSignal.confidence;
  }
  factors += 4;

  // 3. Tick Trend (weight: 3)
  const trend = tickAnalyzer.getTrend();
  if (trend.consistency > 0.6) score += 3 * trend.consistency;
  factors += 3;

  // 4. Time Remaining (weight: 2)
  if (ctx.timeRemaining < 30000 && ctx.timeRemaining > 5000) score += 2;
  factors += 2;

  // 5. Odds Position (weight: 2)
  const odds = ctx.marketPrice.yesPrice;
  if (odds > 0.60 || odds < 0.40) score += 2; // Avoid middle
  factors += 2;

  // 6. Order Book (weight: 1)
  if (orderBookSignal !== 'NEUTRAL') score += 1;
  factors += 1;

  // 7. Volatility (weight: 1)
  if (ctx.volatility < 0.02) score += 1; // Prefer low volatility
  factors += 1;

  return score / factors; // Normalize to 0-1
}
```

### 6. Testing Framework

**Why:** Need systematic comparison of strategies over time.

**Implementation:**
```typescript
class StrategyTestRunner {
  // Run all bots for specified duration
  async runSession(durationMs: number): Promise<SessionResults>;

  // Compare strategies
  compareStrategies(): StrategyComparison[];

  // Export results to CSV/JSON
  exportResults(): void;
}

interface SessionResults {
  strategy: string;
  duration: number;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  avgOdds: number;
  oddsDistribution: Record<string, number>;
}
```

---

## Implementation Priority

### P1 - Critical (Do First)
1. **Odds Range Filters** - Block trades in 20-60¢ zone
2. **Dynamic Bet Sizing** - Adjust for odds

### P2 - Important
3. **Tick Trend Analyzer** - 2s polling
4. **Confidence Scoring** - 7-factor model

### P3 - Nice to Have
5. **Order Book Imbalance** - Requires Polymarket API enhancement
6. **Testing Framework** - For systematic comparison

---

## Expected Outcomes

With these changes:
1. **Fewer trades** but higher quality
2. **Higher win rate** for expensive trades (60-80¢)
3. **Lower variance** in PnL
4. **Better risk management** through odds-aware sizing

---

## Files to Modify

1. `src/lib/strategies/config.ts` - Add odds thresholds
2. `src/lib/strategies/base.ts` - Add odds validation helpers
3. `src/lib/bot-manager/strategy-executor.ts` - Implement confidence model
4. `src/lib/providers/tick-trend-provider.ts` - NEW file
5. `src/lib/market-engine.ts` - Add order book integration
6. `scripts/run-strategy-test.ts` - NEW testing script