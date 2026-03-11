import { X, Clock, Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { BotSession } from "../types";

interface SessionDetailPanelProps {
  session: BotSession;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  if (!ms) return "-";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function SessionDetailPanel({ session, onClose }: SessionDetailPanelProps) {
  const duration = session.endTime ? session.endTime - session.startTime : 0;
  const roi = session.startBalance > 0
    ? ((session.endBalance || 0) - session.startBalance) / session.startBalance * 100
    : 0;
  const pnl = (session.endBalance || 0) - session.startBalance;

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        marginTop: "0.5rem",
        border: "1px solid var(--border)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{session.botName}</h3>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Session #{session.id.slice(-6)} · {session.strategy}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0.25rem"
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Start</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {formatCurrency(session.startBalance)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>End</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: pnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {formatCurrency(session.endBalance || 0)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>P&L</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: pnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>ROI</div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            color: roi >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", fontSize: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)" }}>Duration:</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Target className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)" }}>Trades:</span>
          <span>{session.totalTrades}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          {session.totalTrades > 0 ? (
            <>
              <TrendingUp className="w-3 h-3" style={{ color: "#22c55e" }} />
              <span style={{ color: "var(--text-muted)" }}>Win Rate:</span>
              <span>{((session.winningTrades / session.totalTrades) * 100).toFixed(0)}%</span>
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>No trades</span>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>
        {new Date(session.startTime).toLocaleString()} → {session.endTime ? new Date(session.endTime).toLocaleString() : "Running"}
      </div>
    </div>
  );
}