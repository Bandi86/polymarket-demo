# Polymarket Demo — Átfogó Optimalizálási Terv

> **Dátum**: 2026-03-21  
> **Cél**: Bot teljesítmény stabilizálása és javítása + UI konszolidáció egyetlen áttekinthető oldalra

---

## Tartalom

1. [Jelenlegi Állapot Összefoglaló](#1-jelenlegi-állapot)
2. [RÉSZ A — Bot Teljesítmény Optimalizálás](#rész-a--bot-teljesítmény-optimalizálás)
3. [RÉSZ B — UI/UX Konszolidáció](#rész-b--uiux-konszolidáció)

---

## 1. Jelenlegi Állapot

### Architektúra
- **17 stratégia** a `bot-manager.ts`-ben (window_delta, oracle_lag, last_seconds_scalp, monte_carlo, fair_value, momentum, mean_reversion, trend, smart_trend, contrarian, volatility, anomaly, momentum_burst, grid_trading, market_making, arbitrage, random)
- **10 default bot** (5 primary + 4 secondary + 1 random baseline)
- **Strategy Coordinator** — megakadályozza az ellentétes pozíciókat
- **Parameter Optimizer** — genetikus algoritmus paraméter evolúcióhoz
- **Risk Manager** — napi veszteség limit, drawdown stop, cooldown
- **SQLite** adatbázis session persistence-el
- **Binance Kline Provider** — valós idejű BTC ár Oracle Lag-hez

### Ismert Problémák
- Win rate ingadozás (80% → 35% óránként)
- Nem konzisztens bot teljesítmény
- UI szétszórva: trading főoldal + külön /bots oldal hash routinggal
- Egyes stratégiák (mean_reversion, grid_trading, market_making) kevésbé hatékonyak 5-perces piacokon

---

## RÉSZ A — Bot Teljesítmény Optimalizálás

### A.1 Historikus Eredmények Elemzése

**Végrehajtandó lépések:**

1. **SQLite DB elemzés** — `data/polymarket.db` tartalmazza a session eredményeket
   - Stratégiánkénti win rate, PnL, Sharpe ratio összesítés
   - Időszakonkénti teljesítmény vizsgálat (melyik óra a legjobb/legrosszabb)
   - Volatilitás hatása a teljesítményre

2. **JSON export vizsgálat** — A `/tmp/polymarket-*-run-*.json` fájlok
   - Korábbi futások eredményeinek összesítése
   - Bot-onkénti teljesítmény rangsor

3. **Elemzés script fejlesztése** — `scripts/analyze-performance.ts`
   - DB-ből kinyert adatok alapján stratégia ranking
   - Automatikus ajánlások a küszöbértékekre

---

### A.2 Stratégia Küszöbérték Finomhangolás

> [!IMPORTANT]
> A jelenlegi stratégiák mind BTC delta-ra épülnek. A fő kérdés: milyen erős deltánál érdemes kereskedni?

#### Változtatandó paraméterek stratégiánként:

| Stratégia | Jelenlegi küszöb | Probléma | Javasolt változtatás |
|-----------|------------------|----------|---------------------|
| `window_delta` | 0.07% / 0.12% | Túl alacsony — sok false positive | Dinamikus: piaci volatilitás alapján (0.08-0.15%) |
| `oracle_lag` | signalAge < 8s | Oracle lag nem mindig 8mp | Adaptív: mért lag alapján (5-12s) |
| `last_seconds_scalp` | minDelta 0.06%, maxPrice 72¢ | Jó, de gyakran lekési a belépőt | Csökkenteni az interval-t 500ms → 300ms |
| `monte_carlo` | minEdge 0.08 | Matematikai modell túl egyszerű | P(UP) számítás javítása volatilitás figyelembevételével |
| `fair_value` | minEdge 0.07, tanh modell | Agresszív — sok rossz trade | Edge minimum emelése 0.10-re |
| `momentum` | btcPriceChange > 0.05% | Ritkán ad jelet | Csökkentés 0.03%-ra + delta megerősítéssel |
| `mean_reversion` | deltaPct > 0.20% | 5-percen belül ritkán van ekkora | Csökkentés 0.15%-ra, de idő-szűrő (min 2 perc hátra) |
| `market_making` | yesPrice > 0.57 | Nem profitábilis 5-perces piacokon | Szüneteltetés vagy átalakítás |
| `grid_trading` | center 0.50, range 0.04 | Nem optimális 5-perces piacokon | Szüneteltetés vagy dinamikus grid |

#### Konkrét kódváltoztatások:

**`bot-manager.ts` — Stratégia módosítások:**

1. **Window Delta** — Dinamikus küszöb bevezetése:
   - Számítsuk ki a korábbi ablakok átlagos deltáját
   - Küszöb = átlagos delta × 1.5 (minimum 0.05%, maximum 0.20%)
   - Konfidencia skálázás: magasabb delta = exponenciálisan nagyobb konfidencia

2. **Oracle Lag** — Adaptív signal validation:
   - Mérjük a tényleges oracle lag-et (Binance ár vs Polymarket frissülés)
   - Signal freshness: signalAge < measured_lag × 0.6
   - **Teljesen eldobni a jelet, ha a delta nem erősíti meg** (jelenleg 0.7 szorzóval csökkenti)

3. **T-10 Sniper** — Precízebb timing:
   - Ablak szűkítése: 4-20mp → 3-15mp
   - Magasabb delta minimum: 0.06% → 0.08% (kevesebb trade, jobb minőség)
   - MAX_BUY_PRICE csökkentése 72¢ → 68¢

4. **Gyengén teljesítő stratégiák kezelése:**
   - `market_making`: default kikapcsolás (nem profitábilis 5-percen)
   - `grid_trading`: default kikapcsolás
   - `random`: megtartás baseline-ként, de ne legyen az alapértelmezett botok között

---

### A.3 Koordinátor és Risk Manager Fejlesztés

#### Strategy Coordinator javítás:
- `maxBotsSameOutcome`: 3 → 2 (kevesebb overexposure)
- Hozzáadni: **time-based conflict resolution** — ha a stratégiák eltérő időablakban aktívak (pl. sniper vs window_delta), ne blokkolják egymást
- `compatibleStrategies` map frissítése az új stratégia nevekre (jelenleg régi neveket használ!)

> [!WARNING]
> A `strategy-coordinator.ts` compatible strategies mappja régi stratégia neveket tartalmaz (`momentum_chaser`, `whale_follower`, stb.), amelyek már nem léteznek! Ez azt jelenti, hogy a koordinátor NEM ismeri fel a kompatibilis stratégiákat → túl sok trade-et blokkol.

#### Risk Manager finomhangolás:
- `cooldownAfterLoss`: 30s → 15s (5-perces piacokhoz gyorsabb recovery)
- `minConfidence`: 0.5 → 0.55 (magasabb minimum konfidencia)
- Hozzáadni: **consecutive loss breaker** — 3 egymást követő veszteség után 2 perc szünet
- `maxTradesPerHour`: 60 → 40 (kevesebb, de jobb minőségű trade)

---

### A.4 Teljesítmény Monitoring Fejlesztések

1. **Per-market tracking** — Melyik piac hány %-os sikerességű
2. **Volatility regime detection** — Alacsony/közepes/magas volatilitás felismerése, stratégia adaptálás
3. **Real-time dashboard metrikák** — Jelenlegi session win rate, delta distribution, legjobb bot
4. **Automatikus stratégia letiltás** — Ha egy bot 5 egymást követő veszteséget szenved → auto-pause + notification

---

### A.5 Bet Sizing Optimalizálás

Jelenlegi probléma: Kelly criterion néha túl nagy pozíciót hoz létre.

Javítások:
- **Quarter-Kelly** használata half-Kelly helyett kezdetben (konzervatívabb)
- **Max bet cap**: 20% bankroll → 15% bankroll
- **Balansz-alapú méretezés**: ha a bot nyereséges (bankroll > start), növelje a bet méretet; ha veszteséges, csökkentse
- **Minimum trade érték**: $1 → $0.50 (több lehetőség)

---

## RÉSZ B — UI/UX Konszolidáció

### B.1 Fő Oldal Átalakítás — Mindent Egy Oldalra

> [!IMPORTANT]
> Cél: A `/bots` hash route és a `BotDashboardPage` tartalmát integrálni a főoldalra, hogy minden egy nézetben legyen áttekinthető.

#### Új Layout Terv:

```
┌────────────────────────────────────────────────────────┐
│ HEADER — Logo, Státusz, Latency, Bot Count, Settings   │
├────────────────────────────────────────────────────────┤
│ ASSET & TIMEFRAME BAR — BTC/ETH/SOL/XRP + 5m/15m/1h   │
├────────────┬──────────────────────┬────────────────────┤
│            │                      │                    │
│ LEFT COL   │   CENTER COLUMN      │   RIGHT COLUMN     │
│            │                      │                    │
│ Market     │   Chart Panel        │   Trading Panel    │
│ Card       │                      │   Positions        │
│            │                      │   Activity Log     │
│ Quick      │                      │                    │
│ Actions    │                      │                    │
│            │                      │                    │
│ Order      │                      │                    │
│ Book       │                      │                    │
│            │                      │                    │
├────────────┴──────────────────────┴────────────────────┤
│ BOT MANAGEMENT SECTION (integrált, korábban /bots)     │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Quick Stats: Bots, P&L, Win Rate, Trades, Prices │   │
│ │ [Run All] [Stop All]                             │   │
│ ├──────────────────────────────────────────────────┤   │
│ │ TAB BAR: [Monitor] [Backtest] [Leaderboard] [Cfg]│   │
│ ├──────────────────────────────────────────────────┤   │
│ │ TAB CONTENT:                                     │   │
│ │  - Monitor: Bot kártyák + logok (collapse-olható)│   │
│ │  - Backtest: Strategy Lab + Performance          │   │
│ │  - Leaderboard: Competition + History            │   │
│ │  - Config: Risk + Mode + Settings                │   │
│ └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

#### Módosítandó fájlok:

| Fájl | Változás |
|------|----------|
| `App.tsx` | Hash routing eltávolítása, BotDashboardPage beágyazása a főoldalra |
| `Header.tsx` | `onOpenDashboard` és `showBackButton` propok eltávolítása |
| `BotDashboardPage.tsx` | Kisebb stílusmódosítás (szekció stílus ahelyett hogy teljes oldal) |
| `BotSummaryStrip.tsx` | Eltávolítás vagy bővítés (a bot section feleslegessé teszi) |

---

### B.2 Layout Finomhangolás

1. **Collapse-olható szekciók:**
   - A bot management section összecsukható legyen (chevron gomb)
   - Alapértelmezett: kinyitva, ha bots is aktívak; becsukva, ha nem
   
2. **Tab tartalom compact mód:**
   - Monitor tab: Bot kártyák kisebb méretben (kompakt lista nézet opció)
   - Backtest tab: Kompaktabb chart-ok
   
3. **Sticky Bot Stats:**
   - Bot összesítő stats (P&L, Win Rate, Trades) maradjon látható scrollozásnál
   
4. **Responsive javítások:**
   - Mobilon egymás alá rendeződjenek az oszlopok
   - Bot szekció teljes szélességben mobilon

---

### B.3 Vizuális Javítások

1. **Bot kártyák frissítése:**
   - Kompaktabb kivitel
   - Színkódolt teljesítmény (zöld ha pozitív PnL, piros ha negatív)
   - Sparkline mini-chart minden bot kártyán
   
2. **Aggregált metrikák panel:**
   - Összesített bot P&L grafikon
   - Stratégia comparison bar chart
   - Legjobb/legrosszabb bot kiemelése

3. **Egységes design language:**
   - Glass card stílus mindenhol
   - Egységes spacing
   - Monospace fontok a számoknál

---

## Végrehajtási Sorrend

### Fázis 1 — Elemzés & Diagnosztika (1-2 óra)
1. Historikus eredmények kinyerése és elemzése
2. Stratégiák rangsorolása win rate alapján
3. Problémás stratégiák azonosítása

### Fázis 2 — Bot Optimalizálás (2-3 óra)
1. Strategy Coordinator compatible strategies map javítás
2. Stratégia küszöbértékek finomhangolása
3. Risk manager paraméterek frissítés
4. Gyengén teljesítő botok kikapcsolása/javítása
5. Bet sizing konzervatívabbá tétele

### Fázis 3 — UI Konszolidáció (2-3 óra)
1. Hash routing eltávolítása `App.tsx`-ből
2. BotDashboardPage beágyazása a főoldalra
3. Header simplifikáció
4. Collapse-olható szekciók implementálása
5. Responsive layout javítások
6. Vizuális finomhangolás

### Fázis 4 — Tesztelés & Validáció (1 óra)
1. Build ellenőrzés (`bun run build`)
2. Bot futtatás 30 perc → win rate összehasonlítás
3. UI vizuális ellenőrzés böngészőben
4. Meglévő tesztek futtatása (`bun run test`)

---

## Ellenőrzési Terv

### Automatikus tesztek
```bash
# Meglévő tesztek futtatása
bun run test

# Build ellenőrzés
bun run build
```

### Manuális ellenőrzés
1. Böngészőben megnyitni a `localhost:3000`-et
2. Ellenőrizni, hogy a bot szekció a főoldalon van (nem külön /bots)
3. Bot-ok indítása → Run All → 5 perc várakozás → eredmények ellenőrzése
4. Összecsukás/kinyitás működik
5. Responsive mód ellenőrzése (szűkebb ablakméret)

---

> [!NOTE]
> Ez a terv két fő részből áll: **RÉSZ A** (bot logika optimalizálás) és **RÉSZ B** (UI konszolidáció). Mindkét rész egymástól függetlenül végrehajtható, de javasolt sorrendben haladni (először a botok, azután az UI).
