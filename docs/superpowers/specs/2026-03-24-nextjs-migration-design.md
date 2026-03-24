# Next.js 16 Migration Design Specification

**Date:** 2026-03-24
**Status:** Draft
**Author:** Claude Code

---

## Executive Summary

Migrate the existing Bun + React SPA to Next.js 16 App Router with Zustand state management. This migration addresses architectural debt, improves SEO, and aligns with global development standards.

---

## 1. Current State Analysis

### 1.1 Existing Architecture

```
Current Stack:
- Runtime: Bun (custom server in src/server.ts)
- Framework: React 19 SPA (no SSR)
- Build: bun build (static)
- Real-time: SSE (Server-Sent Events)
- Database: SQLite (better-sqlite3)
- Styling: Tailwind CSS v4 + Radix UI + Framer Motion
- State: React hooks (useTradingData)
```

### 1.2 Key Metrics

| Metric | Value |
|--------|-------|
| server.ts lines | 1,370 |
| bot-manager.ts lines | 2,033 |
| API endpoints | 70+ |
| React components | ~90 |
| Service singletons | 8 |

### 1.3 Problem Statement

1. **Non-compliant architecture** - SPA violates global Next.js App Router requirement
2. **Monolithic server** - All API routes in single file
3. **Prop drilling** - State passed through multiple component layers
4. **No SSR/SEO** - Client-only rendering

---

## 2. Target Architecture

### 2.1 Version Requirements

All packages at latest stable versions (2026-03-24):

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.1 | Framework |
| react | 19.2.4 | UI library |
| react-dom | 19.2.4 | DOM renderer |
| zustand | 5.0.12 | State management |
| tailwindcss | 4.2.2 | Styling |
| recharts | 3.8.0 | Charts |
| framer-motion | 12.38.0 | Animations |
| lucide-react | 1.0.1 | Icons |
| viem | 2.47.6 | Ethereum |

### 2.2 Directory Structure

```
polymarket-demo/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home page (main app)
│   ├── globals.css                   # Global styles
│   └── api/                          # API Routes
│       ├── sse/route.ts              # SSE streaming
│       ├── market/
│       │   ├── route.ts              # GET current market
│       │   ├── timeframe/route.ts    # GET/POST timeframe
│       │   ├── switch/route.ts       # POST switch market
│       │   ├── refresh/route.ts      # POST refresh
│       │   ├── history/route.ts      # GET history
│       │   └── asset/route.ts        # POST asset
│       ├── bots/
│       │   ├── route.ts              # GET all bots
│       │   ├── run-all/route.ts      # POST run all
│       │   ├── stop-all/route.ts     # POST stop all
│       │   ├── reset-all/route.ts    # POST reset all
│       │   ├── logs/route.ts         # GET logs
│       │   └── [id]/
│       │       └── toggle/route.ts   # POST toggle bot
│       ├── competition/
│       │   ├── route.ts              # GET status
│       │   ├── start/route.ts        # POST start
│       │   ├── stop/route.ts         # POST stop
│       │   ├── clear/route.ts        # POST clear
│       │   ├── quick-run/route.ts    # POST quick run
│       │   ├── one-hour-run/route.ts # POST 1h run
│       │   └── export/route.ts       # GET export
│       ├── positions/
│       │   └── route.ts              # GET positions
│       ├── portfolio/
│       │   └── route.ts              # GET portfolio
│       ├── trade/
│       │   └── route.ts              # POST trade
│       ├── sessions/
│       │   └── route.ts              # GET sessions
│       ├── strategy/
│       │   ├── strategies/route.ts   # GET strategies
│       │   └── analyze/route.ts      # GET analysis
│       ├── signal/
│       │   ├── route.ts              # GET signal
│       │   ├── threshold/route.ts    # POST threshold
│       │   └── klines/route.ts       # GET klines
│       ├── risk/
│       │   ├── settings/route.ts     # GET/POST settings
│       │   ├── warnings/route.ts     # GET warnings
│       │   └── reset-all/route.ts    # POST reset
│       ├── analytics/
│       │   ├── rankings/route.ts     # GET rankings
│       │   ├── distribution/route.ts # GET distribution
│       │   ├── time-performance/route.ts
│       │   ├── correlation/route.ts
│       │   └── recommendation/route.ts
│       ├── account/
│       │   ├── route.ts              # GET account info
│       │   ├── balance/route.ts      # GET live balance
│       │   ├── sync/route.ts         # POST sync
│       │   └── mode/route.ts         # POST switch mode
│       ├── orders/
│       │   ├── positions/route.ts    # GET Polymarket positions
│       │   ├── trades/route.ts       # GET trade history
│       │   ├── place/route.ts        # POST place order
│       │   └── cancel/route.ts       # POST cancel order
│       ├── backtest/
│       │   └── route.ts              # POST backtest
│       ├── markets/
│       │   ├── available/route.ts    # GET available
│       │   └── signals/route.ts      # GET signals
│       ├── dashboard/
│       │   └── route.ts              # GET dashboard data
│       ├── settings/
│       │   └── route.ts              # GET/POST settings
│       ├── balance/
│       │   └── set-all/route.ts      # POST set all balances
│       ├── events/
│       │   └── route.ts              # GET events
│       ├── health/
│       │   └── route.ts              # GET health check
│       ├── reset/
│       │   └── route.ts              # POST full reset
│       ├── debug/
│       │   └── engine/route.ts       # GET engine debug
│       ├── polymarket/
│       │   └── test-connection/route.ts
│       ├── simulation/
│       │   ├── toggle/route.ts       # POST toggle
│       │   └── status/route.ts       # GET status
│       └── [...not-found]/route.ts   # 404 handler
├── src/
│   ├── components/                   # React components (unchanged)
│   ├── lib/
│   │   ├── global.ts                 # NEW: Singleton exports
│   │   ├── stores/                   # NEW: Zustand stores
│   │   │   ├── trading-store.ts      # Market, portfolio, competition
│   │   │   ├── bot-store.ts          # Bot list, logs
│   │   │   └── ui-store.ts           # UI state (tabs, modals)
│   │   ├── bot-manager.ts            # Unchanged
│   │   ├── market-engine.ts          # Unchanged
│   │   ├── market-analyzer.ts        # Unchanged
│   │   ├── risk-manager.ts           # Unchanged
│   │   ├── strategy-coordinator.ts   # Unchanged
│   │   ├── database.ts               # Unchanged
│   │   ├── price.ts                  # Unchanged
│   │   ├── analytics.ts              # Unchanged
│   │   ├── polymarket-client.ts      # Unchanged
│   │   ├── backtest-engine.ts        # Unchanged
│   │   ├── parameter-optimizer.ts    # Unchanged
│   │   ├── theme-context.tsx         # Unchanged
│   │   ├── design-tokens.ts          # Unchanged
│   │   ├── providers/                # Unchanged
│   │   │   ├── price-provider.ts
│   │   │   ├── binance-kline-provider.ts
│   │   │   └── polymarket-provider.ts
│   │   └── utils/                    # Unchanged
│   ├── hooks/
│   │   ├── useTradingData.ts         # Refactored to use Zustand
│   │   ├── useBotSessions.ts         # Unchanged
│   │   ├── useWallet.ts              # Unchanged
│   │   ├── useSoundNotifications.ts  # Unchanged
│   │   └── usePWA.ts                 # Unchanged
│   └── types/
│       └── index.ts                  # Unchanged
├── public/                           # Static assets
├── data/                             # SQLite database
├── next.config.ts                    # Next.js config
├── tailwind.config.ts                # Tailwind config
├── tsconfig.json                     # TypeScript config
└── package.json                      # Dependencies
```

### 2.3 Global Singletons Pattern

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

// Initialize all services
export async function initializeServices(): Promise<void> {
  const db = getDatabaseService()
  await db.connect()

  // Sync BTC price with polymarket provider
  getPriceService().subscribeToUpdates((update) => {
    getPolymarketProvider().setBtcPrice(update.price)
  })

  // Subscribe bot logs
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
```

---

## 3. Zustand Store Design

### 3.1 Trading Store

```typescript
// src/lib/stores/trading-store.ts
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { MarketData, Portfolio, Competition, Position, TradeEvent } from '@/types'

interface TradingState {
  // Market data
  marketData: MarketData | null
  yesPrice: number
  noPrice: number
  btcPrice: number
  timeRemaining: number
  priceDirection: { yes: 'up' | 'down' | null; no: 'up' | 'down' | null }

  // Portfolio
  portfolio: Portfolio | null
  openPositions: Position[]
  openPositionsValue: number

  // Competition
  competition: Competition | null

  // Events
  events: TradeEvent[]

  // Loading states
  loading: boolean
  apiLatency: number

  // Actions
  setMarketData: (data: Partial<TradingState>) => void
  setPortfolio: (portfolio: Portfolio) => void
  setCompetition: (competition: Competition | null) => void
  addEvent: (event: TradeEvent) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  marketData: null,
  yesPrice: 0.5,
  noPrice: 0.5,
  btcPrice: 0,
  timeRemaining: 300,
  priceDirection: { yes: null, no: null },
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
    subscribeWithSelector((set, get) => ({
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

### 3.2 Bot Store

```typescript
// src/lib/stores/bot-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { BotData, BotLog } from '@/types'

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
    (set, get) => ({
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

### 3.3 UI Store

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

---

## 4. SSE Implementation in Next.js

### 4.1 SSE Route Handler

```typescript
// app/api/sse/route.ts
import { NextRequest } from 'next/server'
import {
  getMarketEngine,
  getPriceService,
  getBotManager,
  setSSEBroadcast
} from '@/lib/global'

export const runtime = 'nodejs' // Required for streaming
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    }
  })
}
```

---

## 5. Component Migration

### 5.1 Root Layout

```typescript
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'PolyTrade - BTC Up/Down Trading',
  description: 'Real-time BTC prediction market simulator with automated trading bots',
  manifest: '/manifest.json',
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
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### 5.2 Providers Component

```typescript
// app/providers.tsx
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

### 5.3 SSE Hook for Client

```typescript
// src/hooks/useSSE.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTradingStore } from '@/lib/stores/trading-store'
import { useBotStore } from '@/lib/stores/bot-store'

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

---

## 6. API Route Migration Examples

### 6.1 Market Route

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

### 6.2 Bots Routes

```typescript
// app/api/bots/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function GET() {
  const bots = getBotManager().getBots()
  return NextResponse.json(bots)
}

// app/api/bots/run-all/route.ts
import { NextResponse } from 'next/server'
import { getBotManager } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST() {
  const result = await getBotManager().runAllBots()
  return NextResponse.json(result)
}

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

### 6.3 Trade Route

```typescript
// app/api/trade/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMarketEngine } from '@/lib/global'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { outcome, amount } = body

    if (!outcome || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await getMarketEngine().placeTrade({
      outcome,
      amount: parseFloat(amount),
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trade failed' },
      { status: 500 }
    )
  }
}
```

---

## 7. Configuration Files

### 7.1 next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable if using server actions heavily
    // serverActions: true,
  },

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

### 7.2 package.json

```json
{
  "name": "polymarket-demo",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
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

### 7.3 tsconfig.json

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

---

## 8. Migration Checklist

### Phase 1: Setup
- [ ] Create new Next.js 16 project with `bun create next-app@latest`
- [ ] Configure TypeScript with strict mode
- [ ] Set up path aliases (`@/*`)
- [ ] Install all dependencies at latest versions
- [ ] Copy Tailwind CSS configuration

### Phase 2: Backend Migration
- [ ] Create `src/lib/global.ts` for singleton exports
- [ ] Copy all lib files (bot-manager, market-engine, etc.)
- [ ] Create API route structure under `app/api/`
- [ ] Migrate all 70+ API endpoints
- [ ] Implement SSE route with streaming

### Phase 3: State Management
- [ ] Install Zustand 5.0.12
- [ ] Create `trading-store.ts`
- [ ] Create `bot-store.ts`
- [ ] Create `ui-store.ts`
- [ ] Refactor `useTradingData` hook to use stores

### Phase 4: Frontend Migration
- [ ] Create root layout with providers
- [ ] Migrate all components to Client Components
- [ ] Update imports to use `@/*` aliases
- [ ] Test SSE connection
- [ ] Verify all functionality

### Phase 5: Cleanup & Testing
- [ ] Remove old server.ts
- [ ] Remove old index.tsx and index.html
- [ ] Update documentation
- [ ] Run all tests
- [ ] Performance testing

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE incompatibility | Low | High | Test streaming early, use route handlers |
| SQLite in serverless | Medium | High | Use `runtime: 'nodejs'` for API routes |
| State hydration issues | Medium | Medium | Use Zustand persist middleware carefully |
| Breaking changes in deps | Low | Medium | Pin exact versions in package.json |
| Memory leaks in SSE | Medium | High | Implement proper cleanup on disconnect |

---

## 10. Success Criteria

1. All API endpoints working identically to current implementation
2. SSE streaming functional with auto-reconnect
3. All UI components rendering correctly
4. No TypeScript errors
5. All tests passing
6. Development server starts with `bun dev`
7. Production build succeeds with `bun run build`
8. Memory usage stable under load

---

## References

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [React 19 Documentation](https://react.dev)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)