'use client'

import { useEffect, useState } from "react";
import { X, Trophy, TrendingUp, TrendingDown, Clock, Target, DollarSign, BarChart3, RotateCcw } from "lucide-react";
import type { BotData, CompetitionState } from "@/hooks/useTradingData";
import { formatCurrency } from "@/lib/utils";

interface SessionSummaryModalProps {
  competition: CompetitionState | null;
  bots: BotData[];
  onClose: () => void;
  onReset: () => Promise<void>;
}

export function SessionSummaryModal({ competition, bots, onClose, onReset }: SessionSummaryModalProps) {
  const [visible, setVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // Show modal when competition ends
    if (competition && !competition.active && competition.completedAt) {
      // Small delay for animation
      setTimeout(() => setVisible(true), 100);
    }
  }, [competition]);

  const handleClose = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await onReset();
      onClose();
    } finally {
      setIsResetting(false);
    }
  };

  if (!competition || competition.active || !competition.completedAt) {
    return null;
  }

  const duration = competition.completedAt - competition.startTime;
  const durationMinutes = Math.floor(duration / 60000);

  // Sort bots by P&L
  const sortedBots = [...bots].sort((a, b) => (b.stats?.pnl || 0) - (a.stats?.pnl || 0));
  const winner = sortedBots[0];
  const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
  const avgWinRate = bots.length > 0
    ? bots.reduce((sum, b) => sum + (b.stats?.winRate || 0), 0) / bots.length
    : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          transform: visible ? "scale(1)" : "scale(0.95)",
          transition: "transform 0.3s",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.5rem",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: totalPnl >= 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
            }}>
              <Trophy style={{ width: 20, height: 20, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Session Complete!</h2>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {new Date(competition.completedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          <StatCard
            icon={<Clock style={{ width: 16, height: 16 }} />}
            label="Duration"
            value={`${durationMinutes} minutes`}
            color="var(--primary)"
          />
          <StatCard
            icon={<DollarSign style={{ width: 16, height: 16 }} />}
            label="Total P&L"
            value={`${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`}
            color={totalPnl >= 0 ? "#22c55e" : "#ef4444"}
          />
          <StatCard
            icon={<BarChart3 style={{ width: 16, height: 16 }} />}
            label="Total Trades"
            value={totalTrades.toString()}
            color="var(--text-primary)"
          />
          <StatCard
            icon={<Target style={{ width: 16, height: 16 }} />}
            label="Win Rate"
            value={`${(avgWinRate * 100).toFixed(1)}%`}
            color={avgWinRate >= 0.5 ? "#22c55e" : "#f59e0b"}
          />
        </div>

        {/* Winner Section */}
        {winner && (
          <div style={{ padding: "0 1.5rem 1.5rem" }}>
            <div style={{
              background: "linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.05))",
              border: "1px solid rgba(251, 146, 60, 0.3)",
              borderRadius: 12,
              padding: "1rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🏆</span>
                <span style={{ fontWeight: 600, color: "#fb923c" }}>Top Performer</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.125rem" }}>{winner.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{winner.strategy}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: "1.25rem",
                    color: (winner.stats?.pnl || 0) >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {(winner.stats?.pnl || 0) >= 0 ? "+" : ""}{formatCurrency(winner.stats?.pnl || 0)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {(winner.stats?.winRate || 0) * 100}% win rate
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Bots Leaderboard */}
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-muted)" }}>
            Leaderboard
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sortedBots.map((bot, index) => (
              <div
                key={bot.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: 8,
                  background: index === 0 ? "rgba(251, 146, 60, 0.1)" : "rgba(255,255,255,0.02)",
                  border: "1px solid",
                  borderColor: index === 0 ? "rgba(251, 146, 60, 0.3)" : "var(--border)",
                }}
              >
                <span style={{
                  width: 24,
                  textAlign: "center",
                  fontWeight: 700,
                  color: index === 0 ? "#fb923c" : index === 1 ? "#9ca3af" : index === 2 ? "#b45309" : "var(--text-muted)",
                }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{bot.name}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{bot.strategy}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: (bot.stats?.pnl || 0) >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {(bot.stats?.pnl || 0) >= 0 ? "+" : ""}{formatCurrency(bot.stats?.pnl || 0)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                    {bot.stats?.trades || 0} trades
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleClose}
            disabled={isResetting}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: 8,
              border: "none",
              background: isResetting ? "var(--text-muted)" : "var(--primary)",
              color: "white",
              fontWeight: 600,
              cursor: isResetting ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <RotateCcw style={{ width: 16, height: 16 }} className={isResetting ? "animate-spin" : ""} />
            {isResetting ? "Resetting..." : "Close & Reset Demo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "1rem",
      borderRadius: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid var(--border)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${color}20`,
        color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        <div style={{ fontWeight: 700, fontSize: "1rem", color }}>
          {value}
        </div>
      </div>
    </div>
  );
}