# Odds Swing Trading — Implementációs Útmutató

## Összefoglalás

Az ötlet: vegyél **olcsó** (< 15¢) kimeneteleket, tartsd amíg az ár felfelé megy, majd zárd profitban.

```
Példa:
  YES belépés: 10¢ ($0.10)
  YES zárás:   20¢ ($0.20)  → 96% profit (2% díj után)
  YES zárás:   25¢ ($0.25)  → 145% profit
  
  exitValue = amount × (currentOdds / entryOdds) × 0.98
  exitValue = $1.00 × (0.20 / 0.10) × 0.98 = $1.96 → +$0.96 profit
```

---

## Miért működhet ez?

Polymarket 5-perces piacokon az odds dinamikusan változnak a BTC árával.
Ha a BTC hirtelen le esik, a YES (up) odds 50¢-ről leeshet 8-12¢-re.
Ha utána visszapattan, az odds visszamegy 30-40¢-re → ez a swing ablak.

Az odds-ok változása NEM lineáris a BTC árával:
- -0.5% BTC mozgás → YES 50¢ → 15¢ (gyors crash)
- +0.3% BTC mozgás → YES 15¢ → 30¢ (visszapattanás)

---

## Fájlok, amiket módosítani kell

### 1. ÚJ FÁJL: `src/lib/position-monitor.ts`
→ Már kész: `/home/claude/position-monitor.ts`

Másold ide:
```bash
cp /home/claude/position-monitor.ts src/lib/position-monitor.ts
```

**Mit csinál:**
- 500ms-onként ellenőriz minden regisztrált pozíciót
- Ha az odds eléri a TP szintet → auto-zárás
- Ha az odds eléri az SL szintet → auto-zárás
- Naplózza az eredményeket

---

### 2. ÚJ KOMPONENS: `src/components/SwingTraderPanel.tsx`
→ Már kész: `/home/claude/SwingTraderPanel.tsx`

Másold ide:
```bash
cp /home/claude/SwingTraderPanel.tsx src/components/SwingTraderPanel.tsx
```

**Mit csinál:**
- Mutatja az aktuális YES/NO árakat
- Jelzi ha belépési lehetőség van (ár < küszöb)
- Manuális belépés gombokkal
- Valós idejű progress bar TP → SL között
- Konfigurálható sliderekkel

---

### 3. MÓDOSÍTÁS: `src/types/index.ts`

Keress rá erre a sorra:
```typescript
| "last_seconds_scalp";
```

Cseréld erre:
```typescript
| "last_seconds_scalp"
| "odds_swing";
```

---

### 4. MÓDOSÍTÁS: `src/lib/bot-manager.ts`

**4a. Import hozzáadása a fájl tetejére:**
```typescript
import { positionMonitor } from "./position-monitor";
```

**4b. Új stratégia hozzáadása a `strategies` objektumhoz:**

Az `last_seconds_scalp` után add hozzá:
```typescript
  odds_swing: {
    name: "Odds Swing",
    description: "Buys low-priced outcomes (<15¢) and auto-exits at 2x via PositionMonitor",
    category: "other",
    execute: (ctx) => {
      const { marketPrice, timeRemaining } = ctx;

      // Minimum 90 másodperc kell a swinghez
      if (timeRemaining < 90_000) {
        return { action: null, confidence: 0, reason: "Too close to expiry for swing" };
      }

      const { yesPrice, noPrice } = marketPrice;
      const ENTRY_THRESHOLD = 0.15;
      const MIN_PRICE = 0.04;

      if (yesPrice >= MIN_PRICE && yesPrice <= ENTRY_THRESHOLD) {
        const confidence = 0.5 + (ENTRY_THRESHOLD - yesPrice) / ENTRY_THRESHOLD * 0.4;
        return {
          action: "YES",
          confidence,
          reason: `YES swing: ${(yesPrice * 100).toFixed(1)}¢ → cél: ${(yesPrice * 200).toFixed(1)}¢`,
        };
      }

      if (noPrice >= MIN_PRICE && noPrice <= ENTRY_THRESHOLD) {
        const confidence = 0.5 + (ENTRY_THRESHOLD - noPrice) / ENTRY_THRESHOLD * 0.4;
        return {
          action: "NO",
          confidence,
          reason: `NO swing: ${(noPrice * 100).toFixed(1)}¢ → cél: ${(noPrice * 200).toFixed(1)}¢`,
        };
      }

      return { action: null, confidence: 0, reason: "No cheap entry found" };
    },
  },
```

**4c. Új bot hozzáadása az `initDefaultBots()` tömbhöz:**
```typescript
{ id: "bot-odds-swing", name: "Odds Swing", strategy: "odds_swing", interval: 2000, betSize: 0.5, useKelly: false, maxPositions: 3 },
```

**4d. TP/SL regisztrálás a `executeBotStrategy()` végén:**

Keresd meg ezt a részt:
```typescript
    if (position) {
      this.addLog(id, "TRADE", `Executed ${decision.action} trade...`, {...});
      this.updateBotStats(id, position);
    }
```

Cseréld erre:
```typescript
    if (position) {
      this.addLog(id, "TRADE", `Executed ${decision.action} trade...`, {...});
      this.updateBotStats(id, position);

      // TP/SL regisztráció odds_swing bothoz (és bármely máshoz ahol be van állítva)
      const tpMultiplier = bot.strategy === "odds_swing" ? 2.0 : (bot as any).takeProfitMultiplier;
      const slMultiplier = bot.strategy === "odds_swing" ? 0.5 : (bot as any).stopLossMultiplier;
      if (tpMultiplier && slMultiplier) {
        positionMonitor.register({
          positionId: position.id,
          entryOdds: position.odds,
          takeProfitMultiplier: tpMultiplier,
          stopLossMultiplier: slMultiplier,
          botId: id,
        });
      }
    }
```

---

### 5. MÓDOSÍTÁS: `src/server.ts`

**5a. Import hozzáadása a fájl tetejére:**
```typescript
import { positionMonitor } from "./lib/position-monitor";
```

**5b. Három új endpoint a `handleApiRoute()` funkcióban, a Not Found return ELŐTT:**

```typescript
  // POST /api/swing/register
  if (path === "/api/swing/register" && method === "POST") {
    const body = await parseBody(req) as {
      positionId?: string;
      entryOdds?: number;
      takeProfitMultiplier?: number;
      stopLossMultiplier?: number;
    };
    if (!body?.positionId || !body.entryOdds) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }
    positionMonitor.register({
      positionId: body.positionId,
      entryOdds: body.entryOdds,
      takeProfitMultiplier: body.takeProfitMultiplier ?? 2.0,
      stopLossMultiplier: body.stopLossMultiplier ?? 0.5,
    });
    return Response.json({ success: true });
  }

  // GET /api/swing/stats
  if (path === "/api/swing/stats" && method === "GET") {
    return Response.json({
      monitor: positionMonitor.getStats(),
      targets: positionMonitor.getTargets(),
    });
  }

  // GET /api/swing/opportunities
  if (path === "/api/swing/opportunities" && method === "GET") {
    const market = marketEngine.getCurrentMarket();
    if (!market) return Response.json([]);
    const yesPrice = parseFloat(market.outcomePrices?.yes || "0.5");
    const noPrice = parseFloat(market.outcomePrices?.no || "0.5");
    const timeRemaining = marketEngine.getTimeRemaining();
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.15");
    const opportunities = [];
    if (yesPrice <= threshold && yesPrice >= 0.04 && timeRemaining > 90_000) {
      opportunities.push({
        outcome: "YES", currentPrice: yesPrice,
        roi2x: (2 * 0.98 - 1) * 100,
        quality: yesPrice < 0.08 ? "premium" : yesPrice < 0.12 ? "good" : "fair",
      });
    }
    if (noPrice <= threshold && noPrice >= 0.04 && timeRemaining > 90_000) {
      opportunities.push({
        outcome: "NO", currentPrice: noPrice,
        roi2x: (2 * 0.98 - 1) * 100,
        quality: noPrice < 0.08 ? "premium" : noPrice < 0.12 ? "good" : "fair",
      });
    }
    return Response.json(opportunities);
  }
```

---

### 6. MÓDOSÍTÁS: `src/components/App.tsx`

A jobb oldali kolumnban (RIGHT COLUMN) add hozzá a SwingTraderPanel-t a TradingPanel után:

```typescript
import { SwingTraderPanel } from "./SwingTraderPanel";

// ... a JSX-ben a TradingPanel után:
<SwingTraderPanel
  yesPrice={yesPrice}
  noPrice={noPrice}
  coinColor={coinColor}
/>
```

---

## A többi bot frissítése (opcionális)

Ha szeretnéd hogy a TÖBBI BOT is használja a TP/SL-t, a `executeBotStrategy()`-ban
az alábbi config alapján lehet beállítani:

| Bot | TP szorzó | SL szorzó | Logika |
|-----|-----------|-----------|--------|
| odds_swing | 2.0x | 0.50x | Alap swing stratégia |
| momentum | 1.5x | 0.70x | Gyorsabb kiszállás |
| contrarian | 1.8x | 0.60x | Kicsit több tér |
| grid_trading | 1.4x | 0.75x | Szoros grid |
| binance_signal | 1.3x | 0.80x | Gyors scalp |

A `bot.stopLoss` és `bot.takeProfit` mezők már léteznek a `BotConfig` típusban,
csak a `positionMonitor.register()` hívást kell hozzáadni.

---

## Tesztelési sorrend

1. `bun run build` → ellenőrzés hogy nincs TypeScript hiba
2. `bun dev` → szerver indítás
3. Nyisd meg a dashboardot
4. Várd meg amíg YES vagy NO < 15¢ lesz
5. Kattints a belépési gombra
6. Figyeld a progress bar-t amint az ár változik
7. Az auto-close a szerver logban jelenik meg: `[PositionMonitor] ✅ TP hit`

---

## Várható eredmény

A 5-perces BTC piacokon az odds-ok sokat mozognak. Egy tipikus ülés alatt:
- Az odds 3-5x el-ingadoznak a lejárat előtt
- A legjobb belépési pontok: az első 2 percben, amikor még sok idő van
- A legjobb kilépési ablakok: 60-90 másodperccel a lejárat előtt

**Kockázat:** Ha az odds nem megy vissza (a piac "él" az egyik irányba),
a stop-loss véd, de a tét elveszik.
