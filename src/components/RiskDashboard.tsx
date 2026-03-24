'use client'

import { useState, useEffect } from "react";
import { AlertTriangle, Activity, Shield, AlertCircle, CheckCircle } from "lucide-react";
import type { BotData } from "@/hooks/useTradingData";

interface RiskMetric {
  name: string;
  value: number;
  threshold: number;
  status: "safe" | "warning" | "critical";
  unit: string;
  description: string;
}

interface RiskDashboardProps {
  bots: BotData[];
  totalBalance: number;
  initialBalance: number;
}

export function RiskDashboard({ bots, totalBalance, initialBalance }: RiskDashboardProps) {
  const [metrics, setMetrics] = useState<RiskMetric[]>([]);
  const [warnings, setWarnings] = useState<{ botId: string; message: string; severity: string }[]>([]);

  useEffect(() => {
    // Calculate risk metrics
    const totalPnL = totalBalance - initialBalance;
    const drawdownPct = initialBalance > 0 ? ((initialBalance - totalBalance) / initialBalance) * 100 : 0;

    const activeBots = bots.filter(b => b.enabled);
    const totalTrades = bots.reduce((sum, b) => sum + b.stats.trades, 0);
    const totalWins = bots.reduce((sum, b) => sum + b.stats.wins, 0);
    const totalWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;

    // Find max drawdown among bots
    const maxBotDrawdown = Math.max(...bots.map(b => b.portfolio?.maxDrawdown || 0));

    // Check for warnings
    const newWarnings: { botId: string; message: string; severity: string }[] = [];
    bots.forEach(bot => {
      if (bot.stats.trades >= 10 && bot.stats.winRate < 0.35) {
        newWarnings.push({
          botId: bot.id,
          message: `Low win rate: ${(bot.stats.winRate * 100).toFixed(0)}%`,
          severity: "warning"
        });
      }
      if (bot.portfolio?.maxDrawdown && bot.portfolio.maxDrawdown > 30) {
        newWarnings.push({
          botId: bot.id,
          message: `High drawdown: ${bot.portfolio.maxDrawdown.toFixed(0)}%`,
          severity: "critical"
        });
      }
    });

    setWarnings(newWarnings);

    setMetrics([
      {
        name: "Portfolio Drawdown",
        value: drawdownPct,
        threshold: 20,
        status: drawdownPct > 20 ? "critical" : drawdownPct > 10 ? "warning" : "safe",
        unit: "%",
        description: "Current portfolio drawdown from peak"
      },
      {
        name: "Total P&L",
        value: totalPnL,
        threshold: 0,
        status: totalPnL < -10 ? "critical" : totalPnL < 0 ? "warning" : "safe",
        unit: "$",
        description: "Total profit/loss across all bots"
      },
      {
        name: "Win Rate",
        value: totalWinRate * 100,
        threshold: 50,
        status: totalWinRate < 0.35 ? "critical" : totalWinRate < 0.50 ? "warning" : "safe",
        unit: "%",
        description: "Overall win rate across all bots"
      },
      {
        name: "Active Bots",
        value: activeBots.length,
        threshold: bots.length / 2,
        status: activeBots.length === 0 ? "critical" : activeBots.length < bots.length / 2 ? "warning" : "safe",
        unit: "",
        description: "Number of bots currently trading"
      },
      {
        name: "Max Bot Drawdown",
        value: maxBotDrawdown,
        threshold: 25,
        status: maxBotDrawdown > 25 ? "critical" : maxBotDrawdown > 15 ? "warning" : "safe",
        unit: "%",
        description: "Highest drawdown among all bots"
      },
      {
        name: "Total Trades",
        value: totalTrades,
        threshold: 100,
        status: totalTrades > 200 ? "warning" : "safe",
        unit: "",
        description: "Total trades executed this session"
      }
    ]);
  }, [bots, totalBalance, initialBalance]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "#ef4444";
      case "warning": return "#f59e0b";
      default: return "#22c55e";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical": return <AlertCircle className="w-4 h-4" style={{ color: "#ef4444" }} />;
      case "warning": return <AlertTriangle className="w-4 h-4" style={{ color: "#f59e0b" }} />;
      default: return <CheckCircle className="w-4 h-4" style={{ color: "#22c55e" }} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "0.75rem"
      }}>
        {metrics.map((metric, i) => (
          <div
            key={i}
            style={{
              padding: "1rem",
              background: metric.status === "critical"
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))"
                : metric.status === "warning"
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))"
                : "rgba(0,0,0,0.2)",
              borderRadius: 12,
              border: `1px solid ${metric.status === "critical" ? "rgba(239, 68, 68, 0.3)" : metric.status === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.05)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              {getStatusIcon(metric.status)}
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{metric.name}</span>
            </div>
            <div style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              color: getStatusColor(metric.status)
            }}>
              {metric.unit === "$"
                ? `${metric.value >= 0 ? "+" : ""}$${metric.value.toFixed(2)}`
                : `${metric.value.toFixed(metric.unit === "%" ? 1 : 0)}${metric.unit}`}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              {metric.description}
            </div>
          </div>
        ))}
      </div>

      {/* Bot Performance Summary */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Activity className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontWeight: 600 }}>Bot Performance</span>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          {bots.sort((a, b) => (b.portfolio?.balance || 0) - (a.portfolio?.balance || 0)).slice(0, 5).map(bot => {
            const pnl = (bot.portfolio?.balance || 10) - 10;
            const pnlPct = ((bot.portfolio?.balance || 10) / 10 - 1) * 100;
            const isProfitable = pnl >= 0;

            return (
              <div
                key={bot.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: bot.enabled ? "#22c55e" : "#71717a",
                    boxShadow: bot.enabled ? "0 0 8px rgba(34, 197, 94, 0.5)" : "none"
                  }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{bot.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {bot.stats.trades} trades • {(bot.stats.winRate * 100).toFixed(0)}% win
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontWeight: 600,
                    fontFamily: "ui-monospace, monospace",
                    color: isProfitable ? "#22c55e" : "#ef4444"
                  }}>
                    {isProfitable ? "+" : ""}{pnl.toFixed(2)}
                  </div>
                  <div style={{
                    fontSize: "0.7rem",
                    color: isProfitable ? "#22c55e" : "#ef4444"
                  }}>
                    {isProfitable ? "+" : ""}{pnlPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="glass-card" style={{ padding: "1rem", borderLeft: "3px solid #f59e0b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <AlertTriangle className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <span style={{ fontWeight: 600, color: "#f59e0b" }}>Warnings</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {warnings.map((w, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                background: "rgba(245, 158, 11, 0.1)",
                borderRadius: 6,
                fontSize: "0.8rem"
              }}>
                <span style={{ color: "var(--text-muted)" }}>{w.botId}:</span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kelly Settings Info */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Shield className="w-4 h-4" style={{ color: "#3b82f6" }} />
          <span style={{ fontWeight: 600 }}>Kelly Criterion Status</span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          <p style={{ marginBottom: "0.5rem" }}>
            Kelly criterion is <span style={{ color: "#22c55e", fontWeight: 500 }}>enabled</span> by default for all bots.
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            Using <span style={{ color: "#3b82f6" }}>Quarter Kelly (25%)</span> for safety.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-muted)" }}>
            <li>Win rate based position sizing</li>
            <li>Max bet capped at 25% of bankroll</li>
            <li>Confidence-weighted bet adjustment</li>
          </ul>
        </div>
      </div>
    </div>
  );
}