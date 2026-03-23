# Polymarket Demo - Optimalizációs Terv

## Áttekintés

Ez a dokumentum a következő fejlesztéseket tartalmazza:
1. **Live Balance API** - Polymarket API-ból valódi egyenleg lekérése
2. **Position Sizing** - Kelly formula alkalmazása a bot-oknál
3. **Real-time Risk Dashboard** - Kockázatkezelési dashboard
4. **Memória-optimalizálás** - Chrome memória használat csökkentése (8GB → <500MB)

---

## 1. Memória-optimalizálás (KRITIKUS)

### Probléma
Hosszú távú futásnál a Chrome 8GB+ memóriát használ a következők miatt:
- TradingView widget példányok nem kerülnek törlésre
- SSE események és logok felhalmozódnak
- Price animation timeout-ok tisztítatlanok
- React state tömbök korlátlan növekedése

### Megoldások

#### 1.1 TradingView Widget Cleanup
```typescript
// src/components/trading-view-widget.tsx
// PROBLÉMA: Widget példányok nem törlődnek
// MEGOLDÁS: widget instance reference és proper cleanup
```

#### 1.2 useTradingData Hook Optimalizálás
- Price animation timeout-ok törlése
- BotLogs limit csökkentése (100 → 30)
- PnL history idő alapú korlátozása (utolsó 10 perc)
- Memory cleanup interval hozzáadása

#### 1.3 SSE Client Management
- Server oldalon client timeout kezelés
- Heartbeat javítás
- Disconnect detection

### Implementáció

#### Fájl: `src/components/trading-view-widget.tsx`
```typescript
// Widget instance reference és cleanup
const widgetRef = useRef<unknown>(null);

useEffect(() => {
  // Cleanup previous widget
  if (widgetRef.current) {
    try {
      // TradingView widget cleanup
      (widgetRef.current as any)?.remove?.();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  // ... create new widget
  widgetRef.current = widget;
}, [symbol, interval]);
```

#### Fájl: `src/hooks/useTradingData.ts`
```typescript
// Animation timeout cleanup
const animationTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

// Clear all timeouts on unmount
useEffect(() => {
  return () => {
    animationTimeoutsRef.current.forEach(clearTimeout);
  };
}, []);

// Memory cleanup interval - minden 5 percben
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    // Trim botLogs to last 30 entries
    setBotLogs(prev => prev.slice(0, 30));

    // Trim pnlHistory to last 10 minutes
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    setPnLHistory(prev => prev.filter(p => p.time > tenMinAgo));
  }, 5 * 60 * 1000);

  return () => clearInterval(cleanupInterval);
}, []);
```

---

## 2. Live Balance API

### Cél
Valódi Polymarket egyenleg lekérése API-n keresztül.

### Implementáció

#### Fájl: `src/lib/providers/polymarket-provider.ts`
```typescript
async fetchAccountBalance(): Promise<{
  balance: number;
  available: number;
  locked: number;
}> {
  if (!this.config.apiKey) {
    throw new Error('Polymarket API key not configured');
  }

  const response = await fetch(`${POLY_API_URL}/balance`, {
    headers: {
      'Authorization': `Bearer ${this.config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch balance');
  }

  return response.json();
}
```

#### API Endpoint: `GET /api/account/balance`
```typescript
// src/server.ts
if (path === '/api/account/balance' && method === 'GET') {
  try {
    const balance = await polymarketProvider.fetchAccountBalance();
    return Response.json({ success: true, ...balance });
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to fetch live balance',
      fallback: bots.reduce((sum, b) => sum + b.portfolio.balance, 0)
    });
  }
}
```

---

## 3. Kelly Criterion Position Sizing

### Cél
A bot-ok automatikusan Kelly formula alapján számolják a tét méretét.

### Kelly Formula
```
f* = (bp - q) / b
ahol:
  f* = optimális tét aránya
  b  = odds (nyeremény/tét arány)
  p  = nyerési valószínűség
  q  = 1 - p (vesztési valószínűség)
```

### Implementáció

#### Fájl: `src/lib/risk-manager.ts`
```typescript
calculateKellySize(
  confidence: number,
  odds: number,
  bankroll: number,
  kellyFraction: number = 0.25 // Quarter Kelly for safety
): number {
  // b = odds, p = confidence
  const b = odds > 0 ? (1 - odds) / odds : 1;
  const p = confidence;
  const q = 1 - p;

  // Kelly formula: f* = (bp - q) / b
  let kelly = (b * p - q) / b;

  // Safety: never risk more than 25% of Kelly
  kelly = kelly * kellyFraction;

  // Clamp to reasonable bounds
  kelly = Math.max(0, Math.min(kelly, 0.25)); // 0-25% of bankroll

  return bankroll * kelly;
}
```

#### Bot Integráció
```typescript
// src/lib/bot-manager.ts - a placeTrade logikában
const kellySize = riskManager.calculateKellySize(
  signal.confidence,
  marketPrice.yesPrice, // vagy noPrice
  portfolio.balance,
  bot.kellyFraction ?? 0.25
);

const finalBetSize = Math.min(kellySize, maxBet);
```

---

## 4. Real-time Risk Dashboard

### Cél
Valós idejű kockázatkezelési dashboard a következőkkel:
- Összes bot kockázati státusza
- Drawdown monitoring
- Exposure tracking
- Warning alerts

### UI Komponensek

#### Fájl: `src/components/RiskDashboard.tsx`
```typescript
interface RiskMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'safe' | 'warning' | 'critical';
}

export function RiskDashboard() {
  const [metrics, setMetrics] = useState<RiskMetric[]>([]);

  // Real-time risk metrics
  const totalExposure = positions.reduce((sum, p) => sum + p.stake, 0);
  const maxDrawdown = Math.max(...bots.map(b => b.portfolio.maxDrawdown || 0));
  const winRate = calculateWinRate(bots);

  return (
    <div className="risk-dashboard">
      {/* Risk meters */}
      {/* Exposure chart */}
      {/* Warning list */}
    </div>
  );
}
```

---

## Implementációs Sorrend

### Phase 1: Memória-optimalizálás (Kritikus)
1. TradingView widget cleanup
2. useTradingData memory management
3. SSE client timeout handling
4. Animation timeout cleanup

### Phase 2: Kelly Position Sizing
1. Kelly formula implementálás a risk-manager.ts-ben
2. Bot-ok integrálása a Kelly számítással
3. UI a Kelly fraction beállításához

### Phase 3: Live Balance API
1. Polymarket API hívás implementálása
2. API endpoint létrehozása
3. Frontend integráció
4. Fallback mechanizmus demo módhoz

### Phase 4: Risk Dashboard
1. RiskDashboard komponens
2. Real-time metrikák
3. Warning rendszer
4. UI integráció a Settings panelbe

---

## Tesztelési Terv

### Memória Teszt
```bash
# Futtatás 2 órán keresztül
# Chrome DevTools Memory profiler
# Baseline: 8GB → Cél: <500MB
```

### Kelly Teszt
```bash
# Backtest Kelly vs fixed sizing
# Expected: Kelly outperforms by 10-30%
```

### Live Balance Teszt
```bash
# API válaszidő < 500ms
# Fallback működik demo módban
```

---

## Függőségek

Nincs új npm csomag szükséges. Minden funkcionalitó meglévő függőségekkel megvalósítható.

---

## Becsült Idő

| Feladat | Idő |
|---------|-----|
| Memória-optimalizálás | 2-3 óra |
| Kelly Position Sizing | 1-2 óra |
| Live Balance API | 1-2 óra |
| Risk Dashboard | 2-3 óra |
| **Összesen** | **6-10 óra** |