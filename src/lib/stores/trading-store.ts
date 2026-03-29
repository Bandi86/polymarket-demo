// src/lib/stores/trading-store.ts
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { Portfolio } from '@/types'
import { MEMORY_CONFIG } from '@/lib/utils/memory-manager'

// Competition state must match API response from bot-manager/competition-manager
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
    duration: number | null;
    startBalance: number;
  };
}

interface TradingState {
  // Market data
  yesPrice: number
  noPrice: number
  btcPrice: number
  timeRemaining: number
  marketDuration: number
  marketEndTime: number // Timestamp when market ends (for local countdown)
  priceDirection: { yes: 'up' | 'down' | null; no: 'up' | 'down' | null }

  // Portfolio
  portfolio: Portfolio | null
  openPositions: unknown[]
  openPositionsValue: number

  // Competition
  competition: CompetitionState | null

  // Events
  events: unknown[]

  // Loading states
  loading: boolean
  apiLatency: number

  // Actions
  setMarketData: (data: Partial<Omit<TradingState, 'setMarketData' | 'setPortfolio' | 'setCompetition' | 'addEvent' | 'setLoading' | 'reset' | 'trimEvents'>>) => void
  setPortfolio: (portfolio: TradingState['portfolio']) => void
  setCompetition: (competition: TradingState['competition']) => void
  addEvent: (event: unknown) => void
  setLoading: (loading: boolean) => void
  trimEvents: () => void
  reset: () => void
}

const initialState = {
  yesPrice: 0.5,
  noPrice: 0.5,
  btcPrice: 0,
  timeRemaining: 300000,
  marketDuration: 300000,
  marketEndTime: Date.now() + 300000, // Default 5 minutes from now
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
        events: [event, ...state.events].slice(0, MEMORY_CONFIG.MAX_EVENTS)
      })),

      setLoading: (loading) => set({ loading }),

      trimEvents: () => set((state) => ({
        events: state.events.slice(0, MEMORY_CONFIG.MAX_EVENTS)
      })),

      reset: () => set(initialState),
    })),
    { name: 'trading-store' }
  )
)