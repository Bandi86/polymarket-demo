// src/hooks/useSSE.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTradingStore } from '@/lib/stores/trading-store'
import { useBotStore } from '@/lib/stores/bot-store'

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const prevYesPrice = useRef(0.5)
  const prevNoPrice = useRef(0.5)

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
            // Calculate price direction for animations
            const yesDirection = data.yesPrice > prevYesPrice.current ? 'up' :
                                 data.yesPrice < prevYesPrice.current ? 'down' : null
            const noDirection = data.noPrice > prevNoPrice.current ? 'up' :
                                data.noPrice < prevNoPrice.current ? 'down' : null
            prevYesPrice.current = data.yesPrice
            prevNoPrice.current = data.noPrice

            // Calculate market end time for local countdown
            const marketEndTime = Date.now() + (data.timeRemaining || 0)

            setMarketData({
              yesPrice: data.yesPrice,
              noPrice: data.noPrice,
              btcPrice: data.btcPrice,
              timeRemaining: data.timeRemaining,
              marketDuration: data.marketDuration,
              marketEndTime: marketEndTime,
              priceDirection: { yes: yesDirection, no: noDirection },
              loading: false,
            })
            if (data.bots) setBots(data.bots)
            if (data.competition) setCompetition(data.competition)
            break
          case 'market_price':
            // Real-time price updates from market engine
            const marketYesDir = data.yes > prevYesPrice.current ? 'up' :
                                 data.yes < prevYesPrice.current ? 'down' : null
            const marketNoDir = data.no > prevNoPrice.current ? 'up' :
                                data.no < prevNoPrice.current ? 'down' : null
            prevYesPrice.current = data.yes
            prevNoPrice.current = data.no

            // Calculate market end time for local countdown
            const priceMarketEndTime = Date.now() + (data.timeRemaining || 0)

            setMarketData({
              yesPrice: data.yes,
              noPrice: data.no,
              timeRemaining: data.timeRemaining,
              marketDuration: data.marketDuration,
              marketEndTime: priceMarketEndTime,
              priceDirection: { yes: marketYesDir, no: marketNoDir },
              loading: false,
            })
            break
          case 'price':
            // BTC price updates from price service
            setMarketData({
              btcPrice: data.price,
              loading: false,
            })
            break
          case 'timer':
            // Timer sync from server - update marketEndTime to correct drift
            const timerMarketEndTime = Date.now() + (data.timeRemaining || 0)
            setMarketData({
              timeRemaining: data.timeRemaining,
              marketDuration: data.marketDuration,
              marketEndTime: timerMarketEndTime,
              loading: false,
            })
            break
          case 'competition':
            setCompetition(data)
            break
          case 'bots':
            // Bots state update (from run-all, stop-all, etc.)
            if (Array.isArray(data)) {
              setBots(data)
            }
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