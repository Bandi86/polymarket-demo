# Next.js 16 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing Bun + React SPA to Next.js 16 App Router with Zustand state management.

**Architecture:** Big Bang migration - create new Next.js structure alongside existing code, then switch over. Uses global singleton pattern for service instances, Zustand for state management, and Next.js Route Handlers for API endpoints including SSE streaming.

**Tech Stack:** Next.js 16.2.1, React 19.2.4, Zustand 5.0.12, Tailwind CSS 4.2.2, TypeScript 5.7+

**Spec:** `docs/superpowers/specs/2026-03-24-nextjs-migration-design.md`

---

## File Structure Map

### New Files to Create

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with fonts and providers |
| `app/page.tsx` | Main app page |
| `app/globals.css` | Global styles |
| `app/providers.tsx` | Client providers wrapper |
| `app/api/sse/route.ts` | SSE streaming endpoint |
| `app/api/market/route.ts` | Market data endpoints |
| `app/api/bots/route.ts` | Bot list endpoint |
| `app/api/bots/run-all/route.ts` | Run all bots |
| `app/api/bots/stop-all/route.ts` | Stop all bots |
| `app/api/bots/reset-all/route.ts` | Reset all bots |
| `app/api/bots/logs/route.ts` | Bot logs |
| `app/api/bots/[id]/toggle/route.ts` | Toggle single bot |
| `app/api/competition/route.ts` | Competition status |
| `app/api/competition/start/route.ts` | Start competition |
| `app/api/competition/stop/route.ts` | Stop competition |
| `app/api/competition/clear/route.ts` | Clear competition |
| `app/api/competition/quick-run/route.ts` | Quick run |
| `app/api/competition/one-hour-run/route.ts` | 1-hour run |
| `app/api/competition/export/route.ts` | Export data |
| `app/api/positions/route.ts` | Positions endpoint |
| `app/api/portfolio/route.ts` | Portfolio endpoint |
| `app/api/trade/route.ts` | Trade endpoint |
| `app/api/sessions/route.ts` | Sessions endpoint |
| `app/api/strategy/strategies/route.ts` | Strategies list |
| `app/api/strategy/analyze/route.ts` | Strategy analysis |
| `app/api/signal/route.ts` | Signal endpoint |
| `app/api/signal/threshold/route.ts` | Signal threshold |
| `app/api/signal/klines/route.ts` | Klines data |
| `app/api/risk/settings/route.ts` | Risk settings |
| `app/api/risk/warnings/route.ts` | Risk warnings |
| `app/api/risk/reset-all/route.ts` | Reset risk |
| `app/api/analytics/rankings/route.ts` | Analytics rankings |
| `app/api/analytics/distribution/route.ts` | Analytics distribution |
| `app/api/analytics/time-performance/route.ts` | Time performance |
| `app/api/analytics/correlation/route.ts` | Correlation data |
| `app/api/analytics/recommendation/route.ts` | Recommendations |
| `app/api/account/route.ts` | Account info |
| `app/api/account/balance/route.ts` | Live balance |
| `app/api/account/sync/route.ts` | Sync account |
| `app/api/account/mode/route.ts` | Trading mode |
| `app/api/orders/positions/route.ts` | Polymarket positions |
| `app/api/orders/trades/route.ts` | Trade history |
| `app/api/orders/place/route.ts` | Place order |
| `app/api/orders/cancel/route.ts` | Cancel order |
| `app/api/backtest/route.ts` | Backtest endpoint |
| `app/api/markets/available/route.ts` | Available markets |
| `app/api/markets/signals/route.ts` | Market signals |
| `app/api/dashboard/route.ts` | Dashboard data |
| `app/api/settings/route.ts` | Settings endpoint |
| `app/api/balance/set-all/route.ts` | Set all balances |
| `app/api/events/route.ts` | Events endpoint |
| `app/api/health/route.ts` | Health check |
| `app/api/reset/route.ts` | Full reset |
| `app/api/debug/engine/route.ts` | Engine debug |
| `app/api/polymarket/test-connection/route.ts` | Test connection |
| `app/api/simulation/toggle/route.ts` | Toggle simulation |
| `app/api/simulation/status/route.ts` | Simulation status |
| `app/api/market/timeframe/route.ts` | Timeframe |
| `app/api/market/switch/route.ts` | Switch market |
| `app/api/market/refresh/route.ts` | Refresh market |
| `app/api/market/history/route.ts` | Market history |
| `app/api/market/asset/route.ts` | Asset endpoint |
| `src/lib/global.ts` | Singleton exports |
| `src/lib/stores/trading-store.ts` | Trading state |
| `src/lib/stores/bot-store.ts` | Bot state |
| `src/lib/stores/ui-store.ts` | UI state |
| `src/hooks/useSSE.ts` | SSE client hook |
| `next.config.ts` | Next.js config |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Update dependencies and scripts |
| `tsconfig.json` | Update for Next.js |
| `src/components/App.tsx` | Convert to client component, use Zustand |
| `src/hooks/useTradingData.ts` | Refactor to use Zustand stores |
| `src/styles.css` | Move to `app/globals.css` |

### Files to Delete (after migration complete)

| File | Reason |
|------|--------|
| `src/server.ts` | Replaced by Next.js API routes |
| `src/index.tsx` | Replaced by Next.js app structure |
| `src/index.html` | Not needed in Next.js |

---

## Phase 1: Project Setup

### Task 1: Create Next.js Configuration Files

**Files:**
- Create: `next.config.ts`
- Create: `tsconfig.json` (update)
- Create: `next-env.d.ts`

- [ ] **Step 1: Create next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Webpack config for better-sqlite3
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('better-sqlite3')
    }
    return config
  },

  // Headers for SSE
  async headers() {
    return [
      {
        source: '/api/sse',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-transform' },
          { key: 'Connection', value: 'keep-alive' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 2: Update tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next-env.d.ts**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 4: Commit**

```bash
git add next.config.ts tsconfig.json next-env.d.ts
git commit -m "chore: add Next.js 16 configuration files"
```

---

### Task 2: Update Package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json with Next.js dependencies**

```json
{
  "name": "polymarket-demo",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zustand": "5.0.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@tanstack/react-query": "^5.95.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.0.1",
    "recharts": "^3.8.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "viem": "^2.47.6",
    "wagmi": "^3.5.0",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@tailwindcss/cli": "^4.2.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
bun install
```

Expected: All dependencies installed successfully

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: update dependencies for Next.js 16 migration"
```

---

## Phase 2: Backend Infrastructure

### Task 3: Create Global Singleton Module

**Files:**
- Create: `src/lib/global.ts`

- [ ] **Step 1: Create global.ts with singleton getters**

```typescript
// src/lib/global.ts
import { MarketEngine } from './market-engine'
import { PriceService } from './price'
import { BotManager } from './bot-manager'
import { DatabaseService } from './database'
import { RiskManager } from './risk-manager'
import { StrategyCoordinator } from './strategy-coordinator'
import { AnalyticsService } from './analytics'
import { BinanceKlineProvider } from './providers/binance-kline-provider'
import { PolymarketProvider } from './providers/polymarket-provider'

// Singleton instances
let marketEngine: MarketEngine | null = null
let priceService: PriceService | null = null
let botManager: BotManager | null = null
let dbService: DatabaseService | null = null
let riskManager: RiskManager | null = null
let strategyCoordinator: StrategyCoordinator | null = null
let analyticsService: AnalyticsService | null = null
let binanceKlineProvider: BinanceKlineProvider | null = null
let polymarketProvider: PolymarketProvider | null = null

export function getMarketEngine(): MarketEngine {
  if (!marketEngine) {
    marketEngine = new MarketEngine()
  }
  return marketEngine
}

export function getPriceService(): PriceService {
  if (!priceService) {
    priceService = new PriceService()
  }
  return priceService
}

export function getBotManager(): BotManager {
  if (!botManager) {
    botManager = new BotManager()
  }
  return botManager
}

export function getDatabaseService(): DatabaseService {
  if (!dbService) {
    dbService = new DatabaseService()
  }
  return dbService
}

export function getRiskManager(): RiskManager {
  if (!riskManager) {
    riskManager = new RiskManager()
  }
  return riskManager
}

export function getStrategyCoordinator(): StrategyCoordinator {
  if (!strategyCoordinator) {
    strategyCoordinator = new StrategyCoordinator()
  }
  return strategyCoordinator
}

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsService) {
    analyticsService = new AnalyticsService()
  }
  return analyticsService
}

export function getBinanceKlineProvider(): BinanceKlineProvider {
  if (!binanceKlineProvider) {
    binanceKlineProvider = new BinanceKlineProvider()
  }
  return binanceKlineProvider
}

export function getPolymarketProvider(): PolymarketProvider {
  if (!polymarketProvider) {
    polymarketProvider = new PolymarketProvider()
  }
  return polymarketProvider
}

// SSE broadcast function (set by SSE route)
let sseBroadcast: ((data: unknown) => void) | null = null

export function setSSEBroadcast(fn: (data: unknown) => void): void {
  sseBroadcast = fn
}

export function broadcastToSSE(data: unknown): void {
  if (sseBroadcast) {
    sseBroadcast(data)
  }
}

// Initialize all services
export async function initializeServices(): Promise<void> {
  const db = getDatabaseService()
  await db.connect()

  // Sync BTC price with polymarket provider
  getPriceService().subscribeToUpdates((update) => {
    getPolymarketProvider().setBtcPrice(update.price)
  })

  // Subscribe bot logs for SSE broadcast
  getBotManager().onLog((log) => {
    broadcastToSSE({ type: 'bot_log', data: log })
  })

  // Subscribe market price updates
  getMarketEngine().onPriceUpdate((price) => {
    broadcastToSSE({
      type: 'market',
      data: {
        yesPrice: price.yes,
        noPrice: price.no,
        btcPrice: getPriceService().getPrice(),
        timeRemaining: getMarketEngine().getTimeRemaining(),
        timestamp: price.timestamp,
      },
    })
  })

  // Subscribe settlements
  getMarketEngine().onSettlement((data) => {
    const { position, won, pnl, marketResult } = data
    const bot = getBotManager().getBots().find(b => b.id === position.botId)
    getBotManager().addLog(
      position.botId || 'manual',
      'SETTLED',
      `${won ? 'WON' : 'LOST'} ${position.outcome} position | PnL: $${pnl.toFixed(2)}`,
      { outcome: position.outcome, amount: position.amount, pnl, won, marketResult }
    )
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bunx tsc --noEmit
```

Expected: No errors (or only import resolution errors which will be fixed)

- [ ] **Step 3: Commit**

```bash
git add src/lib/global.ts
git commit -m "feat: add global singleton module for service access"
```

---

### Task 4: Create App Directory Structure

**Files:**
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/providers.tsx`

- [ ] **Step 1: Create app directory**

```bash
mkdir -p app
```

- [ ] **Step 2: Create app/globals.css**

```css
@import "tailwindcss";

/* Custom CSS Variables */
:root {
  --font-inter: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Base styles */
body {
  font-family: var(--font-inter);
  background-color: #0f172a;
  color: #f8fafc;
}

/* Glassmorphism utility */
.glass {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
```

- [ ] **Step 3: Create app/providers.tsx**

```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme-context'
import { Toaster } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SSEProvider } from '@/hooks/useSSE'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      }
    }
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <SSEProvider>
            {children}
          </SSEProvider>
          <Toaster />
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: Create app/layout.tsx**

```typescript
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PolyTrade - BTC Up/Down Trading',
  description: 'Real-time BTC prediction market simulator with automated trading bots',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: create Next.js app directory structure with providers"
```

---

## Phase 3: State Management

### Task 5: Create Zustand Stores

**Files:**
- Create: `src/lib/stores/trading-store.ts`
- Create: `src/lib/stores/bot-store.ts`
- Create: `src/lib/stores/ui-store.ts`

- [ ] **Step 1: Create stores directory**

```bash
mkdir -p src/lib/stores
```

- [ ] **Step 2: Create trading-store.ts**

```typescript
// src/lib/stores/trading-store.ts
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'

interface TradingState {
  // Market data
  yesPrice: number
  noPrice: number
  btcPrice: number
  timeRemaining: number
  priceDirection: { yes: 'up' | 'down' | null; no: 'up' | 'down' | null }

  // Portfolio
  portfolio: { balance: number; totalPnl: number } | null
  openPositions: unknown[]
  openPositionsValue: number

  // Competition
  competition: {
    active: boolean
    completedAt?: number
    duration?: number
    startedAt?: number
  } | null

  // Events
  events: unknown[]

  // Loading states
  loading: boolean
  apiLatency: number

  // Actions
  setMarketData: (data: Partial<Omit<TradingState, 'setMarketData' | 'setPortfolio' | 'setCompetition' | 'addEvent' | 'setLoading' | 'reset'>>) => void
  setPortfolio: (portfolio: TradingState['portfolio']) => void
  setCompetition: (competition: TradingState['competition']) => void
  addEvent: (event: unknown) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  yesPrice: 0.5,
  noPrice: 0.5,
  btcPrice: 0,
  timeRemaining: 300,
  priceDirection: { yes: null, no: null } as { yes: 'up' | 'down' | null; no: 'up' | 'down' | null },
  portfolio: null,
  openPositions: [],
  openPositionsValue: 0,
  competition: null,
  events: [],
  loading: true,
  apiLatency: 0,
}

export const useTradingStore = create<TradingState>()(
  devtools(
    subscribeWithSelector((set) => ({
      ...initialState,

      setMarketData: (data) => set((state) => ({ ...state, ...data })),

      setPortfolio: (portfolio) => set({ portfolio }),

      setCompetition: (competition) => set({ competition }),

      addEvent: (event) => set((state) => ({
        events: [event, ...state.events].slice(0, 100)
      })),

      setLoading: (loading) => set({ loading }),

      reset: () => set(initialState),
    })),
    { name: 'trading-store' }
  )
)
```

- [ ] **Step 3: Create bot-store.ts**

```typescript
// src/lib/stores/bot-store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface BotData {
  id: string
  name: string
  strategy: string
  enabled: boolean
  interval: number
  betSize: number
  maxBet: number
  useKelly: boolean
  kellyFraction: number
  runTime?: number
  stats: {
    trades: number
    wins: number
    losses: number
    pnl: number
    winRate: number
  }
  portfolio: {
    balance: number
    closedPositions: unknown[]
  }
}

interface BotLog {
  id: string
  botId: string
  botName: string
  type: string
  message: string
  timestamp: number
  details?: Record<string, unknown>
}

interface BotState {
  bots: BotData[]
  botLogs: BotLog[]
  isAnyRunning: boolean

  setBots: (bots: BotData[]) => void
  updateBot: (id: string, updates: Partial<BotData>) => void
  addLog: (log: BotLog) => void
  clearLogs: () => void
}

export const useBotStore = create<BotState>()(
  devtools(
    (set) => ({
      bots: [],
      botLogs: [],
      isAnyRunning: false,

      setBots: (bots) => set({
        bots,
        isAnyRunning: bots.some(b => b.enabled)
      }),

      updateBot: (id, updates) => set((state) => ({
        bots: state.bots.map(b => b.id === id ? { ...b, ...updates } : b),
        isAnyRunning: state.bots.some(b => b.id === id ? updates.enabled ?? b.enabled : b.enabled)
      })),

      addLog: (log) => set((state) => ({
        botLogs: [log, ...state.botLogs].slice(0, 50)
      })),

      clearLogs: () => set({ botLogs: [] }),
    }),
    { name: 'bot-store' }
  )
)
```

- [ ] **Step 4: Create ui-store.ts**

```typescript
// src/lib/stores/ui-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TabId = 'trade' | 'bots' | 'competition' | 'analytics' | 'settings' | 'risk' | 'history' | 'lab'

interface UIState {
  activeTab: TabId
  selectedAsset: string
  selectedTimeframe: string
  tradingMode: 'demo' | 'live'
  soundEnabled: boolean
  showSessionSummary: boolean

  setActiveTab: (tab: TabId) => void
  setSelectedAsset: (asset: string) => void
  setSelectedTimeframe: (tf: string) => void
  setTradingMode: (mode: 'demo' | 'live') => void
  toggleSound: () => void
  setShowSessionSummary: (show: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeTab: 'trade',
      selectedAsset: 'BTC',
      selectedTimeframe: '5',
      tradingMode: 'demo',
      soundEnabled: false,
      showSessionSummary: false,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedAsset: (asset) => set({ selectedAsset: asset }),
      setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),
      setTradingMode: (mode) => set({ tradingMode: mode }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setShowSessionSummary: (show) => set({ showSessionSummary: show }),
    }),
    { name: 'ui-store' }
  )
)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/
git commit -m "feat: add Zustand stores for state management"
```

---

### Task 6: Create SSE Client Hook

**Files:**
- Create: `src/hooks/useSSE.ts`

- [ ] **Step 1: Create useSSE.ts**

```typescript
// src/hooks/useSSE.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTradingStore } from '@/lib/stores/trading-store'
import { useBotStore } from '@/lib/stores/bot-store'

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)

  const setMarketData = useTradingStore(s => s.setMarketData)
  const setCompetition = useTradingStore(s => s.setCompetition)
  const setBots = useBotStore(s => s.setBots)
  const addLog = useBotStore(s => s.addLog)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource('/api/sse')
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      reconnectAttempts.current = 0
    }

    eventSource.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data)

        switch (type) {
          case 'connected':
          case 'market':
            setMarketData({
              yesPrice: data.yesPrice,
              noPrice: data.noPrice,
              btcPrice: data.btcPrice,
              timeRemaining: data.timeRemaining,
              loading: false,
            })
            if (data.bots) setBots(data.bots)
            if (data.competition) setCompetition(data.competition)
            break
          case 'competition':
            setCompetition(data)
            break
          case 'bot_log':
            addLog(data)
            break
        }
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
      reconnectAttempts.current++
      reconnectTimeoutRef.current = setTimeout(connect, delay)
    }
  }, [setMarketData, setCompetition, setBots, addLog])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  useSSE()
  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSSE.ts
git commit -m "feat: add SSE client hook with exponential backoff"
```

---

## Phase 4: API Routes

### Task 7: Create SSE Streaming Route

**Files:**
- Create: `app/api/sse/route.ts`

- [ ] **Step 1: Create SSE route**

```bash
mkdir -p app/api/sse
```

- [ ] **Step 2: Create app/api/sse/route.ts**

```typescript
// app/api/sse/route.ts
import { NextRequest } from 'next/server'
import {
  getMarketEngine,
  getPriceService,
  getBotManager,
  setSSEBroadcast,
  initializeServices,
} from '@/lib/global'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let servicesInitialized = false

export async function GET(request: NextRequest) {
  // Initialize services on first request
  if (!servicesInitialized) {
    await initializeServices()
    servicesInitialized = true
  }

  const encoder = new TextEncoder()
  const clients = new Set<ReadableStreamDefaultController>()

  // Set up broadcast function
  const broadcast = (data: unknown) => {
    const message = `data: ${JSON.stringify(data)}\n\n`
    clients.forEach((client) => {
      try {
        client.enqueue(encoder.encode(message))
      } catch {
        clients.delete(client)
      }
    })
  }

  setSSEBroadcast(broadcast)

  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller)

      // Send initial data
      const market = getMarketEngine().getCurrentMarket()
      const initialData = {
        type: 'connected',
        data: {
          yesPrice: parseFloat(market?.outcomePrices?.yes || '0.5'),
          noPrice: parseFloat(market?.outcomePrices?.no || '0.5'),
          btcPrice: getPriceService().getPrice(),
          timeRemaining: getMarketEngine().getTimeRemaining(),
          timestamp: Date.now(),
          bots: getBotManager().getBots(),
          competition: getBotManager().getCompetitionState(),
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`))

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
          clients.delete(controller)
        }
      }, 30000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clients.delete(controller)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/sse/
git commit -m "feat: add SSE streaming API route"
```

---

### Task 8: Create Market API Routes

**Files:**
- Create: `app/api/market/route.ts`
- Create: `app/api/market/timeframe/route.ts`
- Create: `app/api/market/switch/route.ts`
- Create: `app/api/market/refresh/route.ts`
- Create: `app/api/market/history/route.ts`
- Create: `app/api/market/asset/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p app/api/market/timeframe app/api/market/switch app/api/market/refresh app/api/market/history app/api/market/asset
```

- [ ] **Step 2: Create app/api/market/route.ts**

```typescript
// app/api/market/route.ts
import { NextResponse } from 'next/server'
import { getMarketEngine, getPriceService } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function GET() {
  const market = getMarketEngine().getCurrentMarket()
  const btcPrice = getPriceService().getPrice()
  const timeRemaining = getMarketEngine().getTimeRemaining()

  return NextResponse.json({
    ...market,
    btcPrice,
    timeRemaining,
  })
}
```

- [ ] **Step 3: Create timeframe route**

```typescript
// app/api/market/timeframe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMarketEngine } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tf = getMarketEngine().getTimeframe()
  return NextResponse.json({ timeframe: tf })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { timeframe } = body

    if (!timeframe) {
      return NextResponse.json({ error: 'Missing timeframe' }, { status: 400 })
    }

    await getMarketEngine().setTimeframe(timeframe)
    return NextResponse.json({ success: true, timeframe })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set timeframe' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Create remaining market routes (switch, refresh, history, asset)**

Each follows similar pattern - import from global, call appropriate method, return JSON.

- [ ] **Step 5: Commit**

```bash
git add app/api/market/
git commit -m "feat: add market API routes"
```

---

### Task 9: Create Bots API Routes

**Files:**
- Create: `app/api/bots/route.ts`
- Create: `app/api/bots/run-all/route.ts`
- Create: `app/api/bots/stop-all/route.ts`
- Create: `app/api/bots/reset-all/route.ts`
- Create: `app/api/bots/logs/route.ts`
- Create: `app/api/bots/[id]/toggle/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p app/api/bots/run-all app/api/bots/stop-all app/api/bots/reset-all app/api/bots/logs "app/api/bots/[id]/toggle"
```

- [ ] **Step 2: Create app/api/bots/route.ts**

```typescript
// app/api/bots/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function GET() {
  const bots = getBotManager().getBots()
  return NextResponse.json(bots)
}
```

- [ ] **Step 3: Create run-all route**

```typescript
// app/api/bots/run-all/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await getBotManager().runAllBots()
  return NextResponse.json(result)
}
```

- [ ] **Step 4: Create stop-all route**

```typescript
// app/api/bots/stop-all/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await getBotManager().stopAllBots()
  return NextResponse.json(result)
}
```

- [ ] **Step 5: Create reset-all route**

```typescript
// app/api/bots/reset-all/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await getBotManager().resetAllBots()
  return NextResponse.json(result)
}
```

- [ ] **Step 6: Create logs route**

```typescript
// app/api/bots/logs/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs = getBotManager().getLogs()
  return NextResponse.json(logs)
}
```

- [ ] **Step 7: Create toggle route**

```typescript
// app/api/bots/[id]/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getBotManager().toggleBot(id)
  return NextResponse.json(result)
}
```

- [ ] **Step 8: Commit**

```bash
git add app/api/bots/
git commit -m "feat: add bots API routes"
```

---

### Task 10: Create Competition API Routes

**Files:**
- Create: `app/api/competition/route.ts`
- Create: `app/api/competition/start/route.ts`
- Create: `app/api/competition/stop/route.ts`
- Create: `app/api/competition/clear/route.ts`
- Create: `app/api/competition/quick-run/route.ts`
- Create: `app/api/competition/one-hour-run/route.ts`
- Create: `app/api/competition/export/route.ts`

- [ ] **Step 1-7: Create competition routes following the same pattern**

Each route imports from global and calls the appropriate botManager method.

- [ ] **Step 8: Commit**

```bash
git add app/api/competition/
git commit -m "feat: add competition API routes"
```

---

### Task 11-20: Create Remaining API Routes

Following the same pattern, create routes for:

- **Task 11**: positions, portfolio, trade, sessions
- **Task 12**: strategy (strategies, analyze)
- **Task 13**: signal (route, threshold, klines)
- **Task 14**: risk (settings, warnings, reset-all)
- **Task 15**: analytics (rankings, distribution, time-performance, correlation, recommendation)
- **Task 16**: account (route, balance, sync, mode)
- **Task 17**: orders (positions, trades, place, cancel)
- **Task 18**: backtest, markets (available, signals), dashboard
- **Task 19**: settings, balance/set-all, events, health, reset
- **Task 20**: debug/engine, polymarket/test-connection, simulation (toggle, status)

Each task follows the same pattern:
1. Create directory structure
2. Create route files importing from `@/lib/global`
3. Export `dynamic = 'force-dynamic'`
4. Implement GET/POST handlers
5. Commit

---

## Phase 5: Frontend Migration

### Task 21: Create Main Page

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 1: Create app/page.tsx**

```typescript
'use client'

import { App } from '@/components/App'

export default function HomePage() {
  return <App />
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add main page component"
```

---

### Task 22: Update App Component for Zustand

**Files:**
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Add 'use client' directive**

Add `'use client'` at the top of the file.

- [ ] **Step 2: Replace useTradingData with Zustand stores**

Update the component to use Zustand stores instead of the custom hook:

```typescript
import { useTradingStore } from '@/lib/stores/trading-store'
import { useBotStore } from '@/lib/stores/bot-store'
import { useUIStore } from '@/lib/stores/ui-store'

// Inside component:
const yesPrice = useTradingStore(s => s.yesPrice)
const noPrice = useTradingStore(s => s.noPrice)
const bots = useBotStore(s => s.bots)
const botLogs = useBotStore(s => s.botLogs)
const competition = useTradingStore(s => s.competition)
const activeTab = useUIStore(s => s.activeTab)
const setActiveTab = useUIStore(s => s.setActiveTab)
// ... etc
```

- [ ] **Step 3: Update imports to use @/* aliases**

Replace relative imports with path aliases.

- [ ] **Step 4: Commit**

```bash
git add src/components/App.tsx
git commit -m "refactor: update App component to use Zustand stores"
```

---

### Task 23: Update All Components for Client-Side

**Files:**
- Modify: All `src/components/*.tsx` files

- [ ] **Step 1: Add 'use client' to all components**

Every component file needs `'use client'` at the top since they use React hooks and browser APIs.

- [ ] **Step 2: Update imports to use @/* aliases**

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "refactor: add client directive and update imports in all components"
```

---

### Task 24: Update Hooks

**Files:**
- Modify: `src/hooks/useTradingData.ts`

- [ ] **Step 1: Refactor useTradingData to use Zustand**

Either deprecate this hook in favor of direct store access, or have it wrap the stores for backward compatibility.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/
git commit -m "refactor: update hooks for Zustand integration"
```

---

## Phase 6: Cleanup and Testing

### Task 25: Remove Old Files

**Files:**
- Delete: `src/server.ts`
- Delete: `src/index.tsx`
- Delete: `src/index.html`

- [ ] **Step 1: Delete old server file**

```bash
rm src/server.ts
```

- [ ] **Step 2: Delete old entry files**

```bash
rm src/index.tsx src/index.html
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old Bun server and SPA entry files"
```

---

### Task 26: Test and Verify

- [ ] **Step 1: Run development server**

```bash
bun run dev
```

Expected: Server starts on http://localhost:3000

- [ ] **Step 2: Test SSE connection**

Open browser dev tools, verify SSE connection in Network tab.

- [ ] **Step 3: Test API endpoints**

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/market
curl http://localhost:3000/api/bots
```

- [ ] **Step 4: Run tests**

```bash
bun run test:run
```

- [ ] **Step 5: Build for production**

```bash
bun run build
```

Expected: Build succeeds without errors

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Next.js 16 migration"
```

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Setup | 1-2 | 15 min |
| Backend Infrastructure | 3-4 | 30 min |
| State Management | 5-6 | 30 min |
| API Routes | 7-20 | 2-3 hours |
| Frontend Migration | 21-24 | 1 hour |
| Cleanup & Testing | 25-26 | 30 min |

**Total: ~4-5 hours of focused work**