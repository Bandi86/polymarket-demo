import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "../lib/utils";

interface PositionItem {
  id: string;
  outcome: "YES" | "NO";
  amount: number;
  odds: number;
  unrealizedPnl?: number;
}

interface PositionsPanelProps {
  positions: PositionItem[];
  coinColor: string;
  onClosePosition: (positionId: string) => Promise<void>;
}

export function PositionsPanel({ positions, coinColor, onClosePosition }: PositionsPanelProps) {
  if (positions.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target className="w-3 h-3" style={{ color: coinColor }} />
          <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>Open Positions</span>
        </div>
        <span className="badge badge-primary" style={{ fontSize: "0.625rem" }}>{positions.length}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {positions.map((pos) => (
          <div
            key={pos.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5rem",
              background: "var(--glass-bg)",
              borderRadius: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className={`badge ${pos.outcome === "YES" ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}>
                {pos.outcome === "YES" ? (
                  <><TrendingUp className="w-2 h-2" style={{ display: "inline" }} /> YES</>
                ) : (
                  <><TrendingDown className="w-2 h-2" style={{ display: "inline" }} /> NO</>
                )}
              </span>
              <div>
                <p style={{ fontWeight: 500, fontSize: "0.75rem", margin: 0 }}>{formatCurrency(pos.amount)}</p>
                <p style={{ fontSize: "0.625rem", color: "var(--text-muted)", margin: 0 }}>@{pos.odds.toFixed(2)}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: (pos.unrealizedPnl || 0) >= 0 ? "var(--green)" : "var(--red)"
              }}>
                {formatCurrency(pos.unrealizedPnl || 0)}
              </span>
              <button
                onClick={() => onClosePosition(pos.id)}
                className="quick-btn"
                style={{ fontSize: "0.625rem", padding: "0.25rem 0.5rem" }}
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}