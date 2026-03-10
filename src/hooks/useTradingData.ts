import { useState, useEffect, useCallback, useRef } from "react";
import type { Market, Portfolio, BotLog } from "../types";

export interface MarketData {
  market: Market | null;
  btcPrice: number;
  priceHistory: { timestamp: number; price: number }[];
  yesPriceHistory?: { timestamp: number; price: number }[];
  timeRemaining: number;
  marketDuration: number;
  startedAt: number;
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
  stats: {
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
    winRate: number;
  };
  portfolio: {
    balance: number;
    totalPnL: number;
    totalTrades: number;
    winRate: number;
    roi: number;
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
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [apiLatency, setApiLatency] = useState(0);
  const [isBotRunning, setIsBotRunning] = useState(false);

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
      const [marketRes, portfolioRes, botsRes, historyRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/bots"),
        fetch("/api/market/history"),
      ]);

      const marketJson = await marketRes.json();
      const portfolioJson = await portfolioRes.json();
      const botsJson = await botsRes.json();
      const historyJson = await historyRes.json();

      setMarketData(marketJson);
      setPortfolio(portfolioJson);
      setBots(botsJson);
      setMarketHistory(historyJson);

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
  useEffect(() => {
    fetchData();
    fetchBotLogs();
  }, [fetchData, fetchBotLogs]);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/sse");

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "market" && message.data) {
          const newYesPrice = message.data.yesPrice;
          const newNoPrice = message.data.noPrice;

          // Detect price direction for animation
          if (newYesPrice > prevYesPrice.current) {
            setYesPriceDirection("up");
            setTimeout(() => setYesPriceDirection(null), 500);
          } else if (newYesPrice < prevYesPrice.current) {
            setYesPriceDirection("down");
            setTimeout(() => setYesPriceDirection(null), 500);
          }

          if (newNoPrice > prevNoPrice.current) {
            setNoPriceDirection("up");
            setTimeout(() => setNoPriceDirection(null), 500);
          } else if (newNoPrice < prevNoPrice.current) {
            setNoPriceDirection("down");
            setTimeout(() => setNoPriceDirection(null), 500);
          }

          prevYesPrice.current = newYesPrice;
          prevNoPrice.current = newNoPrice;

          setYesPrice(newYesPrice);
          setNoPrice(newNoPrice);
          setLastUpdate(message.data.timestamp);

          // Update market data if exists
          setMarketData(prev => prev ? {
            ...prev,
            btcPrice: message.data.btcPrice,
            timeRemaining: message.data.timeRemaining,
          } : null);
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

  return {
    marketData,
    portfolio,
    bots,
    events,
    marketHistory,
    botLogs,
    loading,
    lastUpdate,
    apiLatency,
    isBotRunning,
    yesPrice,
    noPrice,
    yesPriceDirection,
    noPriceDirection,
    pnlHistory,
    fetchData,
    addTradeEvent,
  };
}
