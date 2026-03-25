# PolyTrade – Kódelemzés, Bug Report & Fejlesztési Javaslatok

**Elemzés dátuma:** 2026-03-25  
**Projekt verzió:** 2.0  
**Vizsgált fájlok:** 123 forrás fájl

---

## Tartalom

1. [🔴 Kritikus Bugok](#kritikus-bugok)
2. [🟠 Számítási Hibák](#szamitasi-hibak)
3. [🟡 UI/UX Problémák](#uiux-problemak)
4. [🔵 Kódminőségi Problémák](#kodminoseogi-problemak)
5. [⚡ Teljesítmény Problémák](#teljesitmeny-problemak)
6. [💡 Fejlesztési Javaslatok](#fejlesztesi-javaslatok)

---

## 🔴 KRITIKUS BUGOK

### BUG-001: Helytelen Unrealized PnL számítás a BotStatusCard-ban

**Fájl:** `src/components/BotStatusCard.tsx`  
**Súlyosság:** Kritikus – teljesen hibás értékeket mutat

```typescript
// HIBÁS KÓD:
const unrealizedPnl = botPositions.reduce((sum, pos) => {
  if (pos.outcome === "YES") {
    return sum + (pos.amount * yesPrice - pos.stake);  // ← HIBÁS!
  }
  return sum + (pos.amount * (1 - yesPrice) - pos.stake);
}, 0);
```

**A hiba magyarázata:**  
- `pos.stake` = `amount / entryOdds` (pl. 10 / 0.6 = 16.67 $)  
- A képlet `amount * currentPrice - stake` = `10 * 0.7 - 16.67 = -9.67` → negatív, bár nyerő pozícióban vagyunk!

**Helyes számítás** (ahogy a `market-engine.ts` csinálja):
```typescript
// HELYES:
const currentValue = pos.amount * (currentOdds / pos.odds);
const unrealizedPnl = currentValue - pos.amount - pos.fee;
```

**Javítás:**
```typescript
const unrealizedPnl = botPositions.reduce((sum, pos) => {
  const currentOdds = pos.outcome === "YES" ? yesPrice : (1 - yesPrice);
  const entryOdds = pos.odds; // entry price
  const currentValue = pos.amount * (currentOdds / entryOdds);
  return sum + (currentValue - pos.amount - (pos.fee || 0));
}, 0);
```

---

### BUG-002: Helytelen PnL rendezés a SessionHistoryTab-ban

**Fájl:** `src/components/SessionHistoryTab.tsx`  
**Súlyosság:** Kritikus – az összehasonlítás teljesen hibás

```typescript
// HIBÁS KÓD:
case 'pnl':
  comparison = (a.endBalance || 0) - (b.startBalance)   // ← a végét b kezdetéhez hasonlítja!
               - ((b.endBalance || 0) - b.startBalance);
```

**Javítás:**
```typescript
case 'pnl':
  const aPnl = (a.endBalance || 0) - a.startBalance;
  const bPnl = (b.endBalance || 0) - b.startBalance;
  comparison = aPnl - bPnl;
  break;
```

---

### BUG-003: Bot Win Rate helytelen számítása

**Fájl:** `src/lib/bot-manager.ts` – `updateBotStats()` metódus  
**Súlyosság:** Kritikus – megtévesztő statisztikákat mutat

```typescript
private updateBotStats(botId: string, position: Position): void {
  bot.stats.trades++;  // ← Minden megnyitott pozíciónál nő
  
  if (position.pnl !== null) {  // ← De pnl csak settlement után nem null!
    if (position.pnl > 0) {
      bot.stats.wins++;
```

**Probléma:** Az újonnan nyitott pozíciók `pnl === null`, de a `trades` számlálóba beleszámolnak. Ez azt jelenti, hogy ha 10 pozíciót nyit a bot és 5 már lezárult (3 win), a win rate = 3/10 = 30%, ahelyett hogy 3/5 = 60% lenne.

**Javítás:**
```typescript
private updateBotStats(botId: string, position: Position): void {
  // Ne számoljuk bele a trade-et, amíg nem settled
  if (position.pnl === null) return;
  
  bot.stats.trades++;
  if (position.pnl > 0) {
    bot.stats.wins++;
    // ...
  }
}
```

---

### BUG-004: Bot timer nem frissül a UI-ban

**Fájl:** `src/components/BotStatusCard.tsx`  
**Súlyosság:** Közepes – statikus értéket mutat

```typescript
// Ez csak egyszer számolódik rendereléskor, nem frissül!
const runningTime = bot.enabled && bot.runTime ? Date.now() - bot.runTime : 0;
```

A `runningTime` értéke statikus marad, amíg a komponens újra nem renderelődik. A timer soha nem "ketyeg" valós időben.

**Javítás:**
```typescript
const [now, setNow] = useState(Date.now());

useEffect(() => {
  if (!bot.enabled) return;
  const timer = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(timer);
}, [bot.enabled]);

const runningTime = bot.enabled && bot.runTime ? now - bot.runTime : 0;
```

---

### BUG-005: Dupla fee a pozíció lezárásakor

**Fájl:** `src/lib/market-engine.ts` – `closePosition()` metódus  
**Súlyosság:** Közepes – rosszul számolja a tényleges hozamot

```typescript
// Pozíció nyitáskor: fee = amount * 0.02 (2%)
// Pozíció záráskor:
const exitValue = position.amount * (currentOdds / position.odds) * 0.98; // ← +2% zárási fee
```

A felhasználó kétszer fizet díjat: egyszer nyitáskor, egyszer záráskor. Ez nincs kommunikálva a UI-ban, és inkonzisztens a settlement logikával (ott csak egyszer van fee).

**Javítás opciók:**
- A) Dokumentáld egyértelműen a UI-ban hogy korai záráskor 2% extra fee van
- B) Egységesíts: vagy nyitáskor van fee, vagy záráskor, de nem mindkettő

---

## 🟠 SZÁMÍTÁSI HIBÁK

### CALC-001: Kelly Criterion helytelenül van implementálva

**Fájl:** `src/lib/bot-manager.ts`  
**Súlyosság:** Közepes

```typescript
// Jelenlegi "Kelly":
const edge = Math.abs(yesPrice - 0.5);
const kellyBet = portfolio.balance * edge * (bot.kellyFraction || 0.25);
```

Ez nem Kelly Criterion. Az igazi Kelly: `f = (p * b - q) / b`  
ahol `p` = nyerési valószínűség, `b` = nyeremény aránya, `q = 1 - p`

**Példa különbség:**  
- Jelenlegi: yesPrice=0.6, edge=0.1, balance=100 → bet = 100 * 0.1 * 0.25 = $2.50
- Valódi Kelly: p=0.6, b=(1/0.6)-1=0.667, q=0.4 → f = (0.6*0.667-0.4)/0.667 = 0.2/0.667 = 30% → bet = $30

**Javítás:**
```typescript
if (bot.useKelly) {
  const p = decision.action === "YES" ? yesPrice : noPrice; // implied win probability
  const b = (1 / p) - 1; // net odds
  const q = 1 - p;
  const kelly = Math.max(0, (p * b - q) / b);
  betSize = portfolio.balance * kelly * (bot.kellyFraction || 0.25);
  betSize = Math.min(betSize, bot.maxBet || betSize);
}
```

---

### CALC-002: ROI számítás inkonzisztens

**Fájl:** `src/components/PortfolioPanel.tsx` és `src/types/index.ts`

```typescript
// PortfolioPanel compact módban:
roi >= 0 ? "+" : ""}{formatPercentage(roi / 100)}
// Ez a roi értékét 100-zal osztja, de a roi már százalékban van!
```

A `Portfolio` típusban `roi` 100-szorosban van tárolva (pl. 15.5 = 15.5%), de:
- A `formatPercentage` függvény `value * 100`-t csinál
- Ha `roi = 15.5` és `formatPercentage(roi / 100)` → `15.5/100 * 100 = 15.5%` ✓
- De ha `roi = 0.155` → `0.155/100 * 100 = 0.155%` ✗

Ez attól függ hogy a backend milyen formátumban adja vissza a roi-t. A `market-engine.ts`-ben:
```typescript
portfolio.roi = (portfolio.totalPnL / portfolio.initialBalance) * 100;
// → roi = 15.5 (százalék)
```

Tehát `formatPercentage(roi / 100)` helyes, DE a `footer.tsx`-ben:
```typescript
formatPercentage((portfolio?.roi || 0) / 100)
```
Ez megduplázza az osztást ha a roi már százalékban van. Egységesíteni kell.

---

### CALC-003: Sharpe Ratio nem annualizált megfelelően

**Fájl:** `src/lib/analytics.ts` – `calculateRollingSharpe()`

```typescript
const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(250) : 0;
```

A `Math.sqrt(250)` éves kereskedési napokra vonatkozik részvénypiacon, de ez egy rövid távú prediction market simulator. A helyes annualizálási faktor attól függ, hogy hány trade van naponta. Ha a botok percenként kereskednek, a szorzó teljesen más.

---

### CALC-004: Profit Factor infinity kezelés hiányos

**Fájl:** `src/components/PerformanceCharts.tsx`

```typescript
profitFactor: isFinite(profitFactor) ? profitFactor : 0,
```

Ha nincs egyetlen vesztes trade sem, a profit factor ∞ kellene legyen (ami helyes), de itt 0-ra van cserélve, ami azt sugallja, hogy rossz a stratégia. Helyesebb lenne `999` vagy egy "∞" szöveg megjeleníteni.

---

## 🟡 UI/UX PROBLÉMÁK

### UI-001: "Return" vs "Profit" félrevezető megjelölés

**Fájl:** `src/components/TradingPanel.tsx`

```typescript
<p className="text-xs ...">
  Return: {formatCurrency(tradeDirection === "YES" ? yesPayout : noPayout)}
</p>
```

A `yesPayout = tradeAmount / yesPrice` a **teljes visszatérítés** (beleértve az eredeti tétet), nem a profit. A felhasználók azt hihetik ez a nyereség.

**Javítás:** Vagy "Payout (inc. stake)" legyen a felirat, vagy a `yesPayout - tradeAmount - fee` értéket mutassa "Profit" felirattal.

---

### UI-002: Bot activity log üres állapotban nincs útmutatás

**Fájl:** `src/components/BotPanel.tsx`

Az üres állapot (`"No bot activity yet"`) után csak ennyit ír: `"Start the bots to see live trading activity."` – de a Start gomb nem kiemelve jelenik meg, és nincs vizuális kapcsolat az üzenet és a gomb között.

---

### UI-003: Responsive grid törés mobilon

**Fájl:** `src/components/App.tsx`

```typescript
style={{
  display: "grid",
  gridTemplateColumns: "320px 1fr 360px",  // ← Nem responsive!
```

Kisebb képernyőkön (pl. 1024px alatt) a fix pixel értékek overflow-t okoznak. Nincs `@media` query kezelés ebben a komponensben.

---

### UI-004: Timer display nem mutat órákat

**Fájl:** `src/components/MarketCard.tsx`

```typescript
function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}
```

1 napos és 4 órás marketeknél ez `240:00` vagy `1440:00`-t mutat. Kellene `1h 30m` formátum.

**Javítás:**
```typescript
function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `0:${seconds.toString().padStart(2, "0")}`;
}
```

---

### UI-005: Probability bar percent és ár értékek nem egyeznek

**Fájl:** `src/components/MarketCard.tsx`

```typescript
<div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.375rem" }}>
  <span style={{ color: "var(--green)", fontWeight: 600 }}>{(yesPrice * 100).toFixed(1)}%</span>
  <span style={{ color: "var(--red)", fontWeight: 600 }}>{(noPrice * 100).toFixed(1)}%</span>
</div>
```

A százalék felirat (`71.2%`) azt sugallja a piacok valószínűséget mutatnak, de a YES/DOWN árcédulák `71.2¢`-t mutatnak. Ez konzisztens, de zavaró lehet: a probability bar bal oldala a YES, jobb oldala a NO, de a UI-ban az UP piros és a DOWN zöld, ami ellentmond a szokásos traderlogikának (zöld = up).

---

### UI-006: Positions Panel hiányzik a Portfolio "compact" módból

**Fájl:** `src/components/PortfolioPanel.tsx`

A compact módban csak balance, P&L, ROI, Win Rate, Trades, Positions (db) látszik, de az egyes pozíciók listája nem. Nincs közvetlen "close position" lehetőség compact módban.

---

### UI-007: Competition Tab leaderboard nem frissíti a rangot valós időben

**Fájl:** `src/components/CompetitionTab.tsx`

```typescript
useEffect(() => {
  fetchCompetitionState();
  const interval = setInterval(fetchCompetitionState, 2000);
```

2 másodpercenként frissül, de ha gyors bot kereskedés van, a rangsor látható ugrásokat/villogást produkálhat a UI-ban.

---

### UI-008: Bot Dashboard "Run All" és "Stop All" gombokra nincs loading state

**Fájl:** `src/components/BotDashboardPage.tsx`

```typescript
const handleRunAll = useCallback(async () => {
  await fetch("/api/bots/run-all", { ... });
  await fetchData();
}, [fetchData]);
```

A gomb kattintás után nincsen vizuális visszajelzés (spinner, disabled state). A felhasználó nem tudja, hogy a kérés teljesült-e.

---

## 🔵 KÓDMINŐSÉGI PROBLÉMÁK

### CODE-001: SVG gradient ID ütközés többszörös chart esetén

**Fájl:** `src/components/pnl-chart.tsx`

```typescript
<linearGradient id="pnlGradient" ...>
```

Ha több PnLChart renderelődik egyidejűleg (pl. bot dashboard + portfolio panel), mindkettő "pnlGradient" id-t használ. Az SVG spec szerint az első definíció érvényes, így az egyik chart rosszul fog kinézni.

**Javítás:**
```typescript
const gradientId = `pnlGradient-${Math.random().toString(36).substr(2, 9)}`;
// Vagy props-ból kapott egyedi id
```

---

### CODE-002: Memory leak – BinanceKlineProvider reconnect

**Fájl:** `src/lib/providers/binance-kline-provider.ts`

```typescript
private attemptReconnect(): void {
  setTimeout(() => this.connect(), delay);
}

private connect(): void {
  this.ws = new WebSocket(wsUrl);  // ← Régi ws nem kerül lezárásra!
```

Ha az előző WebSocket még nyitva van `CLOSING` állapotban, és már egy újat nyitunk, az esemény handlerek és referenciák bent maradnak a memóriában.

**Javítás:**
```typescript
private connect(): void {
  if (this.ws) {
    this.ws.onclose = null;  // Előzze meg a rekurzív reconnect-et
    this.ws.close();
    this.ws = null;
  }
  this.ws = new WebSocket(wsUrl);
  // ...
}
```

---

### CODE-003: Race condition – gyors bot toggle

**Fájl:** `src/components/BotStatusCard.tsx`

```typescript
const handleToggle = async () => {
  if (isToggling) return;
  setIsToggling(true);
  try {
    await onToggle(bot.id);
  } finally {
    setIsToggling(false);
  }
};
```

Ez jól védi az egyes kártyát, de a LiveMonitorTab-ban nincs globális lock. Ha a felhasználó gyorsan váltja a "Run All" / "Stop All" gombokat és közben egy bot kártyán kattint, a szerver állapot és a UI szinkronból eshet.

---

### CODE-004: Unused `bot` parameter a `saveBotSessionToDB`-ban

**Fájl:** `src/lib/bot-manager.ts`

```typescript
private saveBotSessionToDB(session: BotSession, bot?: BotConfig | null): void {
  dbService.saveBotSession({
    // bot soha nincs használva!
  })
}
```

---

### CODE-005: Type Safety hiányok

**Fájl:** `src/components/App.tsx`

```typescript
function useRoute(): [string, (route: string) => void] {
```

A `route` típusa `string`, de ténylegesen csak `'trading' | 'bots'` lehet. Ha valaki más értéket ad meg, runtime hiba lesz navigálásnál.

**Javítás:**
```typescript
type Route = 'trading' | 'bots';
function useRoute(): [Route, (route: Route) => void] {
```

---

### CODE-006: Duplikált `formatDuration` függvény

Ugyanaz a `formatDuration` függvény meg van írva legalább 4 helyen:
- `src/components/SessionHistoryTab.tsx`
- `src/components/BotStatusCard.tsx`  
- `src/components/CompetitionTab.tsx`
- `src/components/SessionDetailPanel.tsx`

Ezek mindegyike kicsit különböző implementáció (egyesek ms-t, mások ms-t vesznek, de másképp számolnak). Centralizálni kellene a `src/lib/utils.ts`-ben.

---

### CODE-007: Hiányzó error boundary-k

A bot dashboard és trading lapok nem rendelkeznek granulált error boundary-kkal. Ha egy bot kártya hibás adatot kap, az egész oldal crashel az `ErrorBoundary` komponensig.

---

### CODE-008: Console.log-ok a production kódban

Rengeteg `console.log` marad a production kódban:
- `[BinanceProvider] WebSocket connected`
- `[MarketEngine] Active market: ...`
- `[BotManager] Bot ${id} toggled...`

Ezeket egy logger middleware mögé kellene rakni, amit production-ban lehet kikapcsolni.

---

## ⚡ TELJESÍTMÉNY PROBLÉMÁK

### PERF-001: SSE duplikált broadcast

**Fájl:** `src/server.ts`

```typescript
// Ez minden egyes price update-nél broadcast-ol:
marketEngine.onPriceUpdate((price) => {
  broadcastUpdate({ type: 'market', data: ... })
})

// ÉS ez is minden másodpercben broadcast-ol:
setInterval(() => {
  broadcastUpdate({ type: 'market', data: ... })
}, 1000)
```

Ez azt jelenti, hogy ha a Polymarket API 500ms-nként frissíti az árakat, a kliens **másodpercenként 3+ SSE üzenetet** kap azonos adattal. Nagy terhelés esetén ez feleslegesen terheli a kapcsolatot.

**Javítás:** Csak az interval-alapú broadcast-ot tartsd meg, vagy throttle-özd a price update callback-et.

---

### PERF-002: Felesleges re-renderek a bots lista miatt

**Fájl:** `src/components/BotDashboardPage.tsx`

```typescript
useEffect(() => {
  const fetchPositions = async () => {
    const res = await fetch("/api/positions");
    const data = await res.json();
    setPositions(data.open || []);
  };
  fetchPositions();
  const interval = setInterval(fetchPositions, 3000);
```

Ez 3 másodpercenként frissíti az összes pozíciót, ami az összes `BotStatusCard` újrarenderelését okozza, még akkor is, ha semmi sem változott. Kellene egy deep equality check, vagy WebSocket/SSE alapú frissítés.

---

### PERF-003: Analytics számítások minden rendereléskor lefutnak

**Fájl:** `src/components/PortfolioAnalytics.tsx`

```typescript
const stats = useMemo(() => {
  // Komplex számítások...
  const settled = positions.filter(...)
  // ...
}, [portfolio, positions]);
```

A `positions` tömb referenciája változik minden API fetch-nél, ezért a `useMemo` mindig újraszámol. Ha van 1000 pozíció és 5 különböző `useMemo`, ez lassú lehet.

---

### PERF-004: PriceService duplikált WebSocket és polling

**Fájl:** `src/lib/price.ts`

```typescript
constructor() {
  this.startWebSocket();  // WebSocket connection
  this.startPolling();    // ÉS polling is!
}
```

A rendszer egyszerre tart fenn WebSocket kapcsolatot ÉS 3 másodpercenként HTTP polling-ot. Ez felesleges. A polling fallback-nek csak akkor kellene aktiválódnia, ha a WebSocket nem elérhető.

---

## 💡 FEJLESZTÉSI JAVASLATOK

### FEAT-001: Real-time pozíció érték számítás javítása

Jelenleg az unrealized PnL csak az `getPortfolio()` híváskor frissül. Kellene egy `useEffect` hook, ami automatikusan újraszámítja a pozíciók értékét, ha a YES/NO ár változik, SSE-n keresztül.

---

### FEAT-002: Bot teljesítmény historikus chartok

A `BotStatusCard`-ban csak statikus számok látszanak (balance, pnl, trades). Kellene egy mini sparkline chart, ami az egyedi bot balance-ának változását mutatja az idő függvényében.

---

### FEAT-003: Pozíció méret és kockázat jelzés

Amikor a felhasználó manuálisan place-el trade-et, nincs jelzés arról, hogy ez a balance hány %-a. Kellene egy "Risk: 12% of balance" felirat.

---

### FEAT-004: Bot stratégia leírások a kártyákon

A `BotConfigPanel`-ban van leírás, de a `BotStatusCard`-ban csak a stratégia neve látszik (`binance_signal`). Egy tooltip vagy rövid leírás sokat segítene a felhasználónak.

---

### FEAT-005: Timeout kezelés a fetch hívásokban

A legtöbb API hívásban nincs timeout:
```typescript
await fetch("/api/bots");
// Ha a szerver lassan válaszol, a UI örökre loading state-ben marad
```

**Javítás:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch("/api/bots", { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

---

### FEAT-006: Trades export komplex szűréssel

A `TradeFeed` exportálja a trade-eket CSV-be, de az export a szűrt eredményre vonatkozik. Kellene egy "Export All" opció is, ami az összes trade-et exportálja szűrés nélkül.

---

### FEAT-007: Market változás notifikáció

Amikor a market settles (pl. 5 perces market lejár), nincs vizuális jelzés a felhasználónak (egyéb mint az eredmény megjelenése). Kellene egy toast notification: "Market settled: UP / +$4.50 profit!"

---

### FEAT-008: Bot autostop ha balance elfogy

Jelenleg ha egy bot `portfolio.balance < betSize + fee`, a trade nem kerül végrehajtásra, de a bot tovább fut és próbálkozik. Kellene automatikusan disabled-re tenni a botot ha az egyenlege 0 alá kerülne, és erről értesíteni a felhasználót.

---

## ÖSSZEFOGLALÓ PRIORITÁSI LISTA

| Prioritás | ID | Leírás | Hatás |
|-----------|-----|--------|-------|
| 🔴 P1 | BUG-001 | Unrealized PnL számítás hiba BotStatusCard-ban | Hibás adatok megjelenítése |
| 🔴 P1 | BUG-002 | SessionHistory PnL rendezés teljesen hibás | Funkció nem működik |
| 🔴 P1 | BUG-003 | Win Rate számlálási hiba | Megtévesztő statisztikák |
| 🔴 P1 | BUG-004 | Bot timer nem frissül valós időben | UX törés |
| 🟠 P2 | BUG-005 | Dupla fee pozíció zárásnál | Pénzügyi pontatlanság |
| 🟠 P2 | CALC-001 | Kelly Criterion helytelen implementáció | Bot stratégia nem optimális |
| 🟠 P2 | CALC-002 | ROI százalék inkonzisztens megjelenítés | Megtévesztő értékek |
| 🟡 P3 | UI-001 | Return vs Profit félrevezető felirat | UX confusion |
| 🟡 P3 | UI-004 | Timer nem mutat órákat | Funkcionális hiányosság |
| 🟡 P3 | UI-007 | Competition leaderboard villogás | UX probléma |
| 🔵 P4 | CODE-001 | SVG gradient ID ütközés | Vizuális bug |
| 🔵 P4 | CODE-002 | Memory leak WebSocket reconnect | Teljesítmény |
| 🔵 P4 | CODE-006 | Duplikált formatDuration | Karbantarthatóság |
| ⚡ P4 | PERF-001 | Duplikált SSE broadcast | Teljesítmény |
| ⚡ P4 | PERF-004 | Duplikált WebSocket + polling | Erőforrás pazarlás |

---

*Dokumentum generálva: 2026-03-25*  
*Elemzett commit: aktuális working tree*
