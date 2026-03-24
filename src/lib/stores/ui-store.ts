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