'use client'

import { useState } from "react";
import { Trophy, Play, Square, Clock, Zap, Download, RotateCcw, RefreshCw } from "lucide-react";
import { formatCurrency, formatPercentage, formatDuration } from "@/lib/utils";
import { MiniEquityCurve } from "@/components/charts/MiniEquityCurve";
import { DiagnosticsPanel } from "@/components/dashboard/DiagnosticsPanel";
import { LiveLogPanel } from "@/components/dashboard/LiveLogPanel";
import { useTradingStore } from "@/lib/stores/trading-store";
import { useBotStore } from "@/lib/stores/bot-store";
import type { BotData, CompetitionState } from "@/hooks/useTradingData";
import type { Position } from "@/types";

interface CompetitionTabProps {
  bots?: BotData[];
  competition: CompetitionState | null;
  onRefreshData: () => Promise<void>;
}

// Quick run presets
const QUICK_RUN_PRESETS = [
  { label: "15m", duration: 15, color: "#22c55e" },
  { label: "30m", duration: 30, color: "#3b82f6" },
  { label: "1h", duration: 60, color: "#8b5cf6" },
  { label: "2h", duration: 120, color: "#f59e0b" },
];

export function CompetitionTab({ bots = [], competition, onRefreshData }: CompetitionTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetingBot, setResetingBot] = useState<string | null>(null);

  // Get diagnostics data from stores
  const yesPrice = useTradingStore((s) => s.yesPrice);
  const noPrice = useTradingStore((s) => s.noPrice);
  const btcPrice = useTradingStore((s) => s.btcPrice);
  const timeRemaining = useTradingStore((s) => s.timeRemaining);
  const botLogs = useBotStore((s) => s.botLogs);

  // Market price
  const marketPrice = { yesPrice, noPrice };

  // Config state
  const [config, setConfig] = useState({
    minTrades: 50,
    startBalance: 10,
    durationMinutes: 30,
  });

  const startCompetition = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competition/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minTrades: config.minTrades,
          startBalance: config.startBalance,
          durationMinutes: config.durationMinutes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await onRefreshData();
      } else {
        setError(data.error || "Failed to start competition");
      }
    } catch (err) {
      setError("Failed to start competition");
    } finally {
      setLoading(false);
    }
  };

  const stopCompetition = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competition/stop", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await onRefreshData();
      } else {
        setError(data.error || "Failed to stop competition");
      }
    } catch (err) {
      setError("Failed to stop competition");
    } finally {
      setLoading(false);
    }
  };

  const startQuickRun = async (durationMinutes: number) => {
    setLoading(true);
    setError(null);
    try {
      console.log(`[CompetitionTab] Starting ${durationMinutes}min quick run...`);
      const res = await fetch("/api/competition/quick-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes }),
      });
      const data = await res.json();
      console.log(`[CompetitionTab] Quick run response:`, data);
      if (data.success) {
        await onRefreshData();
      } else {
        const errorMsg = data.error || "Failed to start run";
        console.error(`[CompetitionTab] Error:`, errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error(`[CompetitionTab] Exception:`, err);
      setError("Failed to start run");
    } finally {
      setLoading(false);
    }
  };

  const resetBot = async (botId: string) => {
    setResetingBot(botId);
    try {
      const res = await fetch(`/api/bots/${botId}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await onRefreshData();
      } else {
        setError(data.error || "Failed to reset bot");
      }
    } catch (err) {
      setError("Failed to reset bot");
    } finally {
      setResetingBot(null);
    }
  };

  const resetAllBots = async () => {
    setLoading(true);
    try {
      await fetch("/api/bots/reset-all", { method: "POST" });
      await onRefreshData();
    } catch (err) {
      setError("Failed to reset all bots");
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (botId: string) => {
    try {
      await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      await onRefreshData();
    } catch (err) {
      setError("Failed to toggle bot");
    }
  };

  const exportData = async () => {
    try {
      const res = await fetch("/api/competition/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `polymarket-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export data:", err);
    }
  };

  const getStrategyColor = (strategy: string): string => {
    const colors: Record<string, string> = {
      momentum: "#3b82f6",
      mean_reversion: "#8b5cf6",
      trend: "#06b6d4",
      smart_trend: "#0ea5e9",
      contrarian: "#f59e0b",
      fair_value: "#10b981",
      arbitrage: "#ec4899",
      grid_trading: "#6366f1",
      binance_signal: "#f97316",
      last_seconds_scalp: "#ef4444",
      window_delta: "#22c55e",
      monte_carlo: "#a855f7",
      random: "#6b7280",
    };
    return colors[strategy] || "#6b7280";
  };

  const getRankBadge = (rank: number): React.ReactNode => {
    if (rank === 1) return <Trophy className="w-4 h-4" style={{ color: "#fbbf24" }} />;
    if (rank === 2) return <Trophy className="w-4 h-4" style={{ color: "#9ca3af" }} />;
    if (rank === 3) return <Trophy className="w-4 h-4" style={{ color: "#cd7f32" }} />;
    return <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>#{rank}</span>;
  };

  const getPerformanceIndicator = (pnl: number, trades: number): { emoji: string; label: string } => {
    if (trades < 3) return { emoji: "⏳", label: "Too few trades" };
    if (pnl > 3) return { emoji: "⭐⭐⭐", label: "Excellent" };
    if (pnl > 1) return { emoji: "⭐⭐", label: "Good" };
    if (pnl > 0) return { emoji: "⭐", label: "Positive" };
    if (pnl > -1) return { emoji: "⚠️", label: "Small loss" };
    if (pnl > -3) return { emoji: "❌", label: "Loss" };
    return { emoji: "❌❌", label: "Big loss" };
  };

  const winner = competition?.winner
    ? competition.leaderboard.find(e => e.botId === competition.winner)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Trophy className="w-5 h-5" style={{ color: "#fbbf24" }} />
            <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Strategy Competition</span>
          </div>
          {competition?.active && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.25rem 0.75rem",
              background: "rgba(34, 197, 94, 0.2)",
              borderRadius: 9999,
              fontSize: "0.75rem",
              color: "#22c55e"
            }}>
              <span className="live-indicator" style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              LIVE
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          {!competition?.active ? (
            <>
              {/* Quick Run Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Quick Run</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {QUICK_RUN_PRESETS.map(preset => (
                    <button
                      key={preset.duration}
                      onClick={() => startQuickRun(preset.duration)}
                      disabled={loading}
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: 6,
                        border: "none",
                        background: preset.color,
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Config */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Duration (min)</label>
                <input
                  type="number"
                  value={config.durationMinutes}
                  onChange={(e) => setConfig(c => ({ ...c, durationMinutes: parseInt(e.target.value) || 30 }))}
                  className="input"
                  style={{ width: 80, padding: "0.375rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={1440}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Start $</label>
                <input
                  type="number"
                  value={config.startBalance}
                  onChange={(e) => setConfig(c => ({ ...c, startBalance: parseFloat(e.target.value) || 10 }))}
                  className="input"
                  style={{ width: 70, padding: "0.375rem 0.5rem", fontSize: "0.875rem" }}
                  min={1}
                  max={100}
                />
              </div>
              <button
                onClick={startCompetition}
                disabled={loading}
                className="trade-btn up"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem" }}
              >
                <Play className="w-4 h-4" />
                Start
              </button>
              <button
                onClick={resetAllBots}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw className="w-4 h-4" />
                Reset All
              </button>
            </>
          ) : (
            <>
              <button
                onClick={stopCompetition}
                disabled={loading}
                className="trade-btn down"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem" }}
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
              <button
                onClick={exportData}
                className="trade-btn up"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "linear-gradient(135deg, #06b6d4, #0ea5e9)" }}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: "1rem",
            padding: "0.5rem",
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 6,
            color: "#ef4444",
            fontSize: "0.875rem"
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Winner Announcement */}
      {winner && !competition?.active && (
        <div style={{
          padding: "1.5rem",
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))",
          borderRadius: 12,
          border: "1px solid rgba(251, 191, 36, 0.3)",
          textAlign: "center"
        }}>
          <Trophy className="w-8 h-8" style={{ color: "#fbbf24", margin: "0 auto 0.5rem" }} />
          <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>
            Winner: {winner.botName}
          </h3>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            {winner.strategy} strategy with {winner.trades} trades
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", marginTop: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>P&L</span>
              <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: "1.25rem", fontWeight: 600, color: winner.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                {winner.pnl >= 0 ? "+" : ""}{formatCurrency(winner.pnl)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ROI</span>
              <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: "1.25rem", fontWeight: 600, color: winner.roi >= 0 ? "#22c55e" : "#ef4444" }}>
                {winner.roi >= 0 ? "+" : ""}{winner.roi.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {competition && (
        <div style={{
          display: "flex",
          gap: "1.5rem",
          padding: "0.75rem 1rem",
          background: "var(--glass-bg)",
          borderRadius: 8,
          fontSize: "0.875rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-muted)" }}>Started:</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>
              {new Date(competition.startTime).toLocaleTimeString()}
            </span>
            {competition.active && (
              <span style={{ color: "var(--text-muted)" }}>
                ({formatDuration(Date.now() - competition.startTime)} elapsed)
              </span>
            )}
          </div>
          {competition.active && competition.config.duration && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Time Left:</span>
              <span style={{
                fontFamily: "ui-monospace, monospace",
                color: Math.max(0, competition.config.duration - (Date.now() - competition.startTime)) < 60000
                  ? "#ef4444"
                  : "var(--text-primary)"
              }}>
                {formatDuration(Math.max(0, competition.config.duration - (Date.now() - competition.startTime)))}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Start Balance:</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>${competition.startBalance}</span>
          </div>
        </div>
      )}

      {/* Diagnostics & Live Log */}
      {competition?.active && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <DiagnosticsPanel
            btcPrice={btcPrice}
            marketPrice={marketPrice}
            timeRemaining={timeRemaining}
          />
          <LiveLogPanel logs={botLogs.slice(0, 50)} maxItems={30} />
        </div>
      )}

      {/* Leaderboard */}
      {competition && competition.leaderboard.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          {/* Leaderboard Summary Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            padding: "0.75rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 8,
            fontSize: "0.875rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Total P&L</span>
                <div style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 600,
                  color: competition.leaderboard.reduce((sum, e) => sum + e.pnl, 0) >= 0 ? "#22c55e" : "#ef4444",
                }}>
                  {competition.leaderboard.reduce((sum, e) => sum + e.pnl, 0) >= 0 ? "+" : ""}
                  {formatCurrency(competition.leaderboard.reduce((sum, e) => sum + e.pnl, 0))}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Total Trades</span>
                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                  {competition.leaderboard.reduce((sum, e) => sum + e.trades, 0)}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Winners/Losers</span>
                <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                  <span style={{ color: "#22c55e" }}>{competition.leaderboard.filter(e => e.pnl > 0).length}</span>
                  <span style={{ color: "var(--text-muted)" }}>/</span>
                  <span style={{ color: "#ef4444" }}>{competition.leaderboard.filter(e => e.pnl < 0).length}</span>
                </div>
              </div>
            </div>
          </div>

          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Leaderboard</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Rank</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Bot</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win%</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Equity</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>P&L</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>ROI</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {competition.leaderboard.map((entry) => {
                  const isWinner = entry.botId === competition.winner;
                  const matchingBot = bots.find(b => b.id === entry.botId);
                  const closedPositions = (matchingBot?.portfolio?.closedPositions || []) as Position[];
                  const startBalanceForCurve = competition.startBalance || 10;
                  const equityCurvePlot = [startBalanceForCurve];
                  let currentBalance = startBalanceForCurve;
                  closedPositions.forEach((p) => {
                    currentBalance += (p.pnl || 0);
                    equityCurvePlot.push(currentBalance);
                  });
                  if (equityCurvePlot.length === 1) equityCurvePlot.push(startBalanceForCurve);

                  const perf = getPerformanceIndicator(entry.pnl, entry.trades);
                  const botEnabled = matchingBot?.enabled ?? false;

                  return (
                    <tr
                      key={entry.botId}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isWinner ? "rgba(251, 191, 36, 0.05)" : entry.pnl < -2 ? "rgba(239, 68, 68, 0.05)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        {getRankBadge(entry.rank)}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: botEnabled ? "#22c55e" : "var(--text-muted)",
                          }} />
                          {entry.botName}
                          {isWinner && <Trophy className="w-3 h-3" style={{ color: "#fbbf24" }} />}
                          <span style={{ fontSize: "0.7rem" }}>{perf.emoji}</span>
                        </div>
                        <span style={{
                          fontSize: "0.625rem",
                          color: getStrategyColor(entry.strategy),
                          background: `${getStrategyColor(entry.strategy)}20`,
                          padding: "0.125rem 0.375rem",
                          borderRadius: 4,
                        }}>
                          {entry.strategy}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        {entry.trades}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        {formatPercentage(entry.winRate)}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <MiniEquityCurve
                            data={equityCurvePlot}
                            color={getStrategyColor(entry.strategy)}
                            size={20}
                          />
                        </div>
                      </td>
                      <td style={{
                        padding: "0.75rem 0.5rem",
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: entry.pnl >= 0 ? "#22c55e" : "#ef4444",
                        fontWeight: 600
                      }}>
                        {entry.pnl >= 0 ? "+" : ""}{formatCurrency(entry.pnl)}
                      </td>
                      <td style={{
                        padding: "0.75rem 0.5rem",
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        color: entry.roi >= 0 ? "#22c55e" : "#ef4444",
                        fontWeight: 600
                      }}>
                        {entry.roi >= 0 ? "+" : ""}{entry.roi.toFixed(0)}%
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "0.25rem" }}>
                          <button
                            onClick={() => toggleBot(entry.botId)}
                            disabled={!competition.active}
                            title={botEnabled ? "Stop bot" : "Start bot"}
                            style={{
                              padding: "0.25rem",
                              background: "transparent",
                              border: "none",
                              cursor: competition.active ? "pointer" : "not-allowed",
                              opacity: competition.active ? 1 : 0.3,
                            }}
                          >
                            {botEnabled ? (
                              <Square className="w-4 h-4" style={{ color: "#ef4444" }} />
                            ) : (
                              <Play className="w-4 h-4" style={{ color: "#22c55e" }} />
                            )}
                          </button>
                          <button
                            onClick={() => resetBot(entry.botId)}
                            disabled={resetingBot === entry.botId || competition.active}
                            title="Reset bot balance"
                            style={{
                              padding: "0.25rem",
                              background: "transparent",
                              border: "none",
                              cursor: competition.active ? "not-allowed" : "pointer",
                              opacity: competition.active ? 0.3 : 1,
                            }}
                          >
                            <RotateCcw className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!competition?.active && !competition?.leaderboard.length && (
        <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
          <Trophy className="w-12 h-12" style={{ margin: "0 auto 1rem", color: "var(--text-muted)", opacity: 0.5 }} />
          <h3 style={{ margin: "0 0 0.5rem", color: "var(--text-secondary)" }}>No Competition Yet</h3>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Use Quick Run buttons for fast testing or configure custom settings.
          </p>
        </div>
      )}

      {/* Performance Summary */}
      {competition && !competition.active && competition.leaderboard.length > 0 && (
        <div style={{
          padding: "1rem",
          background: "rgba(59, 130, 246, 0.1)",
          borderRadius: 8,
          fontSize: "0.875rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Zap className="w-4 h-4" style={{ color: "#3b82f6" }} />
            <span style={{ fontWeight: 600 }}>Performance Summary</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Winning Bots:</span>
              <span style={{ marginLeft: "0.5rem", color: "#22c55e", fontWeight: 600 }}>
                {competition.leaderboard.filter(e => e.pnl > 0).length}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Losing Bots:</span>
              <span style={{ marginLeft: "0.5rem", color: "#ef4444", fontWeight: 600 }}>
                {competition.leaderboard.filter(e => e.pnl < 0).length}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Best Win Rate:</span>
              <span style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                {formatPercentage(Math.max(...competition.leaderboard.map(e => e.winRate)))}
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Total Trades:</span>
              <span style={{ marginLeft: "0.5rem", fontWeight: 600 }}>
                {competition.leaderboard.reduce((sum, e) => sum + e.trades, 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}