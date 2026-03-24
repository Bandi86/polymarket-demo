// src/hooks/useLocalTimer.ts
'use client'

import { useEffect, useState } from 'react'
import { useTradingStore } from '@/lib/stores/trading-store'

/**
 * Hook that provides a smooth local countdown timer.
 * Uses marketEndTime from the store to calculate remaining time locally,
 * avoiding SSE latency issues.
 */
export function useLocalTimer() {
  const marketEndTime = useTradingStore((s) => s.marketEndTime)
  const marketDuration = useTradingStore((s) => s.marketDuration)
  const setTimeRemaining = useTradingStore((s) => s.setMarketData)

  const [localTimeRemaining, setLocalTimeRemaining] = useState(() =>
    Math.max(0, marketEndTime - Date.now())
  )

  useEffect(() => {
    // Update immediately
    const updateTimer = () => {
      const remaining = Math.max(0, marketEndTime - Date.now())
      setLocalTimeRemaining(remaining)

      // Also update the store for components that use it directly
      setTimeRemaining({ timeRemaining: remaining })
    }

    // Run immediately
    updateTimer()

    // Then run every 100ms for smooth countdown
    const interval = setInterval(updateTimer, 100)

    return () => clearInterval(interval)
  }, [marketEndTime, setTimeRemaining])

  return {
    timeRemaining: localTimeRemaining,
    totalDuration: marketDuration,
    progress: marketDuration > 0 ? localTimeRemaining / marketDuration : 0,
  }
}