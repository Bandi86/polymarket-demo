import { useState, useEffect, useCallback } from "react";
import { Trophy, Play, Square, Clock, Target, Zap } from "lucide-react";
import { formatCurrency, formatPercentage } from "../lib/utils";
import { MiniEquityCurve } from "./charts/MiniEquityCurve";
import type { BotData } from "../hooks/useTradingData";

interface CompetitionEntry {
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
}

interface CompetitionState {
  active: boolean;
  startTime: number;
  minTrades: number;
  startBalance: number;
  leaderboard: CompetitionEntry[];
  winner: string | null;
  completedAt: number | null;
  config: {
    minTrades: number;
    duration: number | null;
    startBalance: number;
  };
}

interface CompetitionTabProps {
  bots?: BotData[];
}

export function CompetitionTab({ bots = [] }: CompetitionTabProps) {
  const [competition, setCompetition] = useState<CompetitionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Config state
  const [config, setConfig] = useState({
    minTrades: 50,
    startBalance: 10,
  });

  const fetchCompetitionState = useCallback(async () => {
    try {
      const res = await fetch("/api/competition/status");
      const data = await res.json();
      setCompetition(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch competition state:", err);
      setError("Failed to load competition state");
    }
  }, []);

  useEffect(() => {
    fetchCompetitionState();
    const interval = setInterval(fetchCompetitionState, 2000);
    return () => clearInterval(interval);
  }, [fetchCompetitionState]);

  const startCompetition = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competition/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setCompetition(data.competition);
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
        setCompetition(data.competition);
      } else {
        setError(data.error || "Failed to stop competition");
      }
    } catch (err) {
      setError("Failed to stop competition");
    } finally {
      setLoading(false);
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

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
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
              <span className="live-indicator" style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e"
              }} />
              LIVE
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          {!competition?.active ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Min Trades</label>
                <input
                  type="number"
                  value={config.minTrades}
                  onChange={(e) => setConfig(c => ({ ...c, minTrades: parseInt(e.target.value) || 50 }))}
                  className="input"
                  style={{ width: 100, padding: "0.375rem 0.5rem", fontSize: "0.875rem" }}
                  min={10}
                  max={500}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Start Balance ($)</label>
                <input
                  type="number"
                  value={config.startBalance}
                  onChange={(e) => setConfig(c => ({ ...c, startBalance: parseFloat(e.target.value) || 10 }))}
                  className="input"
                  style={{ width: 100, padding: "0.375rem 0.5rem", fontSize: "0.875rem" }}
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
                Start Competition
              </button>
            </>
          ) : (
            <button
              onClick={stopCompetition}
              disabled={loading}
              className="trade-btn down"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem" }}
            >
              <Square className="w-4 h-4" />
              End Competition
            </button>
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
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            marginTop: "1rem"
          }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>P&L</span>
              <p style={{
                margin: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: winner.pnl >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {winner.pnl >= 0 ? "+" : ""}{formatCurrency(winner.pnl)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ROI</span>
              <p style={{
                margin: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: winner.roi >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {winner.roi >= 0 ? "+" : ""}{winner.roi.toFixed(1)}%
              </p>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Win Rate</span>
              <p style={{
                margin: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "1.25rem",
                fontWeight: 600
              }}>
                {formatPercentage(winner.winRate)}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-muted)" }}>Min Trades:</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>{competition.minTrades}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Start Balance:</span>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>${competition.startBalance}</span>
          </div>
          {competition.completedAt && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Duration:</span>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                {formatDuration(competition.completedAt - competition.startTime)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {competition && competition.leaderboard.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Leaderboard</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Rank</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Bot</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Strategy</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win Rate</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Equity</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>P&L</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>ROI</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {competition.leaderboard.map((entry) => {
                  const isWinner = entry.botId === competition.winner;
                  const isQualified = entry.trades >= competition.minTrades;
                  
                  // Compute equity curve for this bot
                  const matchingBot = bots.find(b => b.id === entry.botId);
                  const closedPositions = (matchingBot?.portfolio?.closedPositions || []) as any[];
                  
                  // Start equity with either competition startBalance or bot's initial config balance
                  const startBalanceForCurve = competition.startBalance || 10;
                  const equityCurvePlot = [startBalanceForCurve];
                  let currentBalance = startBalanceForCurve;
                  
                  closedPositions.forEach((p: any) => {
                    currentBalance += (p.pnl || 0);
                    equityCurvePlot.push(currentBalance);
                  });
                  
                  if (equityCurvePlot.length === 1) {
                    equityCurvePlot.push(startBalanceForCurve); // need 2 points for a line
                  }
                  
                  return (
                    <tr
                      key={entry.botId}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: isWinner ? "rgba(251, 191, 36, 0.05)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        {getRankBadge(entry.rank)}
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {entry.botName}
                          {isWinner && <Trophy className="w-3 h-3" style={{ color: "#fbbf24" }} />}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <span style={{
                          padding: "0.125rem 0.5rem",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          background: `${getStrategyColor(entry.strategy)}20`,
                          color: getStrategyColor(entry.strategy)
                        }}>
                          {entry.strategy}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        <span style={{ color: isQualified ? "var(--text-primary)" : "var(--text-muted)" }}>
                          {entry.trades}
                        </span>
                        {!isQualified && (
                          <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                            (min {competition.minTrades})
                          </span>
                        )}
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
                        {entry.roi >= 0 ? "+" : ""}{entry.roi.toFixed(1)}%
                      </td>
                      <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                        {formatCurrency(entry.balance)}
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
            Start a competition to run all strategies in parallel with equal conditions.
            <br />
            The best strategy will be determined by P&L after reaching the minimum trade count.
          </p>
        </div>
      )}

      {/* Help Text */}
      <div style={{
        padding: "1rem",
        background: "rgba(59, 130, 246, 0.1)",
        borderRadius: 8,
        fontSize: "0.875rem",
        color: "var(--text-secondary)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Zap className="w-4 h-4" style={{ color: "#3b82f6" }} />
          <span style={{ fontWeight: 600 }}>How Competition Works</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
          <li>All bots start with equal balance (default: $10)</li>
          <li>Bots must reach minimum trades (default: 50) to qualify</li>
          <li>Ranked by P&L, tie-breaker by win rate</li>
          <li>Winner announced when competition ends</li>
        </ul>
      </div>
    </div>
  );
}