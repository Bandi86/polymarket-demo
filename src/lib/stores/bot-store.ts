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