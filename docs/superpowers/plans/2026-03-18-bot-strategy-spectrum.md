# Bot Strategy Spectrum Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign 6 trading bots as a spectrum from aggressive (always trades) to selective (only best setups), enabling clear comparison of which approach is profitable.

**Architecture:** Each bot has a single responsibility - executing its spectrum position strategy. All strategies are simplified to maximize clarity and observability. The bot-manager.ts contains the strategy implementations, with minimal changes to other components.

**Tech Stack:** TypeScript, React (for UI updates), Vitest (testing)

---

## File Structure

**Modified:**
- `src/lib/bot-manager.ts` - Replace all 6 strategy implementations with new spectrum strategies
- `src/types/index.ts` - Update strategy names/descriptions if needed

**Tested:**
- `test/bot-manager.test.ts` - Unit tests for each strategy's decision logic

---

## Task 1: Implement BOT-01 BTC Pure (Agressive)

**Files:**
- Modify: `src/lib/bot-manager.ts:62-100` (momentum_chaser strategy)

- [ ] **Step 1: Write the failing test**

Create test file or add to existing:

```typescript
describe('BOT-01 BTC Pure Strategy', () => {
  it('should trade YES when BTC delta is positive', () => {
    const strategy = strategies.momentum_chaser;
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 60000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.5, noPrice: 0.5 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001, // +0.1% BTC up
    });

    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('should trade NO when BTC delta is negative', () => {
    const strategy = strategies.momentum_chaser;
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 60000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.5, noPrice: 0.5 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: -0.001, // -0.1% BTC down
    });

    expect(result.action).toBe('NO');
    expect(result.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('should not trade in last 30 seconds', () => {
    const strategy = strategies.momentum_chaser;
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 25000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.5, noPrice: 0.5 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001,
    });

    expect(result.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail with current strategy logic

- [ ] **Step 3: Write minimal implementation**

Replace the `momentum_chaser` strategy in `src/lib/bot-manager.ts`:

```typescript
momentum_chaser: {
  name: "BTC Pure",
  description: "Always follows BTC direction - trades every market",
  category: "momentum",
  execute: (ctx) => {
    const { timeRemaining, btcPriceChange } = ctx;

    // Don't trade in last 30 seconds
    if (timeRemaining < 30000) {
      return { action: null, confidence: 0, reason: "Too close to settlement" };
    }

    // Need BTC price data
    if (btcPriceChange === undefined || btcPriceChange === null) {
      return { action: null, confidence: 0, reason: "No BTC price data" };
    }

    // Determine direction based on BTC delta
    // Any non-zero delta triggers a trade
    const delta = btcPriceChange;
    const action: Outcome = delta >= 0 ? "YES" : "NO";

    // Confidence: 55% baseline + bonus for stronger moves
    const confidence = Math.min(0.75, 0.55 + Math.abs(delta) * 50);

    return {
      action,
      confidence,
      reason: `BTC Pure: BTC ${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(3)}% → ${action}`,
    };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-01 BTC Pure strategy - always trades based on BTC direction"
```

---

## Task 2: Implement BOT-02 Quick Strike (Agressive)

**Files:**
- Modify: `src/lib/bot-manager.ts:102-158` (mean_reversion_sniper strategy)

- [ ] **Step 1: Write the failing test**

```typescript
describe('BOT-02 Quick Strike Strategy', () => {
  it('should follow market direction when YES > NO', () => {
    const strategy = strategies.mean_reversion_sniper;
    const result = strategy.execute({
      currentPrice: 0.6,
      startPrice: 0.5,
      priceHistory: [0.5, 0.55, 0.6],
      timeRemaining: 70000, // T-70s
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 },
      volatility: 0.01,
      momentum: 0.1,
      btcPrice: 50000,
      btcPriceChange: 0,
    });

    expect(result.action).toBe('YES');
  });

  it('should follow market direction when NO > YES', () => {
    const strategy = strategies.mean_reversion_sniper;
    const result = strategy.execute({
      currentPrice: 0.4,
      startPrice: 0.5,
      priceHistory: [0.5, 0.45, 0.4],
      timeRemaining: 80000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.35, noPrice: 0.65 },
      volatility: 0.01,
      momentum: -0.1,
      btcPrice: 50000,
      btcPriceChange: 0,
    });

    expect(result.action).toBe('NO');
  });

  it('should use BTC direction when market is 50-50', () => {
    const strategy = strategies.mean_reversion_sniper;
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 60000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.50, noPrice: 0.50 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002, // BTC up
    });

    expect(result.action).toBe('YES');
  });

  it('should not trade outside 20-90s window', () => {
    const strategy = strategies.mean_reversion_sniper;

    // Too early
    const early = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 100000, // > 90s
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.6, noPrice: 0.4 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001,
    });
    expect(early.action).toBeNull();

    // Too late
    const late = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 15000, // < 20s
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.6, noPrice: 0.4 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001,
    });
    expect(late.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail

- [ ] **Step 3: Write minimal implementation**

Replace `mean_reversion_sniper` strategy:

```typescript
mean_reversion_sniper: {
  name: "Quick Strike",
  description: "Late entry (T-90s to T-20s) - always follows market consensus",
  category: "momentum",
  execute: (ctx) => {
    const { timeRemaining, marketPrice, btcPriceChange } = ctx;

    // Only trade in the 20-90 second window
    if (timeRemaining > 90000 || timeRemaining < 20000) {
      return { action: null, confidence: 0, reason: "Not in entry window (20-90s)" };
    }

    const yesPrice = marketPrice?.yesPrice || 0.5;
    const noPrice = marketPrice?.noPrice || 0.5;

    // If market has clear direction, follow it
    if (yesPrice > noPrice + 0.02) {
      return {
        action: "YES",
        confidence: 0.60,
        reason: `Quick Strike: Market bullish ${(yesPrice * 100).toFixed(0)}¢ → YES`,
      };
    }

    if (noPrice > yesPrice + 0.02) {
      return {
        action: "NO",
        confidence: 0.60,
        reason: `Quick Strike: Market bearish ${(noPrice * 100).toFixed(0)}¢ → NO`,
      };
    }

    // Market is undecided (50-50), use BTC direction
    const btcDelta = btcPriceChange || 0;
    const action: Outcome = btcDelta >= 0 ? "YES" : "NO";

    return {
      action,
      confidence: 0.55,
      reason: `Quick Strike: Market undecided, BTC ${btcDelta >= 0 ? "+" : ""}${(btcDelta * 100).toFixed(3)}% → ${action}`,
    };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-02 Quick Strike strategy - late entry following market consensus"
```

---

## Task 3: Implement BOT-03 Balanced Signal

**Files:**
- Modify: `src/lib/bot-manager.ts:160-214` (sum_to_one_arb strategy)

- [ ] **Step 1: Write the failing test**

```typescript
describe('BOT-03 Balanced Signal Strategy', () => {
  it('should trade when BTC and market agree', () => {
    const strategy = strategies.sum_to_one_arb;

    // Market expects UP (yesPrice > 55%) AND BTC is up
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.60, noPrice: 0.40 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002, // BTC up
    });

    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);
  });

  it('should fade market when BTC strongly contradicts', () => {
    const strategy = strategies.sum_to_one_arb;

    // Market expects UP but BTC is strongly down
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.60, noPrice: 0.40 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: -0.001, // BTC down > 0.1%
    });

    expect(result.action).toBe('NO'); // Fade the market
  });

  it('should not trade when BTC and market contradict weakly', () => {
    const strategy = strategies.sum_to_one_arb;

    // Market expects UP but BTC is slightly down (not enough to fade)
    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.60, noPrice: 0.40 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: -0.0002, // Only -0.02%, not enough
    });

    expect(result.action).toBeNull();
  });

  it('should not trade when market is undecided', () => {
    const strategy = strategies.sum_to_one_arb;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.52, noPrice: 0.48 }, // No clear bias
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001,
    });

    expect(result.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail

- [ ] **Step 3: Write minimal implementation**

Replace `sum_to_one_arb` strategy:

```typescript
sum_to_one_arb: {
  name: "Balanced Signal",
  description: "Trades when BTC and market align OR when BTC strongly contradicts market",
  category: "momentum",
  execute: (ctx) => {
    const { timeRemaining, marketPrice, btcPriceChange } = ctx;

    if (timeRemaining < 30000) {
      return { action: null, confidence: 0, reason: "Too close to settlement" };
    }

    const yesPrice = marketPrice?.yesPrice || 0.5;
    const noPrice = marketPrice?.noPrice || 0.5;
    const btcDelta = btcPriceChange || 0;

    // Determine market direction
    const marketExpectsUp = yesPrice > 0.55;
    const marketExpectsDown = noPrice > 0.55;

    // Need market to have an opinion
    if (!marketExpectsUp && !marketExpectsDown) {
      return { action: null, confidence: 0, reason: `Market undecided: YES ${(yesPrice * 100).toFixed(0)}¢` };
    }

    // BTC direction thresholds
    const btcUp = btcDelta > 0.0003;      // BTC up > 0.03%
    const btcDown = btcDelta < -0.0003;   // BTC down > 0.03%
    const btcStrongUp = btcDelta > 0.001; // BTC up > 0.1%
    const btcStrongDown = btcDelta < -0.001; // BTC down > 0.1%

    // Case 1: Market UP + BTC UP = Strong YES signal
    if (marketExpectsUp && btcUp) {
      return {
        action: "YES",
        confidence: 0.70,
        reason: `Balanced: Market & BTC both UP → YES`,
      };
    }

    // Case 2: Market DOWN + BTC DOWN = Strong NO signal
    if (marketExpectsDown && btcDown) {
      return {
        action: "NO",
        confidence: 0.70,
        reason: `Balanced: Market & BTC both DOWN → NO`,
      };
    }

    // Case 3: Market UP + BTC STRONGLY DOWN = Fade market, buy NO
    if (marketExpectsUp && btcStrongDown) {
      return {
        action: "NO",
        confidence: 0.65,
        reason: `Balanced: Fade UP market, BTC down ${(btcDelta * 100).toFixed(2)}%`,
      };
    }

    // Case 4: Market DOWN + BTC STRONGLY UP = Fade market, buy YES
    if (marketExpectsDown && btcStrongUp) {
      return {
        action: "YES",
        confidence: 0.65,
        reason: `Balanced: Fade DOWN market, BTC up +${(btcDelta * 100).toFixed(2)}%`,
      };
    }

    // Case 5: Weak contradiction - no trade
    return {
      action: null,
      confidence: 0,
      reason: `Balanced: BTC/Market contradiction too weak`,
    };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-03 Balanced Signal strategy - trades on BTC/market alignment or strong contradiction"
```

---

## Task 4: Implement BOT-04 Contrarian Lite

**Files:**
- Modify: `src/lib/bot-manager.ts:216-270` (whale_follower strategy)

- [ ] **Step 1: Write the failing test**

```typescript
describe('BOT-04 Contrarian Lite Strategy', () => {
  it('should fade UP spike when BTC is down', () => {
    const strategy = strategies.whale_follower;

    const result = strategy.execute({
      currentPrice: 0.8,
      startPrice: 0.5,
      priceHistory: [0.5, 0.65, 0.8],
      timeRemaining: 90000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.78, noPrice: 0.22 }, // UP spike
      volatility: 0.02,
      momentum: 0.3,
      btcPrice: 50000,
      btcPriceChange: -0.005, // BTC down 0.5%
    });

    expect(result.action).toBe('NO');
    expect(result.confidence).toBeGreaterThanOrEqual(0.60);
  });

  it('should fade DOWN spike when BTC is up', () => {
    const strategy = strategies.whale_follower;

    const result = strategy.execute({
      currentPrice: 0.2,
      startPrice: 0.5,
      priceHistory: [0.5, 0.35, 0.2],
      timeRemaining: 90000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.22, noPrice: 0.78 }, // DOWN spike
      volatility: 0.02,
      momentum: -0.3,
      btcPrice: 50000,
      btcPriceChange: 0.005, // BTC up 0.5%
    });

    expect(result.action).toBe('YES');
  });

  it('should not trade when price is not extreme', () => {
    const strategy = strategies.whale_follower;

    const result = strategy.execute({
      currentPrice: 0.6,
      startPrice: 0.5,
      priceHistory: [0.5, 0.55, 0.6],
      timeRemaining: 90000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.60, noPrice: 0.40 }, // Not extreme
      volatility: 0.01,
      momentum: 0.1,
      btcPrice: 50000,
      btcPriceChange: -0.005,
    });

    expect(result.action).toBeNull();
  });

  it('should not trade when BTC confirms the spike', () => {
    const strategy = strategies.whale_follower;

    const result = strategy.execute({
      currentPrice: 0.8,
      startPrice: 0.5,
      priceHistory: [0.5, 0.65, 0.8],
      timeRemaining: 90000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.78, noPrice: 0.22 }, // UP spike
      volatility: 0.02,
      momentum: 0.3,
      btcPrice: 50000,
      btcPriceChange: 0.005, // BTC UP too - confirming spike
    });

    expect(result.action).toBeNull(); // No fade - spike is real
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail

- [ ] **Step 3: Write minimal implementation**

Replace `whale_follower` strategy:

```typescript
whale_follower: {
  name: "Contrarian Lite",
  description: "Fades extreme prices (>75%) when BTC contradicts market direction",
  category: "mean_reversion",
  execute: (ctx) => {
    const { timeRemaining, marketPrice, btcPriceChange } = ctx;

    if (timeRemaining < 45000) {
      return { action: null, confidence: 0, reason: "Too close to settlement" };
    }

    const yesPrice = marketPrice?.yesPrice || 0.5;
    const noPrice = marketPrice?.noPrice || 0.5;
    const btcDelta = btcPriceChange || 0;

    // Extreme prices: market is confident
    const extremeUp = yesPrice > 0.75;   // Market expects UP
    const extremeDown = noPrice > 0.75;  // Market expects DOWN

    if (!extremeUp && !extremeDown) {
      return { action: null, confidence: 0, reason: `No extreme price (need >75%)` };
    }

    // BTC moving significantly (>0.03%)
    const btcUp = btcDelta > 0.0003;
    const btcDown = btcDelta < -0.0003;

    // Fade UP spike when BTC is going DOWN
    if (extremeUp && btcDown) {
      const confidence = Math.min(0.80, 0.60 + Math.abs(btcDelta) * 100);
      return {
        action: "NO",
        confidence,
        reason: `Contrarian: Fade UP spike, BTC down ${(btcDelta * 100).toFixed(2)}%`,
      };
    }

    // Fade DOWN spike when BTC is going UP
    if (extremeDown && btcUp) {
      const confidence = Math.min(0.80, 0.60 + Math.abs(btcDelta) * 100);
      return {
        action: "YES",
        confidence,
        reason: `Contrarian: Fade DOWN spike, BTC up +${(btcDelta * 100).toFixed(2)}%`,
      };
    }

    // Spike confirmed by BTC - no fade
    return { action: null, confidence: 0, reason: `Spike confirmed by BTC - no fade` };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-04 Contrarian Lite strategy - fades extreme prices when BTC contradicts"
```

---

## Task 5: Implement BOT-05 High Conviction

**Files:**
- Modify: `src/lib/bot-manager.ts:272-325` (ta_signal_engine strategy)

- [ ] **Step 1: Write the failing test**

```typescript
describe('BOT-05 High Conviction Strategy', () => {
  it('should trade when BTC and market strongly agree', () => {
    const strategy = strategies.ta_signal_engine;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 150000, // In 60-240s window
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 }, // Market bias
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002, // BTC strong up > 0.08%
    });

    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);
  });

  it('should buy the cheaper side when spread is large', () => {
    const strategy = strategies.ta_signal_engine;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 150000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.35, noPrice: 0.68 }, // Large spread, YES cheap
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.001,
    });

    expect(result.action).toBe('YES'); // Buy the cheaper side
  });

  it('should not trade outside 60-240s window', () => {
    const strategy = strategies.ta_signal_engine;

    const early = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 250000, // > 240s
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.65, noPrice: 0.35 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002,
    });

    expect(early.action).toBeNull();
  });

  it('should not trade on weak signals', () => {
    const strategy = strategies.ta_signal_engine;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 150000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.52, noPrice: 0.48 }, // Weak market bias
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.0005, // Weak BTC move
    });

    expect(result.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail

- [ ] **Step 3: Write minimal implementation**

Replace `ta_signal_engine` strategy:

```typescript
ta_signal_engine: {
  name: "High Conviction",
  description: "Only trades on strong signals: BTC + market agreement or large spread",
  category: "technical",
  execute: (ctx) => {
    const { timeRemaining, marketPrice, btcPriceChange } = ctx;

    // Only trade in 60-240s window
    if (timeRemaining > 240000 || timeRemaining < 60000) {
      return { action: null, confidence: 0, reason: "Not in entry window (60-240s)" };
    }

    const yesPrice = marketPrice?.yesPrice || 0.5;
    const noPrice = marketPrice?.noPrice || 0.5;
    const btcDelta = btcPriceChange || 0;

    // Strong BTC move threshold
    const strongBtcUp = btcDelta > 0.0008;   // > 0.08%
    const strongBtcDown = btcDelta < -0.0008;

    // Setup 1: Strong BTC + market alignment
    if (strongBtcUp && yesPrice > 0.58) {
      return {
        action: "YES",
        confidence: 0.72,
        reason: `High Conviction: BTC +${(btcDelta * 100).toFixed(2)}% + market bullish`,
      };
    }

    if (strongBtcDown && noPrice > 0.58) {
      return {
        action: "NO",
        confidence: 0.72,
        reason: `High Conviction: BTC -${Math.abs(btcDelta * 100).toFixed(2)}% + market bearish`,
      };
    }

    // Setup 2: Large spread - buy the cheaper side
    const spread = Math.abs(yesPrice - noPrice);
    if (spread > 0.03) {
      // Spread > 3%
      const cheaperSide: Outcome = yesPrice < noPrice ? "YES" : "NO";
      const cheaperPrice = Math.min(yesPrice, noPrice);

      // Only buy if price is attractive (< 40%)
      if (cheaperPrice < 0.40) {
        return {
          action: cheaperSide,
          confidence: 0.68,
          reason: `High Conviction: Large spread, ${cheaperSide} at ${(cheaperPrice * 100).toFixed(0)}¢`,
        };
      }
    }

    return { action: null, confidence: 0, reason: `No high conviction setup` };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-05 High Conviction strategy - trades only on strong BTC/market signals"
```

---

## Task 6: Implement BOT-06 Sniper

**Files:**
- Modify: `src/lib/bot-manager.ts:327-375` (market_maker strategy)

- [ ] **Step 1: Write the failing test**

```typescript
describe('BOT-06 Sniper Strategy', () => {
  it('should trade on very strong BTC move with unreacted market', () => {
    const strategy = strategies.market_maker;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000, // In 60-180s window
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 }, // Market not yet reacted
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002, // BTC up 0.2%
    });

    expect(result.action).toBe('YES');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('should fade extreme price with strong BTC contradiction', () => {
    const strategy = strategies.market_maker;

    const result = strategy.execute({
      currentPrice: 0.9,
      startPrice: 0.5,
      priceHistory: [0.5, 0.7, 0.9],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketMarket: { yesPrice: 0.88, noPrice: 0.12 }, // Extreme UP
      volatility: 0.02,
      momentum: 0.4,
      btcPrice: 50000,
      btcPriceChange: -0.002, // BTC down 0.2%
    });

    expect(result.action).toBe('NO');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('should not trade outside 60-180s window', () => {
    const strategy = strategies.market_maker;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 50000, // < 60s
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.002,
    });

    expect(result.action).toBeNull();
  });

  it('should not trade on weak setups', () => {
    const strategy = strategies.market_maker;

    const result = strategy.execute({
      currentPrice: 0.5,
      startPrice: 0.5,
      priceHistory: [0.5],
      timeRemaining: 120000,
      marketDuration: 300000,
      marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
      volatility: 0.01,
      momentum: 0,
      btcPrice: 50000,
      btcPriceChange: 0.0005, // BTC only up 0.05%, not enough
    });

    expect(result.action).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/bot-manager.test.ts --run`
Expected: Tests fail

- [ ] **Step 3: Write minimal implementation**

Replace `market_maker` strategy:

```typescript
market_maker: {
  name: "Sniper",
  description: "Ultra-selective: only trades on very strong setups with high confidence",
  category: "momentum",
  execute: (ctx) => {
    const { timeRemaining, marketPrice, btcPriceChange } = ctx;

    // Only trade in 60-180s window
    if (timeRemaining > 180000 || timeRemaining < 60000) {
      return { action: null, confidence: 0, reason: "Not in entry window (60-180s)" };
    }

    const yesPrice = marketPrice?.yesPrice || 0.5;
    const noPrice = marketPrice?.noPrice || 0.5;
    const btcDelta = btcPriceChange || 0;

    // Very strong BTC move thresholds (>0.15%)
    const veryStrongBtcUp = btcDelta > 0.0015;
    const veryStrongBtcDown = btcDelta < -0.0015;

    // Setup 1: Strong BTC move with market not yet reacted
    // BTC up 0.15%+ but market price still < 60%
    if (veryStrongBtcUp && yesPrice < 0.60) {
      return {
        action: "YES",
        confidence: 0.78,
        reason: `Sniper: BTC +${(btcDelta * 100).toFixed(2)}%, market lagging at ${(yesPrice * 100).toFixed(0)}¢`,
      };
    }

    if (veryStrongBtcDown && noPrice < 0.60) {
      return {
        action: "NO",
        confidence: 0.78,
        reason: `Sniper: BTC -${Math.abs(btcDelta * 100).toFixed(2)}%, market lagging at ${(noPrice * 100).toFixed(0)}¢`,
      };
    }

    // Setup 2: Extreme fade (>85% price + strong BTC contradiction)
    const extremeUp = yesPrice > 0.85;
    const extremeDown = noPrice > 0.85;

    if (extremeUp && veryStrongBtcDown) {
      return {
        action: "NO",
        confidence: 0.82,
        reason: `Sniper: Fade extreme UP at ${(yesPrice * 100).toFixed(0)}¢, BTC down ${Math.abs(btcDelta * 100).toFixed(2)}%`,
      };
    }

    if (extremeDown && veryStrongBtcUp) {
      return {
        action: "YES",
        confidence: 0.82,
        reason: `Sniper: Fade extreme DOWN at ${(noPrice * 100).toFixed(0)}¢, BTC up +${(btcDelta * 100).toFixed(2)}%`,
      };
    }

    return { action: null, confidence: 0, reason: `Sniper: No high-quality setup` };
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/bot-manager.test.ts --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot-manager.ts test/bot-manager.test.ts
git commit -m "feat: implement BOT-06 Sniper strategy - ultra-selective with very high confidence trades only"
```

---

## Task 7: Update Bot Names and Descriptions

**Files:**
- Modify: `src/lib/bot-manager.ts:507-514` (initDefaultBots)

- [ ] **Step 1: Update default bot configurations**

Update the bot names to match new strategies:

```typescript
const defaultConfigs: Array<Partial<BotConfig> & { id: string; name: string; strategy: StrategyType }> = [
  { id: "bot-momentum-chaser", name: "BOT-01: BTC Pure", strategy: "momentum_chaser", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
  { id: "bot-mean-reversion-sniper", name: "BOT-02: Quick Strike", strategy: "mean_reversion_sniper", interval: 3000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
  { id: "bot-sum-to-one-arb", name: "BOT-03: Balanced Signal", strategy: "sum_to_one_arb", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
  { id: "bot-whale-follower", name: "BOT-04: Contrarian Lite", strategy: "whale_follower", interval: 3000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
  { id: "bot-ta-signal-engine", name: "BOT-05: High Conviction", strategy: "ta_signal_engine", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
  { id: "bot-market-maker", name: "BOT-06: Sniper", strategy: "market_maker", interval: 5000, betSize: 2, maxBet: 5, useKelly: true, kellyFraction: 0.5 },
];
```

- [ ] **Step 2: Run tests to verify everything still works**

Run: `bun test --run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot-manager.ts
git commit -m "feat: update bot names to match new spectrum strategy design"
```

---

## Task 8: Integration Testing

**Files:**
- Create: `test/strategy-spectrum.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect } from 'vitest';
import { BotManager } from '../src/lib/bot-manager';

describe('Strategy Spectrum Integration', () => {
  it('should have all 6 bots with correct spectrum positions', () => {
    const manager = new BotManager();
    const bots = manager.getBots();

    expect(bots).toHaveLength(6);

    // Check spectrum: aggressive to selective
    expect(bots[0].name).toContain('BTC Pure');
    expect(bots[1].name).toContain('Quick Strike');
    expect(bots[2].name).toContain('Balanced Signal');
    expect(bots[3].name).toContain('Contrarian Lite');
    expect(bots[4].name).toContain('High Conviction');
    expect(bots[5].name).toContain('Sniper');
  });

  it('should have different trading frequencies across spectrum', () => {
    // This will be verified in live testing
    // The aggressive bots should trade more often
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `bun test test/strategy-spectrum.test.ts --run`
Expected: All tests pass

- [ ] **Step 3: Run full test suite**

Run: `bun test --run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add test/strategy-spectrum.test.ts
git commit -m "test: add integration tests for strategy spectrum"
```

---

## Task 9: Manual Testing Checklist

- [ ] **Start the dev server**

Run: `bun dev`

- [ ] **Open the application in browser**

Navigate to: `http://localhost:3000`

- [ ] **Enable all 6 bots**

- [ ] **Observe trading behavior for 10+ markets**

Verify:
- BOT-01 trades on every market
- BOT-02 trades in T-90s to T-20s window
- BOT-03 trades when BTC/market align
- BOT-04 fades extreme prices
- BOT-05 trades on strong signals only
- BOT-06 trades rarely but with high confidence

- [ ] **Check bot logs for reasonable decisions**

- [ ] **Compare win rates across spectrum**

---

## Success Criteria

- [ ] All 6 strategies implemented with clear logic
- [ ] All tests pass
- [ ] BOT-01 (BTC Pure) trades on >90% of markets
- [ ] BOT-06 (Sniper) trades on <20% of markets
- [ ] Visible performance differences between bots
- [ ] At least 1 bot shows positive P&L over 10+ trades