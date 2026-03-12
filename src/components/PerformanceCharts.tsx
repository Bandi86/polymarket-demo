// Performance Charts - Visualizations for strategy performance
import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";

interface StrategyRanking {
  strategy: string;
  winRate: number;
  avgPnL: number;
  totalPnL: number;
  trades: number;
  sharpe: number;
}

interface TradeDistribution {
  wins: number[];
  losses: number[];
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  winCount: number;
  lossCount: number;
  profitFactor: number;
}

interface TimePerformance {
  intervals: Array<{
    hour: number;
    trades: number;
    wins: number;
    pnl: number;
    winRate: number;
  }>;
}

export function PerformanceCharts() {
  const [rankings, setRankings] = useState<StrategyRanking[]>([]);
  const [distribution, setDistribution] = useState<TradeDistribution | null>(null);
  const [timePerf, setTimePerf] = useState<TimePerformance | null>(null);
  const [activeChart, setActiveChart] = useState<"ranking" | "distribution" | "time">("ranking");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [rankingRes, distRes, timeRes] = await Promise.all([
        fetch("/api/analytics/rankings"),
        fetch("/api/analytics/distribution"),
        fetch("/api/analytics/time-performance"),
      ]);

      const rankingData = await rankingRes.json();
      const distData = await distRes.json();
      const timeData = await timeRes.json();

      setRankings(rankingData);
      setDistribution(distData);
      setTimePerf(timeData);
    } catch (err) {
      console.error("Failed to fetch analytics data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const getStrategyDisplayName = (strategy: string): string => {
    const names: Record<string, string> = {
      momentum: "Momentum",
      mean_reversion: "Mean Reversion",
      trend: "Trend",
      smart_trend: "Smart Trend",
      contrarian: "Contrarian",
      fair_value: "Fair Value",
      arbitrage: "Arbitrage",
      grid_trading: "Grid Trading",
      binance_signal: "Binance Signal",
      last_seconds_scalp: "Last Seconds Scalp",
      random: "Random",
    };
    return names[strategy] || strategy;
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div className="loading-spinner" style={{ margin: "2rem auto" }} />
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      {/* Tab selector */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setActiveChart("ranking")}
          className={`quick-btn ${activeChart === "ranking" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          <BarChart3 className="w-3 h-3" />
          Rankings
        </button>
        <button
          onClick={() => setActiveChart("distribution")}
          className={`quick-btn ${activeChart === "distribution" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          <Activity className="w-3 h-3" />
          Distribution
        </button>
        <button
          onClick={() => setActiveChart("time")}
          className={`quick-btn ${activeChart === "time" ? "active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          <TrendingUp className="w-3 h-3" />
          By Hour
        </button>
      </div>

      {/* Strategy Rankings */}
      {activeChart === "ranking" && (
        <div>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Strategy Performance Rankings</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>#</th>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Strategy</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win Rate</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Avg P&L</th>
                  <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.strategy} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 600, color: i < 3 ? "var(--primary)" : "var(--text-muted)" }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: getStrategyColor(r.strategy),
                        }} />
                        <span style={{ fontWeight: 500 }}>{getStrategyDisplayName(r.strategy)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {r.trades}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      <span style={{ color: r.winRate >= 0.5 ? "#22c55e" : "#ef4444" }}>
                        {(r.winRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      color: r.avgPnL >= 0 ? "#22c55e" : "#ef4444",
                    }}>
                      {r.avgPnL >= 0 ? "+" : ""}${r.avgPnL.toFixed(3)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      <span style={{ color: r.sharpe >= 1 ? "#22c55e" : r.sharpe >= 0 ? "var(--text-primary)" : "#ef4444" }}>
                        {r.sharpe.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {rankings.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No trading data yet. Run some bots to see rankings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Distribution */}
      {activeChart === "distribution" && distribution && (
        <div>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Trade Distribution</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ padding: "0.75rem", background: "rgba(34, 197, 94, 0.1)", borderRadius: 8, border: "1px solid rgba(34, 197, 94, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span style={{ fontWeight: 600, color: "#22c55e" }}>Wins</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <div>Count: {distribution.winCount}</div>
                <div>Avg: +${distribution.avgWin.toFixed(3)}</div>
                <div>Max: +${distribution.largestWin.toFixed(3)}</div>
              </div>
            </div>

            <div style={{ padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: 8, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
                <span style={{ fontWeight: 600, color: "#ef4444" }}>Losses</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <div>Count: {distribution.lossCount}</div>
                <div>Avg: -${distribution.avgLoss.toFixed(3)}</div>
                <div>Max: -${distribution.largestLoss.toFixed(3)}</div>
              </div>
            </div>
          </div>

          {/* Profit Factor */}
          <div style={{ padding: "0.75rem", background: "var(--glass-bg)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Profit Factor</span>
              <span style={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 600,
                fontSize: "1.25rem",
                color: distribution.profitFactor >= 1 ? "#22c55e" : "#ef4444",
              }}>
                {distribution.profitFactor >= 999 ? "∞" : distribution.profitFactor.toFixed(2)}
              </span>
            </div>
            <div style={{
              marginTop: "0.5rem",
              height: 8,
              background: "var(--border)",
              borderRadius: 4,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.min(100, (distribution.profitFactor / 3) * 100)}%`,
                height: "100%",
                background: distribution.profitFactor >= 1 ? "#22c55e" : "#ef4444",
                borderRadius: 4,
              }} />
            </div>
          </div>

          {/* Mini histogram */}
          {distribution.wins.length + distribution.losses.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>P&L Histogram</h4>
              <div style={{ display: "flex", gap: 2, height: 60, alignItems: "flex-end" }}>
                {distribution.losses.slice(-20).map((loss, i) => (
                  <div
                    key={`loss-${i}`}
                    style={{
                      flex: 1,
                      background: "#ef4444",
                      height: `${Math.min(100, (loss / (distribution.largestLoss || 1)) * 100)}%`,
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                ))}
                {distribution.wins.slice(-20).map((win, i) => (
                  <div
                    key={`win-${i}`}
                    style={{
                      flex: 1,
                      background: "#22c55e",
                      height: `${Math.min(100, (win / (distribution.largestWin || 1)) * 100)}%`,
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time-based Performance */}
      {activeChart === "time" && timePerf && (
        <div>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Performance by Hour</h3>

          {/* Bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", height: 100, gap: 2 }}>
            {timePerf.intervals.map((interval) => {
              const maxTrades = Math.max(...timePerf.intervals.map(i => i.trades), 1);
              const height = (interval.trades / maxTrades) * 100;
              return (
                <div
                  key={interval.hour}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      background: interval.pnl >= 0 ? "#22c55e" : "#ef4444",
                      height: `${Math.max(2, height)}%`,
                      borderRadius: "2px 2px 0 0",
                      opacity: interval.trades > 0 ? 1 : 0.2,
                    }}
                    title={`Hour ${interval.hour}: ${interval.trades} trades, ${(interval.winRate * 100).toFixed(1)}% win rate, $${interval.pnl.toFixed(2)} P&L`}
                  />
                </div>
              );
            })}
          </div>

          {/* Hour labels */}
          <div style={{ display: "flex", fontSize: "0.625rem", color: "var(--text-muted)", marginTop: 2 }}>
            {timePerf.intervals.map((interval) => (
              <div key={interval.hour} style={{ flex: 1, textAlign: "center" }}>
                {interval.hour % 3 === 0 ? interval.hour : ""}
              </div>
            ))}
          </div>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginTop: "1rem" }}>
            <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Best Hour</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                {timePerf.intervals.reduce((best, curr) =>
                  curr.pnl > best.pnl ? curr : best, timePerf.intervals[0])?.hour ?? "-"}:00
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Total Trades</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
                {timePerf.intervals.reduce((sum, i) => sum + i.trades, 0)}
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "0.5rem", background: "var(--glass-bg)", borderRadius: 6 }}>
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Total P&L</div>
              <div style={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 600,
                color: timePerf.intervals.reduce((sum, i) => sum + i.pnl, 0) >= 0 ? "#22c55e" : "#ef4444",
              }}>
                ${timePerf.intervals.reduce((sum, i) => sum + i.pnl, 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}