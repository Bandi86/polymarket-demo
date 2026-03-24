// src/hooks/useTradingData.ts
/**
 * @deprecated Use Zustand stores directly:
 * - useTradingStore for market/portfolio/competition data
 * - useBotStore for bots/logs
 * - useUIStore for UI state
 * - useSSE for real-time updates
 *
 * This hook is kept for backward compatibility and will be removed in a future version.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTradingStore } from "@/lib/stores/trading-store";
import { useBotStore } from "@/lib/stores/bot-store";
import type { Market, Portfolio, BotLog } from "../types";

// Re-export types for consumers
export type { Portfolio, Market, BotLog } from "../types";

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

export interface MarketData {
  market: Market | null;
  spotPrice: number;
  priceHistory: { timestamp: number; price: number }[];
  yesPriceHistory?: { timestamp: number; price: number }[];
  timeRemaining: number;
  marketDuration: number;
  startedAt: number;
  priceToBeat?: number;
}

export interface MarketHistory {
  id: string;
  result: "UP" | "DOWN";
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
}

export interface BotData {
  id: string;
  name: string;
  strategy: string;
  enabled: boolean;
  interval: number;
  betSize: number;
  useKelly?: boolean;
  kellyFraction?: number;
  runTime?: number;
  stats: {
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
  };
  portfolio: {
    balance: number;
    totalPnL: number;
    totalTrades: number;
    winRate: number;
    roi: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    closedPositions?: unknown[];
  };
}

export interface TradeEvent {
  id: string;
  type: "BUY" | "SELL" | "SETTLE";
  outcome: "YES" | "NO";
  amount: number;
  price: number;
  pnl?: number;
  time: number;
  botName?: string;
}

export interface Position {
  id: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  fee: number;
  unrealizedPnl: number;
  currentValue: number;
}

export interface LiveBalance {
  success: boolean;
  isLive: boolean;
  balance: number;
  available: number;
  locked: number;
  demoBalance: number;
  hasCredentials: boolean;
  hasPrivateKey: boolean;
  error: string | null;
  lastSync: number | null;
}

// Memory limits
const MAX_PNL_HISTORY = 50;
const PNGL_HISTORY_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * @deprecated Use stores directly. This hook wraps Zustand stores for backward compatibility.
 */
export function useTradingData() {
  // Get values from Zustand stores
  const tradingState = useTradingStore();
  const botState = useBotStore();

  // Local state for things not in stores
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketHistory[]>([]);
  const [liveBalance, setLiveBalance] = useState<LiveBalance>({
    success: false,
    isLive: false,
    balance: 0,
    available: 0,
    locked: 0,
    demoBalance: 0,
    hasCredentials: false,
    hasPrivateKey: false,
    error: null,
    lastSync: null,
  });
  const [pnlHistory, setPnLHistory] = useState<{ time: number; pnl: number }[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [apiLatency, setApiLatency] = useState(0);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    const startTime = Date.now();
    try {
      const [marketRes, portfolioRes, historyRes, competitionRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/market/history"),
        fetch("/api/competition"),
      ]);

      const marketJson = await marketRes.json();
      const portfolioJson = await portfolioRes.json();
      const historyJson = await historyRes.json();
      const competitionJson = await competitionRes.json();

      if (marketJson && marketJson.market) {
        const primaryMarket = marketJson.market;
        setMarketData({
          market: primaryMarket,
          spotPrice: marketJson.btcPrice || primaryMarket.spotPrice || 0,
          priceHistory: primaryMarket.priceHistory || [],
          timeRemaining: marketJson.timeRemaining || primaryMarket.timeRemaining || 0,
          marketDuration: marketJson.marketDuration || 0,
          startedAt: marketJson.startedAt || 0,
          priceToBeat: primaryMarket.priceToBeat || marketJson.priceToBeat,
        });
      } else {
        setMarketData(null);
      }

      // Update stores
      tradingState.setPortfolio(portfolioJson);
      tradingState.setCompetition(competitionJson);

      // Update PnL history with memory limit
      if (portfolioJson?.totalPnL !== undefined) {
        setPnLHistory(prev => {
          const now = Date.now();
          const newEntry = { time: now, pnl: portfolioJson.totalPnL };
          const filtered = prev.filter(p => now - p.time < PNGL_HISTORY_MAX_AGE_MS);
          return [...filtered, newEntry].slice(-MAX_PNL_HISTORY);
        });
      }

      setMarketHistory(historyJson);
      setApiLatency(Date.now() - startTime);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      tradingState.setLoading(false);
    }
  }, [tradingState]);

  // Fetch live balance from Polymarket API
  const fetchLiveBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/account/balance");
      const data = await res.json();

      setLiveBalance({
        success: data.success || false,
        isLive: data.isLive || false,
        balance: data.balance || 0,
        available: data.available || 0,
        locked: data.locked || 0,
        demoBalance: data.demoBalance || 0,
        hasCredentials: data.hasCredentials || false,
        hasPrivateKey: data.hasPrivateKey || false,
        lastSync: data.lastSync || Date.now(),
        error: data.error || null,
      });
    } catch (err) {
      console.error("Live balance fetch error:", err);
      setLiveBalance(prev => ({
        ...prev,
        success: false,
        error: "Failed to fetch live balance",
        lastSync: Date.now(),
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
    fetchLiveBalance();

    const timeout = setTimeout(() => {
      tradingState.setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [fetchData, fetchLiveBalance, tradingState]);

  // Fallback polling every 5 seconds for full data refresh
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [fetchData]);

  // Add a trade event
  const addTradeEvent = useCallback((event: TradeEvent) => {
    tradingState.addEvent(event);
  }, [tradingState]);

  // Update a single bot's state (for immediate UI updates after toggle)
  const updateBotState = useCallback((botId: string, updates: Partial<BotData>) => {
    botState.updateBot(botId, updates);
  }, [botState]);

  return {
    // From stores
    portfolio: tradingState.portfolio,
    bots: botState.bots,
    events: tradingState.events as TradeEvent[],
    botLogs: botState.botLogs,
    competition: tradingState.competition as CompetitionState,
    loading: tradingState.loading,
    isBotRunning: botState.isAnyRunning,
    yesPrice: tradingState.yesPrice,
    noPrice: tradingState.noPrice,
    yesPriceDirection: tradingState.priceDirection.yes,
    noPriceDirection: tradingState.priceDirection.no,
    timeRemaining: tradingState.timeRemaining,

    // Local state
    marketData,
    marketHistory,
    pnlHistory,
    liveBalance,
    lastUpdate,
    apiLatency,

    // Actions
    fetchData,
    fetchLiveBalance,
    addTradeEvent,
    updateBotState,
  };
}