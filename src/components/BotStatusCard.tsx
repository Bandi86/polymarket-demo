import { Bot, Activity } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import type { BotData } from "../hooks/useTradingData";

interface BotStatusCardProps {
  bot: BotData;
  yesPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
}

export function BotStatusCard({ bot, yesPrice, positions }: BotStatusCardProps) {
  const botPositions = positions.filter(p => p.botId === bot.id);
  const unrealizedPnl = botPositions.reduce((sum, pos) => {
    if (pos.outcome === "YES") {
      return sum + (pos.amount * yesPrice - pos.stake);
    }
    return sum + (pos.amount * (1 - yesPrice) - pos.stake);
  }, 0);

  const initialBalance = 10; // Each bot starts with $10
  const pnlPercent = initialBalance > 0
    ? ((bot.portfolio.balance - initialBalance) / initialBalance) * 100
    : 0;

  return (
    <div
      className="glass-card"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        border: bot.enabled ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid var(--border)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: bot.enabled ? "#22c55e" : "#6b7280",
              animation: bot.enabled ? "pulse 2s infinite" : undefined
            }}
          />
          <Bot className="w-4 h-4" style={{ color: bot.enabled ? "#22c55e" : "var(--text-muted)" }} />
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{bot.name}</span>
        </div>
        <span
          style={{
            fontSize: "0.625rem",
            padding: "0.125rem 0.375rem",
            borderRadius: 4,
            background: bot.enabled ? "rgba(34, 197, 94, 0.2)" : "rgba(107, 114, 128, 0.2)",
            color: bot.enabled ? "#22c55e" : "#6b7280"
          }}
        >
          {bot.strategy}
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Balance</div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>
            {formatCurrency(bot.portfolio.balance)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>P&L</div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: bot.stats.pnl >= 0 ? "#22c55e" : "#ef4444"
            }}
          >
            {bot.stats.pnl >= 0 ? "+" : ""}{formatCurrency(bot.stats.pnl)}
            <span style={{ fontSize: "0.625rem", marginLeft: 4 }}>
              ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Trades</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>{bot.stats.trades}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>Win Rate</div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>
            {bot.stats.winRate > 0 ? `${(bot.stats.winRate * 100).toFixed(0)}%` : "-"}
          </div>
        </div>
      </div>

      {/* Positions & Unrealized PnL */}
      {botPositions.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 6,
          fontSize: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Activity className="w-3 h-3" style={{ color: "#3b82f6" }} />
            <span>{botPositions.length} position{botPositions.length > 1 ? "s" : ""}</span>
          </div>
          <div style={{
            fontFamily: "ui-monospace, monospace",
            color: unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"
          }}>
            {unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(unrealizedPnl)} unrealized
          </div>
        </div>
      )}
    </div>
  );
}