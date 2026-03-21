// Unified Bot Manager - Manages trading bots with various strategies
// Implements isolated portfolios and session tracking

import type {
  BotConfig,
  BotSession,
  StrategyType,
  StrategyContext,
  Strategy,
  Outcome,
} from "../types";
import { marketEngine } from "./market-engine";
import { dbService } from "./database";
import { generateId, clamp } from "./utils";
import { binanceKlineProvider } from "./providers/binance-kline-provider";
import { priceService } from "./price";
import { riskManager } from "./risk-manager";
import { strategyCoordinator } from "./strategy-coordinator";
import { parameterOptimizer } from "./parameter-optimizer";

// Debug mode - set to true to enable verbose logging
const DEBUG_STRATEGIES = true;

function debugLog(strategy: string, message: string, data?: Record<string, unknown>) {
  if (DEBUG_STRATEGIES) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[${timestamp}][${strategy}] ${message}`, data ? JSON.stringify(data) : '');
  }
}

// === Strategy Implementations ===
// Improved strategies based on research: Window Delta, Oracle Lag, Monte Carlo
// Key insight: BTC price relative to window open is the best predictor, not YES/NO price history

const strategies: Record<StrategyType, Strategy> = {

  // ──────────────────────────────────────────────────────────
  // #1 WINDOW_DELTA - Legfontosabb stratégia
  // Az ablakon belüli BTC elmozdulás alapján kereskedik
  // Bizonyítottan a legjobb megközelítés 5-perces piacokon
  // ──────────────────────────────────────────────────────────
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

      // ERŐS jel: delta > 0.15% (emelve 0.12%-ról a megbízhatóságért)
      if (deltaPct > 0.15) {
        const conf = Math.min(0.92, 0.72 + (deltaPct - 0.15) * 2.5);
        debugLog('WindowDelta', '✅ ERŐS UP jel', { action: 'YES', confidence: conf.toFixed(2) });
        return {
          action: "YES",
          confidence: conf,
          reason: `Erős UP delta: +${deltaPct.toFixed(3)}% az ablakon belül`
        };
      }
      if (deltaPct < -0.15) {
        const conf = Math.min(0.92, 0.72 + (-deltaPct - 0.15) * 2.5);
        debugLog('WindowDelta', '✅ ERŐS DOWN jel', { action: 'NO', confidence: conf.toFixed(2) });
        return {
          action: "NO",
          confidence: conf,
          reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}% az ablakon belül`
        };
      }

      // KÖZEPES jel: delta > 0.09% (emelve 0.07%-ról — kevesebb, jobb trade)
      if (deltaPct > 0.09) {
        const conf = 0.56 + (deltaPct - 0.09) * 3;
        debugLog('WindowDelta', '⚠️ KÖZEPES UP jel', { action: 'YES', confidence: conf.toFixed(2) });
        return {
          action: "YES",
          confidence: Math.min(0.78, conf),
          reason: `UP delta: +${deltaPct.toFixed(3)}%`
        };
      }
      if (deltaPct < -0.09) {
        const conf = 0.56 + (-deltaPct - 0.09) * 3;
        debugLog('WindowDelta', '⚠️ KÖZEPES DOWN jel', { action: 'NO', confidence: conf.toFixed(2) });
        return {
          action: "NO",
          confidence: Math.min(0.78, conf),
          reason: `DOWN delta: ${deltaPct.toFixed(3)}%`
        };
      }

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

      // Ha a piac már 80%+ feletti, nem éri meg
      if (marketImplied > 0.82) {
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

      // KRITIKUS: Ellenőrizd az árat - SOHA ne vegyél 68¢ felett!
      // A 2% fee miatt 68¢ felett már -EV a trade (csökkentve 72-ről)
      const targetPrice = action === "YES" ? marketPrice.yesPrice : marketPrice.noPrice;
      const MAX_BUY_PRICE = 0.68;

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
      const minEdge = 0.08;

      if (edge > minEdge && yesPrice < 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.5 + edge * 3),
          reason: `MC: P(UP)=${(upProb * 100).toFixed(0)}% vs ${(yesPrice * 100).toFixed(0)}¢ | +${deltaPct.toFixed(3)}%`,
        };
      }

      if (-edge > minEdge && noPrice < 0.70) {
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

      const minEdge = 0.10; // Emelve 0.07-ről — csak erősebb edge-nél kereskedj

      if (edge > minEdge && marketYes < 0.65) {
        return {
          action: "YES",
          confidence: Math.min(0.82, 0.5 + edge * 2.5),
          reason: `Fair value: számított=${(fairUpProb * 100).toFixed(1)}% vs piac=${(marketYes * 100).toFixed(1)}¢`,
        };
      }

      if (-edge > minEdge && marketPrice.noPrice < 0.65) {
        const fairDownProb = 1 - fairUpProb;
        return {
          action: "NO",
          confidence: Math.min(0.82, 0.5 + (-edge) * 2.5),
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
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      // BTC price change preferált (valós adat)
      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.0005) {
        const pct = btcPriceChange * 100;
        if (pct > 0.05) {
          return {
            action: "YES",
            confidence: Math.min(0.78, 0.50 + pct * 5),
            reason: `BTC momentum +${pct.toFixed(3)}%`,
          };
        }
        if (pct < -0.05) {
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

      if (deltaPct > 0.05) {
        return {
          action: "YES",
          confidence: Math.min(0.70, 0.50 + deltaPct * 4),
          reason: `Window delta momentum +${deltaPct.toFixed(3)}%`
        };
      }
      if (deltaPct < -0.05) {
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
      const { timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      // Extrém UP elmozdulás → NO (visszatérés várható)
      if (deltaPct > 0.20 && timeRemaining > 60000) {
        return {
          action: "NO",
          confidence: Math.min(0.68, 0.5 + (deltaPct - 0.20) * 2),
          reason: `Extrém UP ${deltaPct.toFixed(3)}% - visszatérés várható`,
        };
      }
      // Extrém DOWN elmozdulás → YES
      if (deltaPct < -0.20 && timeRemaining > 60000) {
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
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen } = ctx;

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

      if (trend > 0.0008 && btcAligned) {
        return {
          action: "YES",
          confidence: Math.min(0.72, 0.50 + trend * 200),
          reason: `Trend UP: ${(trend * 100).toFixed(3)}% + BTC megerősítve`,
        };
      }
      if (trend < -0.0008 && btcAligned) {
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
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen } = ctx;

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
      const btcConfirmsUp = deltaPct > 0.02;
      const btcConfirmsDown = deltaPct < -0.02;

      if (shortTrendUp && mediumTrendUp && btcConfirmsUp) {
        return {
          action: "YES",
          confidence: 0.72,
          reason: "Multi-timeframe bullish + BTC UP megerősítve",
        };
      }
      if (!shortTrendUp && !mediumTrendUp && btcConfirmsDown) {
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

      // EGYSZERŰSÍTETT: Ha BTC már mozdult, kövesd, még ha a piac mást is mutat
      // Ez nem igazi "contrarian" - inkább "BTC follower"

      // BTC UP de piac még alacsony YES ár → vedd YES-t
      if (deltaPct > 0.05 && yesPrice < 0.60) {
        return {
          action: "YES",
          confidence: Math.min(0.75, 0.55 + deltaPct * 3),
          reason: `BTC +${deltaPct.toFixed(3)}% de YES csak ${(yesPrice * 100).toFixed(0)}¢ → követés`,
        };
      }

      // BTC DOWN de piac még alacsony NO ár → vedd NO-t
      if (deltaPct < -0.05 && noPrice < 0.60) {
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
      const { priceHistory, timeRemaining, btcPrice, btcWindowOpen } = ctx;

      if (priceHistory.length < 20 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const windowOpen = btcWindowOpen || btcPrice || 0;
      const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;

      if (Math.abs(deltaPct) > 0.08) {
        const action = deltaPct > 0 ? "YES" : "NO";
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

      const sum = marketPrice.yesPrice + marketPrice.noPrice;
      if (sum < 0.96) {
        const action = marketPrice.yesPrice < marketPrice.noPrice ? "YES" : "NO";
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
      const { timeRemaining, btcPriceChange, btcPrice, btcWindowOpen } = ctx;

      if (timeRemaining < 20000) {
        return { action: null, confidence: 0, reason: "Nincs elég idő" };
      }

      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.001) {
        const pct = btcPriceChange * 100;
        const windowOpen = btcWindowOpen || btcPrice || 0;
        const deltaPct = windowOpen > 0 && btcPrice ? ((btcPrice - windowOpen) / windowOpen) * 100 : 0;
        const aligned = (pct > 0 && deltaPct > 0) || (pct < 0 && deltaPct < 0);

        if (aligned) {
          return {
            action: pct > 0 ? "YES" : "NO",
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

      // Csak akkor ha van edge ÉS a piac még nem árazta be
      if (edge > 0.06 && yesPrice < 0.70) {
        return {
          action: "YES",
          confidence: Math.min(0.78, 0.5 + edge * 3),
          reason: `Arb: fair=${(fairProb * 100).toFixed(0)}% vs piac=${(yesPrice * 100).toFixed(0)}¢ | delta +${deltaPct.toFixed(3)}%`,
        };
      }

      if (-edge > 0.06 && noPrice < 0.70) {
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

// === Bot Manager ===

export interface BotManagerConfig {
  maxBots?: number;
  defaultInterval?: number;
}

export interface BotLog {
  id: string;
  botId: string;
  botName: string;
  type: "START" | "STOP" | "TRADE" | "DECISION" | "ERROR" | "RISK" | "COMPETITION" | "COORD";
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface CompetitionState {
  active: boolean;
  startTime: number;
  minTrades: number;
  startBalance: number;
  leaderboard: Array<{
    botId: string;
    botName: string;
    strategy: string;
    rank: number;
    trades: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    pnl: number;
    roi: number;
    balance: number;
  }>;
  winner: string | null;
  completedAt: number | null;
  config: {
    minTrades: number;
    duration: number | null; // null = no time limit
    startBalance: number;
  };
}

export class BotManager {
  private bots: Map<string, BotConfig> = new Map();
  private intervals: Map<string, Timer> = new Map();
  private sessions: BotSession[] = [];
  private currentSessions: Map<string, BotSession> = new Map();
  private config: Required<BotManagerConfig>;
  private logs: BotLog[] = [];
  private logListeners: Array<(log: BotLog) => void> = [];
  private competition: CompetitionState = {
    active: false,
    startTime: 0,
    minTrades: 50,
    startBalance: 10,
    leaderboard: [],
    winner: null,
    completedAt: null,
    config: {
      minTrades: 50,
      duration: null,
      startBalance: 10,
    },
  };

  constructor(config: BotManagerConfig = {}) {
    this.config = {
      maxBots: config.maxBots ?? 20,
      defaultInterval: config.defaultInterval ?? 5000,
    };

    this.initDefaultBots();
  }

  /** Add a log entry */
  private addLog(botId: string, type: BotLog["type"], message: string, details?: Record<string, unknown>): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const log: BotLog = {
      id: generateId("log"),
      botId,
      botName: bot.name,
      type,
      message,
      details,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    if (this.logs.length > 100) {
      this.logs.pop();
    }

    // Notify listeners
    for (const listener of this.logListeners) {
      try {
        listener(log);
      } catch (e) {
        console.error("[BotManager] Log listener error:", e);
      }
    }

    console.log(`[BotManager] ${bot.name}: ${message}`);
  }

  /** Subscribe to log updates */
  onLog(callback: (log: BotLog) => void): () => void {
    this.logListeners.push(callback);
    return () => {
      const index = this.logListeners.indexOf(callback);
      if (index > -1) {
        this.logListeners.splice(index, 1);
      }
    };
  }

  /** Get all logs */
  getLogs(limit = 50): BotLog[] {
    return this.logs.slice(0, limit);
  }

  /** Clear logs */
  clearLogs(): void {
    this.logs = [];
  }

  private initDefaultBots(): void {
    const defaultConfigs: Array<Partial<BotConfig> & { id: string; name: string; strategy: StrategyType }> = [
      // === PRIMARY BOTS - These are the winners based on research ===
      // maxBet is a PERCENTAGE of bankroll (e.g., 0.20 = 20% max)
      // kellyFraction reduced to ~0.35 (quarter-Kelly approach for stability)
      { id: "bot-window-delta", name: "Window Delta", strategy: "window_delta", interval: 2000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-sniper", name: "T-10 Sniper", strategy: "last_seconds_scalp", interval: 300, betSize: 1.0, maxBet: 0.15, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-oracle-lag", name: "Oracle Lag", strategy: "binance_signal", interval: 1000, betSize: 1.0, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-monte-carlo", name: "Monte Carlo", strategy: "monte_carlo", interval: 5000, betSize: 0.5, maxBet: 0.12, useKelly: false, kellyFraction: 0.25 },
      { id: "bot-fair-value", name: "Fair Value Arb", strategy: "fair_value", interval: 3000, betSize: 0.75, maxBet: 0.20, useKelly: true, kellyFraction: 0.35 },

      // === SECONDARY BOTS - Complementary strategies ===
      { id: "bot-momentum", name: "BTC Momentum", strategy: "momentum", interval: 4000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-smart-trend", name: "Smart Trend", strategy: "smart_trend", interval: 8000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-contrarian", name: "Contrarian", strategy: "contrarian", interval: 6000, betSize: 0.5, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      { id: "bot-arbitrage", name: "Arbitrage", strategy: "arbitrage", interval: 5000, betSize: 0.75, maxBet: 0.15, useKelly: true, kellyFraction: 0.35 },
      // grid_trading, market_making, random removed from defaults — not profitable on 5m
    ];

    for (const cfg of defaultConfigs) {
      this.createBot({
        id: cfg.id,
        name: cfg.name,
        strategy: cfg.strategy,
        type: cfg.strategy,
        enabled: false,
        interval: cfg.interval ?? this.config.defaultInterval,
        betSize: cfg.betSize ?? 0.5,
        useKelly: cfg.useKelly ?? false,
        kellyFraction: cfg.kellyFraction ?? 0.25,
        maxBet: cfg.maxBet ?? 0.25, // Percentage of bankroll (default 25%)
        stopLoss: 0.1,
        takeProfit: 0.2,
        maxPositions: 999, // No practical limit - let strategies trade freely
        stats: {
          trades: 0,
          wins: 0,
          losses: 0,
          pnl: 0,
          winRate: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          maxConsecutiveWins: 0,
          maxConsecutiveLosses: 0,
        },
        runTime: 0,
        portfolio: marketEngine.getBotPortfolio(cfg.id),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  createBot(config: BotConfig): BotConfig {
    if (this.bots.size >= this.config.maxBots) {
      throw new Error("Maximum number of bots reached");
    }

    marketEngine.initBotPortfolio(config.id);

    const bot: BotConfig = {
      ...config,
      portfolio: marketEngine.getBotPortfolio(config.id),
      updatedAt: Date.now(),
    };

    this.bots.set(config.id, bot);

    return bot;
  }

  getBots(): BotConfig[] {
    return Array.from(this.bots.values()).map((bot) => {
      const portfolio = marketEngine.getBotPortfolio(bot.id);
      this.syncStatsFromPortfolio(bot.id);
      return {
        ...bot,
        portfolio,
        stats: { ...bot.stats },
      };
    });
  }

  /** Recompute bot stats from settled portfolio positions (source of truth) */
  private syncStatsFromPortfolio(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const portfolio = marketEngine.getBotPortfolio(botId);
    const closedPositions = portfolio.closedPositions || [];

    bot.stats.trades = portfolio.totalTrades;
    bot.stats.wins = portfolio.winningTrades;
    bot.stats.losses = portfolio.losingTrades;
    bot.stats.pnl = portfolio.totalPnL;
    bot.stats.winRate = portfolio.winRate;

    // Recompute avgWin/avgLoss from closed positions
    const wins = closedPositions.filter(p => (p.pnl || 0) > 0);
    const losses = closedPositions.filter(p => (p.pnl || 0) <= 0 && p.pnl !== null);

    bot.stats.avgWin = wins.length > 0
      ? wins.reduce((s, p) => s + (p.pnl || 0), 0) / wins.length
      : 0;
    bot.stats.avgLoss = losses.length > 0
      ? Math.abs(losses.reduce((s, p) => s + (p.pnl || 0), 0) / losses.length)
      : 0;

    // Profit factor = gross profit / gross loss
    const grossProfit = wins.reduce((s, p) => s + (p.pnl || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + (p.pnl || 0), 0));
    bot.stats.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // Consecutive wins/losses
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    for (const pos of closedPositions) {
      if ((pos.pnl || 0) > 0) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
      }
    }
    bot.stats.maxConsecutiveWins = maxWinStreak;
    bot.stats.maxConsecutiveLosses = maxLossStreak;

    if (closedPositions.length > 0) {
      bot.stats.lastTradeTime = closedPositions[0].exitTime || closedPositions[0].timestamp;
    }

    this.bots.set(botId, bot);
  }

  getBot(id: string): BotConfig | undefined {
    const bot = this.bots.get(id);
    if (!bot) return undefined;
    return {
      ...bot,
      portfolio: marketEngine.getBotPortfolio(id),
    };
  }

  toggleBot(id: string): BotConfig | null {
    const bot = this.bots.get(id);
    if (!bot) return null;

    const newEnabled = !bot.enabled;
    bot.enabled = newEnabled;

    if (newEnabled) {
      this.startBot(id);
    } else {
      this.stopBot(id);
    }

    // Ensure the bot state is saved
    this.bots.set(id, bot);

    console.log(`[BotManager] Bot ${id} toggled to ${newEnabled ? 'enabled' : 'disabled'}`);

    return { ...bot, portfolio: marketEngine.getBotPortfolio(id) };
  }

  private startBot(id: string): void {
    const bot = this.bots.get(id);
    if (!bot) return;

    // Clear existing interval
    this.stopBot(id);

    // Apply optimized parameters if available
    const optimizedParams = parameterOptimizer.getOptimizedParameters(
      bot.strategy,
      {
        betSize: bot.betSize,
        interval: bot.interval,
        kellyFraction: bot.kellyFraction,
        maxBet: bot.maxBet,
        stopLoss: bot.stopLoss,
        takeProfit: bot.takeProfit,
      }
    );

    // Update bot with optimized parameters (with small randomization for exploration)
    if (bot.useKelly || bot.useKelly === undefined) {
      bot.betSize = optimizedParams.betSize;
      bot.interval = Math.round(optimizedParams.interval);
      bot.kellyFraction = optimizedParams.kellyFraction;
      bot.maxBet = optimizedParams.maxBet;
    }

    // Start session
    const portfolio = marketEngine.getBotPortfolio(id);
    const market = marketEngine.getCurrentMarket();
    const session: BotSession = {
      id: generateId("session"),
      botId: id,
      botName: bot.name,
      strategy: bot.strategy,
      startTime: Date.now(),
      endTime: null,
      startBalance: portfolio.balance,
      endBalance: null,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalPnL: 0,
      status: "running",
    };
    this.currentSessions.set(id, session);

    // Log bot start
    this.addLog(id, "START", `Bot started - Strategy: ${bot.strategy}, Interval: ${bot.interval}ms`, {
      strategy: bot.strategy,
      interval: bot.interval,
      betSize: bot.betSize,
      useKelly: bot.useKelly,
      marketId: market?.id,
      marketQuestion: market?.question,
    });

    // Start execution loop
    const intervalId = setInterval(() => {
      this.executeBotStrategy(id);
    }, bot.interval);

    this.intervals.set(id, intervalId);
    bot.runTime = Date.now();
  }

  private stopBot(id: string): void {
    const intervalId = this.intervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(id);
    }

    // Complete session
    const session = this.currentSessions.get(id);
    if (session) {
      const portfolio = marketEngine.getBotPortfolio(id);
      const bot = this.bots.get(id);

      session.endTime = Date.now();
      session.endBalance = portfolio.balance;
      session.totalPnL = portfolio.totalPnL;
      session.totalTrades = portfolio.totalTrades;
      session.winningTrades = portfolio.winningTrades;
      session.losingTrades = portfolio.losingTrades;
      session.status = "completed";

      // Log bot stop
      const runtime = Date.now() - session.startTime;
      this.addLog(id, "STOP", `Bot stopped - Runtime: ${Math.floor(runtime / 1000)}s, P&L: $${portfolio.totalPnL.toFixed(2)}, Trades: ${portfolio.totalTrades}`, {
        runtime,
        totalPnL: portfolio.totalPnL,
        totalTrades: portfolio.totalTrades,
        winRate: portfolio.winRate,
        endBalance: portfolio.balance,
      });

      this.sessions.unshift(session);
      this.currentSessions.delete(id);

      // Keep only last 100 sessions
      if (this.sessions.length > 100) {
        this.sessions.pop();
      }

      // Save to database
      this.saveBotSessionToDB(session, bot);

      // Record performance for parameter optimization
      if (bot && portfolio.totalTrades >= 5) {
        parameterOptimizer.recordPerformance(
          bot.strategy,
          id,
          {
            betSize: bot.betSize,
            interval: bot.interval,
            kellyFraction: bot.kellyFraction,
            maxBet: bot.maxBet,
            stopLoss: bot.stopLoss,
            takeProfit: bot.takeProfit,
          },
          {
            trades: portfolio.totalTrades,
            wins: portfolio.winningTrades,
            pnl: portfolio.totalPnL,
            sharpeRatio: portfolio.sharpeRatio,
            maxDrawdown: portfolio.maxDrawdown,
          }
        );
      }
    }

    // Only clear runTime - do NOT clear enabled flag as it may be set by caller
    const bot = this.bots.get(id);
    if (bot) {
      bot.runTime = 0;
      this.bots.set(id, bot);
    }
  }

  private saveBotSessionToDB(session: BotSession, _bot?: BotConfig | null): void {
    dbService.saveBotSession({
      id: session.id,
      botId: session.botId,
      botName: session.botName,
      strategy: session.strategy,
      startTime: session.startTime,
      endTime: session.endTime,
      startBalance: session.startBalance,
      endBalance: session.endBalance,
      totalTrades: session.totalTrades,
      winningTrades: session.winningTrades,
      losingTrades: session.losingTrades,
      totalPnL: session.totalPnL,
      status: session.status,
      maxDrawdown: 0,
      sharpeRatio: 0,
    }).catch((e) => console.error("[BotManager] DB save error:", e));
  }

  private executeBotStrategy(id: string): void {
    const bot = this.bots.get(id);
    if (!bot || !bot.enabled) return;

    // Risk check: Is bot paused?
    if (riskManager.shouldPause(id)) {
      const status = riskManager.getBotRiskStatus(id);
      if (status.paused && status.pauseReason) {
        this.addLog(id, "RISK", `Bot paused: ${status.pauseReason}`);
      }
      return;
    }

    const market = marketEngine.getCurrentMarket();
    if (!market || market.status !== "active") return;

    const strategy = strategies[bot.strategy];
    if (!strategy) return;

    // Build context from Polymarket odds data (NOT BTC price)
    const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
    const yesPriceHistory = market.yesPriceHistory || [];
    const priceHistory = yesPriceHistory.map((p) => p.price);
    const timeRemaining = marketEngine.getTimeRemaining();
    const totalDuration = market.endTime - market.startTime;

    // Calculate volatility from YES price changes
    let volatility = 0;
    if (priceHistory.length >= 5) {
      const changes: number[] = [];
      for (let i = 1; i < priceHistory.length; i++) {
        changes.push(Math.abs(priceHistory[i] - priceHistory[i - 1]));
      }
      volatility = changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    // Calculate momentum from YES price trend
    let momentum = 0;
    if (priceHistory.length >= 3) {
      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-6, -3);
      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        momentum = recentAvg - olderAvg;
      }
    }

    // Get Binance signal data for predictive strategies
    const lastSignal = binanceKlineProvider.getLastSignal();
    const binanceSignal = lastSignal ? {
      type: lastSignal.type,
      changePercent: lastSignal.changePercent,
      confidence: lastSignal.confidence,
      timestamp: lastSignal.timestamp,
      predictedOutcome: lastSignal.predictedOutcome,
    } : undefined;

    // Get BTC price and change
    const btcPrice = priceService.getPrice();
    const btcHistory = priceService.getPriceHistory(200);
    const btcPriceHistory = btcHistory.slice(-20).map(p => p.price);
    const btcPriceChange = btcHistory.length >= 2
      ? (btcPrice - btcHistory[0].price) / btcHistory[0].price
      : 0;

    // Calculate BTC window open price - the BTC price when the market window opened
    let btcWindowOpen = btcPrice; // default: current price
    if (btcHistory.length > 0 && market.startTime) {
      // Find the BTC price closest to the market start time
      const windowOpenTime = market.startTime;
      const closest = btcHistory.reduce((prev, curr) =>
        Math.abs(curr.timestamp - windowOpenTime) < Math.abs(prev.timestamp - windowOpenTime)
        ? curr : prev
      );
      btcWindowOpen = closest.price;
    }

    const context: StrategyContext = {
      currentPrice: yesPrice,
      startPrice: market.startPrice || 0.5,
      priceHistory,
      timeRemaining,
      marketDuration: totalDuration,
      marketPrice: { yesPrice, noPrice },
      volatility,
      momentum,
      binanceSignal,
      btcPrice,
      btcPriceChange,
      btcWindowOpen,
      btcPriceHistory,
    };

    const decision = strategy.execute(context);

    // Log decision even if no action
    if (!decision.action) {
      // Only log occasionally to avoid spam (every 10th check)
      if (Math.random() < 0.1) {
        this.addLog(id, "DECISION", `No trade - ${decision.reason}`, {
          yesPrice,
          noPrice,
          timeRemaining,
          confidence: decision.confidence,
        });
      }
      return;
    }

    // Check if bot already has an open position on this market - one position per market
    const existingPositions = marketEngine.getOpenPositions(id);
    const hasPositionOnMarket = existingPositions.some(p => p.marketId === market.id);
    if (hasPositionOnMarket) {
      // Already have a position on this market, skip
      return;
    }

    // Log the decision to trade
    this.addLog(id, "DECISION", `Trade decision: ${decision.action} - ${decision.reason}`, {
      action: decision.action,
      confidence: decision.confidence,
      reason: decision.reason,
      yesPrice,
      noPrice,
      timeRemaining,
      volatility: volatility.toFixed(4),
      momentum: momentum.toFixed(4),
      btcPriceChange: (btcPriceChange * 100).toFixed(3) + '%',
    });

    // Calculate bet size
    let betSize = bot.betSize;

    // Kelly criterion for position sizing
    // f* = (p*b - q) / b where p=win prob, q=loss prob, b=net odds
    // For prediction markets: if betting YES at price P, you win (1-P)/P per unit bet
    if (bot.useKelly || bot.useKelly === undefined) {
      const portfolio = marketEngine.getBotPortfolio(id);

      // Use historical win rate if available, otherwise use price-based probability
      const botStats = bot.stats;
      const winProbability = botStats.trades >= 5
        ? botStats.winRate
        : (decision.action === "YES" ? 1 - yesPrice : 1 - noPrice);

      // Net odds: amount won per unit bet
      // If YES at 0.60, you pay 0.60 to win 1.00, so net odds = (1-0.60)/0.60 = 0.67
      // If NO at 0.40, you pay 0.40 to win 1.00, so net odds = (1-0.40)/0.40 = 1.5
      const price = decision.action === "YES" ? yesPrice : noPrice;
      const netOdds = (1 - price) / price;

      // Kelly formula: f* = (p*b - q) / b
      // where p = winProbability, q = 1 - p, b = netOdds
      const q = 1 - winProbability;
      const kellyFraction = (winProbability * netOdds - q) / netOdds;

      // Apply half-Kelly (more conservative) and user's kelly fraction
      const halfKelly = Math.max(0, kellyFraction * 0.5 * (bot.kellyFraction || 0.5));

      // Calculate bet size
      const kellyBet = portfolio.balance * halfKelly;

      // maxBet is now a PERCENTAGE of bankroll (e.g., 0.25 = 25% max)
      const maxBetPercent = bot.maxBet || 0.25; // Default 25% of bankroll
      const maxBetAmount = portfolio.balance * maxBetPercent;

      // Cap at maxBet percentage of bankroll
      betSize = Math.min(kellyBet, maxBetAmount);
      betSize = Math.max(1, betSize); // Minimum $1 bet

      // Log Kelly calculation for transparency
      if (kellyBet > 0) {
        console.log(`[BotManager] Kelly: ${bot.name} | WinProb: ${(winProbability * 100).toFixed(1)}% | Odds: ${netOdds.toFixed(2)} | Fraction: ${(halfKelly * 100).toFixed(1)}% | Balance: $${portfolio.balance.toFixed(2)} | MaxBet: $${maxBetAmount.toFixed(2)} | Bet: $${betSize.toFixed(2)}`);
      }
    } else {
      // No Kelly - use percentage-based bet sizing
      const portfolio = marketEngine.getBotPortfolio(id);
      const maxBetPercent = bot.maxBet || 0.25;
      const maxBetAmount = portfolio.balance * maxBetPercent;
      betSize = Math.min(bot.betSize, maxBetAmount);
      betSize = Math.max(1, betSize);
    }

    // Adjust bet size based on confidence
    betSize = betSize * (0.5 + decision.confidence * 0.5);
    betSize = Math.max(1, betSize); // Minimum $1 bet (after confidence adjustment)

    const portfolio = marketEngine.getBotPortfolio(id);

    // Risk check: Can open position?
    const riskCheck = riskManager.canOpenPosition(id, betSize, decision.confidence);
    if (!riskCheck.allowed) {
      this.addLog(id, "RISK", `Trade blocked: ${riskCheck.reason}`, {
        betSize,
        confidence: decision.confidence,
      });
      return;
    }

    // Coordinator check: Prevent conflicting trades between bots
    const totalBalance = Array.from(this.bots.values())
      .reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
    const coordination = strategyCoordinator.registerDecision(
      market.id,
      {
        botId: id,
        botName: bot.name,
        strategy: bot.strategy,
        action: decision.action,
        confidence: decision.confidence,
        betSize,
      },
      totalBalance
    );

    if (!coordination.allowed) {
      this.addLog(id, "COORD", `Trade blocked by coordinator: ${coordination.reason}`, {
        action: decision.action,
        betSize,
        reason: coordination.reason,
      });
      return;
    }

    // Log coordinator warnings
    if (coordination.warnings && coordination.warnings.length > 0) {
      this.addLog(id, "COORD", `Warnings: ${coordination.warnings.join("; ")}`, {
        warnings: coordination.warnings,
      });
    }

    // Use adjusted bet size if coordinator reduced it
    const finalBetSize = coordination.adjustedBetSize ?? betSize;
    const adjustedFee = finalBetSize * 0.02;

    if (portfolio.balance < finalBetSize + adjustedFee) {
      strategyCoordinator.cancelDecision(market.id, id);
      this.addLog(id, "ERROR", `Insufficient balance for trade - Required: $${(finalBetSize + adjustedFee).toFixed(2)}, Available: $${portfolio.balance.toFixed(2)}`);
      return;
    }

    const position = marketEngine.placeTrade(decision.action, finalBetSize, id);
    if (position) {
      // Confirm execution with coordinator
      strategyCoordinator.confirmExecution(market.id, id, decision.action, finalBetSize);

      this.addLog(id, "TRADE", `Executed ${decision.action} trade for $${finalBetSize.toFixed(2)} at ${position.odds.toFixed(3)} odds`, {
        action: decision.action,
        amount: finalBetSize,
        odds: position.odds,
        fee: position.fee,
        positionId: position.id,
        confidence: decision.confidence,
        balanceAfter: portfolio.balance - finalBetSize - adjustedFee,
        openPositions: portfolio.openPositions.length + 1,
        kellyUsed: bot.useKelly,
        strategy: bot.strategy,
        coordinatorAdjusted: coordination.adjustedBetSize !== undefined,
      });
      // Note: stats are synced from portfolio on getBots() / after market settlement
      // Do NOT call updateBotStats here — position.pnl is null at placement time
    } else {
      // Trade failed, cancel with coordinator
      strategyCoordinator.cancelDecision(market.id, id);
    }
  }

  // updateBotStats removed — stats are now derived from portfolio settled positions
  // via syncStatsFromPortfolio() called in getBots()

  updateBotConfig(id: string, updates: Partial<BotConfig>): BotConfig | null {
    const bot = this.bots.get(id);
    if (!bot) return null;

    if (updates.betSize !== undefined) bot.betSize = Math.max(0.01, updates.betSize);
    if (updates.interval !== undefined) bot.interval = Math.max(1000, updates.interval);
    if (updates.useKelly !== undefined) bot.useKelly = updates.useKelly;
    if (updates.kellyFraction !== undefined) bot.kellyFraction = clamp(updates.kellyFraction, 0.01, 1);
    if (updates.maxBet !== undefined) bot.maxBet = Math.max(0.1, updates.maxBet);
    if (updates.stopLoss !== undefined) bot.stopLoss = updates.stopLoss;
    if (updates.takeProfit !== undefined) bot.takeProfit = updates.takeProfit;
    if (updates.maxPositions !== undefined) bot.maxPositions = Math.max(1, updates.maxPositions);

    bot.updatedAt = Date.now();

    // Restart bot if running to apply new interval
    if (bot.enabled && updates.interval !== undefined) {
      this.startBot(id);
    }

    this.bots.set(id, bot);
    return { ...bot, portfolio: marketEngine.getBotPortfolio(id) };
  }

  deleteBot(id: string): boolean {
    this.stopBot(id);
    return this.bots.delete(id);
  }

  stopAllBots(): void {
    for (const [id, bot] of this.bots) {
      bot.enabled = false;
      this.bots.set(id, bot);
      this.stopBot(id);
    }
  }

  runAllBots(config?: { betSize?: number; interval?: number }): void {
    for (const [id, bot] of this.bots) {
      if (config?.betSize) bot.betSize = config.betSize;
      if (config?.interval) bot.interval = config.interval;
      bot.enabled = true;
      this.bots.set(id, bot);
      this.startBot(id);
    }
  }

  resetAllBots(): void {
    this.stopAllBots();
    this.bots.clear();
    this.sessions = [];
    this.currentSessions.clear();
    this.initDefaultBots();
  }

  getSessions(): BotSession[] {
    return [...this.sessions];
  }

  getActiveSessions(): BotSession[] {
    return Array.from(this.currentSessions.values());
  }

  getStrategies(): Array<{ type: StrategyType; name: string; description: string; category: string }> {
    return Object.entries(strategies).map(([type, strategy]) => ({
      type: type as StrategyType,
      name: strategy.name,
      description: strategy.description,
      category: strategy.category,
    }));
  }

  // === Competition Mode ===

  startCompetition(config?: { minTrades?: number; duration?: number | null; startBalance?: number }): CompetitionState {
    // Stop any existing competition
    if (this.competition.active) {
      this.stopCompetition();
    }

    const minTrades = config?.minTrades ?? 50;
    const startBalance = config?.startBalance ?? 10;

    // Reset all bots to equal starting conditions
    this.stopAllBots();

    console.log(`[BotManager] Starting competition with ${this.bots.size} bots`);

    for (const [id, bot] of this.bots) {
      // Reset portfolio
      marketEngine.initBotPortfolio(id);
      const portfolio = marketEngine.getBotPortfolio(id);
      portfolio.balance = startBalance;
      portfolio.initialBalance = startBalance;

      // Reset stats
      bot.stats = {
        trades: 0,
        wins: 0,
        losses: 0,
        pnl: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
      };
      bot.enabled = true;
      bot.portfolio = portfolio;
      this.bots.set(id, bot);

      // Start the bot
      console.log(`[BotManager] Starting bot: ${bot.name} (${id})`);
      this.startBot(id);
    }

    // Initialize competition state
    this.competition = {
      active: true,
      startTime: Date.now(),
      minTrades,
      startBalance,
      leaderboard: [],
      winner: null,
      completedAt: null,
      config: {
        minTrades,
        duration: config?.duration ?? null,
        startBalance,
      },
    };

    this.addCompetitionLog("Competition started", {
      minTrades,
      startBalance,
      bots: this.bots.size,
    });

    return this.getCompetitionState();
  }

  stopCompetition(): CompetitionState {
    if (!this.competition.active) {
      return this.getCompetitionState();
    }

    // Mark as inactive FIRST to prevent recursion from updateLeaderboard
    this.competition.active = false;

    // Stop all bots
    this.stopAllBots();

    // Calculate final leaderboard
    this.updateLeaderboard();

    // Determine winner (highest P&L with min trades)
    const qualified = this.competition.leaderboard.filter(b => b.trades >= this.competition.minTrades);
    if (qualified.length > 0) {
      this.competition.winner = qualified[0].botId;
    }

    this.competition.completedAt = Date.now();

    this.addCompetitionLog("Competition ended", {
      winner: this.competition.winner,
      leaderboard: this.competition.leaderboard.slice(0, 3),
    });

    return this.getCompetitionState();
  }

  getCompetitionState(): CompetitionState {
    if (this.competition.active) {
      this.updateLeaderboard();
    }
    return { ...this.competition };
  }

  clearCompetition(): CompetitionState {
    // Reset competition to initial state
    this.competition = {
      active: false,
      startTime: 0,
      minTrades: 50,
      startBalance: 10,
      leaderboard: [],
      winner: null,
      completedAt: null,
      config: {
        minTrades: 50,
        duration: null,
        startBalance: 10,
      },
    };
    return this.getCompetitionState();
  }

  private updateLeaderboard(): void {
    const entries: CompetitionState["leaderboard"] = [];

    for (const [id, bot] of this.bots) {
      const portfolio = marketEngine.getBotPortfolio(id);
      const pnl = bot.stats.pnl || portfolio.totalPnL;
      const trades = bot.stats.trades || portfolio.totalTrades;
      const winRate = bot.stats.winRate || portfolio.winRate;

      // Calculate Sharpe ratio (simplified)
      const avgWin = bot.stats.avgWin || 0;
      const avgLoss = bot.stats.avgLoss || 0;
      const sharpeRatio = trades >= 5 ? (avgWin - avgLoss) / Math.max(0.01, (avgWin + avgLoss) / 2) : 0;

      // Calculate profit factor
      const profitFactor = bot.stats.profitFactor || (avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0);

      // Calculate ROI
      const roi = this.competition.startBalance > 0
        ? ((portfolio.balance - this.competition.startBalance) / this.competition.startBalance) * 100
        : 0;

      entries.push({
        botId: id,
        botName: bot.name,
        strategy: bot.strategy,
        rank: 0,
        trades,
        winRate,
        profitFactor: isFinite(profitFactor) ? profitFactor : 0,
        sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
        pnl,
        roi,
        balance: portfolio.balance,
      });
    }

    // Sort by: trades qualified → P&L → win rate
    entries.sort((a, b) => {
      const aQualified = a.trades >= this.competition.minTrades;
      const bQualified = b.trades >= this.competition.minTrades;

      if (aQualified !== bQualified) {
        return aQualified ? -1 : 1;
      }

      // Both qualified or not - sort by P&L
      if (a.pnl !== b.pnl) {
        return b.pnl - a.pnl;
      }

      // Tie-breaker: win rate
      return b.winRate - a.winRate;
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.competition.leaderboard = entries;

    // Check if competition should auto-end
    if (this.competition.active && this.competition.config.duration) {
      const elapsed = Date.now() - this.competition.startTime;
      if (elapsed >= this.competition.config.duration) {
        this.stopCompetition();
      }
    }
  }

  private addCompetitionLog(message: string, details?: Record<string, unknown>): void {
    const log: BotLog = {
      id: generateId("log"),
      botId: "competition",
      botName: "Competition",
      type: "COMPETITION",
      message,
      details,
      timestamp: Date.now(),
    };

    this.logs.unshift(log);
    if (this.logs.length > 100) {
      this.logs.pop();
    }

    for (const listener of this.logListeners) {
      try {
        listener(log);
      } catch (e) {
        console.error("[BotManager] Log listener error:", e);
      }
    }

    console.log(`[Competition] ${message}`);
  }

  dispose(): void {
    this.stopAllBots();
    this.intervals.clear();
  }
}

// Singleton instance
export const botManager = new BotManager();
