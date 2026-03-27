import { Flame, TrendingUp, Zap } from "lucide-react";

interface QuickStatsCardsProps {
  maxConsecutiveWins: number;
  bestTrade: number;
  activeBots: number;
  isBotRunning: boolean;
  totalPnl: number;
}

export function QuickStatsCards({
  maxConsecutiveWins,
  bestTrade,
  activeBots,
  isBotRunning,
  totalPnl,
}: QuickStatsCardsProps) {
  if (!isBotRunning && totalPnl === 0) return null;

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {maxConsecutiveWins >= 3 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.05))",
          border: "1px solid rgba(251, 146, 60, 0.3)",
        }}>
          <Flame style={{ width: 14, height: 14, color: "#fb923c" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fb923c" }}>
            🔥 Hot Streak: {maxConsecutiveWins} wins
          </span>
        </div>
      )}
      {bestTrade > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))",
          border: "1px solid rgba(34, 197, 94, 0.3)",
        }}>
          <TrendingUp style={{ width: 14, height: 14, color: "#22c55e" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#22c55e" }}>
            📈 Best Trade: +${bestTrade.toFixed(0)}
          </span>
        </div>
      )}
      {isBotRunning && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))",
          border: "1px solid rgba(59, 130, 246, 0.3)",
        }}>
          <Zap style={{ width: 14, height: 14, color: "#3b82f6" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#3b82f6" }}>
            ⚡ Active: {activeBots} bots
          </span>
        </div>
      )}
    </div>
  );
}