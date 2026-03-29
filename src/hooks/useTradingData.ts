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
    initialBalance?: number;  // Start balance for accurate growth calculation
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
  // Use selectors to get specific values (prevents re-render loops)
  const setPortfolio = useTradingStore(s => s.setPortfolio);
  const setCompetition = useTradingStore(s => s.setCompetition);
  const setLoading = useTradingStore(s => s.setLoading);
  const portfolio = useTradingStore(s => s.portfolio);
  const competition = useTradingStore(s => s.competition);
  const loading = useTradingStore(s => s.loading);
  const yesPrice = useTradingStore(s => s.yesPrice);
  const noPrice = useTradingStore(s => s.noPrice);
  const priceDirection = useTradingStore(s => s.priceDirection);
  const timeRemaining = useTradingStore(s => s.timeRemaining);
  const events = useTradingStore(s => s.events);
  const addEvent = useTradingStore(s => s.addEvent);

  const bots = useBotStore(s => s.bots);
  const botLogs = useBotStore(s => s.botLogs);
  const isAnyRunning = useBotStore(s => s.isAnyRunning);
  const updateBot = useBotStore(s => s.updateBot);
  const setBots = useBotStore(s => s.setBots);

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

  // Use ref to track if initial fetch happened
  const hasFetchedRef = useRef(false);

  // Fetch data from API - no store dependencies
  const fetchData = useCallback(async () => {
    const startTime = Date.now();
    try {
      const [marketRes, portfolioRes, historyRes, competitionRes, botsRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/market/history"),
        fetch("/api/competition"),
        fetch("/api/bots"),
      ]);

      const marketJson = await marketRes.json();
      const portfolioJson = await portfolioRes.json();
      const historyJson = await historyRes.json();
      const competitionJson = await competitionRes.json();
      const botsJson = await botsRes.json();

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
      setPortfolio(portfolioJson);
      setCompetition(competitionJson);
      if (botsJson && Array.isArray(botsJson)) {
        setBots(botsJson);
      }

      // Debug log
      if (competitionJson?.active) {
        console.log(`[useTradingData] Competition active: startTime=${competitionJson.startTime}, leaderboard=${competitionJson.leaderboard?.length} bots`);
      }

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
      setLoading(false);
    }
  }, [setPortfolio, setCompetition, setLoading, setBots]);

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

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
      fetchLiveBalance();
    }

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [fetchData, fetchLiveBalance, setLoading]);

  // Fallback polling every 10 seconds (reduced from 5)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [fetchData]);

  // Add a trade event
  const addTradeEvent = useCallback((event: TradeEvent) => {
    addEvent(event);
  }, [addEvent]);

  // Update a single bot's state (for immediate UI updates after toggle)
  const updateBotState = useCallback((botId: string, updates: Partial<BotData>) => {
    updateBot(botId, updates);
  }, [updateBot]);

  return {
    // From stores
    portfolio,
    bots,
    events: events as TradeEvent[],
    botLogs,
    competition: competition as CompetitionState,
    loading,
    isBotRunning: isAnyRunning,
    yesPrice,
    noPrice,
    yesPriceDirection: priceDirection.yes,
    noPriceDirection: priceDirection.no,
    timeRemaining,

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