// All Strategy Implementations
// RESTORED from working version (commit 7b46669)
// Key: MEDIUM signals, NO strict price limits, proven thresholds

import type { Strategy, StrategyType } from "../../types";

const DEBUG_STRATEGIES = false;

export function debugLog(strategy: string, message: string, data?: Record<string, unknown>) {
  if (DEBUG_STRATEGIES) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][${strategy}] ${message}`, data ? JSON.stringify(data) : '');
  }
}

export const strategies: Record<StrategyType, Strategy> = {

  // ═══════════════════════════════════════════════════════════════
  // #1 WINDOW_DELTA - A LEGJOBB STRATÉGIA (RESTORED)
  // ═══════════════════════════════════════════════════════════════
  // #1 WINDOW_DELTA - FIXED: Add price limits
  // ═══════════════════════════════════════════════════════════════
  window_delta: {
    name: "Window Delta",
    description: "BTC ár vs ablak nyitóár alapján - a legjobb 5m stratégia",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Utolsó 3mp nem tradel
      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl késő" };
      }

      // Első 30mp nem tradel
      if (timeRemaining > 270000) {
        return { action: null, confidence: 0, reason: "Ablak eleje" };
      }

      // ERŐS jel: delta > 0.12% - with price limits
      if (deltaPct > 0.12 && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.92, 0.70 + (deltaPct - 0.12) * 3),
          reason: `Erős UP delta: +${deltaPct.toFixed(3)}%`,
        };
      }
      if (deltaPct < -0.12 && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
        return {
          action: "NO",
          confidence: Math.min(0.92, 0.70 + (-deltaPct - 0.12) * 3),
          reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}%`,
        };
      }

      // KÖZEPES jel: delta > 0.07% - with price limits
      if (deltaPct > 0.07 && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.78, 0.55 + (deltaPct - 0.07) * 4),
          reason: `UP delta: +${deltaPct.toFixed(3)}%`,
        };
      }
      if (deltaPct < -0.07 && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
        return {
          action: "NO",
          confidence: Math.min(0.78, 0.55 + (-deltaPct - 0.07) * 4),
          reason: `DOWN delta: ${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(4)}%` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #2 ORACLE LAG - FIXED: Price limits for both directions
  // ═══════════════════════════════════════════════════════════════
  binance_signal: {
    name: "Oracle Lag",
    description: "Binance valós idejű BTC ár előnye",
    category: "momentum",
    execute: (ctx) => {
      const { binanceSignal, timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

      if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
        return { action: null, confidence: 0, reason: "Nincs Binance jel" };
      }

      const signalAge = Date.now() - binanceSignal.timestamp;
      if (signalAge > 8000) {
        return { action: null, confidence: 0, reason: "Jel lejárt" };
      }

      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      const action = binanceSignal.type === "UP" ? "YES" : "NO";

      // CRITICAL FIX: Price limits for BOTH directions
      // Only buy YES if yesPrice is between 30-70 cents
      // Only buy NO if noPrice is between 30-70 cents
      const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
      if (targetPrice < 0.30 || targetPrice > 0.70) {
        return { action: null, confidence: 0, reason: `Ár extrém: ${(targetPrice*100).toFixed(0)}¢` };
      }

      let confidence = binanceSignal.confidence;

      // Delta megerősítés
      const signalAlignedWithDelta =
        (binanceSignal.type === "UP" && deltaPct > 0) ||
        (binanceSignal.type === "DOWN" && deltaPct < 0);

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

      return {
        action,
        confidence,
        reason: `Oracle: BTC ${binanceSignal.type} ${binanceSignal.changePercent.toFixed(4)}%`,
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #3 T-10 SNIPER - FIXED: Lower thresholds for more trades
  // ═══════════════════════════════════════════════════════════════
  last_seconds_scalp: {
    name: "T-10 Sniper",
    description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice, binanceSignal } = ctx;

      // CSAK az utolsó 30 másodpercben aktív (4mp-ig)
      if (timeRemaining > 30000 || timeRemaining < 4000) {
        return { action: null, confidence: 0, reason: "Kívül a T-10 ablakon" };
      }

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Min delta: 0.04% (lowered from 0.06%)
      if (Math.abs(deltaPct) < 0.04) {
        return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(4)}%` };
      }

      const action = deltaPct > 0 ? "YES" : "NO";
      const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;

      // Max ár: 75¢ (raised from 72¢ - final seconds scalp)
      if (targetPrice > 0.75) {
        return { action: null, confidence: 0, reason: `Ár túl magas: ${(targetPrice*100).toFixed(0)}¢` };
      }

      // Min ár: 25¢ (don't buy at very low odds)
      if (targetPrice < 0.25) {
        return { action: null, confidence: 0, reason: `Ár túl alacsony: ${(targetPrice*100).toFixed(0)}¢` };
      }

      let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

      // Binance megerősítés
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
        reason: `T-10: ${action} @ ${(targetPrice*100).toFixed(0)}¢ | delta ${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(3)}%`,
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #4 MONTE CARLO - FIXED: Don't buy at extreme prices
  // ═══════════════════════════════════════════════════════════════
  monte_carlo: {
    name: "Monte Carlo",
    description: "BTC delta alapú valószínűségi becslés",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      // 30mp - 4 perc
      if (timeRemaining < 30000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Kívül az aktív ablakon" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Min delta: 0.04%
      if (Math.abs(deltaPct) < 0.04) {
        return { action: null, confidence: 0, reason: `Delta túl kicsi` };
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

      const minEdge = 0.10; // Increased from 0.08

      // CRITICAL FIX: Don't buy if price is already extreme (>70% or <30%)
      // Only buy YES if yesPrice is between 30-65 cents
      // Only buy NO if noPrice is between 30-65 cents (i.e., yesPrice 35-70)

      if (edge > minEdge && yesPrice >= 0.30 && yesPrice <= 0.65) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.5 + edge * 3),
          reason: `MC: P(UP)=${(upProb*100).toFixed(0)}% vs ${(yesPrice*100).toFixed(0)}¢`,
        };
      }

      if (-edge > minEdge && noPrice >= 0.30 && noPrice <= 0.65) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.5 + (-edge) * 3),
          reason: `MC: P(DOWN)=${((1-upProb)*100).toFixed(0)}% vs ${(noPrice*100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: `MC: edge túl kicsi vagy ár extrém` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #5 FAIR VALUE ARBITRAGE - FIXED: Price limits for BOTH YES and NO
  // ═══════════════════════════════════════════════════════════════
  fair_value: {
    name: "Fair Value Arb",
    description: "Piac félreárazást keres",
    category: "arbitrage",
    execute: (ctx) => {
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
      const marketNo = marketPrice.noPrice;
      const edge = fairUpProb - marketYes;

      const minEdge = 0.07;

      // CRITICAL FIX: Only buy YES if price is between 30-65 cents
      if (edge > minEdge && marketYes >= 0.30 && marketYes <= 0.65) {
        return {
          action: "YES",
          confidence: Math.min(0.85, 0.5 + edge * 3),
          reason: `Fair: számított=${(fairUpProb*100).toFixed(0)}% vs ${(marketYes*100).toFixed(0)}¢`,
        };
      }

      // CRITICAL FIX: Only buy NO if NO price is between 30-65 cents
      // (which means YES price is between 35-70 cents)
      const noEdge = (1 - fairUpProb) - marketNo;
      if (noEdge > minEdge && marketNo >= 0.30 && marketNo <= 0.65) {
        return {
          action: "NO",
          confidence: Math.min(0.85, 0.5 + (-edge) * 3),
          reason: `Fair DOWN=${((1-fairUpProb)*100).toFixed(0)}% vs ${(marketNo*100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: `Edge túl kicsi vagy ár extrém` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #6 MOMENTUM - FIXED: Add price limits
  // ═══════════════════════════════════════════════════════════════
  momentum: {
    name: "BTC Momentum",
    description: "BTC momentum alapú kereskedés",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      // BTC price change
      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.0005) {
        const pct = btcPriceChange * 100;
        if (pct > 0.05 && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
          return {
            action: "YES",
            confidence: Math.min(0.78, 0.50 + pct * 5),
            reason: `BTC momentum +${pct.toFixed(3)}%`,
          };
        }
        if (pct < -0.05 && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
          return {
            action: "NO",
            confidence: Math.min(0.78, 0.50 + (-pct) * 5),
            reason: `BTC momentum ${pct.toFixed(3)}%`,
          };
        }
      }

      // Fallback: window delta
      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      if (deltaPct > 0.05 && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.70, 0.50 + deltaPct * 4),
          reason: `Window momentum +${deltaPct.toFixed(3)}%`,
        };
      }
      if (deltaPct < -0.05 && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
        return {
          action: "NO",
          confidence: Math.min(0.70, 0.50 + (-deltaPct) * 4),
          reason: `Window momentum ${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs elég momentum vagy ár extrém" };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #7 SMART TREND (RESTORED)
  // ═══════════════════════════════════════════════════════════════
  smart_trend: {
    name: "Smart Trend",
    description: "Multi-timeframe trend + BTC megerősítés",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (priceHistory.length < 10 || timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const shortTerm = priceHistory.slice(-3);
      const mediumTerm = priceHistory.slice(-8);
      const longTerm = priceHistory.slice(-15);

      const shortAvg = shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length;
      const mediumAvg = mediumTerm.reduce((a, b) => a + b, 0) / mediumTerm.length;
      const longAvg = longTerm.length > 0 ? longTerm.reduce((a, b) => a + b, 0) / longTerm.length : mediumAvg;

      const shortTrendUp = shortAvg > mediumAvg;
      const mediumTrendUp = mediumAvg > longAvg;

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      const btcConfirmsUp = deltaPct > 0.03;
      const btcConfirmsDown = deltaPct < -0.03;

      // CRITICAL FIX: Add price limits
      if (shortTrendUp && mediumTrendUp && btcConfirmsUp && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
        return {
          action: "YES",
          confidence: 0.72,
          reason: "Trend UP + BTC megerősítve",
        };
      }
      if (!shortTrendUp && !mediumTrendUp && btcConfirmsDown && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
        return {
          action: "NO",
          confidence: 0.72,
          reason: "Trend DOWN + BTC megerősítve",
        };
      }

      return { action: null, confidence: 0, reason: "Vegyes jelzések vagy ár extrém" };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #8 CONTRARIAN - FIXED: Lower price limit
  // ═══════════════════════════════════════════════════════════════
  contrarian: {
    name: "Contrarian",
    description: "BTC követés - nem igazi contrarian",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // BTC UP de piac még alacsony YES ár (30-70 cent)
      if (deltaPct > 0.05 && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.55 + deltaPct * 3),
          reason: `BTC +${deltaPct.toFixed(3)}% → követés`,
        };
      }

      // BTC DOWN de piac még alacsony NO ár (30-70 cent)
      if (deltaPct < -0.05 && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.70) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.55 + (-deltaPct) * 3),
          reason: `BTC ${deltaPct.toFixed(3)}% → követés`,
        };
      }

      // Igazi contrarian: piac extrém de BTC ellentmond
      if (marketPrice.yesPrice > 0.80 && deltaPct < -0.05 && marketPrice.noPrice >= 0.30) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.55 + (marketPrice.yesPrice - 0.70) * 3),
          reason: `Contrarian: piac túl optimista`,
        };
      }
      if (marketPrice.noPrice > 0.80 && deltaPct > 0.05 && marketPrice.yesPrice >= 0.30) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.55 + (marketPrice.noPrice - 0.70) * 3),
          reason: `Contrarian: piac túl pesszimista`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs jelzés" };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // #9 ARBITRAGE - FIXED: Don't buy at extreme prices
  // ═══════════════════════════════════════════════════════════════
  arbitrage: {
    name: "Arbitrage",
    description: "BTC delta vs piac ár különbség",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 30000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Kívül az aktív időszakon" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Min delta: 0.04%
      if (Math.abs(deltaPct) < 0.04) {
        return { action: null, confidence: 0, reason: "Delta nem egyértelmű" };
      }

      const fairProb = 0.5 + deltaPct * 4;
      const edge = fairProb - marketPrice.yesPrice;

      const minEdge = 0.08; // Increased from 0.06

      // CRITICAL FIX: Only trade in reasonable price range (30-65 cents)
      // Don't buy YES if price is already >65% or <30%
      if (edge > minEdge && marketPrice.yesPrice >= 0.30 && marketPrice.yesPrice <= 0.65) {
        return {
          action: "YES",
          confidence: Math.min(0.78, 0.5 + edge * 3),
          reason: `Arb: fair=${(fairProb*100).toFixed(0)}% vs ${(marketPrice.yesPrice*100).toFixed(0)}¢`,
        };
      }

      const noEdge = (1 - fairProb) - marketPrice.noPrice;
      // Don't buy NO if price is already >65% or <30%
      if (noEdge > minEdge && marketPrice.noPrice >= 0.30 && marketPrice.noPrice <= 0.65) {
        return {
          action: "NO",
          confidence: Math.min(0.78, 0.5 + noEdge * 3),
          reason: `Arb DOWN=${((1-fairProb)*100).toFixed(0)}% vs ${(marketPrice.noPrice*100).toFixed(0)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs elegendő edge vagy ár extrém" };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Additional strategies
  // ═══════════════════════════════════════════════════════════════

  mean_reversion: {
    name: "Mean Reversion",
    description: "Extrém elmozdulás után visszatérés",
    category: "mean_reversion",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen } = ctx;
      if (timeRemaining < 30000) return { action: null, confidence: 0, reason: "Túl közel" };

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      if (deltaPct > 0.20 && timeRemaining > 60000) {
        return { action: "NO", confidence: Math.min(0.68, 0.5 + (deltaPct - 0.20) * 2), reason: `Extrém UP → visszatérés` };
      }
      if (deltaPct < -0.20 && timeRemaining > 60000) {
        return { action: "YES", confidence: Math.min(0.68, 0.5 + (-deltaPct - 0.20) * 2), reason: `Extrém DOWN → visszatérés` };
      }
      return { action: null, confidence: 0, reason: "Nincs extrém elmozdulás" };
    },
  },

  trend: {
    name: "Multi-level Trend",
    description: "Trend követés",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen } = ctx;
      if (priceHistory.length < 10 || timeRemaining < 30000) return { action: null, confidence: 0, reason: "Nincs elég adat" };

      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-10, -3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const trend = (recentAvg - olderAvg) / olderAvg;

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const btcAligned = (trend > 0 && deltaPct > 0) || (trend < 0 && deltaPct < 0);

      if (trend > 0.0008 && btcAligned) {
        return { action: "YES", confidence: Math.min(0.72, 0.50 + trend * 200), reason: "Trend UP + BTC" };
      }
      if (trend < -0.0008 && btcAligned) {
        return { action: "NO", confidence: Math.min(0.72, 0.50 + (-trend) * 200), reason: "Trend DOWN + BTC" };
      }
      return { action: null, confidence: 0, reason: "Nincs trend" };
    },
  },

  volatility: {
    name: "Volatility Breakout",
    description: "Volatilitás kitörés",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;
      if (timeRemaining < 60000) return { action: null, confidence: 0, reason: "Túl kevés idő" };

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      if (Math.abs(deltaPct) > 0.06) {
        const action = deltaPct > 0 ? "YES" : "NO";
        return { action, confidence: 0.65, reason: `Vol breakout: ${deltaPct.toFixed(3)}%` };
      }
      return { action: null, confidence: 0, reason: "Nincs kitörés" };
    },
  },

  anomaly: {
    name: "Anomaly",
    description: "Árképzési anomáliák",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;
      if (timeRemaining < 30000) return { action: null, confidence: 0, reason: "Túl közel" };

      const sum = marketPrice.yesPrice + marketPrice.noPrice;
      if (sum < 0.96) {
        const action = marketPrice.yesPrice < marketPrice.noPrice ? "YES" : "NO";
        return { action, confidence: Math.min(0.75, (1 - sum) * 12), reason: `Anomália: sum=${(sum*100).toFixed(1)}¢` };
      }
      return { action: null, confidence: 0, reason: "Nincs anomália" };
    },
  },

  momentum_burst: {
    name: "Momentum Burst",
    description: "Hirtelen BTC mozgások",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen } = ctx;
      if (timeRemaining < 20000) return { action: null, confidence: 0, reason: "Nincs elég idő" };

      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.0008) {
        const pct = btcPriceChange * 100;
        const windowOpen = btcWindowOpen || btcPrice || 0;
        const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
        const aligned = (pct > 0 && deltaPct > 0) || (pct < 0 && deltaPct < 0);

        if (aligned) {
          const action = pct > 0 ? "YES" : "NO";
          return { action, confidence: Math.min(0.75, 0.50 + Math.abs(pct) * 25), reason: `Burst: ${pct.toFixed(4)}%` };
        }
      }
      return { action: null, confidence: 0, reason: "Nincs burst" };
    },
  },

  grid_trading: {
    name: "Grid Trading",
    description: "Grid szinteken kereskedik",
    category: "other",
    execute: () => ({ action: null, confidence: 0, reason: "Grid szünetel" }),
  },

  market_making: {
    name: "Market Making",
    description: "Likviditás biztosítás",
    category: "arbitrage",
    execute: () => ({ action: null, confidence: 0, reason: "MM szünetel" }),
  },

  random: {
    name: "Random",
    description: "Véletlen kereskedés",
    category: "other",
    execute: () => ({ action: Math.random() > 0.5 ? "YES" : "NO", confidence: 0.5, reason: "Véletlen" }),
  },

  // ═══════════════════════════════════════════════════════════════
  // NEW STRATEGIES (Option A - Change the Game)
  // These have real edges, not just BTC direction prediction
  // ═══════════════════════════════════════════════════════════════

  volatility_breakout: {
    name: "Volatility Breakout",
    description: "Csak extrém volatilitásnál kereskedik",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, btcVolatility, marketPrice } = ctx;
      if (timeRemaining < 30000) return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      if (!btcPrice) return { action: null, confidence: 0, reason: "Nincs BTC ár" };

      const vol = btcVolatility ?? 0;
      if (vol < 0.003) return { action: null, confidence: 0, reason: `Vol túl alacsony: ${(vol*100).toFixed(2)}%` };

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      if (Math.abs(deltaPct) < 0.03) return { action: null, confidence: 0, reason: `Delta kicsi: ${deltaPct.toFixed(4)}%` };

      const action = deltaPct > 0 ? "YES" : "NO";
      return { action, confidence: Math.min(0.85, 0.60 + Math.abs(deltaPct) * 3), reason: `Vol breakout: ${action}` };
    },
  },

  // ultra_low_entry: Implemented in ./strategies/ultra-low-entry.ts
  // This is a minimal placeholder - actual strategy imported in index.ts
  ultra_low_entry: {
    name: "Ultra Low Entry",
    description: "Entry at 4-15¢ - market underestimates probability",
    category: "mean_reversion",
    execute: () => ({ action: null, confidence: 0, reason: "Use strategy from index.ts" }),
  },

  trend_pullback: {
    name: "Trend Pullback",
    description: "Macró trend közbeni regressziós vételek",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, hourOfDay, dayOfWeek, marketPrice } = ctx;
      if (timeRemaining < 30000) return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };

      const hour = hourOfDay ?? new Date().getUTCHours();
      const day = dayOfWeek ?? new Date().getUTCDay();

      // Skip weekends
      if (day === 0 || day === 6) return { action: null, confidence: 0, reason: "Hétvége" };

      // High-conviction hours
      const isHighConviction = (hour >= 0 && hour < 2) || (hour >= 8 && hour < 10) || (hour >= 14 && hour < 16);
      if (!isHighConviction) return { action: null, confidence: 0, reason: `Normál óra: ${hour}:00` };

      if (!btcPrice) return { action: null, confidence: 0, reason: "Nincs BTC ár" };

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      if (Math.abs(deltaPct) < 0.02) return { action: null, confidence: 0, reason: `Delta kicsi` };

      const action = deltaPct > 0 ? "YES" : "NO";
      // Enyhe zajosodást kivéve:
      return { action, confidence: Math.min(0.82, 0.55 + Math.abs(deltaPct) * 3), reason: `Trend pullback: ${hour}:00 UTC` };
    },
  },

  price_reversion: {
    name: "Price Reversion",
    description: "Polymarket ár visszatérés",
    category: "mean_reversion",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, priceVelocity } = ctx;
      if (timeRemaining < 15000) return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };

      const yesPrice = marketPrice.yesPrice;
      const noPrice = marketPrice.noPrice;
      const velocity = priceVelocity ?? 0;

      // Oversold YES
      if (yesPrice < 0.25) {
        if (velocity >= 0 || Math.abs(velocity) < 0.01) {
          return { action: "YES", confidence: Math.min(0.80, 0.55 + (0.25 - yesPrice) * 2), reason: `YES oversold @ ${(yesPrice*100).toFixed(0)}¢` };
        }
        return { action: null, confidence: 0, reason: "YES esik még" };
      }

      // Overbought YES
      if (yesPrice > 0.75) {
        if (velocity <= 0 || Math.abs(velocity) < 0.01) {
          return { action: "NO", confidence: Math.min(0.80, 0.55 + (yesPrice - 0.75) * 2), reason: `NO (YES overbought) @ ${(noPrice*100).toFixed(0)}¢` };
        }
        return { action: null, confidence: 0, reason: "YES nő még" };
      }

      return { action: null, confidence: 0, reason: `Ár középen: ${(yesPrice*100).toFixed(0)}¢` };
    },
  },

  binance_velocity: {
    name: "Binance Velocity",
    description: "BTC sebesség alapú",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcVelocity, btcAcceleration, btcPrice, marketPrice } = ctx;
      if (timeRemaining < 30000) return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };

      const velocity = btcVelocity ?? 0;
      const acceleration = btcAcceleration ?? 0;

      if (Math.abs(velocity) < 0.0001) return { action: null, confidence: 0, reason: `Alacsony velocity` };

      const isUp = velocity > 0;
      const isAccelerating = (isUp && acceleration > 0) || (!isUp && acceleration < 0);

      if (isAccelerating) {
        const action = isUp ? "YES" : "NO";
        return { action, confidence: Math.min(0.85, 0.60 + Math.abs(velocity) * 500), reason: `Velocity+Accel: ${action}` };
      }

      // Strong velocity without acceleration
      if (Math.abs(velocity) > 0.0002) {
        const action = isUp ? "YES" : "NO";
        return { action, confidence: Math.min(0.72, 0.55 + Math.abs(velocity) * 400), reason: `Velocity: ${action}` };
      }

      return { action: null, confidence: 0, reason: `Velocity nem elég` };
    },
  },

  sniper_value: {
    name: "Sniper Value",
    description: "Extremális áraknál kereskedik - 10-15¢ YES, 40-50¢+ NO",
    category: "mean_reversion",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, priceVelocity } = ctx;
      if (timeRemaining < 20000) return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };

      const yesPrice = marketPrice.yesPrice;
      const noPrice = marketPrice.noPrice;
      const velocity = priceVelocity ?? 0;

      // Buy YES if < 15¢ (extreme undervaluation)
      if (yesPrice < 0.15) {
        if (velocity < -0.02) return { action: null, confidence: 0, reason: "YES zuhan még" };
        return { action: "YES", confidence: Math.min(0.90, 0.60 + (0.15 - yesPrice) * 3), reason: `SNIPER YES @ ${(yesPrice*100).toFixed(0)}¢` };
      }

      // Buy NO if YES > 40¢ (NO is cheap)
      if (yesPrice > 0.40) {
        if (velocity > 0.02) return { action: null, confidence: 0, reason: "YES nő még" };
        return { action: "NO", confidence: Math.min(0.85, 0.55 + (yesPrice - 0.40) * 2), reason: `SNIPER NO @ ${(noPrice*100).toFixed(0)}¢` };
      }

      return { action: null, confidence: 0, reason: `Közép zóna: ${(yesPrice*100).toFixed(0)}¢` };
    },
  },

  // Odds Swing - delegated to new strategies module
  odds_swing: {
    name: "Odds Swing",
    description: "Buys low-priced outcomes (<15¢) and auto-exits at 2x via PositionMonitor",
    category: "other",
    execute: () => ({ action: null, confidence: 0, reason: "Use new strategies module" }),
  },
};