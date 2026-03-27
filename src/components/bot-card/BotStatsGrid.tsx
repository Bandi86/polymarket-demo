import { Flame, Snowflake } from "lucide-react";

interface BotStatsGridProps {
  winRate: number;
  trades: number;
  wins: number;
  losses: number;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  avgTrade: number;
  pnl: number;
}

export function BotStatsGrid({
  winRate,
  trades,
  wins,
  losses,
  currentStreak,
  avgTrade,
  pnl,
}: BotStatsGridProps) {
  const avgTradeValue = trades > 0 ? pnl / trades : 0;
  const isWinning = avgTradeValue >= 0;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "0.5rem",
      marginBottom: "1rem",
    }}>
      {/* Win Rate */}
      <div style={{
        padding: "0.625rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Win Rate</div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          color: winRate >= 50 ? "#22c55e" : winRate > 0 ? "#f59e0b" : "var(--text-muted)",
        }}>
          {winRate.toFixed(0)}%
        </div>
      </div>

      {/* Trades */}
      <div style={{
        padding: "0.625rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Trades</div>
        <div style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" }}>
          {trades}
        </div>
        <div style={{ fontSize: "0.625rem", fontWeight: 500 }}>
          <span style={{ color: "#22c55e" }}>{wins}W</span>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ color: "#ef4444" }}>{losses}L</span>
        </div>
      </div>

      {/* Streak */}
      <div style={{
        padding: "0.625rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Streak</div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.2rem",
          color: currentStreak.type === "win" ? "#f59e0b" : currentStreak.type === "loss" ? "#3b82f6" : "var(--text-muted)",
        }}>
          {currentStreak.type === "win" && <Flame style={{ width: 14, height: 14 }} />}
          {currentStreak.type === "loss" && <Snowflake style={{ width: 14, height: 14 }} />}
          {currentStreak.count > 0 ? currentStreak.count : "-"}
        </div>
      </div>

      {/* Avg Trade */}
      <div style={{
        padding: "0.625rem",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 8,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Avg Trade</div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.875rem",
          color: trades > 0 ? (isWinning ? "#22c55e" : "#ef4444") : "var(--text-muted)",
        }}>
          {trades > 0 ? `$${avgTradeValue.toFixed(2)}` : "-"}
        </div>
      </div>
    </div>
  );
}