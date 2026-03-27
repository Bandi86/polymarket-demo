// Strategy Implementations
// Improved strategies based on research: Window Delta, Oracle Lag, Monte Carlo
// Key insight: BTC price relative to window open is the best predictor, not YES/NO price history

import type { Strategy, StrategyType, StrategyContext, Outcome } from "../../types";

// Debug mode - set to true to enable verbose logging
const DEBUG_STRATEGIES = true;

export function debugLog(strategy: string, message: string, data?: Record<string, unknown>) {
  if (DEBUG_STRATEGIES) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][${strategy}] ${message}`, data ? JSON.stringify(data) : '');
  }
}

// ──────────────────────────────────────────────────────────
// #1 WINDOW_DELTA - Legfontosabb stratégia
// Az ablakon belüli BTC elmozdulás alapján kereskedik
// Bizonyítottan a legjobb megközelítés 5-perces piacokon
// ──────────────────────────────────────────────────────────
export const windowDeltaStrategy: Strategy = {
  name: "Window Delta",
  description: "BTC ár vs ablak nyitóár alapján - a legjobb 5m stratégia",
  category: "momentum",
  execute: (ctx: StrategyContext) => {
    const { timeRemaining, btcPrice, btcWindowOpen } = ctx;

    // Ne kereskedj ha nincs BTC adat
    if (!btcPrice) {
      debugLog('WindowDelta', '❌ Nincs BTC ár');
      return { action: null, confidence: 0, reason: "Nincs BTC ár adat" };
    }

    // Calculate delta from window open
    const windowOpen = btcWindowOpen || btcPrice;
    const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

    // Debug: log key values
    debugLog('WindowDelta', 'BTC ár vs window', {
      btcPrice,
      windowOpen,
      deltaPct: deltaPct.toFixed(4) + '%',
      timeRemaining: Math.floor(timeRemaining / 1000) + 's'
    });

    // Ne kereskedj az utolsó 3 másodpercben (túl késő)
    if (timeRemaining < 3000) {
      return { action: null, confidence: 0, reason: "Túl késő - utolsó 3mp" };
    }

    // Ne kereskedj az első 30 másodpercben (még nincs elég adat)
    if (timeRemaining > 270000) {
      return { action: null, confidence: 0, reason: "Ablak eleje - várakozás" };
    }

    // OPTIMIZED: Raised thresholds for better risk/reward
    // ERŐS jel: delta > 0.18% (raised from 0.15% for better selectivity)
    if (deltaPct > 0.18) {
      const conf = Math.min(0.95, 0.78 + (deltaPct - 0.18) * 2.0);
      debugLog('WindowDelta', '✅ ERŐS UP jel', { action: 'YES', confidence: conf.toFixed(2) });
      return {
        action: "YES" as Outcome,
        confidence: conf,
        reason: `Erős UP delta: +${deltaPct.toFixed(3)}% az ablakon belül`
      };
    }
    if (deltaPct < -0.18) {
      const conf = Math.min(0.95, 0.78 + (-deltaPct - 0.18) * 2.0);
      debugLog('WindowDelta', '✅ ERŐS DOWN jel', { action: 'NO', confidence: conf.toFixed(2) });
      return {
        action: "NO" as Outcome,
        confidence: conf,
        reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}% az ablakon belül`
      };
    }

    debugLog('WindowDelta', '⏸️ Delta túl kicsi');
    return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(4)}%` };
  },
};

// ──────────────────────────────────────────────────────────
// #2 ORACLE LAG - Chainlink oracle késedelmet kihasználó
// A Binance ár 15-45mp-el megelőzi a Polymarket frissülését
// ──────────────────────────────────────────────────────────
export const binanceSignalStrategy: Strategy = {
  name: "Oracle Lag",
  description: "Binance valós idejű BTC ár előnye a Chainlink oracle felett",
  category: "momentum",
  execute: (ctx: StrategyContext) => {
    const { binanceSignal, timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

    if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
      return { action: null, confidence: 0, reason: "Nincs Binance jel" };
    }

    // Jel kora - csak friss jeleket fogadj el (< 8 másodperc)
    const signalAge = Date.now() - binanceSignal.timestamp;
    if (signalAge > 8000) {
      debugLog('OracleLag', '❌ Jel lejárt', { age: (signalAge / 1000).toFixed(1) + 's' });
      return { action: null, confidence: 0, reason: `Jel lejárt: ${(signalAge / 1000).toFixed(1)}mp` };
    }

    debugLog('OracleLag', 'Jel érkezett', {
      type: binanceSignal.type,
      change: binanceSignal.changePercent.toFixed(4) + '%',
      age: (signalAge / 1000).toFixed(1) + 's',
      confidence: binanceSignal.confidence.toFixed(2)
    });

    if (timeRemaining < 3000) {
      return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
    }

    const windowOpen = btcWindowOpen || btcPrice || 0;
    const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
    const signalAlignedWithDelta =
      (binanceSignal.type === "UP" && deltaPct > 0) ||
      (binanceSignal.type === "DOWN" && deltaPct < 0);

    const marketImplied = binanceSignal.type === "UP"
      ? marketPrice.yesPrice
      : marketPrice.noPrice;

    const MIN_ENTRY_ODDS = 0.40;
    const MAX_ENTRY_ODDS = 0.80;

    if (marketImplied < MIN_ENTRY_ODDS) {
      debugLog('OracleLag', '❌ Ár túl alacsony', { price: (marketImplied * 100).toFixed(0) + '¢' });
      return { action: null, confidence: 0, reason: `Ár túl alacsony: ${(marketImplied * 100).toFixed(0)}¢` };
    }
    if (marketImplied > MAX_ENTRY_ODDS) {
      debugLog('OracleLag', '❌ Piac már beárazta', { price: (marketImplied * 100).toFixed(0) + '¢' });
      return { action: null, confidence: 0, reason: "Piac már beárazta" };
    }

    const action = binanceSignal.type === "UP" ? "YES" as Outcome : "NO" as Outcome;
    let confidence = binanceSignal.confidence;

    if (signalAlignedWithDelta) {
      confidence = Math.min(0.95, confidence + 0.10);
      debugLog('OracleLag', '✅ Delta megerősít', { deltaPct: deltaPct.toFixed(4) + '%' });
    } else if (Math.abs(deltaPct) > 0.03) {
      debugLog('OracleLag', '❌ Delta ellentmond', { deltaPct: deltaPct.toFixed(4) + '%' });
      return { action: null, confidence: 0, reason: `Delta ellentmond: jel=${binanceSignal.type} de delta=${deltaPct.toFixed(3)}%` };
    } else {
      confidence = confidence * 0.6;
      debugLog('OracleLag', '⚠️ Delta nem erősít', { deltaPct: deltaPct.toFixed(4) + '%' });
    }

    if (Math.abs(binanceSignal.changePercent) > 0.05) {
      confidence = Math.min(0.95, confidence + 0.08);
    }

    if (confidence < 0.45) {
      debugLog('OracleLag', '❌ Konfidencia túl alacsony', { confidence: confidence.toFixed(2) });
      return { action: null, confidence, reason: "Konfidencia túl alacsony" };
    }

    debugLog('OracleLag', '✅ TRADE', { action, confidence: confidence.toFixed(2), price: (marketImplied * 100).toFixed(0) + '¢' });
    return {
      action,
      confidence,
      reason: `Oracle lag: BTC ${binanceSignal.type} ${binanceSignal.changePercent >= 0 ? "+" : ""}${binanceSignal.changePercent.toFixed(4)}% | Piac: ${(marketImplied * 100).toFixed(1)}¢`,
    };
  },
};

// ──────────────────────────────────────────────────────────
// #3 LAST_SECONDS_SCALP - T-10 sniper stratégia
// ──────────────────────────────────────────────────────────
export const lastSecondsScalpStrategy: Strategy = {
  name: "T-10 Sniper",
  description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
  category: "arbitrage",
  execute: (ctx: StrategyContext) => {
    const { timeRemaining, btcPrice, btcWindowOpen, marketPrice, binanceSignal } = ctx;

    if (timeRemaining > 20000 || timeRemaining < 3000) {
      return { action: null, confidence: 0, reason: "Nem a T-10 sniper ablakban" };
    }

    if (!btcPrice) {
      return { action: null, confidence: 0, reason: "Nincs BTC ár" };
    }

    const windowOpen = btcWindowOpen || btcPrice;
    const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

    const minDelta = 0.08;
    if (Math.abs(deltaPct) < minDelta) {
      return { action: null, confidence: 0, reason: `Delta ${deltaPct.toFixed(4)}% - túl kicsi` };
    }

    const action = deltaPct > 0 ? "YES" as Outcome : "NO" as Outcome;
    const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
    const MIN_BUY_PRICE = 0.40;
    const MAX_BUY_PRICE = 0.65;

    if (targetPrice < MIN_BUY_PRICE) {
      return { action: null, confidence: 0, reason: `Ár túl alacsony: ${(targetPrice * 100).toFixed(0)}¢` };
    }
    if (targetPrice > MAX_BUY_PRICE) {
      return { action: null, confidence: 0, reason: `Ár túl magas: ${(targetPrice * 100).toFixed(0)}¢` };
    }

    let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

    if (binanceSignal && binanceSignal.type !== "NEUTRAL") {
      const signalAligned =
        (binanceSignal.type === "UP" && deltaPct > 0) ||
        (binanceSignal.type === "DOWN" && deltaPct < 0);
      if (signalAligned) {
        confidence = Math.min(0.85, confidence + 0.10);
      }
    }

    return {
      action,
      confidence,
      reason: `T-10: ${action} @ ${(targetPrice * 100).toFixed(0)}¢ | delta ${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(3)}%`,
    };
  },
};

// ──────────────────────────────────────────────────────────
// #4 MONTE CARLO - Valószínűségi modell
// ──────────────────────────────────────────────────────────
export const monteCarloStrategy: Strategy = {
  name: "Monte Carlo",
  description: "BTC delta alapú valószínűségi becslés",
  category: "arbitrage",
  execute: (ctx: StrategyContext) => {
    const { timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

    if (!btcPrice) {
      return { action: null, confidence: 0, reason: "Nincs BTC ár" };
    }

    if (timeRemaining < 30000 || timeRemaining > 240000) {
      return { action: null, confidence: 0, reason: "Nem aktív ablakban" };
    }

    const windowOpen = btcWindowOpen || btcPrice;
    const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

    if (Math.abs(deltaPct) < 0.03) {
      return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(3)}%` };
    }

    let upProb = 0.5;
    if (deltaPct > 0) {
      upProb = Math.min(0.88, 0.55 + deltaPct * 3.5);
    } else {
      upProb = Math.max(0.12, 0.55 + deltaPct * 3.5);
    }

    const yesPrice = marketPrice.yesPrice;
    const noPrice = marketPrice.noPrice;
    const edge = upProb - yesPrice;
    const minEdge = 0.10;
    const MIN_ENTRY_ODDS = 0.40;
    const MAX_ENTRY_ODDS = 0.65;

    if (edge > minEdge && yesPrice >= MIN_ENTRY_ODDS && yesPrice <= MAX_ENTRY_ODDS) {
      return {
        action: "YES" as Outcome,
        confidence: Math.min(0.75, 0.5 + edge * 3),
        reason: `MC: P(UP)=${(upProb * 100).toFixed(0)}% vs ${(yesPrice * 100).toFixed(0)}¢ | +${deltaPct.toFixed(3)}%`,
      };
    }

    if (-edge > minEdge && noPrice >= MIN_ENTRY_ODDS && noPrice <= MAX_ENTRY_ODDS) {
      return {
        action: "NO" as Outcome,
        confidence: Math.min(0.75, 0.5 + (-edge) * 3),
        reason: `MC: P(DOWN)=${((1-upProb) * 100).toFixed(0)}% vs ${(noPrice * 100).toFixed(0)}¢ | ${deltaPct.toFixed(3)}%`,
      };
    }

    return { action: null, confidence: 0, reason: `MC: edge ${(Math.abs(edge) * 100).toFixed(1)}%` };
  },
};

// ──────────────────────────────────────────────────────────
// #5 FAIR VALUE ARBITRAGE
// ──────────────────────────────────────────────────────────
export const fairValueStrategy: Strategy = {
  name: "Fair Value Arb",
  description: "Piac félreárazást keres BTC delta vs Polymarket odds alapján",
  category: "arbitrage",
  execute: (ctx: StrategyContext) => {
    const { timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

    if (timeRemaining < 15000) {
      return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
    }

    if (!btcPrice) {
      return { action: null, confidence: 0, reason: "Nincs BTC ár" };
    }

    const windowOpen = btcWindowOpen || btcPrice;
    const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
    const fairUpProb = Math.min(0.97, Math.max(0.03, 0.5 + Math.tanh(deltaPct / 0.05) * 0.45));
    const marketYes = marketPrice.yesPrice;
    const edge = fairUpProb - marketYes;
    const minEdge = 0.15;
    const MIN_ENTRY_ODDS = 0.40;
    const MAX_ENTRY_ODDS = 0.55;

    if (edge > minEdge && marketYes >= MIN_ENTRY_ODDS && marketYes <= MAX_ENTRY_ODDS) {
      return {
        action: "YES" as Outcome,
        confidence: Math.min(0.85, 0.55 + edge * 2.5),
        reason: `Fair value: számított=${(fairUpProb * 100).toFixed(1)}% vs piac=${(marketYes * 100).toFixed(1)}¢`,
      };
    }

    if (-edge > minEdge && marketPrice.noPrice >= MIN_ENTRY_ODDS && marketPrice.noPrice <= MAX_ENTRY_ODDS) {
      const fairDownProb = 1 - fairUpProb;
      return {
        action: "NO" as Outcome,
        confidence: Math.min(0.85, 0.55 + (-edge) * 2.5),
        reason: `Fair value: számított DOWN=${(fairDownProb * 100).toFixed(1)}% vs piac=${(marketPrice.noPrice * 100).toFixed(1)}¢`,
      };
    }

    return { action: null, confidence: 0, reason: `Fair value: edge csak ${(Math.abs(edge) * 100).toFixed(1)}%` };
  },
};

// Helper to get delta percentage (used by multiple strategies)
export function getDeltaPct(ctx: StrategyContext): number {
  const { btcPrice, btcWindowOpen } = ctx;
  if (!btcPrice) return 0;
  const windowOpen = btcWindowOpen || btcPrice;
  return windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
}