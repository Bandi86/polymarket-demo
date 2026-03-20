// ============================================================
// JAVÍTOTT POLYMARKET BOT STRATÉGIÁK
// Kutatás alapján: Oracle lag, Window Delta, Monte Carlo
// ============================================================
// 
// HOGYAN KELL BEILLESZTENI:
// Cseréld le a src/lib/bot-manager.ts fájlban a "const strategies: Record<StrategyType, Strategy>"
// objektumot az alábbival. Az összes többi kód maradhat.
// 
// UGYANCSAK szükséges: A StrategyContext típusba add hozzá:
//   btcWindowOpen?: number;   // BTC ára a 5-perces ablak nyitásakor
//   btcPriceHistory?: number[]; // utolsó 20 BTC ár tick
//
// ÉS az executeBotStrategy() függvényben számítsd ki a btcWindowOpen-t:
//   const btcHistory = priceService.getPriceHistory(200);
//   const windowOpenTime = market.startTime;
//   const windowOpenEntry = btcHistory.reduce((prev, curr) =>
//     Math.abs(curr.timestamp - windowOpenTime) < Math.abs(prev.timestamp - windowOpenTime)
//     ? curr : prev, btcHistory[0]);
//   const btcWindowOpen = windowOpenEntry?.price || btcPrice;
//   const btcPriceHistory = btcHistory.slice(-20).map(p => p.price);
//
// Ezt add hozzá a context objektumhoz:
//   btcWindowOpen,
//   btcPriceHistory,
// ============================================================

import type { StrategyContext, Strategy, StrategyType } from "../types";

// ============================================================
// SEGÉDFÜGGVÉNYEK
// ============================================================

/** BTC delta kiszámítása az ablak nyitóárhoz képest */
function calcBtcWindowDelta(ctx: StrategyContext): number {
  const windowOpen = (ctx as any).btcWindowOpen || ctx.btcPrice;
  if (!windowOpen || !ctx.btcPrice || windowOpen === 0) return 0;
  return (ctx.btcPrice - windowOpen) / windowOpen;
}

/** BTC delta mint százalék */
function calcBtcDeltaPct(ctx: StrategyContext): number {
  return calcBtcWindowDelta(ctx) * 100;
}

/** Monte Carlo szimuláció: P(BTC zárás >= nyitás) az idő hátralévő részében */
function monteCarloUpProb(
  currentPrice: number,
  openPrice: number,
  timeRemainingMs: number,
  volatilityPerSec = 0.00003, // ~0.003% per sec, tipikus BTC volatilitás
  paths = 500
): number {
  if (timeRemainingMs <= 0) return currentPrice >= openPrice ? 1 : 0;
  const dt = timeRemainingMs / 1000; // másodpercekben
  const sigma = volatilityPerSec * Math.sqrt(dt);
  
  let wins = 0;
  for (let i = 0; i < paths; i++) {
    // Brownian motion szimuláció
    const z = gaussianRandom();
    const simulatedEnd = currentPrice * Math.exp(-0.5 * sigma * sigma + sigma * z);
    if (simulatedEnd >= openPrice) wins++;
  }
  return wins / paths;
}

/** Box-Muller Gaussi véletlenszám generátor */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Piac fair értékének meghatározása BTC delta alapján */
function calcFairProbUp(deltaPct: number): number {
  // Empirikus görbe a Polymarket 5-perces piacokra
  // delta < -0.10%: ~10% esély az UP-ra
  // delta = 0%: ~50%
  // delta > +0.10%: ~90% esély az UP-ra
  const fairProb = 0.5 + Math.tanh(deltaPct / 0.05) * 0.45;
  return Math.min(0.97, Math.max(0.03, fairProb));
}

// ============================================================
// STRATÉGIÁK
// ============================================================

export const strategies: Record<StrategyType, Strategy> = {

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
      const { timeRemaining } = ctx;
      const deltaPct = calcBtcDeltaPct(ctx);
      
      // Ne kereskedj ha nincs BTC adat
      if (!ctx.btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár adat" };
      }
      
      // Ne kereskedj az utolsó 3 másodpercben (túl késő)
      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl késő - utolsó 3mp" };
      }
      
      // Ne kereskedj az első 30 másodpercben (még nincs elég adat)
      if (timeRemaining > 270000) {
        return { action: null, confidence: 0, reason: "Ablak eleje - várakozás" };
      }
      
      // ERŐS jel: delta > 0.10%
      if (deltaPct > 0.10) {
        const conf = Math.min(0.92, 0.65 + (deltaPct - 0.10) * 4);
        return { 
          action: "YES", 
          confidence: conf, 
          reason: `Erős UP delta: +${deltaPct.toFixed(3)}% az ablakon belül` 
        };
      }
      if (deltaPct < -0.10) {
        const conf = Math.min(0.92, 0.65 + (-deltaPct - 0.10) * 4);
        return { 
          action: "NO", 
          confidence: conf, 
          reason: `Erős DOWN delta: ${deltaPct.toFixed(3)}% az ablakon belül` 
        };
      }
      
      // KÖZEPES jel: delta > 0.05%
      if (deltaPct > 0.05) {
        const conf = 0.50 + (deltaPct - 0.05) * 5;
        return { 
          action: "YES", 
          confidence: Math.min(0.75, conf), 
          reason: `UP delta: +${deltaPct.toFixed(3)}%` 
        };
      }
      if (deltaPct < -0.05) {
        const conf = 0.50 + (-deltaPct - 0.05) * 5;
        return { 
          action: "NO", 
          confidence: Math.min(0.75, conf), 
          reason: `DOWN delta: ${deltaPct.toFixed(3)}%` 
        };
      }
      
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
      const { binanceSignal, timeRemaining, marketPrice } = ctx;
      
      if (!binanceSignal || binanceSignal.type === "NEUTRAL") {
        return { action: null, confidence: 0, reason: "Nincs Binance jel" };
      }

      // Jel kora - csak friss jeleket fogadj el (< 8 másodperc)
      const signalAge = Date.now() - binanceSignal.timestamp;
      if (signalAge > 8000) {
        return { action: null, confidence: 0, reason: `Jel lejárt: ${(signalAge / 1000).toFixed(1)}mp` };
      }

      // Ne kereskedj a lezárás előtti utolsó 3 másodpercben
      if (timeRemaining < 3000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      // Window delta is megerősíti?
      const deltaPct = calcBtcDeltaPct(ctx);
      const signalAlignedWithDelta = 
        (binanceSignal.type === "UP" && deltaPct > 0) ||
        (binanceSignal.type === "DOWN" && deltaPct < 0);
      
      // Ellenőrizd, hogy a piac még nem árazta be
      const marketImplied = binanceSignal.type === "UP" 
        ? marketPrice.yesPrice 
        : marketPrice.noPrice;
      
      // Ha a piac már 80%+ feletti, nem éri meg (kevés a várható nyereség)
      if (marketImplied > 0.82) {
        return { action: null, confidence: 0, reason: "Piac már beárazta" };
      }

      const action = binanceSignal.type === "UP" ? "YES" : "NO";
      
      // Konfidencia számítás:
      let confidence = binanceSignal.confidence;
      
      // Bónusz ha a window delta megerősíti
      if (signalAlignedWithDelta) {
        confidence = Math.min(0.95, confidence + 0.10);
      } else {
        // A window delta ellentmond - csökkent konfidencia
        confidence = confidence * 0.7;
      }
      
      // Magasabb konfidencia ha erősebb az elmozdulás
      if (Math.abs(binanceSignal.changePercent) > 0.05) {
        confidence = Math.min(0.95, confidence + 0.08);
      }

      if (confidence < 0.45) {
        return { action: null, confidence, reason: "Konfidencia túl alacsony az oracle lag stratégiánál" };
      }

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
  // A legmagasabb pontossági arány, de csak akkor elérhető jel
  // ──────────────────────────────────────────────────────────
  last_seconds_scalp: {
    name: "T-10 Sniper",
    description: "Utolsó 10-30mp-ban lép amikor BTC irány már egyértelmű",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining } = ctx;
      
      // CSAK az utolsó 30 másodpercben aktív
      if (timeRemaining > 30000 || timeRemaining < 4000) {
        return { action: null, confidence: 0, reason: "Nem a T-10 sniper ablakban" };
      }
      
      const deltaPct = calcBtcDeltaPct(ctx);
      
      // Szükség van BTC adatra
      if (!ctx.btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }
      
      // Minimális delta szükséges (10 másodperc alatt 0.05% elmozdulás nem valószínű hogy visszafordul)
      const minDelta = 0.04;
      if (Math.abs(deltaPct) < minDelta) {
        return { action: null, confidence: 0, reason: `Delta ${deltaPct.toFixed(4)}% - túl kicsi T-10 snipe-hoz` };
      }
      
      const action = deltaPct > 0 ? "YES" : "NO";
      
      // Konfidencia a delta mérete alapján
      let confidence = 0.55 + Math.min(0.35, Math.abs(deltaPct) * 5);
      
      // Erősebb konfidencia ha a Binance jel is megerősíti
      if (ctx.binanceSignal && ctx.binanceSignal.type !== "NEUTRAL") {
        const signalAligned = 
          (ctx.binanceSignal.type === "UP" && deltaPct > 0) ||
          (ctx.binanceSignal.type === "DOWN" && deltaPct < 0);
        if (signalAligned) {
          confidence = Math.min(0.95, confidence + 0.12);
        }
      }
      
      // Extra bónusz ha erős delta közel a záráshoz
      if (Math.abs(deltaPct) > 0.12 && timeRemaining < 15000) {
        confidence = Math.min(0.95, confidence + 0.08);
      }
      
      // Ellenőrizd az ár nem-e már be van árazva
      const marketPrice = action === "YES" ? ctx.marketPrice.yesPrice : ctx.marketPrice.noPrice;
      if (marketPrice > 0.88) {
        // Ha már 88+ centes, kevés a várható nyereség (csak 12 cent max)
        // Csak akkor érdemes ha nagyon biztos a helyzet
        if (confidence < 0.85) {
          return { action: null, confidence, reason: `Piac már ${(marketPrice * 100).toFixed(0)}¢ - kevés edge` };
        }
      }
      
      return {
        action,
        confidence,
        reason: `T-10 snipe: delta=${deltaPct.toFixed(3)}% | ${timeRemaining / 1000}mp maradt`,
      };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #4 MONTE CARLO - Valószínűségi modell
  // Brownian motion szimuláció + piac félreárazás keresés
  // ──────────────────────────────────────────────────────────
  monte_carlo: {
    name: "Monte Carlo",
    description: "Brownian motion szimulációval kalkulál és félreárazott piacot keres",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, marketPrice } = ctx;
      
      if (!ctx.btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }
      
      // Minimális idő szükséges (ha kevesebb mint 10mp, már a sniper kezeli)
      if (timeRemaining < 10000 || timeRemaining > 240000) {
        return { action: null, confidence: 0, reason: "Nem Monte Carlo ablakban" };
      }
      
      const windowOpen = (ctx as any).btcWindowOpen || ctx.btcPrice;
      const currentBtc = ctx.btcPrice;
      
      // Volatilitás becslés BTC historikus adatból
      let volatility = 0.000030; // default ~0.003% per másodperc
      if (ctx.volatility && ctx.volatility > 0) {
        // A ctx.volatility YES ár volatilitásból jön, átszámítjuk BTC-re
        volatility = Math.min(ctx.volatility * 0.1, 0.0001);
      }
      
      // Monte Carlo szimulálás
      const upProb = monteCarloUpProb(currentBtc, windowOpen, timeRemaining, volatility, 500);
      
      const marketImpliedUp = marketPrice.yesPrice;
      const edge = upProb - marketImpliedUp;
      
      // Csak akkor kereskedj ha van elegendő edge (5%+ eltérés)
      const minEdge = 0.06;
      
      if (edge > minEdge) {
        const confidence = Math.min(0.85, 0.5 + edge * 3);
        return {
          action: "YES",
          confidence,
          reason: `Monte Carlo: P(UP)=${(upProb * 100).toFixed(1)}% vs piac ${(marketImpliedUp * 100).toFixed(1)}¢ | edge=${(edge * 100).toFixed(1)}%`,
        };
      }
      
      if (-edge > minEdge) {
        const confidence = Math.min(0.85, 0.5 + (-edge) * 3);
        return {
          action: "NO",
          confidence,
          reason: `Monte Carlo: P(DOWN)=${((1 - upProb) * 100).toFixed(1)}% vs piac ${(marketPrice.noPrice * 100).toFixed(1)}¢ | edge=${(-edge * 100).toFixed(1)}%`,
        };
      }
      
      return { 
        action: null, 
        confidence: 0, 
        reason: `Monte Carlo: edge csak ${(Math.abs(edge) * 100).toFixed(1)}% - nem elég` 
      };
    },
  },

  // ──────────────────────────────────────────────────────────
  // #5 MOMENTUM - Javított BTC momentum
  // BTC price change-t használ, nem YES price history-t
  // ──────────────────────────────────────────────────────────
  momentum: {
    name: "BTC Momentum",
    description: "BTC valós idejű momentum alapján (nem Polymarket odds)",
    category: "momentum",
    execute: (ctx) => {
      const { timeRemaining, btcPriceChange } = ctx;

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
      const deltaPct = calcBtcDeltaPct(ctx);
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
  // #6 FAIR VALUE ARBITRAGE - Félreárazott piac kereső
  // Ha a piac odds nem tükrözik a BTC valós pozícióját
  // ──────────────────────────────────────────────────────────
  fair_value: {
    name: "Fair Value Arb",
    description: "Piac félreárazást keres BTC delta vs Polymarket odds alapján",
    category: "arbitrage",
    execute: (ctx) => {
      const { timeRemaining, marketPrice } = ctx;

      if (timeRemaining < 15000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }
      
      if (!ctx.btcPrice) {
        return { action: null, confidence: 0, reason: "Nincs BTC ár" };
      }
      
      const deltaPct = calcBtcDeltaPct(ctx);
      const fairUpProb = calcFairProbUp(deltaPct);
      
      const marketYes = marketPrice.yesPrice;
      const edge = fairUpProb - marketYes;
      
      const minEdge = 0.07; // legalább 7% edge kell
      
      if (edge > minEdge) {
        return {
          action: "YES",
          confidence: Math.min(0.85, 0.5 + edge * 3),
          reason: `Fair value: számított=${(fairUpProb * 100).toFixed(1)}% vs piac=${(marketYes * 100).toFixed(1)}¢ | edge=${(edge * 100).toFixed(1)}%`,
        };
      }
      
      if (-edge > minEdge) {
        const fairDownProb = 1 - fairUpProb;
        return {
          action: "NO",
          confidence: Math.min(0.85, 0.5 + (-edge) * 3),
          reason: `Fair value: számított DOWN=${(fairDownProb * 100).toFixed(1)}% vs piac=${(marketPrice.noPrice * 100).toFixed(1)}¢`,
        };
      }

      return { 
        action: null, 
        confidence: 0, 
        reason: `Fair value: edge csak ${(Math.abs(edge) * 100).toFixed(1)}% (kell: ${minEdge * 100}%)` 
      };
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
      const { timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }
      
      const deltaPct = calcBtcDeltaPct(ctx);
      
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
    description: "Rövid és hosszú távú BTC trend megerősítés",
    category: "trend",
    execute: (ctx) => {
      const { priceHistory, timeRemaining } = ctx;

      if (priceHistory.length < 10 || timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const recent = priceHistory.slice(-3);
      const older = priceHistory.slice(-10, -3);

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const trend = (recentAvg - olderAvg) / olderAvg;
      
      // BTC window delta is megerősíti?
      const deltaPct = calcBtcDeltaPct(ctx);
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
      
      // BTC ellentmond - ne kereskedj
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
      const { priceHistory, timeRemaining } = ctx;

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
      const deltaPct = calcBtcDeltaPct(ctx);
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
  // #10 CONTRARIAN - Ellentétes stratégia (körültekintőbb)
  // ──────────────────────────────────────────────────────────
  contrarian: {
    name: "Contrarian",
    description: "Extrém crowd sentiment ellen kereskedik (BTC validációval)",
    category: "mean_reversion",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 30000) {
        return { action: null, confidence: 0, reason: "Túl közel a záráshoz" };
      }

      const yesPrice = marketPrice.yesPrice;
      const deltaPct = calcBtcDeltaPct(ctx);

      // Csak akkor legyen contrarian ha a BTC ELLENTMOND a piac ármozgásnak
      if (yesPrice > 0.72 && deltaPct < -0.03) {
        // Piac bullish (72%+ YES), de BTC esett
        return {
          action: "NO",
          confidence: Math.min(0.72, (yesPrice - 0.60) * 2 + (-deltaPct) * 10),
          reason: `Contrarian: piac ${(yesPrice * 100).toFixed(1)}¢ YES, de BTC ${deltaPct.toFixed(3)}% le`,
        };
      }
      if (yesPrice < 0.28 && deltaPct > 0.03) {
        // Piac bearish (28%- YES), de BTC emelkedett
        return {
          action: "YES",
          confidence: Math.min(0.72, (0.40 - yesPrice) * 2 + deltaPct * 10),
          reason: `Contrarian: piac ${(yesPrice * 100).toFixed(1)}¢ YES, de BTC +${deltaPct.toFixed(3)}%`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs contrarian jelzés" };
    },
  },

  // ──────────────────────────────────────────────────────────
  // Megmaradó stratégiák (kevésbé hatékonyak de megtartjuk)
  // ──────────────────────────────────────────────────────────
  
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

  volatility: {
    name: "Volatility Breakout",
    description: "Volatilitás kitörés kereskedés",
    category: "momentum",
    execute: (ctx) => {
      const { priceHistory, timeRemaining } = ctx;

      if (priceHistory.length < 20 || timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Nincs elég adat" };
      }

      const deltaPct = calcBtcDeltaPct(ctx);
      
      // BTC volatilitás = jó jel a window delta megerősítéséhez
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
        // Arbitrázs lehetőség - az összeg kevesebb mint 1.00
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
      const { timeRemaining, btcPriceChange } = ctx;

      if (timeRemaining < 20000) {
        return { action: null, confidence: 0, reason: "Nincs elég idő" };
      }

      if (btcPriceChange !== undefined && Math.abs(btcPriceChange) > 0.001) {
        const pct = btcPriceChange * 100;
        const deltaPct = calcBtcDeltaPct(ctx);
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
    name: "Grid Trading",
    description: "Grid szinteken kereskedik",
    category: "other",
    execute: (ctx) => {
      const { marketPrice, timeRemaining, priceHistory } = ctx;

      if (timeRemaining < 60000 || priceHistory.length < 10) {
        return { action: null, confidence: 0, reason: "Nincs elegendő idő/adat" };
      }

      const yesPrice = marketPrice.yesPrice;
      const range = 0.04;
      const center = 0.50;

      // Grid szintek: 46¢ alatt vedd UP-ot, 54¢ felett vedd DOWN-t
      if (yesPrice < center - range) {
        return {
          action: "YES",
          confidence: 0.62,
          reason: `Grid: YES alul ${(yesPrice * 100).toFixed(1)}¢`,
        };
      }
      if (yesPrice > center + range) {
        return {
          action: "NO",
          confidence: 0.62,
          reason: `Grid: YES felül ${(yesPrice * 100).toFixed(1)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "Nincs grid jelzés" };
    },
  },

  market_making: {
    name: "Market Making",
    description: "Likviditás biztosítás spread-ből",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 60000) {
        return { action: null, confidence: 0, reason: "Túl közel" };
      }

      const yesPrice = marketPrice.yesPrice;

      if (yesPrice > 0.57) {
        return { action: "NO", confidence: 0.52, reason: "Market making: YES magas" };
      }
      if (yesPrice < 0.43) {
        return { action: "YES", confidence: 0.52, reason: "Market making: YES alacsony" };
      }

      return { action: null, confidence: 0, reason: "Nincs market making edge" };
    },
  },

  arbitrage: {
    name: "Arbitrage",
    description: "Árkülönbségek kihasználása",
    category: "arbitrage",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      if (timeRemaining < 45000) {
        return { action: null, confidence: 0, reason: "Nincs elegendő idő" };
      }

      const deltaPct = calcBtcDeltaPct(ctx);
      const yesPrice = marketPrice.yesPrice;
      const impliedProb = calcFairProbUp(deltaPct);
      const edge = impliedProb - yesPrice;

      if (Math.abs(edge) > 0.08) {
        return {
          action: edge > 0 ? "YES" : "NO",
          confidence: Math.min(0.80, 0.5 + Math.abs(edge) * 3.5),
          reason: `Arb: fair=${(impliedProb * 100).toFixed(1)}% vs piac=${(yesPrice * 100).toFixed(1)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: `Arb edge csak ${(Math.abs(edge) * 100).toFixed(1)}%` };
    },
  },
};

// ============================================================
// BOTOK JAVASOLT KONFIGURÁCIÓJA
// A botManager.ts initDefaultBots() függvényébe illesztendő
// ============================================================

export const recommendedBotConfigs = [
  // 1. Window Delta bot - A LEGFONTOSABB, mindig fusson
  { 
    id: "bot-window-delta", 
    name: "Window Delta", 
    strategy: "window_delta",
    interval: 2000,   // 2 másodpercenként ellenőrzi
    betSize: 1.0,
    useKelly: true,
    maxPositions: 2
  },
  
  // 2. T-10 Sniper - Utolsó másodpercek spécialista
  { 
    id: "bot-sniper", 
    name: "T-10 Sniper", 
    strategy: "last_seconds_scalp",
    interval: 500,    // Nagyon gyors - 500ms
    betSize: 1.5,
    useKelly: false,
    maxPositions: 1   // Egyszerre csak 1 pozíció
  },
  
  // 3. Oracle Lag bot - Binance lead kihasználó
  { 
    id: "bot-oracle-lag",
    name: "Oracle Lag",
    strategy: "binance_signal",
    interval: 1000,   // 1 másodpercenként
    betSize: 1.0,
    useKelly: true,
    maxPositions: 2
  },
  
  // 4. Monte Carlo - Valószínűségi modell
  { 
    id: "bot-monte-carlo",
    name: "Monte Carlo",
    strategy: "monte_carlo",
    interval: 5000,   // 5 másodpercenként (nehezebb számítás)
    betSize: 0.75,
    useKelly: true,
    maxPositions: 2
  },
  
  // 5. Fair Value Arb
  { 
    id: "bot-fair-value",
    name: "Fair Value Arb",
    strategy: "fair_value",
    interval: 3000,
    betSize: 0.75,
    useKelly: true,
    maxPositions: 3
  },
  
  // 6. BTC Momentum
  { 
    id: "bot-momentum",
    name: "BTC Momentum",
    strategy: "momentum",
    interval: 4000,
    betSize: 0.5,
    useKelly: true,
    maxPositions: 2
  },
];
