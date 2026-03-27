import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface BotBalanceCardProps {
  balance: number;
  initialBalance: number;
  balanceGrowth: number;
  growthPercent: number;
}

export function BotBalanceCard({
  balance,
  initialBalance,
  balanceGrowth,
  growthPercent,
}: BotBalanceCardProps) {
  const isPositive = balanceGrowth >= 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1rem",
      background: isPositive
        ? "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))"
        : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
      borderRadius: 12,
      marginBottom: "1rem",
      border: `1px solid ${isPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
    }}>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
          Bot Balance
        </div>
        <div style={{
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          fontSize: "1.5rem",
          color: "var(--text-primary)",
        }}>
          ${balance.toFixed(2)}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
          Started: ${initialBalance.toFixed(2)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.25rem",
          color: isPositive ? "#22c55e" : "#ef4444",
        }}>
          {isPositive ? (
            <ArrowUpRight style={{ width: 20, height: 20 }} />
          ) : (
            <ArrowDownRight style={{ width: 20, height: 20 }} />
          )}
          <span style={{ fontWeight: 700, fontSize: "1.125rem" }}>
            {isPositive ? "+" : ""}{balanceGrowth.toFixed(2)}
          </span>
        </div>
        <div style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: isPositive ? "#22c55e" : "#ef4444",
        }}>
          ({isPositive ? "+" : ""}{growthPercent.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}