import { useState, useEffect } from "react";
import { Zap, Play, Square, Activity, FlaskConical, Trophy, Settings, BarChart2, Clock, TrendingUp, Flame, AlertTriangle, Shield, RefreshCw } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { PriceTicker } from "./ui/PriceTicker";
import { ThemeToggle } from "./ui/ThemeToggle";
import { SoundToggle } from "./ui/SoundToggle";
import { toast } from "./ui/toast";
import type { MarketData, BotData, CompetitionState, LiveBalance } from "../hooks/useTradingData";
import type { Portfolio } from "../types";

export type TabId = 'trade' | 'monitor' | 'backtest' | 'leaderboard' | 'config' | 'risk';

interface TopDashboardProps {
  // Global
  marketData: MarketData | null;
  portfolio: Portfolio | null;
  yesPrice: number;
  noPrice: number;
  apiLatency: number;
  coinColor: string;
  isBotRunning: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  // Bot stats
  bots: BotData[];
  onRunAll: () => Promise<void>;
  onStopAll: () => Promise<void>;
  // Competition state
  competition: CompetitionState | null;
  // Positions
  openPositionsCount: number;
  openPositionsValue: number;
  // Tabs
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  // Selectors
  selectedAsset: string;
  onAssetChange: (asset: string) => void;
  selectedTimeframe: string;
  onTimeframeChange: (tf: string) => void;
  // Trading mode
  tradingMode?: "demo" | "live";
  // Live balance from Polymarket
  liveBalance?: LiveBalance;
  onRefreshLiveBalance?: () => Promise<void>;
}

function formatTimeRemaining(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDurationMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${totalMinutes}m`;
}

function calculateMarketProgress(marketData: MarketData | null): number {
  if (!marketData?.market || !marketData.marketDuration) return 0;
  const elapsed = marketData.marketDuration - (marketData.timeRemaining || 0);
  return Math.min(100, Math.max(0, (elapsed / marketData.marketDuration) * 100));
}

function calculateRiskLevel(bots: BotData[], positions: { count: number; value: number }): { level: 'low' | 'medium' | 'high'; color: string; label: string } {
  const totalBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
  const activeBots = bots.filter(b => b.enabled).length;

  // Calculate exposure ratio
  const exposureRatio = totalBalance > 0 ? positions.value / totalBalance : 0;
  const activeRatio = bots.length > 0 ? activeBots / bots.length : 0;

  // Risk score
  const riskScore = exposureRatio * 0.6 + activeRatio * 0.4;

  if (riskScore < 0.3) return { level: 'low', color: '#22c55e', label: 'Low Risk' };
  if (riskScore < 0.6) return { level: 'medium', color: '#f59e0b', label: 'Medium Risk' };
  return { level: 'high', color: '#ef4444', label: 'High Risk' };
}

export function TopDashboard({
  marketData,
  portfolio,
  yesPrice,
  noPrice,
  apiLatency,
  coinColor,
  isBotRunning,
  soundEnabled,
  onToggleSound,
  bots,
  onRunAll,
  onStopAll,
  competition,
  openPositionsCount,
  openPositionsValue,
  activeTab,
  onTabChange,
  selectedAsset,
  onAssetChange,
  selectedTimeframe,
  onTimeframeChange,
  tradingMode = "demo",
  liveBalance,
  onRefreshLiveBalance,
}: TopDashboardProps) {

  const activeBots = bots.filter(b => b.enabled).length;
  const totalBotsBalance = bots.reduce((sum, b) => sum + (b.portfolio?.balance || 0), 0);
  const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
  const totalWins = bots.reduce((sum, b) => sum + (b.stats?.wins || 0), 0);
  const totalLosses = bots.reduce((sum, b) => sum + (b.stats?.losses || 0), 0);
  const totalWinRate = bots.length > 0
    ? bots.reduce((sum, b) => sum + (b.stats?.winRate || 0), 0) / bots.length
    : 0;

  // Calculate potential outcomes from positions
  const totalExposure = openPositionsValue;
  const exposureRatio = totalBotsBalance > 0 ? (totalExposure / totalBotsBalance) * 100 : 0;

  // Potential P&L if all positions win/lose (simplified calculation)
  const potentialWin = openPositionsValue * 2; // If all positions are correct
  const potentialLoss = openPositionsValue; // If all positions are wrong

  const timeRemaining = marketData?.timeRemaining || 0;

  // Calculate run time remaining
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

  // Calculate risk
  const risk = calculateRiskLevel(bots, { count: openPositionsCount, value: openPositionsValue });

  // Quick stats
  const maxConsecutiveWins = Math.max(...bots.map(b => b.stats?.maxConsecutiveWins || 0), 0);
  const bestTrade = Math.max(...bots.map(b => b.stats?.avgWin || 0), 0);

  // Quick run handler
  const handleQuickRun = async (durationMinutes: number) => {
    try {
      const res = await fetch("/api/competition/quick-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes })
      });

      if (res.ok) {
        toast.success(`Started ${formatDurationMs(durationMinutes * 60000)} run`, `${bots.length} bots enabled`);
      } else {
        toast.error("Failed to start quick run");
      }
    } catch (err) {
      toast.error("Failed to start quick run");
    }
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'trade', label: 'Manual Trade', icon: BarChart2 },
    { id: 'monitor', label: 'Monitor', icon: Activity },
    { id: 'risk', label: 'Risk', icon: Shield },
    { id: 'backtest', label: 'Backtest', icon: FlaskConical },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'config', label: 'Config', icon: Settings },
  ];

  const ASSETS = ["BTC", "ETH", "SOL", "XRP"];
  const TIMEFRAMES = [
    { id: "5", label: "5m" },
    { id: "15", label: "15m" },
    { id: "60", label: "1h" },
    { id: "240", label: "4h" },
  ];

  const QUICK_RUN_OPTIONS = [
    { minutes: 30, label: "30m" },
    { minutes: 60, label: "1h" },
    { minutes: 120, label: "2h" },
    { minutes: 240, label: "4h" },
  ];

  return (
    <div style={{
      background: "rgba(11, 11, 15, 0.95)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      width: "100%"
    }}>
      <div style={{
        maxWidth: 1600,
        margin: "0 auto",
        width: "100%",
        padding: "1rem 1.5rem 0",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }}>
        {/* ROW 1: Logo & Global Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {/* Logo + Mode Badge */}
          <div style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Zap style={{ color: coinColor }} className="w-5 h-5" />
            <span>Poly</span><span style={{ color: "var(--primary)" }}>Trade</span>
            {tradingMode === "live" && (
              <span style={{
                fontSize: "0.625rem",
                padding: "0.125rem 0.5rem",
                borderRadius: 999,
                background: "rgba(239, 68, 68, 0.2)",
                color: "#ef4444",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                LIVE
              </span>
            )}
          </div>

          {/* Asset & Timeframe Selectors */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "var(--glass-bg)", padding: "0.25rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {ASSETS.map(asset => (
                <button
                  key={asset}
                  onClick={() => onAssetChange(asset)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: selectedAsset === asset ? 700 : 500,
                    background: selectedAsset === asset ? `${coinColor}20` : "transparent",
                    color: selectedAsset === asset ? coinColor : "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {asset}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: "var(--border)" }} />
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.id}
                  onClick={() => onTimeframeChange(tf.id)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    fontWeight: selectedTimeframe === tf.id ? 700 : 500,
                    background: selectedTimeframe === tf.id ? "var(--primary)" : "transparent",
                    color: selectedTimeframe === tf.id ? "white" : "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Ticker */}
          <PriceTicker className="hidden xl:flex" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Risk Meter */}
          {isBotRunning && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0.75rem",
              borderRadius: 999,
              background: `${risk.color}15`,
              border: `1px solid ${risk.color}30`,
            }}>
              <AlertTriangle style={{ width: 14, height: 14, color: risk.color }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: risk.color }}>
                {risk.label}
              </span>
            </div>
          )}

          <div className="status-pill">
            <span style={{ color: "var(--text-muted)" }}>Latency:</span>
            <span style={{ fontFamily: "monospace", marginLeft: 4 }}>{apiLatency}ms</span>
          </div>
          <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
          <ThemeToggle />
        </div>
      </div>

      {/* Quick Stats Cards */}
      {(isBotRunning || totalPnl !== 0) && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {maxConsecutiveWins >= 3 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.05))",
              border: "1px solid rgba(251, 146, 60, 0.3)",
            }}>
              <Flame style={{ width: 14, height: 14, color: "#fb923c" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fb923c" }}>
                🔥 Hot Streak: {maxConsecutiveWins} wins
              </span>
            </div>
          )}
          {bestTrade > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))",
              border: "1px solid rgba(34, 197, 94, 0.3)",
            }}>
              <TrendingUp style={{ width: 14, height: 14, color: "#22c55e" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#22c55e" }}>
                📈 Best Trade: +${bestTrade.toFixed(0)}
              </span>
            </div>
          )}
          {isBotRunning && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))",
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}>
              <Zap style={{ width: 14, height: 14, color: "#3b82f6" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3b82f6" }}>
                ⚡ Active: {activeBots} bots
              </span>
            </div>
          )}
        </div>
      )}

      {/* ROW 2: Detailed Market & Bot Stats Box */}
      {marketData?.market && (
        <div style={{
          background: "linear-gradient(wrap, rgba(0,0,0,0.4), rgba(0,0,0,0.2))",
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* Top Half: Current Market */}
          <div style={{ borderBottom: "1px solid var(--border)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
             <div style={{ flex: "1 1 auto", minWidth: 0, paddingRight: "2rem" }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Current Market
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {marketData.market.question || `${marketData.market.asset || "BTC"} ${marketData.market.timeframe || "5m"} Market`}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2.5rem" }}>
              {/* Time Remaining */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Time Left</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color: timeRemaining < 60000 ? "var(--red)" : timeRemaining < 180000 ? "var(--warning)" : "var(--text-primary)"
                  }}>
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                  <div style={{ width: 100, textAlign: "left" }}>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${calculateMarketProgress(marketData)}%`,
                          background: timeRemaining < 60 ? "var(--red)" : "var(--primary)",
                          borderRadius: 3,
                          transition: "width 1s linear"
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      {calculateMarketProgress(marketData).toFixed(0)}% elapsed
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Probabilities */}
              <div style={{ display: "flex", gap: "1.5rem", borderLeft: "1px solid var(--border)", paddingLeft: "2.5rem" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>YES</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--green)" }}>
                    {(yesPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>NO</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--red)" }}>
                    {(noPrice * 100).toFixed(1)}¢
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Half: Financials, Bot Stats & Controls */}
          <div style={{ padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ display: "flex", gap: "2.5rem" }}>
              {/* Overall Balance */}
              <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Balance</span>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
                  {formatCurrency(totalBotsBalance)}
                </span>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                  ({bots.length} bots)
                </span>
              </div>

              {/* Live Polymarket Balance */}
              {liveBalance && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Polymarket
                    </span>
                    {liveBalance.isLive ? (
                      <span style={{
                        fontSize: "0.5rem",
                        padding: "0.125rem 0.375rem",
                        background: "rgba(34, 197, 94, 0.2)",
                        color: "#22c55e",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        LIVE
                      </span>
                    ) : (
                      <span style={{
                        fontSize: "0.5rem",
                        padding: "0.125rem 0.375rem",
                        background: "rgba(245, 158, 11, 0.2)",
                        color: "#f59e0b",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        DEMO
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color: liveBalance.isLive ? "var(--text-primary)" : "var(--text-muted)",
                    }}>
                      ${liveBalance.balance.toFixed(2)}
                    </span>
                    {onRefreshLiveBalance && (
                      <button
                        onClick={onRefreshLiveBalance}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Refresh balance"
                      >
                        <RefreshCw className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* Overall P&L */}
              <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total P&L</span>
                <span style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  color: totalPnl >= 0 ? "var(--green)" : "var(--red)"
                }}>
                  {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
                </span>
              </div>

              <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />

              {/* Bot Stats */}
              <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bots Active</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: isBotRunning ? "var(--green)" : "var(--text-muted)" }}>
                    {activeBots}<span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 2, fontSize: "1rem" }}>/{bots.length}</span>
                  </span>
                  {isBotRunning && runTimeRemaining > 0 && (
                    <span style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.75rem",
                      fontFamily: "ui-monospace, monospace",
                      color: runTimeRemaining < 60000 ? "var(--red)" : "var(--text-muted)",
                      padding: "0.125rem 0.5rem",
                      background: runTimeRemaining < 60000 ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.05)",
                      borderRadius: 4,
                    }}>
                      <Clock style={{ width: 12, height: 12 }} />
                      {formatTimeRemaining(runTimeRemaining)}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bot Win Rate</span>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
                  {(totalWinRate * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bot Trades</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--text-primary)" }}>
                    {totalTrades}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem" }}>
                    <span style={{ color: "#22c55e" }}>{totalWins}W</span>
                    <span style={{ color: "var(--text-muted)" }}>/</span>
                    <span style={{ color: "#ef4444" }}>{totalLosses}L</span>
                  </span>
                </div>
              </div>

              {/* Exposure */}
              {totalExposure > 0 && (
                <div>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Exposure</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--warning)" }}>
                      {formatCurrency(totalExposure)}
                    </span>
                    <span style={{
                      fontSize: "0.625rem",
                      padding: "0.125rem 0.375rem",
                      borderRadius: 4,
                      background: exposureRatio > 50 ? "rgba(239, 68, 68, 0.15)" : exposureRatio > 25 ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                      color: exposureRatio > 50 ? "#ef4444" : exposureRatio > 25 ? "#f59e0b" : "#22c55e",
                    }}>
                      {exposureRatio.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Open Positions */}
              {openPositionsCount > 0 && (
                <>
                  <div style={{ width: 1, background: "var(--border)", height: 32, alignSelf: "center", opacity: 0.5 }} />
                  <div>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Positions</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--primary)" }}>
                        {openPositionsCount}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                        <span style={{ fontSize: "0.625rem", color: "#22c55e", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          ↑ +${potentialWin.toFixed(0)}
                        </span>
                        <span style={{ fontSize: "0.625rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          ↓ -${potentialLoss.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Control Buttons */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {/* Quick Run Buttons */}
              {!isBotRunning && (
                <div style={{ display: "flex", gap: "0.25rem", padding: "0.25rem", background: "var(--glass-bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  {QUICK_RUN_OPTIONS.map(opt => (
                    <button
                      key={opt.minutes}
                      onClick={() => handleQuickRun(opt.minutes)}
                      style={{
                        padding: "0.375rem 0.625rem",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "transparent",
                        color: "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(34, 197, 94, 0.15)";
                        e.currentTarget.style.color = "#22c55e";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-muted)";
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={onRunAll}
                disabled={isBotRunning}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.5rem 1.5rem", borderRadius: 8, border: "none",
                  background: isBotRunning ? "rgba(34, 197, 94, 0.2)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: isBotRunning ? "#22c55e" : "white",
                  fontWeight: 600, cursor: isBotRunning ? "not-allowed" : "pointer", fontSize: "0.875rem",
                  transition: "all 0.2s"
                }}
              >
                <Play className="w-4 h-4" fill={!isBotRunning ? "currentColor" : "none"} />
                RUN ALL
              </button>
              <button
                onClick={onStopAll}
                disabled={!isBotRunning}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.5rem 1.5rem", borderRadius: 8,
                  border: isBotRunning ? "1px solid var(--red)" : "1px solid var(--border)",
                  background: isBotRunning ? "rgba(239, 68, 68, 0.1)" : "transparent",
                  color: isBotRunning ? "var(--red)" : "var(--text-muted)",
                  fontWeight: 600, cursor: !isBotRunning ? "not-allowed" : "pointer", fontSize: "0.875rem",
                  transition: "all 0.2s"
                }}
              >
                <Square className="w-4 h-4" />
                STOP ALL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROW 3: Tab Navigation */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        gap: "0.5rem",
        marginTop: "auto"
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                borderRadius: "10px 10px 0 0",
                border: "none",
                background: isActive ? "var(--bg)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                fontSize: "0.875rem",
                transition: "all 0.2s",
                position: "relative",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <div style={{
                  position: "absolute", bottom: -2, left: "10%", right: "10%", height: 2,
                  boxShadow: "0 -4px 12px 2px var(--primary)", opacity: 0.5
                }} />
              )}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}