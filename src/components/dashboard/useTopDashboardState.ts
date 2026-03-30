import { useState, useEffect, useMemo } from "react";
import type { BotData, CompetitionState, LiveBalance } from "@/hooks/useTradingData";
import type { MarketData } from "@/hooks/useTradingData";

export interface UseTopDashboardStateProps {
  marketData: MarketData | null;
  bots: BotData[];
  competition: CompetitionState | null;
  openPositionsCount: number;
  openPositionsValue: number;
  isBotRunning: boolean;
  tradingMode: "demo" | "live";
  liveBalance?: LiveBalance;
  setTradingMode?: (mode: "demo" | "live") => void;
  // Bot logs for historical trade tracking (contains TRADE entries with outcome)
  botLogs?: Array<{ type: string; details?: { outcome?: string; action?: string; amount?: number; stake?: number } }>;
  // Current open positions
  openPositions?: Array<{ outcome: string; stake: number }>;
  btcPrice?: number;
  btcWindowOpen?: number;
}

export interface TopDashboardState {
  // Bot stats
  activeBots: number;
  totalBotsBalance: number;
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalWinRate: number;

  // Exposure
  totalExposure: number;
  exposureRatio: number;
  potentialWin: number;
  potentialLoss: number;

  // Risk
  risk: { level: 'low' | 'medium' | 'high'; color: string; label: string };

  // Quick stats
  maxConsecutiveWins: number;
  bestTrade: number;

  // Run timer
  runTimeRemaining: number;

  // Market progress
  marketProgress: number;

  // Enhanced stats
  totalStake: number;
  yesTrades: number;
  noTrades: number;
  btcDelta: number;
}

export function useTopDashboardState({
  marketData,
  bots,
  competition,
  openPositionsCount,
  openPositionsValue,
  isBotRunning,
  openPositions = [],
  botLogs = [],
  btcPrice,
  btcWindowOpen,
}: UseTopDashboardStateProps): TopDashboardState {
  // Bot stats
  const activeBots = bots.filter(b => b.enabled).length;
  const totalBotsBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
  const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
  const totalWins = bots.reduce((sum, b) => sum + (b.stats?.wins || 0), 0);
  const totalLosses = bots.reduce((sum, b) => sum + (b.stats?.losses || 0), 0);
  const totalWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;

  // Exposure
  const totalExposure = openPositionsValue;
  const exposureRatio = totalBotsBalance > 0 ? (totalExposure / totalBotsBalance) * 100 : 0;
  const potentialWin = openPositionsValue * 2;
  const potentialLoss = openPositionsValue;

  // Calculate risk
  const risk = useMemo(() => {
    const exposureRatio = totalBotsBalance > 0 ? openPositionsValue / totalBotsBalance : 0;
    const activeRatio = bots.length > 0 ? activeBots / bots.length : 0;
    const riskScore = exposureRatio * 0.6 + activeRatio * 0.4;

    if (riskScore < 0.3) return { level: 'low' as const, color: '#22c55e', label: 'Low Risk' };
    if (riskScore < 0.6) return { level: 'medium' as const, color: '#f59e0b', label: 'Medium Risk' };
    return { level: 'high' as const, color: '#ef4444', label: 'High Risk' };
  }, [totalBotsBalance, openPositionsValue, activeBots, bots.length]);

  // Quick stats
  const maxConsecutiveWins = Math.max(...bots.map(b => b.stats?.maxConsecutiveWins || 0), 0);
  const bestTrade = Math.max(...bots.map(b => b.stats?.avgWin || 0), 0);

  // Run time remaining
  const [runTimeRemaining, setRunTimeRemaining] = useState(0);

  useEffect(() => {
    if (!competition?.active || !competition.config.duration) {
      setRunTimeRemaining(0);
      return;
    }

    const updateRunTime = () => {
      const elapsed = Date.now() - competition.startTime;
      const remaining = competition.config.duration! - elapsed;
      setRunTimeRemaining(Math.max(0, remaining));
    };

    updateRunTime();
    const interval = setInterval(updateRunTime, 1000);
    return () => clearInterval(interval);
  }, [competition]);

  // Market progress
  const marketProgress = useMemo(() => {
    if (!marketData?.market || !marketData.marketDuration) return 0;
    const elapsed = marketData.marketDuration - (marketData.timeRemaining || 0);
    return Math.min(100, Math.max(0, (elapsed / marketData.marketDuration) * 100));
  }, [marketData]);

  // Enhanced stats - computed from bot logs (TRADE entries) and open positions
  const totalStake = useMemo(() => {
    // Sum of all TRADE log amounts (historical bot trades)
    const fromBotLogs = botLogs
      .filter(log => log.type === "TRADE")
      .reduce((sum, log) => sum + (log.details?.amount || log.details?.stake || 0), 0);
    // Plus current open positions stake
    const fromOpenPositions = openPositions.reduce((sum, p) => sum + (p.stake || 0), 0);
    return fromBotLogs + fromOpenPositions;
  }, [botLogs, openPositions]);

  const { yesTrades, noTrades } = useMemo(() => {
    // Count from bot logs (TRADE entries)
    const yesFromLogs = botLogs.filter(log =>
      log.type === "TRADE" &&
      (log.details?.outcome === "YES" || log.details?.outcome === "UP" || log.details?.action === "YES" || log.details?.action === "UP")
    ).length;
    const noFromLogs = botLogs.filter(log =>
      log.type === "TRADE" &&
      (log.details?.outcome === "NO" || log.details?.outcome === "DOWN" || log.details?.action === "NO" || log.details?.action === "DOWN")
    ).length;
    // Plus current open positions
    const yesFromOpen = openPositions.filter(p => p.outcome === "YES").length;
    const noFromOpen = openPositions.filter(p => p.outcome === "NO").length;
    return { yesTrades: yesFromLogs + yesFromOpen, noTrades: noFromLogs + noFromOpen };
  }, [botLogs, openPositions]);

  const btcDelta = useMemo(() => {
    if (!btcPrice || !btcWindowOpen || btcWindowOpen <= 0) return 0;
    return ((btcPrice - btcWindowOpen) / btcWindowOpen) * 100;
  }, [btcPrice, btcWindowOpen]);

  return {
    activeBots,
    totalBotsBalance,
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
    totalWinRate,
    totalExposure,
    exposureRatio,
    potentialWin,
    potentialLoss,
    risk,
    maxConsecutiveWins,
    bestTrade,
    runTimeRemaining,
    marketProgress,
    totalStake,
    yesTrades,
    noTrades,
    btcDelta,
  };
}

// Utility functions
export function formatTimeRemaining(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${totalMinutes}m`;
}