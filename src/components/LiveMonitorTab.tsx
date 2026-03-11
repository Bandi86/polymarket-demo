import { useState } from "react";
import { Activity, Target, DollarSign, BarChart3 } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { BotStatusCard } from "./BotStatusCard";
import type { BotData } from "../hooks/useTradingData";
import type { BotLog } from "../types";

interface LiveMonitorTabProps {
  bots: BotData[];
  botLogs: BotLog[];
  yesPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
}

type SortField = 'pnl' | 'winRate' | 'trades' | 'balance';

export function LiveMonitorTab({ bots, botLogs, yesPrice, positions }: LiveMonitorTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('pnl');
  const [showActivityFeed, setShowActivityFeed] = useState(true);

  // Calculate summary stats
  const activeBots = bots.filter(b => b.enabled);
  const totalPnl = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
  const totalPositions = positions.filter(p => p.botId).length;
  const totalBalance = bots.reduce((sum, b) => sum + b.portfolio.balance, 0);

  // Sort bots
  const sortedBots = [...bots].sort((a, b) => {
    switch (sortBy) {
      case 'pnl':
        return b.stats.pnl - a.stats.pnl;
      case 'winRate':
        return b.stats.winRate - a.stats.winRate;
      case 'trades':
        return b.stats.trades - a.stats.trades;
      case 'balance':
        return b.portfolio.balance - a.portfolio.balance;
      default:
        return 0;
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Summary Bar */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Active:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {activeBots.length}/{bots.length}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <DollarSign className="w-4 h-4" style={{ color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total P&L:</span>
            <span
              style={{
                fontWeight: 600,
                fontFamily: "ui-monospace, monospace",
                color: totalPnl >= 0 ? "#22c55e" : "#ef4444"
              }}
            >
              {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Positions:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>{totalPositions}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Balance:</span>
            <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
              {formatCurrency(totalBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Sort by:</span>
        {(['pnl', 'winRate', 'trades', 'balance'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              borderRadius: 4,
              border: sortBy === field ? "1px solid var(--primary)" : "1px solid var(--border)",
              background: sortBy === field ? "rgba(59, 130, 246, 0.1)" : "transparent",
              color: sortBy === field ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer"
            }}
          >
            {field === 'pnl' ? 'P&L' : field === 'winRate' ? 'Win Rate' : field.charAt(0).toUpperCase() + field.slice(1)}
          </button>
        ))}
      </div>

      {/* Bot Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "0.75rem"
      }}>
        {sortedBots.map(bot => (
          <BotStatusCard
            key={bot.id}
            bot={bot}
            yesPrice={yesPrice}
            positions={positions}
          />
        ))}
      </div>

      {/* Activity Feed */}
      <div className="glass-card" style={{ padding: "0.75rem" }}>
        <button
          onClick={() => setShowActivityFeed(!showActivityFeed)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "0.875rem"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity className="w-4 h-4" />
            Activity Feed
            {botLogs.length > 0 && (
              <span style={{
                padding: "0.125rem 0.375rem",
                background: "var(--primary)",
                color: "white",
                borderRadius: 9999,
                fontSize: "0.625rem"
              }}>
                {botLogs.length}
              </span>
            )}
          </span>
          <span style={{ transform: showActivityFeed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            ▼
          </span>
        </button>

        {showActivityFeed && (
          <div style={{
            marginTop: "0.75rem",
            maxHeight: 300,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}>
            {botLogs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                No recent activity
              </div>
            ) : (
              botLogs.slice(0, 20).map(log => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.375rem 0.5rem",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    fontSize: "0.75rem"
                  }}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: log.type === "TRADE" ? "#3b82f6" : log.type === "ERROR" ? "#ef4444" : "#f59e0b"
                  }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.625rem" }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontWeight: 500 }}>{log.botName}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}