// All Strategy Implementations
// Extracted from bot-manager.ts for better modularity
// NOTE: This file exceeds 300 lines intentionally - it contains all 17 strategies
// together for easier maintenance. Future refactoring could split these further.

import type { Strategy, StrategyType } from "../../types";

// Debug mode - set to true to enable verbose logging
const DEBUG_STRATEGIES = true;

export function debugLog(strategy: string, message: string, data?: Record<string, unknown>) {
  if (DEBUG_STRATEGIES) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][${strategy}] ${message}`, data ? JSON.stringify(data) : '');
  }
}

export const strategies: Record<StrategyType, Strategy> = {
  window_delta: {
    name: "Window Delta",
    description: "BTC ár vs ablak nyitóár alapján - a legjobb 5m stratégia",
    category: "momentum",
    execute: (ctx) => {
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
          action: "YES",
          confidence: conf,
          reason: `Erős UP delta: +${deltaPct.toFixed(3)}% az ablakon belül`
        };
      }
      if (deltaPct < -0.18) {
        const conf = Math.min(0.95, 0.78 + (-deltaPct - 0.18) * 2.0);
        debugLog('WindowDelta', '✅ ERŐS DOWN jel', { action: 'NO', confidence: conf.toFixed(2) });
        return {
          action: "NO",
          confidence: conf,
          reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}% az ablakon belül`
        };
      }

      // OPTIMIZED: Removed medium signals - only trade on strong signals
      // This reduces trade frequency but improves win rate

      debugLog('WindowDelta', '⏸️ Delta túl kicsi');
      return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(4)}%` };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #2 ORACLE LAG - Chainlink oracle késedelmet kihasználó
  // A Binance ár 15-45mp-el megelőzi a Polymarket frissülését
  // ──────────────────────────────────────────────────────────
  binance_signal: {
    name: "Oracle Lag",
    description: "Binance valós idejű BTC ár előnye a Chainlink oracle felett",
    category: "momentum",
    execute: (ctx) => {
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

      // Debug: log signal info
      debugLog('OracleLag', 'Jel érkezett', {
        type: binanceSignal.type,
        change: binanceSignal.changePercent.toFixed(4) + '%',
        age: (signalAge / 1000).toFixed(1) + 's',
        confidence: binanceSignal.confidence.toFixed(2)
      });

      // Ne kereskedj a lezárás előtti utolsó 3 másodpercben
      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      // Window delta megerősítés
      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const signalAlignedWithDelta =
        (binanceSignal.type === "UP" && deltaPct > 0) ||
        (binanceSignal.type === "DOWN" && deltaPct < 0);

      // Ellenőrizd, hogy a piac még nem árazta be
      const marketImplied = binanceSignal.type === "UP"
        ? marketPrice.yesPrice
        : marketPrice.noPrice;

      // KRITIKUS: Minimális entry odds - soha ne trade-elj 40¢ alatt!
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.80;

      if (marketImplied < MIN_ENTRY_ODDS) {
        debugLog('OracleLag', '❌ Ár túl alacsony', { price: (marketImplied * 100).toFixed(0) + '¢' });
        return { action: null, confidence: 0, reason: `Ár túl alacsony: ${(marketImplied * 100).toFixed(0)}¢ (nagy kockázat)` };
      }
      if (marketImplied > MAX_ENTRY_ODDS) {
        debugLog('OracleLag', '❌ Piac már beárazta', { price: (marketImplied * 100).toFixed(0) + '¢' });
        return { action: null, confidence: 0, reason: "Piac már beárazta" };
      }

      const action = binanceSignal.type === "UP" ? "YES" : "NO";

      // Konfidencia számítás
      let confidence = binanceSignal.confidence;

      // A delta-nak MEGERŐSÍTENIE kell a jelet — ellentmondásnál elutasít
      if (signalAlignedWithDelta) {
        confidence = Math.min(0.95, confidence + 0.10);
        debugLog('OracleLag', '✅ Delta megerősít', { deltaPct: deltaPct.toFixed(4) + '%' });
      } else if (Math.abs(deltaPct) > 0.03) {
        // Delta aktívan ellentmond a jelnek → elutasít
        debugLog('OracleLag', '❌ Delta ellentmond', { deltaPct: deltaPct.toFixed(4) + '%' });
        return { action: null, confidence: 0, reason: `Delta ellentmond: jel=${binanceSignal.type} de delta=${deltaPct.toFixed(3)}%` };
      } else {
        confidence = confidence * 0.6;
        debugLog('OracleLag', '⚠️ Delta nem erősít (semleges)', { deltaPct: deltaPct.toFixed(4) + '%' });
      }

      // Magasabb konfidencia ha erősebb az elmozdulás
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
  },

  // ──────────────────────────────────────────────────────────
  // #3 LAST_SECONDS_SCALP - T-10 sniper stratégia
  // Az utolsó 30 másodpercben lép, amikor az irány már látható
  // ──────────────────────────────────────────────────────────
  last_seconds_scalp: {
    name: "T-10 Sniper",
    description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice, binanceSignal } = ctx;

      // CSAK az utolsó 20 másodpercben aktív (szűkítve 30-ról → pontosabb)
      if (timeRemaining > 20000 || timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Nem a T-10 sniper ablakban" };
      }

      // Szükség van BTC adatra
      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      // Calculate delta
      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Minimális delta szükséges (emelve 0.06 → 0.08 a megbízhatóságért)
      const minDelta = 0.08;
      if (Math.abs(deltaPct) < minDelta) {
        return { action: null, confidence: 0, reason: `Delta ${deltaPct.toFixed(4)}% - túl kicsi` };
      }

      const action = deltaPct > 0 ? "YES" : "NO";

      // KRITIKUS: Ellenőrizd az árat - SOHA ne vegyél túl olcsón vagy túl drágán!
      // A 2% fee miatt 65¢ felett már -EV a trade
      // Az adatok szerint 40¢ alatt 0% win rate van!
      const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
      const MIN_BUY_PRICE = 0.40; // 40¢ minimum - alatt 0% win rate
      const MAX_BUY_PRICE = 0.65; // 65¢ maximum - fee miatt

      if (targetPrice < MIN_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `Ár túl alacsony: ${(targetPrice * 100).toFixed(0)}¢ < ${(MIN_BUY_PRICE * 100).toFixed(0)}¢ min (nagy kockázat)` };
      }
      if (targetPrice > MAX_BUY_PRICE) {
        return { action: null, confidence: 0, reason: `Ár túl magas: ${(targetPrice * 100).toFixed(0)}¢ > ${(MAX_BUY_PRICE * 100).toFixed(0)}¢ max (fee miatt -EV)` };
      }

      // Konfidencia a delta mérete alapján
      let confidence = 0.60 + Math.min(0.25, Math.abs(deltaPct) * 3);

      // Erősebb konfidencia ha a Binance jel is megerősíti
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
  },

  // ──────────────────────────────────────────────────────────
  // #4 MONTE CARLO - Valószínűségi modell (JAVÍTOTT)
  // A jelenlegi BTC delta alapján becsüli a végkifejlest
  // ──────────────────────────────────────────────────────────
  monte_carlo: {
    name: "Monte Carlo",
    description: "BTC delta alapú valószínűségi becslés",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, marketPrice, btcPrice, btcWindowOpen } = ctx;

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      // CSAK aktív időszakban: 30mp - 4 perc
      if (timeRemaining < 30000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Nem aktív ablakban" };
      }

      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Ha nincs elmozdulás, nem kereskedj
      if (Math.abs(deltaPct) < 0.03) {
        return { action: null, confidence: 0, reason: `Delta túl kicsi: ${deltaPct.toFixed(3)}%` };
      }

      // EGYSZERŰSÍTETT: A delta alapján becsüljük P(UP)-ot
      // delta > 0.05% → P(UP) ≈ 75%
      // delta > 0.10% → P(UP) ≈ 85%
      let upProb = 0.5;
      if (deltaPct > 0) {
        upProb = Math.min(0.88, 0.55 + deltaPct * 3.5);
      } else {
        upProb = Math.max(0.12, 0.55 + deltaPct * 3.5);
      }

      const yesPrice = marketPrice.yesPrice;
      const noPrice = marketPrice.noPrice;
      const edge = upProb - yesPrice;

      // Szigorúbb edge küszöb
      const minEdge = 0.10;

      // KRITIKUS: Minimális entry odds - soha ne trade-elj 40¢ alatt!
      // Az adatok szerint 1-30¢ odds-nál 0% win rate van
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.65;

      if (edge > minEdge && yesPrice >= MIN_ENTRY_ODDS && yesPrice <= MAX_ENTRY_ODDS) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.5 + edge * 3),
          reason: `MC: P(UP)=${(upProb * 100).toFixed(0)}% vs ${(yesPrice * 100).toFixed(0)}¢ | +${deltaPct.toFixed(3)}%`,
        };
      }

      if (-edge > minEdge && noPrice >= MIN_ENTRY_ODDS && noPrice <= MAX_ENTRY_ODDS) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.5 + (-edge) * 3),
          reason: `MC: P(DOWN)=${((1-upProb) * 100).toFixed(0)}% vs ${(noPrice * 100).toFixed(0)}¢ | ${deltaPct.toFixed(3)}%`,
        };
      }

      return {
        action: null,
        confidence: 0,
        reason: `MC: edge ${(Math.abs(edge) * 100).toFixed(1)}% vagy piac beárazva`
      };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #5 FAIR VALUE ARBITRAGE - Félreárazott piac kereső
  // ──────────────────────────────────────────────────────────
  fair_value: {
    name: "Fair Value Arb",
    description: "Piac félreárazást keres BTC delta vs Polymarket odds alapján",
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

      // Fair probability calculation based on BTC delta
      // delta < -0.10%: ~10% esély az UP-ra
      // delta = 0%: ~50%
      // delta > +0.10%: ~90% esély az UP-ra
      const fairUpProb = Math.min(0.97, Math.max(0.03, 0.5 + Math.tanh(deltaPct / 0.05) * 0.45));

      const marketYes = marketPrice.yesPrice;
      const edge = fairUpProb - marketYes;

      // OPTIMIZED: Raised minEdge from 0.10 to 0.15 for better selectivity
      const minEdge = 0.15;

      // KRITIKUS: Minimális entry odds - soha ne trade-elj 40¢ alatt!
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.55; // OPTIMIZED: Lowered from 0.60 to avoid overpaying

      if (edge > minEdge && marketYes >= MIN_ENTRY_ODDS && marketYes <= MAX_ENTRY_ODDS) {
        return {
          action: "YES",
          confidence: Math.min(0.85, 0.55 + edge * 2.5),
          reason: `Fair value: számított=${(fairUpProb * 100).toFixed(1)}% vs piac=${(marketYes * 100).toFixed(1)}¢`,
        };
      }

      if (-edge > minEdge && marketPrice.noPrice >= MIN_ENTRY_ODDS && marketPrice.noPrice <= MAX_ENTRY_ODDS) {
        const fairDownProb = 1 - fairUpProb;
        return {
          action: "NO",
          confidence: Math.min(0.85, 0.55 + (-edge) * 2.5),
          reason: `Fair value: számított DOWN=${(fairDownProb * 100).toFixed(1)}% vs piac=${(marketPrice.noPrice * 100).toFixed(1)}¢`,
        };
      }

      return {
        action: null,
        confidence: 0,
        reason: `Fair value: edge csak ${(Math.abs(edge) * 100).toFixed(1)}%`
      };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #6 MOMENTUM - Javított BTC momentum
  // ──────────────────────────────────────────────────────────
  momentum: {
    name: "BTC Momentum",
    description: "BTC valós idejű momentum alapján (nem Polymarket odds)",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.65;

      // BTC price change preferált (valós adat)
      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.0008) {
        const pct = btcPriceChange * 100;
        if (pct > 0.08) {
          const targetPrice = marketPrice.yesPrice;
          if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
            return { action: null, confidence: 0, reason: `YES ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
          }
          return {
            action: "YES",
            confidence: Math.min(0.78, 0.50 + pct * 5),
            reason: `BTC momentum +${pct.toFixed(3)}%`,
          };
        }
        if (pct < -0.08) {
          const targetPrice = marketPrice.noPrice;
          if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
            return { action: null, confidence: 0, reason: `NO ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
          }
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

      if (deltaPct > 0.08) {
        const targetPrice = marketPrice.yesPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `YES ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "YES",
          confidence: Math.min(0.70, 0.50 + deltaPct * 4),
          reason: `Window delta momentum +${deltaPct.toFixed(3)}%`
        };
      }
      if (deltaPct < -0.08) {
        const targetPrice = marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `NO ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "NO",
          confidence: Math.min(0.70, 0.50 + (-deltaPct) * 4),
          reason: `Window delta momentum ${deltaPct.toFixed(3)}%`
        };
      }

      return { action: null, confidence: 0, reason: "Nem elég BTC momentum" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #7 MEAN REVERSION - Átlag visszatérési stratégia
  // ──────────────────────────────────────────────────────────
  mean_reversion: {
    name: "Mean Reversion",
    description: "Extreme BTC elmozdulás után visszatérést vár",
    category: "mean_reversion",
    execute: (ctx) => {
      const { timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.70;

      // Extrém UP elmozdulás → NO (visszatérés várható)
      if (deltaPct > 0.20 && timeRemaining > 60000) {
        const targetPrice = marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `NO ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "NO",
          confidence: Math.min(0.68, 0.5 + (deltaPct - 0.20) * 2),
          reason: `Extrém UP ${deltaPct.toFixed(3)}% - visszatérés várható`,
        };
      }
      // Extrém DOWN elmozdulás → YES
      if (deltaPct < -0.20 && timeRemaining > 60000) {
        const targetPrice = marketPrice.yesPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `YES ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "YES",
          confidence: Math.min(0.68, 0.5 + (-deltaPct - 0.20) * 2),
          reason: `Extrém DOWN ${deltaPct.toFixed(3)}% - visszatérés várható`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs extrém elmozdulás" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #8 TREND - Többszintű trend megerősítés
  // ──────────────────────────────────────────────────────────
  trend: {
    name: "Multi-level Trend",
    description: "Rövid és hosszú távú trend megerősítés",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (priceHistory.length < 10 || timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-10, -3);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const trend = (recentAvg - olderAvg) / olderAvg;

      // BTC window delta is megerősíti?
      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const btcAligned = (trend > 0 && deltaPct > 0) || (trend < 0 && deltaPct < 0);

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.70;

      if (trend > 0.0008 && btcAligned) {
        const targetPrice = marketPrice.yesPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `YES ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "YES",
          confidence: Math.min(0.72, 0.50 + trend * 200),
          reason: `Trend UP: ${(trend * 100).toFixed(3)}% + BTC megerősítve`,
        };
      }
      if (trend < -0.0008 && btcAligned) {
        const targetPrice = marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `NO ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "NO",
          confidence: Math.min(0.72, 0.50 + (-trend) * 200),
          reason: `Trend DOWN: ${(trend * 100).toFixed(3)}% + BTC megerősítve`,
        };
      }

      if (!btcAligned && Math.abs(deltaPct) > 0.03) {
        return { action: null, confidence: 0, reason: "Trend és BTC ellentmondás" };
      }

      return { action: null, confidence: 0, reason: "Nincs egyértelmű trend" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #9 SMART TREND - Fejlett multi-timeframe trend
  // ──────────────────────────────────────────────────────────
  smart_trend: {
    name: "Smart Trend",
    description: "Multi-timeframe trend + BTC megerősítés",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (priceHistory.length < 15 || timeRemaining < 45000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const shortTerm = priceHistory.slice(-3);
      const mediumTerm = priceHistory.slice(-8);
      const longTerm = priceHistory.slice(-15);

      const shortAvg = shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length;
      const mediumAvg = mediumTerm.reduce((a, b) => a + b, 0) / mediumTerm.length;
      const longAvg = longTerm.reduce((a, b) => a + b, 0) / longTerm.length;

      const shortTrendUp = shortAvg > mediumAvg;
      const mediumTrendUp = mediumAvg > longAvg;

      // BTC megerősítés
      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const btcConfirmsUp = deltaPct > 0.08;
      const btcConfirmsDown = deltaPct < -0.08;

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.65;

      if (shortTrendUp && mediumTrendUp && btcConfirmsUp) {
        const targetPrice = marketPrice.yesPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `YES ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "YES",
          confidence: 0.72,
          reason: "Multi-timeframe bullish + BTC UP megerősítve",
        };
      }
      if (!shortTrendUp && !mediumTrendUp && btcConfirmsDown) {
        const targetPrice = marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `NO ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action: "NO",
          confidence: 0.72,
          reason: "Multi-timeframe bearish + BTC DOWN megerősítve",
        };
      }

      return { action: null, confidence: 0, reason: "Vegyes vagy BTC ellentmondó jelzések" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #10 CONTRARIAN - Ellentétes stratégia
  // ──────────────────────────────────────────────────────────
  contrarian: {
    name: "Contrarian",
    description: "BTC ellentmondás a piaci trenddel",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      if (!btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }

      const yesPrice = marketPrice.yesPrice;
      const noPrice = marketPrice.noPrice;
      const windowOpen = btcWindowOpen || btcPrice;
      const deltaPct = windowOpen > 0 ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // KRITIKUS: Minimális entry odds - soha ne trade-elj 40¢ alatt!
      const MIN_ENTRY_ODDS = 0.40;

      // EGYSZERŰSÍTETT: Ha BTC már mozdult, kövesd, még ha a piac mást is mutat
      // Ez nem igazi "contrarian" - inkább "BTC follower"

      // BTC UP de piac még alacsony YES ár → vedd YES-t (de min 40¢!)
      if (deltaPct > 0.05 && yesPrice >= MIN_ENTRY_ODDS && yesPrice < 0.60) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.55 + deltaPct * 3),
          reason: `BTC +${deltaPct.toFixed(3)}% de YES csak ${(yesPrice * 100).toFixed(0)}¢ → követés`,
        };
      }

      // BTC DOWN de piac még alacsony NO ár → vedd NO-t (de min 40¢!)
      if (deltaPct < -0.05 && noPrice >= MIN_ENTRY_ODDS && noPrice < 0.60) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.55 + (-deltaPct) * 3),
          reason: `BTC ${deltaPct.toFixed(3)}% de NO csak ${(noPrice * 100).toFixed(0)}¢ → követés`,
        };
      }

      // Igazi contrarian: extrém piac de BTC ellentmond (ritka)
      if (yesPrice > 0.80 && deltaPct < -0.05) {
        return {
          action: "NO",
          confidence: Math.min(0.75, 0.55 + (yesPrice - 0.70) * 3),
          reason: `Contrarian: piac ${(yesPrice * 100).toFixed(0)}¢ YES de BTC le ${deltaPct.toFixed(3)}%`,
        };
      }
      if (noPrice > 0.80 && deltaPct > 0.05) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.55 + (noPrice - 0.70) * 3),
          reason: `Contrarian: piac ${(noPrice * 100).toFixed(0)}¢ NO de BTC fel +${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs contrarian jelzés" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #11-17: További stratégiák
  // ──────────────────────────────────────────────────────────

  volatility: {
    name: "Volatility Breakout",
    description: "Volatilitás kitörés kereskedés",
    category: "momentum",
    execute: (ctx) => {
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (priceHistory.length < 20 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.70;

      if (Math.abs(deltaPct) > 0.08) {
        const action = deltaPct > 0 ? "YES" : "NO";
        const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `${action} ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
        }
        return {
          action,
          confidence: Math.min(0.72, 0.5 + Math.abs(deltaPct) * 3),
          reason: `Volatilitás kitörés: ${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs kitörés" };
    },
  },

  anomaly: {
    name: "Anomaly",
    description: "Árképzési anomáliák keresése",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel" };
      }

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;

      const sum = marketPrice.yesPrice + marketPrice.noPrice;
      if (sum < 0.96) {
        const action = marketPrice.yesPrice < marketPrice.noPrice ? "YES" : "NO";
        const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
        if (targetPrice < MIN_ENTRY_ODDS) {
          return { action: null, confidence: 0, reason: `${action} ár ${(targetPrice * 100).toFixed(0)}¢ túl alacsony (nagy kockázat)` };
        }
        return {
          action,
          confidence: Math.min(0.80, (1 - sum) * 15),
          reason: `Anomália: YES+NO=${(sum * 100).toFixed(1)}¢ < 100¢`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs anomália" };
    },
  },

  momentum_burst: {
    name: "Momentum Burst",
    description: "Hirtelen BTC mozgások elkapása",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen, marketPrice } = ctx;

      if (timeRemaining < 20000) {
        return { action: null, confidence: 0, reason: "Nincs elég idő" };
      }

      // KRITIKUS: Minimális entry odds ellenőrzés
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.70;

      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.001) {
        const pct = btcPriceChange * 100;
        const windowOpen = btcWindowOpen || btcPrice || 0;
        const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
        const aligned = (pct > 0 && deltaPct > 0) || (pct < 0 && deltaPct < 0);

        if (aligned) {
          const action = pct > 0 ? "YES" : "NO";
          const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
          if (targetPrice < MIN_ENTRY_ODDS || targetPrice > MAX_ENTRY_ODDS) {
            return { action: null, confidence: 0, reason: `${action} ár ${(targetPrice * 100).toFixed(0)}¢ kívül esik a biztonságos tartományon` };
          }
          return {
            action,
            confidence: Math.min(0.78, 0.5 + Math.abs(pct) * 30),
            reason: `Momentum burst: ${pct.toFixed(4)}% + delta megerősítve`,
          };
        }
      }

      return { action: null, confidence: 0, reason: "Nincs momentum burst" };
    },
  },

  grid_trading: {
    name: "Grid Trading (paused)",
    description: "Grid szinteken kereskedik — nem optimális 5-perces piacokon",
    category: "other",
    execute: () => {
      // Grid trading szüneteltetve — 5-perces piacokon nincs elegendő
      // ár mozgást ahhoz, hogy a grid szintek profitábilisak legyenek
      return { action: null, confidence: 0, reason: "Grid trading szüneteltetve (5m piacon nem optimális)" };
    },
  },

  market_making: {
    name: "Market Making (paused)",
    description: "Likviditás biztosítás spread-ből — nem profitábilis 5-perces piacokon",
    category: "arbitrage",
    execute: () => {
      // Market making stratégia szüneteltetve — 5-perces piacokon
      // nem termel elegendő spread-et a fee-k fedezéséhez
      return { action: null, confidence: 0, reason: "Market making szüneteltetve (5m piacon nem profitábilis)" };
    },
  },

  arbitrage: {
    name: "Arbitrage",
    description: "BTC delta vs piac ár különbség kihasználása",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, btcPrice, btcWindowOpen } = ctx;

      // Csak az első 4 percben aktív
      if (timeRemaining < 30000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Nem aktív időszak" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
      const yesPrice = marketPrice.yesPrice;
      const noPrice = marketPrice.noPrice;

      // Ha a delta nem egyértelmű, ne kereskedj
      if (Math.abs(deltaPct) < 0.03) {
        return { action: null, confidence: 0, reason: `Delta nem egyértelmű: ${deltaPct.toFixed(3)}%` };
      }

      // Számítsd ki a "fair" értéket a delta alapján
      const fairProb = Math.min(0.95, Math.max(0.05, 0.5 + deltaPct * 3.5));
      const edge = fairProb - yesPrice;

      // KRITIKUS: Minimális entry odds - soha ne trade-elj 40¢ alatt!
      const MIN_ENTRY_ODDS = 0.40;
      const MAX_ENTRY_ODDS = 0.65;

      // Csak akkor ha van edge ÉS a piac még nem árazta be
      if (edge > 0.08 && yesPrice >= MIN_ENTRY_ODDS && yesPrice <= MAX_ENTRY_ODDS) {
        return {
          action: "YES",
          confidence: Math.min(0.78, 0.5 + edge * 3),
          reason: `Arb: fair=${(fairProb * 100).toFixed(0)}% vs piac=${(yesPrice * 100).toFixed(0)}¢ | delta +${deltaPct.toFixed(3)}%`,
        };
      }

      if (-edge > 0.08 && noPrice >= MIN_ENTRY_ODDS && noPrice <= MAX_ENTRY_ODDS) {
        return {
          action: "NO",
          confidence: Math.min(0.78, 0.5 + (-edge) * 3),
          reason: `Arb: fair DOWN=${((1-fairProb) * 100).toFixed(0)}% vs piac=${(noPrice * 100).toFixed(0)}¢ | delta ${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: `Arb: nincs elegendő edge vagy piac beárazva` };
    },
  },

  random: {
    name: "Random",
    description: "Véletlen kereskedés (baseline teszteléshez)",
    category: "other",
    execute: () => ({
      action: Math.random() > 0.5 ? "YES" : "NO",
      confidence: 0.5,
      reason: "Véletlen döntés",
    }),
  },
};
