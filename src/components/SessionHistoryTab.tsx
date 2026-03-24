'use client'

import { useState, useMemo } from "react";
import { Clock, Download, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useBotSessions } from "@/hooks/useBotSessions";
import { SessionDetailPanel } from "@/components/SessionDetailPanel";
import type { BotSession } from "@/types";

type SortField = 'date' | 'pnl' | 'winRate' | 'trades';
type SortOrder = 'asc' | 'desc';

function formatDuration(ms: number): string {
  if (!ms) return "-";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function SessionHistoryTab() {
  const { sessions, loading, error, refetch } = useBotSessions();
  const [selectedSession, setSelectedSession] = useState<BotSession | null>(null);
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Get unique strategies
  const strategies = useMemo(() => {
    const unique = new Set(sessions.map(s => s.strategy));
    return ["all", ...Array.from(unique)];
  }, [sessions]);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Filter by strategy
    if (strategyFilter !== "all") {
      result = result.filter(s => s.strategy === strategyFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = a.startTime - b.startTime;
          break;
        case 'pnl':
          const aPnl = (a.endBalance || 0) - a.startBalance;
          const bPnl = (b.endBalance || 0) - b.startBalance;
          comparison = aPnl - bPnl;
          break;
        case 'winRate':
          const aWR = a.totalTrades > 0 ? a.winningTrades / a.totalTrades : 0;
          const bWR = b.totalTrades > 0 ? b.winningTrades / b.totalTrades : 0;
          comparison = aWR - bWR;
          break;
        case 'trades':
          comparison = a.totalTrades - b.totalTrades;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [sessions, strategyFilter, sortBy, sortOrder]);

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Bot", "Strategy", "Start Time", "End Time", "Duration", "Trades", "Wins", "Losses", "P&L", "ROI%"];
    const rows = filteredSessions.map(s => {
      const pnl = (s.endBalance || 0) - s.startBalance;
      const roi = s.startBalance > 0 ? ((s.endBalance || 0) - s.startBalance) / s.startBalance * 100 : 0;
      return [
        s.botName,
        s.strategy,
        new Date(s.startTime).toISOString(),
        s.endTime ? new Date(s.endTime).toISOString() : "",
        s.endTime ? formatDuration(s.endTime - s.startTime) : "",
        s.totalTrades,
        s.winningTrades,
        s.losingTrades,
        pnl.toFixed(2),
        roi.toFixed(2)
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#ef4444" }}>
        Error: {error}
        <button onClick={refetch} style={{ marginLeft: "1rem" }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Filters */}
      <div className="glass-card" style={{ padding: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem"
              }}
            >
              {strategies.map(s => (
                <option key={s} value={s}>{s === "all" ? "All Strategies" : s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem"
              }}
            >
              <option value="date">Date</option>
              <option value="pnl">P&L</option>
              <option value="winRate">Win Rate</option>
              <option value="trades">Trades</option>
            </select>
            <button
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
                cursor: "pointer"
              }}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <button
            onClick={exportCSV}
            disabled={filteredSessions.length === 0}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--glass-bg)",
              color: "var(--text-secondary)",
              fontSize: "0.75rem",
              cursor: filteredSessions.length > 0 ? "pointer" : "not-allowed",
              opacity: filteredSessions.length > 0 ? 1 : 0.5
            }}
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="glass-card" style={{ padding: "0.5rem" }}>
        {filteredSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
            No sessions found. Start some bots to see session history.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Bot</th>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Strategy</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Duration</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Trades</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>P&L</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)", fontWeight: 500 }}>Win%</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => {
                const pnl = (session.endBalance || 0) - session.startBalance;
                const winRate = session.totalTrades > 0
                  ? (session.winningTrades / session.totalTrades * 100)
                  : 0;
                const duration = session.endTime
                  ? session.endTime - session.startTime
                  : 0;
                const isSelected = selectedSession?.id === session.id;

                return (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedSession(isSelected ? null : session)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "rgba(59, 130, 246, 0.1)" : "transparent",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    <td style={{ padding: "0.5rem" }}>{session.botName}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span style={{
                        fontSize: "0.625rem",
                        padding: "0.125rem 0.375rem",
                        borderRadius: 4,
                        background: "rgba(59, 130, 246, 0.2)",
                        color: "#3b82f6"
                      }}>
                        {session.strategy}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {formatDuration(duration)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {session.totalTrades}
                    </td>
                    <td style={{
                      padding: "0.5rem",
                      textAlign: "right",
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 600,
                      color: pnl >= 0 ? "#22c55e" : "#ef4444"
                    }}>
                      {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {session.totalTrades > 0 ? `${winRate.toFixed(0)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Session Detail Panel */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}