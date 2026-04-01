// src/lib/stores/bot-store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { BotStats, BotLog } from '@/types'
import { MEMORY_CONFIG } from '@/lib/utils/memory-manager'

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
  stats: BotStats
  portfolio: {
    balance: number
    initialBalance?: number
    totalPnL: number
    totalTrades: number
    winRate: number
    roi: number
    maxDrawdown?: number
    sharpeRatio?: number
    closedPositions?: unknown[]
  }
}

interface BotState {
  bots: BotData[]
  botLogs: BotLog[]
  isAnyRunning: boolean

  setBots: (bots: BotData[]) => void
  updateBot: (id: string, updates: Partial<BotData>) => void
  addLog: (log: BotLog) => void
  clearLogs: () => void
  trimLogs: () => void
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
        botLogs: [log, ...state.botLogs].slice(0, MEMORY_CONFIG.MAX_BOT_LOGS)
      })),

      clearLogs: () => set({ botLogs: [] }),

      trimLogs: () => set((state) => ({
        botLogs: state.botLogs.slice(0, MEMORY_CONFIG.MAX_BOT_LOGS)
      })),
    }),
    { name: 'bot-store' }
  )
)