import { Activity } from "lucide-react";
import type { TradeEvent } from "../hooks/useTradingData";

interface ActivityLogProps {
  events: TradeEvent[];
  coinColor: string;
}

export function ActivityLog({ events, coinColor }: ActivityLogProps) {
  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <Activity className="w-4 h-4" style={{ color: coinColor }} />
        <span style={{ fontWeight: 600 }}>Activity</span>
      </div>

      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {events.length > 0 ? events.slice(0, 10).map((evt, i) => (
          <div key={evt.id || i} style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0",
            borderBottom: i < events.length - 1 ? "1px solid var(--border)" : undefined,
            fontSize: "0.8rem"
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontFamily: "monospace" }}>
              {new Date(evt.time).toLocaleTimeString()}
            </span>
            <span className={`badge ${evt.outcome === "YES" ? "badge-green" : "badge-red"}`}>
              {evt.type}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {evt.botName || "You"} → {evt.outcome}
            </span>
            <span style={{ fontFamily: "monospace", marginLeft: "auto" }}>
              ${evt.amount?.toFixed(2)}
            </span>
          </div>
        )) : (
          <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No activity yet
          </div>
        )}
      </div>
    </div>
  );
}
