import { useState, useCallback } from "react";
import { Activity, Target, DollarSign, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { BotStatusCard } from "./BotStatusCard";
import { BotConfigPanel } from "./BotConfigPanel";
import type { BotData } from "../hooks/useTradingData";
import type { BotLog } from "../types";

interface LiveMonitorTabProps {
  bots: BotData[];
  botLogs: BotLog[];
  yesPrice: number;
  noPrice: number;
  positions: Array<{
    id: string;
    botId?: string;
    outcome: "YES" | "NO";
    amount: number;
    stake: number;
  }>;
  updateBotState: (botId: string, updates: Partial<BotData>) => void;
  timeRemaining: number;
}

type SortField = 'pnl' | 'winRate' | 'trades' | 'balance';

export function LiveMonitorTab({ bots, botLogs, yesPrice, noPrice, positions, updateBotState, timeRemaining }: LiveMonitorTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('pnl');
  const [showActivityFeed, setShowActivityFeed] = useState(true);
  const [configBot, setConfigBot] = useState<BotData | null>(null);

  // Calculate summary stats
  const activeBots = bots.filter(b => b.enabled);
  const totalPnl = bots.reduce((sum, b) => sum + b.stats.pnl, 0);
  const totalPositions = positions.filter(p => p.botId).length;
  const totalBalance = bots.reduce((sum, b) => sum + b.portfolio.balance, 0);
  const totalTrades = bots.reduce((sum, b) => sum + b.stats.trades, 0);
  const totalWins = bots.reduce((sum, b) => sum + b.stats.wins, 0);
  const totalLosses = bots.reduce((sum, b) => sum + b.stats.losses, 0);
  const totalWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;
  const avgPnlPerTrade = totalTrades > 0 ? totalPnl / totalTrades : 0;
  const positionsValue = positions.reduce((sum, p) => sum + (p.amount || p.stake || 0), 0);

  // Calculate total initial balance and growth
  const totalInitialBalance = bots.reduce((sum, b) => {
    const closedPositions = (b.portfolio?.closedPositions || []) as any[];
    const totalClosedPnL = closedPositions.reduce((s: number, p: any) => s + (p.pnl || 0), 0);
    return sum + (b.portfolio.balance - totalClosedPnL);
  }, 0);
  const totalGrowth = totalBalance - totalInitialBalance;
  const totalGrowthPercent = totalInitialBalance > 0 ? (totalGrowth / totalInitialBalance) * 100 : 0;

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

  // Toggle individual bot
  const handleToggleBot = useCallback(async (botId: string) => {
    try {
      const res = await fetch(`/api/bots/${botId}/toggle`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to toggle bot");
      const updatedBot = await res.json();
      // Immediately update local state with the response
      updateBotState(botId, { enabled: updatedBot.enabled, runTime: updatedBot.runTime });
    } catch (err) {
      console.error("Failed to toggle bot:", err);
    }
  }, [updateBotState]);

  // Update bot config
  const handleSaveConfig = useCallback(async (botId: string, config: Partial<BotData>) => {
    try {
      const res = await fetch(`/api/bots/${botId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error("Failed to update config");
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Summary Bar */}
      <div className="glass-card" style={{ padding: "1.25rem" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.75rem",
        }}>
          {/* Active Bots */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            padding: "0.75rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Active Bots</span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.25rem", color: activeBots.length > 0 ? "#22c55e" : "var(--text-muted)" }}>
              {activeBots.length}/{bots.length}
            </span>
          </div>

          {/* Portfolio Growth */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            padding: "0.75rem",
            background: totalGrowth >= 0 ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))" : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
            borderRadius: 10,
            border: `1px solid ${totalGrowth >= 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              {totalGrowth >= 0 ? (
                <TrendingUp className="w-4 h-4" style={{ color: "#22c55e" }} />
              ) : (
                <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />
              )}
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Portfolio Growth</span>
            </div>
            <span style={{
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              fontSize: "1.25rem",
              color: totalGrowth >= 0 ? "#22c55e" : "#ef4444"
            }}>
              {totalGrowth >= 0 ? "+" : ""}{formatCurrency(totalGrowth)}
            </span>
            <span style={{ fontSize: "0.7rem", color: totalGrowth >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
              ({totalGrowthPercent >= 0 ? "+" : ""}{totalGrowthPercent.toFixed(1)}%)
            </span>
          </div>

          {/* Total Balance */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            padding: "0.75rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <DollarSign className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Balance</span>
            </div>
            <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.25rem" }}>
              {formatCurrency(totalBalance)}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Started: {formatCurrency(totalInitialBalance)}
            </span>
          </div>

          {/* Win Rate */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            padding: "0.75rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Win Rate</span>
            </div>
            <span style={{
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              fontSize: "1.25rem",
              color: totalWinRate >= 0.5 ? "#22c55e" : totalWinRate > 0 ? "#f59e0b" : "var(--text-muted)"
            }}>
              {(totalWinRate * 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <span style={{ color: "#22c55e" }}>{totalWins}W</span>
              <span>/</span>
              <span style={{ color: "#ef4444" }}>{totalLosses}L</span>
              <span> of {totalTrades} trades</span>
            </span>
          </div>

          {/* Positions */}
          {totalPositions > 0 && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              padding: "0.75rem",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                <Target className="w-4 h-4" style={{ color: "#3b82f6" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Positions</span>
              </div>
              <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "1.25rem", color: "#3b82f6" }}>
                {totalPositions}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                ${positionsValue.toFixed(2)} at risk
              </span>
            </div>
          )}

          {/* Avg PnL per Trade */}
          {totalTrades > 0 && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              padding: "0.75rem",
              background: avgPnlPerTrade >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
              borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                <Activity className="w-4 h-4" style={{ color: avgPnlPerTrade >= 0 ? "#22c55e" : "#ef4444" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Avg/Trade</span>
              </div>
              <span style={{
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                fontSize: "1.25rem",
                color: avgPnlPerTrade >= 0 ? "#22c55e" : "#ef4444"
              }}>
                {avgPnlPerTrade >= 0 ? "+" : ""}{formatCurrency(avgPnlPerTrade)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sort Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>Sort by:</span>
        {(['pnl', 'winRate', 'trades', 'balance'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => setSortBy(field)}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              borderRadius: 8,
              border: sortBy === field ? "1px solid var(--primary)" : "1px solid var(--border)",
              background: sortBy === field ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: sortBy === field ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: sortBy === field ? 600 : 500,
            }}
          >
            {field === 'pnl' ? 'P&L' : field === 'winRate' ? 'Win Rate' : field.charAt(0).toUpperCase() + field.slice(1)}
          </button>
        ))}
      </div>

      {/* Bot Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(520px, 1fr))",
        gap: "1.25rem"
      }}>
        {sortedBots.map(bot => (
          <BotStatusCard
            key={bot.id}
            bot={bot}
            yesPrice={yesPrice}
            noPrice={noPrice}
            positions={positions}
            onToggle={handleToggleBot}
            onOpenConfig={setConfigBot}
            timeRemaining={timeRemaining}
          />
        ))}
      </div>

      {/* Activity Feed */}
      <div className="glass-card" style={{ padding: "1.25rem" }}>
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
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity className="w-4 h-4" />
            Activity Feed
            {botLogs.length > 0 && (
              <span style={{
                padding: "0.125rem 0.5rem",
                background: "var(--primary)",
                color: "white",
                borderRadius: 9999,
                fontSize: "0.625rem",
                fontWeight: 600,
              }}>
                {botLogs.length}
              </span>
            )}
          </span>
          <span style={{ transform: showActivityFeed ? "rotate(180deg)" : "none", transition: "transform 0.2s", opacity: 0.5 }}>
            ▼
          </span>
        </button>

        {showActivityFeed && (
          <div style={{
            marginTop: "1rem",
            maxHeight: 320,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem"
          }}>
            {botLogs.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "2rem",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 10,
              }}>
                No recent activity
              </div>
            ) : (
              botLogs.slice(0, 20).map(log => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.625rem 0.75rem",
                    background: log.type === "TRADE" ? "rgba(59, 130, 246, 0.1)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.1)" : "rgba(0,0,0,0.2)",
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    border: `1px solid ${log.type === "TRADE" ? "rgba(59, 130, 246, 0.2)" : log.type === "ERROR" ? "rgba(239, 68, 68, 0.2)" : "transparent"}`,
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: log.type === "TRADE" ? "#3b82f6" : log.type === "ERROR" ? "#ef4444" : "#f59e0b",
                    boxShadow: log.type === "TRADE" ? "0 0 8px rgba(59, 130, 246, 0.5)" : log.type === "ERROR" ? "0 0 8px rgba(239, 68, 68, 0.5)" : "none",
                  }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.625rem", fontFamily: "ui-monospace, monospace" }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{log.botName}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1 }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Config Modal */}
      {configBot && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 999
            }}
            onClick={() => setConfigBot(null)}
          />
          <BotConfigPanel
            bot={configBot}
            onClose={() => setConfigBot(null)}
            onSave={handleSaveConfig}
          />
        </>
      )}
    </div>
  );
}