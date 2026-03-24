// src/lib/stores/trading-store.ts
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { Portfolio } from '@/types'

interface TradingState {
  // Market data
  yesPrice: number
  noPrice: number
  btcPrice: number
  timeRemaining: number
  priceDirection: { yes: 'up' | 'down' | null; no: 'up' | 'down' | null }

  // Portfolio
  portfolio: Portfolio | null
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