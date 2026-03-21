import { useState, useEffect, useCallback, useRef } from "react";
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

export function useTradingData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [bots, setBots] = useState<BotData[]>([]);
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [marketHistory, setMarketHistory] = useState<MarketHistory[]>([]);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [competition, setCompetition] = useState<CompetitionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [apiLatency, setApiLatency] = useState(0);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Price animation state
  const [yesPriceDirection, setYesPriceDirection] = useState<"up" | "down" | null>(null);
  const [noPriceDirection, setNoPriceDirection] = useState<"up" | "down" | null>(null);
  const prevYesPrice = useRef(0.5);
  const prevNoPrice = useRef(0.5);

  // Current prices
  const [yesPrice, setYesPrice] = useState(0.5);
  const [noPrice, setNoPrice] = useState(0.5);

  // PnL history for chart
  const [pnlHistory, setPnLHistory] = useState<{ time: number; pnl: number }[]>([]);

  const eventsRef = useRef<TradeEvent[]>([]);
  const logsRef = useRef<BotLog[]>([]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    const startTime = Date.now();
    try {
      const [marketRes, portfolioRes, botsRes, historyRes, competitionRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/bots"),
        fetch("/api/market/history"),
        fetch("/api/competition/status"),
      ]);

      const marketJson = await marketRes.json();
      const portfolioJson = await portfolioRes.json();
      const botsJson = await botsRes.json();
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
        
        // Sync prices from GET /api/market
        const yPrice = primaryMarket.yesPrice || parseFloat(primaryMarket.outcomePrices?.yes || '0.5');
        const nPrice = primaryMarket.noPrice || parseFloat(primaryMarket.outcomePrices?.no || '0.5');
        
        setYesPrice(yPrice);
        setNoPrice(nPrice);
        prevYesPrice.current = yPrice;
        prevNoPrice.current = nPrice;
      } else {
        setMarketData(null); 
      }

      setPortfolio(portfolioJson);
      setBots(botsJson);
      setMarketHistory(historyJson);
      setCompetition(competitionJson);

      // Update PnL history
      if (portfolioJson?.totalPnL !== undefined) {
        setPnLHistory(prev => {
          const newEntry = { time: Date.now(), pnl: portfolioJson.totalPnL };
          const newHistory = [...prev, newEntry].slice(-100);
          return newHistory;
        });
      }

      setIsBotRunning(botsJson.some((b: BotData) => b.enabled));
      setApiLatency(Date.now() - startTime);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch bot logs
  const fetchBotLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/bots/logs");
      if (res.ok) {
        const logs = await res.json();
        logsRef.current = logs;
        setBotLogs(logs);
      }
    } catch (err) {
      console.error("Bot logs fetch error:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
    fetchBotLogs();

    // Fallback timeout - ensure we don't stay in loading state forever
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [fetchData, fetchBotLogs]);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/sse");

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle connected or market messages
        if ((message.type === "market" || message.type === "connected") && message.data) {
          const newYesPrice = message.data.yesPrice;
          const newNoPrice = message.data.noPrice;

          // Update time remaining
          if (message.data.timeRemaining !== undefined) {
            setTimeRemaining(message.data.timeRemaining);
          }

          // Detect price direction for animation (keep this separate for micro-animations)
          if (newYesPrice > prevYesPrice.current) {
            setYesPriceDirection("up");
            setTimeout(() => setYesPriceDirection(null), 400);
          } else if (newYesPrice < prevYesPrice.current) {
            setYesPriceDirection("down");
            setTimeout(() => setYesPriceDirection(null), 400);
          }

          if (newNoPrice > prevNoPrice.current) {
            setNoPriceDirection("up");
            setTimeout(() => setNoPriceDirection(null), 400);
          } else if (newNoPrice < prevNoPrice.current) {
            setNoPriceDirection("down");
            setTimeout(() => setNoPriceDirection(null), 400);
          }

          prevYesPrice.current = newYesPrice;
          prevNoPrice.current = newNoPrice;

          // Batch state updates
          setYesPrice(newYesPrice);
          setNoPrice(newNoPrice);
          setLastUpdate(message.data.timestamp);

          // Update market data if exists
          setMarketData(prev => {
            const hasNewMarket = message.data.market;
            const pm = hasNewMarket || prev?.market;

            return {
              market: pm,
              spotPrice: message.data.btcPrice || pm?.spotPrice || 0,
              priceHistory: pm?.priceHistory || prev?.priceHistory || [],
              timeRemaining: message.data.timeRemaining || pm?.timeRemaining || 0,
              marketDuration: message.data.marketDuration || pm?.marketDuration || 0,
              startedAt: message.data.startedAt || pm?.startedAt || 0,
            };
          });

          // Update competition state if included (from connected message)
          if (message.data.competition) {
            setCompetition(message.data.competition);
          }
        }

        // Handle competition state updates
        if (message.type === "competition" && message.data) {
          setCompetition(message.data);
        }

        // Handle bot log events
        if (message.type === "bot_log" && message.data) {
          const newLog: BotLog = message.data;
          logsRef.current = [newLog, ...logsRef.current.slice(0, 99)];
          setBotLogs([...logsRef.current]);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
    };

    // Fallback polling every 5 seconds for full data refresh
    const pollInterval = setInterval(() => {
      fetchData();
      fetchBotLogs();
    }, 5000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [fetchData, fetchBotLogs]);

  // Add a trade event
  const addTradeEvent = useCallback((event: TradeEvent) => {
    eventsRef.current = [event, ...eventsRef.current.slice(0, 49)];
    setEvents([...eventsRef.current]);
  }, []);

  // Update a single bot's state (for immediate UI updates after toggle)
  const updateBotState = useCallback((botId: string, updates: Partial<BotData>) => {
    setBots(prev => prev.map(b => b.id === botId ? { ...b, ...updates } : b));
  }, []);

  return {
    marketData,
    portfolio,
    bots,
    events,
    marketHistory,
    botLogs,
    competition,
    loading,
    lastUpdate,
    apiLatency,
    isBotRunning,
    yesPrice,
    noPrice,
    yesPriceDirection,
    noPriceDirection,
    pnlHistory,
    timeRemaining,
    fetchData,
    addTradeEvent,
    updateBotState,
  };
}
