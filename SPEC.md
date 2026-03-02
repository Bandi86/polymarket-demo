# Polymarket Demo Szimulátor - Specifikáció

## 1. Projekt Áttekintés

**Projekt neve:** Polymarket Demo Szimulátor  
**Típus:** Webalkalmazás (Bun + React + TypeScript)  
**Cél:** Valós idejű Polymarket piacok megjelenítése szimulált kereskedéssel és bot stratégiákkal

## 2. Funkcionális Követelmények

### P 2.1iac Adatok Megjelenítése
- Valós Polymarket API-ból származó piacok lekérése
- Piacok listája: kérdés, leírás, kategóriák
- Árfolyamok megjelenítése (Yes/No) valós időben
- Piac állapot: Active, Closed, Resolved
- Volumen és likviditás adatok

### 2.2 Szimulált Kereskedés
- Virtuális egyenleg: $10,000 kezdőtőke
- Demo számla létrehozása
- Fogadás types: YES / NO
- Pozíció méret beállítása
- Kereskedési történet
- Valós idejű egyenleg frissítés

### 2.3 Bot Stratégiák
- **Random Bot:** Véletlenszerű döntések alapú kereskedés
- **Momentum Bot:** Ártrend követő stratégia
- **Mean Reversion Bot:** Átlaghoz való visszatérés
- **Signal Bot:** Külső signal alapú kereskedés
- Bot ON/OFF kapcsoló
- Bot teljesítmény követés

### 2.4 Manuális Fogadás
- Piac kiválasztása
- YES/NO fogadás
- Összeg beállítás
- Odds megjelenítés
- Azonnali végrehajtás

### 2.5 Teljesítmény Követés
- Összes PnL (Profit and Loss)
- Win rate számítás
- Aktív pozíciók
- Zárt pozíciók története
- ROI százalék
- Grafikon megjelenítés

## 3. Műszaki Specifikáció

### 3.1 Tech Stack
- **Backend:** Bun + Hono (Bun native)
- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** React Context + useState
- **API:** Polymarket GraphQL API

### 3.2 API Integráció
```graphql
# Polymarket GraphQL Endpoint
https://clob.polymarket.com/graphql

# Piac lekérés
query GetMarkets($cursor: String) {
  markets(first: 20, orderBy: "volumeNum", orderDirection: "desc", cursor: $cursor) {
    id
    question
    description
    volumeNum
    liquidity
    outcomes
    endDate
    state
  }
}
```

### 3.3 Adat Modellek

```typescript
interface Market {
  id: string;
  question: string;
  description: string;
  volumeNum: number;
  liquidity: number;
  outcomes: string[];
  endDate: string;
  state: 'active' | 'closed' | 'resolved';
  outcomePrices?: { [key: string]: string };
}

interface Position {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: 'YES' | 'NO';
  amount: number;
  odds: number;
  timestamp: number;
  status: 'open' | 'closed' | 'settled';
  pnl?: number;
}

interface BotConfig {
  id: string;
  name: string;
  type: 'random' | 'momentum' | 'mean_reversion' | 'signal';
  enabled: boolean;
  betSize: number;
  interval: number;
}

interface Portfolio {
  balance: number;
  positions: Position[];
  totalPnL: number;
  winRate: number;
  roi: number;
}
```

## 4. UI/UX Specifikáció

### 4.1 Oldalszerkezet

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo + Navigation + Account Balance                │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                          │
│  Sidebar         │  Main Content Area                       │
│  - Markets       │  - Market Cards / Detail                 │
│  - Trading       │  - Trading Panel                         │
│  - Bots          │  - Bot Controls                          │
│  - Portfolio     │  - Portfolio Dashboard                   │
│  - History       │  - Charts & Stats                        │
│                  │                                          │
├──────────────────┴──────────────────────────────────────────┤
│ Footer: Status Bar + API Connection Status                  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Színskála
- **Background:** #0a0a0f (sötét)
- **Surface:** #12121a (kártyák)
- **Primary:** #6366f1 (indigo)
- **Success:** #22c55e (zöld - profit)
- **Danger:** #ef4444 (piros - veszteség)
- **Text Primary:** #fafafa
- **Text Secondary:** #a1a1aa

### 4.3 Komponensek
- MarketCard: Piac adatokkal
- TradingPanel: Fogadás űrlap
- BotControl: Bot beállítások
- PortfolioStats: Statisztikák
- TradeHistory: Korábbi kereskedések
- PriceChart: Árfolyam grafikon

## 5. API Végpontok

```
GET  /api/markets          - Piacok listája
GET  /api/markets/:id      - Piac részletek
GET  /api/markets/:id/price - Aktuális árak
POST /api/trade            - Fogadás létrehozása
GET  /api/portfolio       - Portfolio adatok
GET  /api/history         - Kereskedési történet
POST /api/bots/:id/toggle - Bot be/ki kapcsolás
GET  /api/bots/:id/stats  - Bot statisztikák
```

## 6. Akcióterv

1. **Setup:** API klient, típusok, utils
2. **Backend:** API route-ok, state management
3. **Frontend:** Komponensek, oldalak
4. **Integráció:** Frontend-Backend kommunikáció
5. **Testing:** Funkció ellenőrzés
