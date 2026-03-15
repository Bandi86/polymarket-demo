import { Bot, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";

interface BotSummaryStripProps {
  bots: BotData[];
  isBotRunning: boolean;
  onOpenDashboard: () => void;
}

export function BotSummaryStrip({ bots, isBotRunning, onOpenDashboard }: BotSummaryStripProps) {
  const activeBots = bots.filter(b => b.enabled);
  const totalPnl = bots.reduce((sum, b) => sum + (b.stats?.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, b) => sum + (b.stats?.trades || 0), 0);
  const avgWinRate = bots.length > 0
    ? bots.reduce((sum, b) => sum + (b.stats?.winRate || 0), 0) / bots.length
    : 0;

  return (
    <div
      onClick={onOpenDashboard}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        padding: "0.625rem 1rem",
        background: "linear-gradient(90deg, rgba(11, 11, 15, 0.6), rgba(30, 30, 40, 0.6))",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "all 0.2s",
        overflow: "hidden",
      }}
    >
      {/* Bot Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isBotRunning ? "#22c55e" : "#f59e0b",
          animation: isBotRunning ? "pulse 2s infinite" : undefined,
          boxShadow: isBotRunning ? "0 0 6px #22c55e" : undefined,
        }} />
        <Bot className="w-4 h-4" style={{ color: isBotRunning ? "#22c55e" : "var(--text-muted)" }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
          {activeBots.length}/{bots.length} Bots
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

      {/* Total PnL */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
        {totalPnl >= 0 ? (
          <TrendingUp className="w-3 h-3" style={{ color: "#22c55e" }} />
        ) : (
          <TrendingDown className="w-3 h-3" style={{ color: "#ef4444" }} />
        )}
        <span style={{
          fontSize: "0.75rem",
          fontFamily: "ui-monospace, monospace",
          fontWeight: 600,
          color: totalPnl >= 0 ? "#22c55e" : "#ef4444",
        }}>
          {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
        </span>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.7rem", color: "var(--text-muted)", overflow: "hidden" }}>
        <span>
          <span style={{ opacity: 0.6 }}>Trades: </span>
          <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)" }}>{totalTrades}</span>
        </span>
        <span>
          <span style={{ opacity: 0.6 }}>WR: </span>
          <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)" }}>
            {(avgWinRate * 100).toFixed(0)}%
          </span>
        </span>
      </div>

      {/* Individual Bot Dots */}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
        {bots.slice(0, 6).map(bot => (
          <div
            key={bot.id}
            title={`${bot.name}: ${formatCurrency(bot.stats?.pnl || 0)}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: !bot.enabled ? "#555" :
                (bot.stats?.pnl || 0) > 0 ? "#22c55e" :
                (bot.stats?.pnl || 0) < 0 ? "#ef4444" : "#f59e0b",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Open Dashboard Arrow */}
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
        →
      </span>
    </div>
  );
}
