// Diagnostic script to test trading strategies
// Run with: bun run scripts/diagnose-strategies.ts

import type { StrategyContext, Strategy, StrategyType } from '../src/types';

// Define the strategies inline (copied from bot-manager.ts)
// This is a diagnostic tool to test the logic

const strategies: Record<string, Strategy> = {
  // WINDOW_DELTA
  window_delta: {
    name: "Window Delta",
    description: "BTC ár vs ablak nyitóár alapján - a legjobb 5m stratégia",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár adat" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl késő - utolsó 3mp" };
      }

      if (timeRemaining > 270000) {
        return { action: null, confidence: 0, reason: "Ablak eleje - várakozás" };
      }

      // ERŐS jel: delta > 0.12% (növelve)
      if (deltaPct > 0.12) {
        const conf = Math.min(0.92, 0.70 + (deltaPct - 0.12) * 3);
        return { action: "YES", confidence: conf, reason: `Erős UP delta: +${deltaPct.toFixed(3)}%` };
      }
      if (deltaPct < -0.12) {
        const conf = Math.min(0.92, 0.70 + (-deltaPct - 0.12) * 3);
        return { action: "NO", confidence: conf, reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}%` };
      }

      // KÖZEPES jel: delta > 0.07% (növelve)
      if (deltaPct > 0.07) {
        const conf = 0.55 + (deltaPct - 0.07) * 4;
        return { action: "YES", confidence: Math.min(0.78, conf), reason: `UP delta: +${deltaPct.toFixed(3)}%` };
      }
      if (deltaPct < -0.07) {
        const conf = 0.55 + (-deltaPct - 0.07) * 4;
        return { action: "NO", confidence: Math.min(0.78, conf), reason: `DOWN delta: ${deltaPct.toFixed(3)}%` };
      }

      return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(4)}%` };
    },
  },

  // ORACLE LAG
  binance_signal: {
    name: "Oracle Lag",
    description: "Binance valós idejű BTC ár előnye a Chainlink oracle felett",
    category: "momentum",
    execute: (ctx) => {
      const { binanceSignal, timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

      if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
        return { action: null, confidence: 0, reason: "Nincs Binance jel" };
      }

      const signalAge = Date.now() - binanceSignal.timestamp;
      if (signalAge > 8000) {
        return { action: null, confidence: 0, reason: `Jel lejárt: ${(signalAge / 1000).toFixed(1)}mp` };
      }

      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const signalAlignedWithDelta =
        (binanceSignal.type === "UP" && deltaPct > 0) ||
        (binanceSignal.type === "DOWN" && deltaPct < 0);

      const marketImplied = binanceSignal.type === "UP" ? marketPrice.yesPrice : marketPrice.noPrice;
      if (marketImplied > 0.82) {
        return { action: null, confidence: 0, reason: "Piac már beárazta" };
      }

      const action = binanceSignal.type === "UP" ? "YES" : "NO";
      let confidence = binanceSignal.confidence;

      if (signalAlignedWithDelta) {
        confidence = Math.min(0.95, confidence + 0.10);
      } else {
        confidence = confidence * 0.7;
      }

      if (Math.abs(binanceSignal.changePercent) > 0.05) {
        confidence = Math.min(0.95, confidence + 0.08);
      }

      if (confidence < 0.45) {
        return { action: null, confidence, reason: "Konfidencia túl alacsony" };
      }

      return { action, confidence, reason: `Oracle lag: BTC ${binanceSignal.type} ${binanceSignal.changePercent >= 0 ? "+" : ""}${binanceSignal.changePercent.toFixed(4)}%` };
    },
  },

  // T-10 SNIPER
  last_seconds_scalp: {
    name: "T-10 Sniper",
    description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice, binanceSignal } = ctx;

      if (timeRemaining > 30000 || timeRemaining < 4000) {
        return { action: null, confidence: 0, reason: "Nem a T-10 sniper ablakban" };
      }

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Minimális delta növelve: 0.06%
      const minDelta = 0.06;
      if (Math.abs(deltaPct) < minDelta) {
        return { action: null, confidence: 0, reason: `Delta ${deltaPct.toFixed(4)}% - túl kicsi` };
      }

      const action = deltaPct > 0 ? "YES" : "NO";
      const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
      const MAX_BUY_PRICE = 0.72; // Csökkentve 75-ről

      if (targetPrice > MAX_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `Ár túl magas: ${(targetPrice * 100).toFixed(0)}¢ > 72¢ max` };
      }

      let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

      if (binanceSignal && binanceSignal.type !== "NEUTRAL") {
        const signalAligned = (binanceSignal.type === "UP" && deltaPct > 0) || (binanceSignal.type === "DOWN" && deltaPct < 0);
        if (signalAligned) {
          confidence = Math.min(0.85, confidence + 0.10);
        }
      }

      return { action, confidence, reason: `T-10: ${action} @ ${(targetPrice * 100).toFixed(0)}¢ | delta ${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(3)}%` };
    },
  },

  // MONTE CARLO (simplified)
  monte_carlo: {
    name: "Monte Carlo",
    description: "BTC delta alapú valószínűségi becslés",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      if (timeRemaining < 30000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Nem aktív időszak (30mp-4p)" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Simple probability model
      const impliedP_UP = 0.5 + deltaPct * 3; // Each 0.1% delta = 30% probability shift
      const marketP_UP = marketPrice.yesPrice;

      const edge = Math.abs(impliedP_UP - marketP_UP);
      if (edge < 0.08) {
        return { action: null, confidence: 0, reason: `Edge túl kicsi: ${(edge * 100).toFixed(1)}%` };
      }

      const action = impliedP_UP > marketP_UP ? "YES" : "NO";
      const confidence = Math.min(0.80, 0.50 + edge);

      return { action, confidence, reason: `MC: P(UP)=${(impliedP_UP * 100).toFixed(0)}% vs piac ${(marketP_UP * 100).toFixed(0)}%` };
    },
  },

  // FAIR VALUE
  fair_value: {
    name: "Fair Value",
    description: "Kereskedés amikor az ár messze van a 'fair' értéktől",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a lezáráshoz" };
      }

      const total = marketPrice.yesPrice + marketPrice.noPrice;
      if (Math.abs(total - 1) > 0.05) {
        // Arbitrage opportunity
        const action = marketPrice.yesPrice < marketPrice.noPrice ? "YES" : "NO";
        const cheaper = Math.min(marketPrice.yesPrice, marketPrice.noPrice);
        return { action, confidence: 0.70, reason: `Arbitrage: YES+NO=${(total * 100).toFixed(0)}¢` };
      }

      // Fair value around 50%
      const deviation = marketPrice.yesPrice - 0.5;
      if (Math.abs(deviation) > 0.20) {
        // Price deviates more than 20% from 50%
        const action = deviation > 0 ? "NO" : "YES";
        return { action, confidence: 0.55, reason: `Fair value: ${(deviation > 0 ? "YES" : "NO")} túl drága` };
      }

      return { action: null, confidence: 0, reason: `Ár a fair tartományban` };
    },
  },
};

// Simulate various market conditions
function createMockContext(overrides: Partial<StrategyContext> = {}): StrategyContext {
  return {
    currentPrice: 0.55,
    startPrice: 0.50,
    priceHistory: [0.48, 0.49, 0.50, 0.51, 0.52, 0.53, 0.54, 0.55],
    timeRemaining: 120000, // 2 minutes remaining
    marketDuration: 300000, // 5 minutes total
    marketPrice: { yesPrice: 0.55, noPrice: 0.45 },
    volatility: 0.02,
    momentum: 0.03,
    btcPrice: 84500,
    btcPriceChange: 0.001, // 0.1% up
    btcWindowOpen: 84400, // BTC was at 84400 when window opened
    btcPriceHistory: [84400, 84420, 84450, 84480, 84500],
    ...overrides,
  };
}

console.log('\n=== STRATÉGIA DIAGNOSZTIKA ===\n');

// Test scenarios
const scenarios = [
  {
    name: "Erős UP delta (+0.15%)",
    context: createMockContext({
      btcPrice: 84550,
      btcWindowOpen: 84400,
      timeRemaining: 60000,
    }),
  },
  {
    name: "Erős DOWN delta (-0.15%)",
    context: createMockContext({
      btcPrice: 84270,
      btcWindowOpen: 84400,
      timeRemaining: 60000,
    }),
  },
  {
    name: "Gyenge delta (+0.03%)",
    context: createMockContext({
      btcPrice: 84425,
      btcWindowOpen: 84400,
      timeRemaining: 60000,
    }),
  },
  {
    name: "T-10 sniper ablak (utolsó 20mp)",
    context: createMockContext({
      btcPrice: 84550,
      btcWindowOpen: 84400,
      timeRemaining: 20000,
      marketPrice: { yesPrice: 0.68, noPrice: 0.32 },
    }),
  },
  {
    name: "T-10 sniper magas ár (NO túl drága)",
    context: createMockContext({
      btcPrice: 84270,
      btcWindowOpen: 84400,
      timeRemaining: 20000,
      marketPrice: { yesPrice: 0.30, noPrice: 0.78 }, // NO is 78 cents
    }),
  },
  {
    name: "Oracle Lag - Binance UP jel",
    context: createMockContext({
      binanceSignal: {
        type: "UP" as const,
        changePercent: 0.08,
        confidence: 0.75,
        timestamp: Date.now() - 2000, // 2 seconds ago
      },
      btcPrice: 84550,
      btcWindowOpen: 84400,
      marketPrice: { yesPrice: 0.62, noPrice: 0.38 },
    }),
  },
  {
    name: "Oracle Lag - lejárt jel (10mp)",
    context: createMockContext({
      binanceSignal: {
        type: "UP" as const,
        changePercent: 0.08,
        confidence: 0.75,
        timestamp: Date.now() - 10000, // 10 seconds ago - expired
      },
    }),
  },
  {
    name: "Window delta - ablak eleje (túl korai)",
    context: createMockContext({
      timeRemaining: 280000, // 4:40 remaining
    }),
  },
  {
    name: "Window delta - utolsó 3mp (túl késői)",
    context: createMockContext({
      timeRemaining: 2500,
    }),
  },
  {
    name: "Nincs BTC adat",
    context: createMockContext({
      btcPrice: undefined as any,
      btcWindowOpen: undefined,
    }),
  },
];

// Test each strategy with each scenario
const strategiesToTest = ['window_delta', 'binance_signal', 'last_seconds_scalp', 'monte_carlo', 'fair_value'];

for (const strategyKey of strategiesToTest) {
  const strategy = strategies[strategyKey as keyof typeof strategies];
  if (!strategy) {
    console.log(`❌ ${strategyKey}: NEM TALÁLHATÓ`);
    continue;
  }

  console.log(`\n━━━ ${strategy.name} (${strategyKey}) ━━━`);
  console.log(`Leírás: ${strategy.description}`);

  for (const scenario of scenarios) {
    try {
      const result = strategy.execute(scenario.context);
      const actionStr = result.action
        ? `✅ ${result.action} @ ${(result.confidence * 100).toFixed(0)}%`
        : `⛔ Nincs trade`;
      console.log(`  ${scenario.name}: ${actionStr}`);
      console.log(`    → ${result.reason}`);
    } catch (error: any) {
      console.log(`  ${scenario.name}: ❌ HIBA - ${error.message}`);
    }
  }
}

// Check for missing strategies
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Stratégia implementációk ellenőrzése:');

const allStrategyKeys = [
  'window_delta', 'last_seconds_scalp', 'binance_signal', 'monte_carlo',
  'fair_value', 'momentum', 'mean_reversion', 'trend', 'smart_trend',
  'contrarian', 'volatility', 'anomaly', 'momentum_burst', 'grid_trading',
  'market_making', 'arbitrage', 'random'
];

for (const key of allStrategyKeys) {
  const exists = key in strategies;
  const hasExecute = exists && typeof (strategies as any)[key]?.execute === 'function';
  console.log(`  ${key}: ${hasExecute ? '✅' : (exists ? '⚠️ nincs execute()' : '❌ hiányzik')}`);
}

console.log('\n=== DIAGNOSZTIKA BEFEJEZVE ===\n');